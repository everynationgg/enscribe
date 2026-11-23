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

  // Fallback atomic memory stores for local tests / unconfigured dev
  private memRooms = new Map<string, { version: number; data: StoredGridItRoom }>();
  private memMatches = new Map<string, { version: number; data: StoredGridItMatch }>();
  private memQueues: Record<'quick' | 'ranked', string[]> = { quick: [], ranked: [] };
  private memStats = new Map<string, GridItSessionLeaderboardEntry>();

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

  async listPublicRooms(): Promise<GridItRoom[]> {
    if (this.usePostgres()) {
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

    return Array.from(this.memRooms.values())
      .map((r) => r.data)
      .filter((r) => r.settings.isPublic && r.status !== 'finished')
      .map(({ battleTemplates: _b, ...safe }) => safe)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getRoom(idOrCode: string): Promise<StoredGridItRoom | null> {
    const trimmed = idOrCode.trim();
    const upper = trimmed.toUpperCase();

    if (this.usePostgres()) {
      const col = trimmed.startsWith('gr_room_') ? 'id' : 'code';
      const val = col === 'code' ? upper : trimmed;
      const { data, error } = await this.supabase!
        .from('gridit_rooms')
        .select('room_data, battle_templates')
        .eq(col, val)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error) {
        this.handleDbError(error, 'getRoom');
      } else {
        return data ? this.rowToRoom(data) : null;
      }
    }

    for (const rec of this.memRooms.values()) {
      if (rec.data.id === trimmed || rec.data.code === upper) {
        return this.cloneRoom(rec.data);
      }
    }
    return null;
  }

  async insertRoom(room: StoredGridItRoom): Promise<void> {
    if (this.usePostgres()) {
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

    this.memRooms.set(room.id, { version: 1, data: this.cloneRoom(room) });
  }

  async mutateRoom<T = StoredGridItRoom>(
    idOrCode: string,
    mutator: (room: StoredGridItRoom) => { result: T; deleteRoom?: boolean }
  ): Promise<T | null> {
    const trimmed = idOrCode.trim();
    const upper = trimmed.toUpperCase();

    if (this.usePostgres()) {
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

    for (const [id, rec] of this.memRooms.entries()) {
      if (rec.data.id === trimmed || rec.data.code === upper) {
        const copy = this.cloneRoom(rec.data);
        const outcome = mutator(copy);
        if (outcome.deleteRoom) {
          this.memRooms.delete(id);
        } else {
          this.memRooms.set(id, { version: rec.version + 1, data: copy });
        }
        return outcome.result;
      }
    }
    return null;
  }

  async getMatch(matchId: string): Promise<StoredGridItMatch | null> {
    if (this.usePostgres()) {
      const { data, error } = await this.supabase!
        .from('gridit_matches')
        .select('match_data')
        .eq('id', matchId)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error) {
        this.handleDbError(error, 'getMatch');
      } else {
        return data ? (data.match_data as StoredGridItMatch) : null;
      }
    }

    const rec = this.memMatches.get(matchId);
    return rec ? this.cloneMatch(rec.data) : null;
  }

  async insertMatch(match: StoredGridItMatch): Promise<void> {
    if (this.usePostgres()) {
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

    this.memMatches.set(match.id, { version: 1, data: this.cloneMatch(match) });
  }

  async mutateMatch<T = StoredGridItMatch>(
    matchId: string,
    mutator: (match: StoredGridItMatch) => T
  ): Promise<{ match: StoredGridItMatch; result: T } | null> {
    if (this.usePostgres()) {
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

    const rec = this.memMatches.get(matchId);
    if (!rec) return null;
    const copy = this.cloneMatch(rec.data);
    const result = mutator(copy);
    this.memMatches.set(matchId, { version: rec.version + 1, data: copy });
    return { match: copy, result };
  }

  async listExpiredMatches(nowIso: string): Promise<StoredGridItMatch[]> {
    if (this.usePostgres()) {
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

    const nowMs = Date.parse(nowIso);
    return Array.from(this.memMatches.values())
      .map((r) => r.data)
      .filter((m) => m.status !== 'finished' && nowMs >= m.endsAtMs)
      .map((m) => this.cloneMatch(m));
  }

  async dequeuePair(
    queueType: 'quick' | 'ranked',
    playerId: string
  ): Promise<{ matched: boolean; opponentId?: string }> {
    if (this.usePostgres()) {
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
    if (this.usePostgres()) {
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
    if (this.usePostgres()) {
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
