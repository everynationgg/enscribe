import crypto from 'node:crypto';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import {
  OngoingMatchSummary,
  Profile,
  Room,
  RoomRules,
  SoloStage,
  Template,
} from '../shared/types.js';
import { getDatabase } from './db/sqlite.js';
import { SqliteStorageRepository, StoredMatch } from './repositories/StorageRepository.js';
import { DEFAULT_ROOM_RULES, SOLO_STAGES_CATALOG, seedInitialData } from './db/seed.js';
import { getRegisteredGames } from './platform/GameRegistry.js';
import { ChainClashEngine } from './games/chain-clash/ChainClashEngine.js';
import {
  AssignedPuzzle,
  assignCustomPuzzlesDeranged,
  pickCuratedChainsForPlayers,
  validateChainWords,
} from './games/chain-clash/puzzleAssignment.js';

const PORT = Number(process.env.PORT || 3001);

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const db = getDatabase();
const repo = new SqliteStorageRepository(db);
const onlineSocketsByPlayer = new Map<string, Set<string>>();

function isPlayerOnline(playerId: string): boolean {
  const set = onlineSocketsByPlayer.get(playerId);
  return Boolean(set && set.size > 0);
}

repo.setOnlineTracker(isPlayerOnline);
seedInitialData(repo);

const engine = new ChainClashEngine(repo, isPlayerOnline);

// In-memory Quick Play / Ranked queues
const quickPlayQueue = new Set<string>();
const rankedQueue = new Set<string>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function broadcastRoomUpdate(roomId: string): void {
  const room = repo.getRoomById(roomId);
  if (!room) return;
  io.to(`room:${roomId}`).emit('room:updated', room);
  io.emit('rooms:public_updated');
}

function broadcastMatchState(match: StoredMatch): void {
  for (const pid of Object.keys(match.boards)) {
    const sanitized = engine.sanitizeForViewer(match, pid);
    io.to(`player:${pid}`).emit('match:state', sanitized);
  }
}

function buildAssignmentsForRoom(room: Room): AssignedPuzzle[] {
  const submissions = repo.getRoomPlayerSubmissions(room.id);
  const officialTemplates = repo.listTemplates().filter((t) => t.status === 'official');
  const playerIds = room.players.map((p) => p.playerId);

  if (playerIds.length < 2) {
    throw new Error('At least 2 players are required to start a multiplayer match.');
  }

  if (room.rules.puzzleSource === 'curated_db') {
    return pickCuratedChainsForPlayers(
      playerIds,
      officialTemplates,
      room.rules.chainLength,
      room.rules.mode === 'speed_race'
    );
  }

  // Speed Race with player templates: pick one participant or non-competing chain?
  // Spec: "Player-created puzzles must never be assigned to their own creator. Use approved database puzzles or a chain prepared by someone who is not competing."
  if (room.rules.mode === 'speed_race') {
    return pickCuratedChainsForPlayers(
      playerIds,
      officialTemplates,
      room.rules.chainLength,
      true
    );
  }

  // Custom / Saved Template Classic Mode: every player must have a valid playable puzzle!
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

// Authoritative 250ms timer loop
setInterval(() => {
  try {
    const updatedMatches = engine.processExpiredTimers();
    for (const match of updatedMatches) {
      broadcastMatchState(match);
    }
  } catch (err) {
    console.error('[TimerLoop] Error processing timers:', err);
  }
}, 250);

// ==================== REST API ====================

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, platform: 'Enscribe', games: getRegisteredGames(), serverNowMs: Date.now() });
});

app.post('/api/dev/reset-seed', (_req, res) => {
  repo.runInTransaction(() => {
    db.exec(`
      DELETE FROM match_messages;
      DELETE FROM match_boards;
      DELETE FROM matches;
      DELETE FROM room_messages;
      DELETE FROM room_players;
      DELETE FROM rooms;
      DELETE FROM templates;
      DELETE FROM notifications;
      DELETE FROM points_events;
      DELETE FROM solo_progress;
      DELETE FROM profiles;
    `);
  });
  seedInitialData(repo);
  res.json({ ok: true });
});

app.get('/api/games', (_req, res) => {
  res.json(getRegisteredGames());
});

// Profiles
app.get('/api/profiles', (_req, res) => {
  res.json(repo.listProfiles());
});

app.get('/api/profiles/:id', (req, res) => {
  const profile = repo.getProfile(req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  const history = repo.listMatchHistory(profile.id);
  res.json({ profile, history });
});

app.post('/api/profiles', (req, res) => {
  try {
    const { username, avatarId } = req.body ?? {};
    const cleanName = String(username || '').trim().slice(0, 20);
    if (!cleanName) return res.status(400).json({ error: 'Username is required' });
    const profile: Profile = {
      id: `player_${crypto.randomUUID().slice(0, 8)}`,
      username: cleanName,
      avatarId: String(avatarId || 'alex'),
      rankTier: 'Silver II',
      rankPoints: 1000,
      wins: 0,
      losses: 0,
      matchPointsBalance: 100,
      equippedCosmetics: {
        tileSkin: 'classic_cream',
        boardSkin: 'royal_cosmos',
        backgroundTheme: 'deep_blue',
        chatBubbleStyle: 'frost_pill',
      },
      createdAt: Date.now(),
    };
    const saved = repo.upsertProfile(profile);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/profiles/:id/cosmetics', (req, res) => {
  const updated = repo.updateCosmetics(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Profile not found' });
  res.json(updated);
});

app.patch('/api/profiles/:id', (req, res) => {
  const current = repo.getProfile(req.params.id);
  if (!current) return res.status(404).json({ error: 'Profile not found' });
  const username = req.body.username ? String(req.body.username).trim().slice(0, 20) : current.username;
  const avatarId = req.body.avatarId ? String(req.body.avatarId) : current.avatarId;
  const updated = repo.upsertProfile({ ...current, username, avatarId });
  res.json(updated);
});

// Notifications
app.get('/api/notifications/:playerId', (req, res) => {
  res.json(repo.listNotifications(req.params.playerId));
});

app.post('/api/notifications/:playerId/read', (req, res) => {
  repo.markNotificationsRead(req.params.playerId);
  res.json({ ok: true });
});

// Templates
app.get('/api/templates', (req, res) => {
  const ownerId = req.query.ownerId ? String(req.query.ownerId) : undefined;
  res.json(repo.listTemplates(ownerId));
});

app.post('/api/templates', (req, res) => {
  try {
    const { id, ownerId, name, theme, thumbnailKey, words, status } = req.body ?? {};
    const cleanName = String(name || 'Untitled Chain').trim().slice(0, 40);
    const cleanTheme = String(theme || 'Custom').trim().slice(0, 30);
    const cleanStatus = status === 'draft' ? 'draft' : 'saved';
    const rawWords: string[] = Array.isArray(words) ? words : [];

    // Drafts allow saving work-in-progress, while 'saved' templates validate word rules
    let normalizedWords: string[];
    if (cleanStatus === 'saved') {
      const check = validateChainWords(rawWords);
      if (!check.valid) {
        return res.status(400).json({ error: check.error });
      }
      normalizedWords = check.normalized;
    } else {
      normalizedWords = rawWords.map((w) => String(w || '').trim().toUpperCase()).filter(Boolean);
    }

    const existing = id ? repo.getTemplate(id) : null;
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
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/templates/:id/duplicate', (req, res) => {
  const source = repo.getTemplate(req.params.id);
  if (!source) return res.status(404).json({ error: 'Template not found' });
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
});

app.delete('/api/templates/:id', (req, res) => {
  const tpl = repo.getTemplate(req.params.id);
  if (!tpl) return res.status(404).json({ error: 'Template not found' });
  if (tpl.status === 'official') return res.status(403).json({ error: 'Cannot delete official templates' });
  repo.deleteTemplate(req.params.id);
  res.json({ ok: true });
});

// Rooms
app.get('/api/rooms/public', (_req, res) => {
  res.json(repo.listPublicRooms());
});

app.get('/api/rooms/:id', (req, res) => {
  const room = repo.getRoomById(req.params.id) ?? repo.getRoomByCode(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});

app.post('/api/rooms', (req, res) => {
  try {
    const { hostId, name, isPublic, rules } = req.body ?? {};
    if (!hostId || !repo.getProfile(hostId)) {
      return res.status(400).json({ error: 'Valid hostId is required' });
    }
    const mergedRules: RoomRules = {
      ...DEFAULT_ROOM_RULES,
      ...(rules || {}),
      gameType: 'chain_clash',
    };
    const room = repo.runInTransaction(() => {
      let code = generateRoomCode();
      while (repo.getRoomByCode(code)) {
        code = generateRoomCode();
      }
      return repo.createRoom({
        id: `room_${crypto.randomUUID().slice(0, 10)}`,
        code,
        name: String(name || (isPublic ? 'Public Room' : 'Private Room')).trim().slice(0, 36),
        hostId,
        isPublic: Boolean(isPublic),
        rules: mergedRules,
        createdAt: Date.now(),
      });
    });
    io.emit('rooms:public_updated');
    res.status(201).json(room);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/rooms/join', (req, res) => {
  try {
    const { codeOrId, playerId } = req.body ?? {};
    if (!playerId || !repo.getProfile(playerId)) {
      return res.status(400).json({ error: 'Valid playerId is required' });
    }
    const room = repo.getRoomByCode(String(codeOrId || '')) ?? repo.getRoomById(String(codeOrId || ''));
    if (!room) return res.status(404).json({ error: 'Room not found. Check the share code.' });

    const alreadyInRoom = room.players.some((p) => p.playerId === playerId);
    if (room.status !== 'lobby' && !alreadyInRoom) {
      return res.status(403).json({ error: 'Match already in progress. New players cannot join an ongoing match.' });
    }
    if (!alreadyInRoom && room.players.length >= room.rules.maxPlayers) {
      return res.status(409).json({ error: 'Room is full.' });
    }

    if (!alreadyInRoom) {
      repo.upsertRoomPlayer(room.id, playerId, { isReady: false, puzzleStatus: 'none' });
    }
    const updated = repo.getRoomById(room.id)!;
    broadcastRoomUpdate(room.id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/rooms/:id/leave', (req, res) => {
  const { playerId } = req.body ?? {};
  const room = repo.getRoomById(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  repo.removeRoomPlayer(room.id, playerId);
  const refreshed = repo.getRoomById(room.id);
  if (refreshed && refreshed.players.length === 0 && !refreshed.id.startsWith('room_demo')) {
    repo.deleteRoom(room.id);
    io.emit('rooms:public_updated');
  } else {
    broadcastRoomUpdate(room.id);
  }
  res.json({ ok: true });
});

app.patch('/api/rooms/:id/rules', (req, res) => {
  const { playerId, rules } = req.body ?? {};
  const room = repo.getRoomById(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.hostId !== playerId) {
    return res.status(403).json({ error: 'Only the room host can modify rules.' });
  }
  const updatedRules: RoomRules = { ...room.rules, ...rules, gameType: 'chain_clash' };
  repo.updateRoomRules(room.id, updatedRules);
  const refreshed = repo.getRoomById(room.id)!;
  broadcastRoomUpdate(room.id);
  res.json(refreshed);
});

app.post('/api/rooms/:id/puzzle', (req, res) => {
  try {
    const { playerId, templateId, customWords, puzzleStatus } = req.body ?? {};
    const room = repo.getRoomById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.players.some((p) => p.playerId === playerId)) {
      return res.status(403).json({ error: 'You are not in this room.' });
    }

    let validatedCustomWords: string[] | null = null;
    if (Array.isArray(customWords) && customWords.length > 0) {
      const check = validateChainWords(customWords);
      if (!check.valid) return res.status(400).json({ error: check.error });
      validatedCustomWords = check.normalized;
    }

    repo.upsertRoomPlayer(room.id, playerId, {
      puzzleStatus: puzzleStatus ?? (templateId || validatedCustomWords ? 'ready' : 'creating'),
      submittedTemplateId: templateId ?? null,
      submittedWords: validatedCustomWords,
    });
    const refreshed = repo.getRoomById(room.id)!;
    broadcastRoomUpdate(room.id);
    res.json(refreshed);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/rooms/:id/ready', (req, res) => {
  const { playerId, isReady } = req.body ?? {};
  const room = repo.getRoomById(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!room.players.some((p) => p.playerId === playerId)) {
    return res.status(403).json({ error: 'You are not in this room.' });
  }
  repo.upsertRoomPlayer(room.id, playerId, { isReady: Boolean(isReady) });
  const refreshed = repo.getRoomById(room.id)!;
  broadcastRoomUpdate(room.id);
  res.json(refreshed);
});

app.post('/api/rooms/:id/chat', (req, res) => {
  const { playerId, text } = req.body ?? {};
  const room = repo.getRoomById(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const profile = repo.getProfile(playerId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  const cleanText = String(text || '').trim().slice(0, 300);
  if (!cleanText) return res.status(400).json({ error: 'Message cannot be empty' });

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
});

app.post('/api/rooms/:id/start', (req, res) => {
  try {
    const { playerId } = req.body ?? {};
    const room = repo.getRoomById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.hostId !== playerId) {
      return res.status(403).json({ error: 'Only the host can start the match.' });
    }
    if (room.status === 'in_progress' && room.activeMatchId) {
      const existing = repo.getMatch(room.activeMatchId);
      if (existing) {
        return res.json({ room, match: engine.sanitizeForViewer(existing, playerId) });
      }
    }

    // Host can force-start even if someone hasn't clicked Ready,
    // PROVIDED every participant has a playable puzzle assigned!
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
    io.to(`room:${room.id}`).emit('room:match_started', {
      roomId: room.id,
      matchId: match.id,
    });
    broadcastRoomUpdate(room.id);
    broadcastMatchState(match);

    res.status(201).json({
      room: refreshedRoom,
      match: engine.sanitizeForViewer(match, playerId),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Quick Play & Ranked Matchmaking
app.post('/api/matchmaking/quick-play', (req, res) => {
  try {
    const { playerId } = req.body ?? {};
    const profile = repo.getProfile(playerId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    // Look for an open quick-play public room waiting for players
    const publicRooms = repo.listPublicRooms().filter(
      (r) =>
        r.status === 'lobby' &&
        r.players.length < r.rules.maxPlayers &&
        (r.players.some((p) => p.playerId === playerId) || r.players.length >= 1)
    );

    if (publicRooms.length > 0) {
      const target = publicRooms[0];
      if (!target.players.some((p) => p.playerId === playerId)) {
        repo.upsertRoomPlayer(target.id, playerId, {
          isReady: true,
          puzzleStatus: 'ready',
          submittedTemplateId: 'tpl_official_fantasy_1',
        });
      }
      const updated = repo.getRoomById(target.id)!;
      broadcastRoomUpdate(target.id);
      return res.json({ status: 'joined_room', room: updated });
    }

    // Otherwise create an open public Quick Play room
    let code = generateRoomCode();
    while (repo.getRoomByCode(code)) code = generateRoomCode();
    const room = repo.createRoom({
      id: `room_${crypto.randomUUID().slice(0, 10)}`,
      code,
      name: `${profile.username}'s Quick Match`,
      hostId: playerId,
      isPublic: true,
      rules: {
        ...DEFAULT_ROOM_RULES,
        maxPlayers: 2,
        puzzleSource: 'curated_db',
      },
      createdAt: Date.now(),
    });
    repo.upsertRoomPlayer(room.id, playerId, { isReady: true, puzzleStatus: 'ready' });
    io.emit('rooms:public_updated');
    return res.status(201).json({ status: 'created_room', room: repo.getRoomById(room.id) });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/matchmaking/ranked', (req, res) => {
  try {
    const { playerId } = req.body ?? {};
    const profile = repo.getProfile(playerId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    // Check if another player with comparable RP is waiting in rankedQueue
    const waitingCandidates = Array.from(rankedQueue)
      .filter((pid) => pid !== playerId && repo.getProfile(pid))
      .sort((a, b) => {
        const pa = repo.getProfile(a)!;
        const pb = repo.getProfile(b)!;
        return Math.abs(pa.rankPoints - profile.rankPoints) - Math.abs(pb.rankPoints - profile.rankPoints);
      });

    if (waitingCandidates.length > 0) {
      const opponentId = waitingCandidates[0];
      rankedQueue.delete(opponentId);
      rankedQueue.delete(playerId);

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
      const assignments = pickCuratedChainsForPlayers([opponentId, playerId], officialTemplates, 5, false);
      const match = engine.createMatch({
        roomId: null,
        mode: 'ranked',
        title: 'Ranked Match',
        rules: rankedRules,
        assignments,
      });
      broadcastMatchState(match);
      io.to(`player:${opponentId}`).emit('matchmaking:ranked_matched', { matchId: match.id });
      return res.status(201).json({ status: 'matched', matchId: match.id });
    }

    rankedQueue.add(playerId);
    return res.json({
      status: 'queued',
      queueSize: rankedQueue.size,
      message: 'Searching for a ranked opponent with comparable RP...',
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/matchmaking/ranked/:playerId', (req, res) => {
  rankedQueue.delete(req.params.playerId);
  res.json({ ok: true });
});

// Solo Adventure
app.get('/api/solo/stages/:playerId', (req, res) => {
  const completed = new Set(repo.getCompletedSoloStages(req.params.playerId));
  const stages: SoloStage[] = SOLO_STAGES_CATALOG.map((s) => ({
    ...s,
    completed: completed.has(s.id),
  }));
  res.json(stages);
});

app.post('/api/solo/start', (req, res) => {
  try {
    const { playerId, stageId, templateId } = req.body ?? {};
    const profile = repo.getProfile(playerId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const stage = stageId ? SOLO_STAGES_CATALOG.find((s) => s.id === stageId) : null;
    const tplId = templateId ?? stage?.templateId;
    const tpl = tplId ? repo.getTemplate(tplId) : null;
    if (!tpl) return res.status(404).json({ error: 'Puzzle template not found' });

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
          recipientPlayerId: playerId,
          authorPlayerId: null,
          words: [...tpl.words],
        },
      ],
    });
    res.status(201).json({
      stageId: stage?.id ?? null,
      match: engine.sanitizeForViewer(match, playerId),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Matches
app.get('/api/matches/ongoing/:playerId', (req, res) => {
  const playerId = req.params.playerId;
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
});

app.get('/api/matches/:id', (req, res) => {
  const playerId = String(req.query.playerId || '');
  const match = repo.getMatch(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  // Reject unauthorized player attempting to enter an ongoing or completed match
  if (!playerId || !match.boards[playerId]) {
    return res.status(403).json({
      error: 'Access denied: you are not a participant in this match.',
    });
  }

  // Activate awaiting turn timer if this player just opened/reconnected on their turn
  const activated = engine.activateAwaitingTurnIfOnline(match.id, playerId) ?? match;
  const sanitized = engine.sanitizeForViewer(activated, playerId);
  broadcastMatchState(activated);
  res.json(sanitized);
});

app.post('/api/matches/:id/guess', (req, res) => {
  try {
    const { playerId, guess, soloStageId } = req.body ?? {};
    if (!playerId) return res.status(400).json({ error: 'playerId required' });
    const result = engine.submitGuess(req.params.id, playerId, String(guess || ''));
    const fullMatch = repo.getMatch(req.params.id);
    if (fullMatch) {
      if (result.matchWon && fullMatch.mode === 'solo' && soloStageId) {
        repo.markSoloStageCompleted(playerId, String(soloStageId));
      }
      broadcastMatchState(fullMatch);
    }
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/matches/:id/pass', (req, res) => {
  try {
    const { playerId } = req.body ?? {};
    const updated = engine.passTurn(req.params.id, playerId);
    broadcastMatchState(updated);
    res.json(engine.sanitizeForViewer(updated, playerId));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/matches/:id/chat', (req, res) => {
  try {
    const { playerId, text } = req.body ?? {};
    const msg = engine.addChatMessage(req.params.id, playerId, String(text || ''));
    const fullMatch = repo.getMatch(req.params.id);
    if (fullMatch) {
      broadcastMatchState(fullMatch);
    }
    res.status(201).json(msg);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/matches/:id/rematch', (req, res) => {
  try {
    const { playerId } = req.body ?? {};
    const oldMatch = repo.getMatch(req.params.id);
    if (!oldMatch) return res.status(404).json({ error: 'Match not found' });
    if (!oldMatch.boards[playerId]) {
      return res.status(403).json({ error: 'Unauthorized' });
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
      io.to(`player:${pid}`).emit('match:rematch_created', {
        oldMatchId: oldMatch.id,
        newMatchId: newMatch.id,
      });
    }
    res.status(201).json(engine.sanitizeForViewer(newMatch, playerId));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==================== SOCKET.IO REALTIME ====================

io.on('connection', (socket) => {
  let boundPlayerId: string | null = null;

  socket.on('auth:identify', (playerId: string) => {
    if (!playerId || !repo.getProfile(playerId)) return;
    if (boundPlayerId && onlineSocketsByPlayer.has(boundPlayerId)) {
      onlineSocketsByPlayer.get(boundPlayerId)!.delete(socket.id);
      socket.leave(`player:${boundPlayerId}`);
    }
    boundPlayerId = playerId;
    if (!onlineSocketsByPlayer.has(playerId)) {
      onlineSocketsByPlayer.set(playerId, new Set());
    }
    onlineSocketsByPlayer.get(playerId)!.add(socket.id);
    socket.join(`player:${playerId}`);
  });

  socket.on('room:join_channel', (roomId: string) => {
    socket.join(`room:${roomId}`);
  });

  socket.on('room:leave_channel', (roomId: string) => {
    socket.leave(`room:${roomId}`);
  });

  socket.on('match:join_channel', ({ matchId, playerId }: { matchId: string; playerId: string }) => {
    const match = repo.getMatch(matchId);
    if (!match || !match.boards[playerId]) {
      socket.emit('match:error', { error: 'Access denied: not a participant in this match.' });
      return;
    }
    socket.join(`match:${matchId}`);
    const activated = engine.activateAwaitingTurnIfOnline(matchId, playerId) ?? match;
    socket.emit('match:state', engine.sanitizeForViewer(activated, playerId));
    broadcastMatchState(activated);
  });

  socket.on('match:typing', ({ matchId, playerId, preview }: { matchId: string; playerId: string; preview: string }) => {
    const updated = engine.updateLiveInputPreview(matchId, playerId, preview ?? '');
    if (updated) {
      broadcastMatchState(updated);
    }
  });

  socket.on('disconnect', () => {
    if (boundPlayerId && onlineSocketsByPlayer.has(boundPlayerId)) {
      const set = onlineSocketsByPlayer.get(boundPlayerId)!;
      set.delete(socket.id);
      if (set.size === 0) {
        onlineSocketsByPlayer.delete(boundPlayerId);
        rankedQueue.delete(boundPlayerId);
      }
    }
  });
});

httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`Enscribe authoritative backend listening on http://localhost:${PORT}`);
});
