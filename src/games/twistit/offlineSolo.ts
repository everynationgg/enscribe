import {
  TwistItMatchView,
  TwistItSoloStats,
  TwistItSubmitResult,
  TwistItWordLength,
} from '../../../shared/twistit/types';
import {
  pickTwistItPuzzle,
  scrambleSixLetters,
  validateTwistItWordAgainstAnswers,
} from '../../../shared/twistit/catalog';

const STATS_KEY = 'enscribe_twistit_solo_stats_v1';

interface OfflineSoloSession {
  matchId: string;
  puzzleId: string;
  answers: string[];
  scrambledLetters: string[];
  startsAtMs: number;
  endsAtMs: number | null;
  foundByIndex: Record<number, number>;
  attemptsCount: number;
  validSubmissionsCount: number;
  completedDurationMs: number | null;
  playerId: string;
  displayName: string;
  avatarColor: string;
}

const offlineSessions = new Map<string, OfflineSoloSession>();

export function getOfflineTwistItSoloStats(): TwistItSoloStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TwistItSoloStats>;
      return {
        completedPuzzlesCount: Number(parsed.completedPuzzlesCount || 0),
        bestDurationMs: typeof parsed.bestDurationMs === 'number' ? parsed.bestDurationMs : null,
        recentPuzzleIds: Array.isArray(parsed.recentPuzzleIds) ? parsed.recentPuzzleIds : [],
        bestByPuzzleId: parsed.bestByPuzzleId || {},
      };
    }
  } catch {
    // ignore storage failures
  }
  return {
    completedPuzzlesCount: 0,
    bestDurationMs: null,
    recentPuzzleIds: [],
    bestByPuzzleId: {},
  };
}

function saveOfflineTwistItSoloStats(stats: TwistItSoloStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // ignore quota failures
  }
}

function buildView(
  session: OfflineSoloSession,
  stats: TwistItSoloStats,
  isNewPersonalBest = false
): TwistItMatchView {
  const nowMs = Date.now();
  const isFinished = session.completedDurationMs !== null;
  const status: TwistItMatchView['status'] = isFinished
    ? 'finished'
    : nowMs < session.startsAtMs
    ? 'countdown'
    : 'playing';

  const lengthCounts: Record<TwistItWordLength, number> = { 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const w of session.answers) {
    const l = w.length as TwistItWordLength;
    if (l in lengthCounts) lengthCounts[l] += 1;
  }

  let foundCount = 0;
  let totalLettersFound = 0;
  const selfSlots = session.answers.map((word, index) => {
    const foundAtMs = session.foundByIndex[index];
    const revealed = typeof foundAtMs === 'number';
    if (revealed) {
      foundCount += 1;
      totalLettersFound += word.length;
    }
    return {
      index,
      length: word.length as TwistItWordLength,
      revealed,
      word: revealed || isFinished ? word : null,
      foundAtMs,
    };
  });

  const totalRequired = session.answers.length;
  const accuracyPercent =
    session.attemptsCount > 0
      ? Math.round((session.validSubmissionsCount / session.attemptsCount) * 100)
      : 100;

  return {
    id: session.matchId,
    roomCode: null,
    mode: 'solo',
    status,
    puzzleId: session.puzzleId,
    scrambledLetters: session.scrambledLetters,
    totalRequired,
    lengthCounts,
    createdAtMs: session.startsAtMs - 2400,
    startsAtMs: session.startsAtMs,
    endsAtMs: session.endsAtMs,
    finishedAtMs: isFinished ? session.startsAtMs + (session.completedDurationMs || 0) : null,
    serverNowMs: nowMs,
    players: [
      {
        userId: session.playerId,
        displayName: session.displayName,
        avatarColor: session.avatarColor,
        foundCount,
        totalRequired,
        totalLettersFound,
        completionPercent: totalRequired > 0 ? Math.round((foundCount / totalRequired) * 100) : 0,
        attemptsCount: session.attemptsCount,
        validSubmissionsCount: session.validSubmissionsCount,
        accuracyPercent,
        completedAtMs: isFinished ? session.startsAtMs + (session.completedDurationMs || 0) : null,
        completionDurationMs: session.completedDurationMs,
        connected: true,
        slots: selfSlots,
      },
    ],
    selfSlots,
    winnerIds: isFinished ? [session.playerId] : [],
    isDraw: false,
    finishReason: isFinished ? 'completed_all' : null,
    personalBestDurationMs: stats.bestDurationMs,
    isNewPersonalBest,
  };
}

export function startOfflineTwistItSolo(
  playerId: string,
  displayName: string,
  excludePuzzleIds: string[] = [],
  options?: {
    difficulty?: 'easy' | 'normal' | 'hard';
    timeLimitSeconds?: number;
    customBaseWord?: string;
    customAnswers?: string[];
  }
): TwistItMatchView {
  const stats = getOfflineTwistItSoloStats();
  const rawBase = String(options?.customBaseWord || '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();
  const rawAnswers = Array.isArray(options?.customAnswers)
    ? Array.from(
        new Set(
          options!.customAnswers
            .map((w) => String(w || '').replace(/[^a-zA-Z]/g, '').toUpperCase())
            .filter((w) => w.length >= 3 && w.length <= 6)
        )
      )
    : [];

  let puzzleId = '';
  let baseWord = '';
  let letters: string[] = [];
  let answers: string[] = [];
  if (rawBase.length === 6 && rawAnswers.length >= 3) {
    puzzleId = `custom_${rawBase}`;
    baseWord = rawBase;
    letters = rawBase.split('');
    answers = rawAnswers.sort((a, b) => a.length - b.length || a.localeCompare(b));
  } else {
    const puzzle = pickTwistItPuzzle(
      [...stats.recentPuzzleIds.slice(-300), ...excludePuzzleIds],
      Date.now() ^ Math.floor(Math.random() * 1e6),
      options?.difficulty
    );
    puzzleId = puzzle.id;
    baseWord = puzzle.baseWord;
    letters = puzzle.letters;
    answers = [...puzzle.answers];
  }

  const nowMs = Date.now();
  const startsAtMs = nowMs + 2400;
  const timeSec = Math.round(Number(options?.timeLimitSeconds) || 0);
  const endsAtMs = timeSec > 0 ? startsAtMs + Math.max(60, Math.min(360, timeSec)) * 1000 : null;
  const session: OfflineSoloSession = {
    matchId: `tw_offline_${nowMs}_${Math.random().toString(36).slice(2, 7)}`,
    puzzleId,
    answers,
    scrambledLetters: scrambleSixLetters(letters, nowMs, baseWord),
    startsAtMs,
    endsAtMs,
    foundByIndex: {},
    attemptsCount: 0,
    validSubmissionsCount: 0,
    completedDurationMs: null,
    playerId,
    displayName,
    avatarColor: '#8b5cf6',
  };
  offlineSessions.set(session.matchId, session);
  return buildView(session, stats);
}

export function isOfflineTwistItMatch(matchId: string): boolean {
  return matchId.startsWith('tw_offline_');
}

export function submitOfflineTwistItWord(matchId: string, rawWord: string): TwistItSubmitResult {
  const session = offlineSessions.get(matchId);
  const stats = getOfflineTwistItSoloStats();
  if (!session) {
    throw new Error('Offline TwistIt session not found.');
  }
  const nowMs = Date.now();
  if (nowMs < session.startsAtMs) {
    return {
      accepted: false,
      normalizedWord: '',
      errorCode: 'COUNTDOWN_ACTIVE',
      message: 'Wait for the countdown to finish!',
      completedPuzzle: false,
      match: buildView(session, stats),
    };
  }
  if (session.completedDurationMs !== null) {
    return {
      accepted: false,
      normalizedWord: '',
      errorCode: 'MATCH_NOT_ACTIVE',
      message: 'Puzzle already completed!',
      completedPuzzle: false,
      match: buildView(session, stats),
    };
  }

  const foundSet = new Set<string>();
  for (const idxStr of Object.keys(session.foundByIndex)) {
    const idx = Number(idxStr);
    if (session.answers[idx]) foundSet.add(session.answers[idx]);
  }
  const validation = validateTwistItWordAgainstAnswers(
    rawWord,
    session.scrambledLetters,
    session.answers,
    foundSet
  );
  session.attemptsCount += 1;

  if (!validation.ok) {
    return {
      accepted: false,
      normalizedWord: validation.word,
      errorCode: validation.errorCode,
      message: validation.message,
      completedPuzzle: false,
      match: buildView(session, stats),
    };
  }

  session.foundByIndex[validation.answerIndex] = nowMs;
  session.validSubmissionsCount += 1;
  const completedPuzzle = Object.keys(session.foundByIndex).length >= session.answers.length;
  let isNewPersonalBest = false;
  if (completedPuzzle) {
    const dur = Math.max(100, nowMs - session.startsAtMs);
    session.completedDurationMs = dur;
    isNewPersonalBest = stats.bestDurationMs === null || dur < stats.bestDurationMs;
    stats.completedPuzzlesCount += 1;
    stats.bestDurationMs =
      stats.bestDurationMs === null ? dur : Math.min(stats.bestDurationMs, dur);
    const prevPuzzleBest = stats.bestByPuzzleId[session.puzzleId];
    stats.bestByPuzzleId[session.puzzleId] =
      prevPuzzleBest === undefined ? dur : Math.min(prevPuzzleBest, dur);
    stats.recentPuzzleIds = [
      ...stats.recentPuzzleIds.filter((id) => id !== session.puzzleId).slice(-299),
      session.puzzleId,
    ];
    saveOfflineTwistItSoloStats(stats);
  }

  return {
    accepted: true,
    normalizedWord: validation.word,
    message: completedPuzzle ? `${validation.word}! Puzzle completed!` : `Great! +${validation.word}`,
    slotIndex: validation.answerIndex,
    completedPuzzle,
    match: buildView(session, stats, isNewPersonalBest),
  };
}
