import crypto from 'node:crypto';
import {
  ALL_CHANGEIT_ADVENTURE_STAGES,
  CHANGEIT_ADVENTURE_CHAPTERS,
  computeAdventureStars,
  getChangeItAdventureStage,
} from '../../../shared/changeit/adventureCatalog.js';
import { DIFFICULTY_CONFIGS } from '../../../shared/changeit/difficulty.js';
import { isExcludedWord } from '../../../shared/changeit/excludedWords.js';
import {
  createEmptyRestriction,
  extendSurvivalChain,
  findEquivalentRerouteTarget,
  generateVerifiedPuzzle,
} from '../../../shared/changeit/generator.js';
import {
  MODIFIER_CATALOG,
  SABOTAGE_BALANCE_CONFIG,
  SABOTAGE_MODIFIER_POOL,
} from '../../../shared/changeit/modifiers.js';
import {
  ChangeItActiveModifier,
  ChangeItAdventureChapterClient,
  ChangeItAdventureClaimResult,
  ChangeItAdventureProgressClient,
  ChangeItAdventureStageClient,
  ChangeItCustomPuzzleValidation,
  ChangeItDifficulty,
  ChangeItLeaderboardResponse,
  ChangeItMatchStateClient,
  ChangeItModifierResponse,
  ChangeItModifierType,
  ChangeItMultiplayerMode,
  ChangeItOpponentSummaryView,
  ChangeItRelayTeamView,
  ChangeItRestriction,
  ChangeItRoom,
  ChangeItRoomSettings,
  ChangeItTeamId,
  ChangeItTransformResponse,
  ChangeItWordLength,
} from '../../../shared/changeit/types.js';
import {
  bfsShortestPath,
  canonicalPuzzleKey,
  getChangedIndices,
  validateMoveTransformation,
} from '../../../shared/changeit/wordGraph.js';
import { Profile } from '../../../shared/types.js';
import { StorageRepository } from '../../repositories/StorageRepository.js';
import { computeRankTier } from '../../repositories/types.js';
import {
  ChangeItStateStore,
  StoredChangeItBoardState,
  StoredChangeItMatch,
  StoredChangeItParticipantMeta,
  StoredChangeItRelayTeam,
  StoredSurvivalStep,
} from './ChangeItStateStore.js';
import { getChangeItServerData } from './serverVocab.js';

export class ChangeItForbiddenError extends Error {
  status = 403;
}

export class ChangeItNotFoundError extends Error {
  status = 404;
}

export class ChangeItBadRequestError extends Error {
  status = 400;
}

const DEFAULT_ROOM_SETTINGS: ChangeItRoomSettings = {
  mode: 'classic_sprint',
  difficulty: 'easy',
  wordLength: 'auto',
  timeLimitSeconds: 180,
  maxPlayers: 4,
  isPublic: true,
  modifiersEnabled: false,
  hintsAllowed: true,
  relayTurnSeconds: 20,
};

export class ChangeItEngine {
  public readonly store: ChangeItStateStore;
  private resolveProfileFn?: (playerId: string) => Promise<Profile | null>;

  constructor(
    private repo: StorageRepository,
    private isPlayerOnline: (playerId: string) => boolean,
    options: {
      forceLocalMemory?: boolean;
      isServerless?: boolean;
      resolveProfile?: (playerId: string) => Promise<Profile | null>;
    } = {}
  ) {
    this.store = new ChangeItStateStore({
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
    throw new ChangeItNotFoundError('Active player session not found.');
  }

  private createRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'C';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  private normalizeRoomSettings(
    partial?: Partial<ChangeItRoomSettings> | null,
    existing?: ChangeItRoomSettings
  ): ChangeItRoomSettings {
    const mode: ChangeItMultiplayerMode = partial?.mode ?? existing?.mode ?? 'classic_sprint';
    const difficulty: ChangeItDifficulty = partial?.difficulty ?? existing?.difficulty ?? 'easy';
    const rawLen = partial?.wordLength ?? existing?.wordLength ?? 'auto';
    const wordLength: ChangeItWordLength | 'auto' =
      rawLen === 3 || rawLen === 4 || rawLen === 5 || rawLen === 6 ? rawLen : 'auto';
    const maxPlayersBase =
      mode === 'relay'
        ? 4
        : mode === 'tug_of_war'
          ? 2
          : Number(partial?.maxPlayers ?? existing?.maxPlayers ?? 4);
    const maxPlayers = Math.max(2, Math.min(8, Math.round(maxPlayersBase)));
    const timeLimitSeconds = Math.max(
      45,
      Math.min(
        600,
        Math.round(
          partial?.timeLimitSeconds ??
            existing?.timeLimitSeconds ??
            DIFFICULTY_CONFIGS[difficulty].defaultTimeLimitSeconds
        )
      )
    );
    const relayTurnSeconds = Math.max(
      10,
      Math.min(60, Math.round(partial?.relayTurnSeconds ?? existing?.relayTurnSeconds ?? 20))
    );

    const modifiersEnabled =
      mode === 'sabotage'
        ? true
        : mode === 'classic_sprint' || mode === 'classic_precision'
          ? Boolean(partial?.modifiersEnabled ?? existing?.modifiersEnabled ?? false)
          : false;

    return {
      mode,
      difficulty,
      wordLength,
      timeLimitSeconds,
      maxPlayers,
      isPublic: partial?.isPublic ?? existing?.isPublic ?? true,
      modifiersEnabled,
      hintsAllowed: Boolean(partial?.hintsAllowed ?? existing?.hintsAllowed ?? true),
      relayTurnSeconds,
    };
  }

  private refreshRoomOnlineFlags(room: ChangeItRoom): ChangeItRoom {
    return {
      ...room,
      players: room.players.map((p) => ({
        ...p,
        isOnline: this.isPlayerOnline(p.playerId),
      })),
    };
  }

  // ==================== CUSTOM PUZZLE VALIDATION ====================

  validateCustomPuzzle(startRaw: string, targetRaw: string): ChangeItCustomPuzzleValidation {
    const startWord = String(startRaw || '').trim().toUpperCase();
    const targetWord = String(targetRaw || '').trim().toUpperCase();
    const data = getChangeItServerData();

    if (!/^[A-Z]{3,6}$/.test(startWord) || !/^[A-Z]{3,6}$/.test(targetWord)) {
      return {
        valid: false,
        startWord,
        targetWord,
        wordLength: startWord.length,
        minMoves: null,
        familiarPathAvailable: false,
        error: 'Both starting and target words must be 3–6 English letters.',
      };
    }

    if (startWord.length !== targetWord.length) {
      return {
        valid: false,
        startWord,
        targetWord,
        wordLength: startWord.length,
        minMoves: null,
        familiarPathAvailable: false,
        error: 'Starting and target words must have the exact same length.',
      };
    }

    if (startWord === targetWord) {
      return {
        valid: false,
        startWord,
        targetWord,
        wordLength: startWord.length,
        minMoves: null,
        familiarPathAvailable: false,
        error: 'Starting and target words must be different.',
      };
    }

    if (isExcludedWord(startWord) || !data.validationSet.has(startWord)) {
      return {
        valid: false,
        startWord,
        targetWord,
        wordLength: startWord.length,
        minMoves: null,
        familiarPathAvailable: false,
        error: `"${startWord}" is not in the approved ChangeIt English dictionary.`,
      };
    }

    if (isExcludedWord(targetWord) || !data.validationSet.has(targetWord)) {
      return {
        valid: false,
        startWord,
        targetWord,
        wordLength: startWord.length,
        minMoves: null,
        familiarPathAvailable: false,
        error: `"${targetWord}" is not in the approved ChangeIt English dictionary.`,
      };
    }

    const len = startWord.length as ChangeItWordLength;
    const valRes = bfsShortestPath(data.validationGraphs[len], startWord, targetWord);
    if (!valRes.solvable || valRes.minMoves < 1) {
      return {
        valid: false,
        startWord,
        targetWord,
        wordLength: len,
        minMoves: null,
        familiarPathAvailable: false,
        error: `No valid word transformation ladder exists between ${startWord} and ${targetWord}.`,
      };
    }

    const puzRes = bfsShortestPath(data.puzzleGraphs[len], startWord, targetWord);
    return {
      valid: true,
      startWord,
      targetWord,
      wordLength: len,
      minMoves: valRes.minMoves,
      familiarPathAvailable: puzRes.solvable,
    };
  }

  // ==================== ROOMS ====================

  async listPublicRooms(): Promise<ChangeItRoom[]> {
    const rooms = await this.store.listPublicRooms();
    return rooms.map((r) => this.refreshRoomOnlineFlags(r));
  }

  async getRoom(idOrCode: string): Promise<ChangeItRoom> {
    const room = await this.store.getRoom(idOrCode);
    if (!room) throw new ChangeItNotFoundError('ChangeIt room not found.');
    return this.refreshRoomOnlineFlags(room);
  }

  async createRoom(params: {
    hostId: string;
    name?: string;
    settings?: Partial<ChangeItRoomSettings>;
  }): Promise<ChangeItRoom> {
    const host = await this.requireProfile(params.hostId);
    const settings = this.normalizeRoomSettings(params.settings, DEFAULT_ROOM_SETTINGS);
    const now = Date.now();

    for (let attempt = 0; attempt < 6; attempt++) {
      const code = this.createRoomCode();
      const existing = await this.store.getRoom(code);
      if (existing) continue;

      const room: ChangeItRoom = {
        id: `ci_room_${now}_${crypto.randomBytes(3).toString('hex')}`,
        code,
        name: (params.name || `${host.username}'s ChangeIt Room`).trim().slice(0, 42),
        hostId: host.id,
        status: 'lobby',
        settings,
        players: [
          {
            playerId: host.id,
            username: host.username,
            avatarId: host.avatarId,
            rankTier: host.rankTier,
            isHost: true,
            isReady: true,
            isOnline: true,
            teamId: 'blue',
          },
        ],
        messages: [],
        activeMatchId: null,
        customPuzzle: null,
        createdAt: now,
        updatedAt: now,
      };
      await this.store.insertRoom(room);
      return this.refreshRoomOnlineFlags(room);
    }

    throw new ChangeItBadRequestError('Could not allocate unique room code.');
  }

  async joinRoom(codeOrId: string, playerId: string): Promise<ChangeItRoom> {
    const profile = await this.requireProfile(playerId);
    const room = await this.store.mutateRoom<ChangeItRoom>(codeOrId, (rm) => {
      const existing = rm.players.find((p) => p.playerId === profile.id);
      if (existing) {
        existing.username = profile.username;
        existing.avatarId = profile.avatarId;
        existing.isOnline = true;
        rm.updatedAt = Date.now();
        return { result: rm };
      }

      if (rm.status !== 'lobby') {
        throw new ChangeItBadRequestError('Match already in progress in this room.');
      }
      if (rm.players.length >= rm.settings.maxPlayers) {
        throw new ChangeItBadRequestError('Room is full.');
      }

      const blueCount = rm.players.filter((p) => p.teamId === 'blue').length;
      const redCount = rm.players.filter((p) => p.teamId === 'red').length;
      const teamId: ChangeItTeamId = blueCount <= redCount ? 'blue' : 'red';

      rm.players.push({
        playerId: profile.id,
        username: profile.username,
        avatarId: profile.avatarId,
        rankTier: profile.rankTier,
        isHost: false,
        isReady: false,
        isOnline: true,
        teamId,
      });
      rm.updatedAt = Date.now();
      return { result: rm };
    });

    if (!room) throw new ChangeItNotFoundError('ChangeIt room not found.');
    return this.refreshRoomOnlineFlags(room);
  }

  async leaveRoom(
    roomId: string,
    playerId: string
  ): Promise<{ deleted: boolean; room?: ChangeItRoom }> {
    const out = await this.store.mutateRoom<{ deleted: boolean; room?: ChangeItRoom }>(
      roomId,
      (rm) => {
        rm.players = rm.players.filter((p) => p.playerId !== playerId);
        if (rm.players.length === 0) {
          return { result: { deleted: true }, deleteRoom: true };
        }
        if (rm.hostId === playerId) {
          rm.hostId = rm.players[0].playerId;
          rm.players[0].isHost = true;
          rm.players[0].isReady = true;
        }
        rm.updatedAt = Date.now();
        return { result: { deleted: false, room: rm } };
      }
    );

    if (!out) return { deleted: true };
    return out.room ? { deleted: false, room: this.refreshRoomOnlineFlags(out.room) } : out;
  }

  async updateRoomSettings(
    roomId: string,
    playerId: string,
    partial: Partial<ChangeItRoomSettings>
  ): Promise<ChangeItRoom> {
    const updated = await this.store.mutateRoom<ChangeItRoom>(roomId, (rm) => {
      if (rm.hostId !== playerId) {
        throw new ChangeItForbiddenError('Only the room host can update match settings.');
      }
      if (rm.status !== 'lobby') {
        throw new ChangeItBadRequestError('Cannot change settings during an active match.');
      }
      rm.settings = this.normalizeRoomSettings(partial, rm.settings);
      // Clear incompatible custom puzzle if mode is survival or relay requires matching length
      if (rm.settings.mode === 'survival') {
        rm.customPuzzle = null;
      }
      rm.updatedAt = Date.now();
      return { result: rm };
    });
    if (!updated) throw new ChangeItNotFoundError('ChangeIt room not found.');
    return this.refreshRoomOnlineFlags(updated);
  }

  async setPlayerReady(roomId: string, playerId: string, isReady: boolean): Promise<ChangeItRoom> {
    const updated = await this.store.mutateRoom<ChangeItRoom>(roomId, (rm) => {
      const target = rm.players.find((p) => p.playerId === playerId);
      if (!target) throw new ChangeItForbiddenError('You are not in this room.');
      target.isReady = target.isHost ? true : Boolean(isReady);
      rm.updatedAt = Date.now();
      return { result: rm };
    });
    if (!updated) throw new ChangeItNotFoundError('ChangeIt room not found.');
    return this.refreshRoomOnlineFlags(updated);
  }

  async switchTeam(roomId: string, playerId: string, teamId: ChangeItTeamId): Promise<ChangeItRoom> {
    const updated = await this.store.mutateRoom<ChangeItRoom>(roomId, (rm) => {
      const target = rm.players.find((p) => p.playerId === playerId);
      if (!target) throw new ChangeItForbiddenError('You are not in this room.');
      target.teamId = teamId;
      rm.updatedAt = Date.now();
      return { result: rm };
    });
    if (!updated) throw new ChangeItNotFoundError('ChangeIt room not found.');
    return this.refreshRoomOnlineFlags(updated);
  }

  async setCustomPuzzle(
    roomId: string,
    playerId: string,
    payload: { startWord?: string; targetWord?: string; clear?: boolean }
  ): Promise<ChangeItRoom> {
    let customSummary: ChangeItRoom['customPuzzle'] = null;
    if (!payload.clear) {
      const check = this.validateCustomPuzzle(payload.startWord || '', payload.targetWord || '');
      if (!check.valid || check.minMoves === null) {
        throw new ChangeItBadRequestError(check.error || 'Invalid custom puzzle.');
      }
      customSummary = {
        startWord: check.startWord,
        targetWord: check.targetWord,
        minMoves: check.minMoves,
        wordLength: check.wordLength as ChangeItWordLength,
        familiarPathAvailable: check.familiarPathAvailable,
      };
    }

    const updated = await this.store.mutateRoom<ChangeItRoom>(roomId, (rm) => {
      if (rm.hostId !== playerId) {
        throw new ChangeItForbiddenError('Only the host can set a custom room puzzle.');
      }
      if (rm.status !== 'lobby') {
        throw new ChangeItBadRequestError('Cannot change custom puzzle while match is active.');
      }
      rm.customPuzzle = customSummary;
      rm.updatedAt = Date.now();
      return { result: rm };
    });

    if (!updated) throw new ChangeItNotFoundError('ChangeIt room not found.');
    return this.refreshRoomOnlineFlags(updated);
  }

  async addRoomChat(roomId: string, playerId: string, text: string): Promise<ChangeItRoom> {
    const clean = String(text || '').trim().slice(0, 180);
    if (!clean) throw new ChangeItBadRequestError('Chat message cannot be empty.');
    const profile = await this.requireProfile(playerId);

    const updated = await this.store.mutateRoom<ChangeItRoom>(roomId, (rm) => {
      if (!rm.players.some((p) => p.playerId === playerId)) {
        throw new ChangeItForbiddenError('You are not in this room.');
      }
      rm.messages.push({
        id: `ci_msg_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
        senderId: profile.id,
        senderName: profile.username,
        senderAvatar: profile.avatarId,
        text: clean,
        createdAt: Date.now(),
      });
      if (rm.messages.length > 80) rm.messages = rm.messages.slice(-80);
      rm.updatedAt = Date.now();
      return { result: rm };
    });

    if (!updated) throw new ChangeItNotFoundError('ChangeIt room not found.');
    return this.refreshRoomOnlineFlags(updated);
  }

  // ==================== ANTI-REPETITION HELPERS ====================

  private async gatherSharedAntiRepetition(playerIds: string[]): Promise<{
    completedKeys: Set<string>;
    recentWords: Set<string>;
  }> {
    const histories = await Promise.all(playerIds.map((pid) => this.store.getPlayerHistory(pid)));
    const completedKeys = new Set<string>();
    const recentWords = new Set<string>();
    for (const h of histories) {
      for (const k of h.completedPuzzles) completedKeys.add(k);
      for (const w of h.recentWords) recentWords.add(w);
    }
    return { completedKeys, recentWords };
  }

  // ==================== MATCH CREATION ====================

  private createBoardState(params: {
    playerId: string;
    startWord: string;
    targetWord: string;
    minMoves: number;
    restrictions: ChangeItRestriction;
    nowMs: number;
    playerDeadlineMs: number | null;
    starterModifiers?: ChangeItModifierType[];
  }): StoredChangeItBoardState {
    return {
      playerId: params.playerId,
      startWord: params.startWord,
      currentWord: params.startWord,
      targetWord: params.targetWord,
      minMoves: params.minMoves,
      history: [],
      usedWords: [params.startWord],
      validMoves: 0,
      invalidAttempts: 0,
      completed: false,
      completedAtMs: null,
      forfeited: false,
      timedOut: false,
      hintsUsed: 0,
      activeHintWord: null,
      restrictions: JSON.parse(JSON.stringify(params.restrictions)),
      lastChangedIndex: null,
      heldModifiers: params.starterModifiers ? [...params.starterModifiers] : [],
      modifierProgress: 0,
      modifierCooldowns: {},
      activeModifiers: [],
      disruptionImmunityUntilMs: 0,
      puzzlesCompleted: 0,
      survivalScore: 0,
      survivalChainIndex: 0,
      puzzleStartedAtMs: params.nowMs,
      playerDeadlineMs: params.playerDeadlineMs,
    };
  }

  private async buildMultiplayerMatchRecord(params: {
    roomId: string | null;
    mode: ChangeItMultiplayerMode;
    difficulty: ChangeItDifficulty;
    wordLength: ChangeItWordLength | 'auto';
    timeLimitSeconds: number;
    isRanked: boolean;
    modifiersEnabled: boolean;
    hintsAllowed: boolean;
    relayTurnSeconds: number;
    players: Array<{ playerId: string; username: string; avatarId: string; isGuest: boolean; teamId: ChangeItTeamId }>;
    customPuzzle?: ChangeItRoom['customPuzzle'];
  }): Promise<StoredChangeItMatch> {
    const data = getChangeItServerData();
    const playerIds = params.players.map((p) => p.playerId);
    const { completedKeys, recentWords } = await this.gatherSharedAntiRepetition(playerIds);
    const now = Date.now();

    let startWord: string;
    let targetWord: string;
    let minMoves: number;
    let wordLength: ChangeItWordLength;
    let restrictions: ChangeItRestriction = createEmptyRestriction();

    if (params.customPuzzle && !params.isRanked && params.mode !== 'survival') {
      startWord = params.customPuzzle.startWord;
      targetWord = params.customPuzzle.targetWord;
      minMoves = params.customPuzzle.minMoves;
      wordLength = params.customPuzzle.wordLength;
    } else {
      const generated = generateVerifiedPuzzle(data, {
        difficulty: params.difficulty,
        wordLength: params.wordLength,
        completedPuzzleKeys: completedKeys,
        recentWords,
        restricted: params.mode === 'restricted',
      });
      startWord = generated.startWord;
      targetWord = generated.targetWord;
      minMoves = generated.minMoves;
      wordLength = generated.wordLength;
      restrictions = generated.restrictions;
    }

    const participants: Record<string, StoredChangeItParticipantMeta> = {};
    for (const p of params.players) {
      participants[p.playerId] = {
        playerId: p.playerId,
        username: p.username,
        avatarId: p.avatarId,
        isGuest: p.isGuest,
        teamId: params.mode === 'relay' ? p.teamId : null,
      };
    }

    const survivalChain: StoredSurvivalStep[] = [];
    const survivalInitialMs = SABOTAGE_BALANCE_CONFIG.survivalInitialSeconds * 1000;
    if (params.mode === 'survival') {
      const cfg = DIFFICULTY_CONFIGS[params.difficulty];
      const usedKeys = new Set<string>(completedKeys);
      const step0Key = canonicalPuzzleKey(startWord, targetWord);
      usedKeys.add(step0Key);
      survivalChain.push({
        startWord,
        targetWord,
        minMoves,
        canonicalKey: step0Key,
      });

      let cursorWord = targetWord;
      for (let i = 1; i < 12; i++) {
        const next = extendSurvivalChain(
          data,
          cursorWord,
          wordLength,
          Math.max(2, Math.min(cfg.minMoves, 5)),
          Math.max(4, Math.min(cfg.maxMoves, 7)),
          usedKeys,
          recentWords
        );
        usedKeys.add(next.canonicalKey);
        survivalChain.push({
          startWord: cursorWord,
          targetWord: next.targetWord,
          minMoves: next.minMoves,
          canonicalKey: next.canonicalKey,
        });
        cursorWord = next.targetWord;
      }
    }

    const starterModifiers: ChangeItModifierType[] | undefined =
      !params.isRanked && params.modifiersEnabled ? ['double_shift'] : undefined;
    const boards: Record<string, StoredChangeItBoardState> = {};
    params.players.forEach((p, idx) => {
      const isReversed = params.mode === 'tug_of_war' && idx % 2 === 1;
      const pStart = isReversed ? targetWord : startWord;
      const pTarget = isReversed ? startWord : targetWord;
      boards[p.playerId] = this.createBoardState({
        playerId: p.playerId,
        startWord: pStart,
        targetWord: pTarget,
        minMoves,
        restrictions,
        nowMs: now,
        playerDeadlineMs: params.mode === 'survival' ? now + survivalInitialMs : null,
        starterModifiers,
      });
    });

    let relayTeams: StoredChangeItMatch['relayTeams'] = null;
    if (params.mode === 'relay') {
      const blueIds = params.players.filter((p) => p.teamId === 'blue').map((p) => p.playerId);
      const redIds = params.players.filter((p) => p.teamId === 'red').map((p) => p.playerId);
      const makeTeam = (teamId: ChangeItTeamId, ids: string[]): StoredChangeItRelayTeam => ({
        teamId,
        playerIds: ids,
        activeTurnIndex: 0,
        activeTurnPlayerId: ids[0] ?? null,
        turnDeadlineMs: now + params.relayTurnSeconds * 1000,
        startWord,
        currentWord: startWord,
        targetWord,
        minMoves,
        history: [],
        usedWords: [startWord],
        validMoves: 0,
        invalidAttempts: 0,
        completed: false,
        completedAtMs: null,
        lastChangedIndex: null,
      });
      relayTeams = {
        blue: makeTeam('blue', blueIds),
        red: makeTeam('red', redIds),
      };
    }

    const matchDurationMs =
      params.mode === 'survival'
        ? Math.max(params.timeLimitSeconds, 240) * 1000
        : params.timeLimitSeconds * 1000;

    const match: StoredChangeItMatch = {
      id: `ci_match_${now}_${crypto.randomBytes(3).toString('hex')}`,
      roomId: params.roomId,
      mode: params.mode,
      difficulty: params.difficulty,
      wordLength,
      isRanked: params.isRanked,
      modifiersEnabled: params.isRanked ? false : params.modifiersEnabled,
      hintsAllowed: params.isRanked ? false : params.hintsAllowed,
      status: 'playing',
      startedAtMs: now,
      endsAtMs: now + matchDurationMs,
      relayTurnSeconds: params.relayTurnSeconds,
      participantOrder: playerIds,
      participants,
      boards,
      relayTeams,
      survivalChain: params.mode === 'survival' ? survivalChain : undefined,
      winnerIds: [],
      winningTeamId: null,
      finishReason: null,
      messages: [],
      processedRequestIds: {},
      finalizedResult: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.store.insertMatch(match);
    return match;
  }

  async startRoomMatch(
    roomId: string,
    playerId: string
  ): Promise<{ room: ChangeItRoom; match: StoredChangeItMatch }> {
    const room = await this.store.getRoom(roomId);
    if (!room) throw new ChangeItNotFoundError('ChangeIt room not found.');
    if (room.hostId !== playerId) {
      throw new ChangeItForbiddenError('Only the room host can start the match.');
    }
    if (room.players.length < 2) {
      throw new ChangeItBadRequestError('At least 2 players are required to start.');
    }
    if (room.players.some((p) => !p.isHost && !p.isReady)) {
      throw new ChangeItBadRequestError('All players must be ready before starting.');
    }

    if (room.settings.mode === 'relay') {
      const blueCount = room.players.filter((p) => p.teamId === 'blue').length;
      const redCount = room.players.filter((p) => p.teamId === 'red').length;
      if (blueCount < 1 || redCount < 1) {
        throw new ChangeItBadRequestError(
          'Relay mode requires at least 1 player on Team Blue and 1 player on Team Red.'
        );
      }
      if (room.players.length >= 4 && (blueCount < 2 || redCount < 2)) {
        throw new ChangeItBadRequestError('Please balance teams before starting Relay.');
      }
    }

    const hydratedPlayers = await Promise.all(
      room.players.map(async (rp) => {
        const prof = await this.requireProfile(rp.playerId);
        return {
          playerId: prof.id,
          username: prof.username,
          avatarId: prof.avatarId,
          isGuest: Boolean(prof.isGuest ?? prof.id.startsWith('guest_')),
          teamId: rp.teamId,
        };
      })
    );

    const match = await this.buildMultiplayerMatchRecord({
      roomId: room.id,
      mode: room.settings.mode,
      difficulty: room.settings.difficulty,
      wordLength: room.settings.wordLength,
      timeLimitSeconds: room.settings.timeLimitSeconds,
      isRanked: false,
      modifiersEnabled: room.settings.modifiersEnabled,
      hintsAllowed: room.settings.hintsAllowed,
      relayTurnSeconds: room.settings.relayTurnSeconds,
      players: hydratedPlayers,
      customPuzzle: room.customPuzzle,
    });

    const updatedRoom = await this.store.mutateRoom<ChangeItRoom>(room.id, (rm) => {
      rm.status = 'in_progress';
      rm.activeMatchId = match.id;
      rm.updatedAt = Date.now();
      return { result: rm };
    });

    return {
      room: this.refreshRoomOnlineFlags(updatedRoom ?? room),
      match,
    };
  }

  // ==================== RANKED MATCHMAKING ====================

  async joinRankedQueue(
    playerId: string,
    format: 'classic_sprint' | 'classic_precision'
  ): Promise<{ status: 'queued' | 'matched'; match?: StoredChangeItMatch }> {
    const profile = await this.requireProfile(playerId);
    const stats = await this.store.getPlayerStats(profile.id);
    const rating = stats?.rating ?? 1000;
    const queueKey = `ranked:${format}`;

    const res = await this.store.dequeueRankedPair(queueKey, profile.id, rating);
    if (!res.matched || !res.opponentId) {
      return { status: 'queued' };
    }

    const opp = await this.requireProfile(res.opponentId);
    const avgRating = Math.round((rating + (res.opponentRating ?? 1000)) / 2);
    const rankedDifficulty: ChangeItDifficulty =
      avgRating >= 1350 ? 'expert' : avgRating >= 1150 ? 'hard' : 'normal';

    const match = await this.buildMultiplayerMatchRecord({
      roomId: null,
      mode: format,
      difficulty: rankedDifficulty,
      wordLength: 'auto',
      timeLimitSeconds: format === 'classic_precision' ? 180 : 150,
      isRanked: true,
      modifiersEnabled: false,
      hintsAllowed: false,
      relayTurnSeconds: 20,
      players: [
        {
          playerId: opp.id,
          username: opp.username,
          avatarId: opp.avatarId,
          isGuest: Boolean(opp.isGuest ?? opp.id.startsWith('guest_')),
          teamId: 'blue',
        },
        {
          playerId: profile.id,
          username: profile.username,
          avatarId: profile.avatarId,
          isGuest: Boolean(profile.isGuest ?? profile.id.startsWith('guest_')),
          teamId: 'red',
        },
      ],
    });

    return { status: 'matched', match };
  }

  async leaveRankedQueue(playerId: string): Promise<void> {
    await this.store.leaveRankedQueue(playerId);
  }

  // ==================== SOLO ADVENTURE ====================

  async getAdventureProgress(playerId: string): Promise<ChangeItAdventureProgressClient> {
    await this.requireProfile(playerId);
    const rows = await this.store.getAdventureStageRows(playerId);

    let totalStars = 0;
    let maxStars = 0;
    let completedCount = 0;
    let prevStageCompleted = true;

    const chapters: ChangeItAdventureChapterClient[] = CHANGEIT_ADVENTURE_CHAPTERS.map((ch) => {
      let chStars = 0;
      const chUnlocked = prevStageCompleted;

      const stages: ChangeItAdventureStageClient[] = ch.stages.map((st) => {
        const row = rows.get(st.id);
        const completed = Boolean(row?.completed);
        const unlocked = prevStageCompleted || completed;
        const bestStars = row?.bestStars ?? 0;

        chStars += bestStars;
        totalStars += bestStars;
        maxStars += 3;
        if (completed) completedCount++;

        prevStageCompleted = completed;

        return {
          ...st,
          unlocked,
          completed,
          bestStars,
          fewestMoves: row?.fewestMoves ?? null,
          bestTimeMs: row?.bestTimeMs ?? null,
          rewardClaimed: Boolean(row?.rewardClaimed),
        };
      });

      return {
        id: ch.id,
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        theme: ch.theme,
        description: ch.description,
        accentGradient: ch.accentGradient,
        earnedStars: chStars,
        totalStars: ch.stages.length * 3,
        unlocked: chUnlocked,
        stages,
      };
    });

    return {
      playerId,
      totalStars,
      maxStars,
      completedCount,
      totalStages: ALL_CHANGEIT_ADVENTURE_STAGES.length,
      chapters,
    };
  }

  async startAdventureStage(playerId: string, stageId: string): Promise<StoredChangeItMatch> {
    const profile = await this.requireProfile(playerId);
    const stage = getChangeItAdventureStage(stageId);
    if (!stage) throw new ChangeItNotFoundError('Adventure level not found.');

    const progress = await this.getAdventureProgress(playerId);
    const clientStage = progress.chapters
      .flatMap((c) => c.stages)
      .find((s) => s.id === stage.id);
    if (!clientStage?.unlocked) {
      throw new ChangeItForbiddenError('Complete the previous Adventure level to unlock this stage.');
    }

    const now = Date.now();
    const match: StoredChangeItMatch = {
      id: `ci_adv_${now}_${crypto.randomBytes(3).toString('hex')}`,
      roomId: null,
      mode: 'solo_adventure',
      difficulty: stage.difficulty,
      wordLength: stage.wordLength,
      isRanked: false,
      modifiersEnabled: false,
      hintsAllowed: true,
      status: 'playing',
      startedAtMs: now,
      endsAtMs: now + 30 * 60 * 1000,
      relayTurnSeconds: 20,
      stageId: stage.id,
      chapterId: stage.chapterId,
      stageTitle: `${stage.label}: ${stage.title}`,
      participantOrder: [profile.id],
      participants: {
        [profile.id]: {
          playerId: profile.id,
          username: profile.username,
          avatarId: profile.avatarId,
          isGuest: Boolean(profile.isGuest ?? profile.id.startsWith('guest_')),
          teamId: null,
        },
      },
      boards: {
        [profile.id]: this.createBoardState({
          playerId: profile.id,
          startWord: stage.startWord,
          targetWord: stage.targetWord,
          minMoves: stage.minMoves,
          restrictions: createEmptyRestriction(),
          nowMs: now,
          playerDeadlineMs: null,
        }),
      },
      relayTeams: null,
      winnerIds: [],
      winningTeamId: null,
      finishReason: null,
      messages: [],
      processedRequestIds: {},
      finalizedResult: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.store.insertMatch(match);
    return match;
  }

  async retryAdventureMatch(matchId: string, playerId: string): Promise<StoredChangeItMatch> {
    return this.store.withMatchLock(matchId, async () => {
      const outcome = await this.store.mutateMatch<StoredChangeItMatch>(matchId, (m) => {
        if (m.mode !== 'solo_adventure') {
          throw new ChangeItBadRequestError('Retry is only available in Solo Adventure.');
        }
        const board = m.boards[playerId];
        if (!board) throw new ChangeItForbiddenError('Not a participant in this match.');

        const now = Date.now();
        m.status = 'playing';
        m.startedAtMs = now;
        m.endsAtMs = now + 30 * 60 * 1000;
        m.winnerIds = [];
        m.finishReason = null;
        m.finalizedResult = false;
        m.boards[playerId] = this.createBoardState({
          playerId,
          startWord: board.startWord,
          targetWord: board.targetWord,
          minMoves: board.minMoves,
          restrictions: createEmptyRestriction(),
          nowMs: now,
          playerDeadlineMs: null,
        });
        m.updatedAt = now;
        return m;
      });
      if (!outcome) throw new ChangeItNotFoundError('Adventure match not found.');
      return outcome.match;
    });
  }

  async claimAdventureReward(
    playerId: string,
    matchId: string
  ): Promise<ChangeItAdventureClaimResult> {
    const profile = await this.requireProfile(playerId);
    const match = await this.store.getMatch(matchId);
    if (!match) throw new ChangeItNotFoundError('Match not found.');
    if (match.mode !== 'solo_adventure' || !match.stageId || !match.chapterId) {
      throw new ChangeItBadRequestError('Not a Solo Adventure match.');
    }
    const board = match.boards[playerId];
    if (!board || !board.completed) {
      throw new ChangeItBadRequestError('Complete the level before claiming rewards.');
    }
    const stage = getChangeItAdventureStage(match.stageId);
    if (!stage) throw new ChangeItNotFoundError('Adventure stage definition missing.');

    const elapsedMs = Math.max(
      1,
      (board.completedAtMs ?? Date.now()) - match.startedAtMs
    );
    const starsEarned = computeAdventureStars(
      board.validMoves,
      board.minMoves,
      board.hintsUsed
    );

    const claim = await this.store.claimAdventureRewardAtomic({
      playerId,
      stageId: stage.id,
      chapterId: stage.chapterId,
      stars: starsEarned,
      moves: board.validMoves,
      timeMs: elapsedMs,
    });

    const coinsAwarded = claim.claimed ? stage.rewardCoins : 0;
    let newCoinsBalance = profile.matchPointsBalance;
    if (coinsAwarded > 0) {
      const updatedProf = this.repo.updateProfileStats(playerId, {
        matchPointsDelta: coinsAwarded,
      });
      newCoinsBalance = updatedProf?.matchPointsBalance ?? profile.matchPointsBalance + coinsAwarded;
    }

    await this.store.recordPuzzleHistory(
      playerId,
      canonicalPuzzleKey(board.startWord, board.targetWord),
      [board.startWord, board.targetWord, ...board.history.map((h) => h.word)]
    );

    const progress = await this.getAdventureProgress(playerId);
    return {
      claimed: claim.claimed,
      alreadyClaimed: claim.alreadyClaimed,
      starsEarned,
      movesUsed: board.validMoves,
      minMoves: board.minMoves,
      hintsUsed: board.hintsUsed,
      elapsedMs,
      coinsAwarded,
      newCoinsBalance,
      progress,
    };
  }

  // ==================== MODIFIER HELPERS ====================

  private cleanupExpiredModifiers(board: StoredChangeItBoardState, nowMs: number): boolean {
    let changed = false;
    const remaining: ChangeItActiveModifier[] = [];
    for (const mod of board.activeModifiers) {
      const expiredByTime = mod.expiresAtMs !== null && nowMs >= mod.expiresAtMs;
      const expiredByCharges = mod.remainingCharges !== null && mod.remainingCharges <= 0;
      if (expiredByTime || expiredByCharges) {
        changed = true;
        if (mod.type === 'frozen_letter' || mod.type === 'letter_lock') {
          board.disruptionImmunityUntilMs = Math.max(
            board.disruptionImmunityUntilMs,
            nowMs + SABOTAGE_BALANCE_CONFIG.disruptionImmunityAfterExpireMs
          );
        }
      } else {
        remaining.push(mod);
      }
    }
    if (changed) {
      board.activeModifiers = remaining;
    }
    return changed;
  }

  private getEffectiveLockedPositions(board: StoredChangeItBoardState, nowMs: number): Set<number> {
    const locked = new Set<number>(board.restrictions.lockedPositions);
    if (
      board.restrictions.nextMoveLockedPosition !== null &&
      board.restrictions.nextMoveLockedPosition !== undefined
    ) {
      locked.add(board.restrictions.nextMoveLockedPosition);
    }
    for (const mod of board.activeModifiers) {
      if (mod.expiresAtMs !== null && nowMs >= mod.expiresAtMs) continue;
      if (
        (mod.type === 'letter_lock' || mod.type === 'frozen_letter') &&
        mod.lockedIndex !== null &&
        mod.lockedIndex !== undefined
      ) {
        locked.add(mod.lockedIndex);
      }
    }
    return locked;
  }

  private hasActiveDoubleShift(board: StoredChangeItBoardState, nowMs: number): boolean {
    return board.activeModifiers.some(
      (m) =>
        m.type === 'double_shift' &&
        (m.expiresAtMs === null || nowMs < m.expiresAtMs) &&
        (m.remainingCharges === null || m.remainingCharges > 0)
    );
  }

  // ==================== CORE GAMEPLAY: TRANSFORM / HINT / MODIFIER / FORFEIT ====================

  async submitTransformation(
    matchId: string,
    playerId: string,
    submittedWord: string,
    clientRequestId?: string
  ): Promise<{ result: ChangeItTransformResponse; matchRecord: StoredChangeItMatch }> {
    return this.store.withMatchLock(matchId, async () => {
      const existingMatch = await this.store.getMatch(matchId);
      if (!existingMatch) throw new ChangeItNotFoundError('ChangeIt match not found.');
      if (!existingMatch.boards[playerId]) {
        throw new ChangeItForbiddenError('You are not a participant in this match.');
      }

      if (clientRequestId && existingMatch.processedRequestIds[`tx:${playerId}:${clientRequestId}`]) {
        return {
          result: {
            accepted: true,
            message: 'Duplicate request ignored (already processed).',
            completedPuzzle: existingMatch.boards[playerId].completed,
            changedIndices: [],
            usedDoubleShift: false,
            match: this.sanitizeMatchForViewerRecord(existingMatch, playerId, Date.now()),
          },
          matchRecord: existingMatch,
        };
      }

      const now = Date.now();
      const data = getChangeItServerData();

      if (existingMatch.status === 'finished') {
        throw new ChangeItBadRequestError('This match has already finished.');
      }

      if (now >= existingMatch.endsAtMs) {
        const finalized = await this.finalizeExpiredMatchInternal(existingMatch, now);
        throw new ChangeItBadRequestError('Match time limit has expired.');
      }

      let responseData: {
        accepted: boolean;
        errorCode?: string;
        message: string;
        completedPuzzle: boolean;
        changedIndices: number[];
        usedDoubleShift: boolean;
        shouldFinalize: boolean;
        finishReason: string | null;
        winnerIds: string[];
        winningTeamId: ChangeItTeamId | null;
      } | null = null;

      const outcome = await this.store.mutateMatch<void>(matchId, (m) => {
        const board = m.boards[playerId];
        this.cleanupExpiredModifiers(board, now);

        if (board.completed) {
          throw new ChangeItBadRequestError('You have already completed this puzzle.');
        }
        if (board.forfeited || board.timedOut) {
          throw new ChangeItBadRequestError('You are no longer active in this match.');
        }
        if (m.mode === 'survival' && board.playerDeadlineMs !== null && now >= board.playerDeadlineMs) {
          board.timedOut = true;
          throw new ChangeItBadRequestError('Your Survival timer has expired.');
        }

        // Relay team turn validation
        if (m.mode === 'relay') {
          const teamId = m.participants[playerId]?.teamId;
          const team = teamId && m.relayTeams ? m.relayTeams[teamId] : null;
          if (!team) throw new ChangeItForbiddenError('Relay team assignment missing.');
          if (team.completed) throw new ChangeItBadRequestError('Your team already finished.');
          if (team.activeTurnPlayerId !== playerId) {
            throw new ChangeItBadRequestError("Wait for your teammate's move — not your turn.");
          }

          const check = validateMoveTransformation({
            currentWord: team.currentWord,
            submittedWord,
            targetWord: team.targetWord,
            usedWords: new Set(team.usedWords),
            validationSet: data.validationSet,
            restrictions: createEmptyRestriction(),
            lastChangedIndex: team.lastChangedIndex,
            allowDoubleShift: false,
          });

          if (!check.valid) {
            team.invalidAttempts++;
            board.invalidAttempts++;
            m.updatedAt = now;
            responseData = {
              accepted: false,
              errorCode: check.errorCode,
              message: check.message,
              completedPuzzle: false,
              changedIndices: check.changedIndices,
              usedDoubleShift: false,
              shouldFinalize: false,
              finishReason: null,
              winnerIds: [],
              winningTeamId: null,
            };
            return;
          }

          // Valid Relay move
          const entry = {
            word: check.normalizedWord,
            changedIndices: check.changedIndices,
            timestampMs: now,
            playerId,
          };
          team.currentWord = check.normalizedWord;
          team.history.push(entry);
          team.usedWords.push(check.normalizedWord);
          team.validMoves++;
          team.lastChangedIndex = check.changedIndices[0] ?? null;

          // Sync individual board stats for teammate view
          for (const memberId of team.playerIds) {
            const mb = m.boards[memberId];
            if (!mb) continue;
            mb.currentWord = team.currentWord;
            mb.history = [...team.history];
            mb.usedWords = [...team.usedWords];
            mb.validMoves = team.validMoves;
            mb.lastChangedIndex = team.lastChangedIndex;
          }

          const completed = team.currentWord === team.targetWord;
          if (completed) {
            team.completed = true;
            team.completedAtMs = now;
            for (const memberId of team.playerIds) {
              if (m.boards[memberId]) {
                m.boards[memberId].completed = true;
                m.boards[memberId].completedAtMs = now;
                m.boards[memberId].puzzlesCompleted = 1;
              }
            }
          } else {
            this.advanceRelayTeamTurn(m, team, now);
          }

          if (clientRequestId) {
            m.processedRequestIds[`tx:${playerId}:${clientRequestId}`] = true;
          }
          m.updatedAt = now;
          responseData = {
            accepted: true,
            message: completed
              ? 'Team Relay transformation complete!'
              : 'Valid step! Turn handed to teammate.',
            completedPuzzle: completed,
            changedIndices: check.changedIndices,
            usedDoubleShift: false,
            shouldFinalize: completed,
            finishReason: completed ? 'relay_completed' : null,
            winnerIds: completed ? [...team.playerIds] : [],
            winningTeamId: completed ? team.teamId : null,
          };
          return;
        }

        // Standard / Sprint / Precision / TugOfWar / Survival / Restricted / Sabotage / Adventure
        const allowDoubleShift = this.hasActiveDoubleShift(board, now);
        const lockedPos = this.getEffectiveLockedPositions(board, now);

        const check = validateMoveTransformation({
          currentWord: board.currentWord,
          submittedWord,
          targetWord: board.targetWord,
          usedWords: new Set(board.usedWords),
          validationSet: data.validationSet,
          restrictions: board.restrictions,
          lastChangedIndex: board.lastChangedIndex,
          allowDoubleShift,
          extraLockedPositions: lockedPos,
        });

        if (!check.valid) {
          board.invalidAttempts++;
          m.updatedAt = now;
          responseData = {
            accepted: false,
            errorCode: check.errorCode,
            message: check.message,
            completedPuzzle: false,
            changedIndices: check.changedIndices,
            usedDoubleShift: false,
            shouldFinalize: false,
            finishReason: null,
            winnerIds: [],
            winningTeamId: null,
          };
          return;
        }

        // Valid move!
        board.currentWord = check.normalizedWord;
        board.history.push({
          word: check.normalizedWord,
          changedIndices: check.changedIndices,
          timestampMs: now,
          playerId,
          usedDoubleShift: check.usedDoubleShift,
        });
        board.usedWords.push(check.normalizedWord);
        board.validMoves++;
        board.activeHintWord = null;
        board.restrictions.nextMoveLockedPosition = null;
        board.lastChangedIndex =
          check.changedIndices.length === 1 ? check.changedIndices[0] : null;

        if (check.usedDoubleShift) {
          const dsMod = board.activeModifiers.find((am) => am.type === 'double_shift');
          if (dsMod && dsMod.remainingCharges !== null) {
            dsMod.remainingCharges = Math.max(0, dsMod.remainingCharges - 1);
          }
          this.cleanupExpiredModifiers(board, now);
        }

        // Earn modifier charge in Sabotage / modifier-enabled modes
        if (m.modifiersEnabled) {
          board.modifierProgress++;
          if (
            board.modifierProgress >= SABOTAGE_BALANCE_CONFIG.movesPerCharge &&
            board.heldModifiers.length < SABOTAGE_BALANCE_CONFIG.maxHeldModifiers
          ) {
            board.modifierProgress = 0;
            const modPick =
              SABOTAGE_MODIFIER_POOL[
                Math.floor(Math.random() * SABOTAGE_MODIFIER_POOL.length)
              ];
            board.heldModifiers.push(modPick);
          }
        }

        if (clientRequestId) {
          m.processedRequestIds[`tx:${playerId}:${clientRequestId}`] = true;
        }

        const reachedTarget = board.currentWord === board.targetWord;
        if (!reachedTarget) {
          m.updatedAt = now;
          responseData = {
            accepted: true,
            message: check.message,
            completedPuzzle: false,
            changedIndices: check.changedIndices,
            usedDoubleShift: check.usedDoubleShift,
            shouldFinalize: false,
            finishReason: null,
            winnerIds: [],
            winningTeamId: null,
          };
          return;
        }

        // Player reached their target word!
        if (m.mode === 'survival') {
          board.puzzlesCompleted++;
          const puzzleMoves = Math.max(1, board.history.length);
          const effRatio = Math.min(1, board.minMoves / puzzleMoves);
          board.survivalScore += 100 + Math.round(50 * effRatio);

          if (board.playerDeadlineMs !== null) {
            const bonusMs = SABOTAGE_BALANCE_CONFIG.survivalBonusSeconds * 1000;
            const maxCap = now + SABOTAGE_BALANCE_CONFIG.survivalMaxRemainingSeconds * 1000;
            board.playerDeadlineMs = Math.min(maxCap, board.playerDeadlineMs + bonusMs);
          }

          // Advance to next step on shared Survival chain
          board.survivalChainIndex++;
          if (!m.survivalChain) m.survivalChain = [];
          while (m.survivalChain.length <= board.survivalChainIndex) {
            const prevStep = m.survivalChain[m.survivalChain.length - 1];
            const fromW = prevStep ? prevStep.targetWord : board.currentWord;
            const cfg = DIFFICULTY_CONFIGS[m.difficulty];
            const usedK = new Set(m.survivalChain.map((s) => s.canonicalKey));
            const nextStep = extendSurvivalChain(
              data,
              fromW,
              m.wordLength,
              Math.max(2, Math.min(cfg.minMoves, 5)),
              Math.max(4, Math.min(cfg.maxMoves, 7)),
              usedK,
              new Set()
            );
            m.survivalChain.push({
              startWord: fromW,
              targetWord: nextStep.targetWord,
              minMoves: nextStep.minMoves,
              canonicalKey: nextStep.canonicalKey,
            });
          }

          const nextChainStep = m.survivalChain[board.survivalChainIndex];
          board.startWord = board.currentWord;
          board.targetWord = nextChainStep.targetWord;
          board.minMoves += nextChainStep.minMoves;
          board.usedWords = [board.currentWord];
          board.lastChangedIndex = null;
          board.puzzleStartedAtMs = now;

          m.updatedAt = now;
          responseData = {
            accepted: true,
            message: `Solved! +${SABOTAGE_BALANCE_CONFIG.survivalBonusSeconds}s bonus time! Next target: ${board.targetWord}`,
            completedPuzzle: true,
            changedIndices: check.changedIndices,
            usedDoubleShift: check.usedDoubleShift,
            shouldFinalize: false,
            finishReason: null,
            winnerIds: [],
            winningTeamId: null,
          };
          return;
        }

        // Standard completion modes
        board.completed = true;
        board.completedAtMs = now;
        board.puzzlesCompleted = 1;
        board.activeModifiers = [];

        if (m.mode === 'classic_precision') {
          // NEVER end match when first player finishes unless ALL active players are done
          const remainingActive = m.participantOrder.filter((pid) => {
            const b = m.boards[pid];
            return b && !b.completed && !b.forfeited && !b.timedOut;
          });
          const allDone = remainingActive.length === 0;
          const resolution = allDone ? this.computeMatchResolution(m) : null;
          m.updatedAt = now;
          responseData = {
            accepted: true,
            message: allDone
              ? 'Puzzle completed! Finalizing Precision results.'
              : 'Puzzle solved! Waiting for opponents to finish or timer to expire.',
            completedPuzzle: true,
            changedIndices: check.changedIndices,
            usedDoubleShift: check.usedDoubleShift,
            shouldFinalize: allDone,
            finishReason: resolution?.finishReason ?? null,
            winnerIds: resolution?.winnerIds ?? [],
            winningTeamId: null,
          };
          return;
        }

        // Sprint / Tug of War / Restricted / Sabotage / Solo Adventure -> immediate win!
        m.updatedAt = now;
        responseData = {
          accepted: true,
          message: `Target "${board.targetWord}" reached!`,
          completedPuzzle: true,
          changedIndices: check.changedIndices,
          usedDoubleShift: check.usedDoubleShift,
          shouldFinalize: true,
          finishReason: m.mode === 'solo_adventure' ? 'adventure_completed' : 'completed_first',
          winnerIds: [playerId],
          winningTeamId: null,
        };
      });

      if (!outcome || !responseData) {
        throw new ChangeItNotFoundError('ChangeIt match not found.');
      }

      const resp = responseData as {
        accepted: boolean;
        errorCode?: string;
        message: string;
        completedPuzzle: boolean;
        changedIndices: number[];
        usedDoubleShift: boolean;
        shouldFinalize: boolean;
        finishReason: string | null;
        winnerIds: string[];
        winningTeamId: ChangeItTeamId | null;
      };

      let latestMatch = outcome.match;
      if (resp.shouldFinalize) {
        latestMatch = await this.finalizeMatchInternal(
          latestMatch,
          resp.winnerIds,
          resp.winningTeamId,
          resp.finishReason || 'completed',
          now
        );
      }

      return {
        result: {
          accepted: resp.accepted,
          errorCode: resp.errorCode,
          message: resp.message,
          completedPuzzle: resp.completedPuzzle,
          changedIndices: resp.changedIndices,
          usedDoubleShift: resp.usedDoubleShift,
          match: this.sanitizeMatchForViewerRecord(latestMatch, playerId, now),
        },
        matchRecord: latestMatch,
      };
    });
  }

  private advanceRelayTeamTurn(
    match: StoredChangeItMatch,
    team: StoredChangeItRelayTeam,
    nowMs: number
  ): void {
    if (team.playerIds.length === 0) {
      team.activeTurnPlayerId = null;
      team.turnDeadlineMs = null;
      return;
    }
    const onlineMembers = team.playerIds.filter((pid) => this.isPlayerOnline(pid));
    let nextIdx = (team.activeTurnIndex + 1) % team.playerIds.length;
    if (onlineMembers.length > 0) {
      for (let step = 1; step <= team.playerIds.length; step++) {
        const candidateIdx = (team.activeTurnIndex + step) % team.playerIds.length;
        if (this.isPlayerOnline(team.playerIds[candidateIdx])) {
          nextIdx = candidateIdx;
          break;
        }
      }
    }
    team.activeTurnIndex = nextIdx;
    team.activeTurnPlayerId = team.playerIds[nextIdx];
    team.turnDeadlineMs = nowMs + match.relayTurnSeconds * 1000;
  }

  async useHint(matchId: string, playerId: string): Promise<StoredChangeItMatch> {
    return this.store.withMatchLock(matchId, async () => {
      const data = getChangeItServerData();
      const now = Date.now();
      const outcome = await this.store.mutateMatch<StoredChangeItMatch>(matchId, (m) => {
        if (m.status !== 'playing') throw new ChangeItBadRequestError('Match is already finished.');
        if (m.isRanked || !m.hintsAllowed) {
          throw new ChangeItForbiddenError('Hints are disabled in this match.');
        }
        const board = m.boards[playerId];
        if (!board) throw new ChangeItForbiddenError('Not a participant in this match.');
        if (board.completed || board.forfeited || board.timedOut) {
          throw new ChangeItBadRequestError('Cannot request a hint right now.');
        }

        this.cleanupExpiredModifiers(board, now);
        const lockedPos = this.getEffectiveLockedPositions(board, now);
        const len = board.currentWord.length as ChangeItWordLength;
        const bfsOpts = {
          excludedWords: new Set(board.usedWords),
          lockedPositions: lockedPos,
          forbiddenLetters: new Set(board.restrictions.forbiddenLetters),
          noConsecutiveSamePosition: board.restrictions.noConsecutiveSamePosition,
          initialLastChangedIndex: board.lastChangedIndex,
        };

        let hintRes = bfsShortestPath(
          data.validationGraphs[len],
          board.currentWord,
          board.targetWord,
          bfsOpts
        );
        if (!hintRes.solvable || hintRes.optimalNextWords.length === 0) {
          hintRes = bfsShortestPath(
            data.validationGraphs[len],
            board.currentWord,
            board.targetWord,
            { excludedWords: new Set(board.usedWords) }
          );
        }
        if (!hintRes.solvable || hintRes.optimalNextWords.length === 0) {
          throw new ChangeItBadRequestError('No valid next step available from your current word.');
        }

        board.hintsUsed++;
        board.activeHintWord = hintRes.optimalNextWords[0];
        m.updatedAt = now;
        return m;
      });
      if (!outcome) throw new ChangeItNotFoundError('ChangeIt match not found.');
      return outcome.match;
    });
  }

  async activateModifier(
    matchId: string,
    playerId: string,
    modifierType: ChangeItModifierType,
    targetPlayerId?: string,
    clientRequestId?: string
  ): Promise<{ result: ChangeItModifierResponse; matchRecord: StoredChangeItMatch }> {
    return this.store.withMatchLock(matchId, async () => {
      const existing = await this.store.getMatch(matchId);
      if (!existing) throw new ChangeItNotFoundError('ChangeIt match not found.');
      if (existing.isRanked || !existing.modifiersEnabled) {
        throw new ChangeItForbiddenError('Modifiers are not enabled in this match.');
      }
      if (existing.status !== 'playing') {
        throw new ChangeItBadRequestError('Match has already ended.');
      }
      if (!existing.boards[playerId]) {
        throw new ChangeItForbiddenError('Not a participant in this match.');
      }

      if (clientRequestId && existing.processedRequestIds[`mod:${playerId}:${clientRequestId}`]) {
        return {
          result: {
            activated: true,
            message: 'Modifier already applied.',
            match: this.sanitizeMatchForViewerRecord(existing, playerId, Date.now()),
          },
          matchRecord: existing,
        };
      }

      const now = Date.now();
      const data = getChangeItServerData();
      const def = MODIFIER_CATALOG[modifierType];
      if (!def) throw new ChangeItBadRequestError('Unknown modifier type.');

      let feedbackMsg = '';

      const outcome = await this.store.mutateMatch<StoredChangeItMatch>(matchId, (m) => {
        const selfBoard = m.boards[playerId];
        this.cleanupExpiredModifiers(selfBoard, now);

        if (selfBoard.completed || selfBoard.forfeited || selfBoard.timedOut) {
          throw new ChangeItBadRequestError('You cannot activate modifiers right now.');
        }

        const modIdx = selfBoard.heldModifiers.indexOf(modifierType);
        if (modIdx === -1) {
          throw new ChangeItBadRequestError(`You do not have a ${def.name} charge.`);
        }

        const cdUntil = selfBoard.modifierCooldowns[modifierType] ?? 0;
        if (now < cdUntil) {
          const secs = Math.ceil((cdUntil - now) / 1000);
          throw new ChangeItBadRequestError(`${def.name} is on cooldown (${secs}s).`);
        }

        // Resolve target player
        let resolvedTargetId = playerId;
        if (def.targetKind === 'opponent') {
          const activeOpps = m.participantOrder.filter((pid) => {
            const ob = m.boards[pid];
            return pid !== playerId && ob && !ob.completed && !ob.forfeited && !ob.timedOut;
          });
          if (activeOpps.length === 0) {
            throw new ChangeItBadRequestError('No active opponents available to target.');
          }
          if (targetPlayerId && activeOpps.includes(targetPlayerId)) {
            resolvedTargetId = targetPlayerId;
          } else {
            // Default: target leading active opponent
            resolvedTargetId = activeOpps.sort(
              (a, b) =>
                this.computeBoardProgress(m.boards[b]) - this.computeBoardProgress(m.boards[a])
            )[0];
          }
        }

        const targetBoard = m.boards[resolvedTargetId];
        this.cleanupExpiredModifiers(targetBoard, now);

        const modId = `mod_${now}_${crypto.randomBytes(2).toString('hex')}`;
        const len = targetBoard.currentWord.length as ChangeItWordLength;
        const valGraph = data.validationGraphs[len];

        if (modifierType === 'double_shift') {
          if (this.hasActiveDoubleShift(selfBoard, now)) {
            throw new ChangeItBadRequestError('Double Shift is already active on your board.');
          }
          selfBoard.activeModifiers.push({
            id: modId,
            type: 'double_shift',
            sourcePlayerId: playerId,
            targetPlayerId: playerId,
            activatedAtMs: now,
            expiresAtMs: now + (def.durationMs ?? 20000),
            remainingCharges: 1,
            description: def.description,
          });
          feedbackMsg = 'Double Shift active! Your next move may change 1 or 2 letters.';
        } else if (modifierType === 'pathfinder') {
          const lockedPos = this.getEffectiveLockedPositions(selfBoard, now);
          const hintRes = bfsShortestPath(
            valGraph,
            selfBoard.currentWord,
            selfBoard.targetWord,
            {
              excludedWords: new Set(selfBoard.usedWords),
              lockedPositions: lockedPos,
              forbiddenLetters: new Set(selfBoard.restrictions.forbiddenLetters),
              noConsecutiveSamePosition: selfBoard.restrictions.noConsecutiveSamePosition,
              initialLastChangedIndex: selfBoard.lastChangedIndex,
            }
          );
          if (!hintRes.solvable || hintRes.optimalNextWords.length === 0) {
            throw new ChangeItBadRequestError('No optimal path step available right now.');
          }
          const nextWord = hintRes.optimalNextWords[0];
          selfBoard.activeHintWord = nextWord;
          selfBoard.activeModifiers.push({
            id: modId,
            type: 'pathfinder',
            sourcePlayerId: playerId,
            targetPlayerId: playerId,
            activatedAtMs: now,
            expiresAtMs: now + 8000,
            remainingCharges: 1,
            hintWord: nextWord,
            description: `Optimal next step: ${nextWord}`,
          });
          feedbackMsg = `Pathfinder revealed optimal step: ${nextWord}`;
        } else if (modifierType === 'letter_lock' || modifierType === 'frozen_letter') {
          const activeDisruptions = targetBoard.activeModifiers.filter(
            (am) => am.type === 'letter_lock' || am.type === 'frozen_letter'
          ).length;
          if (activeDisruptions >= SABOTAGE_BALANCE_CONFIG.maxActiveDisruptionsPerTarget) {
            throw new ChangeItBadRequestError('Target already has an active letter lock.');
          }
          if (now < targetBoard.disruptionImmunityUntilMs) {
            throw new ChangeItBadRequestError('Target has brief lock immunity.');
          }

          const existingLocks = this.getEffectiveLockedPositions(targetBoard, now);
          const usedSet = new Set(targetBoard.usedWords);
          const forbiddenSet = new Set(targetBoard.restrictions.forbiddenLetters);
          const safeIndices: number[] = [];

          for (let pos = 0; pos < len; pos++) {
            if (existingLocks.has(pos)) continue;
            // Verify locking `pos` preserves a solvable path from currentWord -> targetWord
            // avoiding usedWords AND leaves at least 1 immediate neighbor available
            const testLocks = new Set(existingLocks);
            testLocks.add(pos);
            const pathRes = bfsShortestPath(
              valGraph,
              targetBoard.currentWord,
              targetBoard.targetWord,
              {
                excludedWords: usedSet,
                lockedPositions: testLocks,
                forbiddenLetters: forbiddenSet,
                noConsecutiveSamePosition: targetBoard.restrictions.noConsecutiveSamePosition,
                initialLastChangedIndex: targetBoard.lastChangedIndex,
              }
            );
            if (pathRes.solvable && pathRes.minMoves >= 1) {
              safeIndices.push(pos);
            }
          }

          if (safeIndices.length === 0) {
            throw new ChangeItBadRequestError(
              'Cannot freeze/lock a letter right now without risking a softlock.'
            );
          }

          const chosenIndex = safeIndices[Math.floor(Math.random() * safeIndices.length)];
          targetBoard.activeModifiers.push({
            id: modId,
            type: modifierType,
            sourcePlayerId: playerId,
            targetPlayerId: resolvedTargetId,
            activatedAtMs: now,
            expiresAtMs: now + (def.durationMs ?? 10000),
            remainingCharges: null,
            lockedIndex: chosenIndex,
            description: `Slot #${chosenIndex + 1} (${targetBoard.currentWord[chosenIndex]}) locked`,
          });
          feedbackMsg = `${def.name} locked slot #${chosenIndex + 1} on ${
            m.participants[resolvedTargetId]?.username || 'opponent'
          }!`;
        } else if (modifierType === 'reroute') {
          const existingLocks = this.getEffectiveLockedPositions(targetBoard, now);
          const usedSet = new Set(targetBoard.usedWords);
          const forbiddenSet = new Set(targetBoard.restrictions.forbiddenLetters);
          const curDistRes = bfsShortestPath(
            valGraph,
            targetBoard.currentWord,
            targetBoard.targetWord,
            { excludedWords: usedSet, lockedPositions: existingLocks, forbiddenLetters: forbiddenSet }
          );
          const remainingDist = curDistRes.solvable
            ? Math.max(2, curDistRes.minMoves)
            : Math.max(2, targetBoard.minMoves - targetBoard.validMoves);

          const reroutePick = findEquivalentRerouteTarget(
            data,
            targetBoard.currentWord,
            targetBoard.targetWord,
            remainingDist,
            usedSet,
            existingLocks,
            forbiddenSet
          );
          if (!reroutePick) {
            throw new ChangeItBadRequestError('No equivalent reachable Reroute target found.');
          }

          const previousTarget = targetBoard.targetWord;
          targetBoard.targetWord = reroutePick.targetWord;
          targetBoard.minMoves = targetBoard.validMoves + reroutePick.minMoves;
          targetBoard.activeHintWord = null;
          targetBoard.activeModifiers.push({
            id: modId,
            type: 'reroute',
            sourcePlayerId: playerId,
            targetPlayerId: resolvedTargetId,
            activatedAtMs: now,
            expiresAtMs: now + 6000,
            remainingCharges: null,
            previousTarget,
            newTarget: reroutePick.targetWord,
            description: `Target rerouted to ${reroutePick.targetWord}`,
          });
          feedbackMsg = `Rerouted ${
            m.participants[resolvedTargetId]?.username || 'opponent'
          }'s target!`;
        }

        // Consume charge & set cooldown
        selfBoard.heldModifiers.splice(modIdx, 1);
        selfBoard.modifierCooldowns[modifierType] = now + def.cooldownMs;
        if (clientRequestId) {
          m.processedRequestIds[`mod:${playerId}:${clientRequestId}`] = true;
        }
        m.updatedAt = now;
        return m;
      });

      if (!outcome) throw new ChangeItNotFoundError('ChangeIt match not found.');
      return {
        result: {
          activated: true,
          message: feedbackMsg,
          match: this.sanitizeMatchForViewerRecord(outcome.match, playerId, now),
        },
        matchRecord: outcome.match,
      };
    });
  }

  async forfeitMatch(matchId: string, playerId: string): Promise<StoredChangeItMatch> {
    return this.store.withMatchLock(matchId, async () => {
      const now = Date.now();
      let resolution: {
        shouldFinalize: boolean;
        winnerIds: string[];
        winningTeamId: ChangeItTeamId | null;
        finishReason: string;
      } = {
        shouldFinalize: false,
        winnerIds: [],
        winningTeamId: null,
        finishReason: 'forfeit',
      };

      const outcome = await this.store.mutateMatch<StoredChangeItMatch>(matchId, (m) => {
        const board = m.boards[playerId];
        if (!board) throw new ChangeItForbiddenError('Not a participant in this match.');
        if (m.status === 'finished') return m;

        board.forfeited = true;
        board.activeModifiers = [];
        m.updatedAt = now;

        if (m.mode === 'solo_adventure') {
          resolution = {
            shouldFinalize: true,
            winnerIds: [],
            winningTeamId: null,
            finishReason: 'forfeit',
          };
          return m;
        }

        if (m.mode === 'relay' && m.relayTeams) {
          const myTeamId = m.participants[playerId]?.teamId;
          const oppTeamId: ChangeItTeamId = myTeamId === 'blue' ? 'red' : 'blue';
          const myTeamActive = (myTeamId ? m.relayTeams[myTeamId].playerIds : []).some(
            (pid) => !m.boards[pid]?.forfeited
          );
          if (!myTeamActive) {
            resolution = {
              shouldFinalize: true,
              winnerIds: [...m.relayTeams[oppTeamId].playerIds],
              winningTeamId: oppTeamId,
              finishReason: 'opponent_forfeited',
            };
          } else if (myTeamId && m.relayTeams[myTeamId].activeTurnPlayerId === playerId) {
            this.advanceRelayTeamTurn(m, m.relayTeams[myTeamId], now);
          }
          return m;
        }

        const nonForfeited = m.participantOrder.filter((pid) => !m.boards[pid]?.forfeited);
        if (nonForfeited.length <= 1) {
          if (m.mode === 'classic_precision') {
            const comp = this.computeMatchResolution(m);
            resolution = {
              shouldFinalize: true,
              winnerIds: comp.winnerIds,
              winningTeamId: null,
              finishReason: 'forfeit',
            };
          } else {
            resolution = {
              shouldFinalize: true,
              winnerIds: nonForfeited,
              winningTeamId: null,
              finishReason: 'opponent_forfeited',
            };
          }
        } else if (m.mode === 'classic_precision') {
          const remainingIncomplete = nonForfeited.filter(
            (pid) => !m.boards[pid].completed && !m.boards[pid].timedOut
          );
          if (remainingIncomplete.length === 0) {
            const comp = this.computeMatchResolution(m);
            resolution = {
              shouldFinalize: true,
              winnerIds: comp.winnerIds,
              winningTeamId: null,
              finishReason: comp.finishReason,
            };
          }
        }
        return m;
      });

      if (!outcome) throw new ChangeItNotFoundError('Match not found.');
      if (resolution.shouldFinalize) {
        return this.finalizeMatchInternal(
          outcome.match,
          resolution.winnerIds,
          resolution.winningTeamId,
          resolution.finishReason,
          now
        );
      }
      return outcome.match;
    });
  }

  async addMatchChat(
    matchId: string,
    playerId: string,
    text: string
  ): Promise<StoredChangeItMatch> {
    const clean = String(text || '').trim().slice(0, 180);
    if (!clean) throw new ChangeItBadRequestError('Chat message cannot be empty.');
    const outcome = await this.store.mutateMatch<StoredChangeItMatch>(matchId, (m) => {
      const meta = m.participants[playerId];
      if (!meta) throw new ChangeItForbiddenError('Not a participant in this match.');
      m.messages.push({
        id: `ci_mc_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
        senderId: playerId,
        senderName: meta.username,
        senderAvatar: meta.avatarId,
        text: clean,
        createdAt: Date.now(),
      });
      if (m.messages.length > 80) m.messages = m.messages.slice(-80);
      m.updatedAt = Date.now();
      return m;
    });
    if (!outcome) throw new ChangeItNotFoundError('Match not found.');
    return outcome.match;
  }

  async rematch(matchId: string, playerId: string): Promise<StoredChangeItMatch> {
    const oldMatch = await this.store.getMatch(matchId);
    if (!oldMatch) throw new ChangeItNotFoundError('Match not found.');
    if (!oldMatch.boards[playerId]) throw new ChangeItForbiddenError('Not a participant.');
    if (oldMatch.mode === 'solo_adventure') {
      return this.retryAdventureMatch(matchId, playerId);
    }

    const players = oldMatch.participantOrder.map((pid) => {
      const meta = oldMatch.participants[pid];
      return {
        playerId: pid,
        username: meta.username,
        avatarId: meta.avatarId,
        isGuest: meta.isGuest,
        teamId: meta.teamId ?? 'blue',
      };
    });

    const room = oldMatch.roomId ? await this.store.getRoom(oldMatch.roomId) : null;
    const next = await this.buildMultiplayerMatchRecord({
      roomId: oldMatch.roomId,
      mode: oldMatch.mode,
      difficulty: oldMatch.difficulty,
      wordLength: room?.settings.wordLength ?? oldMatch.wordLength,
      timeLimitSeconds: Math.max(
        45,
        Math.round((oldMatch.endsAtMs - oldMatch.startedAtMs) / 1000)
      ),
      isRanked: oldMatch.isRanked,
      modifiersEnabled: oldMatch.modifiersEnabled,
      hintsAllowed: oldMatch.hintsAllowed,
      relayTurnSeconds: oldMatch.relayTurnSeconds,
      players,
    });

    if (oldMatch.roomId) {
      await this.store.mutateRoom(oldMatch.roomId, (rm) => {
        rm.status = 'in_progress';
        rm.activeMatchId = next.id;
        rm.updatedAt = Date.now();
        return { result: rm };
      });
    }

    return next;
  }

  // ==================== TIMERS, RESOLUTION & RATING ====================

  async processExpiredTimers(): Promise<StoredChangeItMatch[]> {
    const active = this.store.listMemActiveMatches();
    const updated: StoredChangeItMatch[] = [];
    const now = Date.now();

    for (const m of active) {
      if (m.status !== 'playing') continue;
      const needsTick =
        now >= m.endsAtMs ||
        (m.mode === 'survival' &&
          Object.values(m.boards).some(
            (b) => !b.timedOut && !b.forfeited && b.playerDeadlineMs !== null && now >= b.playerDeadlineMs
          )) ||
        (m.mode === 'relay' &&
          m.relayTeams &&
          (['blue', 'red'] as const).some((tid) => {
            const t = m.relayTeams![tid];
            return (
              !t.completed &&
              ((t.turnDeadlineMs !== null && now >= t.turnDeadlineMs) ||
                (t.activeTurnPlayerId !== null &&
                  !this.isPlayerOnline(t.activeTurnPlayerId) &&
                  t.playerIds.some((pid) => pid !== t.activeTurnPlayerId && this.isPlayerOnline(pid))))
            );
          })) ||
        Object.values(m.boards).some((b) =>
          b.activeModifiers.some((am) => am.expiresAtMs !== null && now >= am.expiresAtMs)
        );

      if (!needsTick) continue;

      const res = await this.store.withMatchLock(m.id, async () => {
        const latest = await this.store.getMatch(m.id);
        if (!latest || latest.status !== 'playing') return null;

        if (now >= latest.endsAtMs) {
          return this.finalizeExpiredMatchInternal(latest, now);
        }

        let mutated = false;
        let allSurvivalDone = false;

        const out = await this.store.mutateMatch<StoredChangeItMatch>(latest.id, (copy) => {
          for (const b of Object.values(copy.boards)) {
            if (this.cleanupExpiredModifiers(b, now)) mutated = true;
            if (
              copy.mode === 'survival' &&
              !b.timedOut &&
              !b.forfeited &&
              b.playerDeadlineMs !== null &&
              now >= b.playerDeadlineMs
            ) {
              b.timedOut = true;
              mutated = true;
            }
          }

          if (copy.mode === 'survival') {
            allSurvivalDone = copy.participantOrder.every(
              (pid) => copy.boards[pid]?.timedOut || copy.boards[pid]?.forfeited
            );
          }

          if (copy.mode === 'relay' && copy.relayTeams) {
            for (const tid of ['blue', 'red'] as const) {
              const t = copy.relayTeams[tid];
              if (t.completed) continue;
              const activeOfflineWithOnlineMate =
                t.activeTurnPlayerId !== null &&
                !this.isPlayerOnline(t.activeTurnPlayerId) &&
                t.playerIds.some((pid) => pid !== t.activeTurnPlayerId && this.isPlayerOnline(pid));
              if ((t.turnDeadlineMs !== null && now >= t.turnDeadlineMs) || activeOfflineWithOnlineMate) {
                this.advanceRelayTeamTurn(copy, t, now);
                mutated = true;
              }
            }
          }

          if (mutated) copy.updatedAt = now;
          return copy;
        });

        if (!out) return null;
        if (allSurvivalDone) {
          return this.finalizeExpiredMatchInternal(out.match, now);
        }
        return mutated ? out.match : null;
      });

      if (res) updated.push(res);
    }

    return updated;
  }

  private computeBoardEfficiency(board: StoredChangeItBoardState): number {
    if (board.validMoves <= 0) return 0;
    const refMoves = Math.max(1, board.minMoves);
    return Math.min(100, Math.round((refMoves / board.validMoves) * 100));
  }

  private computeBoardProgress(board: StoredChangeItBoardState): number {
    if (board.completed) return 100;
    const data = getChangeItServerData();
    const len = board.currentWord.length as ChangeItWordLength;
    const remRes = bfsShortestPath(
      data.validationGraphs[len],
      board.currentWord,
      board.targetWord
    );
    if (!remRes.solvable) {
      return Math.min(95, Math.round((board.validMoves / Math.max(1, board.minMoves)) * 80));
    }
    const totalEst = Math.max(1, board.minMoves);
    const pct = Math.round(((totalEst - remRes.minMoves) / totalEst) * 100);
    return Math.max(0, Math.min(95, pct));
  }

  private computeMatchResolution(match: StoredChangeItMatch): {
    winnerIds: string[];
    winningTeamId: ChangeItTeamId | null;
    finishReason: string;
  } {
    if (match.mode === 'relay' && match.relayTeams) {
      const b = match.relayTeams.blue;
      const r = match.relayTeams.red;
      if (b.completed && !r.completed) {
        return { winnerIds: [...b.playerIds], winningTeamId: 'blue', finishReason: 'relay_completed' };
      }
      if (r.completed && !b.completed) {
        return { winnerIds: [...r.playerIds], winningTeamId: 'red', finishReason: 'relay_completed' };
      }
      if (b.validMoves > r.validMoves) {
        return { winnerIds: [...b.playerIds], winningTeamId: 'blue', finishReason: 'timeout_progress' };
      }
      if (r.validMoves > b.validMoves) {
        return { winnerIds: [...r.playerIds], winningTeamId: 'red', finishReason: 'timeout_progress' };
      }
      return { winnerIds: [], winningTeamId: null, finishReason: 'draw' };
    }

    if (match.mode === 'classic_precision') {
      const active = match.participantOrder.filter((pid) => !match.boards[pid]?.forfeited);
      const completed = active.filter((pid) => match.boards[pid]?.completed);
      if (completed.length > 0) {
        completed.sort((a, b) => {
          const ba = match.boards[a];
          const bb = match.boards[b];
          if (ba.validMoves !== bb.validMoves) return ba.validMoves - bb.validMoves;
          return (ba.completedAtMs ?? Infinity) - (bb.completedAtMs ?? Infinity);
        });
        const best = match.boards[completed[0]];
        const tied = completed.filter(
          (pid) =>
            match.boards[pid].validMoves === best.validMoves &&
            match.boards[pid].completedAtMs === best.completedAtMs
        );
        return {
          winnerIds: tied,
          winningTeamId: null,
          finishReason: tied.length > 1 ? 'draw' : 'precision_efficiency',
        };
      }
      // Nobody completed before deadline -> rank by progress then fewer moves
      const ranked = [...active].sort((a, b) => {
        const pa = this.computeBoardProgress(match.boards[a]);
        const pb = this.computeBoardProgress(match.boards[b]);
        if (pa !== pb) return pb - pa;
        return match.boards[a].validMoves - match.boards[b].validMoves;
      });
      if (ranked.length >= 2) {
        const p0 = this.computeBoardProgress(match.boards[ranked[0]]);
        const p1 = this.computeBoardProgress(match.boards[ranked[1]]);
        if (p0 === p1 && p0 === 0) {
          return { winnerIds: [], winningTeamId: null, finishReason: 'draw' };
        }
        if (p0 === p1) {
          return { winnerIds: [], winningTeamId: null, finishReason: 'draw' };
        }
      }
      return {
        winnerIds: ranked.length > 0 ? [ranked[0]] : [],
        winningTeamId: null,
        finishReason: 'timeout_progress',
      };
    }

    if (match.mode === 'survival') {
      const active = match.participantOrder.filter((pid) => !match.boards[pid]?.forfeited);
      const sorted = [...active].sort((a, b) => {
        const ba = match.boards[a];
        const bb = match.boards[b];
        if (ba.puzzlesCompleted !== bb.puzzlesCompleted) {
          return bb.puzzlesCompleted - ba.puzzlesCompleted;
        }
        const ea = this.computeBoardEfficiency(ba);
        const eb = this.computeBoardEfficiency(bb);
        if (ea !== eb) return eb - ea;
        return bb.survivalScore - ba.survivalScore;
      });
      if (sorted.length >= 2) {
        const top = match.boards[sorted[0]];
        const sec = match.boards[sorted[1]];
        if (
          top.puzzlesCompleted === sec.puzzlesCompleted &&
          this.computeBoardEfficiency(top) === this.computeBoardEfficiency(sec) &&
          top.survivalScore === sec.survivalScore
        ) {
          return { winnerIds: [], winningTeamId: null, finishReason: 'draw' };
        }
      }
      return {
        winnerIds: sorted.length > 0 ? [sorted[0]] : [],
        winningTeamId: null,
        finishReason: 'survival_completed',
      };
    }

    // Sprint / Tug of War / Restricted / Sabotage timeout fallback
    const active = match.participantOrder.filter((pid) => !match.boards[pid]?.forfeited);
    const completed = active.filter((pid) => match.boards[pid]?.completed);
    if (completed.length > 0) {
      completed.sort(
        (a, b) =>
          (match.boards[a].completedAtMs ?? Infinity) -
          (match.boards[b].completedAtMs ?? Infinity)
      );
      return {
        winnerIds: [completed[0]],
        winningTeamId: null,
        finishReason: 'completed_first',
      };
    }
    const sorted = [...active].sort((a, b) => {
      const pa = this.computeBoardProgress(match.boards[a]);
      const pb = this.computeBoardProgress(match.boards[b]);
      if (pa !== pb) return pb - pa;
      return match.boards[a].validMoves - match.boards[b].validMoves;
    });
    if (
      sorted.length >= 2 &&
      this.computeBoardProgress(match.boards[sorted[0]]) ===
        this.computeBoardProgress(match.boards[sorted[1]])
    ) {
      return { winnerIds: [], winningTeamId: null, finishReason: 'draw' };
    }
    return {
      winnerIds: sorted.length > 0 ? [sorted[0]] : [],
      winningTeamId: null,
      finishReason: 'timeout_progress',
    };
  }

  private async finalizeExpiredMatchInternal(
    match: StoredChangeItMatch,
    nowMs: number
  ): Promise<StoredChangeItMatch> {
    const res = this.computeMatchResolution(match);
    return this.finalizeMatchInternal(
      match,
      res.winnerIds,
      res.winningTeamId,
      res.finishReason,
      nowMs
    );
  }

  private async finalizeMatchInternal(
    match: StoredChangeItMatch,
    winnerIds: string[],
    winningTeamId: ChangeItTeamId | null,
    finishReason: string,
    nowMs: number
  ): Promise<StoredChangeItMatch> {
    if (match.status === 'finished' && match.finalizedResult) return match;

    // Preload current ratings for Elo calculation
    const existingStatsByPlayer = new Map<string, number>();
    for (const pid of match.participantOrder) {
      const st = await this.store.getPlayerStats(pid);
      existingStatsByPlayer.set(pid, st?.rating ?? 1000);
    }

    const isDraw = winnerIds.length === 0 || finishReason === 'draw';
    const ratingChanges: StoredChangeItMatch['ratingChanges'] = {};

    if (match.isRanked && match.participantOrder.length === 2) {
      const [p1, p2] = match.participantOrder;
      const r1 = existingStatsByPlayer.get(p1) ?? 1000;
      const r2 = existingStatsByPlayer.get(p2) ?? 1000;
      const e1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
      const e2 = 1 - e1;
      const s1 = isDraw ? 0.5 : winnerIds.includes(p1) ? 1 : 0;
      const s2 = isDraw ? 0.5 : winnerIds.includes(p2) ? 1 : 0;
      const K = 28;
      const next1 = Math.max(100, Math.round(r1 + K * (s1 - e1)));
      const next2 = Math.max(100, Math.round(r2 + K * (s2 - e2)));
      ratingChanges[p1] = {
        before: r1,
        after: next1,
        delta: next1 - r1,
        tier: computeRankTier(next1),
      };
      ratingChanges[p2] = {
        before: r2,
        after: next2,
        delta: next2 - r2,
        tier: computeRankTier(next2),
      };
    }

    const finalOut = await this.store.mutateMatch<StoredChangeItMatch>(match.id, (m) => {
      if (m.status === 'finished' && m.finalizedResult) return m;
      m.status = 'finished';
      m.winnerIds = [...winnerIds];
      m.winningTeamId = winningTeamId;
      m.finishReason = finishReason;
      if (Object.keys(ratingChanges).length > 0) {
        m.ratingChanges = ratingChanges;
      }
      for (const b of Object.values(m.boards)) {
        b.activeModifiers = [];
        if (!b.completed && !b.forfeited) {
          b.timedOut = true;
        }
      }
      m.finalizedResult = true;
      m.updatedAt = nowMs;
      return m;
    });

    const latest = finalOut?.match ?? match;

    // Atomic idempotent stats + match history persistence (guarded by changeit_match_results PK)
    if (latest.mode !== 'solo_adventure') {
      const participantPayloads = latest.participantOrder.map((pid) => {
        const meta = latest.participants[pid];
        const b = latest.boards[pid];
        const curRating = existingStatsByPlayer.get(pid) ?? 1000;
        const rc = ratingChanges[pid];
        const newRating = rc ? rc.after : curRating;
        const won = winnerIds.includes(pid);
        const eff = this.computeBoardEfficiency(b);
        return {
          playerId: pid,
          username: meta.username,
          avatarId: meta.avatarId,
          isGuest: meta.isGuest,
          newRating,
          rankTier: rc?.tier ?? computeRankTier(newRating),
          won,
          draw: isDraw,
          puzzlesSolved: b.puzzlesCompleted,
          efficiencyPercent: eff,
          solveTimeMs:
            b.completed && b.completedAtMs !== null
              ? Math.max(1, b.completedAtMs - latest.startedAtMs)
              : null,
          validMoves: b.validMoves,
          minMoves: b.minMoves,
        };
      });

      const finalizedRes = await this.store.finalizeMatchResultAtomic({
        matchId: latest.id,
        mode: latest.mode,
        isRanked: latest.isRanked,
        winnerIds,
        participants: participantPayloads,
      });

      // Record anti-repetition history & Enscribe reward points once per finalized match
      if (finalizedRes.finalized) {
        for (const pid of latest.participantOrder) {
          const b = latest.boards[pid];
          if (b) {
            await this.store.recordPuzzleHistory(
              pid,
              canonicalPuzzleKey(b.startWord, b.targetWord),
              [b.startWord, b.targetWord, ...b.history.map((h) => h.word)]
            );
          }
          const won = winnerIds.includes(pid);
          const rc = ratingChanges[pid];
          this.repo.updateProfileStats(pid, {
            wins: won ? 1 : 0,
            losses: !won && !isDraw ? 1 : 0,
            rankPointsDelta: rc ? rc.delta : 0,
            matchPointsDelta: won ? 50 : 15,
          });
        }
      }
    }

    if (latest.roomId) {
      await this.store.mutateRoom(latest.roomId, (rm) => {
        rm.status = 'lobby';
        rm.activeMatchId = null;
        for (const p of rm.players) {
          p.isReady = p.isHost;
        }
        rm.updatedAt = nowMs;
        return { result: rm };
      });
    }

    return latest;
  }

  // ==================== VIEWER SANITIZATION & ANTI-CHEAT ====================

  async getMatchForViewer(matchId: string, viewerId: string): Promise<ChangeItMatchStateClient> {
    const match = await this.store.getMatch(matchId);
    if (!match) throw new ChangeItNotFoundError('ChangeIt match not found.');
    if (!match.boards[viewerId]) {
      throw new ChangeItForbiddenError('You are not a participant in this match.');
    }
    return this.sanitizeMatchForViewerRecord(match, viewerId, Date.now());
  }

  getMatchAudienceIds(match: StoredChangeItMatch): string[] {
    return [...match.participantOrder];
  }

  sanitizeMatchForViewerRecord(
    match: StoredChangeItMatch,
    viewerId: string,
    nowMs = Date.now()
  ): ChangeItMatchStateClient {
    const selfBoard = match.boards[viewerId];
    if (!selfBoard) {
      throw new ChangeItForbiddenError('Access denied: not a participant.');
    }

    const isFinished = match.status === 'finished';
    const elapsedMs = Math.max(
      0,
      (selfBoard.completedAtMs ?? nowMs) - match.startedAtMs
    );

    const opponents: ChangeItOpponentSummaryView[] = match.participantOrder
      .filter((pid) => pid !== viewerId)
      .map((pid) => {
        const meta = match.participants[pid];
        const b = match.boards[pid];
        return {
          playerId: pid,
          username: meta.username,
          avatarId: meta.avatarId,
          teamId: meta.teamId,
          isOnline: this.isPlayerOnline(pid),
          validMoves: b.validMoves,
          invalidAttempts: b.invalidAttempts,
          progressPercent: this.computeBoardProgress(b),
          completed: b.completed,
          completedAtMs: b.completedAtMs,
          forfeited: b.forfeited,
          timedOut: b.timedOut,
          isWinner: match.winnerIds.includes(pid),
          puzzlesCompleted: b.puzzlesCompleted,
          survivalScore: b.survivalScore,
          efficiencyPercent: this.computeBoardEfficiency(b),
          activeModifiers: b.activeModifiers.map(({ hintWord: _h, ...rest }) => rest),
          // NEVER expose opponent transformation history while match is active
          revealedHistory: isFinished ? [...b.history] : undefined,
        };
      });

    let relayTeams: ChangeItMatchStateClient['relayTeams'] = null;
    if (match.mode === 'relay' && match.relayTeams) {
      const viewerTeamId = match.participants[viewerId]?.teamId;
      const mapTeam = (tid: ChangeItTeamId): ChangeItRelayTeamView => {
        const t = match.relayTeams![tid];
        const canSeeChain = isFinished || viewerTeamId === tid;
        return {
          teamId: tid,
          playerIds: [...t.playerIds],
          activeTurnPlayerId: t.activeTurnPlayerId,
          turnDeadlineMs: t.turnDeadlineMs,
          currentWord: canSeeChain ? t.currentWord : null,
          startWord: canSeeChain ? t.startWord : null,
          targetWord: canSeeChain ? t.targetWord : null,
          minMoves: t.minMoves,
          history: canSeeChain ? [...t.history] : undefined,
          validMoves: t.validMoves,
          invalidAttempts: t.invalidAttempts,
          progressPercent: t.completed
            ? 100
            : Math.min(95, Math.round((t.validMoves / Math.max(1, t.minMoves)) * 90)),
          completed: t.completed,
          completedAtMs: t.completedAtMs,
        };
      };
      relayTeams = {
        blue: mapTeam('blue'),
        red: mapTeam('red'),
      };
    }

    return {
      id: match.id,
      roomId: match.roomId,
      mode: match.mode,
      difficulty: match.difficulty,
      wordLength: match.wordLength,
      isRanked: match.isRanked,
      modifiersEnabled: match.modifiersEnabled,
      hintsAllowed: match.hintsAllowed,
      status: match.status,
      startedAtMs: match.startedAtMs,
      endsAtMs: match.endsAtMs,
      serverNowMs: nowMs,
      stageId: match.stageId ?? null,
      chapterId: match.chapterId ?? null,
      stageTitle: match.stageTitle ?? null,
      self: {
        currentWord: selfBoard.currentWord,
        startWord: selfBoard.startWord,
        targetWord: selfBoard.targetWord,
        minMoves: selfBoard.minMoves,
        history: [...selfBoard.history],
        validMoves: selfBoard.validMoves,
        invalidAttempts: selfBoard.invalidAttempts,
        elapsedMs,
        efficiencyPercent: this.computeBoardEfficiency(selfBoard),
        completed: selfBoard.completed,
        completedAtMs: selfBoard.completedAtMs,
        forfeited: selfBoard.forfeited,
        timedOut: selfBoard.timedOut,
        hintsUsed: selfBoard.hintsUsed,
        activeHintWord: selfBoard.activeHintWord,
        restrictions: JSON.parse(JSON.stringify(selfBoard.restrictions)),
        lastChangedIndex: selfBoard.lastChangedIndex,
        heldModifiers: [...selfBoard.heldModifiers],
        modifierProgress: selfBoard.modifierProgress,
        modifierCooldowns: { ...selfBoard.modifierCooldowns },
        activeModifiers: selfBoard.activeModifiers.map((m) => ({ ...m })),
        puzzlesCompleted: selfBoard.puzzlesCompleted,
        survivalScore: selfBoard.survivalScore,
        playerDeadlineMs: selfBoard.playerDeadlineMs,
      },
      opponents,
      relayTeams,
      winnerIds: [...match.winnerIds],
      winningTeamId: match.winningTeamId,
      finishReason: match.finishReason,
      ratingChanges: match.ratingChanges,
      messages: [...match.messages],
    };
  }

  // ==================== LEADERBOARD & STATS ====================

  async getLeaderboard(playerId?: string): Promise<ChangeItLeaderboardResponse> {
    const all = await this.store.listLeaderboardStats();
    const rankedLeaders = [...all].sort(
      (a, b) => b.rating - a.rating || b.rankedWins - a.rankedWins
    );
    const overallLeaders = [...all].sort(
      (a, b) =>
        b.puzzlesSolved - a.puzzlesSolved ||
        b.totalWins - a.totalWins ||
        b.bestEfficiency - a.bestEfficiency
    );
    const playerStats = playerId ? await this.store.getPlayerStats(playerId) : null;
    const recentHistory = playerId ? await this.store.listRecentHistoryForPlayer(playerId) : [];

    return {
      rankedLeaders: rankedLeaders.slice(0, 25),
      overallLeaders: overallLeaders.slice(0, 25),
      playerStats,
      recentHistory,
      guestNotice:
        'Live ChangeIt ratings & match stats persist across this session; ENGG accounts will sync rankings permanently.',
    };
  }
}
