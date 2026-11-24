import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  TwistItFinishReason,
  TwistItMode,
  TwistItRoomView,
  TwistItSoloStats,
  TwistItWordLength,
} from '../../../shared/twistit/types.js';

export interface StoredTwistItPlayerRecord {
  userId: string;
  displayName: string;
  avatarColor: string;
  foundByIndex: Record<number, number>;
  attemptsCount: number;
  validSubmissionsCount: number;
  completedAtMs: number | null;
  completionDurationMs: number | null;
  connected: boolean;
}

export interface TwistItInternalMatch {
  id: string;
  roomCode: string | null;
  mode: TwistItMode;
  status: 'countdown' | 'playing' | 'finished';
  puzzleId: string;
  baseWord: string;
  scrambledLetters: string[];
  answers: string[];
  lengthCounts: Record<TwistItWordLength, number>;
  createdAtMs: number;
  startsAtMs: number;
  endsAtMs: number | null;
  finishedAtMs: number | null;
  players: Record<string, StoredTwistItPlayerRecord>;
  playerOrder: string[];
  winnerIds: string[];
  isDraw: boolean;
  finishReason: TwistItFinishReason | null;
  finalizedStats: boolean;
  updatedAtMs: number;
}

export interface StoredTwistItRoom extends TwistItRoomView {
  recentPuzzleIds: string[];
}

const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const MATCH_TTL_MS = 6 * 60 * 60 * 1000;

export class TwistItStateStore {
  private supabase: SupabaseClient | null = null;
  private readonly forceLocalMemory: boolean;
  private readonly isServerless: boolean;

  private roomsByCode = new Map<string, StoredTwistItRoom>();
  private matchesById = new Map<string, TwistItInternalMatch>();
  private quickQueue = new Map<string, number>();
  private soloStatsByUser = new Map<string, TwistItSoloStats>();
  private locks = new Map<string, Promise<unknown>>();

  constructor(options: { forceLocalMemory?: boolean; isServerless?: boolean } = {}) {
    this.forceLocalMemory = Boolean(options.forceLocalMemory);
    this.isServerless = Boolean(options.isServerless);

    const url = process.env.SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!this.forceLocalMemory && url && key) {
      this.supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
  }

  private get useCloud(): boolean {
    return Boolean(this.supabase && !this.forceLocalMemory);
  }

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = prev.then(() => gate, () => gate);
    this.locks.set(key, tail);
    try {
      await prev.catch(() => undefined);
      return await fn();
    } finally {
      release();
      if (this.locks.get(key) === tail) {
        this.locks.delete(key);
      }
    }
  }

  async getRoom(code: string): Promise<StoredTwistItRoom | null> {
    const clean = code.trim().toUpperCase();
    if (!clean) return null;
    const local = this.roomsByCode.get(clean);
    if (local && !this.isServerless) return local;
    if (this.useCloud && this.supabase) {
      const { data, error } = await this.supabase
        .from('twistit_rooms')
        .select('room_data')
        .eq('code', clean)
        .maybeSingle();
      if (!error && data?.room_data) {
        const room = data.room_data as StoredTwistItRoom;
        this.roomsByCode.set(clean, room);
        return room;
      }
    }
    return local ?? null;
  }

  async saveRoom(room: StoredTwistItRoom): Promise<void> {
    const clean = room.code.trim().toUpperCase();
    this.roomsByCode.set(clean, room);
    if (this.useCloud && this.supabase) {
      await this.supabase
        .from('twistit_rooms')
        .upsert(
          {
            id: clean,
            code: clean,
            status: room.status,
            is_public: room.settings.isPublic,
            room_data: room,
            updated_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + ROOM_TTL_MS).toISOString(),
          },
          { onConflict: 'code' }
        )
        .then(() => undefined, () => undefined);
    }
  }

  async deleteRoom(code: string): Promise<void> {
    const clean = code.trim().toUpperCase();
    this.roomsByCode.delete(clean);
    if (this.useCloud && this.supabase) {
      await this.supabase
        .from('twistit_rooms')
        .delete()
        .eq('code', clean)
        .then(() => undefined, () => undefined);
    }
  }

  async listPublicRooms(): Promise<StoredTwistItRoom[]> {
    if (this.useCloud && this.supabase) {
      const { data, error } = await this.supabase
        .from('twistit_rooms')
        .select('room_data')
        .eq('is_public', true)
        .eq('status', 'lobby')
        .order('updated_at', { ascending: false })
        .limit(20);
      if (!error && Array.isArray(data)) {
        const rooms = data
          .map((row: any) => row.room_data as StoredTwistItRoom)
          .filter((r) => r && r.players.length > 0);
        for (const r of rooms) this.roomsByCode.set(r.code, r);
        return rooms;
      }
    }
    return [...this.roomsByCode.values()]
      .filter((r) => r.settings.isPublic && r.status === 'lobby' && r.players.length > 0)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  async getMatch(matchId: string): Promise<TwistItInternalMatch | null> {
    const local = this.matchesById.get(matchId);
    if (local && !this.isServerless) return local;
    if (this.useCloud && this.supabase) {
      const { data, error } = await this.supabase
        .from('twistit_matches')
        .select('match_data')
        .eq('id', matchId)
        .maybeSingle();
      if (!error && data?.match_data) {
        const match = data.match_data as TwistItInternalMatch;
        this.matchesById.set(matchId, match);
        return match;
      }
    }
    return local ?? null;
  }

  getCachedMatch(matchId: string): TwistItInternalMatch | null {
    return this.matchesById.get(matchId) ?? null;
  }

  async saveMatch(match: TwistItInternalMatch): Promise<void> {
    this.matchesById.set(match.id, match);
    if (this.useCloud && this.supabase) {
      await this.supabase
        .from('twistit_matches')
        .upsert(
          {
            id: match.id,
            room_code: match.roomCode,
            mode: match.mode,
            status: match.status,
            match_data: match,
            ends_at_ms: match.endsAtMs,
            updated_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + MATCH_TTL_MS).toISOString(),
          },
          { onConflict: 'id' }
        )
        .then(() => undefined, () => undefined);
    }
  }

  listCachedMatches(): TwistItInternalMatch[] {
    return [...this.matchesById.values()];
  }

  async listActiveCloudMatches(): Promise<TwistItInternalMatch[]> {
    if (this.useCloud && this.supabase) {
      const { data, error } = await this.supabase
        .from('twistit_matches')
        .select('match_data')
        .in('status', ['countdown', 'playing'])
        .limit(100);
      if (!error && Array.isArray(data)) {
        const matches = data.map((r: any) => r.match_data as TwistItInternalMatch).filter(Boolean);
        for (const m of matches) this.matchesById.set(m.id, m);
        return matches;
      }
    }
    return [...this.matchesById.values()].filter((m) => m.status !== 'finished');
  }

  async enqueueQuickMatch(playerId: string): Promise<string[] | null> {
    const staleCutoff = Date.now() - 2 * 60 * 1000;
    if (this.useCloud && this.supabase) {
      await this.supabase
        .from('twistit_matchmaking_queue')
        .upsert(
          {
            player_id: playerId,
            joined_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          },
          { onConflict: 'player_id' }
        );
      const { data } = await this.supabase.rpc('dequeue_twistit_quick_pair', {
        p_stale_before: new Date(staleCutoff).toISOString(),
      });
      if (data && data.matched && Array.isArray(data.players) && data.players.length === 2) {
        return data.players.map(String);
      }
      return null;
    }

    for (const [pid, ts] of this.quickQueue.entries()) {
      if (ts < staleCutoff) this.quickQueue.delete(pid);
    }
    this.quickQueue.set(playerId, Date.now());
    const entries = [...this.quickQueue.keys()];
    if (entries.length >= 2) {
      const p1 = entries[0];
      const p2 = entries[1];
      this.quickQueue.delete(p1);
      this.quickQueue.delete(p2);
      return [p1, p2];
    }
    return null;
  }

  async dequeueQuickMatch(playerId: string): Promise<void> {
    this.quickQueue.delete(playerId);
    if (this.useCloud && this.supabase) {
      await this.supabase
        .from('twistit_matchmaking_queue')
        .delete()
        .eq('player_id', playerId)
        .then(() => undefined, () => undefined);
    }
  }

  async getSoloStats(userId: string): Promise<TwistItSoloStats> {
    const local = this.soloStatsByUser.get(userId);
    if (local && !this.isServerless) return local;
    if (this.useCloud && this.supabase) {
      const { data, error } = await this.supabase
        .from('twistit_solo_records')
        .select('completed_count, best_duration_ms, state')
        .eq('user_id', userId)
        .maybeSingle();
      if (!error && data) {
        const state = (data.state || {}) as Partial<TwistItSoloStats>;
        const stats: TwistItSoloStats = {
          completedPuzzlesCount: Number(data.completed_count || 0),
          bestDurationMs: data.best_duration_ms ?? null,
          recentPuzzleIds: Array.isArray(state.recentPuzzleIds) ? state.recentPuzzleIds : [],
          bestByPuzzleId: state.bestByPuzzleId || {},
        };
        this.soloStatsByUser.set(userId, stats);
        return stats;
      }
    }
    return (
      local ?? {
        completedPuzzlesCount: 0,
        bestDurationMs: null,
        recentPuzzleIds: [],
        bestByPuzzleId: {},
      }
    );
  }

  async saveSoloStats(userId: string, stats: TwistItSoloStats): Promise<void> {
    this.soloStatsByUser.set(userId, stats);
    if (this.useCloud && this.supabase) {
      await this.supabase
        .from('twistit_solo_records')
        .upsert(
          {
            user_id: userId,
            completed_count: stats.completedPuzzlesCount,
            best_duration_ms: stats.bestDurationMs,
            state: {
              recentPuzzleIds: stats.recentPuzzleIds,
              bestByPuzzleId: stats.bestByPuzzleId,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .then(() => undefined, () => undefined);
    }
  }
}
