import crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GuestSession, Profile } from '../../shared/types.js';

export const DEFAULT_GUEST_TTL_SECONDS = 90;

export class GuestNicknameConflictError extends Error {
  readonly statusCode = 409;
  constructor(message = 'That nickname is currently in use by an active online player.') {
    super(message);
    this.name = 'GuestNicknameConflictError';
  }
}

export class GuestValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'GuestValidationError';
  }
}

export class GuestSessionExpiredError extends Error {
  readonly statusCode = 401;
  constructor(message = 'Guest session expired or invalid.') {
    super(message);
    this.name = 'GuestSessionExpiredError';
  }
}

export class GuestStoreUnavailableError extends Error {
  readonly statusCode = 503;
  constructor(message: string) {
    super(message);
    this.name = 'GuestStoreUnavailableError';
  }
}

export type GuestStoreBackendMode = 'supabase_postgres' | 'local_atomic_memory';

interface LocalGuestRecord {
  sessionId: string;
  sessionToken: string;
  nickname: string;
  nicknameNormalized: string;
  avatarId: string;
  expiresAtMs: number;
}

interface RpcResult {
  ok: boolean;
  error?: string;
  session?: GuestSession;
}

export function sanitizeGuestNickname(raw: string): string {
  return String(raw || '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 20);
}

const TOKEN_CACHE_TTL_MS = 20_000;
const TOKEN_CACHE_MAX_SIZE = 500;

export class GuestSessionStore {
  private supabase: SupabaseClient | null = null;
  private localByToken = new Map<string, LocalGuestRecord>();
  private localByNorm = new Map<string, string>(); // nicknameNormalized -> sessionToken
  private localById = new Map<string, string>(); // sessionId -> sessionToken
  private tokenCache = new Map<string, { session: GuestSession; cachedUntilMs: number }>();
  private localLock: Promise<void> = Promise.resolve();
  private postgresMigrationPending = false;
  private loggedMigrationWarning = false;
  private readonly forceLocalMemory: boolean;
  private readonly isServerless: boolean;

  constructor(options: { forceLocalMemory?: boolean; isServerless?: boolean } = {}) {
    this.forceLocalMemory = Boolean(options.forceLocalMemory);
    this.isServerless = options.isServerless ?? Boolean(process.env.VERCEL);

    if (!this.forceLocalMemory) {
      const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      if (url && serviceKey) {
        this.supabase = createClient(url, serviceKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
      }
    }
  }

  getBackendMode(): GuestStoreBackendMode {
    if (this.supabase && !this.postgresMigrationPending) {
      return 'supabase_postgres';
    }
    return 'local_atomic_memory';
  }

  isPostgresMigrationPending(): boolean {
    return this.postgresMigrationPending;
  }

  toGuestProfile(session: GuestSession): Profile {
    return {
      id: session.sessionId,
      username: session.nickname,
      avatarId: session.avatarId || 'alex',
      rankTier: 'Guest',
      rankPoints: 0,
      wins: 0,
      losses: 0,
      matchPointsBalance: 0,
      equippedCosmetics: {
        tileSkin: 'classic_cream',
        boardSkin: 'royal_cosmos',
        backgroundTheme: 'deep_blue',
        chatBubbleStyle: 'frost_pill',
      },
      createdAt: Date.now(),
      isGuest: true,
    };
  }

  private withLocalAtomicLock<T>(fn: () => T): Promise<T> {
    const next = this.localLock.then(() => fn());
    this.localLock = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  private purgeExpiredLocal(now = Date.now()): void {
    for (const [token, rec] of this.localByToken.entries()) {
      if (rec.expiresAtMs <= now) {
        this.localByToken.delete(token);
        if (this.localByNorm.get(rec.nicknameNormalized) === token) {
          this.localByNorm.delete(rec.nicknameNormalized);
        }
        if (this.localById.get(rec.sessionId) === token) {
          this.localById.delete(rec.sessionId);
        }
      }
    }
  }

  private toPublicSession(rec: LocalGuestRecord): GuestSession {
    return {
      sessionId: rec.sessionId,
      sessionToken: rec.sessionToken,
      nickname: rec.nickname,
      avatarId: rec.avatarId,
      expiresAtMs: rec.expiresAtMs,
    };
  }

  private isMissingRpcError(error: any): boolean {
    const code = String(error?.code || '');
    const msg = String(error?.message || '').toLowerCase();
    return (
      code === 'PGRST202' ||
      code === '42883' ||
      code === '42P01' ||
      msg.includes('could not find the function') ||
      msg.includes('does not exist')
    );
  }

  private handleMissingPostgresMigration(): void {
    this.postgresMigrationPending = true;
    if (this.isServerless) {
      throw new GuestStoreUnavailableError(
        'Guest session PostgreSQL RPCs are missing. Run supabase/migrations/001_guest_sessions.sql in Supabase SQL Editor.'
      );
    }
    if (!this.loggedMigrationWarning) {
      this.loggedMigrationWarning = true;
      console.warn(
        '[GuestSessionStore] Supabase RPCs (supabase/migrations/001_guest_sessions.sql) not found yet. Using atomic local memory store for local development.'
      );
    }
  }

  private cacheVerifiedSession(session: GuestSession, now = Date.now()): void {
    if (!session.sessionToken || session.expiresAtMs <= now) return;
    if (this.tokenCache.size >= TOKEN_CACHE_MAX_SIZE && !this.tokenCache.has(session.sessionToken)) {
      const oldestKey = this.tokenCache.keys().next().value;
      if (oldestKey) this.tokenCache.delete(oldestKey);
    }
    this.tokenCache.set(session.sessionToken, {
      session,
      cachedUntilMs: Math.min(now + TOKEN_CACHE_TTL_MS, session.expiresAtMs),
    });
  }

  private getCachedSession(token: string, now = Date.now()): GuestSession | null {
    const hit = this.tokenCache.get(token);
    if (!hit) return null;
    if (hit.cachedUntilMs <= now || hit.session.expiresAtMs <= now) {
      this.tokenCache.delete(token);
      return null;
    }
    return hit.session;
  }

  async claimNickname(
    rawNickname: string,
    avatarId = 'alex',
    existingToken?: string | null,
    ttlSeconds = DEFAULT_GUEST_TTL_SECONDS
  ): Promise<GuestSession> {
    const clean = sanitizeGuestNickname(rawNickname);
    if (clean.length < 2) {
      throw new GuestValidationError('Enter a nickname with at least 2 characters.');
    }
    const cleanAvatar = String(avatarId || 'alex').trim() || 'alex';
    const clampedTtl = Math.max(1, Math.min(600, Math.floor(ttlSeconds || DEFAULT_GUEST_TTL_SECONDS)));

    if (existingToken) {
      this.tokenCache.delete(existingToken);
    }

    if (this.supabase && !this.postgresMigrationPending) {
      const { data, error } = await this.supabase.rpc('claim_guest_nickname', {
        p_nickname: clean,
        p_avatar_id: cleanAvatar,
        p_existing_token: existingToken || null,
        p_ttl_seconds: clampedTtl,
      });

      if (error) {
        if (this.isMissingRpcError(error)) {
          this.handleMissingPostgresMigration();
        } else {
          throw new GuestStoreUnavailableError(`Supabase guest claim error: ${error.message}`);
        }
      } else {
        const res = data as RpcResult | null;
        if (res?.ok && res.session) {
          this.cacheVerifiedSession(res.session);
          return res.session;
        }
        if (res?.error === 'nickname_taken') {
          throw new GuestNicknameConflictError();
        }
        if (res?.error === 'invalid_nickname') {
          throw new GuestValidationError('Enter a nickname with at least 2 characters.');
        }
        throw new GuestStoreUnavailableError('Unexpected response claiming guest nickname.');
      }
    }

    return this.withLocalAtomicLock(() => {
      const now = Date.now();
      this.purgeExpiredLocal(now);

      const norm = clean.toLowerCase();
      const expiresAtMs = now + clampedTtl * 1000;

      if (existingToken) {
        const existingRec = this.localByToken.get(existingToken);
        if (existingRec && existingRec.expiresAtMs > now) {
          const conflictingToken = this.localByNorm.get(norm);
          if (conflictingToken && conflictingToken !== existingToken) {
            throw new GuestNicknameConflictError();
          }
          if (existingRec.nicknameNormalized !== norm) {
            this.localByNorm.delete(existingRec.nicknameNormalized);
          }
          existingRec.nickname = clean;
          existingRec.nicknameNormalized = norm;
          existingRec.avatarId = cleanAvatar;
          existingRec.expiresAtMs = expiresAtMs;
          this.localByNorm.set(norm, existingRec.sessionToken);
          const pub = this.toPublicSession(existingRec);
          this.cacheVerifiedSession(pub, now);
          return pub;
        }
      }

      if (this.localByNorm.has(norm)) {
        throw new GuestNicknameConflictError();
      }

      const rec: LocalGuestRecord = {
        sessionId: `guest_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`,
        sessionToken: `gtok_${crypto.randomUUID().replace(/-/g, '')}`,
        nickname: clean,
        nicknameNormalized: norm,
        avatarId: cleanAvatar,
        expiresAtMs,
      };
      this.localByToken.set(rec.sessionToken, rec);
      this.localByNorm.set(norm, rec.sessionToken);
      this.localById.set(rec.sessionId, rec.sessionToken);
      const pub = this.toPublicSession(rec);
      this.cacheVerifiedSession(pub, now);
      return pub;
    });
  }

  async heartbeat(
    sessionToken: string,
    ttlSeconds = DEFAULT_GUEST_TTL_SECONDS
  ): Promise<GuestSession> {
    const token = String(sessionToken || '').trim();
    if (!token) throw new GuestSessionExpiredError();
    const clampedTtl = Math.max(1, Math.min(600, Math.floor(ttlSeconds || DEFAULT_GUEST_TTL_SECONDS)));

    if (this.supabase && !this.postgresMigrationPending) {
      const { data, error } = await this.supabase.rpc('heartbeat_guest_session', {
        p_session_token: token,
        p_ttl_seconds: clampedTtl,
      });

      if (error) {
        if (this.isMissingRpcError(error)) {
          this.handleMissingPostgresMigration();
        } else {
          throw new GuestStoreUnavailableError(`Supabase heartbeat error: ${error.message}`);
        }
      } else {
        const res = data as RpcResult | null;
        if (res?.ok && res.session) {
          this.cacheVerifiedSession(res.session);
          return res.session;
        }
        this.tokenCache.delete(token);
        throw new GuestSessionExpiredError();
      }
    }

    return this.withLocalAtomicLock(() => {
      const now = Date.now();
      this.purgeExpiredLocal(now);
      const rec = this.localByToken.get(token);
      if (!rec || rec.expiresAtMs <= now) {
        this.tokenCache.delete(token);
        throw new GuestSessionExpiredError();
      }
      rec.expiresAtMs = now + clampedTtl * 1000;
      const pub = this.toPublicSession(rec);
      this.cacheVerifiedSession(pub, now);
      return pub;
    });
  }

  async getSessionByToken(sessionToken: string): Promise<GuestSession | null> {
    const token = String(sessionToken || '').trim();
    if (!token) return null;

    const cached = this.getCachedSession(token);
    if (cached) return cached;

    if (this.supabase && !this.postgresMigrationPending) {
      const { data, error } = await this.supabase.rpc('get_guest_session', {
        p_session_token: token,
      });
      if (error) {
        if (this.isMissingRpcError(error)) {
          this.handleMissingPostgresMigration();
        } else {
          throw new GuestStoreUnavailableError(`Supabase session lookup error: ${error.message}`);
        }
      } else {
        const res = data as RpcResult | null;
        if (res?.ok && res.session) {
          this.cacheVerifiedSession(res.session);
          return res.session;
        }
        return null;
      }
    }

    return this.withLocalAtomicLock(() => {
      const now = Date.now();
      this.purgeExpiredLocal(now);
      const rec = this.localByToken.get(token);
      if (!rec || rec.expiresAtMs <= now) return null;
      const pub = this.toPublicSession(rec);
      this.cacheVerifiedSession(pub, now);
      return pub;
    });
  }

  async getSessionById(sessionId: string): Promise<GuestSession | null> {
    const sid = String(sessionId || '').trim();
    if (!sid || !sid.startsWith('guest_')) return null;

    if (this.supabase && !this.postgresMigrationPending) {
      const { data, error } = await this.supabase.rpc('get_guest_session_by_id', {
        p_session_id: sid,
      });
      if (error) {
        if (this.isMissingRpcError(error)) {
          this.handleMissingPostgresMigration();
        } else {
          return null;
        }
      } else {
        const res = data as RpcResult | null;
        return res?.ok && res.session ? res.session : null;
      }
    }

    return this.withLocalAtomicLock(() => {
      const now = Date.now();
      this.purgeExpiredLocal(now);
      const tok = this.localById.get(sid);
      if (!tok) return null;
      const rec = this.localByToken.get(tok);
      return rec && rec.expiresAtMs > now ? { ...this.toPublicSession(rec), sessionToken: '' } : null;
    });
  }

  async releaseSession(sessionToken: string): Promise<void> {
    const token = String(sessionToken || '').trim();
    if (!token) return;
    this.tokenCache.delete(token);

    if (this.supabase && !this.postgresMigrationPending) {
      const { error } = await this.supabase.rpc('release_guest_session', {
        p_session_token: token,
      });
      if (error) {
        if (this.isMissingRpcError(error)) {
          this.handleMissingPostgresMigration();
        } else {
          throw new GuestStoreUnavailableError(`Supabase release error: ${error.message}`);
        }
      } else {
        return;
      }
    }

    await this.withLocalAtomicLock(() => {
      const rec = this.localByToken.get(token);
      if (!rec) return;
      this.localByToken.delete(token);
      if (this.localByNorm.get(rec.nicknameNormalized) === token) {
        this.localByNorm.delete(rec.nicknameNormalized);
      }
      if (this.localById.get(rec.sessionId) === token) {
        this.localById.delete(rec.sessionId);
      }
    });
  }
}
