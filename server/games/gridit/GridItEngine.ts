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
  generateModSchedule,
  normalizeModConfig,
  resolveWordPathWithMods,
} from '../../../shared/gridit/mods.js';
import {
  GridItChatMessage,
  GridItMatchDelta,
  GridItMatchMode,
  GridItMatchPlayerClient,
  GridItMatchPlayerDeltaSummary,
  GridItMatchStateClient,
  GridItRoom,
  GridItRoomParticipant,
  GridItRoomSettings,
  GridItSessionLeaderboardEntry,
  GridItSpectator,
} from '../../../shared/gridit/multiplayerTypes.js';
import { GridItBoard, GridItFoundWord, Profile } from '../../../shared/types.js';
import { StorageRepository } from '../../repositories/StorageRepository.js';
import {
  GridItStateStore,
  StoredGridItMatch,
  StoredGridItPlayerState,
  StoredGridItRoom,
} from './GridItStateStore.js';
import { getServerDictionary, getServerWordSet } from './serverDictionary.js';

export class GridItForbiddenError extends Error {
  status = 403;
}

export class GridItNotFoundError extends Error {
  status = 404;
}

export class GridItBadRequestError extends Error {
  status = 400;
}

const SHAKE_WINDOW_MS = 2300;
const UNTIMED_MAX_MS = 30 * 60 * 1000;

export class GridItEngine {
  private store: GridItStateStore;
  private resolveProfileFn?: (playerId: string) => Promise<Profile | null>;
  private recentMatches = new Map<string, StoredGridItMatch>();

  private rememberMatch(match: StoredGridItMatch): void {
    if (this.recentMatches.size >= 50 && !this.recentMatches.has(match.id)) {
      const oldest = this.recentMatches.keys().next().value;
      if (oldest) this.recentMatches.delete(oldest);
    }
    this.recentMatches.set(match.id, match);
  }

  getCachedMatchRecord(matchId: string): StoredGridItMatch | null {
    return this.recentMatches.get(matchId) ?? null;
  }

  constructor(
    private repo: StorageRepository,
    private isPlayerOnline: (playerId: string) => boolean,
    options: {
      forceLocalMemory?: boolean;
      isServerless?: boolean;
      resolveProfile?: (playerId: string) => Promise<Profile | null>;
    } = {}
  ) {
    this.store = new GridItStateStore({
      forceLocalMemory: options.forceLocalMemory,
      isServerless: options.isServerless,
    });
    this.resolveProfileFn = options.resolveProfile;
  }

  private async requireProfile(playerId: string): Promise<Profile> {
    const cached = this.repo.getProfile(playerId);
    if (cached) return cached;
    if (this.resolveProfileFn) {
      const resolved = await this.resolveProfileFn(playerId);
      if (resolved) return resolved;
    }
    throw new GridItNotFoundError('Active player session not found.');
  }

  private createRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'G';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
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
        mode === 'ranked'
          ? false
          : Boolean(partial?.allowSpectators ?? existing?.allowSpectators ?? true),
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

  async listPublicRooms(): Promise<GridItRoom[]> {
    return this.store.listPublicRooms();
  }

  async getRoom(idOrCode: string): Promise<GridItRoom> {
    const room = await this.store.getRoom(idOrCode);
    if (!room) throw new GridItNotFoundError('GridIt room not found.');
    return this.toPublicRoom(room);
  }

  async getRoomBattleTemplatesForAi(
    roomId: string
  ): Promise<Record<string, GridItCustomTemplate>> {
    const room = await this.store.getRoom(roomId);
    return room?.battleTemplates ?? {};
  }

  async createRoom(params: {
    hostId: string;
    name?: string;
    settings?: Partial<GridItRoomSettings>;
  }): Promise<GridItRoom> {
    const host = await this.requireProfile(params.hostId);
    const settings = this.normalizeSettings(params.settings);
    const now = Date.now();

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.createRoomCode();
      const existing = await this.store.getRoom(code);
      if (existing) continue;

      const id = `gr_room_${now}_${crypto.randomBytes(3).toString('hex')}`;
      const room: StoredGridItRoom = {
        id,
        code,
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
      await this.store.insertRoom(room);
      return this.toPublicRoom(room);
    }

    throw new GridItBadRequestError('Could not allocate unique room code; please retry.');
  }

  async joinRoom(
    codeOrId: string,
    playerId: string,
    asSpectator = false
  ): Promise<{ room: GridItRoom; joinedAs: 'player' | 'spectator' }> {
    const profile = await this.requireProfile(playerId);

    const outcome = await this.store.mutateRoom<{
      room: GridItRoom;
      joinedAs: 'player' | 'spectator';
      activeMatchId: string | null;
    }>(codeOrId, (room) => {
      const isExistingPlayer = room.players.some((p) => p.playerId === profile.id);
      if (isExistingPlayer) {
        room.updatedAt = Date.now();
        return {
          result: {
            room: this.toPublicRoom(room),
            joinedAs: 'player' as const,
            activeMatchId: null as string | null,
          },
        };
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
        room.updatedAt = Date.now();
        return {
          result: {
            room: this.toPublicRoom(room),
            joinedAs: 'spectator' as const,
            activeMatchId: room.activeMatchId,
          },
        };
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
      return {
        result: {
          room: this.toPublicRoom(room),
          joinedAs: 'player' as const,
          activeMatchId: null as string | null,
        },
      };
    });

    if (!outcome) throw new GridItNotFoundError('GridIt room not found.');

    if (outcome.activeMatchId && outcome.joinedAs === 'spectator') {
      await this.store.mutateMatch(outcome.activeMatchId, (match) => {
        if (!match.spectators.some((s) => s.playerId === profile.id)) {
          match.spectators.push({
            playerId: profile.id,
            username: profile.username,
            avatarId: profile.avatarId,
            joinedAt: Date.now(),
          });
        }
      });
    }

    return { room: outcome.room, joinedAs: outcome.joinedAs };
  }

  async leaveRoom(
    roomId: string,
    playerId: string
  ): Promise<{ deleted: boolean; room?: GridItRoom }> {
    const res = await this.store.mutateRoom<{ deleted: boolean; room?: GridItRoom }>(
      roomId,
      (room) => {
      room.players = room.players.filter((p) => p.playerId !== playerId);
      room.spectators = room.spectators.filter((s) => s.playerId !== playerId);
      delete room.battleTemplates[playerId];

      if (room.players.length === 0) {
        return { result: { deleted: true }, deleteRoom: true };
      }
      if (!room.players.some((p) => p.playerId === room.hostId)) {
        room.hostId = room.players[0].playerId;
        room.players.forEach((p, i) => {
          p.isHost = i === 0;
        });
      }
      room.updatedAt = Date.now();
      return { result: { deleted: false, room: this.toPublicRoom(room) } };
    });

    if (!res) throw new GridItNotFoundError('Room not found.');
    return res;
  }

  async updateSettings(
    roomId: string,
    playerId: string,
    partial: Partial<GridItRoomSettings>
  ): Promise<GridItRoom> {
    const updated = await this.store.mutateRoom(roomId, (room) => {
      if (room.hostId !== playerId) {
        throw new GridItForbiddenError('Only the host can update room settings.');
      }
      room.settings = this.normalizeSettings(partial, room.settings);
      if (!room.settings.allowSpectators) {
        room.spectators = [];
      }
      for (const p of room.players) p.isReady = false;
      room.updatedAt = Date.now();
      return { result: this.toPublicRoom(room) };
    });
    if (!updated) throw new GridItNotFoundError('Room not found.');
    return updated;
  }

  async setReady(roomId: string, playerId: string, isReady: boolean): Promise<GridItRoom> {
    const updated = await this.store.mutateRoom(roomId, (room) => {
      const participant = room.players.find((p) => p.playerId === playerId);
      if (!participant) {
        throw new GridItForbiddenError('Spectators cannot toggle ready state or play.');
      }
      participant.isReady = Boolean(isReady);
      room.updatedAt = Date.now();
      return { result: this.toPublicRoom(room) };
    });
    if (!updated) throw new GridItNotFoundError('Room not found.');
    return updated;
  }

  async submitBattleTemplate(
    roomId: string,
    playerId: string,
    template: GridItCustomTemplate
  ): Promise<GridItRoom> {
    const dict = getServerDictionary(template.language || 'en');
    const validation = validateCustomTemplate(template, dict.words);
    if (!validation.valid) {
      throw new GridItBadRequestError(
        validation.errors[0] || 'Template failed board validation.'
      );
    }

    const preview = completeBoardFromTemplate(template, {
      seed: 42,
      dictionary: dict.words,
      prefixSet: dict.prefixes,
      stripAuthoredFlag: true,
    });

    const updated = await this.store.mutateRoom(roomId, (room) => {
      const participant = room.players.find((p) => p.playerId === playerId);
      if (!participant) {
        throw new GridItForbiddenError(
          'Only active players in this room can submit a Battle Board.'
        );
      }
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
      return { result: this.toPublicRoom(room) };
    });

    if (!updated) throw new GridItNotFoundError('Room not found.');
    return updated;
  }

  async sendRoomChat(
    roomId: string,
    playerId: string,
    text: string,
    kind: 'chat' | 'emoji' = 'chat'
  ): Promise<GridItRoom> {
    const clean = text.trim().slice(0, 260);
    if (!clean) throw new GridItBadRequestError('Message cannot be empty.');

    const updated = await this.store.mutateRoom(roomId, (room) => {
      const player = room.players.find((p) => p.playerId === playerId);
      const spectator = room.spectators.find((s) => s.playerId === playerId);
      if (!player && !spectator) {
        throw new GridItForbiddenError('You must be in this room to send messages.');
      }
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
      return { result: this.toPublicRoom(room) };
    });

    if (!updated) throw new GridItNotFoundError('Room not found.');
    return updated;
  }

  async startRoomMatch(
    roomId: string,
    requesterId: string,
    aiHintsByPlayer?: Record<string, Record<string, string> | null>
  ): Promise<{ room: GridItRoom; match: StoredGridItMatch }> {
    const room = await this.store.getRoom(roomId);
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

    await this.store.insertMatch(match);
    this.rememberMatch(match);

    const updatedRoom = await this.store.mutateRoom(room.id, (r) => {
      r.status = 'in_progress';
      r.activeMatchId = match.id;
      r.updatedAt = Date.now();
      return { result: this.toPublicRoom(r) };
    });

    return { room: updatedRoom ?? this.toPublicRoom(room), match };
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
      params.settings.durationSeconds > 0
        ? params.settings.durationSeconds * 1000
        : UNTIMED_MAX_MS;
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

  async joinQuickMatch(playerId: string): Promise<{
    status: 'queued' | 'matched';
    match?: StoredGridItMatch;
  }> {
    const p1 = await this.requireProfile(playerId);
    const pair = await this.store.dequeuePair('quick', p1.id);
    if (!pair.matched || !pair.opponentId) {
      return { status: 'queued' };
    }
    const p2 = await this.requireProfile(pair.opponentId).catch(() => null);
    if (!p2) {
      await this.store.dequeuePair('quick', p1.id);
      return { status: 'queued' };
    }

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
    await this.store.insertMatch(match);
    this.rememberMatch(match);
    return { status: 'matched', match };
  }

  async joinRankedQueue(playerId: string): Promise<{
    status: 'queued' | 'matched';
    match?: StoredGridItMatch;
  }> {
    const p1 = await this.requireProfile(playerId);
    const pair = await this.store.dequeuePair('ranked', p1.id);
    if (!pair.matched || !pair.opponentId) {
      return { status: 'queued' };
    }
    const p2 = await this.requireProfile(pair.opponentId).catch(() => null);
    if (!p2) {
      await this.store.dequeuePair('ranked', p1.id);
      return { status: 'queued' };
    }

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
    await this.store.insertMatch(match);
    this.rememberMatch(match);
    return { status: 'matched', match };
  }

  async leaveRankedQueue(playerId: string): Promise<void> {
    await this.store.removeFromQueue('ranked', playerId);
  }

  private applyMatchLifecycle(match: StoredGridItMatch, nowMs = Date.now()): boolean {
    if (nowMs >= match.endsAtMs) {
      if (match.status !== 'finished') {
        match.status = 'finished';
        this.computeWinnersInPlace(match);
        return true;
      }
      return false;
    }
    match.status = nowMs >= match.startedAtMs ? 'active' : 'shaking';
    return false;
  }

  private computeWinnersInPlace(match: StoredGridItMatch): void {
    const list = Object.values(match.players);
    if (list.length === 0) return;

    const sorted = [...list].sort((a, b) => {
      if (match.mode === 'board_battle') {
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
  }

  private async persistMatchFinalizationSideEffects(match: StoredGridItMatch): Promise<void> {
    if (match.roomId) {
      await this.store
        .mutateRoom(match.roomId, (room) => {
          room.status = 'waiting';
          room.activeMatchId = null;
          for (const rp of room.players) rp.isReady = false;
          room.updatedAt = Date.now();
          return { result: true };
        })
        .catch(() => undefined);
    }

    const list = Object.values(match.players);
    for (const p of list) {
      const profile = this.repo.getProfile(p.playerId);
      const isGuest = Boolean(profile?.isGuest || p.playerId.startsWith('guest_'));
      const didWin = match.winnerIds.includes(p.playerId) && list.length > 1;
      await this.store
        .recordSessionStat({
          playerId: p.playerId,
          username: p.username,
          avatarId: p.avatarId,
          score: p.rawScore,
          won: didWin,
          bestWord: p.bestWord?.word ?? null,
          isGuest,
        })
        .catch(() => undefined);
    }
  }

  async submitWord(
    matchId: string,
    playerId: string,
    tilePath: string[],
    preferredWord?: string
  ) {
    const enWords = getServerWordSet('en');
    const nowMs = Date.now();

    const mutated = await this.store.mutateMatch(matchId, (match) => {
      const playerState = match.players[playerId];
      if (!playerState) {
        throw new GridItForbiddenError('Read-only spectators cannot submit words.');
      }

      const newlyFinished = this.applyMatchLifecycle(match, nowMs);
      if (match.status === 'shaking') {
        throw new GridItBadRequestError('Wait for dice shake to settle before submitting words.');
      }
      if (match.status === 'finished') {
        throw new GridItBadRequestError('Match timer has finished.');
      }

      const matchWords =
        match.settings.language && match.settings.language !== 'en'
          ? getServerWordSet(match.settings.language)
          : enWords;
      const already = new Set(playerState.foundWords.map((w) => w.word));
      const validation = resolveWordPathWithMods(
        playerState.assignedBoard,
        tilePath,
        matchWords,
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

      return { validation, newlyFinished };
    });

    if (!mutated) throw new GridItNotFoundError('GridIt match not found.');
    this.rememberMatch(mutated.match);
    return {
      validation: mutated.result.validation,
      match: this.buildSanitizedClientState(mutated.match, playerId, nowMs),
      matchRecord: mutated.match,
    };
  }

  async addMatchChat(
    matchId: string,
    playerId: string,
    text: string,
    kind: 'chat' | 'emoji' = 'chat'
  ): Promise<GridItChatMessage> {
    const clean = text.trim().slice(0, 220);
    if (!clean) throw new GridItBadRequestError('Empty message.');

    const mutated = await this.store.mutateMatch(matchId, (match) => {
      const player = match.players[playerId];
      const spectator = match.spectators.find((s) => s.playerId === playerId);
      if (!player && !spectator) {
        throw new GridItForbiddenError('Only match participants or spectators can send reactions.');
      }
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
    });

    if (!mutated) throw new GridItNotFoundError('GridIt match not found.');
    this.rememberMatch(mutated.match);
    return mutated.result;
  }

  async finishMatchEarly(matchId: string, requesterId: string): Promise<GridItMatchStateClient> {
    const nowMs = Date.now();
    let shouldFinalizeStats = false;
    const mutated = await this.store.mutateMatch(matchId, (match) => {
      if (!match.players[requesterId]) {
        throw new GridItForbiddenError('Only match participants can end the match.');
      }
      match.status = 'finished';
      match.endsAtMs = Math.min(match.endsAtMs, nowMs);
      this.computeWinnersInPlace(match);
      if (!match.finalizedStats) {
        match.finalizedStats = true;
        shouldFinalizeStats = true;
      }
      return true;
    });
    if (!mutated) throw new GridItNotFoundError('GridIt match not found.');
    this.rememberMatch(mutated.match);
    if (shouldFinalizeStats) {
      await this.persistMatchFinalizationSideEffects(mutated.match);
    }
    return this.buildSanitizedClientState(mutated.match, requesterId, nowMs);
  }

  async rematch(matchId: string, requesterId: string): Promise<StoredGridItMatch> {
    const old = await this.store.getMatch(matchId);
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
    await this.store.insertMatch(next);
    this.rememberMatch(next);

    if (old.roomId) {
      await this.store
        .mutateRoom(old.roomId, (room) => {
          room.status = 'in_progress';
          room.activeMatchId = next.id;
          room.updatedAt = Date.now();
          return { result: true };
        })
        .catch(() => undefined);
    }
    return next;
  }

  getMatchAudienceIdsFromRecord(match: StoredGridItMatch): string[] {
    return [...match.playerOrder, ...match.spectators.map((s) => s.playerId)];
  }

  async getMatchAudienceIds(matchId: string): Promise<string[]> {
    const cached = this.getCachedMatchRecord(matchId);
    if (cached) return this.getMatchAudienceIdsFromRecord(cached);
    const match = await this.store.getMatch(matchId);
    if (!match) return [];
    this.rememberMatch(match);
    return this.getMatchAudienceIdsFromRecord(match);
  }

  sanitizeMatchForViewerFromRecord(
    match: StoredGridItMatch,
    viewerId: string,
    nowMs = Date.now(),
    spectatePlayerId?: string
  ): GridItMatchStateClient {
    return this.buildSanitizedClientState(match, viewerId, nowMs, spectatePlayerId);
  }

  buildMatchDeltaFromRecord(
    match: StoredGridItMatch,
    nowMs = Date.now()
  ): GridItMatchDelta {
    const effectiveStatus: StoredGridItMatch['status'] =
      match.status === 'finished' || nowMs >= match.endsAtMs
        ? 'finished'
        : nowMs >= match.startedAtMs
          ? 'active'
          : 'shaking';
    const players: Record<string, GridItMatchPlayerDeltaSummary> = {};
    for (const pid of match.playerOrder) {
      const ps = match.players[pid];
      players[pid] = {
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
      };
    }
    return {
      id: match.id,
      status: effectiveStatus,
      serverNowMs: nowMs,
      endsAtMs: match.endsAtMs,
      players,
      spectators: match.spectators,
      winnerIds: match.winnerIds,
      messages: match.messages,
    };
  }

  async sanitizeMatchForViewer(
    matchId: string,
    viewerId: string,
    spectatePlayerId?: string
  ): Promise<GridItMatchStateClient> {
    const match = await this.store.getMatch(matchId);
    if (!match) throw new GridItNotFoundError('GridIt match not found.');

    const nowMs = Date.now();
    if (nowMs >= match.endsAtMs && match.status !== 'finished') {
      let didFinalizeStats = false;
      const mutated = await this.store.mutateMatch(matchId, (m) => {
        this.applyMatchLifecycle(m, nowMs);
        if (m.status === 'finished' && !m.finalizedStats) {
          m.finalizedStats = true;
          didFinalizeStats = true;
        }
        return true;
      });
      if (mutated) {
        if (didFinalizeStats) {
          await this.persistMatchFinalizationSideEffects(mutated.match);
        }
        return this.buildSanitizedClientState(mutated.match, viewerId, nowMs, spectatePlayerId);
      }
    }

    return this.buildSanitizedClientState(match, viewerId, nowMs, spectatePlayerId);
  }

  private buildSanitizedClientState(
    match: StoredGridItMatch,
    viewerId: string,
    nowMs: number,
    spectatePlayerId?: string
  ): GridItMatchStateClient {
    const effectiveStatus: StoredGridItMatch['status'] =
      match.status === 'finished' || nowMs >= match.endsAtMs
        ? 'finished'
        : nowMs >= match.startedAtMs
          ? 'active'
          : 'shaking';

    const isPlayer = Boolean(match.players[viewerId]);
    const isSpectator =
      match.settings.allowSpectators && match.spectators.some((s) => s.playerId === viewerId);

    if (!isPlayer && !isSpectator) {
      throw new GridItForbiddenError('Access denied: not a participant or spectator.');
    }

    const viewerRole = isPlayer ? 'player' : 'spectator';
    const targetPlayerId = isPlayer
      ? viewerId
      : spectatePlayerId && match.players[spectatePlayerId]
        ? spectatePlayerId
        : match.playerOrder[0];

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
        foundWords:
          pid === viewerId || effectiveStatus === 'finished' || viewerRole === 'spectator'
            ? ps.foundWords
            : [],
        assignedBoardFairness:
          pid === viewerId || effectiveStatus === 'finished' ? ps.assignedFairness : null,
        authoredByName: ps.authoredByName ?? null,
        quotaValidationPassed: ps.quotaValidationPassed ?? true,
      };
    }

    return {
      id: match.id,
      roomId: match.roomId,
      mode: match.mode,
      status: effectiveStatus,
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
      fairnessComparison: effectiveStatus === 'finished' ? match.fairnessComparison : null,
      messages: match.messages,
    };
  }

  async processExpiredMatches(): Promise<StoredGridItMatch[]> {
    const nowIso = new Date().toISOString();
    const expiredCandidates = await this.store.listExpiredMatches(nowIso);
    const transitioned: StoredGridItMatch[] = [];

    for (const candidate of expiredCandidates) {
      let didFinalizeStats = false;
      const mutated = await this.store.mutateMatch(candidate.id, (m) => {
        if (m.status !== 'finished') {
          const finishedNow = this.applyMatchLifecycle(m, Date.now());
          if (finishedNow && !m.finalizedStats) {
            m.finalizedStats = true;
            didFinalizeStats = true;
          }
        }
        return true;
      });
      if (mutated && didFinalizeStats) {
        await this.persistMatchFinalizationSideEffects(mutated.match);
        transitioned.push(mutated.match);
      }
    }
    return transitioned;
  }

  async listSessionLeaderboard(): Promise<GridItSessionLeaderboardEntry[]> {
    return this.store.listSessionStats();
  }

  /** Used cleanly by automated tests to fast-forward shake delay */
  async debugAdvanceMatchStartForTest(matchId: string): Promise<void> {
    await this.store.mutateMatch(matchId, (m) => {
      m.revealAtMs = Date.now() - 3000;
      m.startedAtMs = Date.now() - 500;
      return true;
    });
  }
}
