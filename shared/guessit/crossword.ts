import { isEnglishUpperLetter, normalizeGuessItText } from './normalize.js';
import {
  GuessItCategory,
  GuessItCrosswordCell,
  GuessItCrosswordCellView,
  GuessItCrosswordEntryPlacement,
  GuessItCrosswordLayout,
  GuessItCrosswordView,
} from './types.js';

interface GridSlot {
  row: number;
  col: number;
  kind: 'letter' | 'space' | 'punct';
  letter: string | null;
  entryIds: string[];
}

function keyOf(r: number, c: number): string {
  return `${r},${c}`;
}

function sortUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

/**
 * Validates every intersection, connectivity across all entries, and ensures spaces/punctuation
 * NEVER form intersections in the crossword grid.
 */
export function validateCrosswordLayout(layout: GuessItCrosswordLayout): boolean {
  if (!layout || layout.entries.length < 2 || layout.cells.length === 0) return false;

  const cellMap = new Map<string, GuessItCrosswordCell>();
  for (const cell of layout.cells) {
    cellMap.set(keyOf(cell.row, cell.col), cell);
    if (cell.entryIds.length > 1) {
      if (cell.kind !== 'letter' || !cell.letter || !isEnglishUpperLetter(cell.letter)) {
        return false; // Spaces and punctuation must NEVER serve as intersections
      }
    }
  }

  // Verify every entry's characters align with cells and all entries are connected
  const adjacency = new Map<string, Set<string>>();
  for (const entry of layout.entries) {
    adjacency.set(entry.entryId, new Set());
    const dr = entry.direction === 'down' ? 1 : 0;
    const dc = entry.direction === 'across' ? 1 : 0;
    for (let i = 0; i < entry.answer.length; i++) {
      const r = entry.row + i * dr;
      const c = entry.col + i * dc;
      const cell = cellMap.get(keyOf(r, c));
      if (!cell) return false;
      const expected = entry.answer[i];
      if (expected === ' ') {
        if (cell.kind !== 'space' || cell.entryIds.length !== 1) return false;
      } else if (isEnglishUpperLetter(expected)) {
        if (cell.kind !== 'letter' || cell.letter !== expected) return false;
      } else {
        if (cell.kind !== 'punct' || cell.letter !== expected || cell.entryIds.length !== 1) {
          return false;
        }
      }
      if (cell.entryIds.length > 1) {
        for (const otherId of cell.entryIds) {
          if (otherId !== entry.entryId) {
            adjacency.get(entry.entryId)!.add(otherId);
          }
        }
      }
    }
  }

  // BFS connectivity check across all placed entries
  const startId = layout.entries[0].entryId;
  const visited = new Set<string>([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adjacency.get(cur) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return visited.size === layout.entries.length;
}

interface PlacedRecord {
  entryId: string;
  answer: string;
  direction: 'across' | 'down';
  row: number;
  col: number;
}

function canPlaceEntry(
  grid: Map<string, GridSlot>,
  answer: string,
  row: number,
  col: number,
  direction: 'across' | 'down',
  requireIntersection: boolean
): { valid: boolean; intersections: number } {
  const dr = direction === 'down' ? 1 : 0;
  const dc = direction === 'across' ? 1 : 0;

  // Before-start and after-end caps must be empty so words don't run into neighbors
  if (grid.has(keyOf(row - dr, col - dc))) return { valid: false, intersections: 0 };
  if (grid.has(keyOf(row + answer.length * dr, col + answer.length * dc))) {
    return { valid: false, intersections: 0 };
  }

  let intersections = 0;

  for (let i = 0; i < answer.length; i++) {
    const r = row + i * dr;
    const c = col + i * dc;
    const ch = answer[i];
    const kind: GridSlot['kind'] =
      ch === ' ' ? 'space' : isEnglishUpperLetter(ch) ? 'letter' : 'punct';
    const existing = grid.get(keyOf(r, c));

    if (existing) {
      // Strictly disallow intersections on spaces/punctuation or mismatching letters or parallel overlap
      if (kind !== 'letter' || existing.kind !== 'letter' || existing.letter !== ch) {
        return { valid: false, intersections: 0 };
      }
      if (existing.entryIds.length > 1) {
        return { valid: false, intersections: 0 };
      }
      // Make sure existing slot didn't already belong to same direction
      const prevCell = grid.get(keyOf(r - dr, c - dc));
      const nextCell = grid.get(keyOf(r + dr, c + dc));
      if (
        (prevCell && prevCell.entryIds.some((id) => existing.entryIds.includes(id))) ||
        (nextCell && nextCell.entryIds.some((id) => existing.entryIds.includes(id)))
      ) {
        return { valid: false, intersections: 0 };
      }
      intersections++;
    } else {
      // Non-intersection cell must not touch parallel adjacent occupied cells orthogonally
      const sideA = grid.get(keyOf(r + dc, c + dr));
      const sideB = grid.get(keyOf(r - dc, c - dr));
      if (sideA || sideB) {
        return { valid: false, intersections: 0 };
      }
    }
  }

  if (requireIntersection && intersections < 1) {
    return { valid: false, intersections: 0 };
  }

  return { valid: true, intersections };
}

function applyEntryToGrid(
  grid: Map<string, GridSlot>,
  record: PlacedRecord
): void {
  const dr = record.direction === 'down' ? 1 : 0;
  const dc = record.direction === 'across' ? 1 : 0;
  for (let i = 0; i < record.answer.length; i++) {
    const r = record.row + i * dr;
    const c = record.col + i * dc;
    const ch = record.answer[i];
    const kind: GridSlot['kind'] =
      ch === ' ' ? 'space' : isEnglishUpperLetter(ch) ? 'letter' : 'punct';
    const k = keyOf(r, c);
    const existing = grid.get(k);
    if (existing) {
      existing.entryIds.push(record.entryId);
    } else {
      grid.set(k, {
        row: r,
        col: c,
        kind,
        letter: ch,
        entryIds: [record.entryId],
      });
    }
  }
}

function finalizeLayout(
  grid: Map<string, GridSlot>,
  placed: PlacedRecord[]
): GuessItCrosswordLayout | null {
  let minR = Infinity;
  let maxR = -Infinity;
  let minC = Infinity;
  let maxC = -Infinity;

  for (const slot of grid.values()) {
    if (slot.row < minR) minR = slot.row;
    if (slot.row > maxR) maxR = slot.row;
    if (slot.col < minC) minC = slot.col;
    if (slot.col > maxC) maxC = slot.col;
  }

  if (!Number.isFinite(minR)) return null;
  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;
  if (cols > 15 || rows > 16) return null;

  const uniqueSet = new Set<string>();
  let totalLetters = 0;

  const cells: GuessItCrosswordCell[] = Array.from(grid.values())
    .map((slot) => {
      if (slot.kind === 'letter' && slot.letter) {
        totalLetters++;
        uniqueSet.add(slot.letter);
      }
      return {
        row: slot.row - minR,
        col: slot.col - minC,
        kind: slot.kind,
        letter: slot.letter,
        entryIds: [...slot.entryIds],
        isIntersection: slot.entryIds.length > 1,
      };
    })
    .sort((a, b) => a.row - b.row || a.col - b.col);

  const entries: GuessItCrosswordEntryPlacement[] = placed.map((p) => ({
    entryId: p.entryId,
    answer: p.answer,
    direction: p.direction,
    row: p.row - minR,
    col: p.col - minC,
    length: p.answer.length,
  }));

  const layout: GuessItCrosswordLayout = {
    rows,
    cols,
    entries,
    cells,
    totalLetters,
    uniqueLetters: sortUnique(Array.from(uniqueSet)),
  };

  return validateCrosswordLayout(layout) ? layout : null;
}

/**
 * Generates an interconnected, intersection-validated crossword grid from 2-5 answers.
 * Only [A-Z] letters ever intersect; spaces and punctuation render as clear non-intersecting gaps.
 * Returns null if the given words cannot form a clean portrait-friendly connected layout.
 */
export function generateCrosswordLayout(
  rawEntries: string[],
  seed = 1
): GuessItCrosswordLayout | null {
  const clean = Array.from(
    new Set(rawEntries.map((e) => normalizeGuessItText(e)).filter((e) => e.length >= 3))
  ).slice(0, 5);

  if (clean.length < 2) return null;

  // Build candidate orderings anchored by different starter words so layout succeeds reliably
  const baseSorted = [...clean].sort((a, b) => b.length - a.length);
  const candidateOrders: string[][] = [];
  for (let startIdx = 0; startIdx < baseSorted.length; startIdx++) {
    const first = baseSorted[startIdx];
    const rest = baseSorted.filter((_, i) => i !== startIdx);
    candidateOrders.push([first, ...rest]);
    candidateOrders.push([first, ...[...rest].reverse()]);
  }

  let bestLayout: GuessItCrosswordLayout | null = null;
  let bestScore = Infinity;

  const tryPlaceRecursive = (
    order: string[],
    idx: number,
    grid: Map<string, GridSlot>,
    placed: PlacedRecord[]
  ) => {
    if (idx >= order.length) {
      const finalized = finalizeLayout(grid, placed);
      if (finalized) {
        const aspectPenalty = Math.max(0, finalized.cols - 12) * 40;
        const areaScore = finalized.rows * finalized.cols + aspectPenalty;
        if (areaScore < bestScore) {
          bestScore = areaScore;
          bestLayout = finalized;
        }
      }
      return;
    }

    const word = order[idx];
    const entryId = `cw_${idx + 1}`;
    const candidates: Array<{
      row: number;
      col: number;
      direction: 'across' | 'down';
      score: number;
    }> = [];

    for (const slot of grid.values()) {
      if (slot.kind !== 'letter' || !slot.letter) continue;
      for (let i = 0; i < word.length; i++) {
        if (word[i] !== slot.letter) continue;
        for (const direction of ['across', 'down'] as const) {
          const r = direction === 'down' ? slot.row - i : slot.row;
          const c = direction === 'across' ? slot.col - i : slot.col;
          const check = canPlaceEntry(grid, word, r, c, direction, true);
          if (check.valid) {
            // Compute tentative bounding box width penalty
            let minC = c;
            let maxC = direction === 'across' ? c + word.length - 1 : c;
            let minR = r;
            let maxR = direction === 'down' ? r + word.length - 1 : r;
            for (const s of grid.values()) {
              if (s.col < minC) minC = s.col;
              if (s.col > maxC) maxC = s.col;
              if (s.row < minR) minR = s.row;
              if (s.row > maxR) maxR = s.row;
            }
            const width = maxC - minC + 1;
            const height = maxR - minR + 1;
            if (width <= 13 && height <= 15) {
              const score =
                width * 6 +
                height * 3 -
                check.intersections * 8 +
                ((seed + i) % 3);
              candidates.push({ row: r, col: c, direction, score });
            }
          }
        }
      }
    }

    candidates.sort((a, b) => a.score - b.score);
    const branchCap = idx <= 2 ? 4 : 3;

    for (const cand of candidates.slice(0, branchCap)) {
      const nextGrid = new Map<string, GridSlot>();
      for (const [k, v] of grid.entries()) {
        nextGrid.set(k, { ...v, entryIds: [...v.entryIds] });
      }
      const rec: PlacedRecord = {
        entryId,
        answer: word,
        direction: cand.direction,
        row: cand.row,
        col: cand.col,
      };
      applyEntryToGrid(nextGrid, rec);
      tryPlaceRecursive(order, idx + 1, nextGrid, [...placed, rec]);
      if (bestLayout && bestScore < 70) return;
    }
  };

  for (const order of candidateOrders) {
    for (const firstDir of ['across', 'down'] as const) {
      const firstWord = order[0];
      if (firstDir === 'across' && firstWord.length > 13) continue;
      const grid = new Map<string, GridSlot>();
      const rec: PlacedRecord = {
        entryId: 'cw_1',
        answer: firstWord,
        direction: firstDir,
        row: 0,
        col: 0,
      };
      applyEntryToGrid(grid, rec);
      tryPlaceRecursive(order, 1, grid, [rec]);
      if (bestLayout && bestScore < 70) break;
    }
    if (bestLayout && bestScore < 70) break;
  }

  return bestLayout;
}

/**
 * Masks unrevealed letters in a crossword layout and always exposes spaces/punctuation cleanly.
 */
export function buildCrosswordClientView(
  layout: GuessItCrosswordLayout,
  category: GuessItCategory,
  guessedLetters: Set<string>,
  revealFull: boolean
): GuessItCrosswordView {
  let revealedLettersCount = 0;
  const cells: GuessItCrosswordCellView[] = layout.cells.map((cell) => {
    if (cell.kind === 'space' || cell.kind === 'punct') {
      return {
        row: cell.row,
        col: cell.col,
        kind: cell.kind,
        char: cell.letter,
        revealed: true,
        isIntersection: false,
        entryIds: cell.entryIds,
      };
    }

    const ch = cell.letter ?? '';
    const isShown = revealFull || guessedLetters.has(ch);
    if (isShown) revealedLettersCount++;
    return {
      row: cell.row,
      col: cell.col,
      kind: 'letter',
      char: isShown ? ch : null,
      revealed: isShown,
      isIntersection: cell.isIntersection,
      entryIds: cell.entryIds,
    };
  });

  return {
    format: 'crossword',
    category,
    rows: layout.rows,
    cols: layout.cols,
    cells,
    totalLetters: layout.totalLetters,
    revealedLettersCount,
    entryCount: layout.entries.length,
    solvedAnswers: revealFull ? layout.entries.map((e) => e.answer) : undefined,
  };
}

export function isCrosswordSolved(
  layout: GuessItCrosswordLayout,
  guessedLetters: Set<string>
): boolean {
  return (
    layout.uniqueLetters.length > 0 &&
    layout.uniqueLetters.every((letter) => guessedLetters.has(letter))
  );
}

export function countCrosswordLetterOccurrences(
  layout: GuessItCrosswordLayout,
  letter: string
): number {
  const upper = letter.toUpperCase();
  let count = 0;
  for (const cell of layout.cells) {
    if (cell.kind === 'letter' && cell.letter === upper) {
      count++;
    }
  }
  return count;
}
