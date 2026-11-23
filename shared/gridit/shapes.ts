import {
  GridItBoardBounds,
  GridItBoardSize,
  GridItShapeId,
  GridItShapeTemplate,
  GridItTileNode,
} from './types.js';

export const GRIDIT_SHAPES: GridItShapeTemplate[] = [
  {
    id: 'square',
    name: 'Square',
    description: 'Classic balanced grid with 8-way word paths.',
    sizes: {
      small: { label: 'Small (4×4)', tileCount: 16 },
      medium: { label: 'Medium (5×5)', tileCount: 25 },
      large: { label: 'Large (6×6)', tileCount: 36 },
    },
  },
  {
    id: 'heart',
    name: 'Heart',
    description: 'Twin-lobe heart layout with curved cascades.',
    sizes: {
      small: { label: 'Small (22 tiles)', tileCount: 22 },
      medium: { label: 'Medium (37 tiles)', tileCount: 37 },
      large: { label: 'Large (54 tiles)', tileCount: 54 },
    },
  },
  {
    id: 'star',
    name: 'Star',
    description: 'Five-pointed star radiating from a central core.',
    sizes: {
      small: { label: 'Small (25 tiles)', tileCount: 25 },
      medium: { label: 'Medium (36 tiles)', tileCount: 36 },
      large: { label: 'Large (53 tiles)', tileCount: 53 },
    },
  },
  {
    id: 'triangle',
    name: 'Triangle',
    description: 'Equilateral pyramid with 6-way lattice links.',
    sizes: {
      small: { label: 'Small (15 tiles)', tileCount: 15 },
      medium: { label: 'Medium (28 tiles)', tileCount: 28 },
      large: { label: 'Large (45 tiles)', tileCount: 45 },
    },
  },
  {
    id: 'rectangle',
    name: 'Rectangle',
    description: 'Wide panoramic grid built for long horizontal runs.',
    sizes: {
      small: { label: 'Small (5×3)', tileCount: 15 },
      medium: { label: 'Medium (6×4)', tileCount: 24 },
      large: { label: 'Large (7×5)', tileCount: 35 },
    },
  },
  {
    id: 'circle',
    name: 'Circle',
    description: 'Rounded disk arena with smooth cornerless clusters.',
    sizes: {
      small: { label: 'Small (21 tiles)', tileCount: 21 },
      medium: { label: 'Medium (37 tiles)', tileCount: 37 },
      large: { label: 'Large (57 tiles)', tileCount: 57 },
    },
  },
  {
    id: 'hexagon',
    name: 'Hexagon',
    description: 'True 6-way honeycomb cells without corner jumps.',
    sizes: {
      small: { label: 'Small (19 tiles)', tileCount: 19 },
      medium: { label: 'Medium (37 tiles)', tileCount: 37 },
      large: { label: 'Large (61 tiles)', tileCount: 61 },
    },
  },
];

export function getShapeTemplate(shapeId: GridItShapeId): GridItShapeTemplate {
  return GRIDIT_SHAPES.find((s) => s.id === shapeId) ?? GRIDIT_SHAPES[0];
}

interface RawPoint {
  x: number;
  y: number;
  ring?: number;
}

const TILE_STEP_PX = 64;
const TILE_RADIUS_PX = 27;

function buildRectPoints(cols: number, rows: number): RawPoint[] {
  const pts: RawPoint[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ring = Math.min(r, c, rows - 1 - r, cols - 1 - c);
      pts.push({ x: c, y: r, ring });
    }
  }
  return pts;
}

function buildTrianglePoints(rows: number): RawPoint[] {
  const pts: RawPoint[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= r; c++) {
      const x = c - r / 2;
      const y = r * 0.866;
      pts.push({ x, y, ring: r });
    }
  }
  return pts;
}

function buildHexPoints(radius: number): RawPoint[] {
  const pts: RawPoint[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const s = -q - r;
      const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
      if (dist <= radius) {
        pts.push({
          x: q + r / 2,
          y: r * 0.866,
          ring: radius - dist,
        });
      }
    }
  }
  return pts;
}

function buildCirclePoints(radius: number): RawPoint[] {
  const pts: RawPoint[] = [];
  const limit = Math.ceil(radius);
  for (let r = -limit; r <= limit; r++) {
    for (let c = -limit; c <= limit; c++) {
      const d = Math.hypot(c, r);
      if (d <= radius) {
        pts.push({ x: c, y: r, ring: Math.max(0, Math.round(radius - d)) });
      }
    }
  }
  return pts;
}

function buildRowPoints(rows: Array<{ y: number; xs: number[] }>): RawPoint[] {
  const pts: RawPoint[] = [];
  for (const row of rows) {
    for (const x of row.xs) {
      pts.push({ x, y: row.y });
    }
  }
  return pts;
}

function buildHeartPoints(sizeId: GridItBoardSize): RawPoint[] {
  if (sizeId === 'small') {
    // 22 tiles: 4 + 6 + 5 + 4 + 2 + 1
    return buildRowPoints([
      { y: 0, xs: [-2, -1, 1, 2] },
      { y: 0.95, xs: [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5] },
      { y: 1.9, xs: [-2, -1, 0, 1, 2] },
      { y: 2.85, xs: [-1.5, -0.5, 0.5, 1.5] },
      { y: 3.8, xs: [-0.5, 0.5] },
      { y: 4.75, xs: [0] },
    ]);
  }
  if (sizeId === 'medium') {
    // 37 tiles (matches approved mockup Screen 2: "Medium (37 tiles)")
    // 4 + 6 + 8 + 7 + 5 + 4 + 2 + 1 = 37
    return buildRowPoints([
      { y: 0, xs: [-2, -1, 1, 2] },
      { y: 0.95, xs: [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5] },
      { y: 1.9, xs: [-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5] },
      { y: 2.85, xs: [-3, -2, -1, 0, 1, 2, 3] },
      { y: 3.8, xs: [-2, -1, 0, 1, 2] },
      { y: 4.75, xs: [-1.5, -0.5, 0.5, 1.5] },
      { y: 5.7, xs: [-0.5, 0.5] },
      { y: 6.65, xs: [0] },
    ]);
  }
  // large: 54 tiles (6 + 8 + 10 + 9 + 7 + 6 + 4 + 3 + 1 = 54)
  return buildRowPoints([
    { y: 0, xs: [-3, -2, -1, 1, 2, 3] },
    { y: 0.95, xs: [-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5] },
    { y: 1.9, xs: [-4.5, -3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5, 4.5] },
    { y: 2.85, xs: [-4, -3, -2, -1, 0, 1, 2, 3, 4] },
    { y: 3.8, xs: [-3, -2, -1, 0, 1, 2, 3] },
    { y: 4.75, xs: [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5] },
    { y: 5.7, xs: [-1.5, -0.5, 0.5, 1.5] },
    { y: 6.65, xs: [-1, 0, 1] },
    { y: 7.6, xs: [0] },
  ]);
}

function buildStarPoints(sizeId: GridItBoardSize): RawPoint[] {
  if (sizeId === 'small') {
    // 25 tiles: 1 + 3 + 7 + 5 + 5 + 4
    return buildRowPoints([
      { y: 0, xs: [0] },
      { y: 1, xs: [-1, 0, 1] },
      { y: 2, xs: [-3, -2, -1, 0, 1, 2, 3] },
      { y: 3, xs: [-2, -1, 0, 1, 2] },
      { y: 4, xs: [-2, -1, 0, 1, 2] },
      { y: 5, xs: [-3, -2, 2, 3] },
    ]);
  }
  if (sizeId === 'medium') {
    // 36 tiles: 1 + 3 + 9 + 7 + 6 + 6 + 4
    return buildRowPoints([
      { y: 0, xs: [0] },
      { y: 1, xs: [-1, 0, 1] },
      { y: 2, xs: [-4, -3, -2, -1, 0, 1, 2, 3, 4] },
      { y: 3, xs: [-3, -2, -1, 0, 1, 2, 3] },
      { y: 4, xs: [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5] },
      { y: 5, xs: [-3, -2, -1, 1, 2, 3] },
      { y: 6, xs: [-3.5, -2.5, 2.5, 3.5] },
    ]);
  }
  // large: 53 tiles (1 + 3 + 5 + 11 + 9 + 7 + 7 + 6 + 4)
  return buildRowPoints([
    { y: 0, xs: [0] },
    { y: 1, xs: [-1, 0, 1] },
    { y: 2, xs: [-2, -1, 0, 1, 2] },
    { y: 3, xs: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5] },
    { y: 4, xs: [-4, -3, -2, -1, 0, 1, 2, 3, 4] },
    { y: 5, xs: [-3, -2, -1, 0, 1, 2, 3] },
    { y: 6, xs: [-3, -2, -1, 0, 1, 2, 3] },
    { y: 7, xs: [-3.5, -2.5, -1.5, 1.5, 2.5, 3.5] },
    { y: 8, xs: [-4, -3, 3, 4] },
  ]);
}

function getRawPoints(shapeId: GridItShapeId, sizeId: GridItBoardSize): RawPoint[] {
  switch (shapeId) {
    case 'square':
      return buildRectPoints(
        sizeId === 'small' ? 4 : sizeId === 'medium' ? 5 : 6,
        sizeId === 'small' ? 4 : sizeId === 'medium' ? 5 : 6
      );
    case 'rectangle':
      return buildRectPoints(
        sizeId === 'small' ? 5 : sizeId === 'medium' ? 6 : 7,
        sizeId === 'small' ? 3 : sizeId === 'medium' ? 4 : 5
      );
    case 'triangle':
      return buildTrianglePoints(sizeId === 'small' ? 5 : sizeId === 'medium' ? 7 : 9);
    case 'heart':
      return buildHeartPoints(sizeId);
    case 'star':
      return buildStarPoints(sizeId);
    case 'circle':
      return buildCirclePoints(sizeId === 'small' ? 2.5 : sizeId === 'medium' ? 3.2 : 4.2);
    case 'hexagon':
      return buildHexPoints(sizeId === 'small' ? 2 : sizeId === 'medium' ? 3 : 4);
  }
}

export interface ShapeTopologyResult {
  tiles: Array<Omit<GridItTileNode, 'letter'>>;
  bounds: GridItBoardBounds;
  tileRadius: number;
}

export function buildShapeTopology(
  shapeId: GridItShapeId,
  sizeId: GridItBoardSize
): ShapeTopologyResult {
  const raw = getRawPoints(shapeId, sizeId);

  // Center coordinates around (0, 0) in pixel space
  let minRawX = Infinity;
  let maxRawX = -Infinity;
  let minRawY = Infinity;
  let maxRawY = -Infinity;
  for (const p of raw) {
    if (p.x < minRawX) minRawX = p.x;
    if (p.x > maxRawX) maxRawX = p.x;
    if (p.y < minRawY) minRawY = p.y;
    if (p.y > maxRawY) maxRawY = p.y;
  }
  const cx = (minRawX + maxRawX) / 2;
  const cy = (minRawY + maxRawY) / 2;

  const nodes: Array<Omit<GridItTileNode, 'letter'>> = raw.map((p, idx) => ({
    id: `t_${idx}`,
    x: Math.round((p.x - cx) * TILE_STEP_PX * 10) / 10,
    y: Math.round((p.y - cy) * TILE_STEP_PX * 10) / 10,
    neighbors: [],
    ring: p.ring,
    modifier: null,
  }));

  // Connect valid geometric neighbors:
  // Hexagon/Triangle have unit neighbor distance 1.0 (next-nearest sqrt(3)=1.732);
  // Square/Rect/Circle/Heart/Star have orthogonal=1.0, diagonal=1.414 (next-nearest >= 1.77).
  // Threshold of 1.52 * TILE_STEP_PX produces exact 6-way for hex/triangle and exact 8-way for grids.
  const maxDist = TILE_STEP_PX * 1.52;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dist = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (dist > 0.1 && dist <= maxDist) {
        nodes[i].neighbors.push(nodes[j].id);
        nodes[j].neighbors.push(nodes[i].id);
      }
    }
  }

  const padding = TILE_RADIUS_PX + 14;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    if (n.x - padding < minX) minX = n.x - padding;
    if (n.x + padding > maxX) maxX = n.x + padding;
    if (n.y - padding < minY) minY = n.y - padding;
    if (n.y + padding > maxY) maxY = n.y + padding;
  }

  return {
    tiles: nodes,
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
      width: Math.max(120, maxX - minX),
      height: Math.max(120, maxY - minY),
    },
    tileRadius: TILE_RADIUS_PX,
  };
}
