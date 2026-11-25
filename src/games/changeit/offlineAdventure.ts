import {
  ALL_CHANGEIT_ADVENTURE_STAGES,
  CHANGEIT_ADVENTURE_CHAPTERS,
  computeAdventureStars,
  getChangeItAdventureStage,
} from '../../../shared/changeit/adventureCatalog';
import { createEmptyRestriction } from '../../../shared/changeit/generator';
import {
  ChangeItAdventureChapterClient,
  ChangeItAdventureClaimResult,
  ChangeItAdventureProgressClient,
  ChangeItAdventureStageClient,
  ChangeItMatchStateClient,
  ChangeItTransformResponse,
  ChangeItWordLength,
} from '../../../shared/changeit/types';
import {
  bfsShortestPath,
  validateMoveTransformation,
} from '../../../shared/changeit/wordGraph';
import { loadChangeItClientData } from './clientDictionary';

interface OfflineStageProgressRecord {
  completed: boolean;
  bestStars: number;
  fewestMoves: number | null;
  bestTimeMs: number | null;
  rewardClaimed: boolean;
}

const OFFLINE_ADV_KEY = 'enscribe_changeit_offline_adventure_v1';

interface OfflineActiveMatch {
  id: string;
  stageId: string;
  chapterId: string;
  stageTitle: string;
  difficulty: ChangeItMatchStateClient['difficulty'];
  wordLength: ChangeItWordLength;
  startWord: string;
  currentWord: string;
  targetWord: string;
  minMoves: number;
  startedAtMs: number;
  completedAtMs: number | null;
  completed: boolean;
  hintsUsed: number;
  activeHintWord: string | null;
  invalidAttempts: number;
  history: ChangeItMatchStateClient['self']['history'];
  usedWords: string[];
}

const offlineMatches = new Map<string, OfflineActiveMatch>();

export function isOfflineChangeItMatchId(matchId: string): boolean {
  return matchId.startsWith('ci_offline_');
}

function loadOfflineProgressMap(): Record<string, OfflineStageProgressRecord> {
  try {
    const raw = localStorage.getItem(OFFLINE_ADV_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveOfflineProgressMap(map: Record<string, OfflineStageProgressRecord>): void {
  try {
    localStorage.setItem(OFFLINE_ADV_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

export function getOfflineChangeItAdventureProgress(
  playerId: string
): ChangeItAdventureProgressClient {
  const map = loadOfflineProgressMap();
  let totalStars = 0;
  let maxStars = 0;
  let completedCount = 0;
  let prevCompleted = true;

  const chapters: ChangeItAdventureChapterClient[] = CHANGEIT_ADVENTURE_CHAPTERS.map((ch) => {
    let chStars = 0;
    const chUnlocked = prevCompleted;
    const stages: ChangeItAdventureStageClient[] = ch.stages.map((st) => {
      const rec = map[st.id];
      const completed = Boolean(rec?.completed);
      const unlocked = prevCompleted || completed;
      const bestStars = rec?.bestStars ?? 0;
      chStars += bestStars;
      totalStars += bestStars;
      maxStars += 3;
      if (completed) completedCount++;
      prevCompleted = completed;

      return {
        ...st,
        unlocked,
        completed,
        bestStars,
        fewestMoves: rec?.fewestMoves ?? null,
        bestTimeMs: rec?.bestTimeMs ?? null,
        rewardClaimed: Boolean(rec?.rewardClaimed),
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

function toClientMatch(m: OfflineActiveMatch): ChangeItMatchStateClient {
  const now = Date.now();
  const validMoves = m.history.length;
  const eff =
    validMoves > 0 ? Math.min(100, Math.round((m.minMoves / validMoves) * 100)) : 0;
  return {
    id: m.id,
    roomId: null,
    mode: 'solo_adventure',
    difficulty: m.difficulty,
    wordLength: m.wordLength,
    isRanked: false,
    modifiersEnabled: false,
    hintsAllowed: true,
    status: m.completed ? 'finished' : 'playing',
    startedAtMs: m.startedAtMs,
    endsAtMs: m.startedAtMs + 30 * 60 * 1000,
    serverNowMs: now,
    stageId: m.stageId,
    chapterId: m.chapterId,
    stageTitle: m.stageTitle,
    self: {
      currentWord: m.currentWord,
      startWord: m.startWord,
      targetWord: m.targetWord,
      minMoves: m.minMoves,
      history: [...m.history],
      validMoves,
      invalidAttempts: m.invalidAttempts,
      elapsedMs: Math.max(0, (m.completedAtMs ?? now) - m.startedAtMs),
      efficiencyPercent: eff,
      completed: m.completed,
      completedAtMs: m.completedAtMs,
      forfeited: false,
      timedOut: false,
      hintsUsed: m.hintsUsed,
      activeHintWord: m.activeHintWord,
      restrictions: createEmptyRestriction(),
      lastChangedIndex:
        m.history.length > 0 ? (m.history[m.history.length - 1].changedIndices[0] ?? null) : null,
      heldModifiers: [],
      modifierProgress: 0,
      modifierCooldowns: {},
      activeModifiers: [],
      puzzlesCompleted: m.completed ? 1 : 0,
      survivalScore: 0,
      playerDeadlineMs: null,
    },
    opponents: [],
    relayTeams: null,
    winnerIds: m.completed ? ['offline_player'] : [],
    winningTeamId: null,
    finishReason: m.completed ? 'adventure_completed' : null,
    messages: [],
  };
}

export async function startOfflineChangeItStage(
  stageId: string
): Promise<ChangeItMatchStateClient> {
  await loadChangeItClientData();
  const stage = getChangeItAdventureStage(stageId);
  if (!stage) throw new Error('Adventure stage not found.');

  const now = Date.now();
  const id = `ci_offline_${now}_${Math.random().toString(36).slice(2, 7)}`;
  const rec: OfflineActiveMatch = {
    id,
    stageId: stage.id,
    chapterId: stage.chapterId,
    stageTitle: `${stage.label}: ${stage.title}`,
    difficulty: stage.difficulty,
    wordLength: stage.wordLength,
    startWord: stage.startWord,
    currentWord: stage.startWord,
    targetWord: stage.targetWord,
    minMoves: stage.minMoves,
    startedAtMs: now,
    completedAtMs: null,
    completed: false,
    hintsUsed: 0,
    activeHintWord: null,
    invalidAttempts: 0,
    history: [],
    usedWords: [stage.startWord],
  };
  offlineMatches.set(id, rec);
  return toClientMatch(rec);
}

export async function submitOfflineChangeItTransform(
  matchId: string,
  word: string
): Promise<ChangeItTransformResponse> {
  const m = offlineMatches.get(matchId);
  if (!m) throw new Error('Offline match not found.');
  const data = await loadChangeItClientData();
  const check = validateMoveTransformation({
    currentWord: m.currentWord,
    submittedWord: word,
    targetWord: m.targetWord,
    usedWords: new Set(m.usedWords),
    validationSet: data.validationSet,
    restrictions: createEmptyRestriction(),
    lastChangedIndex: null,
  });

  if (!check.valid) {
    m.invalidAttempts++;
    return {
      accepted: false,
      errorCode: check.errorCode,
      message: check.message,
      completedPuzzle: false,
      changedIndices: check.changedIndices,
      usedDoubleShift: false,
      match: toClientMatch(m),
    };
  }

  const now = Date.now();
  m.currentWord = check.normalizedWord;
  m.usedWords.push(check.normalizedWord);
  m.activeHintWord = null;
  m.history.push({
    word: check.normalizedWord,
    changedIndices: check.changedIndices,
    timestampMs: now,
  });

  const done = m.currentWord === m.targetWord;
  if (done) {
    m.completed = true;
    m.completedAtMs = now;
  }

  return {
    accepted: true,
    message: done ? `Target "${m.targetWord}" reached!` : check.message,
    completedPuzzle: done,
    changedIndices: check.changedIndices,
    usedDoubleShift: false,
    match: toClientMatch(m),
  };
}

export async function useOfflineChangeItHint(matchId: string): Promise<ChangeItMatchStateClient> {
  const m = offlineMatches.get(matchId);
  if (!m) throw new Error('Offline match not found.');
  const data = await loadChangeItClientData();
  const res = bfsShortestPath(data.validationGraphs[m.wordLength], m.currentWord, m.targetWord, {
    excludedWords: new Set(m.usedWords),
  });
  if (!res.solvable || res.optimalNextWords.length === 0) {
    throw new Error('No optimal step available from current word.');
  }
  m.hintsUsed++;
  m.activeHintWord = res.optimalNextWords[0];
  return toClientMatch(m);
}

export function retryOfflineChangeItMatch(matchId: string): ChangeItMatchStateClient {
  const m = offlineMatches.get(matchId);
  if (!m) throw new Error('Offline match not found.');
  const now = Date.now();
  m.currentWord = m.startWord;
  m.usedWords = [m.startWord];
  m.history = [];
  m.invalidAttempts = 0;
  m.hintsUsed = 0;
  m.activeHintWord = null;
  m.completed = false;
  m.completedAtMs = null;
  m.startedAtMs = now;
  return toClientMatch(m);
}

export function claimOfflineChangeItReward(
  playerId: string,
  matchId: string
): ChangeItAdventureClaimResult {
  const m = offlineMatches.get(matchId);
  if (!m || !m.completed) throw new Error('Complete the level first.');
  const stage = getChangeItAdventureStage(m.stageId);
  const movesUsed = m.history.length;
  const elapsedMs = Math.max(1, (m.completedAtMs ?? Date.now()) - m.startedAtMs);
  const stars = computeAdventureStars(movesUsed, m.minMoves, m.hintsUsed);

  const map = loadOfflineProgressMap();
  const prev = map[m.stageId];
  const newlyClaimed = !prev || !prev.rewardClaimed;
  map[m.stageId] = {
    completed: true,
    bestStars: Math.max(prev?.bestStars ?? 0, stars),
    fewestMoves:
      prev?.fewestMoves !== null && prev?.fewestMoves !== undefined
        ? Math.min(prev.fewestMoves, movesUsed)
        : movesUsed,
    bestTimeMs:
      prev?.bestTimeMs !== null && prev?.bestTimeMs !== undefined
        ? Math.min(prev.bestTimeMs, elapsedMs)
        : elapsedMs,
    rewardClaimed: true,
  };
  saveOfflineProgressMap(map);

  return {
    claimed: newlyClaimed,
    alreadyClaimed: !newlyClaimed,
    starsEarned: stars,
    movesUsed,
    minMoves: m.minMoves,
    hintsUsed: m.hintsUsed,
    elapsedMs,
    coinsAwarded: newlyClaimed ? (stage?.rewardCoins ?? 100) : 0,
    newCoinsBalance: 0,
    progress: getOfflineChangeItAdventureProgress(playerId),
  };
}
