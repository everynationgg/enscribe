import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GridItCustomTemplate } from '../../../shared/gridit/editor.js';
import { BoardFairnessComparison, BoardFairnessReport } from '../../../shared/gridit/fairness.js';
import { GridItModSchedule } from '../../../shared/gridit/mods.js';
import {
  GridItChatMessage,
  GridItMatchMode,
  GridItRoom,
  GridItRoomSettings,
  GridItSessionLeaderboardEntry,
  GridItSpectator,
} from '../../../shared/gridit/multiplayerTypes.js';
import { GridItBoard, GridItFoundWord } from '../../../shared/gridit/types.js';

export class GridItUnavailableError extends Error {
  status = 503;
}

export interface StoredGridItRoom extends GridItRoom {
  battleTemplates: Record<string, GridItCustomTemplate>;
}

export interface StoredGridItPlayerState {
  playerId: string;
  username: string;
  avatarId: string;
  rawScore: number;
  normalizedScorePercent: number;
  foundWords: GridItFoundWord[];
  bestWord: GridItFoundWord | null;
  comboCount: number;
  lastWordAtMs: number | null;
  assignedBoard: GridItBoard;
  assignedFairness: BoardFairnessReport;
  schedule: GridItModSchedule;
  authoredById?: string | null;
  authoredByName?: string | null;
  quotaValidationPassed?: boolean;
}

export interface StoredGridItMatch {
  id: string;
  roomId: string | null;
  mode: GridItMatchMode;
  settings: GridItRoomSettings;
  status: 'shaking' | 'active' | 'finished';
  revealAtMs: number;
  startedAtMs: number;
  endsAtMs: number;
  seed: number;
  players: Record<string, StoredGridItPlayerState>;
  playerOrder: string[];
  spectators: GridItSpectator[];
  winnerIds: string[];
  fairnessComparison: BoardFairnessComparison | null;
  messages: GridItChatMessage[];
  finalizedStats: boolean;
  battleTemplatesSnapshot?: Record<string, GridItCustomTemplate>;
  createdAt: number;
}

const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const MATCH_TTL_MS = 6 * 60 * 60 * 1000;

export class GridItStateStore {
  private supabase: SupabaseClient | null = null;
  private migrationPending = false;
  private loggedWarning = false;
  private readonly forceLocalMemory: boolean;
  private readonly isServerless: boolean;

  // Authoritative in-memory stores (used directly on persistent server with async Postgres write-through)
  private memRooms = new Map<string, { version: number; expiresAtMs: number; data: StoredGridItRoom }>();
  private memMatches = new Map<string, { version: number; expiresAtMs: number; data: StoredGridItMatch }>();
  private memQueues: Record<'quick' | 'ranked', string[]> = { quick: [], ranked: [] };
  private memStats = new Map<string, GridItSessionLeaderboardEntry>();

  // Write-through serialization chains & hydration flags for persistent server (!isServerless)
  private roomPersistChain = new Map<string, Promise<void>>();
  private matchPersistChain = new Map<string, Promise<void>>();
  private publicRoomsHydrated = false;
  private initialExpiredSweepDone = false;

  constructor(options: { forceLocalMemory?: boolean; isServerless?: boolean } = {}) {
    this.forceLocalMemory = Boolean(options.forceLocalMemory);
    this.isServerless = options.isServerless ?? Boolean(process.env.VERCEL);

    if (!this.forceLocalMemory) {
      const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(
        /\/+$/,
        ''
      );
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      if (url && serviceKey) {
        this.supabase = createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      }
    }
  }

  private usePostgres(): boolean {
    return Boolean(this.supabase && !this.migrationPending);
  }

  private isMissingTableOrRpc(error: any): boolean {
    const code = String(error?.code || '');
    const msg = String(error?.message || '').toLowerCase();
    return (
      code === '42P01' ||
      code === '42883' ||
      code === 'PGRST205' ||
      code === 'PGRST202' ||
      msg.includes('does not exist') ||
      msg.includes('could not find the table') ||
      msg.includes('could not find the function')
    );
  }

  private handleDbError(error: any, context: string): never | void {
    if (this.isMissingTableOrRpc(error)) {
      this.migrationPending = true;
      if (this.isServerless) {
        throw new GridItUnavailableError(
          'GridIt multiplayer tables are not deployed yet. Apply supabase/migrations/002_gridit_multiplayer.sql in Supabase SQL Editor.'
        );
      }
      if (!this.loggedWarning) {
        this.loggedWarning = true;
        console.warn(
          '[GridItStateStore] Migration 002 not found in Supabase; using in-memory store locally.'
        );
      }
      return;
    }
    throw new GridItUnavailableError(`GridIt database error (${context}): ${error.message}`);
  }

  private rowToRoom(row: any): StoredGridItRoom {
    const base = row.room_data as GridItRoom;
    const battleTemplates = (row.battle_templates || {}) as Record<string, GridItCustomTemplate>;
    return {
      ...base,
      battleTemplates,
    };
  }

  private cloneRoom(room: StoredGridItRoom): StoredGridItRoom {
    return JSON.parse(JSON.stringify(room)) as StoredGridItRoom;
  }

  private cloneMatch(match: StoredGridItMatch): StoredGridItMatch {
    return JSON.parse(JSON.stringify(match)) as StoredGridItMatch;
  }

  private purgeExpiredInMemory(now = Date.now()): void {
    for (const [id, rec] of this.memRooms.entries()) {
      if (rec.expiresAtMs <= now) {
        this.memRooms.delete(id);
      }
    }
    for (const [id, rec] of this.memMatches.entries()) {
      if (rec.expiresAtMs <= now) {
        this.memMatches.delete(id);
      }
    }
  }

  private enqueueRoomPersist(roomId: string, task: () => Promise<void>): void {
    if (!this.usePostgres()) return;
    const prev = this.roomPersistChain.get(roomId) ?? Promise.resolve();
    const next = prev
      .then(task)
      .catch((err) => {
        console.error(`[GridItStateStore] Async room persist error (${roomId}):`, err?.message || err);
      })
      .finally(() => {
        if (this.roomPersistChain.get(roomId) === next) {
          this.roomPersistChain.delete(roomId);
        }
      });
    this.roomPersistChain.set(roomId, next);
  }

  private enqueueMatchPersist(matchId: string, task: () => Promise<void>): void {
    if (!this.usePostgres()) return;
    const prev = this.matchPersistChain.get(matchId) ?? Promise.resolve();
    const next = prev
      .then(task)
      .catch((err) => {
        console.error(`[GridItStateStore] Async match persist error (${matchId}):`, err?.message || err);
      })
      .finally(() => {
        if (this.matchPersistChain.get(matchId) === next) {
          this.matchPersistChain.delete(matchId);
        }
      });
    this.matchPersistChain.set(matchId, next);
  }

  private findMemRoomEntry(idOrCode: string): { id: string; rec: { version: number; expiresAtMs: number; data: StoredGridItRoom } } | null {
    const now = Date.now();
    const trimmed = idOrCode.trim();
    const upper = trimmed.toUpperCase();
    const direct = this.memRooms.get(trimmed);
    if (direct) {
      if (direct.expiresAtMs > now) return { id: trimmed, rec: direct };
      this.memRooms.delete(trimmed);
    }
    for (const [id, rec] of this.memRooms.entries()) {
      if (rec.expiresAtMs <= now) {
        this.memRooms.delete(id);
        continue;
      }
      if (rec.data.id === trimmed || rec.data.code === upper) {
        return { id, rec };
      }
    }
    return null;
  }

  async listPublicRooms(): Promise<GridItRoom[]> {
    if (this.usePostgres() && this.isServerless) {
      const { data, error } = await this.supabase!
        .from('gridit_rooms')
        .select('room_data')
        .eq('is_public', true)
        .neq('status', 'finished')
        .gt('expires_at', new Date().toISOString())
        .order('updated_at', { ascending: false })
        .limit(40);
      if (error) {
        this.handleDbError(error, 'listPublicRooms');
      } else {
        return (data || []).map((r: any) => r.room_data as GridItRoom);
      }
    }

    if (this.usePostgres() && !this.isServerless && !this.publicRoomsHydrated) {
      const { data, error } = await this.supabase!
        .from('gridit_rooms')
        .select('id, version, expires_at, room_data, battle_templates')
        .eq('is_public', true)
        .neq('status', 'finished')
        .gt('expires_at', new Date().toISOString())
        .order('updated_at', { ascending: false })
        .limit(40);
      if (error) {
        this.handleDbError(error, 'listPublicRooms.hydrate');
      } else {
        this.publicRoomsHydrated = true;
        for (const row of data || []) {
          const room = this.rowToRoom(row);
          if (!this.memRooms.has(room.id) && !this.roomPersistChain.has(room.id)) {
            this.memRooms.set(room.id, {
              version: Number(row.version || 1),
              expiresAtMs: Date.parse(row.expires_at) || Date.now() + ROOM_TTL_MS,
              data: room,
            });
          }
        }
      }
    }

    this.purgeExpiredInMemory();
    return Array.from(this.memRooms.values())
      .map((r) => r.data)
      .filter((r) => r.settings.isPublic && r.status !== 'finished')
      .map(({ battleTemplates: _b, ...safe }) => safe)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getRoom(idOrCode: string): Promise<StoredGridItRoom | null> {
    const trimmed = idOrCode.trim();
    const upper = trimmed.toUpperCase();

    if (!this.isServerless) {
      const hit = this.findMemRoomEntry(trimmed);
      if (hit) return this.cloneRoom(hit.rec.data);
    }

    if (this.usePostgres()) {
      const col = trimmed.startsWith('gr_room_') ? 'id' : 'code';
      const val = col === 'code' ? upper : trimmed;
      const { data, error } = await this.supabase!
        .from('gridit_rooms')
        .select('id, version, expires_at, room_data, battle_templates')
        .eq(col, val)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error) {
        this.handleDbError(error, 'getRoom');
      } else {
        if (!data) return null;
        const room = this.rowToRoom(data);
        if (!this.isServerless) {
          this.memRooms.set(room.id, {
            version: Number(data.version || 1),
            expiresAtMs: Date.parse(data.expires_at) || Date.now() + ROOM_TTL_MS,
            data: room,
          });
        }
        return this.cloneRoom(room);
      }
    }

    const memHit = this.findMemRoomEntry(trimmed);
    return memHit ? this.cloneRoom(memHit.rec.data) : null;
  }

  async insertRoom(room: StoredGridItRoom): Promise<void> {
    if (this.usePostgres() && this.isServerless) {
      const { battleTemplates, ...publicRoom } = room;
      const nowIso = new Date().toISOString();
      const expIso = new Date(Date.now() + ROOM_TTL_MS).toISOString();
      const { error } = await this.supabase!.from('gridit_rooms').insert({
        id: room.id,
        code: room.code,
        status: room.status,
        is_public: room.settings.isPublic,
        version: 1,
        room_data: publicRoom,
        battle_templates: battleTemplates,
        updated_at: nowIso,
        expires_at: expIso,
      });
      if (error) {
        this.handleDbError(error, 'insertRoom');
      } else {
        return;
      }
    }

    const cloned = this.cloneRoom(room);
    const expiresAtMs = Date.now() + ROOM_TTL_MS;
    this.memRooms.set(room.id, { version: 1, expiresAtMs, data: cloned });

    if (!this.isServerless && this.usePostgres()) {
      const { battleTemplates, ...publicRoom } = cloned;
      const nowIso = new Date().toISOString();
      const expIso = new Date(expiresAtMs).toISOString();
      this.enqueueRoomPersist(room.id, async () => {
        const { error } = await this.supabase!.from('gridit_rooms').upsert(
          {
            id: room.id,
            code: room.code,
            status: room.status,
            is_public: room.settings.isPublic,
            version: 1,
            room_data: publicRoom,
            battle_templates: battleTemplates,
            updated_at: nowIso,
            expires_at: expIso,
          },
          { onConflict: 'id' }
        );
        if (error) this.handleDbError(error, 'insertRoom.async');
      });
    }
  }

  async mutateRoom<T = StoredGridItRoom>(
    idOrCode: string,
    mutator: (room: StoredGridItRoom) => { result: T; deleteRoom?: boolean }
  ): Promise<T | null> {
    const trimmed = idOrCode.trim();
    const upper = trimmed.toUpperCase();

    if (this.usePostgres() && this.isServerless) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const col = trimmed.startsWith('gr_room_') ? 'id' : 'code';
        const val = col === 'code' ? upper : trimmed;
        const { data: row, error } = await this.supabase!
          .from('gridit_rooms')
          .select('id, version, room_data, battle_templates')
          .eq(col, val)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (error) {
          this.handleDbError(error, 'mutateRoom.read');
          break;
        }
        if (!row) return null;

        const room = this.rowToRoom(row);
        const outcome = mutator(room);

        if (outcome.deleteRoom) {
          await this.supabase!.from('gridit_rooms').delete().eq('id', row.id);
          return outcome.result;
        }

        const { battleTemplates, ...publicRoom } = room;
        const { data: updated, error: updErr } = await this.supabase!
          .from('gridit_rooms')
          .update({
            status: room.status,
            is_public: room.settings.isPublic,
            version: Number(row.version) + 1,
            room_data: publicRoom,
            battle_templates: battleTemplates,
            updated_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + ROOM_TTL_MS).toISOString(),
          })
          .eq('id', row.id)
          .eq('version', row.version)
          .select('id');

        if (updErr) {
          this.handleDbError(updErr, 'mutateRoom.write');
          break;
        }
        if (updated && updated.length > 0) {
          return outcome.result;
        }
      }
      if (this.usePostgres()) {
        throw new GridItUnavailableError('Room update contention retry exceeded; please try again.');
      }
    }

    // Persistent server (!isServerless) or local memory fallback:
    // Hydrate from Postgres once on cache miss before atomic synchronous mutation.
    let hit = this.findMemRoomEntry(trimmed);
    if (!hit && !this.isServerless && this.usePostgres()) {
      await this.getRoom(trimmed);
      hit = this.findMemRoomEntry(trimmed);
    }
    if (!hit) return null;

    const copy = this.cloneRoom(hit.rec.data);
    const outcome = mutator(copy);

    if (outcome.deleteRoom) {
      this.memRooms.delete(hit.id);
      if (!this.isServerless && this.usePostgres()) {
        const roomIdToDelete = hit.id;
        this.enqueueRoomPersist(roomIdToDelete, async () => {
          const { error } = await this.supabase!.from('gridit_rooms').delete().eq('id', roomIdToDelete);
          if (error) this.handleDbError(error, 'mutateRoom.deleteAsync');
        });
      }
      return outcome.result;
    }

    const nextVersion = hit.rec.version + 1;
    const nextExpiresAtMs = Date.now() + ROOM_TTL_MS;
    this.memRooms.set(hit.id, { version: nextVersion, expiresAtMs: nextExpiresAtMs, data: copy });

    if (!this.isServerless && this.usePostgres()) {
      const snapshot = this.cloneRoom(copy);
      const { battleTemplates, ...publicRoom } = snapshot;
      const nowIso = new Date().toISOString();
      const expIso = new Date(nextExpiresAtMs).toISOString();
      this.enqueueRoomPersist(snapshot.id, async () => {
        const { error } = await this.supabase!.from('gridit_rooms').upsert(
          {
            id: snapshot.id,
            code: snapshot.code,
            status: snapshot.status,
            is_public: snapshot.settings.isPublic,
            version: nextVersion,
            room_data: publicRoom,
            battle_templates: battleTemplates,
            updated_at: nowIso,
            expires_at: expIso,
          },
          { onConflict: 'id' }
        );
        if (error) this.handleDbError(error, 'mutateRoom.writeAsync');
      });
    }

    return outcome.result;
  }

  async getMatch(matchId: string): Promise<StoredGridItMatch | null> {
    if (!this.isServerless) {
      const rec = this.memMatches.get(matchId);
      if (rec) {
        if (rec.expiresAtMs > Date.now()) {
          return this.cloneMatch(rec.data);
        }
        this.memMatches.delete(matchId);
      }
    }

    if (this.usePostgres()) {
      const { data, error } = await this.supabase!
        .from('gridit_matches')
        .select('id, version, expires_at, match_data')
        .eq('id', matchId)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error) {
        this.handleDbError(error, 'getMatch');
      } else {
        if (!data) return null;
        const match = data.match_data as StoredGridItMatch;
        if (!this.isServerless) {
          this.memMatches.set(matchId, {
            version: Number(data.version || 1),
            expiresAtMs: Date.parse(data.expires_at) || Date.now() + MATCH_TTL_MS,
            data: match,
          });
        }
        return this.cloneMatch(match);
      }
    }

    const rec = this.memMatches.get(matchId);
    return rec ? this.cloneMatch(rec.data) : null;
  }

  async insertMatch(match: StoredGridItMatch): Promise<void> {
    if (this.usePostgres() && this.isServerless) {
      const { error } = await this.supabase!.from('gridit_matches').insert({
        id: match.id,
        room_id: match.roomId,
        status: match.status,
        version: 1,
        match_data: match,
        ends_at: new Date(match.endsAtMs).toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + MATCH_TTL_MS).toISOString(),
      });
      if (error) {
        this.handleDbError(error, 'insertMatch');
      } else {
        return;
      }
    }

    const cloned = this.cloneMatch(match);
    const expiresAtMs = Date.now() + MATCH_TTL_MS;
    this.memMatches.set(match.id, { version: 1, expiresAtMs, data: cloned });

    if (!this.isServerless && this.usePostgres()) {
      const nowIso = new Date().toISOString();
      const expIso = new Date(expiresAtMs).toISOString();
      this.enqueueMatchPersist(match.id, async () => {
        const { error } = await this.supabase!.from('gridit_matches').upsert(
          {
            id: cloned.id,
            room_id: cloned.roomId,
            status: cloned.status,
            version: 1,
            match_data: cloned,
            ends_at: new Date(cloned.endsAtMs).toISOString(),
            updated_at: nowIso,
            expires_at: expIso,
          },
          { onConflict: 'id' }
        );
        if (error) this.handleDbError(error, 'insertMatch.async');
      });
    }
  }

  async mutateMatch<T = StoredGridItMatch>(
    matchId: string,
    mutator: (match: StoredGridItMatch) => T
  ): Promise<{ match: StoredGridItMatch; result: T } | null> {
    if (this.usePostgres() && this.isServerless) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const { data: row, error } = await this.supabase!
          .from('gridit_matches')
          .select('id, version, match_data')
          .eq('id', matchId)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (error) {
          this.handleDbError(error, 'mutateMatch.read');
          break;
        }
        if (!row) return null;

        const match = this.cloneMatch(row.match_data as StoredGridItMatch);
        const result = mutator(match);

        const { data: updated, error: updErr } = await this.supabase!
          .from('gridit_matches')
          .update({
            status: match.status,
            version: Number(row.version) + 1,
            match_data: match,
            ends_at: new Date(match.endsAtMs).toISOString(),
            updated_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + MATCH_TTL_MS).toISOString(),
          })
          .eq('id', matchId)
          .eq('version', row.version)
          .select('id');

        if (updErr) {
          this.handleDbError(updErr, 'mutateMatch.write');
          break;
        }
        if (updated && updated.length > 0) {
          return { match, result };
        }
      }
      if (this.usePostgres()) {
        throw new GridItUnavailableError('Match update contention retry exceeded; retry action.');
      }
    }

    let rec = this.memMatches.get(matchId);
    if (!rec && !this.isServerless && this.usePostgres()) {
      await this.getMatch(matchId);
      rec = this.memMatches.get(matchId);
    }
    if (!rec) return null;

    const copy = this.cloneMatch(rec.data);
    const result = mutator(copy);
    const nextVersion = rec.version + 1;
    const nextExpiresAtMs = Date.now() + MATCH_TTL_MS;
    this.memMatches.set(matchId, { version: nextVersion, expiresAtMs: nextExpiresAtMs, data: copy });

    if (!this.isServerless && this.usePostgres()) {
      const snapshot = this.cloneMatch(copy);
      const nowIso = new Date().toISOString();
      const expIso = new Date(nextExpiresAtMs).toISOString();
      this.enqueueMatchPersist(matchId, async () => {
        const { error } = await this.supabase!.from('gridit_matches').upsert(
          {
            id: snapshot.id,
            room_id: snapshot.roomId,
            status: snapshot.status,
            version: nextVersion,
            match_data: snapshot,
            ends_at: new Date(snapshot.endsAtMs).toISOString(),
            updated_at: nowIso,
            expires_at: expIso,
          },
          { onConflict: 'id' }
        );
        if (error) this.handleDbError(error, 'mutateMatch.writeAsync');
      });
    }

    return { match: copy, result };
  }

  async listExpiredMatches(nowIso: string): Promise<StoredGridItMatch[]> {
    if (this.usePostgres() && this.isServerless) {
      const { data, error } = await this.supabase!
        .from('gridit_matches')
        .select('match_data')
        .neq('status', 'finished')
        .lte('ends_at', nowIso)
        .limit(20);
      if (error) {
        this.handleDbError(error, 'listExpiredMatches');
      } else {
        return (data || []).map((r: any) => r.match_data as StoredGridItMatch);
      }
    }

    // Persistent server: inspect in-memory matches synchronously (0ms, no 4x/sec Postgres polling).
    // Perform a one-time sweep from Postgres on first run to catch orphaned matches across restarts.
    if (this.usePostgres() && !this.isServerless && !this.initialExpiredSweepDone) {
      this.initialExpiredSweepDone = true;
      const { data, error } = await this.supabase!
        .from('gridit_matches')
        .select('id, version, expires_at, match_data')
        .neq('status', 'finished')
        .lte('ends_at', nowIso)
        .limit(20);
      if (!error && data) {
        for (const row of data) {
          const m = row.match_data as StoredGridItMatch;
          if (!this.memMatches.has(m.id)) {
            this.memMatches.set(m.id, {
              version: Number(row.version || 1),
              expiresAtMs: Date.parse(row.expires_at) || Date.now() + MATCH_TTL_MS,
              data: m,
            });
          }
        }
      }
    }

    const nowMs = Date.parse(nowIso);
    this.purgeExpiredInMemory(nowMs);
    return Array.from(this.memMatches.values())
      .map((r) => r.data)
      .filter((m) => m.status !== 'finished' && nowMs >= m.endsAtMs)
      .map((m) => this.cloneMatch(m));
  }

  async dequeuePair(
    queueType: 'quick' | 'ranked',
    playerId: string
  ): Promise<{ matched: boolean; opponentId?: string }> {
    if (this.usePostgres() && this.isServerless) {
      const { data, error } = await this.supabase!.rpc('dequeue_gridit_pair', {
        p_queue_type: queueType,
        p_player_id: playerId,
      });
      if (error) {
        this.handleDbError(error, 'dequeuePair');
      } else {
        const res = data as { matched?: boolean; opponentId?: string } | null;
        return {
          matched: Boolean(res?.matched && res?.opponentId),
          opponentId: res?.opponentId,
        };
      }
    }

    const q = this.memQueues[queueType];
    const oppIdx = q.findIndex((id) => id !== playerId);
    if (oppIdx >= 0) {
      const [opponentId] = q.splice(oppIdx, 1);
      this.memQueues[queueType] = q.filter((id) => id !== playerId);
      return { matched: true, opponentId };
    }
    if (!q.includes(playerId)) q.push(playerId);
    return { matched: false };
  }

  async removeFromQueue(queueType: 'quick' | 'ranked', playerId: string): Promise<void> {
    if (this.usePostgres() && this.isServerless) {
      const { error } = await this.supabase!
        .from('gridit_matchmaking_queue')
        .delete()
        .eq('queue_type', queueType)
        .eq('player_id', playerId);
      if (error) {
        this.handleDbError(error, 'removeFromQueue');
      } else {
        return;
      }
    }
    this.memQueues[queueType] = this.memQueues[queueType].filter((id) => id !== playerId);
  }

  async recordSessionStat(params: {
    playerId: string;
    username: string;
    avatarId: string;
    score: number;
    won: boolean;
    bestWord: string | null;
    isGuest: boolean;
  }): Promise<void> {
    if (this.usePostgres() && this.isServerless) {
      const { error } = await this.supabase!.rpc('upsert_gridit_session_stat', {
        p_player_id: params.playerId,
        p_username: params.username,
        p_avatar_id: params.avatarId,
        p_score: params.score,
        p_won: params.won,
        p_best_word: params.bestWord,
        p_is_guest: params.isGuest,
      });
      if (error) {
        this.handleDbError(error, 'recordSessionStat');
      } else {
        return;
      }
    }

    const prev = this.memStats.get(params.playerId) ?? {
      playerId: params.playerId,
      username: params.username,
      avatarId: params.avatarId,
      matchesPlayed: 0,
      wins: 0,
      highScore: 0,
      bestWord: null,
      isGuest: params.isGuest,
    };
    this.memStats.set(params.playerId, {
      ...prev,
      username: params.username,
      avatarId: params.avatarId,
      matchesPlayed: prev.matchesPlayed + 1,
      wins: prev.wins + (params.won ? 1 : 0),
      highScore: Math.max(prev.highScore, params.score),
      bestWord:
        params.bestWord && (!prev.bestWord || params.bestWord.length >= prev.bestWord.length)
          ? params.bestWord
          : prev.bestWord,
    });

    if (!this.isServerless && this.usePostgres()) {
      void this.supabase!
        .rpc('upsert_gridit_session_stat', {
          p_player_id: params.playerId,
          p_username: params.username,
          p_avatar_id: params.avatarId,
          p_score: params.score,
          p_won: params.won,
          p_best_word: params.bestWord,
          p_is_guest: params.isGuest,
        })
        .then(({ error }) => {
          if (error) {
            console.error('[GridItStateStore] Async stat upsert warning:', error.message);
          }
        });
    }
  }

  async listSessionStats(): Promise<GridItSessionLeaderboardEntry[]> {
    if (this.usePostgres()) {
      const { data, error } = await this.supabase!
        .from('gridit_session_stats')
        .select('player_id, username, avatar_id, matches_played, wins, high_score, best_word, is_guest')
        .order('high_score', { ascending: false })
        .order('wins', { ascending: false })
        .limit(30);
      if (error) {
        this.handleDbError(error, 'listSessionStats');
      } else {
        return (data || []).map((r: any) => ({
          playerId: r.player_id,
          username: r.username,
          avatarId: r.avatar_id,
          matchesPlayed: Number(r.matches_played || 0),
          wins: Number(r.wins || 0),
          highScore: Number(r.high_score || 0),
          bestWord: r.best_word || null,
          isGuest: Boolean(r.is_guest),
        }));
      }
    }

    return Array.from(this.memStats.values()).sort(
      (a, b) => b.highScore - a.highScore || b.wins - a.wins
    );
  }
}
