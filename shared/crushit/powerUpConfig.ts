import {
  BoardCoord,
  CrushItBoardGrid,
  LineBlastOrientation,
  PowerUpTarget,
  PowerUpType,
  TilePowerUp,
} from './types.js';

export interface PowerUpDefinition {
  type: PowerUpType;
  name: string;
  shortName: string;
  minWordLength: number;
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
 * Configurable word-length-based integrated power-up definitions.
 * Earned strictly by submitted word length (never geometric shape):
 * - 3 letters: Normal Clear (no power-up)
 * - 4 letters: Line Blast (random horizontal or vertical orientation)
 * - 5 letters: Cross Blast (full row + full column)
 * - 6 letters: Word Bomb (3x3 area, max 9 tiles)
 * - 7 letters: Letter Purge (every tile sharing the power-up's letter)
 * - 8+ letters: Mega Blast (5x5 area, max 25 tiles)
 */
export const POWER_UP_CONFIG: Record<PowerUpType, PowerUpDefinition> = {
  line_blast: {
    type: 'line_blast',
    name: 'Line Blast',
    shortName: 'Line Tile',
    minWordLength: 4,
    description: 'Clears an entire row or column along its luminous stripes when used in a word.',
    accentColor: '#38bdf8',
  },
  cross_blast: {
    type: 'cross_blast',
    name: 'Cross Blast',
    shortName: 'Cross Tile',
    minWordLength: 5,
    description: 'Clears both the full row and full column intersecting this tile.',
    accentColor: '#a855f7',
  },
  word_bomb: {
    type: 'word_bomb',
    name: 'Word Bomb',
    shortName: 'Bomb Tile',
    minWordLength: 6,
    description: 'Detonates a fiery 3 × 3 blast (up to 9 tiles) centered on this tile.',
    accentColor: '#f97316',
  },
  letter_purge: {
    type: 'letter_purge',
    name: 'Letter Purge',
    shortName: 'Purge Tile',
    minWordLength: 7,
    description: 'Destroys every occurrence of this tile’s letter across the entire board.',
    accentColor: '#e879f9',
  },
  mega_blast: {
    type: 'mega_blast',
    name: 'Mega Blast',
    shortName: 'Mega Tile',
    minWordLength: 8,
    description: 'Unleashes a crystalline 5 × 5 blast (up to 25 tiles) centered on this tile.',
    accentColor: '#fde047',
  },
};

export function createZeroPowerUpCounters(): Record<PowerUpType, number> {
  return {
    line_blast: 0,
    cross_blast: 0,
    word_bomb: 0,
    letter_purge: 0,
    mega_blast: 0,
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
 * Creates a TilePowerUp metadata object. For Line Blast, assigns horizontal ('row')
 * or vertical ('col') orientation with equal 50/50 probability unless explicitly provided.
 */
export function createTilePowerUp(
  type: PowerUpType,
  rng: () => number = Math.random,
  explicitOrientation?: LineBlastOrientation
): TilePowerUp {
  if (type === 'line_blast') {
    const orientation: LineBlastOrientation =
      explicitOrientation ?? (rng() < 0.5 ? 'row' : 'col');
    return { type, orientation };
  }
  return { type };
}

/**
 * Computes the exact board coordinates affected by a power-up at its current position.
 * Bounded strictly to valid grid coordinates.
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
      // 3x3 area centered on the power-up tile (max 9 tiles)
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
      // 5x5 area centered on the power-up tile (max 25 tiles)
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          add(target.row + dr, target.col + dc);
        }
      }
      break;
    }
  }

  return coords;
}
