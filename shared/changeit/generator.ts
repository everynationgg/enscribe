import { DIFFICULTY_CONFIGS } from './difficulty.js';
import {
  ChangeItDifficulty,
  ChangeItRestriction,
  ChangeItWordLength,
} from './types.js';
import {
  ChangeItEngineData,
  bfsShortestPath,
  canonicalPuzzleKey,
  computeBfsDistancesFrom,
} from './wordGraph.js';

export interface GeneratedPuzzle {
  startWord: string;
  targetWord: string;
  canonicalKey: string;
  wordLength: ChangeItWordLength;
  minMoves: number;
  familiarMinMoves: number;
  difficulty: ChangeItDifficulty;
  restrictions: ChangeItRestriction;
}

export interface GeneratePuzzleOptions {
  difficulty: ChangeItDifficulty;
  wordLength?: ChangeItWordLength | 'auto';
  completedPuzzleKeys?: ReadonlySet<string>;
  recentWords?: ReadonlySet<string>;
  restricted?: boolean;
  maxAttempts?: number;
}

export function createEmptyRestriction(): ChangeItRestriction {
  return {
    lockedPositions: [],
    forbiddenLetters: [],
    noConsecutiveSamePosition: false,
    nextMoveLockedPosition: null,
  };
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getEligibleLengths(
  difficulty: ChangeItDifficulty,
  override?: ChangeItWordLength | 'auto'
): ChangeItWordLength[] {
  if (override && override !== 'auto') {
    return [override];
  }
  return DIFFICULTY_CONFIGS[difficulty].wordLengths;
}

/**
 * Generates a mathematically verified ChangeIt puzzle using BFS across both
 * Puzzle Vocabulary (guaranteed familiar solution) and Validation Vocabulary
 * (true minimum transformation distance).
 *
 * Uses 3-tier anti-repetition fallback:
 *  Tier 1: Exclude completedPuzzleKeys AND recentWords
 *  Tier 2: Relax recentWords cooldown while still excluding completedPuzzleKeys
 *  Tier 3: Relax completedPuzzleKeys if pool is exhausted (never stalls)
 */
export function generateVerifiedPuzzle(
  engineData: ChangeItEngineData,
  options: GeneratePuzzleOptions
): GeneratedPuzzle {
  const cfg = DIFFICULTY_CONFIGS[options.difficulty];
  const lengths = getEligibleLengths(options.difficulty, options.wordLength);
  const completedKeys = options.completedPuzzleKeys ?? new Set<string>();
  const recentWords = options.recentWords ?? new Set<string>();
  const maxAttemptsPerTier = options.maxAttempts ?? 120;

  // Determine effective distance bounds when wordLength override is used
  const lengthOverride =
    options.wordLength && options.wordLength !== 'auto' ? options.wordLength : null;
  let minMoves = cfg.minMoves;
  let maxMoves = cfg.maxMoves;
  if (lengthOverride === 3 && minMoves > 5) {
    minMoves = 4;
    maxMoves = 6;
  } else if (lengthOverride === 6 && options.difficulty === 'beginner') {
    minMoves = 2;
    maxMoves = 3;
  }

  const tiers = [
    { enforceCooldown: true, enforceCompleted: true, slack: cfg.maxFamiliarSlack },
    { enforceCooldown: false, enforceCompleted: true, slack: cfg.maxFamiliarSlack + 1 },
    { enforceCooldown: false, enforceCompleted: false, slack: cfg.maxFamiliarSlack + 3 },
  ];

  for (const tier of tiers) {
    for (let attempt = 0; attempt < maxAttemptsPerTier; attempt++) {
      const wordLength = pickRandom(lengths);
      const puzGraph = engineData.puzzleGraphs[wordLength];
      const valGraph = engineData.validationGraphs[wordLength];
      if (!puzGraph || puzGraph.words.length < 2) continue;

      // Prefer words in large connected components
      const candidates = puzGraph.words.filter((w) => {
        const idx = puzGraph.indexByWord.get(w)!;
        const cSize = puzGraph.componentSizes[puzGraph.componentIds[idx]];
        if (cSize < 12) return false;
        if (tier.enforceCooldown && recentWords.has(w)) return false;
        return true;
      });
      if (candidates.length === 0) continue;

      const startWord = pickRandom(candidates);
      const puzDist = computeBfsDistancesFrom(puzGraph, startWord);

      const targetIndices: number[] = [];
      for (let i = 0; i < puzDist.length; i++) {
        const d = puzDist[i];
        if (d < minMoves || d > maxMoves + tier.slack) continue;
        const candidateTarget = puzGraph.words[i];
        if (candidateTarget === startWord) continue;
        if (tier.enforceCooldown && recentWords.has(candidateTarget)) continue;
        const cKey = canonicalPuzzleKey(startWord, candidateTarget);
        if (tier.enforceCompleted && completedKeys.has(cKey)) continue;
        targetIndices.push(i);
      }

      if (targetIndices.length === 0) continue;

      // Pick a few candidate targets and verify against Validation Vocabulary
      for (let sample = 0; sample < Math.min(8, targetIndices.length); sample++) {
        const tIdx = pickRandom(targetIndices);
        const targetWord = puzGraph.words[tIdx];
        const familiarMinMoves = puzDist[tIdx];
        const valRes = bfsShortestPath(valGraph, startWord, targetWord);
        if (!valRes.solvable) continue;

        if (
          valRes.minMoves >= minMoves &&
          valRes.minMoves <= maxMoves &&
          familiarMinMoves - valRes.minMoves <= tier.slack
        ) {
          if (options.restricted) {
            const restrictedRes = attachVerifiedRestriction(
              engineData,
              wordLength,
              startWord,
              targetWord,
              options.difficulty
            );
            if (restrictedRes) {
              return {
                startWord,
                targetWord,
                canonicalKey: canonicalPuzzleKey(startWord, targetWord),
                wordLength,
                minMoves: restrictedRes.minMoves,
                familiarMinMoves: restrictedRes.familiarMinMoves,
                difficulty: options.difficulty,
                restrictions: restrictedRes.restrictions,
              };
            }
          } else {
            return {
              startWord,
              targetWord,
              canonicalKey: canonicalPuzzleKey(startWord, targetWord),
              wordLength,
              minMoves: valRes.minMoves,
              familiarMinMoves,
              difficulty: options.difficulty,
              restrictions: createEmptyRestriction(),
            };
          }
        }
      }
    }
  }

  // Deterministic safe fallback (guaranteed solvable across all pools)
  const fallbackLen: ChangeItWordLength = lengths[0] ?? 4;
  const fallbacks: Record<ChangeItWordLength, [string, string]> = {
    3: ['CAT', 'DOG'],
    4: ['COLD', 'WARM'],
    5: ['STONE', 'CROWN'],
    6: ['WINTER', 'SUMMER'],
  };
  const [fbStart, fbTarget] = fallbacks[fallbackLen];
  const valRes = bfsShortestPath(engineData.validationGraphs[fallbackLen], fbStart, fbTarget);
  const puzRes = bfsShortestPath(engineData.puzzleGraphs[fallbackLen], fbStart, fbTarget);

  let restrictions = createEmptyRestriction();
  let minM = valRes.solvable ? valRes.minMoves : 4;
  let famM = puzRes.solvable ? puzRes.minMoves : minM;

  if (options.restricted) {
    const attached = attachVerifiedRestriction(
      engineData,
      fallbackLen,
      fbStart,
      fbTarget,
      options.difficulty
    );
    if (attached) {
      restrictions = attached.restrictions;
      minM = attached.minMoves;
      famM = attached.familiarMinMoves;
    }
  }

  return {
    startWord: fbStart,
    targetWord: fbTarget,
    canonicalKey: canonicalPuzzleKey(fbStart, fbTarget),
    wordLength: fallbackLen,
    minMoves: minM,
    familiarMinMoves: famM,
    difficulty: options.difficulty,
    restrictions,
  };
}

function attachVerifiedRestriction(
  engineData: ChangeItEngineData,
  wordLength: ChangeItWordLength,
  startWord: string,
  targetWord: string,
  difficulty: ChangeItDifficulty
): { restrictions: ChangeItRestriction; minMoves: number; familiarMinMoves: number } | null {
  const puzGraph = engineData.puzzleGraphs[wordLength];
  const valGraph = engineData.validationGraphs[wordLength];

  // Try locking a position where startWord and targetWord already agree (so target remains reachable)
  const matchingPositions: number[] = [];
  for (let i = 0; i < wordLength; i++) {
    if (startWord[i] === targetWord[i]) matchingPositions.push(i);
  }

  const strategies: Array<() => ChangeItRestriction> = [];
  if (matchingPositions.length > 0) {
    for (const pos of matchingPositions) {
      strategies.push(() => ({
        lockedPositions: [pos],
        forbiddenLetters: [],
        noConsecutiveSamePosition: false,
        nextMoveLockedPosition: null,
      }));
    }
  }

  // Alternating position constraint
  strategies.push(() => ({
    lockedPositions: [],
    forbiddenLetters: [],
    noConsecutiveSamePosition: true,
    nextMoveLockedPosition: null,
  }));

  // Forbidden infrequent letters not in targetWord
  const forbiddenPool = ['Q', 'Z', 'X', 'J', 'K', 'V'].filter(
    (ch) => !startWord.includes(ch) && !targetWord.includes(ch)
  );
  if (forbiddenPool.length > 0) {
    strategies.push(() => ({
      lockedPositions: [],
      forbiddenLetters: [forbiddenPool[0]],
      noConsecutiveSamePosition: difficulty === 'hard' || difficulty === 'expert' || difficulty === 'master',
      nextMoveLockedPosition: null,
    }));
  }

  // Shuffle strategies
  const shuffled = [...strategies].sort(() => Math.random() - 0.5);
  for (const build of shuffled) {
    const r = build();
    const bfsOpts = {
      lockedPositions: new Set(r.lockedPositions),
      forbiddenLetters: new Set(r.forbiddenLetters),
      noConsecutiveSamePosition: r.noConsecutiveSamePosition,
    };
    const puzRes = bfsShortestPath(puzGraph, startWord, targetWord, bfsOpts);
    if (!puzRes.solvable || puzRes.minMoves < 2) continue;
    const valRes = bfsShortestPath(valGraph, startWord, targetWord, bfsOpts);
    if (!valRes.solvable || valRes.minMoves < 2) continue;
    return {
      restrictions: r,
      minMoves: valRes.minMoves,
      familiarMinMoves: puzRes.minMoves,
    };
  }
  return null;
}

/**
 * Extends a Survival chain from `fromWord` to a verified reachable familiar target
 * so the completed target becomes the next starting word seamlessly.
 */
export function extendSurvivalChain(
  engineData: ChangeItEngineData,
  fromWord: string,
  wordLength: ChangeItWordLength,
  minMoves: number,
  maxMoves: number,
  usedCanonicalKeys: ReadonlySet<string>,
  recentWords: ReadonlySet<string>
): { targetWord: string; minMoves: number; canonicalKey: string } {
  const puzGraph = engineData.puzzleGraphs[wordLength];
  const valGraph = engineData.validationGraphs[wordLength];
  const puzDist = computeBfsDistancesFrom(puzGraph, fromWord);

  const candidates: Array<{ word: string; dist: number }> = [];
  const relaxed: Array<{ word: string; dist: number }> = [];
  const anyReachable: Array<{ word: string; dist: number }> = [];

  for (let i = 0; i < puzDist.length; i++) {
    const d = puzDist[i];
    if (d < 2) continue;
    const w = puzGraph.words[i];
    if (w === fromWord) continue;
    const cKey = canonicalPuzzleKey(fromWord, w);
    if (d >= minMoves && d <= maxMoves) {
      if (!usedCanonicalKeys.has(cKey) && !recentWords.has(w)) {
        candidates.push({ word: w, dist: d });
      } else if (!usedCanonicalKeys.has(cKey)) {
        relaxed.push({ word: w, dist: d });
      } else {
        anyReachable.push({ word: w, dist: d });
      }
    } else if (d >= 2 && d <= maxMoves + 3) {
      anyReachable.push({ word: w, dist: d });
    }
  }

  const pool =
    candidates.length > 0 ? candidates : relaxed.length > 0 ? relaxed : anyReachable;

  for (let i = 0; i < Math.min(12, pool.length); i++) {
    const pick = pickRandom(pool);
    const valRes = bfsShortestPath(valGraph, fromWord, pick.word);
    if (valRes.solvable && valRes.minMoves >= 2) {
      return {
        targetWord: pick.word,
        minMoves: valRes.minMoves,
        canonicalKey: canonicalPuzzleKey(fromWord, pick.word),
      };
    }
  }

  // Fallback: pick any reachable familiar word in same component
  for (let i = 0; i < puzDist.length; i++) {
    if (puzDist[i] >= 2) {
      const w = puzGraph.words[i];
      const valRes = bfsShortestPath(valGraph, fromWord, w);
      if (valRes.solvable) {
        return {
          targetWord: w,
          minMoves: valRes.minMoves,
          canonicalKey: canonicalPuzzleKey(fromWord, w),
        };
      }
    }
  }

  throw new Error(`Unable to extend ChangeIt survival chain from ${fromWord}`);
}

/**
 * Picks a mathematically verified equivalent Reroute target from `currentWord`
 * avoiding `usedWords` and respecting active locks/restrictions.
 * Ensures remaining distance is >= Math.max(2, currentRemainingMoves) so Reroute
 * never grants an unfair 0- or 1-move victory.
 */
export function findEquivalentRerouteTarget(
  engineData: ChangeItEngineData,
  currentWord: string,
  previousTarget: string,
  requiredMinRemaining: number,
  usedWords: ReadonlySet<string>,
  lockedPositions: ReadonlySet<number>,
  forbiddenLetters: ReadonlySet<string>
): { targetWord: string; minMoves: number } | null {
  const len = currentWord.length as ChangeItWordLength;
  const puzGraph = engineData.puzzleGraphs[len];
  const valGraph = engineData.validationGraphs[len];
  if (!puzGraph || !valGraph) return null;

  const targetDist = Math.max(2, requiredMinRemaining);
  const puzDist = computeBfsDistancesFrom(puzGraph, currentWord, {
    excludedWords: usedWords,
    lockedPositions,
    forbiddenLetters,
  });

  const exactMatches: string[] = [];
  const closeMatches: string[] = [];

  for (let i = 0; i < puzDist.length; i++) {
    const d = puzDist[i];
    if (d < 2) continue;
    const w = puzGraph.words[i];
    if (w === currentWord || w === previousTarget || usedWords.has(w)) continue;
    if (d === targetDist) exactMatches.push(w);
    else if (d >= targetDist && d <= targetDist + 2) closeMatches.push(w);
  }

  const pool = exactMatches.length > 0 ? exactMatches : closeMatches;
  if (pool.length === 0) return null;

  for (let attempt = 0; attempt < Math.min(12, pool.length); attempt++) {
    const cand = pickRandom(pool);
    const valRes = bfsShortestPath(valGraph, currentWord, cand, {
      excludedWords: usedWords,
      lockedPositions,
      forbiddenLetters,
    });
    if (valRes.solvable && valRes.minMoves >= Math.max(2, targetDist - 1)) {
      return { targetWord: cand, minMoves: valRes.minMoves };
    }
  }

  return null;
}
