import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  GuessItCrosswordLayout,
  GuessItDifficulty,
  GuessItMatchStateClient,
  GuessItMode,
  GuessItPuzzleFormat,
  GuessItRoom,
  GuessItRoomSettings,
  GuessItTeamId,
  GuessItWordEntry,
} from '../../../shared/guessit/types.js';

export class GuessItUnavailableError extends Error {
  status = 503;
}

export interface StoredGuessItDuelChallenge {
  playerId: string;
  answer: string;
  category: GuessItRoomSettings['category'];
  difficulty: GuessItDifficulty;
  clue?: string;
}

export interface StoredGuessItRoom extends GuessItRoom {
  duelSubmissions: Record<string, StoredGuessItDuelChallenge>;
  recentAnswers: string[];
}

export interface StoredGuessItUnitState {
  unitId: string;
  teamId: GuessItTeamId | null;
  playerIds: string[];
  teamPlayerOrder: string[];
  activePlayerId: string | null;
  category: GuessItRoomSettings['category'];
  difficulty: GuessItDifficulty;
  format: GuessItPuzzleFormat;
  answer: string;
  clue?: string;
  crosswordLayout: GuessItCrosswordLayout | null;
  guessedLetters: string[];
  correctLetters: string[];
  wrongLetters: string[];
  wrongCount: number;
  maxMistakes: number;
  penaltyUntilMs: number | null;
  solved: boolean;
  failed: boolean;
  completionTimeMs: number | null;
  roundScore: number;
}

export interface StoredGuessItParticipantMeta {
  playerId: string;
  username: string;
  avatarId: string;
  teamId: GuessItTeamId | null;
  score: number;
  roundsWon: number;
  isWinner: boolean;
  isEliminated: boolean;
  totalCorrectGuesses: number;
  totalWrongGuesses: number;
  bestCompletionTimeMs: number | null;
}

export interface StoredGuessItMatch {
  id: string;
  roomId: string | null;
  mode: GuessItMode;
  format: GuessItPuzzleFormat;
  isRanked: boolean;
  status: 'countdown' | 'playing' | 'round_over' | 'finished';
  roundIndex: number;
  totalRounds: number;
  category: GuessItRoomSettings['category'];
  difficulty: GuessItDifficulty;
  roundStartedAtMs: number;
  roundEndsAtMs: number;
  roundOverAtMs: number | null;
  penaltyDurationMs: number;
  settings: GuessItRoomSettings;
  duelSubmissionsSnapshot?: Record<string, StoredGuessItDuelChallenge>;
  participants: Record<string, StoredGuessItParticipantMeta>;
  participantOrder: string[];
  units: Record<string, StoredGuessItUnitState>;
  teamScores: { blue: number; red: number };
  survivorIds: string[];
  winnerIds: string[];
  winningTeamId: GuessItTeamId | null;
  roundSummaries: GuessItMatchStateClient['roundSummaries'];
  messages: GuessItMatchStateClient['messages'];
  usedAnswers: string[];
  stageId?: string | null;
  chapterId?: string | null;
  finalizedStats: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface StoredAdventureStageRow {
  playerId: string;
  stageId: string;
  chapterId: string;
  completed: boolean;
  bestStars: number;
  bestAccuracy: number;
  bestTimeMs: number | null;
  rewardClaimed: boolean;
  claimedAtMs: number | null;
}

const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const MATCH_TTL_MS = 6 * 60 * 60 * 1000;

export class GuessItStateStore {
  private supabase: SupabaseClient | null = null;
  private migrationPending = false;
  private loggedWarning = false;
  private readonly forceLocalMemory: boolean;
  private readonly isServerless: boolean;

  private memRooms = new Map<string, { version: number; expiresAtMs: number; data: StoredGuessItRoom }>();
  private memMatches = new Map<string, { version: number; expiresAtMs: number; data: StoredGuessItMatch }>();
  private memQueues = new Map<string, string[]>();
  private memExtraWords = new Map<string, GuessItWordEntry>();
  private memAdventureProgress = new Map<string, Map<string, StoredAdventureStageRow>>();

  private roomPersistChain = new Map<string, Promise<void>>();
  private matchPersistChain = new Map<string, Promise<void>>();
  private matchOpLocks = new Map<string, Promise<void>>();
  private claimOpLocks = new Map<string, Promise<void>>();
  private publicRoomsHydrated = false;
  private wordsHydrated = false;

  constructor(options: { forceLocalMemory?: boolean; isServerless?: boolean } = {}) {
    this.forceLocalMemory = Boolean(options.forceLocalMemory);
    this.isServerless = options.isServerless ?? Boolean(process.env.VERCEL);

    if (!this.forceLocalMemory) {
      const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
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
          '[GuessItStateStore] Migration 003 not applied yet; continuing cleanly with in-memory store.'
        );
      }
      return;
    }
    console.warn(`[GuessItStateStore] Supabase warning (${context}):`, error?.message || error);
  }

  /** Serializes async operations per matchId to prevent relay/guess/victory race conditions. */
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

  private cloneRoom(room: StoredGuessItRoom): StoredGuessItRoom {
    return JSON.parse(JSON.stringify(room)) as StoredGuessItRoom;
  }

  private cloneMatch(match: StoredGuessItMatch): StoredGuessItMatch {
    return JSON.parse(JSON.stringify(match)) as StoredGuessItMatch;
  }

  private enqueueRoomPersist(roomId: string, task: () => Promise<void>): void {
    if (!this.usePostgres()) return;
    const prev = this.roomPersistChain.get(roomId) ?? Promise.resolve();
    const next = prev
      .then(task)
      .catch((err) => console.warn(`[GuessItStateStore] Room persist warn (${roomId}):`, err))
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
      .catch((err) => console.warn(`[GuessItStateStore] Match persist warn (${matchId}):`, err))
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

  // ==================== EXTRA CATALOG WORDS ====================

  async listApprovedExtraWords(): Promise<GuessItWordEntry[]> {
    if (this.usePostgres() && !this.wordsHydrated) {
      const { data, error } = await this.supabase!
        .from('guessit_words')
        .select('*')
        .eq('validation_status', 'approved')
        .limit(200);
      if (error) {
        this.handleDbError(error, 'listApprovedExtraWords');
      } else {
        this.wordsHydrated = true;
        for (const r of data || []) {
          this.memExtraWords.set(String(r.id), {
            id: String(r.id),
            answer: String(r.answer),
            category: r.category,
            difficulty: r.difficulty,
            language: String(r.language || 'en'),
            wordCount: Number(r.word_count || 1),
            letterCount: Number(r.letter_count || 1),
            clue: r.clue || undefined,
            contentSource: r.content_source || 'ai_validated',
            validationStatus: 'approved',
            rankedEligible: Boolean(r.ranked_eligible),
            adventureEligible: Boolean(r.adventure_eligible),
            chapterId: r.chapter_id || undefined,
          });
        }
      }
    }
    return Array.from(this.memExtraWords.values());
  }

  async saveExtraWord(entry: GuessItWordEntry): Promise<void> {
    this.memExtraWords.set(entry.id, structuredClone(entry));
    if (this.usePostgres()) {
      const { error } = await this.supabase!.from('guessit_words').upsert(
        {
          id: entry.id,
          answer: entry.answer,
          category: entry.category,
          difficulty: entry.difficulty,
          language: entry.language,
          word_count: entry.wordCount,
          letter_count: entry.letterCount,
          clue: entry.clue ?? null,
          content_source: entry.contentSource,
          validation_status: entry.validationStatus,
          ranked_eligible: entry.rankedEligible,
          adventure_eligible: entry.adventureEligible,
          chapter_id: entry.chapterId ?? null,
        },
        { onConflict: 'id' }
      );
      if (error) this.handleDbError(error, 'saveExtraWord');
    }
  }

  // ==================== ROOMS ====================

  async listPublicRooms(): Promise<GuessItRoom[]> {
    if (this.usePostgres() && !this.publicRoomsHydrated) {
      const { data, error } = await this.supabase!
        .from('guessit_rooms')
        .select('id, version, expires_at, room_data, duel_submissions')
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
          const room: StoredGuessItRoom = {
            ...(row.room_data as GuessItRoom),
            duelSubmissions: (row.duel_submissions || {}) as Record<string, StoredGuessItDuelChallenge>,
            recentAnswers: [],
          };
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
      .map((r) => r.data)
      .filter((r) => r.settings.isPublic && r.status === 'lobby')
      .map(({ duelSubmissions: _d, recentAnswers: _ra, ...safe }) => safe)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async getRoom(idOrCode: string): Promise<StoredGuessItRoom | null> {
    const trimmed = idOrCode.trim();
    const upper = trimmed.toUpperCase();
    const memHit = this.findMemRoomEntry(trimmed);
    if (memHit && !this.isServerless) return this.cloneRoom(memHit.rec.data);

    if (this.usePostgres()) {
      const col = trimmed.startsWith('gs_room_') ? 'id' : 'code';
      const val = col === 'code' ? upper : trimmed;
      const { data, error } = await this.supabase!
        .from('guessit_rooms')
        .select('id, version, expires_at, room_data, duel_submissions')
        .eq(col, val)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (error) {
        this.handleDbError(error, 'getRoom');
      } else if (data) {
        const room: StoredGuessItRoom = {
          ...(data.room_data as GuessItRoom),
          duelSubmissions: (data.duel_submissions || {}) as Record<string, StoredGuessItDuelChallenge>,
          recentAnswers: [],
        };
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

  async insertRoom(room: StoredGuessItRoom): Promise<void> {
    const cloned = this.cloneRoom(room);
    const expiresAtMs = Date.now() + ROOM_TTL_MS;
    this.memRooms.set(cloned.id, { version: 1, expiresAtMs, data: cloned });

    if (this.usePostgres()) {
      const { duelSubmissions, recentAnswers: _ra, ...publicRoom } = cloned;
      const task = async () => {
        const { error } = await this.supabase!.from('guessit_rooms').upsert(
          {
            id: cloned.id,
            code: cloned.code,
            status: cloned.status,
            is_public: cloned.settings.isPublic,
            version: 1,
            room_data: publicRoom,
            duel_submissions: duelSubmissions,
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
    mutator: (room: StoredGuessItRoom) => { result: T; deleteRoom?: boolean }
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
          const { error } = await this.supabase!.from('guessit_rooms').delete().eq('id', delId);
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
      const { duelSubmissions, recentAnswers: _ra, ...publicRoom } = snap;
      const task = async () => {
        const { error } = await this.supabase!.from('guessit_rooms').upsert(
          {
            id: snap.id,
            code: snap.code,
            status: snap.status,
            is_public: snap.settings.isPublic,
            version: nextVersion,
            room_data: publicRoom,
            duel_submissions: duelSubmissions,
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

  async getMatch(matchId: string): Promise<StoredGuessItMatch | null> {
    const rec = this.memMatches.get(matchId);
    if (rec && !this.isServerless) {
      if (rec.expiresAtMs > Date.now()) return this.cloneMatch(rec.data);
      this.memMatches.delete(matchId);
    }
    if (this.usePostgres()) {
      const { data, error } = await this.supabase!
        .from('guessit_matches')
        .select('id, version, expires_at, match_data')
        .eq('id', matchId)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (error) {
        this.handleDbError(error, 'getMatch');
      } else if (data) {
        const match = data.match_data as StoredGuessItMatch;
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

  async insertMatch(match: StoredGuessItMatch): Promise<void> {
    const cloned = this.cloneMatch(match);
    const expiresAtMs = Date.now() + MATCH_TTL_MS;
    this.memMatches.set(cloned.id, { version: 1, expiresAtMs, data: cloned });

    if (this.usePostgres()) {
      const task = async () => {
        const { error } = await this.supabase!.from('guessit_matches').upsert(
          {
            id: cloned.id,
            room_id: cloned.roomId,
            mode: cloned.mode,
            format: cloned.format,
            status: cloned.status,
            version: 1,
            match_data: cloned,
            round_ends_at: new Date(cloned.roundEndsAtMs).toISOString(),
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
    mutator: (match: StoredGuessItMatch) => T
  ): Promise<{ match: StoredGuessItMatch; result: T } | null> {
    let rec = this.memMatches.get(matchId);
    if (!rec && this.usePostgres()) {
      await this.getMatch(matchId);
      rec = this.memMatches.get(matchId);
    }
    if (!rec) return null;

    const copy = this.cloneMatch(rec.data);
    const result = mutator(copy);
    const nextVersion = rec.version + 1;
    const nextExp = Date.now() + MATCH_TTL_MS;
    this.memMatches.set(matchId, { version: nextVersion, expiresAtMs: nextExp, data: copy });

    if (this.usePostgres()) {
      const snap = this.cloneMatch(copy);
      const task = async () => {
        const { error } = await this.supabase!.from('guessit_matches').upsert(
          {
            id: snap.id,
            room_id: snap.roomId,
            mode: snap.mode,
            format: snap.format,
            status: snap.status,
            version: nextVersion,
            match_data: snap,
            round_ends_at: new Date(snap.roundEndsAtMs).toISOString(),
            updated_at: new Date().toISOString(),
            expires_at: new Date(nextExp).toISOString(),
          },
          { onConflict: 'id' }
        );
        if (error) this.handleDbError(error, 'mutateMatch');
      };
      if (this.isServerless) await task();
      else this.enqueueMatchPersist(matchId, task);
    }

    return { match: copy, result };
  }

  listMemActiveMatches(): StoredGuessItMatch[] {
    const now = Date.now();
    const out: StoredGuessItMatch[] = [];
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
    playerId: string
  ): Promise<{ matched: boolean; opponentId?: string }> {
    if (this.usePostgres() && this.isServerless) {
      const { data, error } = await this.supabase!.rpc('dequeue_guessit_ranked_pair', {
        p_queue_key: queueKey,
        p_player_id: playerId,
      });
      if (error) {
        this.handleDbError(error, 'dequeueRankedPair');
      } else if (data) {
        return { matched: Boolean(data.matched), opponentId: data.opponentId };
      }
    }

    const q = this.memQueues.get(queueKey) ?? [];
    const opp = q.find((id) => id !== playerId);
    if (opp) {
      this.memQueues.set(
        queueKey,
        q.filter((id) => id !== playerId && id !== opp)
      );
      return { matched: true, opponentId: opp };
    }
    if (!q.includes(playerId)) q.push(playerId);
    this.memQueues.set(queueKey, q);
    return { matched: false };
  }

  async leaveRankedQueue(playerId: string): Promise<void> {
    for (const [k, q] of this.memQueues.entries()) {
      this.memQueues.set(
        k,
        q.filter((id) => id !== playerId)
      );
    }
    if (this.usePostgres()) {
      const { error } = await this.supabase!
        .from('guessit_matchmaking_queue')
        .delete()
        .eq('player_id', playerId);
      if (error) this.handleDbError(error, 'leaveRankedQueue');
    }
  }

  // ==================== ADVENTURE PROGRESSION ====================

  async getAdventureStageRows(playerId: string): Promise<Map<string, StoredAdventureStageRow>> {
    if (this.usePostgres()) {
      const { data, error } = await this.supabase!
        .from('guessit_adventure_progress')
        .select('*')
        .eq('player_id', playerId);
      if (error) {
        this.handleDbError(error, 'getAdventureStageRows');
      } else if (data) {
        const map = this.memAdventureProgress.get(playerId) ?? new Map<string, StoredAdventureStageRow>();
        for (const r of data) {
          map.set(String(r.stage_id), {
            playerId,
            stageId: String(r.stage_id),
            chapterId: String(r.chapter_id),
            completed: Boolean(r.completed),
            bestStars: Number(r.best_stars || 0),
            bestAccuracy: Number(r.best_accuracy || 0),
            bestTimeMs: r.best_time_ms !== null && r.best_time_ms !== undefined ? Number(r.best_time_ms) : null,
            rewardClaimed: Boolean(r.reward_claimed),
            claimedAtMs: r.claimed_at ? Date.parse(r.claimed_at) : null,
          });
        }
        this.memAdventureProgress.set(playerId, map);
      }
    }
    const local = this.memAdventureProgress.get(playerId) ?? new Map<string, StoredAdventureStageRow>();
    const cloned = new Map<string, StoredAdventureStageRow>();
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
    accuracy: number;
    timeMs: number | null;
  }): Promise<{ claimed: boolean; alreadyClaimed: boolean }> {
    return this.withClaimLock(`${params.playerId}:${params.stageId}`, async () => {
      let claimedFromDb: { claimed: boolean; alreadyClaimed: boolean } | null = null;
      if (this.usePostgres()) {
        const { data, error } = await this.supabase!.rpc('claim_guessit_adventure_reward', {
          p_player_id: params.playerId,
          p_stage_id: params.stageId,
          p_chapter_id: params.chapterId,
          p_stars: params.stars,
          p_accuracy: params.accuracy,
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
        this.memAdventureProgress.get(params.playerId) ?? new Map<string, StoredAdventureStageRow>();
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
        bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, params.accuracy),
        bestTimeMs:
          params.timeMs !== null
            ? existing?.bestTimeMs !== null && existing?.bestTimeMs !== undefined
              ? Math.min(existing.bestTimeMs, params.timeMs)
              : params.timeMs
            : existing?.bestTimeMs ?? null,
        rewardClaimed: true,
        claimedAtMs: existing?.claimedAtMs ?? now,
      });

      return claimedFromDb ?? {
        claimed: memNewlyClaimed,
        alreadyClaimed: !memNewlyClaimed,
      };
    });
  }
}
