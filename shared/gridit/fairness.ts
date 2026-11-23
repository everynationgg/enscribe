import { DEFAULT_GRIDIT_SCORING, findBoardWords, scoreGridItWord } from './engine.js';
import { GridItBoard, GridItScoringConfig } from './types.js';

export interface BoardFairnessReport {
  wordCount: number;
  isBoundedEstimate: boolean;
  lengthDistribution: Record<number, number>;
  maxScorePotential: number;
  longWordCount: number;
  wordDensity: number;
  difficultyIndex: number;
  grade: 'Rich' | 'Balanced' | 'Tight' | 'Sparse';
}

export interface BoardFairnessComparison {
  reportA: BoardFairnessReport;
  reportB: BoardFairnessReport;
  potentialRatio: number;
  fairnessStatus: 'fair' | 'slightly_uneven' | 'skewed';
  summary: string;
}

const SOLVER_MAX_WORDS = 220;
const SOLVER_MAX_VISITS = 14000;
const SOLVER_MAX_WORD_LEN = 10;

export function analyzeBoardFairness(
  board: GridItBoard,
  dictionary: Set<string>,
  prefixSet: Set<string>,
  scoringConfig: GridItScoringConfig = DEFAULT_GRIDIT_SCORING
): BoardFairnessReport {
  const discovered = findBoardWords(board, dictionary, prefixSet, {
    minLength: scoringConfig.minWordLength,
    maxWordLength: SOLVER_MAX_WORD_LEN,
    maxWords: SOLVER_MAX_WORDS,
    maxVisits: SOLVER_MAX_VISITS,
  });

  const lengthDistribution: Record<number, number> = {};
  let maxScorePotential = 0;
  let longWordCount = 0;

  for (const item of discovered) {
    const len = item.word.length;
    lengthDistribution[len] = (lengthDistribution[len] ?? 0) + 1;
    maxScorePotential += scoreGridItWord(item.word, scoringConfig);
    if (len >= 5) longWordCount++;
  }

  const wordCount = discovered.length;
  const tileCount = Math.max(1, board.tiles.length);
  const wordDensity = Math.round((wordCount / tileCount) * 100) / 100;
  const isBoundedEstimate = wordCount >= SOLVER_MAX_WORDS || wordCount > 0 && tileCount >= 28;

  // Higher difficultyIndex = harder / tighter board; lower = richer / easier to score on
  const rawDifficulty =
    92 - Math.min(68, wordCount * 0.45) - Math.min(18, longWordCount * 0.9);
  const difficultyIndex = Math.max(8, Math.min(96, Math.round(rawDifficulty)));

  let grade: BoardFairnessReport['grade'] = 'Balanced';
  if (wordCount >= 65 && longWordCount >= 8) {
    grade = 'Rich';
  } else if (wordCount >= 24) {
    grade = 'Balanced';
  } else if (wordCount >= 10) {
    grade = 'Tight';
  } else {
    grade = 'Sparse';
  }

  return {
    wordCount,
    isBoundedEstimate,
    lengthDistribution,
    maxScorePotential,
    longWordCount,
    wordDensity,
    difficultyIndex,
    grade,
  };
}

export function computeNormalizedScore(rawScore: number, maxScorePotential: number): number {
  const denom = Math.max(12, maxScorePotential);
  const pct = (rawScore / denom) * 100;
  return Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10;
}

export function compareBoardsFairness(
  boardA: GridItBoard,
  boardB: GridItBoard,
  dictionary: Set<string>,
  prefixSet: Set<string>,
  scoringConfig: GridItScoringConfig = DEFAULT_GRIDIT_SCORING
): BoardFairnessComparison {
  const reportA = analyzeBoardFairness(boardA, dictionary, prefixSet, scoringConfig);
  const reportB = analyzeBoardFairness(boardB, dictionary, prefixSet, scoringConfig);

  const maxPot = Math.max(1, reportA.maxScorePotential, reportB.maxScorePotential);
  const minPot = Math.min(reportA.maxScorePotential, reportB.maxScorePotential);
  const potentialRatio = Math.round((minPot / maxPot) * 100) / 100;

  let fairnessStatus: BoardFairnessComparison['fairnessStatus'] = 'fair';
  let summary = 'Boards have comparable word potential; normalized scoring keeps results balanced.';

  if (potentialRatio < 0.45) {
    fairnessStatus = 'skewed';
    summary =
      'Large word-potential gap between custom boards — normalized % scoring compensates strongly.';
  } else if (potentialRatio < 0.72) {
    fairnessStatus = 'slightly_uneven';
    summary =
      'Moderate potential difference between boards — normalized % fairness scaling applied.';
  }

  return {
    reportA,
    reportB,
    potentialRatio,
    fairnessStatus,
    summary,
  };
}
