export type GridItShapeId =
  | 'square'
  | 'rectangle'
  | 'triangle'
  | 'heart'
  | 'star'
  | 'circle'
  | 'hexagon';

export type GridItBoardSize = 'small' | 'medium' | 'large';

export interface GridItTileModifier {
  type: 'rainbow' | 'golden';
  multiplier?: number;
  expiresAtMs?: number;
}

export interface GridItTileNode {
  id: string;
  letter: string;
  x: number;
  y: number;
  neighbors: string[];
  ring?: number;
  modifier?: GridItTileModifier | null;
  /** Visual-only physical die orientation (0/90/180/270 deg); never alters letter or adjacency */
  rotationDeg?: 0 | 90 | 180 | 270;
  /** Visual-only subtle resting tilt inside tray socket (-3.5..3.5 deg) */
  tiltDeg?: number;
  /** Internal marker preserved during board completion and stripped before opponent reveal */
  isAuthored?: boolean;
  /** Ring wave index when added by Growing Grid */
  addedAtRing?: number;
}

export interface GridItSizeMeta {
  label: string;
  tileCount: number;
}

export interface GridItShapeTemplate {
  id: GridItShapeId;
  name: string;
  description: string;
  sizes: Record<GridItBoardSize, GridItSizeMeta>;
}

export interface GridItBoardBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export interface GridItBoard {
  id: string;
  shapeId: GridItShapeId;
  sizeId: GridItBoardSize;
  language: string;
  tiles: GridItTileNode[];
  bounds: GridItBoardBounds;
  tileRadius: number;
  seed: number;
}

export interface GridItScoringConfig {
  minWordLength: number;
  pointsByLength: Record<number, number>;
  extraLetterPoints: number;
  provisional: boolean;
}

export interface GridItFoundWord {
  word: string;
  tilePath: string[];
  points: number;
  foundAtMs: number;
}

export type GridItRejectionReason =
  | 'too_short'
  | 'invalid_path'
  | 'duplicate_tile'
  | 'not_adjacent'
  | 'not_in_dictionary'
  | 'already_found';

export interface GridItValidationResult {
  valid: boolean;
  word: string;
  points: number;
  reason?: GridItRejectionReason;
}

export interface WordDefinitionMeaning {
  partOfSpeech: string;
  definitions: Array<{
    definition: string;
    example?: string;
  }>;
}

export interface WordDefinitionResult {
  word: string;
  found: boolean;
  phonetic?: string;
  language: string;
  source: string;
  meanings: WordDefinitionMeaning[];
  reason?: 'not_found' | 'offline';
}
