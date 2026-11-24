import crypto from 'node:crypto';
import { Profile } from '../../../shared/types.js';
import {
  TwistItAnswerSlot,
  TwistItMatchView,
  TwistItPlayerProgress,
  TwistItRoomSettings,
  TwistItRoomView,
  TwistItSoloStats,
  TwistItSubmitResult,
  TwistItWordLength,
} from '../../../shared/twistit/types.js';
import {
  pickTwistItPuzzle,
  scrambleSixLetters,
  validateTwistItWordAgainstAnswers,
} from '../../../shared/twistit/catalog.js';
import { StorageRepository } from '../../repositories/StorageRepository.js';
import {
  StoredTwistItPlayerRecord,
  StoredTwistItRoom,
  TwistItInternalMatch,
  TwistItStateStore,
} from './TwistItStateStore.js';

export class TwistItBadRequestError extends Error {
  status = 400;
}

export class TwistItForbiddenError extends Error {
  status = 403;
}

export class TwistItNotFoundError extends Error {
  status = 404;
}

const SOLO_COUNTDOWN_MS = 2400;
const RACE_COUNTDOWN_MS = 3200;
const DEFAULT_RACE_DURATION_SEC: 120 | 180 | 240 = 180;
const DEFAULT_AVATAR_COLORS = ['#6366f1', '#ec4899', '#06b6d4', '#f59e0b', '#10b981', '#8b5cf6'];

function avatarColorForProfile(profile: Profile): string {
  const raw = profile.avatarId || profile.id || 'player';
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return DEFAULT_AVATAR_COLORS[hash % DEFAULT_AVATAR_COLORS.length];
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function buildLengthCounts(answers: string[]): Record<TwistItWordLength, number> {
  const counts: Record<TwistItWordLength, number> = { 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const w of answers) {
    const len = w.length as TwistItWordLength;
    if (len in counts) counts[len] += 1;
  }
  return counts;
}

export class TwistItEngine {
  readonly store: TwistItStateStore;

  constructor(
    private readonly repo: StorageRepository,
    private readonly isOnline: (playerId: string) => boolean,
    private readonly options: {
      forceLocalMemory?: boolean;
      isServerless?: boolean;
      resolveProfile?: (playerId: string) => Promise<Profile | null>;
    } = {}
  ) {
    this.store = new TwistItStateStore({
      forceLocalMemory: options.forceLocalMemory,
      isServerless: options.isServerless,
    });
  }

  private async resolveProfileOrThrow(playerId: string): Promise<Profile> {
    const existing = this.repo.getProfile(playerId);
    if (existing) return existing;
    if (this.options.resolveProfile) {
      const resolved = await this.options.resolveProfile(playerId);
      if (resolved) return resolved;
    }
    throw new TwistItBadRequestError('Player profile not found.');
  }

  private toPublicRoom(room: StoredTwistItRoom): TwistItRoomView {
    return {
      code: room.code,
      hostUserId: room.hostUserId,
      status: room.status,
      capacity: 2,
      settings: room.settings,
      players: room.players.map((p) => ({
        ...p,
        connected: this.isOnline(p.userId) || p.connected,
      })),
      chat: room.chat,
      activeMatchId: room.activeMatchId,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }

  private buildSlotsForPlayer(
    answers: string[],
    player: StoredTwistItPlayerRecord,
    revealAllOnFinish: boolean
  ): TwistItAnswerSlot[] {
    return answers.map((word, index) => {
      const foundAtMs = player.foundByIndex[index];
      const found = typeof foundAtMs === 'number';
      return {
        index,
        length: word.length as TwistItWordLength,
        revealed: found,
        word: found || revealAllOnFinish ? word : null,
        foundAtMs: found ? foundAtMs : undefined,
      };
    });
  }

  private buildPlayerProgress(
    answers: string[],
    player: StoredTwistItPlayerRecord,
    includeSlots: boolean,
    revealAllOnFinish: boolean
  ): TwistItPlayerProgress {
    let foundCount = 0;
    let totalLettersFound = 0;
    for (let i = 0; i < answers.length; i++) {
      if (typeof player.foundByIndex[i] === 'number') {
        foundCount += 1;
        totalLettersFound += answers[i].length;
      }
    }
    const totalRequired = answers.length;
    const completionPercent = totalRequired > 0 ? Math.round((foundCount / totalRequired) * 100) : 0;
    const accuracyPercent =
      player.attemptsCount > 0
        ? Math.round((player.validSubmissionsCount / player.attemptsCount) * 100)
        : 100;

    const progress: TwistItPlayerProgress = {
      userId: player.userId,
      displayName: player.displayName,
      avatarColor: player.avatarColor,
      foundCount,
      totalRequired,
      totalLettersFound,
      completionPercent,
      attemptsCount: player.attemptsCount,
      validSubmissionsCount: player.validSubmissionsCount,
      accuracyPercent,
      completedAtMs: player.completedAtMs,
      completionDurationMs: player.completionDurationMs,
      connected: this.isOnline(player.userId) || player.connected,
    };

    if (includeSlots) {
      progress.slots = this.buildSlotsForPlayer(answers, player, revealAllOnFinish);
    }
    return progress;
  }

  sanitizeMatchForViewer(
    match: TwistItInternalMatch,
    viewerUserId: string,
    nowMs = Date.now(),
    extra?: { personalBestDurationMs?: number | null; isNewPersonalBest?: boolean }
  ): TwistItMatchView {
    let effectiveStatus = match.status;
    if (effectiveStatus === 'countdown' && nowMs >= match.startsAtMs) {
      effectiveStatus = 'playing';
    }
    const isFinished = effectiveStatus === 'finished';

    const selfRecord = match.players[viewerUserId];
    const selfSlots: TwistItAnswerSlot[] = selfRecord
      ? this.buildSlotsForPlayer(match.answers, selfRecord, isFinished)
      : match.answers.map((w, index) => ({
          index,
          length: w.length as TwistItWordLength,
          revealed: false,
          word: isFinished ? w : null,
        }));

    // CRITICAL ANTI-CHEAT: During active play, ONLY include slots for the viewing player.
    // Opponent progress shows counts/percentages only, never opponent's individual words.
    const players: TwistItPlayerProgress[] = match.playerOrder
      .map((pid) => match.players[pid])
      .filter(Boolean)
      .map((rec) =>
        this.buildPlayerProgress(match.answers, rec, isFinished || rec.userId === viewerUserId, isFinished)
      );

    return {
      id: match.id,
      roomCode: match.roomCode,
      mode: match.mode,
      status: effectiveStatus,
      puzzleId: match.puzzleId,
      scrambledLetters: match.scrambledLetters,
      totalRequired: match.answers.length,
      lengthCounts: match.lengthCounts,
      createdAtMs: match.createdAtMs,
      startsAtMs: match.startsAtMs,
      endsAtMs: match.endsAtMs,
      finishedAtMs: match.finishedAtMs,
      serverNowMs: nowMs,
      players,
      selfSlots,
      winnerIds: match.winnerIds,
      isDraw: match.isDraw,
      finishReason: match.finishReason,
      personalBestDurationMs: extra?.personalBestDurationMs,
      isNewPersonalBest: extra?.isNewPersonalBest,
    };
  }

  getMatchAudienceIds(match: TwistItInternalMatch): string[] {
    return [...match.playerOrder];
  }

  async getSoloStats(userId: string): Promise<TwistItSoloStats> {
    return this.store.getSoloStats(userId);
  }

  async startSoloMatch(playerId: string, excludePuzzleIds: string[] = []): Promise<TwistItMatchView> {
    const profile = await this.resolveProfileOrThrow(playerId);
    const stats = await this.store.getSoloStats(playerId);
    const recentExclude = new Set<string>([...stats.recentPuzzleIds.slice(-300), ...excludePuzzleIds]);
    const puzzle = pickTwistItPuzzle(recentExclude, Date.now() ^ Math.floor(Math.random() * 1e6));
    const nowMs = Date.now();
    const startsAtMs = nowMs + SOLO_COUNTDOWN_MS;
    const scrambledLetters = scrambleSixLetters(puzzle.letters, nowMs, puzzle.baseWord);

    const match: TwistItInternalMatch = {
      id: `twm_${crypto.randomUUID().slice(0, 12)}`,
      roomCode: null,
      mode: 'solo',
      status: 'countdown',
      puzzleId: puzzle.id,
      baseWord: puzzle.baseWord,
      scrambledLetters,
      answers: [...puzzle.answers],
      lengthCounts: buildLengthCounts(puzzle.answers),
      createdAtMs: nowMs,
      startsAtMs,
      endsAtMs: null,
      finishedAtMs: null,
      players: {
        [profile.id]: {
          userId: profile.id,
          displayName: profile.username,
          avatarColor: avatarColorForProfile(profile),
          foundByIndex: {},
          attemptsCount: 0,
          validSubmissionsCount: 0,
          completedAtMs: null,
          completionDurationMs: null,
          connected: true,
        },
      },
      playerOrder: [profile.id],
      winnerIds: [],
      isDraw: false,
      finishReason: null,
      finalizedStats: false,
      updatedAtMs: nowMs,
    };

    await this.store.saveMatch(match);
    return this.sanitizeMatchForViewer(match, profile.id, nowMs, {
      personalBestDurationMs: stats.bestByPuzzleId[puzzle.id] ?? stats.bestDurationMs ?? null,
    });
  }

  async listPublicRooms(): Promise<TwistItRoomView[]> {
    const rooms = await this.store.listPublicRooms();
    return rooms.map((r) => this.toPublicRoom(r));
  }

  async getRoom(code: string): Promise<TwistItRoomView> {
    const room = await this.store.getRoom(code);
    if (!room) throw new TwistItNotFoundError('TwistIt room not found.');
    return this.toPublicRoom(room);
  }

  async createRoom(
    hostId: string,
    partialSettings?: Partial<TwistItRoomSettings>
  ): Promise<TwistItRoomView> {
    const host = await this.resolveProfileOrThrow(hostId);
    let code = generateCode();
    for (let i = 0; i < 6; i++) {
      const clash = await this.store.getRoom(code);
      if (!clash) break;
      code = generateCode();
    }

    const roundDurationSec: 120 | 180 | 240 =
      partialSettings?.roundDurationSec === 120 ||
      partialSettings?.roundDurationSec === 240
        ? partialSettings.roundDurationSec
        : DEFAULT_RACE_DURATION_SEC;

    const nowIso = new Date().toISOString();
    const room: StoredTwistItRoom = {
      code,
      hostUserId: host.id,
      status: 'lobby',
      capacity: 2,
      settings: {
        isPublic: partialSettings?.isPublic ?? true,
        roundDurationSec,
      },
      players: [
        {
          userId: host.id,
          displayName: host.username,
          avatarColor: avatarColorForProfile(host),
          isHost: true,
          isReady: true,
          connected: true,
          joinedAt: nowIso,
        },
      ],
      chat: [],
      activeMatchId: null,
      recentPuzzleIds: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await this.store.saveRoom(room);
    return this.toPublicRoom(room);
  }

  async joinRoom(code: string, playerId: string): Promise<TwistItRoomView> {
    const clean = code.trim().toUpperCase();
    const player = await this.resolveProfileOrThrow(playerId);
    return this.store.withLock(`room:${clean}`, async () => {
      const room = await this.store.getRoom(clean);
      if (!room) throw new TwistItNotFoundError('TwistIt room not found.');
      const existing = room.players.find((p) => p.userId === player.id);
      if (existing) {
        existing.connected = true;
        existing.displayName = player.username;
        existing.avatarColor = avatarColorForProfile(player);
        room.updatedAt = new Date().toISOString();
        await this.store.saveRoom(room);
        return this.toPublicRoom(room);
      }
      if (room.players.length >= 2) {
        throw new TwistItBadRequestError('Room is full (1v1 supports at most 2 players).');
      }
      room.players.push({
        userId: player.id,
        displayName: player.username,
        avatarColor: avatarColorForProfile(player),
        isHost: false,
        isReady: false,
        connected: true,
        joinedAt: new Date().toISOString(),
      });
      room.updatedAt = new Date().toISOString();
      await this.store.saveRoom(room);
      return this.toPublicRoom(room);
    });
  }

  async leaveRoom(code: string, userId: string): Promise<TwistItRoomView | null> {
    const clean = code.trim().toUpperCase();
    return this.store.withLock(`room:${clean}`, async () => {
      const room = await this.store.getRoom(clean);
      if (!room) return null;
      room.players = room.players.filter((p) => p.userId !== userId);
      if (room.players.length === 0) {
        await this.store.deleteRoom(clean);
        return null;
      }
      if (room.hostUserId === userId) {
        room.hostUserId = room.players[0].userId;
        room.players[0].isHost = true;
        room.players[0].isReady = true;
      }
      room.updatedAt = new Date().toISOString();
      await this.store.saveRoom(room);
      return this.toPublicRoom(room);
    });
  }

  async setReady(code: string, userId: string, ready: boolean): Promise<TwistItRoomView> {
    const clean = code.trim().toUpperCase();
    return this.store.withLock(`room:${clean}`, async () => {
      const room = await this.store.getRoom(clean);
      if (!room) throw new TwistItNotFoundError('TwistIt room not found.');
      const player = room.players.find((p) => p.userId === userId);
      if (!player) throw new TwistItForbiddenError('You are not in this room.');
      player.isReady = Boolean(ready);
      room.updatedAt = new Date().toISOString();
      await this.store.saveRoom(room);
      return this.toPublicRoom(room);
    });
  }

  async updateSettings(
    code: string,
    hostUserId: string,
    patch: Partial<TwistItRoomSettings>
  ): Promise<TwistItRoomView> {
    const clean = code.trim().toUpperCase();
    return this.store.withLock(`room:${clean}`, async () => {
      const room = await this.store.getRoom(clean);
      if (!room) throw new TwistItNotFoundError('TwistIt room not found.');
      if (room.hostUserId !== hostUserId) {
        throw new TwistItForbiddenError('Only the room host can update match settings.');
      }
      if (typeof patch.isPublic === 'boolean') {
        room.settings.isPublic = patch.isPublic;
      }
      if (patch.roundDurationSec === 120 || patch.roundDurationSec === 180 || patch.roundDurationSec === 240) {
        room.settings.roundDurationSec = patch.roundDurationSec;
      }
      room.updatedAt = new Date().toISOString();
      await this.store.saveRoom(room);
      return this.toPublicRoom(room);
    });
  }

  async addRoomChat(code: string, userId: string, rawMessage: string): Promise<TwistItRoomView> {
    const clean = code.trim().toUpperCase();
    const message = String(rawMessage || '').trim().slice(0, 220);
    if (!message) throw new TwistItBadRequestError('Chat message cannot be empty.');
    return this.store.withLock(`room:${clean}`, async () => {
      const room = await this.store.getRoom(clean);
      if (!room) throw new TwistItNotFoundError('TwistIt room not found.');
      const member = room.players.find((p) => p.userId === userId);
      if (!member) throw new TwistItForbiddenError('Only room members can chat.');
      room.chat = [
        ...room.chat.slice(-49),
        {
          id: `twc_${crypto.randomUUID().slice(0, 8)}`,
          userId,
          displayName: member.displayName,
          message,
          createdAt: new Date().toISOString(),
        },
      ];
      room.updatedAt = new Date().toISOString();
      await this.store.saveRoom(room);
      return this.toPublicRoom(room);
    });
  }

  private createRaceMatchFromRoomLocked(room: StoredTwistItRoom): TwistItInternalMatch {
    const puzzle = pickTwistItPuzzle(
      room.recentPuzzleIds.slice(-250),
      Date.now() ^ Math.floor(Math.random() * 1e6)
    );
    room.recentPuzzleIds = [...room.recentPuzzleIds.slice(-300), puzzle.id];
    const nowMs = Date.now();
    const startsAtMs = nowMs + RACE_COUNTDOWN_MS;
    const endsAtMs = startsAtMs + room.settings.roundDurationSec * 1000;
    const scrambledLetters = scrambleSixLetters(puzzle.letters, nowMs, puzzle.baseWord);

    const players: Record<string, StoredTwistItPlayerRecord> = {};
    const playerOrder: string[] = [];
    for (const p of room.players.slice(0, 2)) {
      playerOrder.push(p.userId);
      players[p.userId] = {
        userId: p.userId,
        displayName: p.displayName,
        avatarColor: p.avatarColor,
        foundByIndex: {},
        attemptsCount: 0,
        validSubmissionsCount: 0,
        completedAtMs: null,
        completionDurationMs: null,
        connected: p.connected,
      };
    }

    const match: TwistItInternalMatch = {
      id: `twm_${crypto.randomUUID().slice(0, 12)}`,
      roomCode: room.code,
      mode: 'race_1v1',
      status: 'countdown',
      puzzleId: puzzle.id,
      baseWord: puzzle.baseWord,
      scrambledLetters,
      answers: [...puzzle.answers],
      lengthCounts: buildLengthCounts(puzzle.answers),
      createdAtMs: nowMs,
      startsAtMs,
      endsAtMs,
      finishedAtMs: null,
      players,
      playerOrder,
      winnerIds: [],
      isDraw: false,
      finishReason: null,
      finalizedStats: false,
      updatedAtMs: nowMs,
    };

    room.status = 'in_match';
    room.activeMatchId = match.id;
    room.updatedAt = new Date().toISOString();
    return match;
  }

  async startRoomMatch(
    code: string,
    actorId: string,
    options: { bypassHostCheck?: boolean } = {}
  ): Promise<{ room: TwistItRoomView; match: TwistItInternalMatch }> {
    const clean = code.trim().toUpperCase();
    return this.store.withLock(`room:${clean}`, async () => {
      const room = await this.store.getRoom(clean);
      if (!room) throw new TwistItNotFoundError('TwistIt room not found.');
      if (!options.bypassHostCheck && room.hostUserId !== actorId) {
        throw new TwistItForbiddenError('Only the host can start the 1v1 Speed Race.');
      }
      if (room.players.length < 2) {
        throw new TwistItBadRequestError('Waiting for a second player to join the 1v1 race.');
      }
      const match = this.createRaceMatchFromRoomLocked(room);
      await this.store.saveMatch(match);
      await this.store.saveRoom(room);
      return { room: this.toPublicRoom(room), match };
    });
  }

  async rematchRoom(
    code: string,
    userId: string
  ): Promise<{ room: TwistItRoomView; match: TwistItInternalMatch }> {
    const clean = code.trim().toUpperCase();
    return this.store.withLock(`room:${clean}`, async () => {
      const room = await this.store.getRoom(clean);
      if (!room) throw new TwistItNotFoundError('TwistIt room not found.');
      if (!room.players.some((p) => p.userId === userId)) {
        throw new TwistItForbiddenError('Only players in this room can trigger a rematch.');
      }
      if (room.players.length < 2) {
        throw new TwistItBadRequestError('Need 2 players in the room to start a rematch.');
      }
      // If the opponent just clicked Play Again and created an active match moments ago, join it cleanly!
      if (room.activeMatchId) {
        const current = await this.store.getMatch(room.activeMatchId);
        if (current && current.status !== 'finished') {
          return { room: this.toPublicRoom(room), match: current };
        }
      }
      const match = this.createRaceMatchFromRoomLocked(room);
      await this.store.saveMatch(match);
      await this.store.saveRoom(room);
      return { room: this.toPublicRoom(room), match };
    });
  }

  async joinQuickMatch(
    playerId: string
  ): Promise<{ status: 'queued' } | { status: 'matched'; room: TwistItRoomView; match: TwistItInternalMatch }> {
    await this.resolveProfileOrThrow(playerId);
    const pair = await this.store.enqueueQuickMatch(playerId);
    if (!pair || pair.length < 2) {
      return { status: 'queued' };
    }
    const [p1, p2] = pair;
    const room = await this.createRoom(p1, { isPublic: false, roundDurationSec: DEFAULT_RACE_DURATION_SEC });
    await this.joinRoom(room.code, p2);
    await this.setReady(room.code, p2, true);
    const started = await this.startRoomMatch(room.code, p1, { bypassHostCheck: true });
    return { status: 'matched', room: started.room, match: started.match };
  }

  async leaveQuickMatch(playerId: string): Promise<void> {
    await this.store.dequeueQuickMatch(playerId);
  }

  async getMatchForViewer(matchId: string, viewerUserId: string): Promise<TwistItMatchView> {
    const match = await this.store.getMatch(matchId);
    if (!match) throw new TwistItNotFoundError('TwistIt match not found.');
    const nowMs = Date.now();
    // Ensure timeout expiry evaluates cleanly on read too
    if (
      match.status !== 'finished' &&
      match.endsAtMs !== null &&
      nowMs >= match.endsAtMs
    ) {
      await this.finalizeTimedOutMatch(matchId, nowMs);
      const updated = (await this.store.getMatch(matchId)) || match;
      return this.sanitizeMatchForViewer(updated, viewerUserId, nowMs);
    }
    let personalBestDurationMs: number | null = null;
    if (match.mode === 'solo' && viewerUserId) {
      const stats = await this.store.getSoloStats(viewerUserId);
      personalBestDurationMs = stats.bestByPuzzleId[match.puzzleId] ?? stats.bestDurationMs ?? null;
    }
    return this.sanitizeMatchForViewer(match, viewerUserId, nowMs, { personalBestDurationMs });
  }

  private async finalizeMatchStats(match: TwistItInternalMatch): Promise<void> {
    if (match.finalizedStats) return;
    match.finalizedStats = true;
    for (const pid of match.playerOrder) {
      const profile = this.repo.getProfile(pid);
      if (!profile) continue;
      if (match.mode === 'solo') {
        if (match.winnerIds.includes(pid)) {
          profile.matchPointsBalance = (profile.matchPointsBalance || 0) + 25;
          this.repo.upsertProfile(profile);
        }
      } else {
        const won = match.winnerIds.includes(pid);
        const pts = won ? 35 : 12;
        profile.matchPointsBalance = (profile.matchPointsBalance || 0) + pts;
        if (!match.isDraw) {
          if (won) profile.wins = (profile.wins || 0) + 1;
          else profile.losses = (profile.losses || 0) + 1;
        }
        this.repo.upsertProfile(profile);
      }
    }
    if (match.roomCode) {
      const room = await this.store.getRoom(match.roomCode);
      if (room && room.activeMatchId === match.id) {
        room.status = 'lobby';
        room.updatedAt = new Date().toISOString();
        await this.store.saveRoom(room);
      }
    }
  }

  private applyTimeoutResolution(match: TwistItInternalMatch, nowMs: number): void {
    const progress = match.playerOrder.map((pid) => {
      const rec = match.players[pid];
      let foundCount = 0;
      let totalLetters = 0;
      for (let i = 0; i < match.answers.length; i++) {
        if (typeof rec.foundByIndex[i] === 'number') {
          foundCount += 1;
          totalLetters += match.answers[i].length;
        }
      }
      return { pid, foundCount, totalLetters };
    });

    if (progress.length === 2) {
      const [a, b] = progress;
      if (a.foundCount !== b.foundCount) {
        match.winnerIds = [a.foundCount > b.foundCount ? a.pid : b.pid];
        match.isDraw = false;
        match.finishReason = 'timeout_lead';
      } else if (a.totalLetters !== b.totalLetters) {
        match.winnerIds = [a.totalLetters > b.totalLetters ? a.pid : b.pid];
        match.isDraw = false;
        match.finishReason = 'timeout_letters_tiebreak';
      } else {
        match.winnerIds = [];
        match.isDraw = true;
        match.finishReason = 'timeout_draw';
      }
    } else if (progress.length === 1) {
      match.winnerIds = [];
      match.isDraw = false;
      match.finishReason = 'timeout_draw';
    }
    match.status = 'finished';
    match.finishedAtMs = nowMs;
    match.updatedAtMs = nowMs;
  }

  private async finalizeTimedOutMatch(matchId: string, nowMs = Date.now()): Promise<TwistItInternalMatch | null> {
    return this.store.withLock(`match:${matchId}`, async () => {
      const match = await this.store.getMatch(matchId);
      if (!match || match.status === 'finished') return null;
      if (match.endsAtMs === null || nowMs < match.endsAtMs) return null;
      this.applyTimeoutResolution(match, nowMs);
      await this.finalizeMatchStats(match);
      await this.store.saveMatch(match);
      return match;
    });
  }

  async submitWord(
    matchId: string,
    userId: string,
    rawWord: string
  ): Promise<{ result: TwistItSubmitResult; internalMatch: TwistItInternalMatch }> {
    return this.store.withLock(`match:${matchId}`, async () => {
      const match = await this.store.getMatch(matchId);
      if (!match) throw new TwistItNotFoundError('TwistIt match not found.');
      const player = match.players[userId];
      if (!player) throw new TwistItForbiddenError('You are not a participant in this match.');

      const nowMs = Date.now();
      if (match.status === 'finished') {
        const view = this.sanitizeMatchForViewer(match, userId, nowMs);
        return {
          internalMatch: match,
          result: {
            accepted: false,
            normalizedWord: '',
            errorCode: 'MATCH_NOT_ACTIVE',
            message: 'This match has already finished.',
            completedPuzzle: false,
            match: view,
          },
        };
      }

      if (nowMs < match.startsAtMs) {
        const view = this.sanitizeMatchForViewer(match, userId, nowMs);
        return {
          internalMatch: match,
          result: {
            accepted: false,
            normalizedWord: '',
            errorCode: 'COUNTDOWN_ACTIVE',
            message: 'Wait for the countdown to finish!',
            completedPuzzle: false,
            match: view,
          },
        };
      }

      if (match.status === 'countdown') {
        match.status = 'playing';
      }

      if (match.endsAtMs !== null && nowMs >= match.endsAtMs) {
        this.applyTimeoutResolution(match, nowMs);
        await this.finalizeMatchStats(match);
        await this.store.saveMatch(match);
        const view = this.sanitizeMatchForViewer(match, userId, nowMs);
        return {
          internalMatch: match,
          result: {
            accepted: false,
            normalizedWord: '',
            errorCode: 'MATCH_NOT_ACTIVE',
            message: 'Time is up!',
            completedPuzzle: false,
            match: view,
          },
        };
      }

      const foundWords = new Set<string>();
      for (const idxStr of Object.keys(player.foundByIndex)) {
        const idx = Number(idxStr);
        if (match.answers[idx]) foundWords.add(match.answers[idx]);
      }

      const validation = validateTwistItWordAgainstAnswers(
        rawWord,
        match.scrambledLetters,
        match.answers,
        foundWords
      );

      player.attemptsCount += 1;
      match.updatedAtMs = nowMs;

      if (!validation.ok) {
        await this.store.saveMatch(match);
        const view = this.sanitizeMatchForViewer(match, userId, nowMs);
        return {
          internalMatch: match,
          result: {
            accepted: false,
            normalizedWord: validation.word,
            errorCode: validation.errorCode,
            message: validation.message,
            completedPuzzle: false,
            match: view,
          },
        };
      }

      player.foundByIndex[validation.answerIndex] = nowMs;
      player.validSubmissionsCount += 1;

      const totalFound = Object.keys(player.foundByIndex).length;
      const completedPuzzle = totalFound >= match.answers.length;

      let personalBestDurationMs: number | null = null;
      let isNewPersonalBest = false;

      if (completedPuzzle) {
        const duration = Math.max(100, nowMs - match.startsAtMs);
        player.completedAtMs = nowMs;
        player.completionDurationMs = duration;
        match.status = 'finished';
        match.finishedAtMs = nowMs;
        match.winnerIds = [userId];
        match.isDraw = false;
        match.finishReason = 'completed_all';

        if (match.mode === 'solo') {
          const stats = await this.store.getSoloStats(userId);
          const prevOverallBest = stats.bestDurationMs;
          const prevPuzzleBest = stats.bestByPuzzleId[match.puzzleId];
          isNewPersonalBest = prevOverallBest === null || duration < prevOverallBest;
          stats.completedPuzzlesCount += 1;
          stats.bestDurationMs = prevOverallBest === null ? duration : Math.min(prevOverallBest, duration);
          stats.bestByPuzzleId[match.puzzleId] =
            prevPuzzleBest === undefined ? duration : Math.min(prevPuzzleBest, duration);
          stats.recentPuzzleIds = [
            ...stats.recentPuzzleIds.filter((id) => id !== match.puzzleId).slice(-299),
            match.puzzleId,
          ];
          await this.store.saveSoloStats(userId, stats);
          personalBestDurationMs = stats.bestDurationMs;
        }
        await this.finalizeMatchStats(match);
      }

      await this.store.saveMatch(match);
      const view = this.sanitizeMatchForViewer(match, userId, nowMs, {
        personalBestDurationMs,
        isNewPersonalBest,
      });

      return {
        internalMatch: match,
        result: {
          accepted: true,
          normalizedWord: validation.word,
          message: completedPuzzle
            ? `${validation.word}! Puzzle completed!`
            : `Great! +${validation.word}`,
          slotIndex: validation.answerIndex,
          completedPuzzle,
          match: view,
        },
      };
    });
  }

  async processExpiredMatches(nowMs = Date.now()): Promise<TwistItInternalMatch[]> {
    const changed: TwistItInternalMatch[] = [];
    const active = this.options.isServerless
      ? await this.store.listActiveCloudMatches()
      : this.store.listCachedMatches().filter((m) => m.status !== 'finished');

    for (const m of active) {
      if (m.status === 'countdown' && nowMs >= m.startsAtMs) {
        const updated = await this.store.withLock(`match:${m.id}`, async () => {
          const cur = await this.store.getMatch(m.id);
          if (!cur || cur.status !== 'countdown' || nowMs < cur.startsAtMs) return null;
          cur.status = 'playing';
          cur.updatedAtMs = nowMs;
          await this.store.saveMatch(cur);
          return cur;
        });
        if (updated) changed.push(updated);
      }
      if (m.endsAtMs !== null && nowMs >= m.endsAtMs) {
        const ended = await this.finalizeTimedOutMatch(m.id, nowMs);
        if (ended) changed.push(ended);
      }
    }
    return changed;
  }
}
