import {
  DEFAULT_GRIDIT_SCORING,
  assignDeterministicDieOrientations,
  scoreGridItWord,
} from './engine.js';
import {
  GridItBoard,
  GridItBoardBounds,
  GridItScoringConfig,
  GridItShapeId,
  GridItTileNode,
} from './types.js';

export const MAX_GRIDIT_MULTIPLIER = 5;

export type GridItModId =
  | 'rainbow_wildcard'
  | 'golden_letter'
  | 'lightning_round'
  | 'combo_fever'
  | 'growing_grid';

export interface GridItModConfig {
  rainbowWildcard: boolean;
  goldenLetter: boolean;
  lightningRound: boolean;
  comboFever: boolean;
  growingGrid: boolean;
  rainbowDurationSec: number;
  lightningDurationSec: number;
  comboWindowSec: number;
  maxMultiplierCap: number;
}

export const DEFAULT_GRIDIT_MODS: GridItModConfig = {
  rainbowWildcard: false,
  goldenLetter: false,
  lightningRound: false,
  comboFever: false,
  growingGrid: false,
  rainbowDurationSec: 5,
  lightningDurationSec: 10,
  comboWindowSec: 8,
  maxMultiplierCap: MAX_GRIDIT_MULTIPLIER,
};

export interface GridItScheduledTileEvent {
  tileId: string;
  startAtMs: number;
  endAtMs: number;
}

export interface GridItLightningWindow {
  startAtMs: number;
  endAtMs: number;
  multiplier: number;
}

export interface GridItGrowthWave {
  waveIndex: number;
  triggerAtMs: number;
  addedTiles: GridItTileNode[];
}

export interface GridItModSchedule {
  seed: number;
  startedAtMs: number;
  rainbowWindows: GridItScheduledTileEvent[];
  goldenWindows: GridItScheduledTileEvent[];
  lightningWindows: GridItLightningWindow[];
  growthWaves: GridItGrowthWave[];
}

const TILE_STEP_PX = 64;
const MAX_NEIGHBOR_DIST_PX = TILE_STEP_PX * 1.52;
const MIN_SEPARATION_PX = TILE_STEP_PX * 0.85;
const GROWTH_LETTERS = 'AEIOURSTLNCDMPB';

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

export function normalizeModConfig(input?: Partial<GridItModConfig> | null): GridItModConfig {
  return {
    rainbowWildcard: Boolean(input?.rainbowWildcard),
    goldenLetter: Boolean(input?.goldenLetter),
    lightningRound: Boolean(input?.lightningRound),
    comboFever: Boolean(input?.comboFever),
    growingGrid: Boolean(input?.growingGrid),
    rainbowDurationSec: Math.max(4, Math.min(8, Math.round(input?.rainbowDurationSec ?? 5))),
    lightningDurationSec: Math.max(6, Math.min(15, Math.round(input?.lightningDurationSec ?? 10))),
    comboWindowSec: Math.max(4, Math.min(15, Math.round(input?.comboWindowSec ?? 8))),
    maxMultiplierCap: MAX_GRIDIT_MULTIPLIER,
  };
}

function getLatticeVectorsForShape(shapeId: GridItShapeId): Array<[number, number]> {
  if (shapeId === 'hexagon' || shapeId === 'triangle') {
    const dy = Math.round(TILE_STEP_PX * 0.866 * 10) / 10;
    const dx = TILE_STEP_PX / 2;
    return [
      [TILE_STEP_PX, 0],
      [-TILE_STEP_PX, 0],
      [dx, dy],
      [-dx, dy],
      [dx, -dy],
      [-dx, -dy],
    ];
  }
  if (shapeId === 'heart') {
    const dy = Math.round(TILE_STEP_PX * 0.95 * 10) / 10;
    const dx = TILE_STEP_PX / 2;
    return [
      [TILE_STEP_PX, 0],
      [-TILE_STEP_PX, 0],
      [dx, dy],
      [-dx, dy],
      [dx, -dy],
      [-dx, -dy],
    ];
  }
  // Square, Rectangle, Circle, Star use rectilinear outer ring steps
  return [
    [TILE_STEP_PX, 0],
    [-TILE_STEP_PX, 0],
    [0, TILE_STEP_PX],
    [0, -TILE_STEP_PX],
  ];
}

function computeBoundsForTiles(tiles: GridItTileNode[], tileRadius: number): GridItBoardBounds {
  const padding = tileRadius + 14;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const t of tiles) {
    if (t.x - padding < minX) minX = t.x - padding;
    if (t.x + padding > maxX) maxX = t.x + padding;
    if (t.y - padding < minY) minY = t.y - padding;
    if (t.y + padding > maxY) maxY = t.y + padding;
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(120, maxX - minX),
    height: Math.max(120, maxY - minY),
  };
}

/**
 * Generates non-overlapping, shape-compatible outer perimeter expansion tiles for Growing Grid.
 * Strictly preserves existing/authored tiles, coordinates, and base neighbor topology.
 */
export function computeExpansionRings(
  baseBoard: GridItBoard,
  seed: number,
  waveCount = 2
): GridItTileNode[][] {
  const rand = mulberry32((seed ^ 0x517cc1b7) >>> 0);
  const allTiles: GridItTileNode[] = baseBoard.tiles.map((t) => ({
    ...t,
    neighbors: [...t.neighbors],
  }));

  let cx = 0;
  let cy = 0;
  for (const t of allTiles) {
    cx += t.x;
    cy += t.y;
  }
  cx /= Math.max(1, allTiles.length);
  cy /= Math.max(1, allTiles.length);

  const vectors = getLatticeVectorsForShape(baseBoard.shapeId);
  const perWaveLimit = Math.max(4, Math.min(8, Math.round(baseBoard.tiles.length * 0.2)));
  const waves: GridItTileNode[][] = [];
  let nextIdx = allTiles.length;

  for (let w = 1; w <= waveCount; w++) {
    const candidates: Array<{ x: number; y: number; dist: number; angle: number }> = [];
    for (const tile of allTiles) {
      for (const [vx, vy] of vectors) {
        const nx = Math.round((tile.x + vx) * 10) / 10;
        const ny = Math.round((tile.y + vy) * 10) / 10;
        if (baseBoard.shapeId === 'triangle' && ny < allTiles[0].y - 5) {
          continue; // Keep triangle apex upward rather than flattening top point
        }
        const overlapsExisting = allTiles.some(
          (other) => Math.hypot(other.x - nx, other.y - ny) < MIN_SEPARATION_PX
        );
        const overlapsCandidate = candidates.some(
          (c) => Math.hypot(c.x - nx, c.y - ny) < MIN_SEPARATION_PX
        );
        if (!overlapsExisting && !overlapsCandidate) {
          candidates.push({
            x: nx,
            y: ny,
            dist: Math.hypot(nx - cx, ny - cy),
            angle: Math.atan2(ny - cy, nx - cx),
          });
        }
      }
    }

    // Spread wave selection cleanly around angular sectors for balanced visual growth
    candidates.sort((a, b) => a.angle - b.angle || a.dist - b.dist);
    const picked: typeof candidates = [];
    if (candidates.length <= perWaveLimit) {
      picked.push(...candidates);
    } else {
      const step = candidates.length / perWaveLimit;
      for (let k = 0; k < perWaveLimit; k++) {
        picked.push(candidates[Math.floor(k * step)]);
      }
    }

    const waveNodes: GridItTileNode[] = picked.map((pos) => {
      const id = `tg_${w}_${nextIdx++}`;
      const letter = GROWTH_LETTERS[Math.floor(rand() * GROWTH_LETTERS.length)];
      return {
        id,
        letter,
        x: pos.x,
        y: pos.y,
        neighbors: [],
        addedAtRing: w,
        modifier: null,
      };
    });

    const orientedWave = assignDeterministicDieOrientations(waveNodes, seed + w * 977);
    for (const newNode of orientedWave) {
      for (const other of [...allTiles, ...orientedWave]) {
        if (other.id === newNode.id) continue;
        const d = Math.hypot(other.x - newNode.x, other.y - newNode.y);
        if (d > 0.1 && d <= MAX_NEIGHBOR_DIST_PX && !newNode.neighbors.includes(other.id)) {
          newNode.neighbors.push(other.id);
        }
      }
    }

    const validWave = orientedWave.filter((n) => n.neighbors.length > 0);
    allTiles.push(...validWave);
    waves.push(validWave);
  }

  return waves;
}

/**
 * Produces a fully deterministic, serverless-safe mod event timeline from match start.
 * Any server or client evaluating the schedule at `nowMs` agrees identically.
 */
export function generateModSchedule(
  baseBoard: GridItBoard,
  durationSeconds: number,
  rawConfig: Partial<GridItModConfig> | null | undefined,
  seed: number,
  startedAtMs: number
): GridItModSchedule {
  const cfg = normalizeModConfig(rawConfig);
  const rand = mulberry32((seed ^ 0x7f4a7c15) >>> 0);
  const effectiveDurationSec = durationSeconds > 0 ? durationSeconds : 180;
  const totalMs = effectiveDurationSec * 1000;
  const tileIds = baseBoard.tiles.map((t) => t.id);

  const rainbowWindows: GridItScheduledTileEvent[] = [];
  const goldenWindows: GridItScheduledTileEvent[] = [];
  const lightningWindows: GridItLightningWindow[] = [];
  const growthWaves: GridItGrowthWave[] = [];

  if (cfg.rainbowWildcard && tileIds.length > 0) {
    const durMs = cfg.rainbowDurationSec * 1000;
    const strideMs = Math.max(18000, Math.floor(totalMs / 4));
    for (let t = 6000; t + durMs < totalMs; t += strideMs) {
      const tileId = tileIds[Math.floor(rand() * tileIds.length)];
      rainbowWindows.push({
        tileId,
        startAtMs: startedAtMs + t,
        endAtMs: startedAtMs + t + durMs,
      });
    }
  }

  if (cfg.goldenLetter && tileIds.length > 0) {
    // 1-2 golden tiles active across alternating 25s phases
    const segmentMs = Math.max(22000, Math.floor(totalMs / 3));
    for (let t = 0; t < totalMs; t += segmentMs) {
      const idxA = Math.floor(rand() * tileIds.length);
      goldenWindows.push({
        tileId: tileIds[idxA],
        startAtMs: startedAtMs + t,
        endAtMs: startedAtMs + Math.min(totalMs, t + segmentMs),
      });
      if (tileIds.length > 16) {
        const idxB = (idxA + Math.floor(tileIds.length / 2)) % tileIds.length;
        goldenWindows.push({
          tileId: tileIds[idxB],
          startAtMs: startedAtMs + t,
          endAtMs: startedAtMs + Math.min(totalMs, t + segmentMs),
        });
      }
    }
  }

  if (cfg.lightningRound) {
    // Strictly a 10-second 3x scoring surge without shortening total match duration
    const durMs = cfg.lightningDurationSec * 1000;
    const firstAt = Math.round(totalMs * 0.42);
    if (firstAt + durMs <= totalMs) {
      lightningWindows.push({
        startAtMs: startedAtMs + firstAt,
        endAtMs: startedAtMs + firstAt + durMs,
        multiplier: 3,
      });
    }
    if (effectiveDurationSec >= 150) {
      const secondAt = Math.round(totalMs * 0.78);
      if (secondAt + durMs <= totalMs) {
        lightningWindows.push({
          startAtMs: startedAtMs + secondAt,
          endAtMs: startedAtMs + secondAt + durMs,
          multiplier: 3,
        });
      }
    }
  }

  if (cfg.growingGrid) {
    const ringWaves = computeExpansionRings(baseBoard, seed, 2);
    const triggers = [Math.round(totalMs * 0.32), Math.round(totalMs * 0.65)];
    ringWaves.forEach((addedTiles, i) => {
      if (addedTiles.length > 0 && triggers[i] < totalMs - 8000) {
        growthWaves.push({
          waveIndex: i + 1,
          triggerAtMs: startedAtMs + triggers[i],
          addedTiles,
        });
      }
    });
  }

  return {
    seed,
    startedAtMs,
    rainbowWindows,
    goldenWindows,
    lightningWindows,
    growthWaves,
  };
}

export interface BoardModSnapshot {
  board: GridItBoard;
  activeRainbowIds: Set<string>;
  activeGoldenIds: Set<string>;
  inLightningRound: boolean;
  lightningEndsAtMs: number | null;
  activeGrowthWaveCount: number;
}

/**
 * Computes a compact deterministic string key representing which scheduled mod windows
 * are active at `nowMs`. Used to memoize `getBoardSnapshotAtTime` so React components
 * keep referential stability between mod transitions.
 */
export function getBoardModStateKey(
  baseBoardId: string,
  schedule: GridItModSchedule | null | undefined,
  nowMs: number
): string {
  if (!schedule) return `${baseBoardId}:none`;
  const r: string[] = [];
  for (const rw of schedule.rainbowWindows) {
    if (nowMs >= rw.startAtMs && nowMs <= rw.endAtMs) r.push(rw.tileId);
  }
  const g: string[] = [];
  for (const gw of schedule.goldenWindows) {
    if (nowMs >= gw.startAtMs && nowMs <= gw.endAtMs) g.push(gw.tileId);
  }
  let l = 0;
  for (const lw of schedule.lightningWindows) {
    if (nowMs >= lw.startAtMs && nowMs <= lw.endAtMs) {
      l = lw.endAtMs;
      break;
    }
  }
  let w = 0;
  for (const wave of schedule.growthWaves) {
    if (nowMs >= wave.triggerAtMs) w++;
  }
  return `${baseBoardId}:w${w}:l${l}:r${r.join(',')}:g${g.join(',')}`;
}

/**
 * Returns the delay in ms until the next scheduled mod/lifecycle transition after `nowMs`,
 * or `null` if no future transitions remain. Eliminates 250ms full-screen React polling.
 */
export function getNextScheduleTransitionDelayMs(
  schedule: GridItModSchedule | null | undefined,
  nowMs: number,
  extraBoundariesMs: number[] = []
): number | null {
  let nextAt = Infinity;
  const consider = (ts: number) => {
    if (ts > nowMs && ts < nextAt) {
      nextAt = ts;
    }
  };
  for (const b of extraBoundariesMs) consider(b);
  if (schedule) {
    for (const rw of schedule.rainbowWindows) {
      consider(rw.startAtMs);
      consider(rw.endAtMs + 1);
    }
    for (const gw of schedule.goldenWindows) {
      consider(gw.startAtMs);
      consider(gw.endAtMs + 1);
    }
    for (const lw of schedule.lightningWindows) {
      consider(lw.startAtMs);
      consider(lw.endAtMs + 1);
    }
    for (const wave of schedule.growthWaves) {
      consider(wave.triggerAtMs);
    }
  }
  if (!Number.isFinite(nextAt)) return null;
  return Math.max(16, Math.min(60_000, nextAt - nowMs + 15));
}

export function getBoardSnapshotAtTime(
  baseBoard: GridItBoard,
  schedule: GridItModSchedule | null | undefined,
  nowMs: number
): BoardModSnapshot {
  const activeRainbowIds = new Set<string>();
  const activeGoldenIds = new Set<string>();
  let inLightningRound = false;
  let lightningEndsAtMs: number | null = null;
  let activeGrowthWaveCount = 0;

  if (!schedule) {
    return {
      board: baseBoard,
      activeRainbowIds,
      activeGoldenIds,
      inLightningRound,
      lightningEndsAtMs,
      activeGrowthWaveCount,
    };
  }

  for (const rw of schedule.rainbowWindows) {
    if (nowMs >= rw.startAtMs && nowMs <= rw.endAtMs) {
      activeRainbowIds.add(rw.tileId);
    }
  }
  for (const gw of schedule.goldenWindows) {
    if (nowMs >= gw.startAtMs && nowMs <= gw.endAtMs) {
      activeGoldenIds.add(gw.tileId);
    }
  }
  for (const lw of schedule.lightningWindows) {
    if (nowMs >= lw.startAtMs && nowMs <= lw.endAtMs) {
      inLightningRound = true;
      lightningEndsAtMs = lw.endAtMs;
      break;
    }
  }

  const extraTiles: GridItTileNode[] = [];
  for (const wave of schedule.growthWaves) {
    if (nowMs >= wave.triggerAtMs) {
      activeGrowthWaveCount++;
      extraTiles.push(...wave.addedTiles);
    }
  }

  let effectiveBoard = baseBoard;
  if (extraTiles.length > 0) {
    // Clone base tiles with symmetric neighbor links to unlocked expansion ring tiles
    const combinedMap = new Map<string, GridItTileNode>();
    for (const t of baseBoard.tiles) {
      combinedMap.set(t.id, { ...t, neighbors: [...t.neighbors] });
    }
    for (const et of extraTiles) {
      combinedMap.set(et.id, {
        ...et,
        neighbors: et.neighbors.filter(
          (nId) =>
            combinedMap.has(nId) || extraTiles.some((other) => other.id === nId)
        ),
      });
    }
    // Back-link existing/unlocked tiles symmetrically
    for (const et of extraTiles) {
      for (const nId of et.neighbors) {
        const target = combinedMap.get(nId);
        if (target && !target.neighbors.includes(et.id)) {
          target.neighbors.push(et.id);
        }
      }
    }
    const allTiles = Array.from(combinedMap.values());
    effectiveBoard = {
      ...baseBoard,
      tiles: allTiles,
      bounds: computeBoundsForTiles(allTiles, baseBoard.tileRadius),
    };
  }

  return {
    board: effectiveBoard,
    activeRainbowIds,
    activeGoldenIds,
    inLightningRound,
    lightningEndsAtMs,
    activeGrowthWaveCount,
  };
}

/**
 * Resolves candidate dictionary word(s) when a traced path includes 1–2 Rainbow Wildcard tiles.
 * Never mutates the underlying tile letter.
 */
function resolveWildcardWord(
  patternChars: Array<{ ch: string; isWildcard: boolean }>,
  dictionary: Set<string>,
  preferredWord?: string
): string | null {
  const wildcardIndices = patternChars
    .map((p, idx) => (p.isWildcard ? idx : -1))
    .filter((i) => i >= 0);

  if (wildcardIndices.length === 0) {
    const exact = patternChars.map((p) => p.ch).join('').toUpperCase();
    return dictionary.has(exact) ? exact : null;
  }

  if (wildcardIndices.length > 2) {
    // Cap at 2 simultaneous wildcards to avoid combinatorial explosion
    return null;
  }

  if (preferredWord && preferredWord.length === patternChars.length) {
    const prefUpper = preferredWord.toUpperCase();
    const matchesPattern = patternChars.every(
      (p, i) => p.isWildcard || p.ch === prefUpper[i]
    );
    if (matchesPattern && dictionary.has(prefUpper)) {
      return prefUpper;
    }
  }

  const alphabet = 'ETAOINSHRDLUCMFWYPVBGKQJXZ';
  const chars = patternChars.map((p) => p.ch);

  if (wildcardIndices.length === 1) {
    const w0 = wildcardIndices[0];
    for (const sub of alphabet) {
      chars[w0] = sub;
      const cand = chars.join('');
      if (dictionary.has(cand)) return cand;
    }
    return null;
  }

  const [w0, w1] = wildcardIndices;
  for (const s0 of alphabet) {
    chars[w0] = s0;
    for (const s1 of alphabet) {
      chars[w1] = s1;
      const cand = chars.join('');
      if (dictionary.has(cand)) return cand;
    }
  }
  return null;
}

export interface ModWordValidationResult {
  valid: boolean;
  word: string;
  basePoints: number;
  multiplier: number;
  finalPoints: number;
  usedRainbow: boolean;
  usedGolden: boolean;
  inLightningRound: boolean;
  comboMultiplier: number;
  nextComboCount: number;
  reason?:
    | 'too_short'
    | 'invalid_path'
    | 'duplicate_tile'
    | 'not_adjacent'
    | 'not_in_dictionary'
    | 'already_found';
}

export function resolveWordPathWithMods(
  baseBoard: GridItBoard,
  tilePath: string[],
  dictionary: Set<string>,
  alreadyFound: Set<string>,
  options: {
    nowMs: number;
    schedule?: GridItModSchedule | null;
    modConfig?: GridItModConfig | null;
    comboCount?: number;
    lastWordAtMs?: number | null;
    preferredWord?: string;
    scoringConfig?: GridItScoringConfig;
  }
): ModWordValidationResult {
  const scoring = options.scoringConfig ?? DEFAULT_GRIDIT_SCORING;
  const cfg = normalizeModConfig(options.modConfig);
  const snapshot = getBoardSnapshotAtTime(baseBoard, options.schedule, options.nowMs);
  const board = snapshot.board;

  if (!Array.isArray(tilePath) || tilePath.length === 0) {
    return {
      valid: false,
      word: '',
      basePoints: 0,
      multiplier: 1,
      finalPoints: 0,
      usedRainbow: false,
      usedGolden: false,
      inLightningRound: snapshot.inLightningRound,
      comboMultiplier: 1,
      nextComboCount: options.comboCount ?? 0,
      reason: 'invalid_path',
    };
  }

  const tileMap = new Map<string, GridItTileNode>();
  for (const t of board.tiles) tileMap.set(t.id, t);

  const visited = new Set<string>();
  const pattern: Array<{ ch: string; isWildcard: boolean }> = [];
  let usedRainbow = false;
  let usedGolden = false;

  for (let i = 0; i < tilePath.length; i++) {
    const id = tilePath[i];
    const tile = tileMap.get(id);
    if (!tile) {
      return {
        valid: false,
        word: pattern.map((p) => p.ch).join(''),
        basePoints: 0,
        multiplier: 1,
        finalPoints: 0,
        usedRainbow,
        usedGolden,
        inLightningRound: snapshot.inLightningRound,
        comboMultiplier: 1,
        nextComboCount: options.comboCount ?? 0,
        reason: 'invalid_path',
      };
    }
    if (visited.has(id)) {
      return {
        valid: false,
        word: pattern.map((p) => p.ch).join(''),
        basePoints: 0,
        multiplier: 1,
        finalPoints: 0,
        usedRainbow,
        usedGolden,
        inLightningRound: snapshot.inLightningRound,
        comboMultiplier: 1,
        nextComboCount: options.comboCount ?? 0,
        reason: 'duplicate_tile',
      };
    }
    if (i > 0) {
      const prev = tileMap.get(tilePath[i - 1])!;
      if (!prev.neighbors.includes(id)) {
        return {
          valid: false,
          word: pattern.map((p) => p.ch).join(''),
          basePoints: 0,
          multiplier: 1,
          finalPoints: 0,
          usedRainbow,
          usedGolden,
          inLightningRound: snapshot.inLightningRound,
          comboMultiplier: 1,
          nextComboCount: options.comboCount ?? 0,
          reason: 'not_adjacent',
        };
      }
    }
    visited.add(id);
    const isWild = snapshot.activeRainbowIds.has(id);
    if (isWild) usedRainbow = true;
    if (snapshot.activeGoldenIds.has(id)) usedGolden = true;
    pattern.push({ ch: tile.letter.toUpperCase(), isWildcard: isWild });
  }

  const rawWord = pattern.map((p) => (p.isWildcard ? '*' : p.ch)).join('');
  if (pattern.length < scoring.minWordLength) {
    return {
      valid: false,
      word: rawWord,
      basePoints: 0,
      multiplier: 1,
      finalPoints: 0,
      usedRainbow,
      usedGolden,
      inLightningRound: snapshot.inLightningRound,
      comboMultiplier: 1,
      nextComboCount: options.comboCount ?? 0,
      reason: 'too_short',
    };
  }

  const resolvedWord = resolveWildcardWord(pattern, dictionary, options.preferredWord);
  if (!resolvedWord) {
    return {
      valid: false,
      word: rawWord,
      basePoints: 0,
      multiplier: 1,
      finalPoints: 0,
      usedRainbow,
      usedGolden,
      inLightningRound: snapshot.inLightningRound,
      comboMultiplier: 1,
      nextComboCount: options.comboCount ?? 0,
      reason: 'not_in_dictionary',
    };
  }

  if (alreadyFound.has(resolvedWord)) {
    return {
      valid: false,
      word: resolvedWord,
      basePoints: 0,
      multiplier: 1,
      finalPoints: 0,
      usedRainbow,
      usedGolden,
      inLightningRound: snapshot.inLightningRound,
      comboMultiplier: 1,
      nextComboCount: options.comboCount ?? 0,
      reason: 'already_found',
    };
  }

  // Compute combined active multipliers and enforce strict 5x cap
  let nextComboCount = 1;
  let comboMultiplier = 1;
  if (cfg.comboFever) {
    const withinWindow =
      options.lastWordAtMs !== null &&
      options.lastWordAtMs !== undefined &&
      options.nowMs - options.lastWordAtMs <= cfg.comboWindowSec * 1000;
    nextComboCount = withinWindow ? (options.comboCount ?? 0) + 1 : 1;
    // Escalates cleanly: 1x -> 1.5x -> 2x -> 2.5x -> 3x
    comboMultiplier = 1 + Math.min(4, Math.floor(Math.max(0, nextComboCount - 1))) * 0.5;
  }

  const goldenMult = usedGolden ? 2 : 1;
  const lightningMult = snapshot.inLightningRound ? 3 : 1;
  const rawCombined = goldenMult * lightningMult * comboMultiplier;
  const cappedMultiplier = Math.round(Math.min(MAX_GRIDIT_MULTIPLIER, rawCombined) * 100) / 100;

  const basePoints = scoreGridItWord(resolvedWord, scoring);
  const finalPoints = Math.max(1, Math.round(basePoints * cappedMultiplier));

  return {
    valid: true,
    word: resolvedWord,
    basePoints,
    multiplier: cappedMultiplier,
    finalPoints,
    usedRainbow,
    usedGolden,
    inLightningRound: snapshot.inLightningRound,
    comboMultiplier,
    nextComboCount,
  };
}
