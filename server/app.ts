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
import { ChainClashEngine } from './games/chain-clash/ChainClashEngine.js';
import {
  AssignedPuzzle,
  assignCustomPuzzlesDeranged,
  pickCuratedChainsForPlayers,
  validateChainWords,
} from './games/chain-clash/puzzleAssignment.js';
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
  isSocketOnline?: (playerId: string) => boolean;
}

export interface EnscribeBackendRuntime {
  app: Express;
  repo: MemoryStorageRepository;
  engine: ChainClashEngine;
  cloudSync: SupabaseCloudSync;
  isPlayerOnline: (playerId: string) => boolean;
  broadcastMatchState: (match: StoredMatch) => void;
  flushSideEffects: (persistSnapshot?: boolean) => Promise<void>;
  processTimersAndFlush: () => Promise<StoredMatch[]>;
}

export function createEnscribeApp(hooks: LocalRealtimeHooks = {}): EnscribeBackendRuntime {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const repo = new MemoryStorageRepository();
  const cloudSync = new SupabaseCloudSync();
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
  const isServerless = Boolean(process.env.VERCEL);

  const loadLocalFileIfExists = (): MemorySnapshot | null => {
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
        const maxAge = forceRefresh ? 300 : 1500;
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

  const flushSideEffects = async (persistSnapshot = false): Promise<void> => {
    const events = [...pendingBroadcasts];
    pendingBroadcasts = [];
    if (persistSnapshot) {
      const snapshot = repo.toSnapshot();
      lastCloudSyncAt = Date.now();
      if (cloudSync.isConfigured()) {
        await cloudSync.saveSnapshot(snapshot);
      } else {
        saveLocalFileIfUnconfigured(snapshot);
      }
    }
    if (events.length > 0 && cloudSync.isConfigured()) {
      await cloudSync.broadcastRealtime(events);
    }
  };

  const queueEvent = (event: string, payload: any, targetPlayerId?: string) => {
    pendingBroadcasts.push({ event, payload, targetPlayerId });
    if (targetPlayerId) {
      hooks.emitPlayer?.(targetPlayerId, event, payload);
    } else {
      hooks.emitGlobal?.(event, payload);
    }
  };

  const broadcastRoomUpdate = (roomId: string): void => {
    const room = repo.getRoomById(roomId);
    if (!room) return;
    pendingBroadcasts.push({ event: 'room:updated', payload: room });
    pendingBroadcasts.push({ event: 'rooms:public_updated', payload: {} });
    hooks.emitRoom?.(roomId, 'room:updated', room);
    hooks.emitGlobal?.('rooms:public_updated');
  };

  const broadcastMatchState = (match: StoredMatch): void => {
    for (const pid of Object.keys(match.boards)) {
      const sanitized = engine.sanitizeForViewer(match, pid);
      queueEvent('match:state', sanitized, pid);
    }
  };

  const processTimersAndFlush = async (): Promise<StoredMatch[]> => {
    if (!initialized) return [];
    const updatedMatches = engine.processExpiredTimers();
    if (updatedMatches.length > 0) {
      for (const m of updatedMatches) {
        broadcastMatchState(m);
      }
      await flushSideEffects(true);
    }
    return updatedMatches;
  };

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
    fn: (req: Request, res: Response) => Promise<void> | void
  ) => {
    return (req: Request, res: Response) => {
      const runRequest = async () => {
        const origJson = res.json.bind(res);
        let capturedBody: any = undefined;
        let jsonCaptured = false;
        (res as any).json = (body: any) => {
          capturedBody = body;
          jsonCaptured = true;
          return res;
        };

        try {
          const activePid =
            (req.body?.playerId as string) ||
            (req.body?.hostId as string) ||
            (req.body?.ownerId as string) ||
            (req.query?.playerId as string) ||
            (req.params?.playerId as string);
          if (activePid) {
            lastSeenByPlayer.set(String(activePid), Date.now());
          }

          await ensureHydrated(mutating);
          const expired = engine.processExpiredTimers();
          for (const m of expired) {
            broadcastMatchState(m);
          }

          await fn(req, res);

          const shouldPersist = mutating || expired.length > 0;
          await flushSideEffects(shouldPersist);

          if (jsonCaptured && !res.headersSent) {
            origJson(capturedBody);
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
      games: getRegisteredGames(),
      serverNowMs: Date.now(),
    });
  });

  app.post(
    '/api/dev/reset-seed',
    handleApi(true, (_req, res) => {
      repo.clearAll();
      seedInitialData(repo);
      res.json({ ok: true });
    })
  );

  app.get(
    '/api/games',
    handleApi(false, (_req, res) => {
      res.json(getRegisteredGames());
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
    handleApi(false, (_req, res) => {
      res.json(repo.listPublicRooms());
    })
  );

  app.get(
    '/api/rooms/:id',
    handleApi(false, (req, res) => {
      const idOrCode = String(req.params.id);
      const room = repo.getRoomById(idOrCode) ?? repo.getRoomByCode(idOrCode);
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      res.json(room);
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
        pendingBroadcasts.push({
          event: 'room:match_started',
          payload: { roomId: room.id, matchId: match.id },
        });
        hooks.emitRoom?.(room.id, 'room:match_started', { roomId: room.id, matchId: match.id });
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
          repo.upsertRoomPlayer(target.id, String(playerId), {
            isReady: true,
            puzzleStatus: 'ready',
            submittedTemplateId: 'tpl_official_fantasy_1',
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
    handleApi(true, (req, res) => {
      const { playerId } = req.body ?? {};
      const profile = repo.getProfile(String(playerId));
      if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

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
          autoRevealAfterAttempts: 0,
          autoRevealAfterPasses: 0,
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
      const { playerId, stageId, templateId } = req.body ?? {};
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
            words: [...tpl.words],
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
    handleApi(true, (req, res) => {
      const playerId = String(req.query.playerId || '');
      const match = repo.getMatch(String(req.params.id));
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

      const wasAwaiting = match.turnAwaitingOnline;
      const activated = engine.activateAwaitingTurnIfOnline(match.id, playerId) ?? match;
      const sanitized = engine.sanitizeForViewer(activated, playerId);
      if (wasAwaiting && !activated.turnAwaitingOnline) {
        broadcastMatchState(activated);
      }
      res.json(sanitized);
    })
  );

  app.post(
    '/api/matches/:id/tick',
    handleApi(true, (req, res) => {
      const { playerId } = req.body ?? {};
      const match = repo.getMatch(String(req.params.id));
      if (!match || !playerId || !match.boards[String(playerId)]) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }
      res.json(engine.sanitizeForViewer(match, String(playerId)));
    })
  );

  app.post(
    '/api/matches/:id/guess',
    handleApi(true, (req, res) => {
      try {
        const { playerId, guess, soloStageId } = req.body ?? {};
        if (!playerId) {
          res.status(400).json({ error: 'playerId required' });
          return;
        }
        const result = engine.submitGuess(String(req.params.id), String(playerId), String(guess || ''));
        const fullMatch = repo.getMatch(String(req.params.id));
        if (fullMatch) {
          if (result.matchWon && fullMatch.mode === 'solo' && soloStageId) {
            repo.markSoloStageCompleted(String(playerId), String(soloStageId));
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
    handleApi(true, (req, res) => {
      try {
        const { playerId } = req.body ?? {};
        const updated = engine.passTurn(String(req.params.id), String(playerId));
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

  return {
    app,
    repo,
    engine,
    cloudSync,
    isPlayerOnline,
    broadcastMatchState,
    flushSideEffects,
    processTimersAndFlush,
  };
}
