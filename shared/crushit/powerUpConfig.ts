import {
  BoardCoord,
  CrushItBoardGrid,
  PowerUpInventory,
  PowerUpTarget,
  PowerUpType,
} from './types.js';

export interface PowerUpDefinition {
  type: PowerUpType;
  name: string;
  shortName: string;
  minWordLength: number;
  moveCost: number;
  maxStack: number;
  requiresOrientation: boolean;
  description: string;
  accentColor: string;
}

export const POWER_UP_ORDER: PowerUpType[] = [
  'line_blast',
  'cross_blast',
  'word_bomb',
  'letter_purge',
  'mega_blast',
];

/**
 * Configurable word-length-based power-up definitions.
 * Earned strictly by submitted word length (never geometric shape):
 * - 3 letters: Normal Clear (no power-up)
 * - 4 letters: Line Blast
 * - 5 letters: Cross Blast
 * - 6 letters: Word Bomb
 * - 7 letters: Letter Purge
 * - 8+ letters: Mega Blast
 */
export const POWER_UP_CONFIG: Record<PowerUpType, PowerUpDefinition> = {
  line_blast: {
    type: 'line_blast',
    name: 'Line Blast',
    shortName: 'Line',
    minWordLength: 4,
    moveCost: 0,
    maxStack: 9,
    requiresOrientation: true,
    description: 'Clears an entire selected row or column.',
    accentColor: '#38bdf8',
  },
  cross_blast: {
    type: 'cross_blast',
    name: 'Cross Blast',
    shortName: 'Cross',
    minWordLength: 5,
    moveCost: 0,
    maxStack: 9,
    requiresOrientation: false,
    description: 'Clears both the row and column intersecting your chosen tile.',
    accentColor: '#a855f7',
  },
  word_bomb: {
    type: 'word_bomb',
    name: 'Word Bomb',
    shortName: 'Bomb',
    minWordLength: 6,
    moveCost: 0,
    maxStack: 9,
    requiresOrientation: false,
    description: 'Detonates a 3 × 3 blast centered on the chosen tile.',
    accentColor: '#f43f5e',
  },
  letter_purge: {
    type: 'letter_purge',
    name: 'Letter Purge',
    shortName: 'Purge',
    minWordLength: 7,
    moveCost: 0,
    maxStack: 9,
    requiresOrientation: false,
    description: 'Destroys every occurrence of the chosen letter across the board.',
    accentColor: '#10b981',
  },
  mega_blast: {
    type: 'mega_blast',
    name: 'Mega Blast',
    shortName: 'Mega',
    minWordLength: 8,
    moveCost: 0,
    maxStack: 9,
    requiresOrientation: false,
    description: 'Unleashes a massive 5 × 5 blast plus shockwave rays across the board.',
    accentColor: '#fbbf24',
  },
};

export function createEmptyInventory(
  seed?: Partial<PowerUpInventory>
): PowerUpInventory {
  return {
    line_blast: seed?.line_blast ?? 0,
    cross_blast: seed?.cross_blast ?? 0,
    word_bomb: seed?.word_bomb ?? 0,
    letter_purge: seed?.letter_purge ?? 0,
    mega_blast: seed?.mega_blast ?? 0,
  };
}

/**
 * Returns ONLY the single highest applicable power-up for a valid word length.
 * 3-letter words yield null (Normal Clear).
 */
export function getEarnedPowerUpForWordLength(wordLength: number): PowerUpType | null {
  if (wordLength >= 8) return 'mega_blast';
  if (wordLength === 7) return 'letter_purge';
  if (wordLength === 6) return 'word_bomb';
  if (wordLength === 5) return 'cross_blast';
  if (wordLength === 4) return 'line_blast';
  return null;
}

/**
 * Computes the exact board coordinates affected by a power-up target.
 * Shared by both targeting preview UI and the execution engine.
 */
export function getPowerUpAffectedCoords(
  board: CrushItBoardGrid,
  target: PowerUpTarget
): BoardCoord[] {
  const rows = board.length;
  const cols = rows > 0 ? board[0].length : 0;
  if (target.row < 0 || target.row >= rows || target.col < 0 || target.col >= cols) {
    return [];
  }

  const seen = new Set<string>();
  const coords: BoardCoord[] = [];
  const add = (r: number, c: number) => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    const key = `${r},${c}`;
    if (seen.has(key)) return;
    seen.add(key);
    coords.push({ row: r, col: c });
  };

  switch (target.type) {
    case 'line_blast': {
      const orientation = target.orientation ?? 'row';
      if (orientation === 'col') {
        for (let r = 0; r < rows; r++) add(r, target.col);
      } else {
        for (let c = 0; c < cols; c++) add(target.row, c);
      }
      break;
    }

    case 'cross_blast': {
      for (let c = 0; c < cols; c++) add(target.row, c);
      for (let r = 0; r < rows; r++) add(r, target.col);
      break;
    }

    case 'word_bomb': {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          add(target.row + dr, target.col + dc);
        }
      }
      break;
    }

    case 'letter_purge': {
      const targetTile = board[target.row]?.[target.col];
      if (!targetTile) break;
      const letter = targetTile.letter.toUpperCase();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (board[r][c].letter.toUpperCase() === letter) {
            add(r, c);
          }
        }
      }
      break;
    }

    case 'mega_blast': {
      // 5x5 core explosion centered on target + full cross shockwave rays
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          add(target.row + dr, target.col + dc);
        }
      }
      for (let c = 0; c < cols; c++) add(target.row, c);
      for (let r = 0; r < rows; r++) add(r, target.col);
      break;
    }
  }

  return coords;
}
