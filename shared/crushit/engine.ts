import {
  getLetterCategory,
  getLetterColor,
  isVowelLetter,
  sampleWeightedLetter,
} from './letterConfig.js';
import {
  createEmptyInventory,
  getEarnedPowerUpForWordLength,
  getPowerUpAffectedCoords,
  POWER_UP_CONFIG,
} from './powerUpConfig.js';
import { calculatePowerUpScore, calculateWordScore } from './scoringConfig.js';
import { CRUSHIT_STAGES, getCrushItStage } from './stagesCatalog.js';
import { CrushItWordTrie } from './trieSolver.js';
import {
  BoardCoord,
  CrushItBoardGrid,
  CrushItGameState,
  CrushItStageConfig,
  CrushItTile,
  DestroyedTileInfo,
  PowerUpInventory,
  PowerUpTarget,
  PowerUpType,
  StageObjectiveProgress,
  TurnResolutionEvent,
  WordPreviewEvaluation,
} from './types.js';

export const DEFAULT_BOARD_SIZE = 8;
export const MIN_WORD_LENGTH = 3;

export function isAdjacentCoord(a: BoardCoord, b: BoardCoord): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return dr <= 1 && dc <= 1 && (dr !== 0 || dc !== 0);
}

export function isValidPathStructure(
  board: CrushItBoardGrid,
  path: BoardCoord[]
): boolean {
  if (path.length === 0) return false;
  const rows = board.length;
  const cols = rows > 0 ? board[0].length : 0;
  const visited = new Set<string>();

  for (let i = 0; i < path.length; i++) {
    const coord = path[i];
    if (coord.row < 0 || coord.row >= rows || coord.col < 0 || coord.col >= cols) {
      return false;
    }
    const key = `${coord.row},${coord.col}`;
    if (visited.has(key)) return false;
    visited.add(key);

    if (i > 0 && !isAdjacentCoord(path[i - 1], coord)) {
      return false;
    }
  }
  return true;
}

export function getWordFromPath(board: CrushItBoardGrid, path: BoardCoord[]): string {
  let out = '';
  for (const coord of path) {
    const tile = board[coord.row]?.[coord.col];
    if (!tile) return '';
    out += tile.letter;
  }
  return out;
}

export function evaluateWordPreview(
  board: CrushItBoardGrid,
  path: BoardCoord[],
  dictionary: Set<string>
): WordPreviewEvaluation {
  if (path.length === 0) {
    return {
      word: '',
      length: 0,
      isValid: false,
      reason: 'empty',
      potentialScore: 0,
      earnedPowerUp: null,
    };
  }

  if (!isValidPathStructure(board, path)) {
    return {
      word: '',
      length: path.length,
      isValid: false,
      reason: 'invalid_path',
      potentialScore: 0,
      earnedPowerUp: null,
    };
  }

  const letters = path.map((c) => board[c.row][c.col].letter.toUpperCase());
  const word = letters.join('');

  if (word.length < MIN_WORD_LENGTH) {
    return {
      word,
      length: word.length,
      isValid: false,
      reason: 'too_short',
      potentialScore: 0,
      earnedPowerUp: null,
    };
  }

  const inDict = dictionary.has(word);
  if (!inDict) {
    return {
      word,
      length: word.length,
      isValid: false,
      reason: 'not_in_dictionary',
      potentialScore: 0,
      earnedPowerUp: null,
    };
  }

  return {
    word,
    length: word.length,
    isValid: true,
    reason: 'valid',
    potentialScore: calculateWordScore(letters),
    earnedPowerUp: getEarnedPowerUpForWordLength(word.length),
  };
}

function makeTile(
  seq: number,
  letter: string,
  row: number,
  col: number,
  fallDistance = 0,
  isNew = false
): CrushItTile {
  const upper = letter.toUpperCase();
  return {
    id: `t_${seq}`,
    letter: upper,
    category: getLetterCategory(upper),
    color: getLetterColor(upper),
    row,
    col,
    fallDistance,
    isNew,
  };
}

function generateRawBoard(
  boardSize: number,
  startSeq: number,
  rng: () => number
): { board: CrushItBoardGrid; nextSeq: number } {
  let seq = startSeq;
  const board: CrushItBoardGrid = [];
  for (let r = 0; r < boardSize; r++) {
    const row: CrushItTile[] = [];
    for (let c = 0; c < boardSize; c++) {
      const sample = sampleWeightedLetter(rng);
      row.push(makeTile(seq++, sample.letter, r, c, 0, false));
    }
    board.push(row);
  }
  return { board, nextSeq: seq };
}

function shuffleExistingBoard(
  board: CrushItBoardGrid,
  rng: () => number
): CrushItBoardGrid {
  const rows = board.length;
  const cols = rows > 0 ? board[0].length : 0;
  const flat: CrushItTile[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      flat.push(board[r][c]);
    }
  }

  // Fisher-Yates shuffle
  for (let i = flat.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = flat[i];
    flat[i] = flat[j];
    flat[j] = tmp;
  }

  const next: CrushItBoardGrid = [];
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    const row: CrushItTile[] = [];
    for (let c = 0; c < cols; c++) {
      const tile = flat[idx++];
      row.push({
        ...tile,
        row: r,
        col: c,
        fallDistance: 0,
        isNew: false,
      });
    }
    next.push(row);
  }
  return next;
}

/**
 * Ensures the board contains at least one playable 3+ letter word using the Trie solver.
 * First attempts in-place reshuffling; if repeated reshuffling fails, regenerates tiles.
 */
export function ensurePlayableBoard(
  board: CrushItBoardGrid,
  trie: CrushItWordTrie,
  nextSeq: number,
  rng: () => number = Math.random,
  forceShuffle = false
): { board: CrushItBoardGrid; reshuffled: boolean; nextSeq: number } {
  if (!forceShuffle && trie.hasPlayableWord(board, MIN_WORD_LENGTH)) {
    return { board, reshuffled: false, nextSeq };
  }

  // Attempt up to 24 in-place shuffles first
  let candidate = board;
  for (let attempt = 0; attempt < 24; attempt++) {
    candidate = shuffleExistingBoard(candidate, rng);
    if (trie.hasPlayableWord(candidate, MIN_WORD_LENGTH)) {
      return { board: candidate, reshuffled: true, nextSeq };
    }
  }

  // Fallback: regenerate fresh weighted boards until playable
  let seq = nextSeq;
  const size = board.length || DEFAULT_BOARD_SIZE;
  for (let attempt = 0; attempt < 30; attempt++) {
    const generated = generateRawBoard(size, seq, rng);
    seq = generated.nextSeq;
    if (trie.hasPlayableWord(generated.board, MIN_WORD_LENGTH)) {
      return { board: generated.board, reshuffled: true, nextSeq: seq };
    }
  }

  // Ultimate safety net: inject a guaranteed vowel-consonant cluster in center using valid weighted letters
  const fallback = generateRawBoard(size, seq, rng);
  seq = fallback.nextSeq;
  const mid = Math.floor(size / 2);
  const safeLetters = ['S', 'T', 'A', 'R'];
  for (let i = 0; i < safeLetters.length && mid - 1 + i < size; i++) {
    fallback.board[mid][mid - 1 + i] = makeTile(seq++, safeLetters[i], mid, mid - 1 + i, 0, true);
  }
  return { board: fallback.board, reshuffled: true, nextSeq: seq };
}

/**
 * Removes destroyed coordinates, drops remaining tiles vertically under gravity,
 * and replenishes empty top cells with weighted-random new tiles.
 */
export function applyGravityAndRefill(
  board: CrushItBoardGrid,
  destroyedCoords: BoardCoord[],
  startSeq: number,
  rng: () => number = Math.random
): { board: CrushItBoardGrid; destroyedTiles: DestroyedTileInfo[]; nextSeq: number } {
  const rows = board.length;
  const cols = rows > 0 ? board[0].length : 0;
  const destroyedSet = new Set(destroyedCoords.map((c) => `${c.row},${c.col}`));
  const destroyedTiles: DestroyedTileInfo[] = [];

  for (const coord of destroyedCoords) {
    const t = board[coord.row]?.[coord.col];
    if (t) {
      destroyedTiles.push({
        id: t.id,
        row: coord.row,
        col: coord.col,
        letter: t.letter,
        color: t.color,
      });
    }
  }

  const nextBoard: CrushItBoardGrid = Array.from({ length: rows }, () => new Array(cols));
  let seq = startSeq;

  for (let c = 0; c < cols; c++) {
    const survivors: Array<{ tile: CrushItTile; oldRow: number }> = [];
    for (let r = rows - 1; r >= 0; r--) {
      if (!destroyedSet.has(`${r},${c}`)) {
        survivors.push({ tile: board[r][c], oldRow: r });
      }
    }

    const destroyedInCol = rows - survivors.length;

    // Place surviving tiles from bottom up
    let writeRow = rows - 1;
    for (const s of survivors) {
      const fallDistance = writeRow - s.oldRow;
      nextBoard[writeRow][c] = {
        ...s.tile,
        row: writeRow,
        col: c,
        fallDistance,
        isNew: false,
      };
      writeRow--;
    }

    // Spawn new weighted-random tiles above the board to fill empty top slots
    for (let r = writeRow; r >= 0; r--) {
      const sample = sampleWeightedLetter(rng);
      nextBoard[r][c] = makeTile(seq++, sample.letter, r, c, destroyedInCol, true);
    }
  }

  return { board: nextBoard, destroyedTiles, nextSeq: seq };
}

function evaluateObjectives(
  stage: CrushItStageConfig,
  metrics: {
    score: number;
    wordsFormed: number;
    longestWordLength: number;
    longWordsByLength: Record<number, number>;
    tilesDestroyed: number;
    vowelsDestroyed: number;
    consonantsDestroyed: number;
    powerUpsUsed: number;
    powerUpsUsedByType: Record<PowerUpType, number>;
  }
): StageObjectiveProgress[] {
  return stage.objectives.map((obj) => {
    let current = 0;
    switch (obj.type) {
      case 'reach_score':
        current = metrics.score;
        break;
      case 'form_words':
        current = metrics.wordsFormed;
        break;
      case 'word_min_length': {
        const reqLen = obj.minLength ?? 4;
        current = metrics.longestWordLength >= reqLen ? 1 : 0;
        break;
      }
      case 'form_long_words': {
        const reqLen = obj.minLength ?? 4;
        current = metrics.longWordsByLength[reqLen] ?? 0;
        break;
      }
      case 'activate_powerups':
        current = metrics.powerUpsUsed;
        break;
      case 'activate_specific_powerup':
        current = obj.powerUpType ? (metrics.powerUpsUsedByType[obj.powerUpType] ?? 0) : 0;
        break;
      case 'destroy_tiles':
        current = metrics.tilesDestroyed;
        break;
      case 'destroy_vowels':
        current = metrics.vowelsDestroyed;
        break;
      case 'destroy_consonants':
        current = metrics.consonantsDestroyed;
        break;
    }

    return {
      ...obj,
      current,
      completed: current >= obj.target,
    };
  });
}

export function computeStarsForStage(
  stage: CrushItStageConfig,
  score: number,
  allObjectivesComplete: boolean
): number {
  if (!allObjectivesComplete) return 0;
  const [, twoStar, threeStar] = stage.starThresholds;
  if (score >= threeStar) return 3;
  if (score >= twoStar) return 2;
  return 1;
}

export function createCrushItGameState(
  stageNumber: number,
  trie: CrushItWordTrie,
  rng: () => number = Math.random
): CrushItGameState {
  const stage = getCrushItStage(stageNumber) ?? CRUSHIT_STAGES[0];
  const raw = generateRawBoard(stage.boardSize, 1, rng);
  const ensured = ensurePlayableBoard(raw.board, trie, raw.nextSeq, rng, false);

  const zeroPowerUpsUsed: Record<PowerUpType, number> = {
    line_blast: 0,
    cross_blast: 0,
    word_bomb: 0,
    letter_purge: 0,
    mega_blast: 0,
  };

  const objectives = evaluateObjectives(stage, {
    score: 0,
    wordsFormed: 0,
    longestWordLength: 0,
    longWordsByLength: {},
    tilesDestroyed: 0,
    vowelsDestroyed: 0,
    consonantsDestroyed: 0,
    powerUpsUsed: 0,
    powerUpsUsedByType: zeroPowerUpsUsed,
  });

  return {
    sessionId: `ci6_${stage.stageNumber}_${Date.now()}_${Math.floor(rng() * 1e6)}`,
    stage,
    board: ensured.board,
    score: 0,
    movesRemaining: stage.maxMoves,
    movesUsed: 0,
    manualShufflesRemaining: stage.manualShuffles,
    wordsFormed: 0,
    wordHistory: [],
    longestWordLength: 0,
    longWordsByLength: {},
    tilesDestroyed: 0,
    vowelsDestroyed: 0,
    consonantsDestroyed: 0,
    powerUpsUsed: 0,
    powerUpsUsedByType: zeroPowerUpsUsed,
    inventory: createEmptyInventory(stage.startingPowerUps),
    objectives,
    status: 'playing',
    starsEarned: 0,
    reshuffleCount: 0,
    turnCounter: 0,
    nextTileSeq: ensured.nextSeq,
  };
}

export interface SubmitWordMoveResult {
  accepted: boolean;
  reason?: string;
  state: CrushItGameState;
  event?: TurnResolutionEvent;
}

/**
 * Executes a player's word submission atomically.
 * Invalid words never consume moves or mutate the board.
 */
export function submitWordMove(
  state: CrushItGameState,
  path: BoardCoord[],
  dictionary: Set<string>,
  trie: CrushItWordTrie,
  rng: () => number = Math.random
): SubmitWordMoveResult {
  if (state.status !== 'playing' || state.movesRemaining <= 0) {
    return { accepted: false, reason: 'Stage is already finished.', state };
  }

  const preview = evaluateWordPreview(state.board, path, dictionary);
  if (!preview.isValid) {
    const reasonMap: Record<WordPreviewEvaluation['reason'], string> = {
      empty: 'Select adjacent tiles to form a word.',
      too_short: 'Words must be at least 3 letters long.',
      invalid_path: 'Tiles must be adjacent and used only once.',
      not_in_dictionary: `"${preview.word}" is not in the dictionary.`,
      valid: '',
    };
    return { accepted: false, reason: reasonMap[preview.reason], state };
  }

  const scoreGained = preview.potentialScore;
  const earnedPowerUp = preview.earnedPowerUp;

  const refill = applyGravityAndRefill(state.board, path, state.nextTileSeq, rng);
  const ensured = ensurePlayableBoard(refill.board, trie, refill.nextSeq, rng, false);

  let vowelsAdded = 0;
  let consonantsAdded = 0;
  for (const dt of refill.destroyedTiles) {
    if (isVowelLetter(dt.letter)) vowelsAdded++;
    else consonantsAdded++;
  }

  const nextInventory: PowerUpInventory = { ...state.inventory };
  if (earnedPowerUp) {
    const maxStack = POWER_UP_CONFIG[earnedPowerUp].maxStack;
    nextInventory[earnedPowerUp] = Math.min(maxStack, nextInventory[earnedPowerUp] + 1);
  }

  const nextLongWords: Record<number, number> = { ...state.longWordsByLength };
  for (let minLen = 4; minLen <= Math.min(preview.length, 10); minLen++) {
    nextLongWords[minLen] = (nextLongWords[minLen] ?? 0) + 1;
  }

  const nextScore = state.score + scoreGained;
  const nextMovesRemaining = Math.max(0, state.movesRemaining - 1);
  const nextMovesUsed = state.movesUsed + 1;
  const nextWordsFormed = state.wordsFormed + 1;
  const nextLongestWord = Math.max(state.longestWordLength, preview.length);
  const nextTilesDestroyed = state.tilesDestroyed + refill.destroyedTiles.length;
  const nextVowelsDestroyed = state.vowelsDestroyed + vowelsAdded;
  const nextConsonantsDestroyed = state.consonantsDestroyed + consonantsAdded;

  const prevCompletedIds = new Set(
    state.objectives.filter((o) => o.completed).map((o) => o.id)
  );
  const nextObjectives = evaluateObjectives(state.stage, {
    score: nextScore,
    wordsFormed: nextWordsFormed,
    longestWordLength: nextLongestWord,
    longWordsByLength: nextLongWords,
    tilesDestroyed: nextTilesDestroyed,
    vowelsDestroyed: nextVowelsDestroyed,
    consonantsDestroyed: nextConsonantsDestroyed,
    powerUpsUsed: state.powerUpsUsed,
    powerUpsUsedByType: state.powerUpsUsedByType,
  });

  const newlyCompletedObjectiveIds = nextObjectives
    .filter((o) => o.completed && !prevCompletedIds.has(o.id))
    .map((o) => o.id);

  const allComplete = nextObjectives.every((o) => o.completed);
  const nextStatus: CrushItGameState['status'] = allComplete
    ? 'won'
    : nextMovesRemaining <= 0
      ? 'lost'
      : 'playing';
  const starsEarned = computeStarsForStage(state.stage, nextScore, allComplete);

  const nextState: CrushItGameState = {
    ...state,
    board: ensured.board,
    score: nextScore,
    movesRemaining: nextMovesRemaining,
    movesUsed: nextMovesUsed,
    wordsFormed: nextWordsFormed,
    wordHistory: [
      { word: preview.word, score: scoreGained, earnedPowerUp },
      ...state.wordHistory.slice(0, 49),
    ],
    longestWordLength: nextLongestWord,
    longWordsByLength: nextLongWords,
    tilesDestroyed: nextTilesDestroyed,
    vowelsDestroyed: nextVowelsDestroyed,
    consonantsDestroyed: nextConsonantsDestroyed,
    inventory: nextInventory,
    objectives: nextObjectives,
    status: nextStatus,
    starsEarned,
    reshuffleCount: state.reshuffleCount + (ensured.reshuffled ? 1 : 0),
    turnCounter: state.turnCounter + 1,
    nextTileSeq: ensured.nextSeq,
  };

  return {
    accepted: true,
    state: nextState,
    event: {
      kind: 'word',
      word: preview.word,
      destroyedTiles: refill.destroyedTiles,
      scoreGained,
      earnedPowerUp,
      autoReshuffled: ensured.reshuffled,
      newlyCompletedObjectiveIds,
      outcomeAfterTurn: nextStatus,
    },
  };
}

export interface ActivatePowerUpResult {
  accepted: boolean;
  reason?: string;
  state: CrushItGameState;
  event?: TurnResolutionEvent;
}

/**
 * Executes an inventory power-up on the chosen target coordinate.
 */
export function activatePowerUpMove(
  state: CrushItGameState,
  target: PowerUpTarget,
  trie: CrushItWordTrie,
  rng: () => number = Math.random
): ActivatePowerUpResult {
  if (state.status !== 'playing') {
    return { accepted: false, reason: 'Stage is already finished.', state };
  }

  const def = POWER_UP_CONFIG[target.type];
  if (!def) {
    return { accepted: false, reason: 'Unknown power-up.', state };
  }
  if ((state.inventory[target.type] ?? 0) <= 0) {
    return { accepted: false, reason: `No ${def.name} available.`, state };
  }
  if (def.moveCost > 0 && state.movesRemaining < def.moveCost) {
    return { accepted: false, reason: 'Not enough moves remaining.', state };
  }

  const affected = getPowerUpAffectedCoords(state.board, target);
  if (affected.length === 0) {
    return { accepted: false, reason: 'Select a valid target tile.', state };
  }

  const targetTileLetter = state.board[target.row]?.[target.col]?.letter;
  const affectedLetters = affected.map((c) => state.board[c.row][c.col].letter);
  const scoreGained = calculatePowerUpScore(target.type, affectedLetters);

  const refill = applyGravityAndRefill(state.board, affected, state.nextTileSeq, rng);
  const ensured = ensurePlayableBoard(refill.board, trie, refill.nextSeq, rng, false);

  let vowelsAdded = 0;
  let consonantsAdded = 0;
  for (const dt of refill.destroyedTiles) {
    if (isVowelLetter(dt.letter)) vowelsAdded++;
    else consonantsAdded++;
  }

  const nextInventory: PowerUpInventory = {
    ...state.inventory,
    [target.type]: Math.max(0, state.inventory[target.type] - 1),
  };

  const nextPowerUpsUsedByType: Record<PowerUpType, number> = {
    ...state.powerUpsUsedByType,
    [target.type]: (state.powerUpsUsedByType[target.type] ?? 0) + 1,
  };

  const nextScore = state.score + scoreGained;
  const nextMovesRemaining = Math.max(0, state.movesRemaining - def.moveCost);
  const nextMovesUsed = state.movesUsed + def.moveCost;
  const nextTilesDestroyed = state.tilesDestroyed + refill.destroyedTiles.length;
  const nextVowelsDestroyed = state.vowelsDestroyed + vowelsAdded;
  const nextConsonantsDestroyed = state.consonantsDestroyed + consonantsAdded;
  const nextPowerUpsUsed = state.powerUpsUsed + 1;

  const prevCompletedIds = new Set(
    state.objectives.filter((o) => o.completed).map((o) => o.id)
  );
  const nextObjectives = evaluateObjectives(state.stage, {
    score: nextScore,
    wordsFormed: state.wordsFormed,
    longestWordLength: state.longestWordLength,
    longWordsByLength: state.longWordsByLength,
    tilesDestroyed: nextTilesDestroyed,
    vowelsDestroyed: nextVowelsDestroyed,
    consonantsDestroyed: nextConsonantsDestroyed,
    powerUpsUsed: nextPowerUpsUsed,
    powerUpsUsedByType: nextPowerUpsUsedByType,
  });

  const newlyCompletedObjectiveIds = nextObjectives
    .filter((o) => o.completed && !prevCompletedIds.has(o.id))
    .map((o) => o.id);

  const allComplete = nextObjectives.every((o) => o.completed);
  const nextStatus: CrushItGameState['status'] = allComplete
    ? 'won'
    : nextMovesRemaining <= 0
      ? 'lost'
      : 'playing';
  const starsEarned = computeStarsForStage(state.stage, nextScore, allComplete);

  const nextState: CrushItGameState = {
    ...state,
    board: ensured.board,
    score: nextScore,
    movesRemaining: nextMovesRemaining,
    movesUsed: nextMovesUsed,
    tilesDestroyed: nextTilesDestroyed,
    vowelsDestroyed: nextVowelsDestroyed,
    consonantsDestroyed: nextConsonantsDestroyed,
    powerUpsUsed: nextPowerUpsUsed,
    powerUpsUsedByType: nextPowerUpsUsedByType,
    inventory: nextInventory,
    objectives: nextObjectives,
    status: nextStatus,
    starsEarned,
    reshuffleCount: state.reshuffleCount + (ensured.reshuffled ? 1 : 0),
    turnCounter: state.turnCounter + 1,
    nextTileSeq: ensured.nextSeq,
  };

  return {
    accepted: true,
    state: nextState,
    event: {
      kind: 'powerup',
      powerUpType: target.type,
      targetCoord: { row: target.row, col: target.col },
      orientation: target.orientation,
      targetLetter: targetTileLetter,
      destroyedTiles: refill.destroyedTiles,
      scoreGained,
      earnedPowerUp: null,
      autoReshuffled: ensured.reshuffled,
      newlyCompletedObjectiveIds,
      outcomeAfterTurn: nextStatus,
    },
  };
}

/**
 * Triggers a player-initiated manual reshuffle (consumes 1 manual shuffle charge,
 * never consumes moves or reduces score).
 */
export function manualReshuffleBoard(
  state: CrushItGameState,
  trie: CrushItWordTrie,
  rng: () => number = Math.random
): { accepted: boolean; reason?: string; state: CrushItGameState; event?: TurnResolutionEvent } {
  if (state.status !== 'playing') {
    return { accepted: false, reason: 'Stage is already finished.', state };
  }
  if (state.manualShufflesRemaining <= 0) {
    return { accepted: false, reason: 'No manual shuffles remaining this stage.', state };
  }

  const ensured = ensurePlayableBoard(state.board, trie, state.nextTileSeq, rng, true);
  const nextState: CrushItGameState = {
    ...state,
    board: ensured.board,
    manualShufflesRemaining: state.manualShufflesRemaining - 1,
    reshuffleCount: state.reshuffleCount + 1,
    turnCounter: state.turnCounter + 1,
    nextTileSeq: ensured.nextSeq,
  };

  return {
    accepted: true,
    state: nextState,
    event: {
      kind: 'reshuffle',
      destroyedTiles: [],
      scoreGained: 0,
      earnedPowerUp: null,
      autoReshuffled: false,
      newlyCompletedObjectiveIds: [],
      outcomeAfterTurn: nextState.status,
    },
  };
}
