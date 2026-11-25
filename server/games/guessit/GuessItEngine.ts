import crypto from 'node:crypto';
import {
  GUESSIT_ADVENTURE_CHAPTERS,
  GUESSIT_CATEGORIES,
  pickCrosswordForCategory,
  pickWordFromCatalog,
  validateCandidateWordEntry,
} from '../../../shared/guessit/catalog.js';
import {
  buildCrosswordClientView,
  countCrosswordLetterOccurrences,
  generateCrosswordLayout,
  isCrosswordSolved,
} from '../../../shared/guessit/crossword.js';
import {
  buildClassicClientView,
  computeAccuracyPercent,
  computePrecisionScore,
  computeWordDuelScore,
  countOccurrencesInClassic,
  isClassicSolved,
  isEnglishUpperLetter,
  validateCustomPhrase,
} from '../../../shared/guessit/normalize.js';
import {
  GuessItAdventureChapterClient,
  GuessItAdventureClaimResult,
  GuessItAdventureProgressClient,
  GuessItAdventureStage,
  GuessItCategory,
  GuessItDifficulty,
  GuessItGuessResponse,
  GuessItMatchStateClient,
  GuessItMultiplayerMode,
  GuessItParticipantClient,
  GuessItRoom,
  GuessItRoomMessage,
  GuessItRoomSettings,
  GuessItTeamId,
  GuessItWordEntry,
} from '../../../shared/guessit/types.js';
import { Profile } from '../../../shared/types.js';
import { StorageRepository } from '../../repositories/StorageRepository.js';
import {
  GuessItStateStore,
  StoredAdventureStageRow,
  StoredGuessItDuelChallenge,
  StoredGuessItMatch,
  StoredGuessItParticipantMeta,
  StoredGuessItRoom,
  StoredGuessItUnitState,
} from './GuessItStateStore.js';

export class GuessItForbiddenError extends Error {
  status = 403;
}

export class GuessItNotFoundError extends Error {
  status = 404;
}

export class GuessItBadRequestError extends Error {
  status = 400;
}

export class GuessItRateLimitError extends Error {
  status = 429;
}

const VALID_MODES: GuessItMultiplayerMode[] = [
  'speed_rush',
  'word_duel',
  'precision_clash',
  'survival_royale',
  'team_relay',
];

export class GuessItEngine {
  private store: GuessItStateStore;
  private resolveProfileFn?: (playerId: string) => Promise<Profile | null>;
  private recentAnswersByPlayer = new Map<string, string[]>();

  private getRecentAnswersForPlayers(playerIds: string[], extraSeed?: string[]): Set<string> {
    const out = new Set<string>();
    for (const ans of extraSeed ?? []) {
      for (const part of String(ans).split(' / ')) {
        const clean = part.trim();
        if (clean) out.add(clean);
      }
    }
    for (const pid of playerIds) {
      const hist = this.recentAnswersByPlayer.get(pid);
      if (!hist) continue;
      for (const ans of hist) out.add(ans);
    }
    return out;
  }

  private recordAnswersForPlayers(playerIds: string[], answers: string[]): void {
    const normalizedParts: string[] = [];
    for (const ans of answers) {
      for (const part of String(ans).split(' / ')) {
        const clean = part.trim();
        if (clean) normalizedParts.push(clean);
      }
    }
    if (normalizedParts.length === 0) return;

    for (const pid of playerIds) {
      const prev = this.recentAnswersByPlayer.get(pid) ?? [];
      const next = [...prev, ...normalizedParts];
      this.recentAnswersByPlayer.set(pid, next.slice(-600));
    }
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
    this.store = new GuessItStateStore({
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
    throw new GuessItNotFoundError('Active player session not found.');
  }

  private createRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'H';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  private normalizeSettings(
    partial?: Partial<GuessItRoomSettings> | null,
    existing?: GuessItRoomSettings
  ): GuessItRoomSettings {
    const rawMode = partial?.mode ?? existing?.mode ?? 'speed_rush';
    const mode: GuessItMultiplayerMode = VALID_MODES.includes(rawMode) ? rawMode : 'speed_rush';
    const rawFormat = partial?.format ?? existing?.format ?? 'classic';
    const format = mode === 'word_duel' ? 'classic' : rawFormat === 'crossword' ? 'crossword' : 'classic';

    const rawCat = partial?.category ?? existing?.category ?? 'Movies';
    const category: GuessItCategory = GUESSIT_CATEGORIES.includes(rawCat) ? rawCat : 'Movies';
    const rawDiff = partial?.difficulty ?? existing?.difficulty ?? 'medium';
    const difficulty: GuessItDifficulty =
      rawDiff === 'easy' || rawDiff === 'hard' ? rawDiff : 'medium';

    const wordSource =
      mode === 'word_duel'
        ? partial?.wordSource ?? existing?.wordSource ?? 'custom_word'
        : partial?.wordSource === 'my_templates'
          ? 'my_templates'
          : 'curated_db';

    const defaultCap = mode === 'team_relay' ? 4 : mode === 'survival_royale' ? 6 : 2;
    const requestedCap = partial?.capacity ?? existing?.capacity ?? defaultCap;
    const capacity =
      mode === 'team_relay'
        ? 4
        : mode === 'survival_royale'
          ? Math.max(3, Math.min(8, Math.round(requestedCap)))
          : 2;

    const roundsDefault = mode === 'survival_royale' ? 4 : mode === 'team_relay' || mode === 'speed_rush' ? 3 : 1;
    const roundsCount = Math.max(
      1,
      Math.min(5, Math.round(partial?.roundsCount ?? existing?.roundsCount ?? roundsDefault))
    );

    const maxMistakes = Math.max(
      3,
      Math.min(10, Math.round(partial?.maxMistakes ?? existing?.maxMistakes ?? 6))
    );

    const defaultTime = format === 'crossword' ? 210 : 180;
    const roundTimeSeconds = Math.max(
      45,
      Math.min(300, Math.round(partial?.roundTimeSeconds ?? existing?.roundTimeSeconds ?? defaultTime))
    );

    const penaltyMs = Math.max(
      500,
      Math.min(5000, Math.round(partial?.penaltyMs ?? existing?.penaltyMs ?? 2000))
    );

    return {
      mode,
      format,
      category,
      difficulty,
      wordSource,
      roundsCount,
      maxMistakes,
      roundTimeSeconds,
      penaltyMs,
      capacity,
      isPublic: Boolean(partial?.isPublic ?? existing?.isPublic ?? true),
    };
  }

  private sanitizeRoom(room: StoredGuessItRoom): GuessItRoom {
    const { duelSubmissions: _duel, recentAnswers: _recent, ...pub } = room;
    return {
      ...pub,
      players: pub.players.map((p) => ({
        ...p,
        isOnline: this.isPlayerOnline(p.playerId),
      })),
    };
  }

  private createUnitState(params: {
    unitId: string;
    teamId: GuessItTeamId | null;
    playerIds: string[];
    category: GuessItCategory;
    difficulty: GuessItDifficulty;
    format: 'classic' | 'crossword';
    answer: string;
    clue?: string;
    crosswordLayout: StoredGuessItUnitState['crosswordLayout'];
    maxMistakes: number;
  }): StoredGuessItUnitState {
    return {
      unitId: params.unitId,
      teamId: params.teamId,
      playerIds: [...params.playerIds],
      teamPlayerOrder: [...params.playerIds],
      activePlayerId: params.teamId ? params.playerIds[0] ?? null : null,
      category: params.category,
      difficulty: params.difficulty,
      format: params.format,
      answer: params.answer,
      clue: params.clue,
      crosswordLayout: params.crosswordLayout,
      guessedLetters: [],
      correctLetters: [],
      wrongLetters: [],
      wrongCount: 0,
      maxMistakes: params.maxMistakes,
      penaltyUntilMs: null,
      solved: false,
      failed: false,
      completionTimeMs: null,
      roundScore: 0,
    };
  }

  private getDifficultyForWave(wave: number, baseDiff: GuessItDifficulty): GuessItDifficulty {
    if (wave <= 1) return baseDiff === 'hard' ? 'medium' : 'easy';
    if (wave === 2) return 'medium';
    return 'hard';
  }

  private async buildRoundUnits(params: {
    mode: StoredGuessItMatch['mode'];
    settings: GuessItRoomSettings;
    roundIndex: number;
    participants: Record<string, StoredGuessItParticipantMeta>;
    participantOrder: string[];
    survivorIds: string[];
    usedAnswers: Set<string>;
    isRanked: boolean;
    duelSubmissions?: Record<string, StoredGuessItDuelChallenge>;
    seed: number;
  }): Promise<{
    units: Record<string, StoredGuessItUnitState>;
    category: GuessItCategory;
    difficulty: GuessItDifficulty;
    addedAnswers: string[];
  }> {
    const extraWords = await this.store.listApprovedExtraWords();
    const addedAnswers: string[] = [];
    const category = params.settings.category;
    const difficulty =
      params.mode === 'survival_royale'
        ? this.getDifficultyForWave(params.roundIndex, params.settings.difficulty)
        : params.settings.difficulty;

    const maxMistakes =
      params.mode === 'survival_royale'
        ? Math.max(3, params.settings.maxMistakes - Math.floor((params.roundIndex - 1) / 2))
        : params.settings.maxMistakes;

    // TEAM RELAY (2v2): 2 shared team units solving the exact same puzzle
    if (params.mode === 'team_relay') {
      const blueIds = params.participantOrder.filter((id) => params.participants[id]?.teamId === 'blue');
      const redIds = params.participantOrder.filter((id) => params.participants[id]?.teamId === 'red');

      let sharedAnswer = '';
      let sharedClue: string | undefined;
      let cwLayout: StoredGuessItUnitState['crosswordLayout'] = null;

      if (params.settings.format === 'crossword') {
        const picked = pickCrosswordForCategory(extraWords, {
          category,
          difficulty,
          rankedOnly: params.isRanked,
          excludeAnswers: params.usedAnswers,
          seed: params.seed + params.roundIndex * 31,
        });
        cwLayout = picked.layout;
        sharedAnswer = picked.layout.entries.map((e) => e.answer).join(' / ');
        for (const e of picked.layout.entries) addedAnswers.push(e.answer);
      } else {
        const picked = pickWordFromCatalog(extraWords, {
          category,
          difficulty,
          rankedOnly: params.isRanked,
          excludeAnswers: params.usedAnswers,
          seed: params.seed + params.roundIndex * 17,
        });
        sharedAnswer = picked.answer;
        sharedClue = picked.clue;
        addedAnswers.push(picked.answer);
      }

      const units: Record<string, StoredGuessItUnitState> = {
        'team:blue': this.createUnitState({
          unitId: 'team:blue',
          teamId: 'blue',
          playerIds: blueIds,
          category,
          difficulty,
          format: params.settings.format,
          answer: sharedAnswer,
          clue: sharedClue,
          crosswordLayout: cwLayout,
          maxMistakes,
        }),
        'team:red': this.createUnitState({
          unitId: 'team:red',
          teamId: 'red',
          playerIds: redIds,
          category,
          difficulty,
          format: params.settings.format,
          answer: sharedAnswer,
          clue: sharedClue,
          crosswordLayout: cwLayout,
          maxMistakes,
        }),
      };

      return { units, category, difficulty, addedAnswers };
    }

    // WORD DUEL (1v1): Deranged assignment of private opponent challenges in Round 1,
    // fresh fair curated draws per category in subsequent rounds.
    if (params.mode === 'word_duel' && params.roundIndex === 1 && params.duelSubmissions) {
      const [pA, pB] = params.participantOrder;
      const units: Record<string, StoredGuessItUnitState> = {};
      if (pA && pB) {
        const subForA = params.duelSubmissions[pB];
        const subForB = params.duelSubmissions[pA];
        const wordA =
          subForA?.answer ||
          pickWordFromCatalog(extraWords, {
            category,
            difficulty,
            excludeAnswers: params.usedAnswers,
            seed: params.seed + 11,
          }).answer;
        const wordB =
          subForB?.answer ||
          pickWordFromCatalog(extraWords, {
            category,
            difficulty,
            excludeAnswers: new Set([...params.usedAnswers, wordA]),
            seed: params.seed + 23,
          }).answer;
        addedAnswers.push(wordA, wordB);

        units[pA] = this.createUnitState({
          unitId: pA,
          teamId: null,
          playerIds: [pA],
          category: subForA?.category ?? category,
          difficulty: subForA?.difficulty ?? difficulty,
          format: 'classic',
          answer: wordA,
          clue: subForA?.clue,
          crosswordLayout: null,
          maxMistakes,
        });
        units[pB] = this.createUnitState({
          unitId: pB,
          teamId: null,
          playerIds: [pB],
          category: subForB?.category ?? category,
          difficulty: subForB?.difficulty ?? difficulty,
          format: 'classic',
          answer: wordB,
          clue: subForB?.clue,
          crosswordLayout: null,
          maxMistakes,
        });
        return { units, category, difficulty, addedAnswers };
      }
    }

    // Equivalent simultaneous puzzles for Speed Rush, Precision Clash, Survival Royale, Ranked, Word Duel R2+
    let sharedAnswer = '';
    let sharedClue: string | undefined;
    let cwLayout: StoredGuessItUnitState['crosswordLayout'] = null;

    if (params.settings.format === 'crossword') {
      const picked = pickCrosswordForCategory(extraWords, {
        category,
        difficulty,
        rankedOnly: params.isRanked,
        excludeAnswers: params.usedAnswers,
        seed: params.seed + params.roundIndex * 41,
      });
      cwLayout = picked.layout;
      sharedAnswer = picked.layout.entries.map((e) => e.answer).join(' / ');
      for (const e of picked.layout.entries) addedAnswers.push(e.answer);
    } else {
      const picked = pickWordFromCatalog(extraWords, {
        category,
        difficulty,
        rankedOnly: params.isRanked,
        excludeAnswers: params.usedAnswers,
        seed: params.seed + params.roundIndex * 19,
      });
      sharedAnswer = picked.answer;
      sharedClue = picked.clue;
      addedAnswers.push(picked.answer);
    }

    const activeIds =
      params.mode === 'survival_royale' ? params.survivorIds : params.participantOrder;
    const units: Record<string, StoredGuessItUnitState> = {};
    for (const pid of activeIds) {
      units[pid] = this.createUnitState({
        unitId: pid,
        teamId: null,
        playerIds: [pid],
        category,
        difficulty,
        format: params.settings.format,
        answer: sharedAnswer,
        clue: sharedClue,
        crosswordLayout: cwLayout,
        maxMistakes,
      });
    }

    return { units, category, difficulty, addedAnswers };
  }

  // ==================== HYBRID WORD VALIDATION PIPELINE ====================

  async validateAndAddCatalogCandidate(input: {
    answer: string;
    category: GuessItCategory;
    difficulty: GuessItDifficulty;
    clue?: string;
    rankedEligible?: boolean;
  }): Promise<GuessItWordEntry> {
    const res = validateCandidateWordEntry({
      answer: input.answer,
      category: input.category,
      difficulty: input.difficulty,
      clue: input.clue,
      contentSource: 'ai_validated',
      rankedEligible: input.rankedEligible ?? true,
      adventureEligible: false,
    });
    if (!res.valid || !res.entry) {
      throw new GuessItBadRequestError(res.error || 'Candidate word validation failed.');
    }
    await this.store.saveExtraWord(res.entry);
    return res.entry;
  }

  // ==================== MULTIPLAYER ROOMS ====================

  async listPublicRooms(): Promise<GuessItRoom[]> {
    const rooms = await this.store.listPublicRooms();
    return rooms.map((r) => ({
      ...r,
      players: r.players.map((p) => ({
        ...p,
        isOnline: this.isPlayerOnline(p.playerId),
      })),
    }));
  }

  async getRoom(idOrCode: string): Promise<GuessItRoom> {
    const room = await this.store.getRoom(idOrCode);
    if (!room) throw new GuessItNotFoundError('GuessIt room not found.');
    return this.sanitizeRoom(room);
  }

  async createRoom(params: {
    hostId: string;
    name?: string;
    settings?: Partial<GuessItRoomSettings>;
  }): Promise<GuessItRoom> {
    const profile = await this.requireProfile(params.hostId);
    const settings = this.normalizeSettings(params.settings);
    const now = Date.now();
    const room: StoredGuessItRoom = {
      id: `gs_room_${crypto.randomUUID().slice(0, 10)}`,
      code: this.createRoomCode(),
      name: (params.name || `${profile.username}'s GuessIt`).trim().slice(0, 36),
      hostId: profile.id,
      isPublic: settings.isPublic,
      status: 'lobby',
      settings,
      activeMatchId: null,
      players: [
        {
          playerId: profile.id,
          username: profile.username,
          avatarId: profile.avatarId,
          rankTier: profile.rankTier,
          isHost: true,
          isReady: true,
          teamId: settings.mode === 'team_relay' ? 'blue' : null,
          duelChallengeReady: false,
          duelCategory: null,
          duelClue: null,
          isOnline: true,
          joinedAt: now,
        },
      ],
      messages: [],
      createdAt: now,
      duelSubmissions: {},
      recentAnswers: [],
    };
    await this.store.insertRoom(room);
    return this.sanitizeRoom(room);
  }

  async joinRoom(idOrCode: string, playerId: string): Promise<GuessItRoom> {
    const profile = await this.requireProfile(playerId);
    const updated = await this.store.mutateRoom<GuessItRoom>(idOrCode, (room) => {
      const existing = room.players.find((p) => p.playerId === profile.id);
      if (existing) {
        existing.username = profile.username;
        existing.avatarId = profile.avatarId;
        existing.isOnline = true;
        return { result: this.sanitizeRoom(room) };
      }
      if (room.status !== 'lobby') {
        throw new GuessItBadRequestError('This room is already in a match.');
      }
      if (room.players.length >= room.settings.capacity) {
        throw new GuessItBadRequestError('This GuessIt room is full.');
      }

      let assignedTeam: GuessItTeamId | null = null;
      if (room.settings.mode === 'team_relay') {
        const blueCount = room.players.filter((p) => p.teamId === 'blue').length;
        const redCount = room.players.filter((p) => p.teamId === 'red').length;
        assignedTeam = blueCount <= redCount ? 'blue' : 'red';
      }

      room.players.push({
        playerId: profile.id,
        username: profile.username,
        avatarId: profile.avatarId,
        rankTier: profile.rankTier,
        isHost: false,
        isReady: false,
        teamId: assignedTeam,
        duelChallengeReady: false,
        duelCategory: null,
        duelClue: null,
        isOnline: true,
        joinedAt: Date.now(),
      });
      return { result: this.sanitizeRoom(room) };
    });

    if (!updated) throw new GuessItNotFoundError('GuessIt room not found.');
    return updated;
  }

  async leaveRoom(roomId: string, playerId: string): Promise<{ deleted: boolean; room?: GuessItRoom }> {
    const res = await this.store.mutateRoom<{ deleted: boolean; room?: GuessItRoom }>(roomId, (room) => {
      room.players = room.players.filter((p) => p.playerId !== playerId);
      delete room.duelSubmissions[playerId];
      if (room.players.length === 0) {
        return { result: { deleted: true }, deleteRoom: true };
      }
      if (room.hostId === playerId) {
        room.hostId = room.players[0].playerId;
        room.players[0].isHost = true;
      }
      return { result: { deleted: false, room: this.sanitizeRoom(room) } };
    });
    if (!res) throw new GuessItNotFoundError('GuessIt room not found.');
    return res;
  }

  async updateRoomSettings(
    roomId: string,
    hostId: string,
    partial: Partial<GuessItRoomSettings>
  ): Promise<GuessItRoom> {
    const updated = await this.store.mutateRoom<GuessItRoom>(roomId, (room) => {
      if (room.hostId !== hostId) {
        throw new GuessItForbiddenError('Only the room host can update match settings.');
      }
      if (room.status !== 'lobby') {
        throw new GuessItBadRequestError('Settings cannot be changed after a match starts.');
      }
      const next = this.normalizeSettings(partial, room.settings);
      room.settings = next;
      room.isPublic = next.isPublic;

      // Rebalance team assignments if mode switched to/from Team Relay
      if (next.mode === 'team_relay') {
        room.players.forEach((p, idx) => {
          if (!p.teamId) {
            p.teamId = idx % 2 === 0 ? 'blue' : 'red';
          }
        });
      } else {
        room.players.forEach((p) => {
          p.teamId = null;
        });
      }

      if (next.mode !== 'word_duel') {
        room.duelSubmissions = {};
        room.players.forEach((p) => {
          p.duelChallengeReady = false;
          p.duelCategory = null;
          p.duelClue = null;
        });
      }

      return { result: this.sanitizeRoom(room) };
    });
    if (!updated) throw new GuessItNotFoundError('GuessIt room not found.');
    return updated;
  }

  async setPlayerReady(roomId: string, playerId: string, isReady: boolean): Promise<GuessItRoom> {
    const updated = await this.store.mutateRoom<GuessItRoom>(roomId, (room) => {
      const p = room.players.find((x) => x.playerId === playerId);
      if (!p) throw new GuessItForbiddenError('You are not a member of this room.');
      if (room.status !== 'lobby') throw new GuessItBadRequestError('Match already started.');
      p.isReady = Boolean(isReady);
      return { result: this.sanitizeRoom(room) };
    });
    if (!updated) throw new GuessItNotFoundError('GuessIt room not found.');
    return updated;
  }

  async switchTeam(roomId: string, playerId: string, teamId: GuessItTeamId): Promise<GuessItRoom> {
    const updated = await this.store.mutateRoom<GuessItRoom>(roomId, (room) => {
      if (room.status !== 'lobby') {
        throw new GuessItBadRequestError('Cannot switch teams once match begins.');
      }
      if (room.settings.mode !== 'team_relay') {
        throw new GuessItBadRequestError('Team assignment only applies to Team Relay.');
      }
      const p = room.players.find((x) => x.playerId === playerId);
      if (!p) throw new GuessItForbiddenError('Not in room.');
      const countTarget = room.players.filter((x) => x.teamId === teamId && x.playerId !== playerId).length;
      if (countTarget >= 2) {
        throw new GuessItBadRequestError(`Team ${teamId === 'blue' ? 'Blue' : 'Red'} already has 2 players.`);
      }
      p.teamId = teamId;
      return { result: this.sanitizeRoom(room) };
    });
    if (!updated) throw new GuessItNotFoundError('GuessIt room not found.');
    return updated;
  }

  async submitDuelChallenge(
    roomId: string,
    playerId: string,
    payload: {
      source: 'custom_word' | 'my_templates' | 'curated_db';
      answer?: string;
      templateId?: string;
      category?: GuessItCategory;
      difficulty?: GuessItDifficulty;
      clue?: string;
    }
  ): Promise<GuessItRoom> {
    const extraWords = await this.store.listApprovedExtraWords();
    const updated = await this.store.mutateRoom<GuessItRoom>(roomId, (room) => {
      if (room.status !== 'lobby') {
        throw new GuessItBadRequestError('Cannot modify duel challenge after match starts.');
      }
      if (room.settings.mode !== 'word_duel') {
        throw new GuessItBadRequestError('Private word challenges are only used in Word Duel.');
      }
      const p = room.players.find((x) => x.playerId === playerId);
      if (!p) throw new GuessItForbiddenError('Not in room.');

      const category = payload.category && GUESSIT_CATEGORIES.includes(payload.category)
        ? payload.category
        : room.settings.category;
      const difficulty: GuessItDifficulty = payload.difficulty ?? 'medium';

      let chosenAnswer = '';
      let chosenClue = payload.clue?.trim().slice(0, 90);

      if (payload.source === 'curated_db') {
        const excludeAnswers = this.getRecentAnswersForPlayers([playerId], room.recentAnswers);
        const picked = pickWordFromCatalog(extraWords, {
          category,
          difficulty,
          excludeAnswers,
          seed: crypto.randomInt(1, 2147483647),
        });
        chosenAnswer = picked.answer;
        chosenClue = chosenClue || picked.clue;
        this.recordAnswersForPlayers([playerId], [chosenAnswer]);
      } else {
        let candidate = payload.answer || '';
        if (payload.source === 'my_templates' && payload.templateId) {
          const tpl = this.repo.getTemplate(payload.templateId);
          if (tpl && tpl.words.length > 0 && !candidate) {
            candidate = tpl.words[Math.floor(Math.random() * tpl.words.length)];
          }
        }
        const check = validateCustomPhrase(candidate);
        if (!check.valid) {
          throw new GuessItBadRequestError(check.error || 'Invalid duel word or phrase.');
        }
        chosenAnswer = check.normalized;
      }

      room.duelSubmissions[playerId] = {
        playerId,
        answer: chosenAnswer,
        category,
        difficulty,
        clue: chosenClue,
      };
      p.duelChallengeReady = true;
      p.duelCategory = category;
      p.duelClue = chosenClue ?? null;
      return { result: this.sanitizeRoom(room) };
    });
    if (!updated) throw new GuessItNotFoundError('GuessIt room not found.');
    return updated;
  }

  async addRoomChat(roomId: string, playerId: string, text: string): Promise<GuessItRoom> {
    const profile = await this.requireProfile(playerId);
    const clean = String(text || '').trim().slice(0, 160);
    if (!clean) throw new GuessItBadRequestError('Message cannot be empty.');
    const updated = await this.store.mutateRoom<GuessItRoom>(roomId, (room) => {
      if (!room.players.some((p) => p.playerId === playerId)) {
        throw new GuessItForbiddenError('Not in room.');
      }
      const msg: GuessItRoomMessage = {
        id: `gs_msg_${crypto.randomUUID().slice(0, 8)}`,
        roomId: room.id,
        senderId: profile.id,
        senderName: profile.username,
        senderAvatar: profile.avatarId,
        text: clean,
        createdAt: Date.now(),
      };
      room.messages.push(msg);
      if (room.messages.length > 60) room.messages = room.messages.slice(-60);
      return { result: this.sanitizeRoom(room) };
    });
    if (!updated) throw new GuessItNotFoundError('GuessIt room not found.');
    return updated;
  }

  async startRoomMatch(
    roomId: string,
    hostId: string
  ): Promise<{ room: GuessItRoom; matchRecord: StoredGuessItMatch }> {
    const storedRoom = await this.store.getRoom(roomId);
    if (!storedRoom) throw new GuessItNotFoundError('GuessIt room not found.');
    if (storedRoom.hostId !== hostId) {
      throw new GuessItForbiddenError('Only the room host can start the match.');
    }
    if (storedRoom.status !== 'lobby') {
      throw new GuessItBadRequestError('This room is already playing.');
    }

    const { mode } = storedRoom.settings;
    if (mode === 'team_relay') {
      const blueCount = storedRoom.players.filter((p) => p.teamId === 'blue').length;
      const redCount = storedRoom.players.filter((p) => p.teamId === 'red').length;
      if (blueCount !== 2 || redCount !== 2) {
        throw new GuessItBadRequestError('Team Relay requires 2 players on Team Blue and 2 on Team Red.');
      }
    } else if (mode === 'survival_royale') {
      if (storedRoom.players.length < 3) {
        throw new GuessItBadRequestError('Survival Royale requires at least 3 players.');
      }
    } else if (storedRoom.players.length < 2) {
      throw new GuessItBadRequestError('Wait for an opponent to join before starting.');
    }

    if (mode === 'word_duel') {
      const missing = storedRoom.players.filter((p) => !storedRoom.duelSubmissions[p.playerId]);
      if (missing.length > 0) {
        throw new GuessItBadRequestError(
          `Waiting for ${missing.map((m) => m.username).join(' & ')} to lock in their secret Word Duel challenge.`
        );
      }
    }

    const notReady = storedRoom.players.filter((p) => p.playerId !== hostId && !p.isReady);
    if (notReady.length > 0) {
      throw new GuessItBadRequestError(
        `Waiting for ${notReady.map((n) => n.username).join(', ')} to mark ready.`
      );
    }

    const matchRecord = await this.createMatchFromParticipants({
      roomId: storedRoom.id,
      mode: storedRoom.settings.mode,
      settings: storedRoom.settings,
      isRanked: false,
      players: storedRoom.players.map((p) => ({
        playerId: p.playerId,
        username: p.username,
        avatarId: p.avatarId,
        teamId: p.teamId,
      })),
      usedSeedAnswers: storedRoom.recentAnswers,
      duelSubmissions: storedRoom.duelSubmissions,
    });

    const updatedRoom = await this.store.mutateRoom<GuessItRoom>(roomId, (room) => {
      room.status = 'in_progress';
      room.activeMatchId = matchRecord.id;
      room.recentAnswers = Array.from(new Set([...room.recentAnswers, ...matchRecord.usedAnswers])).slice(-150);
      return { result: this.sanitizeRoom(room) };
    });

    return { room: updatedRoom ?? this.sanitizeRoom(storedRoom), matchRecord };
  }

  private async createMatchFromParticipants(params: {
    roomId: string | null;
    mode: StoredGuessItMatch['mode'];
    settings: GuessItRoomSettings;
    isRanked: boolean;
    players: Array<{ playerId: string; username: string; avatarId: string; teamId: GuessItTeamId | null }>;
    usedSeedAnswers?: string[];
    duelSubmissions?: Record<string, StoredGuessItDuelChallenge>;
    stageId?: string | null;
    chapterId?: string | null;
    customStage?: GuessItAdventureStage | null;
  }): Promise<StoredGuessItMatch> {
    const now = Date.now();
    const matchId = `gs_match_${crypto.randomUUID().slice(0, 10)}`;
    const participants: Record<string, StoredGuessItParticipantMeta> = {};
    const participantOrder: string[] = [];

    for (const p of params.players) {
      participantOrder.push(p.playerId);
      participants[p.playerId] = {
        playerId: p.playerId,
        username: p.username,
        avatarId: p.avatarId,
        teamId: p.teamId,
        score: 0,
        roundsWon: 0,
        isWinner: false,
        isEliminated: false,
        totalCorrectGuesses: 0,
        totalWrongGuesses: 0,
        bestCompletionTimeMs: null,
      };
    }

    const usedSet = this.getRecentAnswersForPlayers(participantOrder, params.usedSeedAnswers);
    const seed = crypto.randomInt(1, 2147483647);

    let roundBuild: {
      units: Record<string, StoredGuessItUnitState>;
      category: GuessItCategory;
      difficulty: GuessItDifficulty;
      addedAnswers: string[];
    };

    if (params.customStage) {
      const st = params.customStage;
      const p0 = params.players[0];
      const cwLayout =
        st.format === 'crossword' ? generateCrosswordLayout(st.answers, st.stageNumber) : null;
      const ans = st.format === 'crossword' ? st.answers.join(' / ') : st.answers[0];
      roundBuild = {
        units: {
          [p0.playerId]: this.createUnitState({
            unitId: p0.playerId,
            teamId: null,
            playerIds: [p0.playerId],
            category: st.category,
            difficulty: st.difficulty,
            format: st.format,
            answer: ans,
            clue: st.clue,
            crosswordLayout: cwLayout,
            maxMistakes: st.maxMistakes,
          }),
        },
        category: st.category,
        difficulty: st.difficulty,
        addedAnswers: [...st.answers],
      };
    } else {
      roundBuild = await this.buildRoundUnits({
        mode: params.mode,
        settings: params.settings,
        roundIndex: 1,
        participants,
        participantOrder,
        survivorIds: [...participantOrder],
        usedAnswers: usedSet,
        isRanked: params.isRanked,
        duelSubmissions: params.duelSubmissions,
        seed,
      });
    }

    this.recordAnswersForPlayers(participantOrder, roundBuild.addedAnswers);

    const match: StoredGuessItMatch = {
      id: matchId,
      roomId: params.roomId,
      mode: params.mode,
      format: params.settings.format,
      isRanked: params.isRanked,
      status: 'playing',
      roundIndex: 1,
      totalRounds: params.customStage ? 1 : params.settings.roundsCount,
      category: roundBuild.category,
      difficulty: roundBuild.difficulty,
      roundStartedAtMs: now,
      roundEndsAtMs: now + params.settings.roundTimeSeconds * 1000,
      roundOverAtMs: null,
      penaltyDurationMs: params.settings.penaltyMs,
      settings: { ...params.settings },
      duelSubmissionsSnapshot: params.duelSubmissions,
      participants,
      participantOrder,
      units: roundBuild.units,
      teamScores: { blue: 0, red: 0 },
      survivorIds: [...participantOrder],
      winnerIds: [],
      winningTeamId: null,
      roundSummaries: [],
      messages: [],
      usedAnswers: [...(params.usedSeedAnswers ?? []), ...roundBuild.addedAnswers],
      stageId: params.stageId ?? null,
      chapterId: params.chapterId ?? null,
      finalizedStats: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.store.insertMatch(match);
    return match;
  }

  // ==================== RANKED MATCHMAKING (Approved Words Only, No Quick Match) ====================

  async joinRankedQueue(
    playerId: string,
    mode: 'speed_rush' | 'precision_clash' = 'speed_rush',
    format: 'classic' | 'crossword' = 'classic'
  ): Promise<{ status: 'queued' | 'matched'; match?: StoredGuessItMatch }> {
    const profile = await this.requireProfile(playerId);
    const cleanMode = mode === 'precision_clash' ? 'precision_clash' : 'speed_rush';
    const cleanFormat = format === 'crossword' ? 'crossword' : 'classic';
    const queueKey = `${cleanMode}:${cleanFormat}`;

    const outcome = await this.store.dequeueRankedPair(queueKey, profile.id);
    if (!outcome.matched || !outcome.opponentId) {
      return { status: 'queued' };
    }

    const oppProfile = await this.requireProfile(outcome.opponentId);
    const category =
      GUESSIT_CATEGORIES[Math.floor(Math.random() * GUESSIT_CATEGORIES.length)] ?? 'Movies';
    const settings: GuessItRoomSettings = this.normalizeSettings({
      mode: cleanMode,
      format: cleanFormat,
      category,
      difficulty: 'medium',
      wordSource: 'curated_db',
      roundsCount: cleanMode === 'speed_rush' ? 3 : 1,
      maxMistakes: 6,
      roundTimeSeconds: cleanFormat === 'crossword' ? 210 : 180,
      penaltyMs: 2000,
      capacity: 2,
      isPublic: false,
    });

    const matchRecord = await this.createMatchFromParticipants({
      roomId: null,
      mode: cleanMode,
      settings,
      isRanked: true,
      players: [
        {
          playerId: oppProfile.id,
          username: oppProfile.username,
          avatarId: oppProfile.avatarId,
          teamId: null,
        },
        {
          playerId: profile.id,
          username: profile.username,
          avatarId: profile.avatarId,
          teamId: null,
        },
      ],
    });

    return { status: 'matched', match: matchRecord };
  }

  async leaveRankedQueue(playerId: string): Promise<void> {
    await this.store.leaveRankedQueue(playerId);
  }

  // ==================== GAMEPLAY: GUESS VALIDATION & RESOLUTION ====================

  private findUnitForPlayer(
    match: StoredGuessItMatch,
    playerId: string
  ): StoredGuessItUnitState | null {
    if (match.mode === 'team_relay') {
      const p = match.participants[playerId];
      if (!p?.teamId) return null;
      return match.units[`team:${p.teamId}`] ?? null;
    }
    return match.units[playerId] ?? null;
  }

  async submitGuess(
    matchId: string,
    playerId: string,
    rawLetter: string
  ): Promise<{ response: GuessItGuessResponse; matchRecord: StoredGuessItMatch }> {
    const letter = String(rawLetter || '').trim().toUpperCase();
    if (!isEnglishUpperLetter(letter)) {
      throw new GuessItBadRequestError('Guess must be a single English letter A–Z.');
    }

    return this.store.withMatchLock(matchId, async () => {
      const outcome = await this.store.mutateMatch<GuessItGuessResponse>(matchId, (match) => {
        const now = Date.now();
        if (match.status === 'finished' || match.status === 'round_over') {
          throw new GuessItBadRequestError('This round has already ended.');
        }

        const participant = match.participants[playerId];
        if (!participant) {
          throw new GuessItForbiddenError('You are not an active participant in this match.');
        }
        if (participant.isEliminated) {
          throw new GuessItForbiddenError('Eliminated players cannot submit guesses.');
        }

        const unit = this.findUnitForPlayer(match, playerId);
        if (!unit) {
          throw new GuessItBadRequestError('Puzzle state not active for your slot.');
        }
        if (unit.solved || unit.failed) {
          throw new GuessItBadRequestError('Your puzzle for this round is already complete.');
        }

        // Team Relay turn authority
        if (match.mode === 'team_relay' && unit.activePlayerId !== playerId) {
          throw new GuessItForbiddenError('Hold on! It is your teammate’s turn to guess.');
        }

        // Authoritative server penalty enforcement (no client clock bypass)
        if (unit.penaltyUntilMs !== null && now < unit.penaltyUntilMs) {
          const waitSec = ((unit.penaltyUntilMs - now) / 1000).toFixed(1);
          throw new GuessItRateLimitError(`Input locked after mistake! Wait ${waitSec}s.`);
        }

        // Repeated guess rejection WITHOUT incurring additional penalties
        if (unit.guessedLetters.includes(letter)) {
          throw new GuessItBadRequestError(`Letter "${letter}" was already guessed.`);
        }

        unit.guessedLetters.push(letter);

        const occurrences =
          unit.format === 'crossword' && unit.crosswordLayout
            ? countCrosswordLetterOccurrences(unit.crosswordLayout, letter)
            : countOccurrencesInClassic(unit.answer, letter);

        const correct = occurrences > 0;
        let handoffToPlayerId: string | null = null;
        let penaltyUntilMs: number | null = null;

        if (correct) {
          unit.correctLetters.push(letter);
          participant.totalCorrectGuesses += 1;

          const nowSolved =
            unit.format === 'crossword' && unit.crosswordLayout
              ? isCrosswordSolved(unit.crosswordLayout, new Set(unit.guessedLetters))
              : isClassicSolved(unit.answer, new Set(unit.guessedLetters));

          if (nowSolved) {
            unit.solved = true;
            unit.completionTimeMs = Math.max(250, now - match.roundStartedAtMs);
            unit.roundScore = computePrecisionScore({
              solved: true,
              correctUnique: unit.correctLetters.length,
              wrongUnique: unit.wrongLetters.length,
              maxMistakes: unit.maxMistakes,
              completionTimeMs: unit.completionTimeMs,
              roundTimeMs: match.roundEndsAtMs - match.roundStartedAtMs,
            });
            for (const pid of unit.playerIds) {
              const mp = match.participants[pid];
              if (mp) {
                mp.score += unit.roundScore;
                if (mp.bestCompletionTimeMs === null || unit.completionTimeMs < mp.bestCompletionTimeMs) {
                  mp.bestCompletionTimeMs = unit.completionTimeMs;
                }
              }
            }
          }
        } else {
          unit.wrongLetters.push(letter);
          unit.wrongCount += 1;
          participant.totalWrongGuesses += 1;

          penaltyUntilMs = now + match.penaltyDurationMs;
          unit.penaltyUntilMs = penaltyUntilMs;

          // Team Relay transfers turn cleanly to teammate upon wrong guess
          if (match.mode === 'team_relay' && unit.teamPlayerOrder.length > 1) {
            const idx = unit.teamPlayerOrder.indexOf(playerId);
            const nextPlayer = unit.teamPlayerOrder[(idx + 1) % unit.teamPlayerOrder.length];
            unit.activePlayerId = nextPlayer;
            handoffToPlayerId = nextPlayer;
          }

          if (unit.wrongCount >= unit.maxMistakes) {
            unit.failed = true;
            if (match.mode === 'survival_royale') {
              participant.isEliminated = true;
            }
          }
        }

        // Check whether current round concludes immediately or awaits remaining units
        const prevStatus = match.status;
        this.evaluateRoundCompletionInPlace(match, now);
        const nextStatus = match.status as StoredGuessItMatch['status'];
        const roundEnded =
          nextStatus !== prevStatus && (nextStatus === 'round_over' || nextStatus === 'finished');
        const matchEnded = nextStatus === 'finished';
        match.updatedAt = now;

        return {
          accepted: true,
          correct,
          letter,
          occurrencesRevealed: occurrences,
          puzzleSolved: unit.solved,
          roundEnded,
          matchEnded,
          penaltyUntilMs,
          handoffToPlayerId,
          message: correct
            ? unit.solved
              ? `Solved "${unit.answer}"!`
              : `Revealed ${occurrences} "${letter}" tile${occurrences === 1 ? '' : 's'}!`
            : handoffToPlayerId
              ? `No "${letter}"! Passed turn to teammate.`
              : unit.failed
                ? 'Out of mistakes!'
                : `No "${letter}"! Input locked briefly.`,
          match: this.sanitizeMatchForViewerRecord(match, playerId, now),
        };
      });

      if (!outcome) throw new GuessItNotFoundError('GuessIt match not found.');
      if (outcome.match.status === 'finished') {
        await this.finalizeCompletedMatchStats(outcome.match);
      }
      return { response: outcome.result, matchRecord: outcome.match };
    });
  }

  private evaluateRoundCompletionInPlace(match: StoredGuessItMatch, now: number): void {
    const unitsList = Object.values(match.units);
    if (unitsList.length === 0) return;

    const allDone = unitsList.every((u) => u.solved || u.failed);
    const anySolved = unitsList.some((u) => u.solved);
    const timedOut = now >= match.roundEndsAtMs;

    let shouldCloseRound = false;
    if (match.mode === 'solo_adventure' || match.mode === 'speed_rush' || match.mode === 'team_relay') {
      shouldCloseRound = anySolved || allDone || timedOut;
    } else if (match.mode === 'precision_clash' || match.mode === 'word_duel' || match.mode === 'survival_royale') {
      shouldCloseRound = allDone || timedOut;
    }

    if (!shouldCloseRound) return;

    // Resolve Word Duel defense bonuses once both players finish round 1
    if (match.mode === 'word_duel' && match.participantOrder.length === 2) {
      const [pA, pB] = match.participantOrder;
      const uA = match.units[pA];
      const uB = match.units[pB];
      if (uA && uB) {
        const scoreA = computeWordDuelScore({
          solved: uA.solved,
          correctUnique: uA.correctLetters.length,
          wrongUnique: uA.wrongLetters.length,
          maxMistakes: uA.maxMistakes,
          completionTimeMs: uA.completionTimeMs,
          roundTimeMs: match.roundEndsAtMs - match.roundStartedAtMs,
          opponentSolvedOnYourWord: uB.solved,
        });
        const scoreB = computeWordDuelScore({
          solved: uB.solved,
          correctUnique: uB.correctLetters.length,
          wrongUnique: uB.wrongLetters.length,
          maxMistakes: uB.maxMistakes,
          completionTimeMs: uB.completionTimeMs,
          roundTimeMs: match.roundEndsAtMs - match.roundStartedAtMs,
          opponentSolvedOnYourWord: uA.solved,
        });
        // Replace temporary round solve score with full fair Word Duel score delta
        match.participants[pA].score += scoreA - uA.roundScore;
        match.participants[pB].score += scoreB - uB.roundScore;
        uA.roundScore = scoreA;
        uB.roundScore = scoreB;
      }
    }

    // Precision Clash & unsolved time-outs partial points
    if (match.mode === 'precision_clash' && timedOut) {
      for (const u of unitsList) {
        if (!u.solved && u.roundScore === 0) {
          const partial = computePrecisionScore({
            solved: false,
            correctUnique: u.correctLetters.length,
            wrongUnique: u.wrongLetters.length,
            maxMistakes: u.maxMistakes,
            completionTimeMs: null,
            roundTimeMs: match.roundEndsAtMs - match.roundStartedAtMs,
          });
          u.roundScore = partial;
          for (const pid of u.playerIds) {
            if (match.participants[pid]) match.participants[pid].score += partial;
          }
        }
      }
    }

    // Survival Royale timeout elimination for unsolved survivors
    if (match.mode === 'survival_royale') {
      for (const pid of match.survivorIds) {
        const u = match.units[pid];
        if (u && !u.solved) {
          u.failed = true;
          match.participants[pid].isEliminated = true;
        }
      }
      const remainingSurvivors = match.survivorIds.filter(
        (pid) => !match.participants[pid].isEliminated
      );

      const roundAnswers = Array.from(new Set(unitsList.map((u) => u.answer)));
      match.roundSummaries.push({
        roundIndex: match.roundIndex,
        category: match.category,
        format: match.format,
        revealedAnswers: roundAnswers,
        winnerIds: [...remainingSurvivors],
        winningTeamId: null,
        endedAtMs: now,
      });

      if (remainingSurvivors.length === 1) {
        match.survivorIds = remainingSurvivors;
        match.winnerIds = remainingSurvivors;
        match.participants[remainingSurvivors[0]].isWinner = true;
        match.status = 'finished';
        return;
      }

      if (remainingSurvivors.length === 0) {
        // Nobody survived this wave: rank players from THIS wave by accuracy/score/progress
        const waveRanked = [...match.survivorIds].sort((a, b) => {
          const ua = match.units[a];
          const ub = match.units[b];
          return (
            (ub?.correctLetters.length ?? 0) - (ua?.correctLetters.length ?? 0) ||
            (ua?.wrongCount ?? 99) - (ub?.wrongCount ?? 99) ||
            (match.participants[b]?.score ?? 0) - (match.participants[a]?.score ?? 0)
          );
        });
        match.winnerIds = waveRanked.slice(0, 1);
        if (match.winnerIds[0]) match.participants[match.winnerIds[0]].isWinner = true;
        match.survivorIds = [];
        match.status = 'finished';
        return;
      }

      match.survivorIds = remainingSurvivors;
      if (match.roundIndex >= match.totalRounds) {
        const sorted = [...remainingSurvivors].sort(
          (a, b) => match.participants[b].score - match.participants[a].score
        );
        const topScore = match.participants[sorted[0]].score;
        match.winnerIds = sorted.filter((id) => match.participants[id].score === topScore);
        for (const wid of match.winnerIds) match.participants[wid].isWinner = true;
        match.status = 'finished';
        return;
      }

      match.status = 'round_over';
      match.roundOverAtMs = now;
      return;
    }

    // Standard Round Winner Determination (Solo, Speed Rush, Precision Clash, Word Duel, Team Relay)
    let roundWinnerIds: string[] = [];
    let winningTeamId: GuessItTeamId | null = null;

    if (match.mode === 'team_relay') {
      const blue = match.units['team:blue'];
      const red = match.units['team:red'];
      if (blue?.solved && !red?.solved) winningTeamId = 'blue';
      else if (red?.solved && !blue?.solved) winningTeamId = 'red';
      else if (blue?.solved && red?.solved) {
        winningTeamId = (blue.completionTimeMs ?? Infinity) <= (red.completionTimeMs ?? Infinity) ? 'blue' : 'red';
      }
      if (winningTeamId) {
        match.teamScores[winningTeamId] += 1;
        roundWinnerIds = [...(match.units[`team:${winningTeamId}`]?.playerIds ?? [])];
        for (const pid of roundWinnerIds) {
          if (match.participants[pid]) match.participants[pid].roundsWon += 1;
        }
      }
    } else if (match.mode === 'solo_adventure') {
      const pid = match.participantOrder[0];
      const u = match.units[pid];
      if (u?.solved) {
        roundWinnerIds = [pid];
        match.participants[pid].roundsWon += 1;
      }
    } else if (match.mode === 'speed_rush') {
      const solvedUnits = unitsList
        .filter((u) => u.solved)
        .sort((a, b) => (a.completionTimeMs ?? Infinity) - (b.completionTimeMs ?? Infinity));
      if (solvedUnits.length > 0) {
        const bestTime = solvedUnits[0].completionTimeMs;
        roundWinnerIds = solvedUnits
          .filter((u) => u.completionTimeMs === bestTime)
          .flatMap((u) => u.playerIds);
        for (const pid of roundWinnerIds) {
          if (match.participants[pid]) match.participants[pid].roundsWon += 1;
        }
      }
    } else {
      // precision_clash or word_duel
      const sorted = [...unitsList].sort(
        (a, b) =>
          Number(b.solved) - Number(a.solved) ||
          b.roundScore - a.roundScore ||
          (a.completionTimeMs ?? Infinity) - (b.completionTimeMs ?? Infinity)
      );
      if (sorted[0] && (sorted[0].solved || sorted[0].roundScore > 0)) {
        const topRoundScore = sorted[0].roundScore;
        roundWinnerIds = sorted
          .filter((u) => u.roundScore === topRoundScore)
          .flatMap((u) => u.playerIds);
        for (const pid of roundWinnerIds) {
          if (match.participants[pid]) match.participants[pid].roundsWon += 1;
        }
      }
    }

    const revealedAnswers = Array.from(new Set(unitsList.map((u) => u.answer)));
    match.roundSummaries.push({
      roundIndex: match.roundIndex,
      category: match.category,
      format: match.format,
      revealedAnswers,
      winnerIds: roundWinnerIds,
      winningTeamId,
      endedAtMs: now,
    });

    // Check early majority clinch in Best-of-N (Speed Rush / Team Relay) or final round completion
    const majorityNeeded = Math.floor(match.totalRounds / 2) + 1;
    let clinched = false;
    if (match.mode === 'team_relay') {
      if (match.teamScores.blue >= majorityNeeded || match.teamScores.red >= majorityNeeded) {
        clinched = true;
      }
    } else if (match.mode === 'speed_rush' && match.totalRounds >= 3) {
      if (Object.values(match.participants).some((p) => p.roundsWon >= majorityNeeded)) {
        clinched = true;
      }
    }

    if (clinched || match.roundIndex >= match.totalRounds) {
      this.resolveMatchWinnersInPlace(match);
      match.status = 'finished';
    } else {
      match.status = 'round_over';
      match.roundOverAtMs = now;
    }
  }

  private resolveMatchWinnersInPlace(match: StoredGuessItMatch): void {
    if (match.mode === 'team_relay') {
      if (match.teamScores.blue > match.teamScores.red) {
        match.winningTeamId = 'blue';
      } else if (match.teamScores.red > match.teamScores.blue) {
        match.winningTeamId = 'red';
      } else {
        const blueUnit = match.units['team:blue'];
        const redUnit = match.units['team:red'];
        const bluePts = blueUnit?.roundScore ?? 0;
        const redPts = redUnit?.roundScore ?? 0;
        if (bluePts > redPts) match.winningTeamId = 'blue';
        else if (redPts > bluePts) match.winningTeamId = 'red';
      }
      if (match.winningTeamId) {
        match.winnerIds = match.participantOrder.filter(
          (id) => match.participants[id]?.teamId === match.winningTeamId
        );
        for (const wid of match.winnerIds) match.participants[wid].isWinner = true;
      }
      return;
    }

    if (match.mode === 'solo_adventure') {
      const p = match.participants[match.participantOrder[0]];
      const u = match.units[match.participantOrder[0]];
      if (p && u?.solved) {
        match.winnerIds = [p.playerId];
        p.isWinner = true;
      }
      return;
    }

    const sorted = Object.values(match.participants).sort(
      (a, b) =>
        b.roundsWon - a.roundsWon ||
        b.score - a.score ||
        a.totalWrongGuesses - b.totalWrongGuesses ||
        (a.bestCompletionTimeMs ?? Infinity) - (b.bestCompletionTimeMs ?? Infinity)
    );
    if (sorted.length > 0) {
      const top = sorted[0];
      if (top.roundsWon === 0 && top.score === 0 && sorted.every((s) => s.score === 0)) {
        match.winnerIds = [];
        return;
      }
      const tied = sorted.filter(
        (p) =>
          p.roundsWon === top.roundsWon &&
          p.score === top.score &&
          p.totalWrongGuesses === top.totalWrongGuesses
      );
      if (tied.length < sorted.length || tied.length === 1) {
        match.winnerIds = tied.map((p) => p.playerId);
        for (const wid of match.winnerIds) match.participants[wid].isWinner = true;
      }
    }
  }

  private async advanceRoundIfReady(matchId: string): Promise<StoredGuessItMatch | null> {
    return this.store.withMatchLock(matchId, async () => {
      const rec = await this.store.getMatch(matchId);
      if (!rec || rec.status !== 'round_over') return rec;
      const now = Date.now();
      if (rec.roundOverAtMs && now - rec.roundOverAtMs < 2400) return rec;

      const nextRoundIdx = rec.roundIndex + 1;
      const nextBuild = await this.buildRoundUnits({
        mode: rec.mode,
        settings: rec.settings,
        roundIndex: nextRoundIdx,
        participants: rec.participants,
        participantOrder: rec.participantOrder,
        survivorIds: rec.survivorIds,
        usedAnswers: this.getRecentAnswersForPlayers(rec.participantOrder, rec.usedAnswers),
        isRanked: rec.isRanked,
        duelSubmissions: rec.duelSubmissionsSnapshot,
        seed: crypto.randomInt(1, 2147483647),
      });
      this.recordAnswersForPlayers(rec.participantOrder, nextBuild.addedAnswers);

      const outcome = await this.store.mutateMatch(matchId, (match) => {
        if (match.status !== 'round_over') return match;
        match.roundIndex = nextRoundIdx;
        match.category = nextBuild.category;
        match.difficulty = nextBuild.difficulty;
        match.units = nextBuild.units;
        match.usedAnswers = Array.from(new Set([...match.usedAnswers, ...nextBuild.addedAnswers]));
        match.status = 'playing';
        match.roundStartedAtMs = now;
        match.roundEndsAtMs = now + match.settings.roundTimeSeconds * 1000;
        match.roundOverAtMs = null;
        match.updatedAt = now;
        return match;
      });
      return outcome?.match ?? null;
    });
  }

  async processExpiredTimers(): Promise<StoredGuessItMatch[]> {
    const active = this.store.listMemActiveMatches();
    const updated: StoredGuessItMatch[] = [];
    const now = Date.now();

    for (const m of active) {
      if (m.status === 'playing' && now >= m.roundEndsAtMs) {
        const res = await this.store.withMatchLock(m.id, async () => {
          return this.store.mutateMatch(m.id, (match) => {
            if (match.status === 'playing' && Date.now() >= match.roundEndsAtMs) {
              this.evaluateRoundCompletionInPlace(match, Date.now());
              match.updatedAt = Date.now();
            }
            return match;
          });
        });
        if (res?.match) {
          if (res.match.status === 'finished') {
            await this.finalizeCompletedMatchStats(res.match);
          }
          updated.push(res.match);
        }
      } else if (m.status === 'round_over' && m.roundOverAtMs && now - m.roundOverAtMs >= 2400) {
        const advanced = await this.advanceRoundIfReady(m.id);
        if (advanced) updated.push(advanced);
      }
    }
    return updated;
  }

  private async finalizeCompletedMatchStats(match: StoredGuessItMatch): Promise<void> {
    if (match.finalizedStats) return;
    await this.store.mutateMatch(match.id, (m) => {
      m.finalizedStats = true;
      return true;
    });

    if (match.roomId) {
      await this.store.mutateRoom(match.roomId, (room) => {
        room.status = 'lobby';
        room.activeMatchId = null;
        room.players.forEach((p) => {
          p.isReady = p.isHost;
          p.duelChallengeReady = false;
        });
        room.duelSubmissions = {};
        return { result: true };
      });
    }

    if (match.mode !== 'solo_adventure') {
      for (const pid of match.participantOrder) {
        const won = match.winnerIds.includes(pid);
        const rpDelta = match.isRanked ? (won ? 24 : -10) : won ? 10 : 3;
        const coinsDelta = won ? 60 : 20;
        this.creditPlayerProgress(pid, {
          wins: won ? 1 : 0,
          losses: won || match.winnerIds.length === 0 ? 0 : 1,
          rankPointsDelta: rpDelta,
          coinsDelta,
        });
      }
    }
  }

  private creditPlayerProgress(
    playerId: string,
    delta: { wins?: number; losses?: number; rankPointsDelta: number; coinsDelta: number }
  ): Profile | null {
    const existing = this.repo.getProfile(playerId);
    if (!existing) return null;
    if (!existing.isGuest) {
      return this.repo.updateProfileStats(playerId, {
        wins: delta.wins,
        losses: delta.losses,
        rankPointsDelta: delta.rankPointsDelta,
        matchPointsDelta: delta.coinsDelta,
      });
    }
    // Keep guest session coin & EXP counter responsive within the active session
    return this.repo.upsertProfile({
      ...existing,
      wins: existing.wins + (delta.wins ?? 0),
      losses: existing.losses + (delta.losses ?? 0),
      rankPoints: Math.max(100, existing.rankPoints + delta.rankPointsDelta),
      matchPointsBalance: Math.max(0, existing.matchPointsBalance + delta.coinsDelta),
    });
  }

  // ==================== REMATCH / CHAT / VIEW SHAPING ====================

  async addMatchChat(matchId: string, playerId: string, text: string): Promise<GuessItMatchStateClient> {
    const profile = await this.requireProfile(playerId);
    const clean = String(text || '').trim().slice(0, 160);
    if (!clean) throw new GuessItBadRequestError('Chat message required.');
    const res = await this.store.mutateMatch(matchId, (match) => {
      if (!match.participants[playerId]) throw new GuessItForbiddenError('Not a match participant.');
      match.messages.push({
        id: `gsm_${crypto.randomUUID().slice(0, 8)}`,
        roomId: match.id,
        senderId: profile.id,
        senderName: profile.username,
        senderAvatar: profile.avatarId,
        text: clean,
        createdAt: Date.now(),
      });
      if (match.messages.length > 60) match.messages = match.messages.slice(-60);
      match.updatedAt = Date.now();
      return match;
    });
    if (!res) throw new GuessItNotFoundError('GuessIt match not found.');
    return this.sanitizeMatchForViewerRecord(res.match, playerId);
  }

  async rematch(matchId: string, playerId: string): Promise<StoredGuessItMatch> {
    const oldMatch = await this.store.getMatch(matchId);
    if (!oldMatch) throw new GuessItNotFoundError('Match not found.');
    if (!oldMatch.participants[playerId]) {
      throw new GuessItForbiddenError('Only participants can trigger rematch.');
    }
    if (oldMatch.mode === 'solo_adventure' && oldMatch.stageId) {
      return this.startAdventureStageRecord(playerId, oldMatch.stageId);
    }
    const nextMatch = await this.createMatchFromParticipants({
      roomId: oldMatch.roomId,
      mode: oldMatch.mode,
      settings: oldMatch.settings,
      isRanked: oldMatch.isRanked,
      players: oldMatch.participantOrder.map((pid) => ({
        playerId: pid,
        username: oldMatch.participants[pid].username,
        avatarId: oldMatch.participants[pid].avatarId,
        teamId: oldMatch.participants[pid].teamId,
      })),
      usedSeedAnswers: oldMatch.usedAnswers.slice(-150),
    });
    if (oldMatch.roomId) {
      await this.store.mutateRoom(oldMatch.roomId, (room) => {
        room.status = 'in_progress';
        room.activeMatchId = nextMatch.id;
        return { result: true };
      });
    }
    return nextMatch;
  }

  async getMatchForViewer(matchId: string, viewerPlayerId: string): Promise<GuessItMatchStateClient> {
    const match = await this.store.getMatch(matchId);
    if (!match) throw new GuessItNotFoundError('GuessIt match not found.');
    return this.sanitizeMatchForViewerRecord(match, viewerPlayerId);
  }

  getMatchAudienceIds(match: StoredGuessItMatch): string[] {
    return [...match.participantOrder];
  }

  sanitizeMatchForViewerRecord(
    match: StoredGuessItMatch,
    viewerPlayerId: string,
    nowMs = Date.now()
  ): GuessItMatchStateClient {
    const viewerMeta = match.participants[viewerPlayerId] ?? null;
    const viewerUnit = viewerMeta ? this.findUnitForPlayer(match, viewerPlayerId) : null;
    const viewerIsSpectator = !viewerMeta || viewerMeta.isEliminated;
    const roundRevealed = match.status === 'round_over' || match.status === 'finished';

    const participants: Record<string, GuessItParticipantClient> = {};
    for (const pid of match.participantOrder) {
      const meta = match.participants[pid];
      const unit = this.findUnitForPlayer(match, pid);
      const isViewerUnit = Boolean(viewerUnit && unit && unit.unitId === viewerUnit.unitId);
      const canSeePuzzle = isViewerUnit || roundRevealed || viewerIsSpectator;

      let puzzleView: GuessItParticipantClient['puzzle'] = null;
      let revealedRatio = 0;

      if (unit) {
        const guessedSet = new Set(unit.guessedLetters);
        const revealFull = roundRevealed || (isViewerUnit && (unit.solved || unit.failed));

        if (unit.format === 'crossword' && unit.crosswordLayout) {
          const view = buildCrosswordClientView(unit.crosswordLayout, unit.category, guessedSet, revealFull);
          revealedRatio = view.totalLetters > 0 ? view.revealedLettersCount / view.totalLetters : 0;
          if (canSeePuzzle) puzzleView = view;
        } else {
          const view = buildClassicClientView(unit.answer, unit.category, guessedSet, revealFull, unit.clue);
          revealedRatio = view.totalLetters > 0 ? view.revealedLettersCount / view.totalLetters : 0;
          if (canSeePuzzle) puzzleView = view;
        }
      }

      participants[pid] = {
        playerId: pid,
        username: meta.username,
        avatarId: meta.avatarId,
        teamId: meta.teamId,
        score: meta.score,
        roundsWon: meta.roundsWon,
        isWinner: meta.isWinner,
        isEliminated: meta.isEliminated,
        isOnline: this.isPlayerOnline(pid),
        correctLetters: isViewerUnit || roundRevealed ? [...(unit?.correctLetters ?? [])] : [],
        wrongLetters: isViewerUnit || roundRevealed ? [...(unit?.wrongLetters ?? [])] : [],
        guessedLetters: isViewerUnit || roundRevealed ? [...(unit?.guessedLetters ?? [])] : [],
        wrongCount: unit?.wrongCount ?? 0,
        maxMistakes: unit?.maxMistakes ?? match.settings.maxMistakes,
        penaltyUntilMs: unit?.penaltyUntilMs ?? null,
        puzzleSolved: unit?.solved ?? false,
        puzzleFailed: unit?.failed ?? false,
        completionTimeMs: unit?.completionTimeMs ?? null,
        accuracyPercent: computeAccuracyPercent(
          meta.totalCorrectGuesses,
          meta.totalWrongGuesses
        ),
        revealedRatio: Math.round(revealedRatio * 100) / 100,
        activeTurnPlayerId: unit?.activePlayerId ?? null,
        puzzle: puzzleView,
      };
    }

    return {
      id: match.id,
      roomId: match.roomId,
      mode: match.mode,
      format: match.format,
      isRanked: match.isRanked,
      status: match.status,
      roundIndex: match.roundIndex,
      totalRounds: match.totalRounds,
      category: match.category,
      difficulty: match.difficulty,
      roundStartedAtMs: match.roundStartedAtMs,
      roundEndsAtMs: match.roundEndsAtMs,
      penaltyDurationMs: match.penaltyDurationMs,
      serverNowMs: nowMs,
      settings: match.settings,
      viewerPlayerId,
      viewerIsSpectator,
      viewerTeamId: viewerMeta?.teamId ?? null,
      participants,
      participantOrder: [...match.participantOrder],
      teamScores: { ...match.teamScores },
      teamActivePlayerIds: {
        blue: match.units['team:blue']?.activePlayerId ?? null,
        red: match.units['team:red']?.activePlayerId ?? null,
      },
      survivorIds: [...match.survivorIds],
      winnerIds: [...match.winnerIds],
      winningTeamId: match.winningTeamId,
      roundSummaries: [...match.roundSummaries],
      messages: [...match.messages],
      stageId: match.stageId ?? null,
      chapterId: match.chapterId ?? null,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
    };
  }

  // ==================== SOLO ADVENTURE & IDEMPOTENT REWARDS ====================

  private buildAdventureClientFromRows(
    rows: Map<string, StoredAdventureStageRow>
  ): GuessItAdventureProgressClient {
    let totalCoinsEarned = 0;
    let totalShards = 0;
    let totalExp = 0;

    const chapters: GuessItAdventureChapterClient[] = GUESSIT_ADVENTURE_CHAPTERS.map((ch) => {
      let prevDone = true;
      let completedStages = 0;
      let earnedStars = 0;

      const stages = ch.stages.map((st, idx) => {
        const row = rows.get(st.id);
        const completed = Boolean(row?.completed);
        const unlocked = idx === 0 || prevDone || completed;
        prevDone = completed;

        if (completed) {
          completedStages++;
          earnedStars += row?.bestStars ?? 0;
          if (row?.rewardClaimed) {
            totalCoinsEarned += st.rewardCoins;
            totalShards += st.rewardShards;
            totalExp += st.rewardExp;
          }
        }

        const { answers: _hiddenAnswers, ...safeStage } = st;
        return {
          ...safeStage,
          progress: {
            stageId: st.id,
            unlocked,
            completed,
            bestStars: row?.bestStars ?? 0,
            bestAccuracy: row?.bestAccuracy ?? 0,
            bestTimeMs: row?.bestTimeMs ?? null,
            rewardClaimed: Boolean(row?.rewardClaimed),
          },
        };
      });

      return {
        id: ch.id,
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        theme: ch.theme,
        description: ch.description,
        mascotQuote: ch.mascotQuote,
        totalStages: ch.stages.length,
        completedStages,
        totalStars: ch.stages.length * 3,
        earnedStars,
        stages,
      };
    });

    return {
      chapters,
      totalCoinsEarned,
      totalShards,
      totalExp,
    };
  }

  async getAdventureProgress(playerId: string): Promise<GuessItAdventureProgressClient> {
    await this.requireProfile(playerId);
    const rows = await this.store.getAdventureStageRows(playerId);
    return this.buildAdventureClientFromRows(rows);
  }

  async startAdventureStageRecord(
    playerId: string,
    stageId: string
  ): Promise<StoredGuessItMatch> {
    const profile = await this.requireProfile(playerId);
    const progress = await this.getAdventureProgress(playerId);
    let targetChapter = GUESSIT_ADVENTURE_CHAPTERS[0];
    let targetStage: GuessItAdventureStage | null = null;
    let stageUnlocked = false;
    let stageCompleted = false;

    for (let cIdx = 0; cIdx < GUESSIT_ADVENTURE_CHAPTERS.length; cIdx++) {
      const rawCh = GUESSIT_ADVENTURE_CHAPTERS[cIdx];
      const clientCh = progress.chapters[cIdx];
      const sIdx = rawCh.stages.findIndex((s) => s.id === stageId);
      if (sIdx >= 0) {
        targetChapter = rawCh;
        targetStage = rawCh.stages[sIdx];
        stageUnlocked = Boolean(clientCh?.stages[sIdx]?.progress.unlocked);
        stageCompleted = Boolean(clientCh?.stages[sIdx]?.progress.completed);
        break;
      }
    }

    if (!targetStage) throw new GuessItNotFoundError('Adventure stage not found.');
    if (!stageUnlocked) {
      throw new GuessItForbiddenError('Complete previous stage first to unlock this stage.');
    }

    let stageForRun: GuessItAdventureStage = targetStage;
    if (stageCompleted) {
      const extraWords = await this.store.listApprovedExtraWords();
      const excludeAnswers = this.getRecentAnswersForPlayers([playerId], targetStage.answers);
      const replaySeed = crypto.randomInt(1, 2147483647);
      if (targetStage.format === 'crossword') {
        const cw = pickCrosswordForCategory(extraWords, {
          category: targetStage.category,
          difficulty: targetStage.difficulty,
          excludeAnswers,
          entryCount: Math.max(2, targetStage.answers.length),
          seed: replaySeed,
        });
        stageForRun = {
          ...targetStage,
          answers: cw.layout.entries.map((e) => e.answer),
          clue: `${targetStage.category} Replay Crossword`,
        };
      } else {
        const picked = pickWordFromCatalog(extraWords, {
          category: targetStage.category,
          difficulty: targetStage.difficulty,
          excludeAnswers,
          seed: replaySeed,
        });
        stageForRun = {
          ...targetStage,
          answers: [picked.answer],
          clue: picked.clue ?? targetStage.clue,
        };
      }
    }

    const settings: GuessItRoomSettings = this.normalizeSettings({
      mode: 'speed_rush',
      format: stageForRun.format,
      category: stageForRun.category,
      difficulty: stageForRun.difficulty,
      wordSource: 'curated_db',
      roundsCount: 1,
      maxMistakes: stageForRun.maxMistakes,
      roundTimeSeconds: stageForRun.timeLimitSeconds,
      penaltyMs: stageForRun.penaltyMs,
      capacity: 2,
      isPublic: false,
    });

    return this.createMatchFromParticipants({
      roomId: null,
      mode: 'solo_adventure',
      settings,
      isRanked: false,
      players: [
        {
          playerId: profile.id,
          username: profile.username,
          avatarId: profile.avatarId,
          teamId: null,
        },
      ],
      stageId: stageForRun.id,
      chapterId: targetChapter.id,
      customStage: stageForRun,
    });
  }

  async startClassicSoloMatch(params: {
    playerId: string;
    difficulty: GuessItDifficulty;
    category: GuessItCategory | 'mix';
    format: 'classic' | 'crossword';
    timeLimitSeconds?: number;
    customAnswer?: string;
    customClue?: string;
  }): Promise<StoredGuessItMatch> {
    const profile = await this.requireProfile(params.playerId);
    const difficulty: GuessItDifficulty =
      params.difficulty === 'easy' || params.difficulty === 'hard' ? params.difficulty : 'medium';
    const format: 'classic' | 'crossword' =
      params.format === 'crossword' && !params.customAnswer ? 'crossword' : 'classic';
    const category: GuessItCategory =
      params.category !== 'mix' && GUESSIT_CATEGORIES.includes(params.category)
        ? params.category
        : GUESSIT_CATEGORIES[Math.floor(Math.random() * GUESSIT_CATEGORIES.length)];

    const maxMistakes = difficulty === 'easy' ? 8 : difficulty === 'hard' ? 4 : 6;
    const penaltyMs = difficulty === 'easy' ? 1200 : difficulty === 'hard' ? 3000 : 2000;
    const roundTimeSeconds =
      params.timeLimitSeconds && params.timeLimitSeconds > 0
        ? Math.max(60, Math.min(300, Math.round(params.timeLimitSeconds)))
        : 300;

    const settings: GuessItRoomSettings = this.normalizeSettings({
      mode: 'speed_rush',
      format,
      category,
      difficulty,
      wordSource: params.customAnswer ? 'custom_word' : 'curated_db',
      roundsCount: 1,
      maxMistakes,
      roundTimeSeconds,
      penaltyMs,
      capacity: 2,
      isPublic: false,
    });

    let customStage: GuessItAdventureStage | undefined;
    if (params.customAnswer && params.customAnswer.trim()) {
      const check = validateCustomPhrase(params.customAnswer);
      if (!check.valid) {
        throw new GuessItBadRequestError(check.error || 'Invalid custom word or phrase.');
      }
      customStage = {
        id: 'classic_custom',
        chapterId: 'classic_custom',
        stageNumber: 1,
        label: 'Custom Pack',
        title: 'Custom Pack',
        subtitle: category,
        category,
        difficulty,
        format: 'classic',
        answers: [check.normalized],
        clue: params.customClue?.trim().slice(0, 120) || category,
        maxMistakes,
        timeLimitSeconds: roundTimeSeconds,
        penaltyMs,
        rewardCoins: 0,
        rewardShards: 0,
        rewardExp: 0,
      };
    }

    return this.createMatchFromParticipants({
      roomId: null,
      mode: 'solo_adventure',
      settings,
      isRanked: false,
      players: [
        {
          playerId: profile.id,
          username: profile.username,
          avatarId: profile.avatarId,
          teamId: null,
        },
      ],
      stageId: null,
      chapterId: null,
      customStage,
    });
  }

  async claimAdventureReward(
    playerId: string,
    matchId: string
  ): Promise<GuessItAdventureClaimResult> {
    const profile = await this.requireProfile(playerId);
    const match = await this.store.getMatch(matchId);
    if (!match) throw new GuessItNotFoundError('Adventure match not found.');
    if (match.mode !== 'solo_adventure' || !match.stageId || !match.chapterId) {
      throw new GuessItBadRequestError('This match is not an Adventure stage.');
    }
    if (!match.participants[playerId]) {
      throw new GuessItForbiddenError('You do not own this match.');
    }
    if (match.status !== 'finished' || !match.winnerIds.includes(playerId)) {
      throw new GuessItBadRequestError('Complete the stage successfully before claiming rewards.');
    }

    const stage = GUESSIT_ADVENTURE_CHAPTERS.flatMap((c) => c.stages).find(
      (s) => s.id === match.stageId
    );
    if (!stage) throw new GuessItNotFoundError('Adventure stage metadata missing.');

    const unit = match.units[playerId];
    const wrongCount = unit?.wrongCount ?? 0;
    const stars = wrongCount <= 1 ? 3 : wrongCount <= 3 ? 2 : 1;
    const accuracy = computeAccuracyPercent(
      unit?.correctLetters.length ?? 0,
      wrongCount
    );
    const timeMs = unit?.completionTimeMs ?? null;

    const claimRes = await this.store.claimAdventureRewardAtomic({
      playerId,
      stageId: stage.id,
      chapterId: stage.chapterId,
      stars,
      accuracy,
      timeMs,
    });

    const expAwarded = claimRes.claimed ? stage.rewardExp : 0;
    const coinsAwarded = claimRes.claimed ? stage.rewardCoins : 0;
    const shardsAwarded = claimRes.claimed ? stage.rewardShards : 0;

    let updatedProfile = profile;
    if (claimRes.claimed) {
      updatedProfile =
        this.creditPlayerProgress(playerId, {
          wins: 1,
          rankPointsDelta: expAwarded,
          coinsDelta: coinsAwarded,
        }) ?? profile;
    }

    const updatedProgress = await this.getAdventureProgress(playerId);
    const chClient = updatedProgress.chapters.find((c) => c.id === stage.chapterId);

    return {
      claimed: claimRes.claimed,
      alreadyClaimed: claimRes.alreadyClaimed,
      stars,
      expAwarded,
      coinsAwarded,
      shardsAwarded,
      chapterCompletedCount: chClient?.completedStages ?? 0,
      chapterTotalStages: chClient?.totalStages ?? 5,
      newCoinsBalance: updatedProfile.matchPointsBalance,
      newRankPoints: updatedProfile.rankPoints,
      progress: updatedProgress,
    };
  }
}
