import { buildShapeTopology } from './shapes.js';
import {
  GridItBoard,
  GridItBoardSize,
  GridItScoringConfig,
  GridItShapeId,
  GridItTileNode,
  GridItValidationResult,
} from './types.js';

/**
 * Provisional baseline GridIt scoring table.
 * Kept configurable so future competitive balancing can tune values without touching callers.
 */
export const DEFAULT_GRIDIT_SCORING: GridItScoringConfig = {
  minWordLength: 3,
  pointsByLength: {
    3: 1,
    4: 2,
    5: 4,
    6: 7,
    7: 11,
    8: 15,
  },
  extraLetterPoints: 3,
  provisional: true,
};

const CONSONANT_BAG =
  'BBCCDDDDFFGGGHHJKLLLLMMMNNNNNNPPQRRRRRRSSSSSSTTTTTTVVWWXYYZ';
const VOWEL_BAG = 'AAAAAAAAAEEEEEEEEEEEEIIIIIIIIIOOOOOOOOUUUU';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIE_ROTATIONS: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];

/**
 * Assigns deterministic visual-only rotations (0/90/180/270) and micro-tilt
 * to each physical letter die. Never alters letter identity, coordinates, or neighbors.
 */
export function assignDeterministicDieOrientations<T extends { id: string; rotationDeg?: 0 | 90 | 180 | 270; tiltDeg?: number }>(
  tiles: T[],
  seed: number
): T[] {
  const rand = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  return tiles.map((tile) => ({
    ...tile,
    rotationDeg: tile.rotationDeg ?? DIE_ROTATIONS[Math.floor(rand() * DIE_ROTATIONS.length)],
    tiltDeg: tile.tiltDeg ?? Math.round((rand() * 6.4 - 3.2) * 10) / 10,
  }));
}

export function scoreGridItWord(
  word: string,
  config: GridItScoringConfig = DEFAULT_GRIDIT_SCORING
): number {
  const len = word.trim().length;
  if (len < config.minWordLength) return 0;
  if (config.pointsByLength[len] !== undefined) {
    return config.pointsByLength[len];
  }
  const maxDefinedLen = Math.max(...Object.keys(config.pointsByLength).map(Number));
  const base = config.pointsByLength[maxDefinedLen] ?? 15;
  return base + Math.max(0, len - maxDefinedLen) * config.extraLetterPoints;
}

export function getWordFromPath(board: GridItBoard, tilePath: string[]): string {
  const tileMap = new Map<string, GridItTileNode>();
  for (const t of board.tiles) tileMap.set(t.id, t);
  return tilePath.map((id) => tileMap.get(id)?.letter ?? '').join('');
}

export function validateWordPath(
  board: GridItBoard,
  tilePath: string[],
  dictionary: Set<string>,
  alreadyFound: Set<string>,
  config: GridItScoringConfig = DEFAULT_GRIDIT_SCORING
): GridItValidationResult {
  if (!Array.isArray(tilePath) || tilePath.length === 0) {
    return { valid: false, word: '', points: 0, reason: 'invalid_path' };
  }

  const tileMap = new Map<string, GridItTileNode>();
  for (const t of board.tiles) tileMap.set(t.id, t);

  const visited = new Set<string>();
  const letters: string[] = [];

  for (let i = 0; i < tilePath.length; i++) {
    const id = tilePath[i];
    const tile = tileMap.get(id);
    if (!tile) {
      return { valid: false, word: letters.join(''), points: 0, reason: 'invalid_path' };
    }
    if (visited.has(id)) {
      return { valid: false, word: letters.join(''), points: 0, reason: 'duplicate_tile' };
    }
    if (i > 0) {
      const prev = tileMap.get(tilePath[i - 1])!;
      if (!prev.neighbors.includes(id)) {
        return { valid: false, word: letters.join(''), points: 0, reason: 'not_adjacent' };
      }
    }
    visited.add(id);
    letters.push(tile.letter);
  }

  const word = letters.join('').toUpperCase();
  if (word.length < config.minWordLength) {
    return { valid: false, word, points: 0, reason: 'too_short' };
  }
  if (alreadyFound.has(word)) {
    return { valid: false, word, points: 0, reason: 'already_found' };
  }
  if (!dictionary.has(word)) {
    return { valid: false, word, points: 0, reason: 'not_in_dictionary' };
  }

  return {
    valid: true,
    word,
    points: scoreGridItWord(word, config),
  };
}

export interface DiscoveredBoardWord {
  word: string;
  tilePath: string[];
}

export function findBoardWords(
  board: GridItBoard,
  dictionary: Set<string>,
  prefixSet: Set<string>,
  options: {
    minLength?: number;
    maxWordLength?: number;
    maxWords?: number;
    maxVisits?: number;
    excludeWords?: Set<string>;
  } = {}
): DiscoveredBoardWord[] {
  const minLength = options.minLength ?? DEFAULT_GRIDIT_SCORING.minWordLength;
  const maxWordLength = options.maxWordLength ?? 9;
  const maxWords = options.maxWords ?? 120;
  const maxVisits = options.maxVisits ?? 6500;
  const exclude = options.excludeWords;

  const tileMap = new Map<string, GridItTileNode>();
  for (const t of board.tiles) tileMap.set(t.id, t);

  const foundMap = new Map<string, string[]>();
  const visited = new Set<string>();
  let visits = 0;

  const dfs = (tile: GridItTileNode, currentWord: string, path: string[]) => {
    if (visits >= maxVisits || foundMap.size >= maxWords) return;
    visits++;

    if (currentWord.length >= minLength) {
      if (
        !exclude?.has(currentWord) &&
        !foundMap.has(currentWord) &&
        dictionary.has(currentWord)
      ) {
        foundMap.set(currentWord, [...path]);
      }
    }

    if (currentWord.length >= maxWordLength) return;

    // Prefix pruning for lengths <= 6 (and continue up to maxWordLength if prefix matches)
    if (currentWord.length <= 6 && !prefixSet.has(currentWord)) {
      return;
    }

    for (const nextId of tile.neighbors) {
      if (visits >= maxVisits || foundMap.size >= maxWords) return;
      if (visited.has(nextId)) continue;
      const nextTile = tileMap.get(nextId);
      if (!nextTile) continue;

      const nextWord = currentWord + nextTile.letter;
      if (nextWord.length <= 6 && !prefixSet.has(nextWord)) continue;

      visited.add(nextId);
      path.push(nextId);
      dfs(nextTile, nextWord, path);
      path.pop();
      visited.delete(nextId);
    }
  };

  for (const startTile of board.tiles) {
    if (visits >= maxVisits || foundMap.size >= maxWords) break;
    if (!prefixSet.has(startTile.letter)) continue;
    visited.add(startTile.id);
    dfs(startTile, startTile.letter, [startTile.id]);
    visited.delete(startTile.id);
  }

  return Array.from(foundMap.entries())
    .map(([word, tilePath]) => ({ word, tilePath }))
    .sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word));
}

function buildLettersForCount(count: number, seed: number): string[] {
  const rand = mulberry32(seed);
  const vowelTarget = Math.max(4, Math.round(count * (0.35 + rand() * 0.08)));
  const letters: string[] = [];

  for (let i = 0; i < vowelTarget; i++) {
    letters.push(VOWEL_BAG[Math.floor(rand() * VOWEL_BAG.length)]);
  }
  while (letters.length < count) {
    const ch = CONSONANT_BAG[Math.floor(rand() * CONSONANT_BAG.length)];
    // Avoid awkward standalone Q unless a U exists (and limit duplicate rare letters)
    if (ch === 'Q' && letters.filter((l) => l === 'Q').length >= 1) continue;
    letters.push(ch);
  }

  // Fisher-Yates shuffle
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  return letters;
}

export function generatePlayableBoard(
  shapeId: GridItShapeId,
  sizeId: GridItBoardSize,
  options: {
    seed?: number;
    language?: string;
    dictionary?: Set<string>;
    prefixSet?: Set<string>;
  } = {}
): GridItBoard {
  const baseSeed = options.seed ?? Math.floor(Math.random() * 0x7fffffff);
  const language = options.language ?? 'en';
  const topology = buildShapeTopology(shapeId, sizeId);

  const attempts = options.dictionary && options.prefixSet ? 6 : 1;
  let bestBoard: GridItBoard | null = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const seed = (baseSeed + attempt * 1013904223) >>> 0;
    const letters = buildLettersForCount(topology.tiles.length, seed);
    const board: GridItBoard = {
      id: `grid_${shapeId}_${sizeId}_${seed.toString(36)}`,
      shapeId,
      sizeId,
      language,
      tiles: assignDeterministicDieOrientations(
        topology.tiles.map((t, idx) => ({
          ...t,
          letter: letters[idx],
        })),
        seed
      ),
      bounds: topology.bounds,
      tileRadius: topology.tileRadius,
      seed,
    };

    if (!options.dictionary || !options.prefixSet) {
      return board;
    }

    const sampleWords = findBoardWords(board, options.dictionary, options.prefixSet, {
      maxWords: 40,
      maxVisits: 3500,
    });
    if (sampleWords.length >= 18) {
      return board;
    }
    if (sampleWords.length > bestScore) {
      bestScore = sampleWords.length;
      bestBoard = board;
    }
  }

  return (
    bestBoard ?? {
      id: `grid_${shapeId}_${sizeId}_${baseSeed.toString(36)}`,
      shapeId,
      sizeId,
      language,
      tiles: assignDeterministicDieOrientations(
        topology.tiles.map((t, idx) => ({
          ...t,
          letter: buildLettersForCount(topology.tiles.length, baseSeed)[idx],
        })),
        baseSeed
      ),
      bounds: topology.bounds,
      tileRadius: topology.tileRadius,
      seed: baseSeed,
    }
  );
}
