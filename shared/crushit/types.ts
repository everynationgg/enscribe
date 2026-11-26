export type LetterCategory = 'vowel' | 'common' | 'uncommon' | 'rare';

export type TileColor = 'pink' | 'blue' | 'green' | 'gold';

export interface BoardCoord {
  row: number;
  col: number;
}

export interface CrushItTile {
  id: string;
  letter: string;
  category: LetterCategory;
  color: TileColor;
  row: number;
  col: number;
  /** Number of rows above target slot this tile fell from during the last turn (for drop animations). */
  fallDistance: number;
  /** True when newly generated above the board during the last refill. */
  isNew: boolean;
}

export type CrushItBoardGrid = CrushItTile[][];

export type PowerUpType =
  | 'line_blast'
  | 'cross_blast'
  | 'word_bomb'
  | 'letter_purge'
  | 'mega_blast';

export type PowerUpInventory = Record<PowerUpType, number>;

export interface PowerUpTarget {
  type: PowerUpType;
  row: number;
  col: number;
  orientation?: 'row' | 'col';
}

export type StageTier =
  | 'introduction'
  | 'development'
  | 'advanced'
  | 'expert'
  | 'mastery';

export type StageObjectiveType =
  | 'reach_score'
  | 'form_words'
  | 'word_min_length'
  | 'form_long_words'
  | 'activate_powerups'
  | 'activate_specific_powerup'
  | 'destroy_tiles'
  | 'destroy_vowels'
  | 'destroy_consonants';

export interface StageObjectiveConfig {
  id: string;
  type: StageObjectiveType;
  target: number;
  /** Used by word_min_length and form_long_words */
  minLength?: number;
  /** Used by activate_specific_powerup */
  powerUpType?: PowerUpType;
  label: string;
  shortLabel: string;
}

export interface StageObjectiveProgress extends StageObjectiveConfig {
  current: number;
  completed: boolean;
}

export interface CrushItStageConfig {
  stageNumber: number;
  id: string;
  title: string;
  tier: StageTier;
  tierLabel: string;
  boardSize: number;
  scoreTarget: number;
  maxMoves: number;
  manualShuffles: number;
  objectives: StageObjectiveConfig[];
  starThresholds: [number, number, number];
  startingPowerUps?: Partial<PowerUpInventory>;
  rewardCoins: number;
  description: string;
}

export interface StageProgressRecord {
  stageNumber: number;
  completed: boolean;
  bestScore: number;
  bestStars: number;
  bestMovesRemaining: number;
  bestLongestWord: number;
  attempts: number;
  completedAtMs: number | null;
}

export interface CrushItProgressionState {
  playerId: string;
  highestUnlockedStage: number;
  totalScore: number;
  totalWordsFormed: number;
  totalPowerUpsUsed: number;
  completedStagesCount: number;
  stages: Record<number, StageProgressRecord>;
  updatedAtMs: number;
}

export interface CrushItStageResultPayload {
  stageNumber: number;
  completed: boolean;
  score: number;
  stars: number;
  movesRemaining: number;
  wordsFormed: number;
  longestWordLength: number;
  powerUpsUsed: number;
}

export interface WordPreviewEvaluation {
  word: string;
  length: number;
  isValid: boolean;
  reason: 'empty' | 'too_short' | 'invalid_path' | 'not_in_dictionary' | 'valid';
  potentialScore: number;
  earnedPowerUp: PowerUpType | null;
}

export interface CrushItGameState {
  sessionId: string;
  stage: CrushItStageConfig;
  board: CrushItBoardGrid;
  score: number;
  movesRemaining: number;
  movesUsed: number;
  manualShufflesRemaining: number;
  wordsFormed: number;
  wordHistory: Array<{
    word: string;
    score: number;
    earnedPowerUp: PowerUpType | null;
  }>;
  longestWordLength: number;
  longWordsByLength: Record<number, number>;
  tilesDestroyed: number;
  vowelsDestroyed: number;
  consonantsDestroyed: number;
  powerUpsUsed: number;
  powerUpsUsedByType: Record<PowerUpType, number>;
  inventory: PowerUpInventory;
  objectives: StageObjectiveProgress[];
  status: 'playing' | 'won' | 'lost';
  starsEarned: number;
  reshuffleCount: number;
  turnCounter: number;
  nextTileSeq: number;
}

export interface DestroyedTileInfo {
  id: string;
  row: number;
  col: number;
  letter: string;
  color: TileColor;
}

export interface TurnResolutionEvent {
  kind: 'word' | 'powerup' | 'reshuffle';
  word?: string;
  powerUpType?: PowerUpType;
  targetCoord?: BoardCoord;
  orientation?: 'row' | 'col';
  targetLetter?: string;
  destroyedTiles: DestroyedTileInfo[];
  scoreGained: number;
  earnedPowerUp: PowerUpType | null;
  autoReshuffled: boolean;
  newlyCompletedObjectiveIds: string[];
  outcomeAfterTurn: 'playing' | 'won' | 'lost';
}
