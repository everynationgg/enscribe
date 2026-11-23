import crypto from 'node:crypto';
import {
  GridItCustomTemplate,
  completeBoardFromTemplate,
  validateCustomTemplate,
} from '../../../shared/gridit/editor.js';
import { DEFAULT_GRIDIT_SCORING, generatePlayableBoard } from '../../../shared/gridit/engine.js';
import {
  BoardFairnessComparison,
  BoardFairnessReport,
  analyzeBoardFairness,
  compareBoardsFairness,
  computeNormalizedScore,
} from '../../../shared/gridit/fairness.js';
import { resolveModeLanguage } from '../../../shared/gridit/languages.js';
import {
  DEFAULT_GRIDIT_MODS,
  GridItModSchedule,
  generateModSchedule,
  normalizeModConfig,
  resolveWordPathWithMods,
} from '../../../shared/gridit/mods.js';
import {
  GridItChatMessage,
  GridItMatchMode,
  GridItMatchPlayerClient,
  GridItMatchStateClient,
  GridItRoom,
  GridItRoomParticipant,
  GridItRoomSettings,
  GridItSessionLeaderboardEntry,
  GridItSpectator,
} from '../../../shared/gridit/multiplayerTypes.js';
import { GridItBoard, GridItFoundWord } from '../../../shared/gridit/types.js';
import { StorageRepository } from '../../repositories/StorageRepository.js';
import { getServerDictionary } from './serverDictionary.js';

export class GridItForbiddenError extends Error {
  status = 403;
}

export class GridItNotFoundError extends Error {
  status = 404;
}

export class GridItBadRequestError extends Error {
  status = 400;
}

interface StoredGridItRoom extends GridItRoom {
  battleTemplates: Record<string, GridItCustomTemplate>;
}

interface StoredGridItPlayerState {
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

interface StoredGridItMatch {
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

const SHAKE_WINDOW_MS = 2300;
const UNTIMED_MAX_MS = 30 * 60 * 1000;

export class GridItEngine {
  private rooms = new Map<string, StoredGridItRoom>();
  private matches = new Map<string, StoredGridItMatch>();
  private quickQueue: string[] = [];
  private rankedQueue: string[] = [];
  private sessionStats = new Map<string, GridItSessionLeaderboardEntry>();

  constructor(
    private repo: StorageRepository,
    private isPlayerOnline: (playerId: string) => boolean
  ) {}

  private requireProfile(playerId: string) {
    const p = this.repo.getProfile(playerId);
    if (!p) throw new GridItNotFoundError('Active player session not found.');
    return p;
  }

  private createRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 25; attempt++) {
      let code = 'G';
      for (let i = 0; i < 5; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      const conflict = Array.from(this.rooms.values()).some((r) => r.code === code);
      if (!conflict) return code;
    }
    return `G${crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5)}`;
  }

  private normalizeSettings(
    partial?: Partial<GridItRoomSettings> | null,
    existing?: GridItRoomSettings
  ): GridItRoomSettings {
    const mode: GridItMatchMode = partial?.mode ?? existing?.mode ?? 'classic';
    const baseLang = partial?.language ?? existing?.language ?? 'en';
    const langRes = resolveModeLanguage(baseLang, mode);
    const capacity = Math.max(2, Math.min(6, Math.round(partial?.capacity ?? existing?.capacity ?? 2)));
    const durationSeconds = Math.max(
      0,
      Math.min(600, Math.round(partial?.durationSeconds ?? existing?.durationSeconds ?? 120))
    );

    return {
      mode,
      shapeId: partial?.shapeId ?? existing?.shapeId ?? 'heart',
      sizeId: partial?.sizeId ?? existing?.sizeId ?? 'medium',
      durationSeconds,
      language: langRes.language,
      capacity,
      isPublic: partial?.isPublic ?? existing?.isPublic ?? true,
      allowSpectators:
        mode === 'ranked' ? false : Boolean(partial?.allowSpectators ?? existing?.allowSpectators ?? true),
      mods: normalizeModConfig(partial?.mods ?? existing?.mods ?? DEFAULT_GRIDIT_MODS),
    };
  }

  private toPublicRoom(room: StoredGridItRoom): GridItRoom {
    const players: GridItRoomParticipant[] = room.players.map((p) => ({
      ...p,
      isOnline: this.isPlayerOnline(p.playerId),
    }));
    const { battleTemplates: _secret, ...safe } = room;
    return { ...safe, players };
  }

  public listPublicRooms(): GridItRoom[] {
    return Array.from(this.rooms.values())
      .filter((r) => r.settings.isPublic && r.status !== 'finished')
      .map((r) => this.toPublicRoom(r))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public getRoom(idOrCode: string): GridItRoom {
    const clean = idOrCode.trim().toUpperCase();
    for (const r of this.rooms.values()) {
      if (r.id === idOrCode || r.code === clean) {
        return this.toPublicRoom(r);
      }
    }
    throw new GridItNotFoundError('GridIt room not found.');
  }

  public createRoom(params: {
    hostId: string;
    name?: string;
    settings?: Partial<GridItRoomSettings>;
  }): GridItRoom {
    const host = this.requireProfile(params.hostId);
    const settings = this.normalizeSettings(params.settings);
    const now = Date.now();
    const id = `gr_room_${now}_${crypto.randomBytes(3).toString('hex')}`;
    const room: StoredGridItRoom = {
      id,
      code: this.createRoomCode(),
      name: (params.name || `${host.username}'s GridIt Arena`).trim().slice(0, 42),
      hostId: host.id,
      status: 'waiting',
      settings,
      players: [
        {
          playerId: host.id,
          username: host.username,
          avatarId: host.avatarId,
          isReady: false,
          isHost: true,
          isOnline: true,
          battleTemplateReady: false,
          battleTemplateSummary: null,
        },
      ],
      spectators: [],
      messages: [],
      activeMatchId: null,
      battleTemplates: {},
      createdAt: now,
      updatedAt: now,
    };
    this.rooms.set(id, room);
    return this.toPublicRoom(room);
  }

  public joinRoom(
    codeOrId: string,
    playerId: string,
    asSpectator = false
  ): { room: GridItRoom; joinedAs: 'player' | 'spectator' } {
    const profile = this.requireProfile(playerId);
    const clean = codeOrId.trim().toUpperCase();
    const room = Array.from(this.rooms.values()).find(
      (r) => r.id === codeOrId || r.code === clean
    );
    if (!room) throw new GridItNotFoundError('GridIt room not found.');

    const isExistingPlayer = room.players.some((p) => p.playerId === profile.id);
    if (isExistingPlayer) {
      room.updatedAt = Date.now();
      return { room: this.toPublicRoom(room), joinedAs: 'player' };
    }

    if (asSpectator || room.status === 'in_progress') {
      if (!room.settings.allowSpectators) {
        throw new GridItForbiddenError('Spectators are disabled by the host for this room.');
      }
      if (!room.spectators.some((s) => s.playerId === profile.id)) {
        room.spectators.push({
          playerId: profile.id,
          username: profile.username,
          avatarId: profile.avatarId,
          joinedAt: Date.now(),
        });
      }
      // Keep active match spectator list synchronized if live
      if (room.activeMatchId) {
        const activeMatch = this.matches.get(room.activeMatchId);
        if (activeMatch && !activeMatch.spectators.some((s) => s.playerId === profile.id)) {
          activeMatch.spectators.push({
            playerId: profile.id,
            username: profile.username,
            avatarId: profile.avatarId,
            joinedAt: Date.now(),
          });
        }
      }
      room.updatedAt = Date.now();
      return { room: this.toPublicRoom(room), joinedAs: 'spectator' };
    }

    if (room.players.length >= room.settings.capacity) {
      throw new GridItBadRequestError('Room is at full player capacity.');
    }

    room.spectators = room.spectators.filter((s) => s.playerId !== profile.id);
    room.players.push({
      playerId: profile.id,
      username: profile.username,
      avatarId: profile.avatarId,
      isReady: false,
      isHost: false,
      isOnline: true,
      battleTemplateReady: false,
      battleTemplateSummary: null,
    });
    room.updatedAt = Date.now();
    return { room: this.toPublicRoom(room), joinedAs: 'player' };
  }

  public leaveRoom(roomId: string, playerId: string): { deleted: boolean; room?: GridItRoom } {
    const room = this.rooms.get(roomId);
    if (!room) throw new GridItNotFoundError('Room not found.');
    room.players = room.players.filter((p) => p.playerId !== playerId);
    room.spectators = room.spectators.filter((s) => s.playerId !== playerId);
    delete room.battleTemplates[playerId];

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return { deleted: true };
    }
    if (!room.players.some((p) => p.playerId === room.hostId)) {
      room.hostId = room.players[0].playerId;
      room.players.forEach((p, i) => {
        p.isHost = i === 0;
      });
    }
    room.updatedAt = Date.now();
    return { deleted: false, room: this.toPublicRoom(room) };
  }

  public updateSettings(
    roomId: string,
    playerId: string,
    partial: Partial<GridItRoomSettings>
  ): GridItRoom {
    const room = this.rooms.get(roomId);
    if (!room) throw new GridItNotFoundError('Room not found.');
    if (room.hostId !== playerId) {
      throw new GridItForbiddenError('Only the host can update room settings.');
    }
    room.settings = this.normalizeSettings(partial, room.settings);
    if (!room.settings.allowSpectators) {
      room.spectators = [];
    }
    for (const p of room.players) {
      p.isReady = false;
    }
    room.updatedAt = Date.now();
    return this.toPublicRoom(room);
  }

  public setReady(roomId: string, playerId: string, isReady: boolean): GridItRoom {
    const room = this.rooms.get(roomId);
    if (!room) throw new GridItNotFoundError('Room not found.');
    const participant = room.players.find((p) => p.playerId === playerId);
    if (!participant) {
      throw new GridItForbiddenError('Spectators cannot toggle ready state or play.');
    }
    participant.isReady = Boolean(isReady);
    room.updatedAt = Date.now();
    return this.toPublicRoom(room);
  }

  public submitBattleTemplate(
    roomId: string,
    playerId: string,
    template: GridItCustomTemplate
  ): GridItRoom {
    const room = this.rooms.get(roomId);
    if (!room) throw new GridItNotFoundError('Room not found.');
    const participant = room.players.find((p) => p.playerId === playerId);
    if (!participant) {
      throw new GridItForbiddenError('Only active players in this room can submit a Battle Board.');
    }

    const dict = getServerDictionary(template.language || room.settings.language);
    const validation = validateCustomTemplate(template, dict.words);
    if (!validation.valid) {
      throw new GridItBadRequestError(validation.errors[0] || 'Template failed board validation.');
    }

    // Store full custom template PRIVATELY on server so opponents never see it before reveal
    const preview = completeBoardFromTemplate(template, {
      seed: 42,
      dictionary: dict.words,
      prefixSet: dict.prefixes,
      stripAuthoredFlag: true,
    });

    room.battleTemplates[playerId] = template;
    participant.battleTemplateReady = true;
    participant.isReady = true;
    participant.battleTemplateSummary = {
      name: template.name,
      shapeId: template.shapeId,
      sizeId: template.sizeId,
      wordCount: template.authoredWords.length,
      fairnessGrade: preview.fairness.grade,
    };
    room.updatedAt = Date.now();
    return this.toPublicRoom(room);
  }

  public sendRoomChat(
    roomId: string,
    playerId: string,
    text: string,
    kind: 'chat' | 'emoji' = 'chat'
  ): GridItRoom {
    const room = this.rooms.get(roomId);
    if (!room) throw new GridItNotFoundError('Room not found.');
    const player = room.players.find((p) => p.playerId === playerId);
    const spectator = room.spectators.find((s) => s.playerId === playerId);
    if (!player && !spectator) {
      throw new GridItForbiddenError('You must be in this room to send messages.');
    }
    const clean = text.trim().slice(0, 260);
    if (!clean) throw new GridItBadRequestError('Message cannot be empty.');

    const sender = player ?? spectator!;
    room.messages.push({
      id: `gmsg_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
      senderId: sender.playerId,
      senderName: player ? player.username : `${sender.username} (Spectator)`,
      senderAvatar: sender.avatarId,
      text: clean,
      kind,
      createdAt: Date.now(),
    });
    if (room.messages.length > 80) room.messages = room.messages.slice(-80);
    room.updatedAt = Date.now();
    return this.toPublicRoom(room);
  }

  public startRoomMatch(
    roomId: string,
    requesterId: string,
    aiHintsByPlayer?: Record<string, Record<string, string> | null>
  ): { room: GridItRoom; match: StoredGridItMatch } {
    const room = this.rooms.get(roomId);
    if (!room) throw new GridItNotFoundError('Room not found.');
    if (room.hostId !== requesterId) {
      throw new GridItForbiddenError('Only the room host can start the match.');
    }
    if (room.players.length < 2) {
      throw new GridItBadRequestError('At least 2 players are required to start a multiplayer match.');
    }
    if (room.settings.mode === 'board_battle') {
      const missing = room.players.filter((p) => !room.battleTemplates[p.playerId]);
      if (missing.length > 0) {
        throw new GridItBadRequestError(
          `Waiting for battle boards from: ${missing.map((m) => m.username).join(', ')}.`
        );
      }
    }

    const match = this.buildStoredMatch({
      roomId: room.id,
      mode: room.settings.mode,
      settings: room.settings,
      participants: room.players.map((p) => ({
        playerId: p.playerId,
        username: p.username,
        avatarId: p.avatarId,
      })),
      spectators: [...room.spectators],
      battleTemplates: room.battleTemplates,
      aiHintsByPlayer,
    });

    this.matches.set(match.id, match);
    room.status = 'in_progress';
    room.activeMatchId = match.id;
    room.updatedAt = Date.now();
    return { room: this.toPublicRoom(room), match };
  }

  private buildStoredMatch(params: {
    roomId: string | null;
    mode: GridItMatchMode;
    settings: GridItRoomSettings;
    participants: Array<{ playerId: string; username: string; avatarId: string }>;
    spectators: GridItSpectator[];
    battleTemplates?: Record<string, GridItCustomTemplate>;
    aiHintsByPlayer?: Record<string, Record<string, string> | null>;
  }): StoredGridItMatch {
    const now = Date.now();
    const seed = Math.floor(Math.random() * 0x7fffffff);
    const revealAtMs = now + 250;
    const startedAtMs = revealAtMs + SHAKE_WINDOW_MS;
    const durMs =
      params.settings.durationSeconds > 0 ? params.settings.durationSeconds * 1000 : UNTIMED_MAX_MS;
    const endsAtMs = startedAtMs + durMs;
    const dict = getServerDictionary(params.settings.language);
    const matchId = `gmatch_${now}_${crypto.randomBytes(3).toString('hex')}`;

    const playersState: Record<string, StoredGridItPlayerState> = {};
    let fairnessComparison: BoardFairnessComparison | null = null;

    if (params.mode === 'board_battle' && params.battleTemplates) {
      const n = params.participants.length;
      const completedByAuthor: Record<
        string,
        { board: GridItBoard; fairness: BoardFairnessReport; authorName: string }
      > = {};

      params.participants.forEach((p, idx) => {
        const tpl = params.battleTemplates![p.playerId];
        const res = completeBoardFromTemplate(tpl, {
          seed: seed + idx * 7919,
          dictionary: dict.words,
          prefixSet: dict.prefixes,
          aiSuggestedLetters: params.aiHintsByPlayer?.[p.playerId] ?? undefined,
          stripAuthoredFlag: true,
        });
        completedByAuthor[p.playerId] = {
          board: res.board,
          fairness: res.fairness,
          authorName: p.username,
        };
      });

      // Strict derangement: player i plays the board crafted by participant (i + 1) % n
      params.participants.forEach((p, idx) => {
        const sourcePlayer = params.participants[(idx + 1) % n];
        const assigned = completedByAuthor[sourcePlayer.playerId];
        const schedule = generateModSchedule(
          assigned.board,
          params.settings.durationSeconds,
          params.settings.mods,
          seed + idx * 3571,
          startedAtMs
        );
        playersState[p.playerId] = {
          playerId: p.playerId,
          username: p.username,
          avatarId: p.avatarId,
          rawScore: 0,
          normalizedScorePercent: 0,
          foundWords: [],
          bestWord: null,
          comboCount: 0,
          lastWordAtMs: null,
          assignedBoard: assigned.board,
          assignedFairness: assigned.fairness,
          schedule,
          authoredById: sourcePlayer.playerId,
          authoredByName: sourcePlayer.username,
          quotaValidationPassed: true,
        };
      });

      if (params.participants.length >= 2) {
        const p0 = params.participants[0].playerId;
        const p1 = params.participants[1].playerId;
        fairnessComparison = compareBoardsFairness(
          playersState[p0].assignedBoard,
          playersState[p1].assignedBoard,
          dict.words,
          dict.prefixes
        );
      }
    } else {
      const sharedBoard = generatePlayableBoard(
        params.settings.shapeId,
        params.settings.sizeId,
        {
          seed,
          language: params.settings.language,
          dictionary: dict.words,
          prefixSet: dict.prefixes,
        }
      );
      const sharedFairness = analyzeBoardFairness(sharedBoard, dict.words, dict.prefixes);
      const sharedSchedule = generateModSchedule(
        sharedBoard,
        params.settings.durationSeconds,
        params.settings.mods,
        seed,
        startedAtMs
      );

      for (const p of params.participants) {
        playersState[p.playerId] = {
          playerId: p.playerId,
          username: p.username,
          avatarId: p.avatarId,
          rawScore: 0,
          normalizedScorePercent: 0,
          foundWords: [],
          bestWord: null,
          comboCount: 0,
          lastWordAtMs: null,
          assignedBoard: sharedBoard,
          assignedFairness: sharedFairness,
          schedule: sharedSchedule,
          authoredById: null,
          authoredByName: null,
          quotaValidationPassed: true,
        };
      }
    }

    return {
      id: matchId,
      roomId: params.roomId,
      mode: params.mode,
      settings: { ...params.settings },
      status: 'shaking',
      revealAtMs,
      startedAtMs,
      endsAtMs,
      seed,
      players: playersState,
      playerOrder: params.participants.map((p) => p.playerId),
      spectators: params.spectators,
      winnerIds: [],
      fairnessComparison,
      messages: [],
      finalizedStats: false,
      battleTemplatesSnapshot: params.battleTemplates
        ? { ...params.battleTemplates }
        : undefined,
      createdAt: now,
    };
  }

  public joinQuickMatch(playerId: string): {
    status: 'queued' | 'matched';
    room?: GridItRoom;
    match?: StoredGridItMatch;
  } {
    const p = this.requireProfile(playerId);
    if (!this.quickQueue.includes(p.id)) this.quickQueue.push(p.id);
    this.quickQueue = this.quickQueue.filter((id) => this.repo.getProfile(id));
    if (this.quickQueue.length < 2) {
      return { status: 'queued' };
    }
    const [p1Id, p2Id] = this.quickQueue.splice(0, 2);
    const p1 = this.requireProfile(p1Id);
    const p2 = this.requireProfile(p2Id);
    const settings = this.normalizeSettings({
      mode: 'classic',
      shapeId: 'heart',
      sizeId: 'medium',
      durationSeconds: 120,
      isPublic: false,
      allowSpectators: true,
    });
    const match = this.buildStoredMatch({
      roomId: null,
      mode: 'classic',
      settings,
      participants: [
        { playerId: p1.id, username: p1.username, avatarId: p1.avatarId },
        { playerId: p2.id, username: p2.username, avatarId: p2.avatarId },
      ],
      spectators: [],
    });
    this.matches.set(match.id, match);
    return { status: 'matched', match };
  }

  public joinRankedQueue(playerId: string): {
    status: 'queued' | 'matched';
    match?: StoredGridItMatch;
  } {
    const p = this.requireProfile(playerId);
    if (!this.rankedQueue.includes(p.id)) this.rankedQueue.push(p.id);
    this.rankedQueue = this.rankedQueue.filter((id) => this.repo.getProfile(id));
    if (this.rankedQueue.length < 2) {
      return { status: 'queued' };
    }
    const [p1Id, p2Id] = this.rankedQueue.splice(0, 2);
    const p1 = this.requireProfile(p1Id);
    const p2 = this.requireProfile(p2Id);
    // Standardized Ranked rules: fixed English dictionary, balanced non-custom board, mods off
    const settings = this.normalizeSettings({
      mode: 'ranked',
      shapeId: 'square',
      sizeId: 'medium',
      durationSeconds: 120,
      language: 'en',
      isPublic: false,
      allowSpectators: false,
      mods: { ...DEFAULT_GRIDIT_MODS },
    });
    const match = this.buildStoredMatch({
      roomId: null,
      mode: 'ranked',
      settings,
      participants: [
        { playerId: p1.id, username: p1.username, avatarId: p1.avatarId },
        { playerId: p2.id, username: p2.username, avatarId: p2.avatarId },
      ],
      spectators: [],
    });
    this.matches.set(match.id, match);
    return { status: 'matched', match };
  }

  public leaveRankedQueue(playerId: string): void {
    this.rankedQueue = this.rankedQueue.filter((id) => id !== playerId);
  }

  private syncMatchLifecycle(match: StoredGridItMatch, nowMs = Date.now()): void {
    if (nowMs >= match.endsAtMs) {
      if (match.status !== 'finished') {
        match.status = 'finished';
        this.finalizeWinners(match);
      }
      return;
    }
    if (nowMs >= match.startedAtMs) {
      match.status = 'active';
    } else {
      match.status = 'shaking';
    }
  }

  private finalizeWinners(match: StoredGridItMatch): void {
    const list = Object.values(match.players);
    if (list.length === 0) return;

    const sorted = [...list].sort((a, b) => {
      if (match.mode === 'board_battle') {
        // Board Battle ranks by fair normalized % first, then raw score tiebreaker
        if (Math.abs(b.normalizedScorePercent - a.normalizedScorePercent) > 0.05) {
          return b.normalizedScorePercent - a.normalizedScorePercent;
        }
      }
      if (b.rawScore !== a.rawScore) return b.rawScore - a.rawScore;
      return b.foundWords.length - a.foundWords.length;
    });

    const top = sorted[0];
    if (top.rawScore <= 0 && match.mode !== 'board_battle') {
      match.winnerIds = sorted
        .filter((p) => p.rawScore === top.rawScore && p.foundWords.length === top.foundWords.length)
        .map((p) => p.playerId);
    } else {
      match.winnerIds = sorted
        .filter((p) =>
          match.mode === 'board_battle'
            ? Math.abs(p.normalizedScorePercent - top.normalizedScorePercent) <= 0.05 &&
              p.rawScore === top.rawScore
            : p.rawScore === top.rawScore
        )
        .map((p) => p.playerId);
    }

    if (match.roomId) {
      const room = this.rooms.get(match.roomId);
      if (room) {
        room.status = 'waiting';
        room.activeMatchId = null;
        for (const rp of room.players) rp.isReady = false;
        room.updatedAt = Date.now();
      }
    }

    if (!match.finalizedStats) {
      match.finalizedStats = true;
      for (const p of list) {
        const profile = this.repo.getProfile(p.playerId);
        const isGuest = Boolean(profile?.isGuest || p.playerId.startsWith('guest_'));
        const prev = this.sessionStats.get(p.playerId) ?? {
          playerId: p.playerId,
          username: p.username,
          avatarId: p.avatarId,
          matchesPlayed: 0,
          wins: 0,
          highScore: 0,
          bestWord: null,
          isGuest,
        };
        const didWin = match.winnerIds.includes(p.playerId) && list.length > 1;
        this.sessionStats.set(p.playerId, {
          ...prev,
          username: p.username,
          avatarId: p.avatarId,
          matchesPlayed: prev.matchesPlayed + 1,
          wins: prev.wins + (didWin ? 1 : 0),
          highScore: Math.max(prev.highScore, p.rawScore),
          bestWord:
            p.bestWord && (!prev.bestWord || p.bestWord.word.length >= prev.bestWord.length)
              ? p.bestWord.word
              : prev.bestWord,
        });
      }
    }
  }

  public submitWord(
    matchId: string,
    playerId: string,
    tilePath: string[],
    preferredWord?: string
  ) {
    const match = this.matches.get(matchId);
    if (!match) throw new GridItNotFoundError('GridIt match not found.');
    const playerState = match.players[playerId];
    if (!playerState) {
      throw new GridItForbiddenError('Read-only spectators cannot submit words.');
    }

    const nowMs = Date.now();
    this.syncMatchLifecycle(match, nowMs);

    if (match.status === 'shaking') {
      throw new GridItBadRequestError('Wait for dice shake to settle before submitting words.');
    }
    if (match.status === 'finished') {
      throw new GridItBadRequestError('Match timer has finished.');
    }

    const dict = getServerDictionary(match.settings.language);
    const already = new Set(playerState.foundWords.map((w) => w.word));
    const validation = resolveWordPathWithMods(
      playerState.assignedBoard,
      tilePath,
      dict.words,
      already,
      {
        nowMs,
        schedule: playerState.schedule,
        modConfig: match.settings.mods,
        comboCount: playerState.comboCount,
        lastWordAtMs: playerState.lastWordAtMs,
        preferredWord,
        scoringConfig: DEFAULT_GRIDIT_SCORING,
      }
    );

    if (validation.valid) {
      const entry: GridItFoundWord = {
        word: validation.word,
        tilePath: [...tilePath],
        points: validation.finalPoints,
        foundAtMs: nowMs,
      };
      playerState.foundWords.unshift(entry);
      playerState.rawScore += validation.finalPoints;
      playerState.normalizedScorePercent = computeNormalizedScore(
        playerState.rawScore,
        playerState.assignedFairness.maxScorePotential
      );
      playerState.comboCount = validation.nextComboCount;
      playerState.lastWordAtMs = nowMs;
      if (
        !playerState.bestWord ||
        entry.points > playerState.bestWord.points ||
        (entry.points === playerState.bestWord.points &&
          entry.word.length > playerState.bestWord.word.length)
      ) {
        playerState.bestWord = entry;
      }
    }

    return {
      validation,
      match: this.sanitizeMatchForViewer(matchId, playerId),
    };
  }

  public addMatchChat(
    matchId: string,
    playerId: string,
    text: string,
    kind: 'chat' | 'emoji' = 'chat'
  ): GridItChatMessage {
    const match = this.matches.get(matchId);
    if (!match) throw new GridItNotFoundError('GridIt match not found.');
    const player = match.players[playerId];
    const spectator = match.spectators.find((s) => s.playerId === playerId);
    if (!player && !spectator) {
      throw new GridItForbiddenError('Only match participants or spectators can send reactions.');
    }
    const clean = text.trim().slice(0, 220);
    if (!clean) throw new GridItBadRequestError('Empty message.');
    const sender = player ?? spectator!;
    const msg: GridItChatMessage = {
      id: `gmmsg_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
      senderId: sender.playerId,
      senderName: player ? player.username : `${sender.username} (Spectator)`,
      senderAvatar: sender.avatarId,
      text: clean,
      kind,
      createdAt: Date.now(),
    };
    match.messages.push(msg);
    if (match.messages.length > 80) match.messages = match.messages.slice(-80);
    return msg;
  }

  public finishMatchEarly(matchId: string, requesterId: string): GridItMatchStateClient {
    const match = this.matches.get(matchId);
    if (!match) throw new GridItNotFoundError('GridIt match not found.');
    if (!match.players[requesterId]) {
      throw new GridItForbiddenError('Only match participants can end the match.');
    }
    match.status = 'finished';
    match.endsAtMs = Math.min(match.endsAtMs, Date.now());
    this.finalizeWinners(match);
    return this.sanitizeMatchForViewer(matchId, requesterId);
  }

  public rematch(matchId: string, requesterId: string): StoredGridItMatch {
    const old = this.matches.get(matchId);
    if (!old) throw new GridItNotFoundError('Previous match not found.');
    if (!old.players[requesterId]) {
      throw new GridItForbiddenError('Only match participants can start a rematch.');
    }
    const next = this.buildStoredMatch({
      roomId: old.roomId,
      mode: old.mode,
      settings: old.settings,
      participants: old.playerOrder.map((pid) => ({
        playerId: pid,
        username: old.players[pid].username,
        avatarId: old.players[pid].avatarId,
      })),
      spectators: [...old.spectators],
      battleTemplates: old.battleTemplatesSnapshot,
    });
    this.matches.set(next.id, next);
    if (old.roomId) {
      const room = this.rooms.get(old.roomId);
      if (room) {
        room.status = 'in_progress';
        room.activeMatchId = next.id;
        room.updatedAt = Date.now();
      }
    }
    return next;
  }

  public getMatchAudienceIds(matchId: string): string[] {
    const match = this.matches.get(matchId);
    if (!match) return [];
    return [
      ...match.playerOrder,
      ...match.spectators.map((s) => s.playerId),
    ];
  }

  public sanitizeMatchForViewer(
    matchId: string,
    viewerId: string,
    spectatePlayerId?: string
  ): GridItMatchStateClient {
    const match = this.matches.get(matchId);
    if (!match) throw new GridItNotFoundError('GridIt match not found.');

    const nowMs = Date.now();
    this.syncMatchLifecycle(match, nowMs);

    const isPlayer = Boolean(match.players[viewerId]);
    const isSpectator =
      match.settings.allowSpectators &&
      match.spectators.some((s) => s.playerId === viewerId);

    if (!isPlayer && !isSpectator) {
      throw new GridItForbiddenError('Access denied: not a participant or spectator.');
    }

    const viewerRole = isPlayer ? 'player' : 'spectator';
    const targetPlayerId = isPlayer
      ? viewerId
      : spectatePlayerId && match.players[spectatePlayerId]
        ? spectatePlayerId
        : match.playerOrder[0];

    // Anti-cheat: strictly never reveal board before revealAtMs, and only send viewer's assigned board
    const canRevealBoard = nowMs >= match.revealAtMs;
    const targetState = match.players[targetPlayerId];

    const clientPlayers: Record<string, GridItMatchPlayerClient> = {};
    for (const pid of match.playerOrder) {
      const ps = match.players[pid];
      clientPlayers[pid] = {
        playerId: ps.playerId,
        username: ps.username,
        avatarId: ps.avatarId,
        isOnline: this.isPlayerOnline(ps.playerId),
        score: ps.rawScore,
        rawScore: ps.rawScore,
        normalizedScorePercent: ps.normalizedScorePercent,
        wordsFoundCount: ps.foundWords.length,
        bestWord: ps.bestWord,
        comboCount: ps.comboCount,
        isWinner: match.winnerIds.includes(ps.playerId),
        // Hide detailed word list from opponents until match finishes
        foundWords:
          pid === viewerId || match.status === 'finished' || viewerRole === 'spectator'
            ? ps.foundWords
            : [],
        assignedBoardFairness:
          pid === viewerId || match.status === 'finished' ? ps.assignedFairness : null,
        authoredByName: ps.authoredByName ?? null,
        quotaValidationPassed: ps.quotaValidationPassed ?? true,
      };
    }

    return {
      id: match.id,
      roomId: match.roomId,
      mode: match.mode,
      status: match.status,
      settings: match.settings,
      serverNowMs: nowMs,
      revealAtMs: match.revealAtMs,
      startedAtMs: match.startedAtMs,
      endsAtMs: match.endsAtMs,
      viewerRole,
      spectatingPlayerId: viewerRole === 'spectator' ? targetPlayerId : null,
      board: canRevealBoard ? targetState.assignedBoard : null,
      schedule: canRevealBoard ? targetState.schedule : null,
      players: clientPlayers,
      spectators: match.spectators,
      winnerIds: match.winnerIds,
      fairnessComparison: match.status === 'finished' ? match.fairnessComparison : null,
      messages: match.messages,
    };
  }

  public processExpiredMatches(): StoredGridItMatch[] {
    const nowMs = Date.now();
    const transitioned: StoredGridItMatch[] = [];
    for (const match of this.matches.values()) {
      if (match.status !== 'finished' && nowMs >= match.endsAtMs) {
        this.syncMatchLifecycle(match, nowMs);
        transitioned.push(match);
      }
    }
    return transitioned;
  }

  public listSessionLeaderboard(): GridItSessionLeaderboardEntry[] {
    return Array.from(this.sessionStats.values()).sort(
      (a, b) => b.highScore - a.highScore || b.wins - a.wins
    );
  }
}
