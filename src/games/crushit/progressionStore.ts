import { CRUSHIT_TOTAL_STAGES } from '../../../shared/crushit/stagesCatalog';
import {
  CrushItProgressionState,
  CrushItStageResultPayload,
  StageProgressRecord,
} from '../../../shared/crushit/types';
import { api } from '../../services/api';

const STORAGE_KEY_PREFIX = 'enscribe_crushit_progress_v1_';

export function createDefaultCrushItProgress(playerId: string): CrushItProgressionState {
  return {
    playerId,
    highestUnlockedStage: 1,
    totalScore: 0,
    totalWordsFormed: 0,
    totalPowerUpsUsed: 0,
    completedStagesCount: 0,
    stages: {},
    updatedAtMs: Date.now(),
  };
}

function getStorageKey(playerId: string): string {
  const safe = (playerId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${STORAGE_KEY_PREFIX}${safe}`;
}

export function loadLocalCrushItProgress(playerId: string): CrushItProgressionState {
  try {
    const raw = localStorage.getItem(getStorageKey(playerId));
    if (!raw) return createDefaultCrushItProgress(playerId);
    const parsed = JSON.parse(raw) as CrushItProgressionState;
    if (!parsed || typeof parsed !== 'object') {
      return createDefaultCrushItProgress(playerId);
    }
    return {
      ...createDefaultCrushItProgress(playerId),
      ...parsed,
      playerId,
      highestUnlockedStage: Math.max(
        1,
        Math.min(CRUSHIT_TOTAL_STAGES, Number(parsed.highestUnlockedStage) || 1)
      ),
      stages: parsed.stages && typeof parsed.stages === 'object' ? parsed.stages : {},
    };
  } catch {
    return createDefaultCrushItProgress(playerId);
  }
}

export function saveLocalCrushItProgress(progress: CrushItProgressionState): void {
  try {
    localStorage.setItem(getStorageKey(progress.playerId), JSON.stringify(progress));
  } catch {
    // ignore storage quota failures
  }
}

/**
 * Merges local and server progression monotonically so neither offline nor online
 * progress or personal bests can ever regress.
 */
export function mergeCrushItProgress(
  local: CrushItProgressionState,
  remote: CrushItProgressionState
): CrushItProgressionState {
  const stages: Record<number, StageProgressRecord> = {};
  const allStageNums = new Set<number>([
    ...Object.keys(local.stages).map(Number),
    ...Object.keys(remote.stages).map(Number),
  ]);

  let highestCompleted = 0;
  let completedCount = 0;
  let totalBestScore = 0;

  for (const sn of allStageNums) {
    if (!Number.isInteger(sn) || sn < 1 || sn > CRUSHIT_TOTAL_STAGES) continue;
    const a = local.stages[sn];
    const b = remote.stages[sn];
    const merged: StageProgressRecord = {
      stageNumber: sn,
      completed: Boolean(a?.completed || b?.completed),
      bestScore: Math.max(a?.bestScore ?? 0, b?.bestScore ?? 0),
      bestStars: Math.max(a?.bestStars ?? 0, b?.bestStars ?? 0),
      bestMovesRemaining: Math.max(a?.bestMovesRemaining ?? 0, b?.bestMovesRemaining ?? 0),
      bestLongestWord: Math.max(a?.bestLongestWord ?? 0, b?.bestLongestWord ?? 0),
      attempts: Math.max(a?.attempts ?? 0, b?.attempts ?? 0),
      completedAtMs: a?.completedAtMs ?? b?.completedAtMs ?? null,
    };
    stages[sn] = merged;
    totalBestScore += merged.bestScore;
    if (merged.completed) {
      completedCount++;
      if (sn > highestCompleted) highestCompleted = sn;
    }
  }

  return {
    playerId: local.playerId || remote.playerId,
    highestUnlockedStage: Math.max(
      local.highestUnlockedStage,
      remote.highestUnlockedStage,
      Math.min(CRUSHIT_TOTAL_STAGES, highestCompleted + 1)
    ),
    totalScore: Math.max(local.totalScore, remote.totalScore, totalBestScore),
    totalWordsFormed: Math.max(local.totalWordsFormed, remote.totalWordsFormed),
    totalPowerUpsUsed: Math.max(local.totalPowerUpsUsed, remote.totalPowerUpsUsed),
    completedStagesCount: completedCount,
    stages,
    updatedAtMs: Math.max(local.updatedAtMs, remote.updatedAtMs, Date.now()),
  };
}

export function applyStageResultLocally(
  current: CrushItProgressionState,
  payload: CrushItStageResultPayload
): CrushItProgressionState {
  const sn = Math.max(1, Math.min(CRUSHIT_TOTAL_STAGES, payload.stageNumber));
  const prev = current.stages[sn];
  const now = Date.now();
  const completed = Boolean(payload.completed);
  const stars = completed ? Math.max(1, Math.min(3, payload.stars)) : 0;

  const updatedStage: StageProgressRecord = {
    stageNumber: sn,
    completed: Boolean(prev?.completed || completed),
    bestScore: Math.max(prev?.bestScore ?? 0, payload.score),
    bestStars: Math.max(prev?.bestStars ?? 0, stars),
    bestMovesRemaining: completed
      ? Math.max(prev?.bestMovesRemaining ?? 0, payload.movesRemaining)
      : prev?.bestMovesRemaining ?? 0,
    bestLongestWord: Math.max(prev?.bestLongestWord ?? 0, payload.longestWordLength),
    attempts: (prev?.attempts ?? 0) + 1,
    completedAtMs: prev?.completedAtMs ?? (completed ? now : null),
  };

  const nextStages: Record<number, StageProgressRecord> = {
    ...current.stages,
    [sn]: updatedStage,
  };

  let highestCompleted = 0;
  let completedCount = 0;
  let totalBestScore = 0;
  for (const rec of Object.values(nextStages)) {
    totalBestScore += rec.bestScore;
    if (rec.completed) {
      completedCount++;
      if (rec.stageNumber > highestCompleted) highestCompleted = rec.stageNumber;
    }
  }

  const next: CrushItProgressionState = {
    ...current,
    highestUnlockedStage: Math.max(
      current.highestUnlockedStage,
      Math.min(CRUSHIT_TOTAL_STAGES, highestCompleted + 1)
    ),
    totalScore: Math.max(current.totalScore, totalBestScore),
    totalWordsFormed: current.totalWordsFormed + payload.wordsFormed,
    totalPowerUpsUsed: current.totalPowerUpsUsed + payload.powerUpsUsed,
    completedStagesCount: completedCount,
    stages: nextStages,
    updatedAtMs: now,
  };

  saveLocalCrushItProgress(next);
  return next;
}

export async function loadCrushItProgressSynced(
  playerId: string,
  isOffline: boolean
): Promise<CrushItProgressionState> {
  const local = loadLocalCrushItProgress(playerId);
  if (isOffline || !playerId || playerId.startsWith('guest_offline_')) {
    return local;
  }

  try {
    const remote = await api.getCrushItProgress(playerId);
    const merged = mergeCrushItProgress(local, remote);
    saveLocalCrushItProgress(merged);
    return merged;
  } catch {
    return local;
  }
}

export async function recordCrushItStageResultSynced(
  playerId: string,
  current: CrushItProgressionState,
  payload: CrushItStageResultPayload,
  isOffline: boolean
): Promise<CrushItProgressionState> {
  const localUpdated = applyStageResultLocally(current, payload);
  if (isOffline || !playerId || playerId.startsWith('guest_offline_')) {
    return localUpdated;
  }

  try {
    const remote = await api.recordCrushItStageResult(playerId, payload);
    const merged = mergeCrushItProgress(localUpdated, remote);
    saveLocalCrushItProgress(merged);
    return merged;
  } catch {
    return localUpdated;
  }
}
