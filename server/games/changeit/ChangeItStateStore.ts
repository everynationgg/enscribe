import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ChangeItActiveModifier,
  ChangeItDifficulty,
  ChangeItLeaderboardEntry,
  ChangeItMatchChatMessage,
  ChangeItMatchHistoryEntry,
  ChangeItMatchMode,
  ChangeItModifierType,
  ChangeItMoveEntry,
  ChangeItRestriction,
  ChangeItRoom,
  ChangeItTeamId,
  ChangeItWordLength,
} from '../../../shared/changeit/types.js';

export class ChangeItUnavailableError extends Error {
  status = 503;
}

export interface StoredChangeItParticipantMeta {
  playerId: string;
  username: string;
  avatarId: string;
  isGuest: boolean;
  teamId: ChangeItTeamId | null;
}

export interface StoredChangeItBoardState {
  playerId: string;
  startWord: string;
  currentWord: string;
  targetWord: string;
  minMoves: number;
  history: ChangeItMoveEntry[];
  usedWords: string[];
  validMoves: number;
  invalidAttempts: number;
  completed: boolean;
  completedAtMs: number | null;
  forfeited: boolean;
  timedOut: boolean;
  hintsUsed: number;
  activeHintWord: string | null;
  restrictions: ChangeItRestriction;
  lastChangedIndex: number | null;
  heldModifiers: ChangeItModifierType[];
  modifierProgress: number;
  modifierCooldowns: Partial<Record<ChangeItModifierType, number>>;
  activeModifiers: ChangeItActiveModifier[];
  disruptionImmunityUntilMs: number;
  puzzlesCompleted: number;
  survivalScore: number;
  survivalChainIndex: number;
  puzzleStartedAtMs: number;
  playerDeadlineMs: number | null;
}

export interface StoredChangeItRelayTeam {
  teamId: ChangeItTeamId;
  playerIds: string[];
  activeTurnIndex: number;
  activeTurnPlayerId: string | null;
  turnDeadlineMs: number | null;
  startWord: string;
  currentWord: string;
  targetWord: string;
  minMoves: number;
  history: ChangeItMoveEntry[];
  usedWords: string[];
  validMoves: number;
  invalidAttempts: number;
  completed: boolean;
  completedAtMs: number | null;
  lastChangedIndex: number | null;
}

export interface StoredSurvivalStep {
  startWord: string;
  targetWord: string;
  minMoves: number;
  canonicalKey: string;
}

export interface StoredChangeItMatch {
  id: string;
  roomId: string | null;
  mode: ChangeItMatchMode;
  difficulty: ChangeItDifficulty;
  wordLength: ChangeItWordLength;
  isRanked: boolean;
  modifiersEnabled: boolean;
  hintsAllowed: boolean;
  status: 'playing' | 'finished';
  startedAtMs: number;
  endsAtMs: number;
  relayTurnSeconds: number;
  stageId?: string | null;
  chapterId?: string | null;
  stageTitle?: string | null;
  participantOrder: string[];
  participants: Record<string, StoredChangeItParticipantMeta>;
  boards: Record<string, StoredChangeItBoardState>;
  relayTeams?: {
    blue: StoredChangeItRelayTeam;
    red: StoredChangeItRelayTeam;
  } | null;
  survivalChain?: StoredSurvivalStep[];
  winnerIds: string[];
  winningTeamId: ChangeItTeamId | null;
  finishReason: string | null;
  ratingChanges?: Record<string, { before: number; after: number; delta: number; tier: string }>;
  messages: ChangeItMatchChatMessage[];
  processedRequestIds: Record<string, boolean>;
  finalizedResult: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface StoredChangeItAdventureRow {
  playerId: string;
  stageId: string;
  chapterId: string;
  completed: boolean;
  bestStars: number;
  fewestMoves: number | null;
  bestTimeMs: number | null;
  rewardClaimed: boolean;
  claimedAtMs: number | null;
}

export interface StoredChangeItPlayerHistory {
  completedPuzzles: string[];
  recentWords: string[];
}

const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const MATCH_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_HISTORY_PUZZLES = 500;
const MAX_RECENT_WORDS = 40;

export class ChangeItStateStore {
  private supabase: SupabaseClient | null = null;
  private migrationPending = false;
  private loggedWarning = false;
  private readonly forceLocalMemory: boolean;
  private readonly isServerless: boolean;

  private memRooms = new Map<string, { version: number; expiresAtMs: number; data: ChangeItRoom }>();
  private memMatches = new Map<
    string,
    { version: number; expiresAtMs: number; data: StoredChangeItMatch }
  >();
  private memQueues = new Map<string, Array<{ playerId: string; rating: number; joinedAtMs: number }>>();
  private memPlayerStats = new Map<string, ChangeItLeaderboardEntry>();
  private memPlayerHistory = new Map<string, StoredChangeItPlayerHistory>();
  private memAdventureProgress = new Map<string, Map<string, StoredChangeItAdventureRow>>();
  private memFinalizedResults = new Map<string, ChangeItMatchHistoryEntry & { participants: string[] }>();

  private roomPersistChain = new Map<string, Promise<void>>();
  private matchPersistChain = new Map<string, Promise<void>>();
  private matchOpLocks = new Map<string, Promise<void>>();
  private claimOpLocks = new Map<string, Promise<void>>();
  private publicRoomsHydrated = false;

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

  private handleDbError(error: any, context: string): void {
    if (this.isMissingTableOrRpc(error)) {
      this.migrationPending = true;
      if (!this.loggedWarning) {
        this.loggedWarning = true;
        console.warn(
          '[ChangeItStateStore] Migration 005 not applied yet; continuing cleanly with in-memory store.'
        );
      }
      return;
    }
    console.warn(`[ChangeItStateStore] Supabase warning (${context}):`, error?.message || error);
  }

  async withMatchLock<T>(matchId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.matchOpLocks.get(matchId) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.matchOpLocks.set(matchId, next);
    await prev.catch(() => undefined);
    try {
      return await fn();
    } finally {
      release();
      if (this.matchOpLocks.get(matchId) === next) {
        this.matchOpLocks.delete(matchId);
      }
    }
  }

  private async withClaimLock<T>(lockKey: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.claimOpLocks.get(lockKey) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.claimOpLocks.set(lockKey, next);
    await prev.catch(() => undefined);
    try {
      return await fn();
    } finally {
      release();
      if (this.claimOpLocks.get(lockKey) === next) {
        this.claimOpLocks.delete(lockKey);
      }
    }
  }

  private cloneRoom(room: ChangeItRoom): ChangeItRoom {
    return JSON.parse(JSON.stringify(room)) as ChangeItRoom;
  }

  private cloneMatch(match: StoredChangeItMatch): StoredChangeItMatch {
    return JSON.parse(JSON.stringify(match)) as StoredChangeItMatch;
  }

  private enqueueRoomPersist(roomId: string, task: () => Promise<void>): void {
    if (!this.usePostgres()) return;
    const prev = this.roomPersistChain.get(roomId) ?? Promise.resolve();
    const next = prev
      .then(task)
      .catch((err) => console.warn(`[ChangeItStateStore] Room persist warn (${roomId}):`, err))
      .finally(() => {
        if (this.roomPersistChain.get(roomId) === next) this.roomPersistChain.delete(roomId);
      });
    this.roomPersistChain.set(roomId, next);
  }

  private enqueueMatchPersist(matchId: string, task: () => Promise<void>): void {
    if (!this.usePostgres()) return;
    const prev = this.matchPersistChain.get(matchId) ?? Promise.resolve();
    const next = prev
      .then(task)
      .catch((err) => console.warn(`[ChangeItStateStore] Match persist warn (${matchId}):`, err))
      .finally(() => {
        if (this.matchPersistChain.get(matchId) === next) this.matchPersistChain.delete(matchId);
      });
    this.matchPersistChain.set(matchId, next);
  }

  private findMemRoomEntry(idOrCode: string) {
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

  // ==================== ROOMS ====================

  async listPublicRooms(): Promise<ChangeItRoom[]> {
    if (this.usePostgres() && !this.publicRoomsHydrated) {
      const { data, error } = await this.supabase!
        .from('changeit_rooms')
        .select('id, version, expires_at, room_data')
        .eq('is_public', true)
        .neq('status', 'completed')
        .gt('expires_at', new Date().toISOString())
        .order('updated_at', { ascending: false })
        .limit(40);
      if (error) {
        this.handleDbError(error, 'listPublicRooms');
      } else {
        this.publicRoomsHydrated = true;
        for (const row of data || []) {
          const room = row.room_data as ChangeItRoom;
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

    const now = Date.now();
    for (const [id, rec] of this.memRooms.entries()) {
      if (rec.expiresAtMs <= now) this.memRooms.delete(id);
    }
    return Array.from(this.memRooms.values())
      .map((r) => this.cloneRoom(r.data))
      .filter((r) => r.settings.isPublic && r.status === 'lobby')
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async getRoom(idOrCode: string): Promise<ChangeItRoom | null> {
    const trimmed = idOrCode.trim();
    const upper = trimmed.toUpperCase();
    const memHit = this.findMemRoomEntry(trimmed);
    if (memHit && !this.isServerless) return this.cloneRoom(memHit.rec.data);

    if (this.usePostgres()) {
      const col = trimmed.startsWith('ci_room_') ? 'id' : 'code';
      const val = col === 'code' ? upper : trimmed;
      const { data, error } = await this.supabase!
        .from('changeit_rooms')
        .select('id, version, expires_at, room_data')
        .eq(col, val)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (error) {
        this.handleDbError(error, 'getRoom');
      } else if (data) {
        const room = data.room_data as ChangeItRoom;
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

    return memHit ? this.cloneRoom(memHit.rec.data) : null;
  }

  async insertRoom(room: ChangeItRoom): Promise<void> {
    const cloned = this.cloneRoom(room);
    const expiresAtMs = Date.now() + ROOM_TTL_MS;
    this.memRooms.set(cloned.id, { version: 1, expiresAtMs, data: cloned });

    if (this.usePostgres()) {
      const task = async () => {
        const { error } = await this.supabase!.from('changeit_rooms').upsert(
          {
            id: cloned.id,
            code: cloned.code,
            status: cloned.status,
            is_public: cloned.settings.isPublic,
            version: 1,
            room_data: cloned,
            custom_puzzle: cloned.customPuzzle ?? null,
            updated_at: new Date().toISOString(),
            expires_at: new Date(expiresAtMs).toISOString(),
          },
          { onConflict: 'id' }
        );
        if (error) this.handleDbError(error, 'insertRoom');
      };
      if (this.isServerless) await task();
      else this.enqueueRoomPersist(cloned.id, task);
    }
  }

  async mutateRoom<T>(
    idOrCode: string,
    mutator: (room: ChangeItRoom) => { result: T; deleteRoom?: boolean }
  ): Promise<T | null> {
    let hit = this.findMemRoomEntry(idOrCode);
    if (!hit && this.usePostgres()) {
      await this.getRoom(idOrCode);
      hit = this.findMemRoomEntry(idOrCode);
    }
    if (!hit) return null;

    const copy = this.cloneRoom(hit.rec.data);
    const outcome = mutator(copy);
    if (outcome.deleteRoom) {
      this.memRooms.delete(hit.id);
      if (this.usePostgres()) {
        const delId = hit.id;
        this.enqueueRoomPersist(delId, async () => {
          const { error } = await this.supabase!.from('changeit_rooms').delete().eq('id', delId);
          if (error) this.handleDbError(error, 'mutateRoom.delete');
        });
      }
      return outcome.result;
    }

    const nextVersion = hit.rec.version + 1;
    const nextExp = Date.now() + ROOM_TTL_MS;
    this.memRooms.set(hit.id, { version: nextVersion, expiresAtMs: nextExp, data: copy });

    if (this.usePostgres()) {
      const snap = this.cloneRoom(copy);
      const task = async () => {
        const { error } = await this.supabase!.from('changeit_rooms').upsert(
          {
            id: snap.id,
            code: snap.code,
            status: snap.status,
            is_public: snap.settings.isPublic,
            version: nextVersion,
            room_data: snap,
            custom_puzzle: snap.customPuzzle ?? null,
            updated_at: new Date().toISOString(),
            expires_at: new Date(nextExp).toISOString(),
          },
          { onConflict: 'id' }
        );
        if (error) this.handleDbError(error, 'mutateRoom.write');
      };
      if (this.isServerless) await task();
      else this.enqueueRoomPersist(snap.id, task);
    }

    return outcome.result;
  }

  // ==================== MATCHES ====================

  async getMatch(matchId: string): Promise<StoredChangeItMatch | null> {
    const rec = this.memMatches.get(matchId);
    if (rec && !this.isServerless) {
      if (rec.expiresAtMs > Date.now()) return this.cloneMatch(rec.data);
      this.memMatches.delete(matchId);
    }
    if (this.usePostgres()) {
      const { data, error } = await this.supabase!
        .from('changeit_matches')
        .select('id, version, expires_at, match_data')
        .eq('id', matchId)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (error) {
        this.handleDbError(error, 'getMatch');
      } else if (data) {
        const match = data.match_data as StoredChangeItMatch;
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
    return rec ? this.cloneMatch(rec.data) : null;
  }

  async insertMatch(match: StoredChangeItMatch): Promise<void> {
    const cloned = this.cloneMatch(match);
    const expiresAtMs = Date.now() + MATCH_TTL_MS;
    this.memMatches.set(cloned.id, { version: 1, expiresAtMs, data: cloned });

    if (this.usePostgres()) {
      const task = async () => {
        const { error } = await this.supabase!.from('changeit_matches').upsert(
          {
            id: cloned.id,
            room_id: cloned.roomId,
            mode: cloned.mode,
            is_ranked: cloned.isRanked,
            status: cloned.status,
            version: 1,
            match_data: cloned,
            ends_at: new Date(cloned.endsAtMs).toISOString(),
            updated_at: new Date().toISOString(),
            expires_at: new Date(expiresAtMs).toISOString(),
          },
          { onConflict: 'id' }
        );
        if (error) this.handleDbError(error, 'insertMatch');
      };
      if (this.isServerless) await task();
      else this.enqueueMatchPersist(cloned.id, task);
    }
  }

  async mutateMatch<T>(
    matchId: string,
    mutator: (match: StoredChangeItMatch) => T
  ): Promise<{ match: StoredChangeItMatch; result: T } | null> {
    let rec = this.memMatches.get(matchId);
    if (!rec && this.usePostgres()) {
      await this.getMatch(matchId);
      rec = this.memMatches.get(matchId);
    }
    if (!rec) return null;

    const expectedVersion = rec.version;
    const copy = this.cloneMatch(rec.data);
    const result = mutator(copy);
    const nextVersion = expectedVersion + 1;
    const nextExp = Date.now() + MATCH_TTL_MS;
    this.memMatches.set(matchId, { version: nextVersion, expiresAtMs: nextExp, data: copy });

    if (this.usePostgres()) {
      const snap = this.cloneMatch(copy);
      const task = async () => {
        const { data, error } = await this.supabase!.rpc('mutate_changeit_match_cas', {
          p_match_id: snap.id,
          p_expected_version: expectedVersion,
          p_status: snap.status,
          p_match_data: snap,
          p_ends_at: new Date(snap.endsAtMs).toISOString(),
        });
        if (error) {
          this.handleDbError(error, 'mutateMatch.cas');
        } else if (!data || (Array.isArray(data) && data.length === 0)) {
          await this.supabase!.from('changeit_matches').upsert(
            {
              id: snap.id,
              room_id: snap.roomId,
              mode: snap.mode,
              is_ranked: snap.isRanked,
              status: snap.status,
              version: nextVersion,
              match_data: snap,
              ends_at: new Date(snap.endsAtMs).toISOString(),
              updated_at: new Date().toISOString(),
              expires_at: new Date(nextExp).toISOString(),
            },
            { onConflict: 'id' }
          );
        }
      };
      if (this.isServerless) await task();
      else this.enqueueMatchPersist(matchId, task);
    }

    return { match: copy, result };
  }

  listMemActiveMatches(): StoredChangeItMatch[] {
    const now = Date.now();
    const out: StoredChangeItMatch[] = [];
    for (const [id, rec] of this.memMatches.entries()) {
      if (rec.expiresAtMs <= now) {
        this.memMatches.delete(id);
        continue;
      }
      if (rec.data.status !== 'finished') {
        out.push(this.cloneMatch(rec.data));
      }
    }
    return out;
  }

  // ==================== RANKED QUEUE ====================

  async dequeueRankedPair(
    queueKey: string,
    playerId: string,
    rating: number
  ): Promise<{ matched: boolean; opponentId?: string; opponentRating?: number }> {
    if (this.usePostgres() && this.isServerless) {
      const { data, error } = await this.supabase!.rpc('dequeue_changeit_ranked_pair', {
        p_queue_key: queueKey,
        p_player_id: playerId,
        p_rating: rating,
      });
      if (error) {
        this.handleDbError(error, 'dequeueRankedPair');
      } else if (data) {
        return {
          matched: Boolean(data.matched),
          opponentId: data.opponentId,
          opponentRating: data.opponentRating,
        };
      }
    }

    const now = Date.now();
    const existingQ = (this.memQueues.get(queueKey) ?? []).filter(
      (entry) => now - entry.joinedAtMs < 10 * 60 * 1000
    );
    const candidates = existingQ
      .filter((entry) => entry.playerId !== playerId)
      .sort(
        (a, b) =>
          Math.abs(a.rating - rating) - Math.abs(b.rating - rating) ||
          a.joinedAtMs - b.joinedAtMs
      );

    if (candidates.length > 0) {
      const opp = candidates[0];
      this.memQueues.set(
        queueKey,
        existingQ.filter((e) => e.playerId !== playerId && e.playerId !== opp.playerId)
      );
      return { matched: true, opponentId: opp.playerId, opponentRating: opp.rating };
    }

    const updated = existingQ.filter((e) => e.playerId !== playerId);
    updated.push({ playerId, rating, joinedAtMs: now });
    this.memQueues.set(queueKey, updated);
    return { matched: false };
  }

  async leaveRankedQueue(playerId: string): Promise<void> {
    for (const [k, q] of this.memQueues.entries()) {
      this.memQueues.set(
        k,
        q.filter((e) => e.playerId !== playerId)
      );
    }
    if (this.usePostgres()) {
      const { error } = await this.supabase!
        .from('changeit_matchmaking_queue')
        .delete()
        .eq('player_id', playerId);
      if (error) this.handleDbError(error, 'leaveRankedQueue');
    }
  }

  // ==================== ANTI-REPETITION PLAYER HISTORY ====================

  async getPlayerHistory(playerId: string): Promise<StoredChangeItPlayerHistory> {
    const cached = this.memPlayerHistory.get(playerId);
    if (cached && !this.isServerless) {
      return {
        completedPuzzles: [...cached.completedPuzzles],
        recentWords: [...cached.recentWords],
      };
    }

    if (this.usePostgres()) {
      const { data, error } = await this.supabase!
        .from('changeit_player_history')
        .select('completed_puzzles, recent_words')
        .eq('player_id', playerId)
        .maybeSingle();
      if (error) {
        this.handleDbError(error, 'getPlayerHistory');
      } else if (data) {
        const hist: StoredChangeItPlayerHistory = {
          completedPuzzles: Array.isArray(data.completed_puzzles)
            ? data.completed_puzzles.map(String)
            : [],
          recentWords: Array.isArray(data.recent_words) ? data.recent_words.map(String) : [],
        };
        this.memPlayerHistory.set(playerId, hist);
        return {
          completedPuzzles: [...hist.completedPuzzles],
          recentWords: [...hist.recentWords],
        };
      }
    }

    return cached
      ? {
          completedPuzzles: [...cached.completedPuzzles],
          recentWords: [...cached.recentWords],
        }
      : { completedPuzzles: [], recentWords: [] };
  }

  async recordPuzzleHistory(
    playerId: string,
    canonicalKey: string,
    wordsEncountered: string[]
  ): Promise<void> {
    const current = await this.getPlayerHistory(playerId);
    const puzzleSet = new Set(current.completedPuzzles);
    puzzleSet.delete(canonicalKey);
    const nextPuzzles = [...puzzleSet, canonicalKey].slice(-MAX_HISTORY_PUZZLES);

    const recentFiltered = current.recentWords.filter((w) => !wordsEncountered.includes(w));
    const nextRecent = [...recentFiltered, ...wordsEncountered].slice(-MAX_RECENT_WORDS);

    this.memPlayerHistory.set(playerId, {
      completedPuzzles: nextPuzzles,
      recentWords: nextRecent,
    });

    if (this.usePostgres()) {
      const { error } = await this.supabase!.from('changeit_player_history').upsert(
        {
          player_id: playerId,
          completed_puzzles: nextPuzzles,
          recent_words: nextRecent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'player_id' }
      );
      if (error) this.handleDbError(error, 'recordPuzzleHistory');
    }
  }

  // ==================== PLAYER STATS, LEADERBOARD & RESULTS ====================

  async getPlayerStats(playerId: string): Promise<ChangeItLeaderboardEntry | null> {
    const mem = this.memPlayerStats.get(playerId);
    if (mem && !this.isServerless) return { ...mem };

    if (this.usePostgres()) {
      const { data, error } = await this.supabase!
        .from('changeit_player_stats')
        .select('*')
        .eq('player_id', playerId)
        .maybeSingle();
      if (error) {
        this.handleDbError(error, 'getPlayerStats');
      } else if (data) {
        const entry: ChangeItLeaderboardEntry = {
          playerId: String(data.player_id),
          username: String(data.username),
          avatarId: String(data.avatar_id || 'alex'),
          isGuest: Boolean(data.is_guest),
          rating: Number(data.rating || 1000),
          rankTier: String(data.rank_tier || 'Silver II'),
          rankedWins: Number(data.ranked_wins || 0),
          rankedLosses: Number(data.ranked_losses || 0),
          rankedDraws: Number(data.ranked_draws || 0),
          matchesPlayed: Number(data.matches_played || 0),
          totalWins: Number(data.total_wins || 0),
          puzzlesSolved: Number(data.puzzles_solved || 0),
          bestEfficiency: Number(data.best_efficiency || 0),
          fastestSolveMs:
            data.fastest_solve_ms !== null && data.fastest_solve_ms !== undefined
              ? Number(data.fastest_solve_ms)
              : null,
        };
        this.memPlayerStats.set(playerId, entry);
        return { ...entry };
      }
    }
    return mem ? { ...mem } : null;
  }

  async finalizeMatchResultAtomic(params: {
    matchId: string;
    mode: ChangeItMatchMode;
    isRanked: boolean;
    winnerIds: string[];
    participants: Array<{
      playerId: string;
      username: string;
      avatarId: string;
      isGuest: boolean;
      newRating: number;
      rankTier: string;
      won: boolean;
      draw: boolean;
      puzzlesSolved: number;
      efficiencyPercent: number;
      solveTimeMs: number | null;
      validMoves?: number;
      minMoves?: number;
    }>;
  }): Promise<{ finalized: boolean; alreadyFinalized: boolean }> {
    return this.withClaimLock(`finalize:${params.matchId}`, async () => {
      let dbResult: { finalized: boolean; alreadyFinalized: boolean } | null = null;
      if (this.usePostgres()) {
        const { data, error } = await this.supabase!.rpc('finalize_changeit_match_result', {
          p_match_id: params.matchId,
          p_mode: params.mode,
          p_is_ranked: params.isRanked,
          p_winner_ids: params.winnerIds,
          p_participants: params.participants,
        });
        if (error) {
          this.handleDbError(error, 'finalizeMatchResultAtomic');
        } else if (data) {
          dbResult = {
            finalized: Boolean(data.finalized),
            alreadyFinalized: Boolean(data.alreadyFinalized),
          };
        }
      }

      const memAlready = this.memFinalizedResults.has(params.matchId);
      if (!memAlready) {
        const winnerSet = new Set(params.winnerIds);
        this.memFinalizedResults.set(params.matchId, {
          matchId: params.matchId,
          mode: params.mode,
          isRanked: params.isRanked,
          winnerIds: [...params.winnerIds],
          didWin: false,
          opponentNames: params.participants.map((p) => p.username),
          participants: params.participants.map((p) => p.playerId),
          createdAt: Date.now(),
        });

        for (const p of params.participants) {
          const prev = this.memPlayerStats.get(p.playerId);
          const next: ChangeItLeaderboardEntry = {
            playerId: p.playerId,
            username: p.username,
            avatarId: p.avatarId,
            isGuest: p.isGuest,
            rating: params.isRanked ? p.newRating : (prev?.rating ?? 1000),
            rankTier: params.isRanked ? p.rankTier : (prev?.rankTier ?? 'Silver II'),
            rankedWins: (prev?.rankedWins ?? 0) + (params.isRanked && p.won ? 1 : 0),
            rankedLosses:
              (prev?.rankedLosses ?? 0) + (params.isRanked && !p.won && !p.draw ? 1 : 0),
            rankedDraws: (prev?.rankedDraws ?? 0) + (params.isRanked && p.draw ? 1 : 0),
            matchesPlayed: (prev?.matchesPlayed ?? 0) + 1,
            totalWins: (prev?.totalWins ?? 0) + (winnerSet.has(p.playerId) ? 1 : 0),
            puzzlesSolved: (prev?.puzzlesSolved ?? 0) + p.puzzlesSolved,
            bestEfficiency: Math.max(prev?.bestEfficiency ?? 0, p.efficiencyPercent),
            fastestSolveMs:
              p.solveTimeMs !== null
                ? prev?.fastestSolveMs !== null && prev?.fastestSolveMs !== undefined
                  ? Math.min(prev.fastestSolveMs, p.solveTimeMs)
                  : p.solveTimeMs
                : (prev?.fastestSolveMs ?? null),
          };
          this.memPlayerStats.set(p.playerId, next);
        }
      }

      return dbResult ?? { finalized: !memAlready, alreadyFinalized: memAlready };
    });
  }

  async listLeaderboardStats(): Promise<ChangeItLeaderboardEntry[]> {
    if (this.usePostgres()) {
      const { data, error } = await this.supabase!
        .from('changeit_player_stats')
        .select('*')
        .order('rating', { ascending: false })
        .order('ranked_wins', { ascending: false })
        .limit(50);
      if (error) {
        this.handleDbError(error, 'listLeaderboardStats');
      } else if (data) {
        for (const r of data) {
          this.memPlayerStats.set(String(r.player_id), {
            playerId: String(r.player_id),
            username: String(r.username),
            avatarId: String(r.avatar_id || 'alex'),
            isGuest: Boolean(r.is_guest),
            rating: Number(r.rating || 1000),
            rankTier: String(r.rank_tier || 'Silver II'),
            rankedWins: Number(r.ranked_wins || 0),
            rankedLosses: Number(r.ranked_losses || 0),
            rankedDraws: Number(r.ranked_draws || 0),
            matchesPlayed: Number(r.matches_played || 0),
            totalWins: Number(r.total_wins || 0),
            puzzlesSolved: Number(r.puzzles_solved || 0),
            bestEfficiency: Number(r.best_efficiency || 0),
            fastestSolveMs:
              r.fastest_solve_ms !== null && r.fastest_solve_ms !== undefined
                ? Number(r.fastest_solve_ms)
                : null,
          });
        }
      }
    }

    return Array.from(this.memPlayerStats.values())
      .map((e) => ({ ...e }))
      .sort((a, b) => b.rating - a.rating || b.rankedWins - a.rankedWins || b.totalWins - a.totalWins);
  }

  async listRecentHistoryForPlayer(playerId: string): Promise<ChangeItMatchHistoryEntry[]> {
    if (this.usePostgres()) {
      const { data, error } = await this.supabase!
        .from('changeit_match_results')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40);
      if (error) {
        this.handleDbError(error, 'listRecentHistoryForPlayer');
      } else if (data) {
        const out: ChangeItMatchHistoryEntry[] = [];
        for (const r of data) {
          const parts = Array.isArray(r.participants) ? (r.participants as any[]) : [];
          const self = parts.find((p) => p.playerId === playerId);
          if (!self) continue;
          const winnerIds = Array.isArray(r.winner_ids) ? r.winner_ids.map(String) : [];
          out.push({
            matchId: String(r.match_id),
            mode: r.mode as ChangeItMatchMode,
            isRanked: Boolean(r.is_ranked),
            winnerIds,
            didWin: winnerIds.includes(playerId),
            opponentNames: parts
              .filter((p) => p.playerId !== playerId)
              .map((p) => String(p.username || p.playerId)),
            validMoves: self.validMoves,
            minMoves: self.minMoves,
            createdAt: Date.parse(r.created_at) || Date.now(),
          });
        }
        return out.slice(0, 15);
      }
    }

    return Array.from(this.memFinalizedResults.values())
      .filter((r) => r.participants.includes(playerId))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 15)
      .map((r) => ({
        matchId: r.matchId,
        mode: r.mode,
        isRanked: r.isRanked,
        winnerIds: r.winnerIds,
        didWin: r.winnerIds.includes(playerId),
        opponentNames: r.opponentNames,
        createdAt: r.createdAt,
      }));
  }

  // ==================== SOLO ADVENTURE PROGRESSION ====================

  async getAdventureStageRows(
    playerId: string
  ): Promise<Map<string, StoredChangeItAdventureRow>> {
    if (this.usePostgres()) {
      const { data, error } = await this.supabase!
        .from('changeit_adventure_progress')
        .select('*')
        .eq('player_id', playerId);
      if (error) {
        this.handleDbError(error, 'getAdventureStageRows');
      } else if (data) {
        const map =
          this.memAdventureProgress.get(playerId) ?? new Map<string, StoredChangeItAdventureRow>();
        for (const r of data) {
          map.set(String(r.stage_id), {
            playerId,
            stageId: String(r.stage_id),
            chapterId: String(r.chapter_id),
            completed: Boolean(r.completed),
            bestStars: Number(r.best_stars || 0),
            fewestMoves:
              r.fewest_moves !== null && r.fewest_moves !== undefined
                ? Number(r.fewest_moves)
                : null,
            bestTimeMs:
              r.best_time_ms !== null && r.best_time_ms !== undefined
                ? Number(r.best_time_ms)
                : null,
            rewardClaimed: Boolean(r.reward_claimed),
            claimedAtMs: r.claimed_at ? Date.parse(r.claimed_at) : null,
          });
        }
        this.memAdventureProgress.set(playerId, map);
      }
    }

    const local =
      this.memAdventureProgress.get(playerId) ?? new Map<string, StoredChangeItAdventureRow>();
    const cloned = new Map<string, StoredChangeItAdventureRow>();
    for (const [k, v] of local.entries()) {
      cloned.set(k, { ...v });
    }
    return cloned;
  }

  async claimAdventureRewardAtomic(params: {
    playerId: string;
    stageId: string;
    chapterId: string;
    stars: number;
    moves: number;
    timeMs: number | null;
  }): Promise<{ claimed: boolean; alreadyClaimed: boolean }> {
    return this.withClaimLock(`adv:${params.playerId}:${params.stageId}`, async () => {
      let claimedFromDb: { claimed: boolean; alreadyClaimed: boolean } | null = null;
      if (this.usePostgres()) {
        const { data, error } = await this.supabase!.rpc('claim_changeit_adventure_reward', {
          p_player_id: params.playerId,
          p_stage_id: params.stageId,
          p_chapter_id: params.chapterId,
          p_stars: params.stars,
          p_moves: params.moves,
          p_time_ms: params.timeMs,
        });
        if (error) {
          this.handleDbError(error, 'claimAdventureRewardAtomic');
        } else if (data) {
          claimedFromDb = {
            claimed: Boolean(data.claimed),
            alreadyClaimed: Boolean(data.alreadyClaimed),
          };
        }
      }

      const playerMap =
        this.memAdventureProgress.get(params.playerId) ??
        new Map<string, StoredChangeItAdventureRow>();
      this.memAdventureProgress.set(params.playerId, playerMap);

      const existing = playerMap.get(params.stageId);
      const memNewlyClaimed = !existing || !existing.rewardClaimed;
      const now = Date.now();
      playerMap.set(params.stageId, {
        playerId: params.playerId,
        stageId: params.stageId,
        chapterId: params.chapterId,
        completed: true,
        bestStars: Math.max(existing?.bestStars ?? 0, params.stars),
        fewestMoves:
          existing?.fewestMoves !== null && existing?.fewestMoves !== undefined
            ? Math.min(existing.fewestMoves, params.moves)
            : params.moves,
        bestTimeMs:
          params.timeMs !== null
            ? existing?.bestTimeMs !== null && existing?.bestTimeMs !== undefined
              ? Math.min(existing.bestTimeMs, params.timeMs)
              : params.timeMs
            : (existing?.bestTimeMs ?? null),
        rewardClaimed: true,
        claimedAtMs: existing?.claimedAtMs ?? now,
      });

      return (
        claimedFromDb ?? {
          claimed: memNewlyClaimed,
          alreadyClaimed: !memNewlyClaimed,
        }
      );
    });
  }
}
