import { isExcludedWord } from './excludedWords.js';
import { ChangeItRestriction, ChangeItWordLength } from './types.js';

export interface ChangeItVocabJson {
  version: string;
  source?: {
    validation: string;
    familiarity: string;
    license: string;
  };
  stats?: {
    totalPuzzleWords: number;
    totalValidationWords: number;
    excludedMatchedCount: number;
    byLength: Record<'3' | '4' | '5' | '6', { puzzle: number; validation: number }>;
  };
  puzzleByLength: Record<'3' | '4' | '5' | '6', string[]>;
  validationExtraByLength: Record<'3' | '4' | '5' | '6', string[]>;
}

export interface WordLengthGraph {
  length: ChangeItWordLength;
  words: string[];
  indexByWord: Map<string, number>;
  adjacency: number[][];
  componentIds: Int32Array;
  componentSizes: number[];
}

export interface ChangeItEngineData {
  version: string;
  puzzleSet: Set<string>;
  validationSet: Set<string>;
  puzzleByLength: Record<ChangeItWordLength, string[]>;
  validationByLength: Record<ChangeItWordLength, string[]>;
  puzzleGraphs: Record<ChangeItWordLength, WordLengthGraph>;
  validationGraphs: Record<ChangeItWordLength, WordLengthGraph>;
}

export interface BfsPathOptions {
  excludedWords?: ReadonlySet<string>;
  lockedPositions?: ReadonlySet<number>;
  forbiddenLetters?: ReadonlySet<string>;
  noConsecutiveSamePosition?: boolean;
  initialLastChangedIndex?: number | null;
}

export interface BfsPathResult {
  solvable: boolean;
  minMoves: number;
  path: string[];
  optimalNextWords: string[];
}

export function canonicalPuzzleKey(wordA: string, wordB: string): string {
  const a = wordA.trim().toUpperCase();
  const b = wordB.trim().toUpperCase();
  return a <= b ? `${a}:${b}` : `${b}:${a}`;
}

export function getChangedIndices(fromWord: string, toWord: string): number[] {
  const changed: number[] = [];
  if (fromWord.length !== toWord.length) return changed;
  for (let i = 0; i < fromWord.length; i++) {
    if (fromWord[i] !== toWord[i]) changed.push(i);
  }
  return changed;
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return -1;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diff++;
  }
  return diff;
}

/**
 * Builds an undirected word-ladder graph in O(N * L) time using wildcard bucket indexing
 * (e.g. COLD -> *OLD, C*LD, CO*D, COL*), avoiding O(N^2) pairwise comparisons.
 */
export function buildWordLengthGraph(words: string[], length: ChangeItWordLength): WordLengthGraph {
  const indexByWord = new Map<string, number>();
  for (let i = 0; i < words.length; i++) {
    indexByWord.set(words[i], i);
  }

  const buckets = new Map<string, number[]>();
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    for (let p = 0; p < length; p++) {
      const pattern = `${w.slice(0, p)}*${w.slice(p + 1)}`;
      let list = buckets.get(pattern);
      if (!list) {
        list = [];
        buckets.set(pattern, list);
      }
      list.push(i);
    }
  }

  const adjacency: number[][] = Array.from({ length: words.length }, () => []);
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    for (let i = 0; i < bucket.length; i++) {
      const u = bucket[i];
      for (let j = i + 1; j < bucket.length; j++) {
        const v = bucket[j];
        adjacency[u].push(v);
        adjacency[v].push(u);
      }
    }
  }

  const componentIds = new Int32Array(words.length).fill(-1);
  const componentSizes: number[] = [];
  for (let start = 0; start < words.length; start++) {
    if (componentIds[start] !== -1) continue;
    const compId = componentSizes.length;
    let size = 0;
    const queue: number[] = [start];
    componentIds[start] = compId;
    for (let qi = 0; qi < queue.length; qi++) {
      const u = queue[qi];
      size++;
      const neighbors = adjacency[u];
      for (let k = 0; k < neighbors.length; k++) {
        const nb = neighbors[k];
        if (componentIds[nb] === -1) {
          componentIds[nb] = compId;
          queue.push(nb);
        }
      }
    }
    componentSizes.push(size);
  }

  return {
    length,
    words,
    indexByWord,
    adjacency,
    componentIds,
    componentSizes,
  };
}

export function buildChangeItEngineData(vocab: ChangeItVocabJson): ChangeItEngineData {
  const puzzleSet = new Set<string>();
  const validationSet = new Set<string>();
  const lengths: ChangeItWordLength[] = [3, 4, 5, 6];

  const puzzleByLength = {} as Record<ChangeItWordLength, string[]>;
  const validationByLength = {} as Record<ChangeItWordLength, string[]>;
  const puzzleGraphs = {} as Record<ChangeItWordLength, WordLengthGraph>;
  const validationGraphs = {} as Record<ChangeItWordLength, WordLengthGraph>;

  for (const len of lengths) {
    const key = String(len) as '3' | '4' | '5' | '6';
    const puzWords = (vocab.puzzleByLength[key] ?? [])
      .map((w) => w.trim().toUpperCase())
      .filter((w) => w.length === len && !isExcludedWord(w));
    const extraWords = (vocab.validationExtraByLength[key] ?? [])
      .map((w) => w.trim().toUpperCase())
      .filter((w) => w.length === len && !isExcludedWord(w));

    const valCombined = Array.from(new Set([...puzWords, ...extraWords])).sort();
    for (const w of puzWords) puzzleSet.add(w);
    for (const w of valCombined) validationSet.add(w);

    puzzleByLength[len] = puzWords;
    validationByLength[len] = valCombined;
    puzzleGraphs[len] = buildWordLengthGraph(puzWords, len);
    validationGraphs[len] = buildWordLengthGraph(valCombined, len);
  }

  return {
    version: vocab.version || '1.0.0',
    puzzleSet,
    validationSet,
    puzzleByLength,
    validationByLength,
    puzzleGraphs,
    validationGraphs,
  };
}

function getSingleChangedPosition(a: string, b: string): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return i;
  }
  return -1;
}

function isWordAllowedUnderRestrictions(
  fromWord: string,
  toWord: string,
  targetWord: string,
  options?: BfsPathOptions
): { allowed: boolean; changedPos: number } {
  if (options?.excludedWords?.has(toWord) && toWord !== targetWord) {
    return { allowed: false, changedPos: -1 };
  }
  const changedPos = getSingleChangedPosition(fromWord, toWord);
  if (changedPos === -1) return { allowed: false, changedPos: -1 };

  if (options?.lockedPositions?.has(changedPos)) {
    return { allowed: false, changedPos };
  }

  if (options?.forbiddenLetters && options.forbiddenLetters.size > 0 && toWord !== targetWord) {
    // Forbid introducing a forbidden letter at the changed position
    if (options.forbiddenLetters.has(toWord[changedPos])) {
      return { allowed: false, changedPos };
    }
  }

  return { allowed: true, changedPos };
}

/**
 * Breadth-First Search (BFS) shortest-path solver supporting:
 * - Excluded words (previously used words in active chain)
 * - Locked letter positions (Restricted mode / Letter Lock / Frozen Letter)
 * - Forbidden letters (Restricted mode)
 * - No consecutive same-position change (state-space BFS over (node, lastPos))
 */
export function bfsShortestPath(
  graph: WordLengthGraph,
  startRaw: string,
  targetRaw: string,
  options?: BfsPathOptions
): BfsPathResult {
  const start = startRaw.trim().toUpperCase();
  const target = targetRaw.trim().toUpperCase();
  const sIdx = graph.indexByWord.get(start);
  const tIdx = graph.indexByWord.get(target);

  if (sIdx === undefined || tIdx === undefined) {
    return { solvable: false, minMoves: -1, path: [], optimalNextWords: [] };
  }
  if (sIdx === tIdx) {
    return { solvable: true, minMoves: 0, path: [start], optimalNextWords: [] };
  }

  // Fast connected-component rejection when graph nodes are unconstrained
  if (graph.componentIds[sIdx] !== graph.componentIds[tIdx]) {
    return { solvable: false, minMoves: -1, path: [], optimalNextWords: [] };
  }

  const hasRestrictions = Boolean(
    (options?.lockedPositions && options.lockedPositions.size > 0) ||
      (options?.forbiddenLetters && options.forbiddenLetters.size > 0) ||
      options?.noConsecutiveSamePosition
  );

  if (!options?.noConsecutiveSamePosition) {
    const n = graph.words.length;
    const prev = new Int32Array(n).fill(-1);
    const dist = new Int32Array(n).fill(-1);
    prev[sIdx] = sIdx;
    dist[sIdx] = 0;

    const queue: number[] = [sIdx];
    let targetDist = -1;

    for (let qi = 0; qi < queue.length; qi++) {
      const u = queue[qi];
      const d = dist[u];
      if (targetDist !== -1 && d >= targetDist) break;

      const uWord = graph.words[u];
      const neighbors = graph.adjacency[u];
      for (let k = 0; k < neighbors.length; k++) {
        const v = neighbors[k];
        if (dist[v] !== -1) continue;
        if (options?.excludedWords?.has(graph.words[v]) && v !== tIdx) continue;
        if (hasRestrictions) {
          const check = isWordAllowedUnderRestrictions(uWord, graph.words[v], target, options);
          if (!check.allowed) continue;
        }
        dist[v] = d + 1;
        prev[v] = u;
        if (v === tIdx) {
          targetDist = d + 1;
        } else {
          queue.push(v);
        }
      }
    }

    if (dist[tIdx] === -1) {
      return { solvable: false, minMoves: -1, path: [], optimalNextWords: [] };
    }

    const path: string[] = [];
    for (let cur = tIdx; cur !== sIdx; cur = prev[cur]) {
      path.push(graph.words[cur]);
    }
    path.push(start);
    path.reverse();

    return {
      solvable: true,
      minMoves: dist[tIdx],
      path,
      optimalNextWords: path.length > 1 ? [path[1]] : [],
    };
  }

  // State-space BFS when noConsecutiveSamePosition is enabled: stateId = nodeIdx * slots + (lastPos + 1)
  const L = graph.length;
  const slots = L + 1;
  const totalStates = graph.words.length * slots;
  const initPos =
    options?.initialLastChangedIndex !== null && options?.initialLastChangedIndex !== undefined
      ? options.initialLastChangedIndex + 1
      : 0;
  const startState = sIdx * slots + initPos;

  const prevState = new Int32Array(totalStates).fill(-1);
  const distState = new Int32Array(totalStates).fill(-1);
  prevState[startState] = startState;
  distState[startState] = 0;

  const queue: number[] = [startState];
  let foundTargetState = -1;

  for (let qi = 0; qi < queue.length; qi++) {
    const state = queue[qi];
    const u = Math.floor(state / slots);
    const lastPos = (state % slots) - 1;
    const d = distState[state];
    const uWord = graph.words[u];
    const neighbors = graph.adjacency[u];

    for (let k = 0; k < neighbors.length; k++) {
      const v = neighbors[k];
      const check = isWordAllowedUnderRestrictions(uWord, graph.words[v], target, options);
      if (!check.allowed) continue;
      if (check.changedPos === lastPos) continue;

      const nextState = v * slots + (check.changedPos + 1);
      if (distState[nextState] !== -1) continue;
      distState[nextState] = d + 1;
      prevState[nextState] = state;

      if (v === tIdx) {
        foundTargetState = nextState;
        break;
      }
      queue.push(nextState);
    }
    if (foundTargetState !== -1) break;
  }

  if (foundTargetState === -1) {
    return { solvable: false, minMoves: -1, path: [], optimalNextWords: [] };
  }

  const path: string[] = [];
  for (let cur = foundTargetState; cur !== startState; cur = prevState[cur]) {
    path.push(graph.words[Math.floor(cur / slots)]);
  }
  path.push(start);
  path.reverse();

  return {
    solvable: true,
    minMoves: distState[foundTargetState],
    path,
    optimalNextWords: path.length > 1 ? [path[1]] : [],
  };
}

/**
 * Single-source BFS distance table from a starting word across the entire graph.
 * Used for puzzle generation, Survival chain extension, and Reroute equivalence.
 */
export function computeBfsDistancesFrom(
  graph: WordLengthGraph,
  startRaw: string,
  options?: {
    excludedWords?: ReadonlySet<string>;
    lockedPositions?: ReadonlySet<number>;
    forbiddenLetters?: ReadonlySet<string>;
  }
): Int32Array {
  const start = startRaw.trim().toUpperCase();
  const sIdx = graph.indexByWord.get(start);
  const dist = new Int32Array(graph.words.length).fill(-1);
  if (sIdx === undefined) return dist;

  dist[sIdx] = 0;
  const queue: number[] = [sIdx];
  const hasLocks = Boolean(
    (options?.lockedPositions && options.lockedPositions.size > 0) ||
      (options?.forbiddenLetters && options.forbiddenLetters.size > 0)
  );

  for (let qi = 0; qi < queue.length; qi++) {
    const u = queue[qi];
    const d = dist[u];
    const uWord = graph.words[u];
    const neighbors = graph.adjacency[u];
    for (let k = 0; k < neighbors.length; k++) {
      const v = neighbors[k];
      if (dist[v] !== -1) continue;
      const vWord = graph.words[v];
      if (options?.excludedWords?.has(vWord)) continue;
      if (hasLocks) {
        const pos = getSingleChangedPosition(uWord, vWord);
        if (options?.lockedPositions?.has(pos)) continue;
        if (options?.forbiddenLetters?.has(vWord[pos])) continue;
      }
      dist[v] = d + 1;
      queue.push(v);
    }
  }
  return dist;
}

export interface MoveValidationParams {
  currentWord: string;
  submittedWord: string;
  targetWord: string;
  usedWords: ReadonlySet<string>;
  validationSet: ReadonlySet<string>;
  restrictions: ChangeItRestriction;
  lastChangedIndex: number | null;
  allowDoubleShift?: boolean;
  extraLockedPositions?: ReadonlySet<number>;
}

export interface MoveValidationResult {
  valid: boolean;
  errorCode?: string;
  message: string;
  normalizedWord: string;
  changedIndices: number[];
  usedDoubleShift: boolean;
}

export function validateMoveTransformation(params: MoveValidationParams): MoveValidationResult {
  const normalized = params.submittedWord.trim().toUpperCase();
  const current = params.currentWord.trim().toUpperCase();
  const target = params.targetWord.trim().toUpperCase();

  if (!/^[A-Z]+$/.test(normalized)) {
    return {
      valid: false,
      errorCode: 'INVALID_CHARACTERS',
      message: 'Word must contain only English letters A–Z.',
      normalizedWord: normalized,
      changedIndices: [],
      usedDoubleShift: false,
    };
  }

  if (normalized.length !== current.length) {
    return {
      valid: false,
      errorCode: 'INVALID_LENGTH',
      message: `Word must be exactly ${current.length} letters long.`,
      normalizedWord: normalized,
      changedIndices: [],
      usedDoubleShift: false,
    };
  }

  if (normalized === current) {
    return {
      valid: false,
      errorCode: 'UNCHANGED_WORD',
      message: 'You must change at least one letter.',
      normalizedWord: normalized,
      changedIndices: [],
      usedDoubleShift: false,
    };
  }

  if (isExcludedWord(normalized) || !params.validationSet.has(normalized)) {
    return {
      valid: false,
      errorCode: 'NOT_IN_DICTIONARY',
      message: `"${normalized}" is not in the approved ChangeIt English dictionary.`,
      normalizedWord: normalized,
      changedIndices: [],
      usedDoubleShift: false,
    };
  }

  if (params.usedWords.has(normalized)) {
    return {
      valid: false,
      errorCode: 'DUPLICATE_WORD',
      message: `"${normalized}" was already used in this puzzle.`,
      normalizedWord: normalized,
      changedIndices: [],
      usedDoubleShift: false,
    };
  }

  const changedIndices = getChangedIndices(current, normalized);
  const maxAllowedDiff = params.allowDoubleShift ? 2 : 1;
  if (changedIndices.length === 0 || changedIndices.length > maxAllowedDiff) {
    return {
      valid: false,
      errorCode: 'WRONG_LETTER_DIFF',
      message: params.allowDoubleShift
        ? 'With Double Shift active, change 1 or 2 letters in the same positions.'
        : 'Change exactly 1 letter per move.',
      normalizedWord: normalized,
      changedIndices,
      usedDoubleShift: false,
    };
  }

  const lockedSet = new Set<number>(params.restrictions.lockedPositions);
  if (
    params.restrictions.nextMoveLockedPosition !== null &&
    params.restrictions.nextMoveLockedPosition !== undefined
  ) {
    lockedSet.add(params.restrictions.nextMoveLockedPosition);
  }
  if (params.extraLockedPositions) {
    for (const idx of params.extraLockedPositions) lockedSet.add(idx);
  }

  for (const idx of changedIndices) {
    if (lockedSet.has(idx)) {
      return {
        valid: false,
        errorCode: 'LOCKED_POSITION',
        message: `Position #${idx + 1} (${current[idx]}) is currently locked.`,
        normalizedWord: normalized,
        changedIndices,
        usedDoubleShift: false,
      };
    }
  }

  if (
    params.restrictions.noConsecutiveSamePosition &&
    params.lastChangedIndex !== null &&
    changedIndices.length === 1 &&
    changedIndices[0] === params.lastChangedIndex
  ) {
    return {
      valid: false,
      errorCode: 'CONSECUTIVE_POSITION_BLOCKED',
      message: `Restriction active: cannot change position #${params.lastChangedIndex + 1} twice in a row.`,
      normalizedWord: normalized,
      changedIndices,
      usedDoubleShift: false,
    };
  }

  if (params.restrictions.forbiddenLetters.length > 0 && normalized !== target) {
    const forbidden = new Set(params.restrictions.forbiddenLetters.map((c) => c.toUpperCase()));
    for (const idx of changedIndices) {
      if (forbidden.has(normalized[idx])) {
        return {
          valid: false,
          errorCode: 'FORBIDDEN_LETTER',
          message: `Restriction active: letter "${normalized[idx]}" cannot be introduced.`,
          normalizedWord: normalized,
          changedIndices,
          usedDoubleShift: false,
        };
      }
    }
  }

  const usedDoubleShift = changedIndices.length === 2;
  return {
    valid: true,
    message: usedDoubleShift ? 'Double Shift transformation accepted!' : 'Valid transformation!',
    normalizedWord: normalized,
    changedIndices,
    usedDoubleShift,
  };
}
