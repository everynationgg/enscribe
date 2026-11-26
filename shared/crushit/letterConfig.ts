import { LetterCategory, TileColor } from './types.js';

export interface CategoryDistributionConfig {
  category: LetterCategory;
  color: TileColor;
  /** Target probability percentage (all categories should sum to 100). */
  categoryWeight: number;
  /** Intra-category relative letter weights based on English frequency & playability. */
  letters: Record<string, number>;
}

/**
 * Configurable weighted letter distribution for CrushIt.
 *
 * Category probabilities:
 * - Vowels (PINK): 40%
 * - Common consonants (BLUE): 40%
 * - Uncommon consonants (GREEN): 15%
 * - Rare consonants (GOLD): 5%
 *
 * Tile colors are strictly deterministic by category and NEVER randomly assigned.
 */
export const CRUSHIT_LETTER_DISTRIBUTION: CategoryDistributionConfig[] = [
  {
    category: 'vowel',
    color: 'pink',
    categoryWeight: 40,
    letters: {
      E: 28,
      A: 24,
      I: 19,
      O: 18,
      U: 11,
    },
  },
  {
    category: 'common',
    color: 'blue',
    categoryWeight: 40,
    letters: {
      T: 14,
      R: 14,
      S: 14,
      N: 13,
      L: 11,
      D: 10,
      H: 8,
      C: 8,
      M: 8,
    },
  },
  {
    category: 'uncommon',
    color: 'green',
    categoryWeight: 15,
    letters: {
      P: 17,
      G: 16,
      B: 15,
      F: 14,
      W: 13,
      Y: 13,
      K: 7,
      V: 5,
    },
  },
  {
    category: 'rare',
    color: 'gold',
    categoryWeight: 5,
    letters: {
      J: 30,
      X: 28,
      Z: 24,
      Q: 18,
    },
  },
];

export const CATEGORY_COLOR_MAP: Record<LetterCategory, TileColor> = {
  vowel: 'pink',
  common: 'blue',
  uncommon: 'green',
  rare: 'gold',
};

/**
 * Base scoring value per letter. Rare & uncommon consonants award significantly
 * more base points to reward weaving harder letters into words.
 */
export const LETTER_BASE_POINTS: Record<string, number> = {
  // Vowels (PINK)
  A: 10,
  E: 10,
  I: 10,
  O: 10,
  U: 14,
  // Common consonants (BLUE)
  R: 12,
  S: 12,
  T: 12,
  N: 12,
  L: 14,
  D: 14,
  H: 16,
  C: 16,
  M: 16,
  // Uncommon consonants (GREEN)
  B: 22,
  F: 24,
  G: 22,
  K: 28,
  P: 22,
  V: 28,
  W: 26,
  Y: 24,
  // Rare consonants (GOLD)
  J: 45,
  Q: 55,
  X: 48,
  Z: 50,
};

const LETTER_CATEGORY_LOOKUP: Record<string, LetterCategory> = {};
for (const group of CRUSHIT_LETTER_DISTRIBUTION) {
  for (const letter of Object.keys(group.letters)) {
    LETTER_CATEGORY_LOOKUP[letter] = group.category;
  }
}

export function getLetterCategory(letter: string): LetterCategory {
  const upper = letter.trim().toUpperCase();
  return LETTER_CATEGORY_LOOKUP[upper] ?? 'common';
}

export function getLetterColor(letter: string): TileColor {
  return CATEGORY_COLOR_MAP[getLetterCategory(letter)];
}

export function getLetterBasePoints(letter: string): number {
  const upper = letter.trim().toUpperCase();
  return LETTER_BASE_POINTS[upper] ?? 12;
}

export function isVowelLetter(letter: string): boolean {
  return getLetterCategory(letter) === 'vowel';
}

interface CumulativeLetterEntry {
  letter: string;
  category: LetterCategory;
  color: TileColor;
  cumulativeWeight: number;
}

function buildCumulativeTable(
  config: CategoryDistributionConfig[]
): { entries: CumulativeLetterEntry[]; totalWeight: number } {
  const entries: CumulativeLetterEntry[] = [];
  let running = 0;

  for (const group of config) {
    const letterEntries = Object.entries(group.letters);
    const intraSum = letterEntries.reduce((acc, [, w]) => acc + w, 0);
    if (intraSum <= 0 || group.categoryWeight <= 0) continue;

    for (const [letter, intraWeight] of letterEntries) {
      const effectiveWeight = (group.categoryWeight * intraWeight) / intraSum;
      running += effectiveWeight;
      entries.push({
        letter,
        category: group.category,
        color: group.color,
        cumulativeWeight: running,
      });
    }
  }

  return { entries, totalWeight: running };
}

const DEFAULT_CUMULATIVE_TABLE = buildCumulativeTable(CRUSHIT_LETTER_DISTRIBUTION);

export interface WeightedLetterSample {
  letter: string;
  category: LetterCategory;
  color: TileColor;
}

/**
 * Generates a single weighted-random letter according to CRUSHIT_LETTER_DISTRIBUTION.
 */
export function sampleWeightedLetter(
  rng: () => number = Math.random,
  customConfig?: CategoryDistributionConfig[]
): WeightedLetterSample {
  const table = customConfig ? buildCumulativeTable(customConfig) : DEFAULT_CUMULATIVE_TABLE;
  const roll = Math.min(0.999999999, Math.max(0, rng())) * table.totalWeight;

  let lo = 0;
  let hi = table.entries.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (table.entries[mid].cumulativeWeight < roll) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  const picked = table.entries[lo] ?? table.entries[table.entries.length - 1];
  return {
    letter: picked.letter,
    category: picked.category,
    color: picked.color,
  };
}
