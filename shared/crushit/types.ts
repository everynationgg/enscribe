export type LetterCategory = 'vowel' | 'common' | 'uncommon' | 'rare';

export type TileColor = 'pink' | 'blue' | 'green' | 'gold';

export interface BoardCoord {
  row: number;
  col: number;
}

export type PowerUpType =
  | 'line_blast'
  | 'cross_blast'
  | 'word_bomb'
  | 'letter_purge'
  | 'mega_blast';

export type LineBlastOrientation = 'row' | 'col';

export interface TilePowerUp {
  type: PowerUpType;
  /** Assigned randomly (50/50) upon Line Blast creation and preserved until activation. */
  orientation?: LineBlastOrientation;
}

export interface CrushItTile {
  id: string;
  letter: string;
  category: LetterCategory;
  color: TileColor;
  row: number;
  col: number;
  /** Integrated board-based power-up embedded in this letter tile (if any). */
  powerUp?: TilePowerUp | null;
  /** Number of rows above target slot this tile fell from during the last turn (for drop animations). */
  fallDistance: number;
  /** True when newly generated above the board during the last refill. */
  isNew: boolean;
  /** True when transformed into a new power-up on the most recent move (for creation animation). */
  justCreatedPowerUp?: boolean;
}

export type CrushItBoardGrid = CrushItTile[][];

export type PowerUpSeedConfig = Partial<Record<PowerUpType, number>>;

export interface PowerUpTarget {
  type: PowerUpType;
  row: number;
  col: number;
  orientation?: LineBlastOrientation;
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
  /** Optional starting power-up tiles embedded directly on the initial board. */
  startingPowerUps?: PowerUpSeedConfig;
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
  includedPowerUps: Array<{
    row: number;
    col: number;
    letter: string;
    powerUp: TilePowerUp;
  }>;
}

/**
 * Explicit stage lifecycle states:
 * - PLAYING: moves > 0 and objectives incomplete
 * - QUALIFIED: moves > 0 and all required objectives complete (still active gameplay!)
 * - RESOLVING: current move / chain reactions / gravity resolving (UI animation state)
 * - VICTORY: moves === 0, final resolution complete, all objectives complete
 * - FAILURE: moves === 0, final resolution complete, >=1 objective incomplete
 */
export type CrushItLifecyclePhase =
  | 'PLAYING'
  | 'QUALIFIED'
  | 'RESOLVING'
  | 'VICTORY'
  | 'FAILURE';

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
    triggeredPowerUpsCount: number;
  }>;
  longestWordLength: number;
  longWordsByLength: Record<number, number>;
  tilesDestroyed: number;
  vowelsDestroyed: number;
  consonantsDestroyed: number;
  powerUpsCreated: number;
  powerUpsCreatedByType: Record<PowerUpType, number>;
  powerUpsUsed: number;
  powerUpsUsedByType: Record<PowerUpType, number>;
  largestChainReaction: number;
  objectives: StageObjectiveProgress[];
  objectivesComplete: boolean;
  /** Canonical stage lifecycle state (QUALIFIED remains active until movesRemaining === 0). */
  lifecyclePhase: Exclude<CrushItLifecyclePhase, 'RESOLVING'>;
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
  hadPowerUp?: TilePowerUp | null;
}

export interface PowerUpActivationRecord {
  tileId: string;
  row: number;
  col: number;
  letter: string;
  type: PowerUpType;
  orientation?: LineBlastOrientation;
  chainDepth: number;
  affectedCoords: BoardCoord[];
  /** Source power-up coord that triggered this activation during a chain reaction, if chained. */
  triggeredBy?: BoardCoord;
}

export interface CreatedPowerUpInfo {
  tileId: string;
  row: number;
  col: number;
  letter: string;
  powerUp: TilePowerUp;
}

export interface TurnResolutionEvent {
  kind: 'word' | 'reshuffle';
  word?: string;
  destroyedTiles: DestroyedTileInfo[];
  wordScoreGained: number;
  powerUpScoreGained: number;
  scoreGained: number;
  createdPowerUp: CreatedPowerUpInfo | null;
  activations: PowerUpActivationRecord[];
  chainReactionSize: number;
  autoReshuffled: boolean;
  newlyCompletedObjectiveIds: string[];
  justQualifiedAllObjectives: boolean;
  lifecycleAfterTurn: Exclude<CrushItLifecyclePhase, 'RESOLVING'>;
}
