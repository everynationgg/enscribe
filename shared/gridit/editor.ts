import { assignDeterministicDieOrientations, DEFAULT_GRIDIT_SCORING, findBoardWords } from './engine.js';
import { BoardFairnessReport, analyzeBoardFairness } from './fairness.js';
import { evaluateQuotaProgress, GridItQuotaEvaluation } from './quotas.js';
import { buildShapeTopology } from './shapes.js';
import {
  GridItBoard,
  GridItBoardSize,
  GridItScoringConfig,
  GridItShapeId,
  GridItTileNode,
} from './types.js';

export interface GridItAuthoredWord {
  id: string;
  word: string;
  tilePath: string[];
}

export interface GridItCustomTemplate {
  id: string;
  name: string;
  shapeId: GridItShapeId;
  sizeId: GridItBoardSize;
  language: string;
  authoredTiles: Record<string, string>;
  authoredWords: GridItAuthoredWord[];
  ownerId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GridItTemplateValidationResult {
  valid: boolean;
  errors: string[];
  quotaProgress: GridItQuotaEvaluation;
  validAuthoredWordCount: number;
}

export interface PlaceWordCheckResult {
  ok: boolean;
  normalizedWord: string;
  reason?: string;
}

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const FILL_VOWELS = 'AAAAAEEEEEEEIIIIIOOOOUU';
const FILL_CONSONANTS = 'BCDDFGGHLLLMNNNNPRRSSSTTTTWY';

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

/**
 * Validates whether a proposed manual word placement matches the traced path,
 * respects adjacency/non-reuse, exists in the dictionary, and agrees with any
 * previously authored letters at shared intersections.
 */
export function canPlaceWordOnTemplate(
  shapeId: GridItShapeId,
  sizeId: GridItBoardSize,
  authoredTiles: Record<string, string>,
  existingWords: GridItAuthoredWord[],
  word: string,
  tilePath: string[],
  dictionary: Set<string>
): PlaceWordCheckResult {
  const cleanWord = word.trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (cleanWord.length < DEFAULT_GRIDIT_SCORING.minWordLength) {
    return {
      ok: false,
      normalizedWord: cleanWord,
      reason: `Words must be at least ${DEFAULT_GRIDIT_SCORING.minWordLength} letters long.`,
    };
  }
  if (!dictionary.has(cleanWord)) {
    return {
      ok: false,
      normalizedWord: cleanWord,
      reason: `"${cleanWord}" is not in the active dictionary.`,
    };
  }
  if (existingWords.some((w) => w.word.toUpperCase() === cleanWord)) {
    return {
      ok: false,
      normalizedWord: cleanWord,
      reason: `"${cleanWord}" is already authored on this template.`,
    };
  }
  if (tilePath.length !== cleanWord.length) {
    return {
      ok: false,
      normalizedWord: cleanWord,
      reason: `Path length (${tilePath.length}) must match "${cleanWord}" (${cleanWord.length} letters).`,
    };
  }

  const topo = buildShapeTopology(shapeId, sizeId);
  const byId = new Map(topo.tiles.map((t) => [t.id, t]));
  const seen = new Set<string>();

  for (let i = 0; i < tilePath.length; i++) {
    const id = tilePath[i];
    const node = byId.get(id);
    if (!node) {
      return { ok: false, normalizedWord: cleanWord, reason: 'Path references invalid board tile.' };
    }
    if (seen.has(id)) {
      return {
        ok: false,
        normalizedWord: cleanWord,
        reason: 'A word cannot reuse the same tile twice.',
      };
    }
    if (i > 0) {
      const prev = byId.get(tilePath[i - 1])!;
      if (!prev.neighbors.includes(id)) {
        return {
          ok: false,
          normalizedWord: cleanWord,
          reason: 'Letters must be placed along adjacent touching neighbors.',
        };
      }
    }
    seen.add(id);

    const existingChar = authoredTiles[id]?.trim().toUpperCase();
    if (existingChar && existingChar !== cleanWord[i]) {
      return {
        ok: false,
        normalizedWord: cleanWord,
        reason: `Intersection conflict at tile ${id}: already holds "${existingChar}", cannot set "${cleanWord[i]}".`,
      };
    }
  }

  return { ok: true, normalizedWord: cleanWord };
}

/**
 * Strictly validates an entire custom template before saving or Board Battle lock-in.
 */
export function validateCustomTemplate(
  template: GridItCustomTemplate,
  dictionary: Set<string>
): GridItTemplateValidationResult {
  const errors: string[] = [];
  const topo = buildShapeTopology(template.shapeId, template.sizeId);
  const byId = new Map(topo.tiles.map((t) => [t.id, t]));

  for (const [tileId, rawLetter] of Object.entries(template.authoredTiles || {})) {
    if (!byId.has(tileId)) {
      errors.push(`Unknown tile ID "${tileId}" for ${template.shapeId}/${template.sizeId}.`);
    } else if (!/^[A-Z]$/.test(rawLetter.trim().toUpperCase())) {
      errors.push(`Tile "${tileId}" has invalid letter "${rawLetter}".`);
    }
  }

  const validWords: string[] = [];
  const seenWords = new Set<string>();

  for (const entry of template.authoredWords || []) {
    const wordUpper = entry.word.trim().toUpperCase();
    if (wordUpper.length < DEFAULT_GRIDIT_SCORING.minWordLength) {
      errors.push(`Word "${wordUpper}" is shorter than ${DEFAULT_GRIDIT_SCORING.minWordLength} letters.`);
      continue;
    }
    if (!dictionary.has(wordUpper)) {
      errors.push(`Word "${wordUpper}" is not valid in dictionary.`);
      continue;
    }
    if (seenWords.has(wordUpper)) {
      errors.push(`Duplicate authored word "${wordUpper}".`);
      continue;
    }
    if (!Array.isArray(entry.tilePath) || entry.tilePath.length !== wordUpper.length) {
      errors.push(`Word "${wordUpper}" path length does not match its letters.`);
      continue;
    }

    const visited = new Set<string>();
    let pathOk = true;
    for (let i = 0; i < entry.tilePath.length; i++) {
      const tid = entry.tilePath[i];
      const node = byId.get(tid);
      if (!node || visited.has(tid)) {
        errors.push(`Word "${wordUpper}" uses invalid or repeated tiles.`);
        pathOk = false;
        break;
      }
      if (i > 0 && !byId.get(entry.tilePath[i - 1])!.neighbors.includes(tid)) {
        errors.push(`Word "${wordUpper}" skips across non-adjacent tiles.`);
        pathOk = false;
        break;
      }
      const placed = template.authoredTiles[tid]?.trim().toUpperCase();
      if (placed !== wordUpper[i]) {
        errors.push(`Word "${wordUpper}" conflicts with letter on tile ${tid}.`);
        pathOk = false;
        break;
      }
      visited.add(tid);
    }

    if (pathOk) {
      seenWords.add(wordUpper);
      validWords.push(wordUpper);
    }
  }

  const quotaProgress = evaluateQuotaProgress(validWords, template.shapeId, template.sizeId);
  if (!quotaProgress.allMet) {
    const unmet = quotaProgress.items
      .filter((q) => !q.met)
      .map((q) => `${q.label} (${q.found}/${q.required})`)
      .join(', ');
    errors.push(`Remaining word quotas: ${unmet}.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    quotaProgress,
    validAuthoredWordCount: validWords.length,
  };
}

/**
 * Rebuilds a preview board directly from a custom template WITHOUT filling empty slots
 * (used by Board Editor to show recessed unfilled sockets).
 */
export function buildEditorPreviewBoard(template: GridItCustomTemplate): GridItBoard {
  const topo = buildShapeTopology(template.shapeId, template.sizeId);
  const tiles: GridItTileNode[] = topo.tiles.map((node) => ({
    ...node,
    letter: (template.authoredTiles[node.id] || '').toUpperCase(),
    isAuthored: Boolean(template.authoredTiles[node.id]),
  }));

  return {
    id: template.id || `editor_${template.shapeId}_${template.sizeId}`,
    shapeId: template.shapeId,
    sizeId: template.sizeId,
    language: template.language || 'en',
    tiles,
    bounds: topo.bounds,
    tileRadius: topo.tileRadius,
    seed: 1,
  };
}

export interface CompletedTemplateResult {
  board: GridItBoard;
  fairness: BoardFairnessReport;
  filledCount: number;
}

/**
 * Completes all unfilled tiles in a custom template BEFORE board reveal & shake.
 * Strictly preserves 100% of authored letters and fills remaining nodes with
 * dictionary-aware balanced letters (optionally incorporating server-side AI hints).
 */
export function completeBoardFromTemplate(
  template: GridItCustomTemplate,
  options: {
    seed?: number;
    dictionary: Set<string>;
    prefixSet: Set<string>;
    scoringConfig?: GridItScoringConfig;
    aiSuggestedLetters?: Record<string, string>;
    stripAuthoredFlag?: boolean;
  }
): CompletedTemplateResult {
  const baseSeed = options.seed ?? Math.floor(Math.random() * 0x7fffffff);
  const topo = buildShapeTopology(template.shapeId, template.sizeId);
  const authoredMap = template.authoredTiles || {};
  const unfilledIds = topo.tiles
    .map((t) => t.id)
    .filter((id) => !authoredMap[id] || !/^[A-Z]$/i.test(authoredMap[id]));

  const authoredLetters = Object.values(authoredMap).map((l) => l.toUpperCase());
  const existingVowels = authoredLetters.filter((l) => VOWELS.has(l)).length;
  const totalCount = topo.tiles.length;
  const targetVowels = Math.max(4, Math.round(totalCount * 0.39));
  const neededVowels = Math.max(0, Math.min(unfilledIds.length, targetVowels - existingVowels));

  let bestResult: CompletedTemplateResult | null = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < 8; attempt++) {
    const seed = (baseSeed + attempt * 1664525 + 1013904223) >>> 0;
    const rand = mulberry32(seed);
    const fillLetters: string[] = [];

    for (let i = 0; i < neededVowels; i++) {
      fillLetters.push(FILL_VOWELS[Math.floor(rand() * FILL_VOWELS.length)]);
    }
    while (fillLetters.length < unfilledIds.length) {
      fillLetters.push(FILL_CONSONANTS[Math.floor(rand() * FILL_CONSONANTS.length)]);
    }

    // Shuffle filler letters deterministically
    for (let i = fillLetters.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [fillLetters[i], fillLetters[j]] = [fillLetters[j], fillLetters[i]];
    }

    const fillById = new Map<string, string>();
    unfilledIds.forEach((id, idx) => {
      const aiPick = attempt === 0 ? options.aiSuggestedLetters?.[id]?.trim().toUpperCase() : undefined;
      if (aiPick && /^[A-Z]$/.test(aiPick)) {
        fillById.set(id, aiPick);
      } else {
        fillById.set(id, fillLetters[idx]);
      }
    });

    const rawTiles: GridItTileNode[] = topo.tiles.map((t) => {
      const authored = authoredMap[t.id]?.trim().toUpperCase();
      if (authored && /^[A-Z]$/.test(authored)) {
        return {
          ...t,
          letter: authored,
          isAuthored: options.stripAuthoredFlag ? undefined : true,
        };
      }
      return {
        ...t,
        letter: fillById.get(t.id) || 'E',
        isAuthored: options.stripAuthoredFlag ? undefined : false,
      };
    });

    const board: GridItBoard = {
      id: `tpl_${template.id || 'custom'}_${seed.toString(36)}`,
      shapeId: template.shapeId,
      sizeId: template.sizeId,
      language: template.language || 'en',
      tiles: assignDeterministicDieOrientations(rawTiles, seed),
      bounds: topo.bounds,
      tileRadius: topo.tileRadius,
      seed,
    };

    const sample = findBoardWords(board, options.dictionary, options.prefixSet, {
      maxWords: 55,
      maxVisits: 4500,
    });
    const fairness = analyzeBoardFairness(
      board,
      options.dictionary,
      options.prefixSet,
      options.scoringConfig
    );

    if (fairness.wordCount > bestScore) {
      bestScore = fairness.wordCount;
      bestResult = { board, fairness, filledCount: unfilledIds.length };
    }
    if (sample.length >= 26) {
      break;
    }
  }

  return bestResult!;
}
