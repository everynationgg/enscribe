import {
  getLetterCategory,
  getLetterColor,
  isVowelLetter,
  sampleWeightedLetter,
} from './letterConfig.js';
import {
  createTilePowerUp,
  createZeroPowerUpCounters,
  getEarnedPowerUpForWordLength,
  getPowerUpAffectedCoords,
  POWER_UP_ORDER,
} from './powerUpConfig.js';
import {
  calculatePowerUpDestructionScore,
  calculateWordScore,
} from './scoringConfig.js';
import { CRUSHIT_STAGES, getCrushItStage } from './stagesCatalog.js';
import { CrushItWordTrie } from './trieSolver.js';
import {
  BoardCoord,
  CreatedPowerUpInfo,
  CrushItBoardGrid,
  CrushItGameState,
  CrushItLifecyclePhase,
  CrushItStageConfig,
  CrushItTile,
  DestroyedTileInfo,
  PowerUpActivationRecord,
  PowerUpType,
  StageObjectiveProgress,
  TilePowerUp,
  TurnResolutionEvent,
  WordPreviewEvaluation,
} from './types.js';

export const DEFAULT_BOARD_SIZE = 8;
export const MIN_WORD_LENGTH = 3;

function coordKey(r: number, c: number): string {
  return `${r},${c}`;
}

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
    const key = coordKey(coord.row, coord.col);
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
      includedPowerUps: [],
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
      includedPowerUps: [],
    };
  }

  const letters: string[] = [];
  const includedPowerUps: WordPreviewEvaluation['includedPowerUps'] = [];

  for (const c of path) {
    const tile = board[c.row][c.col];
    letters.push(tile.letter.toUpperCase());
    if (tile.powerUp) {
      includedPowerUps.push({
        row: c.row,
        col: c.col,
        letter: tile.letter.toUpperCase(),
        powerUp: tile.powerUp,
      });
    }
  }

  const word = letters.join('');

  if (word.length < MIN_WORD_LENGTH) {
    return {
      word,
      length: word.length,
      isValid: false,
      reason: 'too_short',
      potentialScore: 0,
      earnedPowerUp: null,
      includedPowerUps,
    };
  }

  if (!dictionary.has(word)) {
    return {
      word,
      length: word.length,
      isValid: false,
      reason: 'not_in_dictionary',
      potentialScore: 0,
      earnedPowerUp: null,
      includedPowerUps,
    };
  }

  return {
    word,
    length: word.length,
    isValid: true,
    reason: 'valid',
    potentialScore: calculateWordScore(letters),
    earnedPowerUp: getEarnedPowerUpForWordLength(word.length),
    includedPowerUps,
  };
}

function makeTile(
  seq: number,
  letter: string,
  row: number,
  col: number,
  fallDistance = 0,
  isNew = false,
  powerUp: TilePowerUp | null = null,
  justCreatedPowerUp = false
): CrushItTile {
  const upper = letter.toUpperCase();
  return {
    id: `t_${seq}`,
    letter: upper,
    category: getLetterCategory(upper),
    color: getLetterColor(upper),
    row,
    col,
    powerUp,
    fallDistance,
    isNew,
    justCreatedPowerUp,
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
      row.push(makeTile(seq++, sample.letter, r, c, 0, false, null, false));
    }
    board.push(row);
  }
  return { board, nextSeq: seq };
}

/**
 * Shuffles existing board tiles in-place while strictly preserving each tile's
 * original letter, unique identity, power-up type, and orientation.
 */
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
        justCreatedPowerUp: false,
      });
    }
    next.push(row);
  }
  return next;
}

/**
 * Ensures the board contains at least one playable 3+ letter word using the Trie solver.
 * First attempts in-place reshuffling (preserving all integrated power-up tiles).
 * Only if repeated reshuffling fails does it regenerate ordinary tiles while keeping
 * existing power-up properties safely intact.
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

  // Attempt up to 24 in-place shuffles first (preserves every tile & power-up)
  let candidate = board;
  for (let attempt = 0; attempt < 24; attempt++) {
    candidate = shuffleExistingBoard(candidate, rng);
    if (trie.hasPlayableWord(candidate, MIN_WORD_LENGTH)) {
      return { board: candidate, reshuffled: true, nextSeq };
    }
  }

  // Collect existing power-ups so even fallback regeneration preserves earned power-ups
  const preservedPowerUps: TilePowerUp[] = [];
  for (const row of board) {
    for (const tile of row) {
      if (tile.powerUp) preservedPowerUps.push({ ...tile.powerUp });
    }
  }

  let seq = nextSeq;
  const size = board.length || DEFAULT_BOARD_SIZE;
  const applyPreserved = (grid: CrushItBoardGrid): CrushItBoardGrid => {
    if (preservedPowerUps.length === 0) return grid;
    const coords: BoardCoord[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) coords.push({ row: r, col: c });
    }
    for (let i = coords.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = coords[i];
      coords[i] = coords[j];
      coords[j] = tmp;
    }
    preservedPowerUps.forEach((pu, idx) => {
      if (idx < coords.length) {
        const pos = coords[idx];
        grid[pos.row][pos.col] = { ...grid[pos.row][pos.col], powerUp: pu };
      }
    });
    return grid;
  };

  for (let attempt = 0; attempt < 30; attempt++) {
    const generated = generateRawBoard(size, seq, rng);
    seq = generated.nextSeq;
    if (trie.hasPlayableWord(generated.board, MIN_WORD_LENGTH)) {
      return { board: applyPreserved(generated.board), reshuffled: true, nextSeq: seq };
    }
  }

  const fallback = generateRawBoard(size, seq, rng);
  seq = fallback.nextSeq;
  const mid = Math.floor(size / 2);
  const safeLetters = ['S', 'T', 'A', 'R'];
  for (let i = 0; i < safeLetters.length && mid - 1 + i < size; i++) {
    fallback.board[mid][mid - 1 + i] = makeTile(
      seq++,
      safeLetters[i],
      mid,
      mid - 1 + i,
      0,
      true,
      null,
      false
    );
  }
  return { board: applyPreserved(fallback.board), reshuffled: true, nextSeq: seq };
}

/**
 * Removes destroyed coordinates, optionally inserts/transforms a surviving newly-created
 * power-up tile, drops remaining tiles (including power-ups!) vertically under gravity,
 * and replenishes empty top cells with weighted-random ordinary letter tiles.
 */
export function applyGravityAndRefill(
  board: CrushItBoardGrid,
  destroyedCoordKeys: Set<string>,
  startSeq: number,
  rng: () => number = Math.random,
  createdPowerUpPlacement?: {
    row: number;
    col: number;
    tile: CrushItTile;
  } | null
): {
  board: CrushItBoardGrid;
  createdPowerUpFinalCoord: BoardCoord | null;
  nextSeq: number;
} {
  const rows = board.length;
  const cols = rows > 0 ? board[0].length : 0;
  const nextBoard: CrushItBoardGrid = Array.from({ length: rows }, () => new Array(cols));
  let seq = startSeq;
  let createdPowerUpFinalCoord: BoardCoord | null = null;

  for (let c = 0; c < cols; c++) {
    const survivors: Array<{ tile: CrushItTile; oldRow: number; isCreatedTarget: boolean }> = [];

    for (let r = rows - 1; r >= 0; r--) {
      if (
        createdPowerUpPlacement &&
        createdPowerUpPlacement.row === r &&
        createdPowerUpPlacement.col === c
      ) {
        survivors.push({
          tile: createdPowerUpPlacement.tile,
          oldRow: r,
          isCreatedTarget: true,
        });
        continue;
      }

      if (!destroyedCoordKeys.has(coordKey(r, c))) {
        survivors.push({
          tile: { ...board[r][c], justCreatedPowerUp: false },
          oldRow: r,
          isCreatedTarget: false,
        });
      }
    }

    const emptySlotsInCol = rows - survivors.length;

    // Place surviving tiles (including power-up tiles!) from bottom up
    let writeRow = rows - 1;
    for (const s of survivors) {
      const fallDistance = writeRow - s.oldRow;
      nextBoard[writeRow][c] = {
        ...s.tile,
        row: writeRow,
        col: c,
        fallDistance,
        isNew: false,
        justCreatedPowerUp: s.isCreatedTarget,
      };
      if (s.isCreatedTarget) {
        createdPowerUpFinalCoord = { row: writeRow, col: c };
      }
      writeRow--;
    }

    // Spawn new weighted-random ORDINARY letter tiles above the board
    for (let r = writeRow; r >= 0; r--) {
      const sample = sampleWeightedLetter(rng);
      nextBoard[r][c] = makeTile(seq++, sample.letter, r, c, emptySlotsInCol, true, null, false);
    }
  }

  return { board: nextBoard, createdPowerUpFinalCoord, nextSeq: seq };
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

/**
 * Determines canonical stage lifecycle state based strictly on remaining moves
 * and objective completion. Reaching objectives while moves remain enters
 * QUALIFIED (active gameplay), NEVER terminating the stage early.
 */
export function resolveLifecyclePhase(
  movesRemaining: number,
  allObjectivesComplete: boolean
): Exclude<CrushItLifecyclePhase, 'RESOLVING'> {
  if (movesRemaining <= 0) {
    return allObjectivesComplete ? 'VICTORY' : 'FAILURE';
  }
  return allObjectivesComplete ? 'QUALIFIED' : 'PLAYING';
}

function embedStartingBoardPowerUps(
  board: CrushItBoardGrid,
  stage: CrushItStageConfig,
  rng: () => number
): CrushItBoardGrid {
  if (!stage.startingPowerUps) return board;
  const toPlace: PowerUpType[] = [];
  for (const puType of POWER_UP_ORDER) {
    const qty = stage.startingPowerUps[puType] ?? 0;
    for (let i = 0; i < qty; i++) toPlace.push(puType);
  }
  if (toPlace.length === 0) return board;

  const size = board.length;
  // Prefer inner playable tiles (rows 1..size-2, cols 1..size-2) with easy-to-use vowels/common letters
  const candidates: BoardCoord[] = [];
  for (let r = 1; r < size - 1; r++) {
    for (let c = 1; c < size - 1; c++) {
      const cat = board[r][c].category;
      if (cat === 'vowel' || cat === 'common') {
        candidates.push({ row: r, col: c });
      }
    }
  }
  if (candidates.length < toPlace.length) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) candidates.push({ row: r, col: c });
    }
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = tmp;
  }

  const next = board.map((row) => row.map((t) => ({ ...t })));
  const used = new Set<string>();
  let placed = 0;
  for (const coord of candidates) {
    if (placed >= toPlace.length) break;
    const key = coordKey(coord.row, coord.col);
    if (used.has(key)) continue;
    used.add(key);
    next[coord.row][coord.col].powerUp = createTilePowerUp(toPlace[placed], rng);
    placed++;
  }

  return next;
}

export function createCrushItGameState(
  stageNumber: number,
  trie: CrushItWordTrie,
  rng: () => number = Math.random
): CrushItGameState {
  const stage = getCrushItStage(stageNumber) ?? CRUSHIT_STAGES[0];
  const raw = generateRawBoard(stage.boardSize, 1, rng);
  const ensured = ensurePlayableBoard(raw.board, trie, raw.nextSeq, rng, false);
  const boardWithSeeds = embedStartingBoardPowerUps(ensured.board, stage, rng);

  const zeroPowerUps = createZeroPowerUpCounters();

  const objectives = evaluateObjectives(stage, {
    score: 0,
    wordsFormed: 0,
    longestWordLength: 0,
    longWordsByLength: {},
    tilesDestroyed: 0,
    vowelsDestroyed: 0,
    consonantsDestroyed: 0,
    powerUpsUsed: 0,
    powerUpsUsedByType: zeroPowerUps,
  });

  return {
    sessionId: `ci6_${stage.stageNumber}_${Date.now()}_${Math.floor(rng() * 1e6)}`,
    stage,
    board: boardWithSeeds,
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
    powerUpsCreated: 0,
    powerUpsCreatedByType: createZeroPowerUpCounters(),
    powerUpsUsed: 0,
    powerUpsUsedByType: createZeroPowerUpCounters(),
    largestChainReaction: 0,
    objectives,
    objectivesComplete: false,
    lifecyclePhase: 'PLAYING',
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
 * Executes a player's word submission atomically:
 * 1. Validates path & English dictionary membership (invalid moves never consume moves or activate power-ups).
 * 2. Automatically triggers every existing power-up tile included in the word, plus all chained power-ups
 *    hit by their blast zones (BFS, each power-up activates at most once, deduplicated tile destruction).
 * 3. If the submitted word length >= 4, creates ONLY the single highest corresponding power-up tile
 *    (preferring the final selected ordinary letter, or the final selected letter's vacated slot if all were power-ups).
 *    The newly created power-up survives the current turn and becomes eligible on the next valid move.
 * 4. Applies gravity and weighted-random replenishment (new falling tiles are always ordinary letters).
 * 5. Checks dead-board playability via Trie solver and reshuffles in-place (preserving power-ups) if needed.
 * 6. Updates score, stats, objectives, and lifecyclePhase (PLAYING / QUALIFIED / VICTORY / FAILURE).
 *    Completion of objectives while movesRemaining > 0 enters QUALIFIED and does NOT terminate the stage.
 */
export function submitWordMove(
  state: CrushItGameState,
  path: BoardCoord[],
  dictionary: Set<string>,
  trie: CrushItWordTrie,
  rng: () => number = Math.random
): SubmitWordMoveResult {
  if (
    state.lifecyclePhase === 'VICTORY' ||
    state.lifecyclePhase === 'FAILURE' ||
    state.movesRemaining <= 0
  ) {
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

  const board = state.board;
  const earnedPowerUpType = preview.earnedPowerUp;
  const wordPathKeySet = new Set(path.map((c) => coordKey(c.row, c.col)));

  // Step A: Resolve all existing power-ups included in the word + BFS chain reactions
  const activatedKeySet = new Set<string>();
  const powerUpAffectedKeySet = new Set<string>();
  const activations: PowerUpActivationRecord[] = [];
  const queue: Array<{ coord: BoardCoord; depth: number; triggeredBy?: BoardCoord }> = [];

  for (const coord of path) {
    const tile = board[coord.row][coord.col];
    if (tile.powerUp) {
      queue.push({ coord, depth: 0 });
    }
  }

  let qHead = 0;
  while (qHead < queue.length) {
    const item = queue[qHead++];
    const k = coordKey(item.coord.row, item.coord.col);
    if (activatedKeySet.has(k)) continue;

    const puTile = board[item.coord.row]?.[item.coord.col];
    if (!puTile?.powerUp) continue;

    activatedKeySet.add(k);
    const affected = getPowerUpAffectedCoords(board, {
      type: puTile.powerUp.type,
      row: item.coord.row,
      col: item.coord.col,
      orientation: puTile.powerUp.orientation,
    });

    activations.push({
      tileId: puTile.id,
      row: item.coord.row,
      col: item.coord.col,
      letter: puTile.letter,
      type: puTile.powerUp.type,
      orientation: puTile.powerUp.orientation,
      chainDepth: item.depth,
      affectedCoords: affected,
      triggeredBy: item.triggeredBy,
    });

    for (const ac of affected) {
      const ak = coordKey(ac.row, ac.col);
      powerUpAffectedKeySet.add(ak);
      const hitTile = board[ac.row]?.[ac.col];
      if (hitTile?.powerUp && !activatedKeySet.has(ak)) {
        queue.push({ coord: ac, depth: item.depth + 1, triggeredBy: item.coord });
      }
    }
  }

  // Step B: Select creation position for newly earned power-up (if word length >= 4)
  // Rules (Section 6):
  // 1) Prefer final selected ordinary letter NOT hit by another power-up's blast
  // 2) Fallback: last selected ordinary letter in path
  // 3) Fallback (all selected were existing power-ups): final selected tile's vacated position, preserving its letter
  let creationTargetCoord: BoardCoord | null = null;
  let createdTileObject: CrushItTile | null = null;
  let nextSeq = state.nextTileSeq;
  let createdPowerUpMeta: TilePowerUp | null = null;

  if (earnedPowerUpType) {
    createdPowerUpMeta = createTilePowerUp(earnedPowerUpType, rng);

    // Priority 1: final ordinary letter not swept by a blast
    for (let i = path.length - 1; i >= 0; i--) {
      const c = path[i];
      const t = board[c.row][c.col];
      if (!t.powerUp && !powerUpAffectedKeySet.has(coordKey(c.row, c.col))) {
        creationTargetCoord = c;
        break;
      }
    }
    // Priority 2: final ordinary letter in path
    if (!creationTargetCoord) {
      for (let i = path.length - 1; i >= 0; i--) {
        const c = path[i];
        const t = board[c.row][c.col];
        if (!t.powerUp) {
          creationTargetCoord = c;
          break;
        }
      }
    }
    // Priority 3: all selected tiles were existing power-ups -> recreate at final selected tile's vacated slot
    const wasAllExistingPowerUps = !creationTargetCoord;
    if (!creationTargetCoord) {
      creationTargetCoord = path[path.length - 1];
    }

    const baseTile = board[creationTargetCoord.row][creationTargetCoord.col];
    createdTileObject = wasAllExistingPowerUps
      ? makeTile(
          nextSeq++,
          baseTile.letter,
          creationTargetCoord.row,
          creationTargetCoord.col,
          0,
          false,
          createdPowerUpMeta,
          true
        )
      : {
          ...baseTile,
          powerUp: createdPowerUpMeta,
          fallDistance: 0,
          isNew: false,
          justCreatedPowerUp: true,
        };
  }

  // Step C: Build deduplicated set of destroyed tiles
  // All word tiles + all power-up affected tiles, EXCEPT an ordinary tile transformed in-place into the new power-up.
  // (If an existing power-up occupied creationTargetCoord, it DID activate & get destroyed, then the new power-up spawns in its vacated slot.)
  const creationCoordKey = creationTargetCoord
    ? coordKey(creationTargetCoord.row, creationTargetCoord.col)
    : null;
  const creationReplacedOrdinaryTile = Boolean(
    creationTargetCoord && !board[creationTargetCoord.row][creationTargetCoord.col].powerUp
  );

  const destroyedKeySet = new Set<string>();
  for (const c of path) {
    const k = coordKey(c.row, c.col);
    if (creationReplacedOrdinaryTile && k === creationCoordKey) continue;
    destroyedKeySet.add(k);
  }
  for (const k of powerUpAffectedKeySet) {
    if (creationReplacedOrdinaryTile && k === creationCoordKey) continue;
    destroyedKeySet.add(k);
  }

  const destroyedTiles: DestroyedTileInfo[] = [];
  const uniqueExtraPowerUpLetters: string[] = [];
  let vowelsAdded = 0;
  let consonantsAdded = 0;

  for (const k of destroyedKeySet) {
    const [rStr, cStr] = k.split(',');
    const r = Number(rStr);
    const c = Number(cStr);
    const t = board[r][c];
    destroyedTiles.push({
      id: t.id,
      row: r,
      col: c,
      letter: t.letter,
      color: t.color,
      hadPowerUp: t.powerUp ?? null,
    });
    if (isVowelLetter(t.letter)) vowelsAdded++;
    else consonantsAdded++;

    if (powerUpAffectedKeySet.has(k) && !wordPathKeySet.has(k)) {
      uniqueExtraPowerUpLetters.push(t.letter);
    }
  }

  // Step D: Scoring (normal word points + deduplicated power-up destruction & chain bonuses)
  const wordScoreGained = preview.potentialScore;
  const powerUpScoreGained = calculatePowerUpDestructionScore(
    activations.map((a) => a.type),
    uniqueExtraPowerUpLetters
  );
  const scoreGained = wordScoreGained + powerUpScoreGained;

  // Step E: Apply gravity & weighted replenishment (preserving all surviving & newly-created power-ups)
  const refill = applyGravityAndRefill(
    board,
    destroyedKeySet,
    nextSeq,
    rng,
    creationTargetCoord && createdTileObject
      ? {
          row: creationTargetCoord.row,
          col: creationTargetCoord.col,
          tile: createdTileObject,
        }
      : null
  );

  // Step F: Automatic dead-board detection & reshuffle (never consumes moves or score; preserves power-ups)
  const ensured = ensurePlayableBoard(refill.board, trie, refill.nextSeq, rng, false);

  // Locate final coordinate of newly created power-up (accounting for gravity & any reshuffle)
  let createdPowerUpInfo: CreatedPowerUpInfo | null = null;
  if (createdTileObject && createdPowerUpMeta) {
    let finalRow = refill.createdPowerUpFinalCoord?.row ?? createdTileObject.row;
    let finalCol = refill.createdPowerUpFinalCoord?.col ?? createdTileObject.col;
    if (ensured.reshuffled) {
      for (let r = 0; r < ensured.board.length; r++) {
        for (let c = 0; c < ensured.board[r].length; c++) {
          if (ensured.board[r][c].id === createdTileObject.id) {
            finalRow = r;
            finalCol = c;
          }
        }
      }
    }
    createdPowerUpInfo = {
      tileId: createdTileObject.id,
      row: finalRow,
      col: finalCol,
      letter: createdTileObject.letter,
      powerUp: createdPowerUpMeta,
    };
  }

  // Step G: Update counters, objectives & canonical move-based lifecycle state
  const nextLongWords: Record<number, number> = { ...state.longWordsByLength };
  for (let minLen = 4; minLen <= Math.min(preview.length, 10); minLen++) {
    nextLongWords[minLen] = (nextLongWords[minLen] ?? 0) + 1;
  }

  const nextPowerUpsCreatedByType = { ...state.powerUpsCreatedByType };
  if (earnedPowerUpType) {
    nextPowerUpsCreatedByType[earnedPowerUpType] =
      (nextPowerUpsCreatedByType[earnedPowerUpType] ?? 0) + 1;
  }

  const nextPowerUpsUsedByType = { ...state.powerUpsUsedByType };
  for (const act of activations) {
    nextPowerUpsUsedByType[act.type] = (nextPowerUpsUsedByType[act.type] ?? 0) + 1;
  }

  const chainReactionSize = activations.length;
  const nextScore = state.score + scoreGained;
  const nextMovesRemaining = Math.max(0, state.movesRemaining - 1);
  const nextMovesUsed = state.movesUsed + 1;
  const nextWordsFormed = state.wordsFormed + 1;
  const nextLongestWord = Math.max(state.longestWordLength, preview.length);
  const nextTilesDestroyed = state.tilesDestroyed + destroyedTiles.length;
  const nextVowelsDestroyed = state.vowelsDestroyed + vowelsAdded;
  const nextConsonantsDestroyed = state.consonantsDestroyed + consonantsAdded;
  const nextPowerUpsCreated = state.powerUpsCreated + (earnedPowerUpType ? 1 : 0);
  const nextPowerUpsUsed = state.powerUpsUsed + activations.length;
  const nextLargestChain = Math.max(state.largestChainReaction, chainReactionSize);

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
    powerUpsUsed: nextPowerUpsUsed,
    powerUpsUsedByType: nextPowerUpsUsedByType,
  });

  const newlyCompletedObjectiveIds = nextObjectives
    .filter((o) => o.completed && !prevCompletedIds.has(o.id))
    .map((o) => o.id);

  const allComplete = nextObjectives.every((o) => o.completed);
  const justQualifiedAllObjectives = allComplete && !state.objectivesComplete;
  const nextLifecycle = resolveLifecyclePhase(nextMovesRemaining, allComplete);
  const starsEarned = computeStarsForStage(state.stage, nextScore, allComplete);

  const nextState: CrushItGameState = {
    ...state,
    board: ensured.board,
    score: nextScore,
    movesRemaining: nextMovesRemaining,
    movesUsed: nextMovesUsed,
    wordsFormed: nextWordsFormed,
    wordHistory: [
      {
        word: preview.word,
        score: scoreGained,
        earnedPowerUp: earnedPowerUpType,
        triggeredPowerUpsCount: activations.length,
      },
      ...state.wordHistory.slice(0, 49),
    ],
    longestWordLength: nextLongestWord,
    longWordsByLength: nextLongWords,
    tilesDestroyed: nextTilesDestroyed,
    vowelsDestroyed: nextVowelsDestroyed,
    consonantsDestroyed: nextConsonantsDestroyed,
    powerUpsCreated: nextPowerUpsCreated,
    powerUpsCreatedByType: nextPowerUpsCreatedByType,
    powerUpsUsed: nextPowerUpsUsed,
    powerUpsUsedByType: nextPowerUpsUsedByType,
    largestChainReaction: nextLargestChain,
    objectives: nextObjectives,
    objectivesComplete: allComplete,
    lifecyclePhase: nextLifecycle,
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
      destroyedTiles,
      wordScoreGained,
      powerUpScoreGained,
      scoreGained,
      createdPowerUp: createdPowerUpInfo,
      activations,
      chainReactionSize,
      autoReshuffled: ensured.reshuffled,
      newlyCompletedObjectiveIds,
      justQualifiedAllObjectives,
      lifecycleAfterTurn: nextLifecycle,
    },
  };
}

/**
 * Triggers a player-initiated manual reshuffle (consumes 1 manual shuffle charge,
 * never consumes moves, never reduces score, and preserves all integrated power-up tiles).
 */
export function manualReshuffleBoard(
  state: CrushItGameState,
  trie: CrushItWordTrie,
  rng: () => number = Math.random
): { accepted: boolean; reason?: string; state: CrushItGameState; event?: TurnResolutionEvent } {
  if (state.lifecyclePhase === 'VICTORY' || state.lifecyclePhase === 'FAILURE') {
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
      wordScoreGained: 0,
      powerUpScoreGained: 0,
      scoreGained: 0,
      createdPowerUp: null,
      activations: [],
      chainReactionSize: 0,
      autoReshuffled: false,
      newlyCompletedObjectiveIds: [],
      justQualifiedAllObjectives: false,
      lifecycleAfterTurn: nextState.lifecyclePhase,
    },
  };
}
