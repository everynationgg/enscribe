import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import {
  OngoingMatchSummary,
  Profile,
  Room,
  RoomRules,
  SoloStage,
  Template,
} from '../shared/types.js';
import {
  DEFAULT_ROOM_RULES,
  SOLO_STAGES_CATALOG,
  seedInitialData,
  seedStarterTemplatesForPlayer,
} from './db/seed.js';
import { getRegisteredGames } from './platform/GameRegistry.js';
import {
  GuestNicknameConflictError,
  GuestSessionExpiredError,
  GuestSessionStore,
  GuestStoreUnavailableError,
  GuestValidationError,
} from './platform/GuestSessionStore.js';
import { ChainClashEngine } from './games/chain-clash/ChainClashEngine.js';
import {
  GridItBadRequestError,
  GridItEngine,
  GridItForbiddenError,
  GridItNotFoundError,
} from './games/gridit/GridItEngine.js';
import { GridItUnavailableError, StoredGridItMatch } from './games/gridit/GridItStateStore.js';
import {
  GuessItBadRequestError,
  GuessItEngine,
  GuessItForbiddenError,
  GuessItNotFoundError,
  GuessItRateLimitError,
} from './games/guessit/GuessItEngine.js';
import {
  GuessItUnavailableError,
  StoredGuessItMatch,
} from './games/guessit/GuessItStateStore.js';
import { GuessItRoom } from '../shared/guessit/types.js';
import { GridItRoom } from '../shared/gridit/multiplayerTypes.js';
import { suggestTemplateFillerLettersWithGemini } from './games/gridit/geminiFiller.js';
import { getServerDictionary } from './games/gridit/serverDictionary.js';
import {
  AssignedPuzzle,
  assignCustomPuzzlesDeranged,
  pickCuratedChainsForPlayers,
  validateChainWords,
} from './games/chain-clash/puzzleAssignment.js';
import {
  generateLocalWordChainSync,
  generateWordChain,
  getSyncOneWordClue,
  resolveOneWordClue,
} from './games/chain-clash/clueProvider.js';
import { MemorySnapshot, MemoryStorageRepository } from './repositories/MemoryStorageRepository.js';
import { StoredMatch } from './repositories/types.js';
import { RealtimeBroadcastEvent, SupabaseCloudSync } from './db/supabaseCloud.js';

try {
  (process as any).loadEnvFile?.();
} catch {
  // .env optional
}

export interface LocalRealtimeHooks {
  emitGlobal?: (event: string, payload?: any) => void;
  emitRoom?: (roomId: string, event: string, payload?: any) => void;
  emitPlayer?: (playerId: string, event: string, payload?: any) => void;
  emitPlayers?: (playerIds: string[], event: string, payload?: any) => void;
  emitRoomAndPlayers?: (
    roomId: string,
    playerIds: string[],
    event: string,
    payload?: any
  ) => void;
  isSocketOnline?: (playerId: string) => boolean;
}

export interface EnscribeBackendRuntime {
  app: Express;
  repo: MemoryStorageRepository;
  engine: ChainClashEngine;
  gridItEngine: GridItEngine;
  guessItEngine: GuessItEngine;
  cloudSync: SupabaseCloudSync;
  guestStore: GuestSessionStore;
  isPlayerOnline: (playerId: string) => boolean;
  broadcastMatchState: (match: StoredMatch) => void;
  broadcastGridItMatch: (
    matchId: string,
    matchRecord?: StoredGridItMatch | null,
    mode?: 'full' | 'delta'
  ) => Promise<void>;
  broadcastGuessItMatch: (matchRecord: StoredGuessItMatch) => void;
  flushSideEffects: (persistSnapshot?: boolean) => Promise<void>;
  processTimersAndFlush: () => Promise<StoredMatch[]>;
  prewarm: () => Promise<void>;
}

export function createEnscribeApp(
  hooks: LocalRealtimeHooks = {},
  options: { forceLocalGuestMemory?: boolean; disableCloudSync?: boolean; inMemoryOnly?: boolean } = {}
): EnscribeBackendRuntime {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.text({ type: 'text/plain' }));

  const repo = new MemoryStorageRepository();
  const cloudSync = new SupabaseCloudSync();
  if (options.disableCloudSync) {
    (cloudSync as any).isConfigured = () => false;
  }
  const isServerless = Boolean(process.env.VERCEL);
  const guestStore = new GuestSessionStore({
    forceLocalMemory: options.forceLocalGuestMemory,
    isServerless,
  });
  const lastSeenByPlayer = new Map<string, number>();
  const localCacheFile = path.resolve(process.cwd(), 'data', 'enscribe-state.json');

  const isPlayerOnline = (playerId: string): boolean => {
    if (hooks.isSocketOnline?.(playerId)) return true;
    const lastSeen = lastSeenByPlayer.get(playerId);
    return Boolean(lastSeen && Date.now() - lastSeen < 15000);
  };

  repo.setOnlineTracker(isPlayerOnline);
  const engine = new ChainClashEngine(repo, isPlayerOnline);

  let pendingBroadcasts: RealtimeBroadcastEvent[] = [];
  let initialized = false;
  let lastCloudSyncAt = 0;
  let inFlightHydration: Promise<void> | null = null;

  const ensureGuestProfilesRegistered = async (playerIds: string[]): Promise<void> => {
    const missing = playerIds.filter((pid) => pid && pid.startsWith('guest_') && !repo.getProfile(pid));
    if (missing.length === 0) return;
    await Promise.all(
      missing.map(async (pid) => {
        const session = await guestStore.getSessionById(pid).catch(() => null);
        if (session) {
          repo.registerEphemeralGuest(guestStore.toGuestProfile(session));
        }
      })
    );
  };

  const gridItEngine = new GridItEngine(repo, isPlayerOnline, {
    forceLocalMemory: options.forceLocalGuestMemory,
    isServerless,
    resolveProfile: async (pid) => {
      await ensureGuestProfilesRegistered([pid]);
      return repo.getProfile(pid) ?? null;
    },
  });

  const guessItEngine = new GuessItEngine(repo, isPlayerOnline, {
    forceLocalMemory: options.forceLocalGuestMemory,
    isServerless,
    resolveProfile: async (pid) => {
      await ensureGuestProfilesRegistered([pid]);
      return repo.getProfile(pid) ?? null;
    },
  });

  const loadLocalFileIfExists = (): MemorySnapshot | null => {
    if (options.inMemoryOnly) return null;
    try {
      if (!cloudSync.isConfigured() && fs.existsSync(localCacheFile)) {
        const raw = fs.readFileSync(localCacheFile, 'utf8');
        return JSON.parse(raw) as MemorySnapshot;
      }
    } catch {
      // ignore cache read error
    }
    return null;
  };

  const saveLocalFileIfUnconfigured = (snapshot: MemorySnapshot): void => {
    if (options.inMemoryOnly) return;
    try {
      if (!cloudSync.isConfigured() && !isServerless) {
        const dir = path.dirname(localCacheFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(localCacheFile, JSON.stringify(snapshot), 'utf8');
      }
    } catch {
      // ignore on read-only serverless fs
    }
  };

  const ensureHydrated = async (forceRefresh = false): Promise<void> => {
    if (cloudSync.isConfigured()) {
      const now = Date.now();
      // Persistent localhost process stays hot in memory after initial boot load;
      // Vercel serverless containers refresh if stale (> 400ms on mutations or > 1500ms on reads)
      if (initialized) {
        if (!isServerless) return;
        const maxAge = forceRefresh ? 500 : 1500;
        if (now - lastCloudSyncAt < maxAge) return;
      }

      if (!inFlightHydration) {
        inFlightHydration = (async () => {
          try {
            const snap = await cloudSync.loadSnapshot();
            if (snap && (Object.keys(snap.templates || {}).length > 0 || Object.keys(snap.profiles || {}).length > 0)) {
              repo.fromSnapshot(snap);
              seedInitialData(repo);
            } else {
              seedInitialData(repo);
              await cloudSync.saveSnapshot(repo.toSnapshot());
            }
            initialized = true;
            lastCloudSyncAt = Date.now();
          } finally {
            inFlightHydration = null;
          }
        })();
      }
      return inFlightHydration;
    }

    if (!initialized) {
      initialized = true;
      const localSnap = loadLocalFileIfExists();
      if (localSnap && (Object.keys(localSnap.templates || {}).length > 0 || Object.keys(localSnap.profiles || {}).length > 0)) {
        repo.fromSnapshot(localSnap);
        seedInitialData(repo);
      } else {
        seedInitialData(repo);
        saveLocalFileIfUnconfigured(repo.toSnapshot());
      }
    }
  };

  let cloudSaveChain: Promise<void> = Promise.resolve();
  const flushSideEffects = async (persistSnapshot = false): Promise<void> => {
    const events = [...pendingBroadcasts];
    pendingBroadcasts = [];
    const tasks: Array<Promise<any>> = [];
    if (persistSnapshot) {
      const snapshot = repo.toSnapshot();
      lastCloudSyncAt = Date.now();
      if (cloudSync.isConfigured()) {
        const saveTask = cloudSaveChain.then(() => cloudSync.saveSnapshot(snapshot));
        cloudSaveChain = saveTask.catch(() => undefined);
        tasks.push(saveTask);
      } else {
        saveLocalFileIfUnconfigured(snapshot);
      }
    }
    if (events.length > 0 && isServerless && cloudSync.isConfigured()) {
      tasks.push(cloudSync.broadcastRealtime(events));
    }
    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  };

  const queueEvent = (event: string, payload: any, targetPlayerId?: string) => {
    if (isServerless) {
      pendingBroadcasts.push({ event, payload, targetPlayerId });
    }
    if (targetPlayerId) {
      hooks.emitPlayer?.(targetPlayerId, event, payload);
    } else {
      hooks.emitGlobal?.(event, payload);
    }
  };

  const broadcastRoomUpdate = (roomId: string): void => {
    const room = repo.getRoomById(roomId);
    if (!room) return;
    if (isServerless) {
      pendingBroadcasts.push({ event: 'room:updated', payload: room });
      pendingBroadcasts.push({ event: 'rooms:public_updated', payload: {} });
    }
    const memberIds = room.players.map((p) => p.playerId);
    if (hooks.emitRoomAndPlayers) {
      hooks.emitRoomAndPlayers(roomId, memberIds, 'room:updated', room);
    } else {
      hooks.emitRoom?.(roomId, 'room:updated', room);
    }
    hooks.emitGlobal?.('rooms:public_updated');
  };

  const broadcastMatchState = (match: StoredMatch): void => {
    for (const pid of Object.keys(match.boards)) {
      const sanitized = engine.sanitizeForViewer(match, pid);
      queueEvent('match:state', sanitized, pid);
    }
  };

  const broadcastGridItRoom = async (roomId: string, roomSnapshot?: GridItRoom): Promise<void> => {
    try {
      const room = roomSnapshot ?? (await gridItEngine.getRoom(roomId));
      if (isServerless) {
        pendingBroadcasts.push({ event: 'gridit:room_updated', payload: room });
        pendingBroadcasts.push({ event: 'gridit:rooms_updated', payload: {} });
      }
      const audience = [
        ...room.players.map((p) => p.playerId),
        ...room.spectators.map((s) => s.playerId),
      ];
      if (hooks.emitRoomAndPlayers) {
        hooks.emitRoomAndPlayers(roomId, audience, 'gridit:room_updated', room);
      } else {
        hooks.emitRoom?.(roomId, 'gridit:room_updated', room);
      }
      hooks.emitGlobal?.('gridit:rooms_updated');
    } catch {
      queueEvent('gridit:rooms_updated', {});
    }
  };

  const broadcastGridItMatch = async (
    matchId: string,
    matchRecord?: StoredGridItMatch | null,
    mode: 'full' | 'delta' = 'full'
  ): Promise<void> => {
    const record = matchRecord ?? gridItEngine.getCachedMatchRecord(matchId);
    if (record) {
      const nowMs = Date.now();
      const isFinished = record.status === 'finished' || nowMs >= record.endsAtMs;
      if (mode === 'delta' && !isFinished) {
        const delta = gridItEngine.buildMatchDeltaFromRecord(record, nowMs);
        const audience = gridItEngine.getMatchAudienceIdsFromRecord(record);
        if (isServerless) {
          pendingBroadcasts.push({ event: 'gridit:match_delta', payload: delta });
        }
        if (hooks.emitPlayers) {
          hooks.emitPlayers(audience, 'gridit:match_delta', delta);
        } else {
          hooks.emitGlobal?.('gridit:match_delta', delta);
        }
        if (record.spectators.length > 0) {
          for (const spec of record.spectators) {
            try {
              const sanitized = gridItEngine.sanitizeMatchForViewerFromRecord(
                record,
                spec.playerId,
                nowMs
              );
              queueEvent('gridit:match_state', sanitized, spec.playerId);
            } catch {
              // ignore unauthorized viewer
            }
          }
        }
        return;
      }

      const audience = gridItEngine.getMatchAudienceIdsFromRecord(record);
      for (const vid of audience) {
        try {
          const sanitized = gridItEngine.sanitizeMatchForViewerFromRecord(record, vid, nowMs);
          queueEvent('gridit:match_state', sanitized, vid);
        } catch {
          // ignore unauthorized viewer
        }
      }
      return;
    }

    const audience = await gridItEngine.getMatchAudienceIds(matchId);
    for (const vid of audience) {
      try {
        const sanitized = await gridItEngine.sanitizeMatchForViewer(matchId, vid);
        queueEvent('gridit:match_state', sanitized, vid);
      } catch {
        // ignore unauthorized viewer
      }
    }
  };

  const broadcastGuessItRoom = async (
    roomId: string,
    roomSnapshot?: GuessItRoom
  ): Promise<void> => {
    try {
      const room = roomSnapshot ?? (await guessItEngine.getRoom(roomId));
      if (isServerless) {
        pendingBroadcasts.push({ event: 'guessit:room_updated', payload: room });
        pendingBroadcasts.push({ event: 'guessit:rooms_updated', payload: {} });
      }
      const audience = room.players.map((p) => p.playerId);
      if (hooks.emitRoomAndPlayers) {
        hooks.emitRoomAndPlayers(roomId, audience, 'guessit:room_updated', room);
      } else {
        hooks.emitRoom?.(roomId, 'guessit:room_updated', room);
      }
      hooks.emitGlobal?.('guessit:rooms_updated');
    } catch {
      queueEvent('guessit:rooms_updated', {});
    }
  };

  const broadcastGuessItMatch = (matchRecord: StoredGuessItMatch): void => {
    const nowMs = Date.now();
    const audience = guessItEngine.getMatchAudienceIds(matchRecord);
    for (const vid of audience) {
      const sanitized = guessItEngine.sanitizeMatchForViewerRecord(matchRecord, vid, nowMs);
      queueEvent('guessit:match_state', sanitized, vid);
    }
  };

  const processTimersAndFlush = async (): Promise<StoredMatch[]> => {
    const gridItExpired = await gridItEngine.processExpiredMatches().catch(() => []);
    for (const gm of gridItExpired) {
      await broadcastGridItMatch(gm.id, gm, 'full');
      if (gm.roomId) await broadcastGridItRoom(gm.roomId);
    }

    const guessItExpired = await guessItEngine.processExpiredTimers().catch(() => []);
    for (const hgm of guessItExpired) {
      broadcastGuessItMatch(hgm);
      if (hgm.status === 'finished' && hgm.roomId) {
        await broadcastGuessItRoom(hgm.roomId);
      }
    }

    if (!initialized) {
      if (gridItExpired.length > 0 || guessItExpired.length > 0) {
        await flushSideEffects(false);
      }
      return [];
    }
    const updatedMatches = engine.processExpiredTimers();
    if (updatedMatches.length > 0) {
      for (const m of updatedMatches) {
        for (const b of Object.values(m.boards)) {
          await ensureActiveWordClue(m.id, b.playerId);
        }
        const refreshed = repo.getMatch(m.id) ?? m;
        broadcastMatchState(refreshed);
      }
      await flushSideEffects(true);
    } else if (gridItExpired.length > 0 || guessItExpired.length > 0) {
      await flushSideEffects(false);
    }
    return updatedMatches;
  };

  const pendingClueLookups = new Set<string>();
  async function ensureActiveWordClue(matchId: string, playerId: string): Promise<boolean> {
    const m = repo.getMatch(matchId);
    if (!m) return false;
    const b = m.boards[playerId];
    if (!b || b.completedAtMs !== null) return false;
    const idx = b.currentWordIndex;
    const targetWord = b.words[idx];
    if (!targetWord) return false;
    const revealed = b.revealedCounts[idx] ?? 1;
    const totalMisses = b.wrongAttemptsCurrentWord + b.passesCurrentWord;
    const clueThreshold =
      m.rules.autoRevealAfterFailedTurns ??
      (m.rules.autoRevealAfterAttempts > 0 ? m.rules.autoRevealAfterAttempts : 2);
    if ((revealed >= 2 || (clueThreshold > 0 && totalMisses >= clueThreshold)) && !b.wordClues?.[idx]) {
      const syncClue = getSyncOneWordClue(targetWord);
      if (syncClue) {
        b.wordClues = { ...(b.wordClues ?? {}), [idx]: syncClue };
        repo.updateMatchBoard(b);
        return true;
      }
      if (!isServerless) {
        const lookupKey = `${matchId}:${playerId}:${idx}`;
        if (!pendingClueLookups.has(lookupKey)) {
          pendingClueLookups.add(lookupKey);
          resolveOneWordClue(targetWord)
            .then((clue) => {
              const latestMatch = repo.getMatch(matchId);
              const latestBoard = latestMatch?.boards[playerId];
              if (latestMatch && latestBoard && latestBoard.currentWordIndex === idx && !latestBoard.wordClues?.[idx]) {
                latestBoard.wordClues = { ...(latestBoard.wordClues ?? {}), [idx]: clue };
                repo.updateMatchBoard(latestBoard);
                broadcastMatchState(latestMatch);
                flushSideEffects(true).catch(() => undefined);
              }
            })
            .catch(() => undefined)
            .finally(() => {
              pendingClueLookups.delete(lookupKey);
            });
        }
        return false;
      }
      const clue = await resolveOneWordClue(targetWord);
      b.wordClues = { ...(b.wordClues ?? {}), [idx]: clue };
      repo.updateMatchBoard(b);
      return true;
    }
    return false;
  }

  function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  function buildAssignmentsForRoom(room: Room): AssignedPuzzle[] {
    const submissions = repo.getRoomPlayerSubmissions(room.id);
    const officialTemplates = repo.listTemplates().filter((t) => t.status === 'official');
    const playerIds = room.players.map((p) => p.playerId);

    if (playerIds.length < 2) {
      throw new Error('At least 2 players are required to start a multiplayer match.');
    }

    if (room.rules.puzzleSource === 'curated_db' || room.rules.mode === 'speed_race') {
      return pickCuratedChainsForPlayers(
        playerIds,
        officialTemplates,
        room.rules.chainLength,
        room.rules.mode === 'speed_race'
      );
    }

    const resolvedSubmissions: Array<{ playerId: string; words: string[] }> = [];
    for (const sub of submissions) {
      let words: string[] | null = null;
      if (sub.submittedWords && sub.submittedWords.length >= 3) {
        words = sub.submittedWords;
      } else if (sub.submittedTemplateId) {
        const tpl = repo.getTemplate(sub.submittedTemplateId);
        if (tpl && tpl.words.length >= 3) {
          words = tpl.words;
        }
      }
      if (!words) {
        const profile = repo.getProfile(sub.playerId);
        throw new Error(
          `Player ${profile?.username ?? sub.playerId} has not selected or prepared a playable puzzle yet.`
        );
      }
      const validation = validateChainWords(words);
      if (!validation.valid) {
        const profile = repo.getProfile(sub.playerId);
        throw new Error(`Invalid puzzle from ${profile?.username ?? sub.playerId}: ${validation.error}`);
      }
      resolvedSubmissions.push({ playerId: sub.playerId, words: validation.normalized });
    }

    return assignCustomPuzzlesDeranged(resolvedSubmissions);
  }

  // Serialized async route helper for mutations; read-only GETs execute concurrently after hydration
  let mutationChain: Promise<void> = Promise.resolve();
  const handleApi = (
    mutating: boolean,
    fn: (req: Request, res: Response, markDirty: () => void) => Promise<void> | void
  ) => {
    return (req: Request, res: Response) => {
      const runRequest = async () => {
        const origJson = res.json.bind(res);
        let capturedBody: any = undefined;
        let jsonCaptured = false;
        let isDirty = mutating;
        const markDirty = () => {
          isDirty = true;
        };
        (res as any).json = (body: any) => {
          capturedBody = body;
          jsonCaptured = true;
          return res;
        };

        try {
          const guestTokenHeader =
            typeof req.headers['x-guest-session-token'] === 'string'
              ? req.headers['x-guest-session-token'].trim()
              : '';
          if (guestTokenHeader) {
            const gSession = await guestStore.getSessionByToken(guestTokenHeader).catch(() => null);
            if (gSession) {
              repo.registerEphemeralGuest(guestStore.toGuestProfile(gSession));
              lastSeenByPlayer.set(gSession.sessionId, Date.now());
            }
          }

          const activePid =
            (req.body?.playerId as string) ||
            (req.body?.hostId as string) ||
            (req.body?.ownerId as string) ||
            (req.query?.playerId as string) ||
            (req.params?.playerId as string);
          if (activePid) {
            lastSeenByPlayer.set(String(activePid), Date.now());
            await ensureGuestProfilesRegistered([String(activePid)]);
          }

          await ensureHydrated(mutating);
          const expired = engine.processExpiredTimers();
          for (const m of expired) {
            broadcastMatchState(m);
          }

          await fn(req, res, markDirty);

          const shouldPersist = isDirty || expired.length > 0;
          if (isServerless) {
            await flushSideEffects(shouldPersist);
            if (jsonCaptured && !res.headersSent) {
              origJson(capturedBody);
            }
          } else {
            if (jsonCaptured && !res.headersSent) {
              origJson(capturedBody);
            }
            flushSideEffects(shouldPersist).catch((e) =>
              console.error('[BackgroundFlush] warning:', e)
            );
          }
        } catch (err: any) {
          console.error('[API Error]', req.method, req.originalUrl, err);
          pendingBroadcasts = [];
          if (!res.headersSent) {
            res.status(500);
            origJson({ error: err?.message || 'Internal server error' });
          }
        }
      };

      if (!mutating) {
        runRequest();
        return;
      }

      const task = mutationChain.then(runRequest);
      mutationChain = task.catch(() => undefined);
    };
  };

  // ==================== REST API ====================

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      platform: 'Enscribe',
      cloudConfigured: cloudSync.isConfigured(),
      guestStoreBackend: guestStore.getBackendMode(),
      games: getRegisteredGames(),
      serverNowMs: Date.now(),
    });
  });

  // ==================== TEMPORARY GUEST SESSIONS (ATOMIC POSTGRESQL / EPHEMERAL) ====================
  const sendGuestError = (res: Response, err: any) => {
    if (
      err instanceof GuestNicknameConflictError ||
      err instanceof GuestValidationError ||
      err instanceof GuestSessionExpiredError ||
      err instanceof GuestStoreUnavailableError
    ) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err?.message || 'Guest session service error' });
  };

  app.post('/api/guest/claim', async (req, res) => {
    try {
      const { nickname, avatarId, sessionToken } = req.body ?? {};
      const session = await guestStore.claimNickname(
        String(nickname || ''),
        String(avatarId || 'alex'),
        sessionToken ? String(sessionToken) : null
      );
      const profile = guestStore.toGuestProfile(session);
      repo.registerEphemeralGuest(profile);
      lastSeenByPlayer.set(session.sessionId, Date.now());
      res.status(200).json({ session, profile: repo.getProfile(session.sessionId) ?? profile });
    } catch (err: any) {
      sendGuestError(res, err);
    }
  });

  app.post('/api/guest/heartbeat', async (req, res) => {
    try {
      const token = String(
        req.body?.sessionToken || req.headers['x-guest-session-token'] || ''
      ).trim();
      const session = await guestStore.heartbeat(token);
      const profile = guestStore.toGuestProfile(session);
      repo.registerEphemeralGuest(profile);
      lastSeenByPlayer.set(session.sessionId, Date.now());
      res.json({ session, profile: repo.getProfile(session.sessionId) ?? profile });
    } catch (err: any) {
      sendGuestError(res, err);
    }
  });

  app.get('/api/guest/session', async (req, res) => {
    try {
      const token = String(
        req.headers['x-guest-session-token'] || req.query.sessionToken || ''
      ).trim();
      if (!token) {
        res.status(401).json({ error: 'Missing guest session token' });
        return;
      }
      const session = await guestStore.getSessionByToken(token);
      if (!session) {
        res.status(401).json({ error: 'Guest session expired or not found' });
        return;
      }
      const profile = guestStore.toGuestProfile(session);
      repo.registerEphemeralGuest(profile);
      lastSeenByPlayer.set(session.sessionId, Date.now());
      res.json({ session, profile: repo.getProfile(session.sessionId) ?? profile });
    } catch (err: any) {
      sendGuestError(res, err);
    }
  });

  app.post('/api/guest/rename', async (req, res) => {
    try {
      const token = String(
        req.body?.sessionToken || req.headers['x-guest-session-token'] || ''
      ).trim();
      const existing = await guestStore.getSessionByToken(token);
      if (!existing) {
        res.status(401).json({ error: 'Guest session expired. Please re-enter a nickname.' });
        return;
      }
      const session = await guestStore.claimNickname(
        String(req.body?.nickname ?? existing.nickname),
        String(req.body?.avatarId ?? existing.avatarId),
        token
      );
      const profile = guestStore.toGuestProfile(session);
      repo.registerEphemeralGuest(profile);
      lastSeenByPlayer.set(session.sessionId, Date.now());
      res.json({ session, profile: repo.getProfile(session.sessionId) ?? profile });
    } catch (err: any) {
      sendGuestError(res, err);
    }
  });

  app.post('/api/guest/release', async (req, res) => {
    try {
      let bodyObj: any = req.body;
      if (typeof bodyObj === 'string') {
        try {
          bodyObj = JSON.parse(bodyObj);
        } catch {
          bodyObj = {};
        }
      }
      const token = String(
        bodyObj?.sessionToken || req.headers['x-guest-session-token'] || ''
      ).trim();
      const existing = token ? await guestStore.getSessionByToken(token).catch(() => null) : null;
      if (token) {
        await guestStore.releaseSession(token);
      }
      if (existing) {
        repo.removeEphemeralGuest(existing.sessionId);
      }
      res.json({ ok: true });
    } catch (err: any) {
      sendGuestError(res, err);
    }
  });

  app.post(
    '/api/dev/reset-seed',
    handleApi(true, (_req, res) => {
      repo.clearAll();
      seedInitialData(repo);
      res.json({ ok: true });
    })
  );

  app.get('/api/games', (_req, res) => {
    res.json(getRegisteredGames());
  });

  // Single-request player bootstrap (replaces 6 separate GETs on mount/tab refresh)
  app.get(
    '/api/bootstrap/:playerId',
    handleApi(false, async (req, res) => {
      const playerId = String(req.params.playerId);
      await ensureGuestProfilesRegistered([playerId]);
      const profile = repo.getProfile(playerId);
      if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }
      const matches = repo.listMatchesForPlayer(playerId);
      const allOpponentIds = matches.flatMap((m) => Object.keys(m.boards));
      await ensureGuestProfilesRegistered(allOpponentIds);
      const ongoingMatches: OngoingMatchSummary[] = matches
        .filter((m) => m.status !== 'finished' || m.boards[playerId]?.completedAtMs === null)
        .map((m) => {
          const board = m.boards[playerId];
          const opponentNames = Object.keys(m.boards)
            .filter((pid) => pid !== playerId)
            .map((pid) => repo.getProfile(pid)?.username ?? pid);
          const isYourTurn =
            m.mode === 'solo' ||
            m.mode === 'speed_race' ||
            m.status === 'opening' ||
            m.activeTurnPlayerId === playerId;
          return {
            matchId: m.id,
            gameType: m.gameType,
            mode: m.mode,
            title: m.title,
            status: m.status,
            isYourTurn,
            opponentNames,
            opponentPrimaryName: opponentNames[0] ?? 'Solo',
            progressLabel: board ? `${board.currentWordIndex}/${board.words.length} words` : 'Active',
            updatedAt: m.updatedAt,
          };
        });

      const completed = new Set(repo.getCompletedSoloStages(playerId));
      const soloStages: SoloStage[] = SOLO_STAGES_CATALOG.map((s) => ({
        ...s,
        completed: completed.has(s.id),
      }));

      res.json({
        profile,
        history: repo.listMatchHistory(playerId),
        templates: repo.listTemplates(playerId),
        ongoingMatches,
        publicRooms: repo.listPublicRooms(),
        soloStages,
        notifications: repo.listNotifications(playerId),
      });
    })
  );

  // Auth: Nickname Sign-In (creates or resumes persistent player profile with unique ID)
  app.post(
    '/api/auth/signin',
    handleApi(true, (req, res) => {
      const { username, avatarId } = req.body ?? {};
      const cleanName = String(username || '').trim().slice(0, 20);
      if (cleanName.length < 2) {
        res.status(400).json({ error: 'Nickname must be at least 2 characters.' });
        return;
      }

      const existing = repo
        .listProfiles()
        .find((p) => p.username.toLowerCase() === cleanName.toLowerCase());

      if (existing) {
        const updated =
          avatarId && avatarId !== existing.avatarId
            ? repo.upsertProfile({ ...existing, avatarId: String(avatarId) })
            : existing;
        seedStarterTemplatesForPlayer(repo, updated.id);
        res.json({ profile: updated, isNew: false });
        return;
      }

      const profile: Profile = {
        id: `player_${crypto.randomUUID().slice(0, 8)}`,
        username: cleanName,
        avatarId: String(avatarId || 'alex'),
        rankTier: 'Silver II',
        rankPoints: 1000,
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
      };
      const saved = repo.upsertProfile(profile);
      seedStarterTemplatesForPlayer(repo, saved.id);
      res.status(201).json({ profile: saved, isNew: true });
    })
  );

  // Profiles
  app.get(
    '/api/profiles',
    handleApi(false, (_req, res) => {
      res.json(repo.listProfiles());
    })
  );

  app.get(
    '/api/profiles/:id',
    handleApi(false, (req, res) => {
      const profile = repo.getProfile(String(req.params.id));
      if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }
      res.json({ profile, history: repo.listMatchHistory(profile.id) });
    })
  );

  app.post(
    '/api/profiles',
    handleApi(true, (req, res) => {
      const { username, avatarId } = req.body ?? {};
      const cleanName = String(username || '').trim().slice(0, 20);
      if (cleanName.length < 2) {
        res.status(400).json({ error: 'Nickname must be at least 2 characters.' });
        return;
      }
      const existing = repo
        .listProfiles()
        .find((p) => p.username.toLowerCase() === cleanName.toLowerCase());
      if (existing) {
        seedStarterTemplatesForPlayer(repo, existing.id);
        res.json(existing);
        return;
      }
      const profile: Profile = {
        id: `player_${crypto.randomUUID().slice(0, 8)}`,
        username: cleanName,
        avatarId: String(avatarId || 'alex'),
        rankTier: 'Silver II',
        rankPoints: 1000,
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
      };
      const saved = repo.upsertProfile(profile);
      seedStarterTemplatesForPlayer(repo, saved.id);
      res.status(201).json(saved);
    })
  );

  app.patch(
    '/api/profiles/:id/cosmetics',
    handleApi(true, (req, res) => {
      const updated = repo.updateCosmetics(String(req.params.id), req.body);
      if (!updated) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }
      res.json(updated);
    })
  );

  app.patch(
    '/api/profiles/:id',
    handleApi(true, (req, res) => {
      const current = repo.getProfile(String(req.params.id));
      if (!current) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }
      const username = req.body.username ? String(req.body.username).trim().slice(0, 20) : current.username;
      const avatarId = req.body.avatarId ? String(req.body.avatarId) : current.avatarId;
      res.json(repo.upsertProfile({ ...current, username, avatarId }));
    })
  );

  // Notifications
  app.get(
    '/api/notifications/:playerId',
    handleApi(false, (req, res) => {
      res.json(repo.listNotifications(String(req.params.playerId)));
    })
  );

  app.post(
    '/api/notifications/:playerId/read',
    handleApi(true, (req, res) => {
      repo.markNotificationsRead(String(req.params.playerId));
      res.json({ ok: true });
    })
  );

  // Templates
  app.get(
    '/api/templates',
    handleApi(false, (req, res) => {
      const ownerId = req.query.ownerId ? String(req.query.ownerId) : undefined;
      res.json(repo.listTemplates(ownerId));
    })
  );

  app.post(
    '/api/templates',
    handleApi(true, (req, res) => {
      const { id, ownerId, name, theme, thumbnailKey, words, status } = req.body ?? {};
      if (String(ownerId || '').startsWith('guest_')) {
        res.status(403).json({ error: 'Guest templates are saved locally in your browser.' });
        return;
      }
      const cleanName = String(name || 'Untitled Chain').trim().slice(0, 40);
      const cleanTheme = String(theme || 'Custom').trim().slice(0, 30);
      const cleanStatus = status === 'draft' ? 'draft' : 'saved';
      const rawWords: string[] = Array.isArray(words) ? words : [];

      let normalizedWords: string[];
      if (cleanStatus === 'saved') {
        const check = validateChainWords(rawWords);
        if (!check.valid) {
          res.status(400).json({ error: check.error });
          return;
        }
        normalizedWords = check.normalized;
      } else {
        normalizedWords = rawWords.map((w) => String(w || '').trim().toUpperCase()).filter(Boolean);
      }

      const existing = id ? repo.getTemplate(String(id)) : null;
      const now = Date.now();
      const tpl: Template = {
        id: existing ? existing.id : `tpl_${crypto.randomUUID().slice(0, 10)}`,
        ownerId: existing ? existing.ownerId : String(ownerId || 'player_alex'),
        name: cleanName,
        theme: cleanTheme,
        thumbnailKey: thumbnailKey || existing?.thumbnailKey || 'custom',
        words: normalizedWords,
        status: cleanStatus,
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now,
      };
      const saved = repo.saveTemplate(tpl);
      res.status(existing ? 200 : 201).json(saved);
    })
  );

  app.post(
    '/api/templates/:id/duplicate',
    handleApi(true, (req, res) => {
      const source = repo.getTemplate(String(req.params.id));
      if (!source) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }
      const now = Date.now();
      const ownerId = req.body?.ownerId ? String(req.body.ownerId) : source.ownerId;
      const dup: Template = {
        ...source,
        id: `tpl_${crypto.randomUUID().slice(0, 10)}`,
        ownerId,
        name: `${source.name} Copy`,
        status: 'saved',
        createdAt: now,
        updatedAt: now,
      };
      res.status(201).json(repo.saveTemplate(dup));
    })
  );

  app.delete(
    '/api/templates/:id',
    handleApi(true, (req, res) => {
      const tpl = repo.getTemplate(String(req.params.id));
      if (!tpl) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }
      if (tpl.status === 'official') {
        res.status(403).json({ error: 'Cannot delete official templates' });
        return;
      }
      repo.deleteTemplate(tpl.id);
      res.json({ ok: true });
    })
  );

  // Rooms
  app.get(
    '/api/rooms/public',
    handleApi(false, async (_req, res) => {
      const initial = repo.listPublicRooms();
      const guestIds = initial.flatMap((r) => [r.hostId, ...r.players.map((p) => p.playerId)]);
      await ensureGuestProfilesRegistered(guestIds);
      res.json(repo.listPublicRooms());
    })
  );

  app.get(
    '/api/rooms/:id',
    handleApi(false, async (req, res) => {
      const idOrCode = String(req.params.id);
      const room = repo.getRoomById(idOrCode) ?? repo.getRoomByCode(idOrCode);
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      await ensureGuestProfilesRegistered([room.hostId, ...room.players.map((p) => p.playerId)]);
      res.json(repo.getRoomById(room.id) ?? room);
    })
  );

  app.post(
    '/api/rooms',
    handleApi(true, (req, res) => {
      const { hostId, name, isPublic, rules } = req.body ?? {};
      if (!hostId || !repo.getProfile(String(hostId))) {
        res.status(400).json({ error: 'Valid hostId is required' });
        return;
      }
      const mergedRules: RoomRules = {
        ...DEFAULT_ROOM_RULES,
        ...(rules || {}),
        gameType: 'chain_clash',
      };
      let code = generateRoomCode();
      while (repo.getRoomByCode(code)) code = generateRoomCode();
      const room = repo.createRoom({
        id: `room_${crypto.randomUUID().slice(0, 10)}`,
        code,
        name: String(name || (isPublic ? 'Public Room' : 'Private Room')).trim().slice(0, 36),
        hostId: String(hostId),
        isPublic: Boolean(isPublic),
        rules: mergedRules,
        createdAt: Date.now(),
      });
      queueEvent('rooms:public_updated', {});
      res.status(201).json(room);
    })
  );

  app.post(
    '/api/rooms/join',
    handleApi(true, (req, res) => {
      const { codeOrId, playerId } = req.body ?? {};
      if (!playerId || !repo.getProfile(String(playerId))) {
        res.status(400).json({ error: 'Valid playerId is required' });
        return;
      }
      const room =
        repo.getRoomByCode(String(codeOrId || '')) ?? repo.getRoomById(String(codeOrId || ''));
      if (!room) {
        res.status(404).json({ error: 'Room not found. Check the share code.' });
        return;
      }

      const alreadyInRoom = room.players.some((p) => p.playerId === playerId);
      if (room.status !== 'lobby' && !alreadyInRoom) {
        res.status(403).json({
          error: 'Match already in progress. New players cannot join an ongoing match.',
        });
        return;
      }
      if (!alreadyInRoom && room.players.length >= room.rules.maxPlayers) {
        res.status(409).json({ error: 'Room is full.' });
        return;
      }

      if (!alreadyInRoom) {
        repo.upsertRoomPlayer(room.id, String(playerId), { isReady: false, puzzleStatus: 'none' });
      }
      const updated = repo.getRoomById(room.id)!;
      broadcastRoomUpdate(room.id);
      res.json(updated);
    })
  );

  app.post(
    '/api/rooms/:id/leave',
    handleApi(true, (req, res) => {
      const { playerId } = req.body ?? {};
      const room = repo.getRoomById(String(req.params.id));
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      repo.removeRoomPlayer(room.id, String(playerId));
      const refreshed = repo.getRoomById(room.id);
      if (refreshed && refreshed.players.length === 0 && !refreshed.id.startsWith('room_demo')) {
        repo.deleteRoom(room.id);
        queueEvent('rooms:public_updated', {});
      } else {
        broadcastRoomUpdate(room.id);
      }
      res.json({ ok: true });
    })
  );

  app.patch(
    '/api/rooms/:id/rules',
    handleApi(true, (req, res) => {
      const { playerId, rules } = req.body ?? {};
      const room = repo.getRoomById(String(req.params.id));
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      if (room.hostId !== playerId) {
        res.status(403).json({ error: 'Only the room host can modify rules.' });
        return;
      }
      const updatedRules: RoomRules = { ...room.rules, ...rules, gameType: 'chain_clash' };
      repo.updateRoomRules(room.id, updatedRules);
      const refreshed = repo.getRoomById(room.id)!;
      broadcastRoomUpdate(room.id);
      res.json(refreshed);
    })
  );

  app.post(
    '/api/rooms/:id/puzzle',
    handleApi(true, (req, res) => {
      const { playerId, templateId, customWords, puzzleStatus } = req.body ?? {};
      const room = repo.getRoomById(String(req.params.id));
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      if (!room.players.some((p) => p.playerId === playerId)) {
        res.status(403).json({ error: 'You are not in this room.' });
        return;
      }

      let validatedCustomWords: string[] | null = null;
      if (Array.isArray(customWords) && customWords.length > 0) {
        const check = validateChainWords(customWords);
        if (!check.valid) {
          res.status(400).json({ error: check.error });
          return;
        }
        validatedCustomWords = check.normalized;
      }

      repo.upsertRoomPlayer(room.id, String(playerId), {
        puzzleStatus: puzzleStatus ?? (templateId || validatedCustomWords ? 'ready' : 'creating'),
        submittedTemplateId: templateId ?? null,
        submittedWords: validatedCustomWords,
      });
      const refreshed = repo.getRoomById(room.id)!;
      broadcastRoomUpdate(room.id);
      res.json(refreshed);
    })
  );

  app.post(
    '/api/rooms/:id/ready',
    handleApi(true, (req, res) => {
      const { playerId, isReady } = req.body ?? {};
      const room = repo.getRoomById(String(req.params.id));
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      if (!room.players.some((p) => p.playerId === playerId)) {
        res.status(403).json({ error: 'You are not in this room.' });
        return;
      }
      repo.upsertRoomPlayer(room.id, String(playerId), { isReady: Boolean(isReady) });
      const refreshed = repo.getRoomById(room.id)!;
      broadcastRoomUpdate(room.id);
      res.json(refreshed);
    })
  );

  app.post(
    '/api/rooms/:id/chat',
    handleApi(true, (req, res) => {
      const { playerId, text } = req.body ?? {};
      const room = repo.getRoomById(String(req.params.id));
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      const profile = repo.getProfile(String(playerId));
      if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }
      const cleanText = String(text || '').trim().slice(0, 300);
      if (!cleanText) {
        res.status(400).json({ error: 'Message cannot be empty' });
        return;
      }

      repo.addRoomMessage({
        id: `rmsg_${crypto.randomUUID().slice(0, 10)}`,
        roomId: room.id,
        senderId: profile.id,
        senderName: profile.username,
        senderAvatar: profile.avatarId,
        text: cleanText,
        createdAt: Date.now(),
      });
      const refreshed = repo.getRoomById(room.id)!;
      broadcastRoomUpdate(room.id);
      res.json(refreshed);
    })
  );

  app.post(
    '/api/rooms/:id/start',
    handleApi(true, (req, res) => {
      const { playerId } = req.body ?? {};
      const room = repo.getRoomById(String(req.params.id));
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      if (room.hostId !== playerId) {
        res.status(403).json({ error: 'Only the host can start the match.' });
        return;
      }
      if (room.status === 'in_progress' && room.activeMatchId) {
        const existing = repo.getMatch(room.activeMatchId);
        if (existing) {
          res.json({ room, match: engine.sanitizeForViewer(existing, String(playerId)) });
          return;
        }
      }

      try {
        const assignments = buildAssignmentsForRoom(room);
        const title = room.rules.mode === 'speed_race' ? 'Speed Race' : 'Classic Match';
        const match = engine.createMatch({
          roomId: room.id,
          mode: room.rules.mode,
          title,
          rules: room.rules,
          assignments,
        });

        const refreshedRoom = repo.getRoomById(room.id)!;
        if (isServerless) {
          pendingBroadcasts.push({
            event: 'room:match_started',
            payload: { roomId: room.id, matchId: match.id },
          });
        }
        const memberIds = refreshedRoom.players.map((p) => p.playerId);
        if (hooks.emitRoomAndPlayers) {
          hooks.emitRoomAndPlayers(room.id, memberIds, 'room:match_started', {
            roomId: room.id,
            matchId: match.id,
          });
        } else {
          hooks.emitRoom?.(room.id, 'room:match_started', { roomId: room.id, matchId: match.id });
        }
        broadcastRoomUpdate(room.id);
        broadcastMatchState(match);

        res.status(201).json({
          room: refreshedRoom,
          match: engine.sanitizeForViewer(match, String(playerId)),
        });
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    })
  );

  // Matchmaking
  app.post(
    '/api/matchmaking/quick-play',
    handleApi(true, (req, res) => {
      const { playerId } = req.body ?? {};
      const profile = repo.getProfile(String(playerId));
      if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      const publicRooms = repo.listPublicRooms().filter(
        (r) =>
          r.status === 'lobby' &&
          r.players.length < r.rules.maxPlayers &&
          (r.players.some((p) => p.playerId === playerId) || r.players.length >= 1)
      );

      if (publicRooms.length > 0) {
        const target = publicRooms[0];
        if (!target.players.some((p) => p.playerId === playerId)) {
          const officialTemplates = repo.listTemplates().filter((t) => t.status === 'official');
          const randomOfficial =
            officialTemplates.length > 0
              ? officialTemplates[Math.floor(Math.random() * officialTemplates.length)]
              : null;
          repo.upsertRoomPlayer(target.id, String(playerId), {
            isReady: true,
            puzzleStatus: 'ready',
            submittedTemplateId: randomOfficial?.id ?? 'tpl_official_fantasy_1',
          });
        }
        const updated = repo.getRoomById(target.id)!;
        broadcastRoomUpdate(target.id);
        res.json({ status: 'joined_room', room: updated });
        return;
      }

      let code = generateRoomCode();
      while (repo.getRoomByCode(code)) code = generateRoomCode();
      const room = repo.createRoom({
        id: `room_${crypto.randomUUID().slice(0, 10)}`,
        code,
        name: `${profile.username}'s Quick Match`,
        hostId: String(playerId),
        isPublic: true,
        rules: {
          ...DEFAULT_ROOM_RULES,
          maxPlayers: 2,
          puzzleSource: 'curated_db',
        },
        createdAt: Date.now(),
      });
      repo.upsertRoomPlayer(room.id, String(playerId), { isReady: true, puzzleStatus: 'ready' });
      queueEvent('rooms:public_updated', {});
      res.status(201).json({ status: 'created_room', room: repo.getRoomById(room.id) });
    })
  );

  app.post(
    '/api/matchmaking/ranked',
    handleApi(true, async (req, res) => {
      const { playerId } = req.body ?? {};
      const profile = repo.getProfile(String(playerId));
      if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      await ensureGuestProfilesRegistered(repo.getRankedQueue());
      const waitingCandidates = repo
        .getRankedQueue()
        .filter((pid) => pid !== playerId && repo.getProfile(pid))
        .sort((a, b) => {
          const pa = repo.getProfile(a)!;
          const pb = repo.getProfile(b)!;
          return Math.abs(pa.rankPoints - profile.rankPoints) - Math.abs(pb.rankPoints - profile.rankPoints);
        });

      if (waitingCandidates.length > 0) {
        const opponentId = waitingCandidates[0];
        repo.removeFromRankedQueue(opponentId);
        repo.removeFromRankedQueue(String(playerId));

        const officialTemplates = repo.listTemplates().filter((t) => t.status === 'official');
        const rankedRules: RoomRules = {
          ...DEFAULT_ROOM_RULES,
          mode: 'classic',
          maxPlayers: 2,
          timePerWordSeconds: 20,
          timerEnabled: true,
          puzzleSource: 'curated_db',
          chainVisibility: 'full_chain',
          wordLengthVisible: true,
          autoRevealAfterAttempts: 2,
          autoRevealAfterPasses: 0,
          autoRevealAfterFailedTurns: 2,
          opponentVisibility: 'words_only',
          difficultyPreset: 'competitive',
        };
        const assignments = pickCuratedChainsForPlayers([opponentId, String(playerId)], officialTemplates, 5, false);
        const match = engine.createMatch({
          roomId: null,
          mode: 'ranked',
          title: 'Ranked Match',
          rules: rankedRules,
          assignments,
        });
        broadcastMatchState(match);
        queueEvent('matchmaking:ranked_matched', { matchId: match.id }, opponentId);
        res.status(201).json({ status: 'matched', matchId: match.id });
        return;
      }

      repo.addToRankedQueue(String(playerId));
      res.json({
        status: 'queued',
        queueSize: repo.getRankedQueue().length,
        message: 'Searching for a ranked opponent with comparable RP...',
      });
    })
  );

  app.delete(
    '/api/matchmaking/ranked/:playerId',
    handleApi(true, (req, res) => {
      repo.removeFromRankedQueue(String(req.params.playerId));
      res.json({ ok: true });
    })
  );

  // Solo Adventure
  app.get(
    '/api/solo/stages/:playerId',
    handleApi(false, (req, res) => {
      const completed = new Set(repo.getCompletedSoloStages(String(req.params.playerId)));
      const stages: SoloStage[] = SOLO_STAGES_CATALOG.map((s) => ({
        ...s,
        completed: completed.has(s.id),
      }));
      res.json(stages);
    })
  );

  app.post(
    '/api/solo/start',
    handleApi(true, (req, res) => {
      const { playerId, stageId, templateId, fresh } = req.body ?? {};
      const profile = repo.getProfile(String(playerId));
      if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }
      const stage = stageId ? SOLO_STAGES_CATALOG.find((s) => s.id === stageId) : null;
      const tplId = templateId ?? stage?.templateId;
      const tpl = tplId ? repo.getTemplate(String(tplId)) : null;
      if (!tpl) {
        res.status(404).json({ error: 'Puzzle template not found' });
        return;
      }

      const completedStages = repo.getCompletedSoloStages(String(playerId));
      const isReplayOrFresh =
        Boolean(fresh) || (Boolean(stage) && !templateId && completedStages.includes(stage!.id));
      const words = isReplayOrFresh
        ? generateLocalWordChainSync(stage?.theme ?? tpl.theme, stage?.wordCount ?? tpl.words.length, {
            excludeWords: tpl.words,
          }).words
        : [...tpl.words];

      const match = engine.createMatch({
        roomId: null,
        mode: 'solo',
        title: stage ? `${stage.theme}: ${stage.title}` : `Solo: ${tpl.name}`,
        theme: stage?.theme ?? tpl.theme,
        rules: {
          ...DEFAULT_ROOM_RULES,
          maxPlayers: 1,
          timerEnabled: false,
          chainVisibility: 'full_chain',
        },
        assignments: [
          {
            recipientPlayerId: String(playerId),
            authorPlayerId: null,
            words,
          },
        ],
      });
      res.status(201).json({
        stageId: stage?.id ?? null,
        match: engine.sanitizeForViewer(match, String(playerId)),
      });
    })
  );

  // Matches
  app.get(
    '/api/matches/ongoing/:playerId',
    handleApi(false, (req, res) => {
      const playerId = String(req.params.playerId);
      const matches = repo.listMatchesForPlayer(playerId);
      const summaries: OngoingMatchSummary[] = matches
        .filter((m) => m.status !== 'finished' || m.boards[playerId]?.completedAtMs === null)
        .map((m) => {
          const board = m.boards[playerId];
          const opponentNames = Object.keys(m.boards)
            .filter((pid) => pid !== playerId)
            .map((pid) => repo.getProfile(pid)?.username ?? pid);
          const isYourTurn =
            m.mode === 'solo' ||
            m.mode === 'speed_race' ||
            m.status === 'opening' ||
            m.activeTurnPlayerId === playerId;
          return {
            matchId: m.id,
            gameType: m.gameType,
            mode: m.mode,
            title: m.title,
            status: m.status,
            isYourTurn,
            opponentNames,
            opponentPrimaryName: opponentNames[0] ?? 'Solo',
            progressLabel: board ? `${board.currentWordIndex}/${board.words.length} words` : 'Active',
            updatedAt: m.updatedAt,
          };
        });
      res.json(summaries);
    })
  );

  app.get(
    '/api/matches/:id',
    handleApi(false, async (req, res, markDirty) => {
      const matchId = String(req.params.id);
      const playerId = String(req.query.playerId || '');
      const match = repo.getMatch(matchId);
      if (!match) {
        res.status(404).json({ error: 'Match not found' });
        return;
      }
      if (!playerId || !match.boards[playerId]) {
        res.status(403).json({
          error: 'Access denied: you are not a participant in this match.',
        });
        return;
      }

      await ensureGuestProfilesRegistered(Object.keys(match.boards));

      const wasAwaiting = match.turnAwaitingOnline;
      const activated = engine.activateAwaitingTurnIfOnline(match.id, playerId) ?? match;
      const clueAdded = await ensureActiveWordClue(activated.id, playerId);
      const latest = clueAdded ? (repo.getMatch(activated.id) ?? activated) : activated;
      const sanitized = engine.sanitizeForViewer(latest, playerId);
      if ((wasAwaiting && !activated.turnAwaitingOnline) || clueAdded) {
        markDirty();
        if (wasAwaiting && !activated.turnAwaitingOnline) {
          broadcastMatchState(latest);
        }
      }
      res.json(sanitized);
    })
  );

  app.post(
    '/api/ai/generate-chain',
    handleApi(false, async (req, res) => {
      const theme = String(req.body?.theme || 'Adventure').trim().slice(0, 30);
      const length = Number(req.body?.length || 5);
      const excludeWords = Array.isArray(req.body?.excludeWords)
        ? req.body.excludeWords.map((w: unknown) => String(w || ''))
        : undefined;
      const generated = await generateWordChain(theme, length, { excludeWords });
      res.json(generated);
    })
  );

  app.post(
    '/api/matches/:id/tick',
    handleApi(false, async (req, res, markDirty) => {
      const { playerId } = req.body ?? {};
      const matchId = String(req.params.id);
      const match = repo.getMatch(matchId);
      if (!match || !playerId || !match.boards[String(playerId)]) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }
      const prevClue = match.boards[String(playerId)]?.wordClues?.[match.boards[String(playerId)].currentWordIndex];
      await ensureActiveWordClue(matchId, String(playerId));
      const updated = repo.getMatch(matchId)!;
      const newClue = updated.boards[String(playerId)]?.wordClues?.[updated.boards[String(playerId)].currentWordIndex];
      if (newClue && newClue !== prevClue) {
        markDirty();
      }
      res.json(engine.sanitizeForViewer(updated, String(playerId)));
    })
  );

  app.post(
    '/api/matches/:id/guess',
    handleApi(true, async (req, res) => {
      try {
        const { playerId, guess, soloStageId } = req.body ?? {};
        if (!playerId) {
          res.status(400).json({ error: 'playerId required' });
          return;
        }
        const matchId = String(req.params.id);
        const pid = String(playerId);
        const result = engine.submitGuess(matchId, pid, String(guess || ''));
        if (!result.correct) {
          await ensureActiveWordClue(matchId, pid);
        }
        const fullMatch = repo.getMatch(matchId);
        if (fullMatch) {
          if (result.matchWon && fullMatch.mode === 'solo' && soloStageId) {
            repo.markSoloStageCompleted(pid, String(soloStageId));
          }
          result.match = engine.sanitizeForViewer(fullMatch, pid);
          const activeIdx = fullMatch.boards[pid]?.currentWordIndex ?? -1;
          if (result.revealedLetterAdded && result.match.boards[pid]?.words[activeIdx]?.clueWord) {
            result.message = 'Not quite — next letter & 1-word clue revealed!';
          }
          broadcastMatchState(fullMatch);
        }
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    })
  );

  app.post(
    '/api/matches/:id/pass',
    handleApi(true, async (req, res) => {
      try {
        const { playerId } = req.body ?? {};
        const matchId = String(req.params.id);
        engine.passTurn(matchId, String(playerId));
        await ensureActiveWordClue(matchId, String(playerId));
        const updated = repo.getMatch(matchId)!;
        broadcastMatchState(updated);
        res.json(engine.sanitizeForViewer(updated, String(playerId)));
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    })
  );

  app.post(
    '/api/matches/:id/chat',
    handleApi(true, (req, res) => {
      try {
        const { playerId, text } = req.body ?? {};
        const msg = engine.addChatMessage(String(req.params.id), String(playerId), String(text || ''));
        const fullMatch = repo.getMatch(String(req.params.id));
        if (fullMatch) {
          broadcastMatchState(fullMatch);
        }
        res.status(201).json(msg);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    })
  );

  app.post(
    '/api/matches/:id/rematch',
    handleApi(true, (req, res) => {
      try {
        const { playerId } = req.body ?? {};
        const oldMatch = repo.getMatch(String(req.params.id));
        if (!oldMatch) {
          res.status(404).json({ error: 'Match not found' });
          return;
        }
        if (!oldMatch.boards[String(playerId)]) {
          res.status(403).json({ error: 'Unauthorized' });
          return;
        }
        const officialTemplates = repo.listTemplates().filter((t) => t.status === 'official');
        const playerIds = oldMatch.turnOrder;
        const assignments = pickCuratedChainsForPlayers(
          playerIds,
          officialTemplates,
          oldMatch.rules.chainLength,
          oldMatch.mode === 'speed_race'
        );
        const newMatch = engine.createMatch({
          roomId: oldMatch.roomId,
          mode: oldMatch.mode,
          title: oldMatch.title,
          theme: oldMatch.theme,
          rules: oldMatch.rules,
          assignments,
        });
        broadcastMatchState(newMatch);
        for (const pid of playerIds) {
          queueEvent('match:rematch_created', { oldMatchId: oldMatch.id, newMatchId: newMatch.id }, pid);
        }
        res.status(201).json(engine.sanitizeForViewer(newMatch, String(playerId)));
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    })
  );

  // ==================== GRIDIT MULTIPLAYER & TRANSLATION API (NEVER TOUCHES state.json) ====================
  const handleGridItApi = (
    fn: (req: Request, res: Response) => Promise<void> | void
  ) => {
    return async (req: Request, res: Response) => {
      const origJson = res.json.bind(res);
      let capturedBody: any = undefined;
      let jsonCaptured = false;
      (res as any).json = (body: any) => {
        capturedBody = body;
        jsonCaptured = true;
        return res;
      };

      try {
        const guestTokenHeader =
          typeof req.headers['x-guest-session-token'] === 'string'
            ? req.headers['x-guest-session-token'].trim()
            : '';
        if (guestTokenHeader) {
          const gSession = await guestStore.getSessionByToken(guestTokenHeader).catch(() => null);
          if (gSession) {
            repo.registerEphemeralGuest(guestStore.toGuestProfile(gSession));
            lastSeenByPlayer.set(gSession.sessionId, Date.now());
          }
        }
        const activePid =
          (req.body?.playerId as string) ||
          (req.body?.hostId as string) ||
          (req.query?.playerId as string) ||
          (req.params?.playerId as string);
        if (activePid) {
          lastSeenByPlayer.set(String(activePid), Date.now());
          if (!repo.getProfile(String(activePid))) {
            await ensureGuestProfilesRegistered([String(activePid)]);
          }
        }

        await fn(req, res);

        if (isServerless) {
          await flushSideEffects(false);
          if (jsonCaptured && !res.headersSent) {
            origJson(capturedBody);
          }
        } else {
          if (jsonCaptured && !res.headersSent) {
            origJson(capturedBody);
          }
          flushSideEffects(false).catch(() => undefined);
        }
      } catch (err: any) {
        pendingBroadcasts = [];
        const status =
          err instanceof GridItForbiddenError || err instanceof GuessItForbiddenError
            ? 403
            : err instanceof GridItNotFoundError || err instanceof GuessItNotFoundError
              ? 404
              : err instanceof GridItBadRequestError || err instanceof GuessItBadRequestError
                ? 400
                : err instanceof GuessItRateLimitError
                  ? 429
                  : err instanceof GridItUnavailableError || err instanceof GuessItUnavailableError
                    ? 503
                    : 500;
        if (!res.headersSent) {
          res.status(status);
          origJson({ error: err?.message || 'Game module server error' });
        }
      }
    };
  };

  app.get(
    '/api/gridit/rooms/public',
    handleGridItApi(async (_req, res) => {
      res.json(await gridItEngine.listPublicRooms());
    })
  );

  app.get(
    '/api/gridit/rooms/:idOrCode',
    handleGridItApi(async (req, res) => {
      res.json(await gridItEngine.getRoom(String(req.params.idOrCode)));
    })
  );

  app.post(
    '/api/gridit/rooms',
    handleGridItApi(async (req, res) => {
      const { hostId, name, settings } = req.body ?? {};
      const room = await gridItEngine.createRoom({
        hostId: String(hostId || ''),
        name,
        settings,
      });
      queueEvent('gridit:rooms_updated', {});
      res.status(201).json(room);
    })
  );

  app.post(
    '/api/gridit/rooms/join',
    handleGridItApi(async (req, res) => {
      const { codeOrId, playerId, asSpectator } = req.body ?? {};
      const result = await gridItEngine.joinRoom(
        String(codeOrId || ''),
        String(playerId || ''),
        Boolean(asSpectator)
      );
      await broadcastGridItRoom(result.room.id, result.room);
      if (result.room.activeMatchId) {
        await broadcastGridItMatch(result.room.activeMatchId);
      }
      res.json(result);
    })
  );

  app.post(
    '/api/gridit/rooms/:id/leave',
    handleGridItApi(async (req, res) => {
      const { playerId } = req.body ?? {};
      const roomId = String(req.params.id);
      const outcome = await gridItEngine.leaveRoom(roomId, String(playerId || ''));
      if (!outcome.deleted) {
        await broadcastGridItRoom(roomId, outcome.room);
      } else {
        queueEvent('gridit:rooms_updated', {});
      }
      res.json({ ok: true });
    })
  );

  app.patch(
    '/api/gridit/rooms/:id/settings',
    handleGridItApi(async (req, res) => {
      const { playerId, settings } = req.body ?? {};
      const room = await gridItEngine.updateSettings(
        String(req.params.id),
        String(playerId || ''),
        settings
      );
      await broadcastGridItRoom(room.id, room);
      res.json(room);
    })
  );

  app.post(
    '/api/gridit/rooms/:id/ready',
    handleGridItApi(async (req, res) => {
      const { playerId, isReady } = req.body ?? {};
      const room = await gridItEngine.setReady(
        String(req.params.id),
        String(playerId || ''),
        Boolean(isReady)
      );
      await broadcastGridItRoom(room.id, room);
      res.json(room);
    })
  );

  app.post(
    '/api/gridit/rooms/:id/battle-template',
    handleGridItApi(async (req, res) => {
      const { playerId, template } = req.body ?? {};
      const room = await gridItEngine.submitBattleTemplate(
        String(req.params.id),
        String(playerId || ''),
        template
      );
      await broadcastGridItRoom(room.id, room);
      res.json(room);
    })
  );

  app.post(
    '/api/gridit/rooms/:id/chat',
    handleGridItApi(async (req, res) => {
      const { playerId, text, kind } = req.body ?? {};
      const room = await gridItEngine.sendRoomChat(
        String(req.params.id),
        String(playerId || ''),
        String(text || ''),
        kind === 'emoji' ? 'emoji' : 'chat'
      );
      await broadcastGridItRoom(room.id, room);
      res.json(room);
    })
  );

  app.post(
    '/api/gridit/rooms/:id/start',
    handleGridItApi(async (req, res) => {
      const { playerId } = req.body ?? {};
      const roomId = String(req.params.id);
      let aiHintsByPlayer: Record<string, Record<string, string> | null> | undefined;
      if (process.env.GEMINI_API_KEY) {
        const currentRoom = await gridItEngine.getRoom(roomId);
        if (currentRoom.settings.mode === 'board_battle') {
          aiHintsByPlayer = {};
          const battleTemplates = await gridItEngine.getRoomBattleTemplatesForAi(roomId);
          await Promise.all(
            Object.entries(battleTemplates).map(async ([pid, tpl]) => {
              aiHintsByPlayer![pid] = await suggestTemplateFillerLettersWithGemini(tpl);
            })
          );
        }
      }

      const { room, match } = await gridItEngine.startRoomMatch(
        roomId,
        String(playerId || ''),
        aiHintsByPlayer
      );
      await broadcastGridItRoom(room.id, room);
      const audience = gridItEngine.getMatchAudienceIdsFromRecord(match);
      for (const vid of audience) {
        queueEvent('gridit:match_started', { roomId: room.id, matchId: match.id }, vid);
      }
      await broadcastGridItMatch(match.id, match, 'full');
      res.status(201).json({
        room,
        match: gridItEngine.sanitizeMatchForViewerFromRecord(match, String(playerId || '')),
      });
    })
  );

  app.post(
    '/api/gridit/matchmaking/quick',
    handleGridItApi(async (req, res) => {
      const { playerId } = req.body ?? {};
      const outcome = await gridItEngine.joinQuickMatch(String(playerId || ''));
      if (outcome.status === 'matched' && outcome.match) {
        await broadcastGridItMatch(outcome.match.id, outcome.match, 'full');
        for (const pid of outcome.match.playerOrder) {
          queueEvent('gridit:matched', { matchId: outcome.match.id, mode: 'classic' }, pid);
        }
        res.json({
          status: 'matched',
          match: gridItEngine.sanitizeMatchForViewerFromRecord(
            outcome.match,
            String(playerId || '')
          ),
        });
        return;
      }
      res.json({ status: 'queued' });
    })
  );

  app.post(
    '/api/gridit/matchmaking/ranked',
    handleGridItApi(async (req, res) => {
      const { playerId } = req.body ?? {};
      const outcome = await gridItEngine.joinRankedQueue(String(playerId || ''));
      if (outcome.status === 'matched' && outcome.match) {
        await broadcastGridItMatch(outcome.match.id, outcome.match, 'full');
        for (const pid of outcome.match.playerOrder) {
          queueEvent('gridit:matched', { matchId: outcome.match.id, mode: 'ranked' }, pid);
        }
        res.json({
          status: 'matched',
          match: gridItEngine.sanitizeMatchForViewerFromRecord(
            outcome.match,
            String(playerId || '')
          ),
        });
        return;
      }
      res.json({ status: 'queued' });
    })
  );

  app.delete(
    '/api/gridit/matchmaking/ranked/:playerId',
    handleGridItApi(async (req, res) => {
      await gridItEngine.leaveRankedQueue(String(req.params.playerId));
      res.json({ ok: true });
    })
  );

  app.get(
    '/api/gridit/matches/:id',
    handleGridItApi(async (req, res) => {
      const playerId = String(req.query.playerId || '');
      const spectateId = req.query.spectatePlayerId ? String(req.query.spectatePlayerId) : undefined;
      res.json(
        await gridItEngine.sanitizeMatchForViewer(String(req.params.id), playerId, spectateId)
      );
    })
  );

  app.post(
    '/api/gridit/matches/:id/word',
    handleGridItApi(async (req, res) => {
      const { playerId, tilePath, preferredWord } = req.body ?? {};
      const matchId = String(req.params.id);
      const outcome = await gridItEngine.submitWord(
        matchId,
        String(playerId || ''),
        Array.isArray(tilePath) ? tilePath : [],
        preferredWord
      );
      if (outcome.validation.valid) {
        await broadcastGridItMatch(
          matchId,
          outcome.matchRecord,
          outcome.match.status === 'finished' ? 'full' : 'delta'
        );
      }
      res.json({
        validation: outcome.validation,
        match: outcome.match,
      });
    })
  );

  app.post(
    '/api/gridit/matches/:id/chat',
    handleGridItApi(async (req, res) => {
      const { playerId, text, kind } = req.body ?? {};
      const matchId = String(req.params.id);
      const msg = await gridItEngine.addMatchChat(
        matchId,
        String(playerId || ''),
        String(text || ''),
        kind === 'emoji' ? 'emoji' : 'chat'
      );
      await broadcastGridItMatch(matchId, gridItEngine.getCachedMatchRecord(matchId), 'delta');
      res.status(201).json(msg);
    })
  );

  app.post(
    '/api/gridit/matches/:id/finish',
    handleGridItApi(async (req, res) => {
      const { playerId } = req.body ?? {};
      const matchId = String(req.params.id);
      const state = await gridItEngine.finishMatchEarly(matchId, String(playerId || ''));
      await broadcastGridItMatch(matchId, gridItEngine.getCachedMatchRecord(matchId), 'full');
      if (state.roomId) await broadcastGridItRoom(state.roomId);
      res.json(state);
    })
  );

  app.post(
    '/api/gridit/matches/:id/rematch',
    handleGridItApi(async (req, res) => {
      const { playerId } = req.body ?? {};
      const next = await gridItEngine.rematch(String(req.params.id), String(playerId || ''));
      await broadcastGridItMatch(next.id, next, 'full');
      const audience = gridItEngine.getMatchAudienceIdsFromRecord(next);
      for (const vid of audience) {
        queueEvent('gridit:rematch', { oldMatchId: String(req.params.id), newMatchId: next.id }, vid);
      }
      res
        .status(201)
        .json(gridItEngine.sanitizeMatchForViewerFromRecord(next, String(playerId || '')));
    })
  );

    app.get('/api/gridit/leaderboard',
    handleGridItApi(async (_req, res) => {
      res.json({
        entries: await gridItEngine.listSessionLeaderboard(),
        guestNotice:
          'Guest sessions stay temporary and do not record permanent global GridIt ranks until ENGG account login launches.',
      });
    })
  );

  // ==================== GUESSIT MULTIPLAYER, CROSSWORD & ADVENTURE API ====================

  app.get(
    '/api/guessit/rooms/public',
    handleGridItApi(async (_req, res) => {
      res.json(await guessItEngine.listPublicRooms());
    })
  );

  app.get(
    '/api/guessit/rooms/:idOrCode',
    handleGridItApi(async (req, res) => {
      res.json(await guessItEngine.getRoom(String(req.params.idOrCode)));
    })
  );

  app.post(
    '/api/guessit/rooms',
    handleGridItApi(async (req, res) => {
      const { hostId, name, settings } = req.body ?? {};
      const room = await guessItEngine.createRoom({
        hostId: String(hostId || ''),
        name,
        settings,
      });
      queueEvent('guessit:rooms_updated', {});
      res.status(201).json(room);
    })
  );

  app.post(
    '/api/guessit/rooms/join',
    handleGridItApi(async (req, res) => {
      const { codeOrId, playerId } = req.body ?? {};
      const room = await guessItEngine.joinRoom(String(codeOrId || ''), String(playerId || ''));
      await broadcastGuessItRoom(room.id, room);
      res.json(room);
    })
  );

  app.post(
    '/api/guessit/rooms/:id/leave',
    handleGridItApi(async (req, res) => {
      const { playerId } = req.body ?? {};
      const roomId = String(req.params.id);
      const outcome = await guessItEngine.leaveRoom(roomId, String(playerId || ''));
      if (!outcome.deleted) {
        await broadcastGuessItRoom(roomId, outcome.room);
      } else {
        queueEvent('guessit:rooms_updated', {});
      }
      res.json({ ok: true });
    })
  );

  app.patch(
    '/api/guessit/rooms/:id/settings',
    handleGridItApi(async (req, res) => {
      const { playerId, settings } = req.body ?? {};
      const room = await guessItEngine.updateRoomSettings(
        String(req.params.id),
        String(playerId || ''),
        settings
      );
      await broadcastGuessItRoom(room.id, room);
      res.json(room);
    })
  );

  app.post(
    '/api/guessit/rooms/:id/ready',
    handleGridItApi(async (req, res) => {
      const { playerId, isReady } = req.body ?? {};
      const room = await guessItEngine.setPlayerReady(
        String(req.params.id),
        String(playerId || ''),
        Boolean(isReady)
      );
      await broadcastGuessItRoom(room.id, room);
      res.json(room);
    })
  );

  app.post(
    '/api/guessit/rooms/:id/team',
    handleGridItApi(async (req, res) => {
      const { playerId, teamId } = req.body ?? {};
      const room = await guessItEngine.switchTeam(
        String(req.params.id),
        String(playerId || ''),
        teamId === 'red' ? 'red' : 'blue'
      );
      await broadcastGuessItRoom(room.id, room);
      res.json(room);
    })
  );

  app.post(
    '/api/guessit/rooms/:id/duel-challenge',
    handleGridItApi(async (req, res) => {
      const { playerId, source, answer, templateId, category, difficulty, clue } = req.body ?? {};
      const room = await guessItEngine.submitDuelChallenge(
        String(req.params.id),
        String(playerId || ''),
        {
          source: source === 'my_templates' ? 'my_templates' : source === 'curated_db' ? 'curated_db' : 'custom_word',
          answer,
          templateId,
          category,
          difficulty,
          clue,
        }
      );
      await broadcastGuessItRoom(room.id, room);
      res.json(room);
    })
  );

  app.post(
    '/api/guessit/rooms/:id/chat',
    handleGridItApi(async (req, res) => {
      const { playerId, text } = req.body ?? {};
      const room = await guessItEngine.addRoomChat(
        String(req.params.id),
        String(playerId || ''),
        String(text || '')
      );
      await broadcastGuessItRoom(room.id, room);
      res.json(room);
    })
  );

  app.post(
    '/api/guessit/rooms/:id/start',
    handleGridItApi(async (req, res) => {
      const { playerId } = req.body ?? {};
      const roomId = String(req.params.id);
      const { room, matchRecord } = await guessItEngine.startRoomMatch(roomId, String(playerId || ''));
      await broadcastGuessItRoom(room.id, room);
      const audience = guessItEngine.getMatchAudienceIds(matchRecord);
      for (const vid of audience) {
        queueEvent('guessit:match_started', { roomId: room.id, matchId: matchRecord.id }, vid);
      }
      broadcastGuessItMatch(matchRecord);
      res.status(201).json({
        room,
        match: guessItEngine.sanitizeMatchForViewerRecord(matchRecord, String(playerId || '')),
      });
    })
  );

  app.post(
    '/api/guessit/matchmaking/ranked',
    handleGridItApi(async (req, res) => {
      const { playerId, mode, format } = req.body ?? {};
      const outcome = await guessItEngine.joinRankedQueue(
        String(playerId || ''),
        mode === 'precision_clash' ? 'precision_clash' : 'speed_rush',
        format === 'crossword' ? 'crossword' : 'classic'
      );
      if (outcome.status === 'matched' && outcome.match) {
        broadcastGuessItMatch(outcome.match);
        for (const pid of outcome.match.participantOrder) {
          queueEvent(
            'guessit:matched',
            { matchId: outcome.match.id, mode: outcome.match.mode },
            pid
          );
        }
        res.json({
          status: 'matched',
          match: guessItEngine.sanitizeMatchForViewerRecord(outcome.match, String(playerId || '')),
        });
        return;
      }
      res.json({ status: 'queued' });
    })
  );

  app.delete(
    '/api/guessit/matchmaking/ranked/:playerId',
    handleGridItApi(async (req, res) => {
      await guessItEngine.leaveRankedQueue(String(req.params.playerId));
      res.json({ ok: true });
    })
  );

  app.get(
    '/api/guessit/matches/:id',
    handleGridItApi(async (req, res) => {
      const playerId = String(req.query.playerId || '');
      res.json(await guessItEngine.getMatchForViewer(String(req.params.id), playerId));
    })
  );

  app.post(
    '/api/guessit/matches/:id/guess',
    handleGridItApi(async (req, res) => {
      const { playerId, letter } = req.body ?? {};
      const matchId = String(req.params.id);
      const { response, matchRecord } = await guessItEngine.submitGuess(
        matchId,
        String(playerId || ''),
        String(letter || '')
      );
      broadcastGuessItMatch(matchRecord);
      if (matchRecord.status === 'finished' && matchRecord.roomId) {
        await broadcastGuessItRoom(matchRecord.roomId);
      }
      res.json(response);
    })
  );

  app.post(
    '/api/guessit/matches/:id/chat',
    handleGridItApi(async (req, res) => {
      const { playerId, text } = req.body ?? {};
      const matchState = await guessItEngine.addMatchChat(
        String(req.params.id),
        String(playerId || ''),
        String(text || '')
      );
      queueEvent('guessit:match_state', matchState);
      res.status(201).json(matchState);
    })
  );

  app.post(
    '/api/guessit/matches/:id/rematch',
    handleGridItApi(async (req, res) => {
      const { playerId } = req.body ?? {};
      const next = await guessItEngine.rematch(String(req.params.id), String(playerId || ''));
      broadcastGuessItMatch(next);
      for (const vid of guessItEngine.getMatchAudienceIds(next)) {
        queueEvent('guessit:rematch', { oldMatchId: String(req.params.id), newMatchId: next.id }, vid);
      }
      res
        .status(201)
        .json(guessItEngine.sanitizeMatchForViewerRecord(next, String(playerId || '')));
    })
  );

  app.get(
    '/api/guessit/adventure/progress/:playerId',
    handleGridItApi(async (req, res) => {
      res.json(await guessItEngine.getAdventureProgress(String(req.params.playerId)));
    })
  );

  app.post(
    '/api/guessit/adventure/start',
    handleGridItApi(async (req, res) => {
      const { playerId, stageId } = req.body ?? {};
      const match = await guessItEngine.startAdventureStageRecord(
        String(playerId || ''),
        String(stageId || '')
      );
      res
        .status(201)
        .json(guessItEngine.sanitizeMatchForViewerRecord(match, String(playerId || '')));
    })
  );

  app.post(
    '/api/guessit/adventure/claim',
    handleGridItApi(async (req, res) => {
      const { playerId, matchId } = req.body ?? {};
      res.json(
        await guessItEngine.claimAdventureReward(String(playerId || ''), String(matchId || ''))
      );
    })
  );

  app.post(
    '/api/guessit/catalog/validate',
    handleGridItApi(async (req, res) => {
      const { answer, category, difficulty, clue, rankedEligible } = req.body ?? {};
      const entry = await guessItEngine.validateAndAddCatalogCandidate({
        answer: String(answer || ''),
        category,
        difficulty,
        clue,
        rankedEligible,
      });
      res.status(201).json(entry);
    })
  );

  app.post(
    '/api/translate',
    handleGridItApi(async (req, res) => {
      const { text, targetLang } = req.body ?? {};
      const cleanText = String(text || '').trim();
      const target = String(targetLang || 'en').trim().toLowerCase();
      if (!cleanText) {
        res.status(400).json({ error: 'Text required' });
        return;
      }
      const translateUrl = process.env.TRANSLATE_API_URL?.trim();
      if (!translateUrl) {
        res.json({
          available: false,
          translatedText: null,
          reason: 'Online translation provider is not configured on this server.',
        });
        return;
      }
      try {
        const providerRes = await fetch(translateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.TRANSLATE_API_KEY
              ? { Authorization: `Bearer ${process.env.TRANSLATE_API_KEY}` }
              : {}),
          },
          body: JSON.stringify({ q: cleanText, source: 'auto', target }),
          signal: AbortSignal.timeout(4000),
        });
        if (!providerRes.ok) throw new Error(`HTTP ${providerRes.status}`);
        const data = (await providerRes.json()) as any;
        res.json({
          available: true,
          translatedText: String(data.translatedText || cleanText),
        });
      } catch {
        res.json({
          available: false,
          translatedText: null,
          reason: 'Online translation service unreachable.',
        });
      }
    })
  );

  const prewarm = async (): Promise<void> => {
    await ensureHydrated(false);
    getServerDictionary('en');
  };

  return {
    app,
    repo,
    engine,
    gridItEngine,
    guessItEngine,
    cloudSync,
    guestStore,
    isPlayerOnline,
    broadcastMatchState,
    broadcastGridItMatch,
    broadcastGuessItMatch,
    flushSideEffects,
    processTimersAndFlush,
    prewarm,
  };
}
