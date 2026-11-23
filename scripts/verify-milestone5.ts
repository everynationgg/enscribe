import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generatePlayableBoard } from '../shared/gridit/engine.js';
import { GRIDIT_LANGUAGES, resolveModeLanguage } from '../shared/gridit/languages.js';
import {
  DEFAULT_GRIDIT_MODS,
  MAX_GRIDIT_MULTIPLIER,
  MIN_GRIDIT_MOD_DURATION_SEC,
  computeExpansionRings,
  generateModSchedule,
  getBoardSnapshotAtTime,
  normalizeModConfig,
  resolveWordPathWithMods,
} from '../shared/gridit/mods.js';
import { GRIDIT_SHAPES, buildShapeTopology } from '../shared/gridit/shapes.js';
import { GridItBoard } from '../shared/gridit/types.js';

function loadDict() {
  const dictPath = path.resolve(process.cwd(), 'public', 'dictionaries', 'en.txt');
  const lines = fs.readFileSync(dictPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const words = new Set<string>();
  const prefixes = new Set<string>();
  for (const w of lines) {
    words.add(w);
    const maxP = Math.min(w.length, 6);
    for (let i = 1; i <= maxP; i++) prefixes.add(w.slice(0, i));
  }
  return { words, prefixes };
}

function run() {
  const { words } = loadDict();

  console.log('1. Testing Growing Grid shape-compatible expansion across all 7 shapes...');
  for (const shape of GRIDIT_SHAPES) {
    const topo = buildShapeTopology(shape.id, 'small');
    const baseBoard: GridItBoard = {
      id: `grow_${shape.id}`,
      shapeId: shape.id,
      sizeId: 'small',
      language: 'en',
      tiles: topo.tiles.map((t) => ({ ...t, letter: 'A', isAuthored: true })),
      bounds: topo.bounds,
      tileRadius: topo.tileRadius,
      seed: 101,
    };

    const waves = computeExpansionRings(baseBoard, 101, 2);
    assert.ok(waves[0].length >= 4, `${shape.id}: first expansion wave must add perimeter tiles`);
    const allCoords = [...baseBoard.tiles, ...waves[0], ...waves[1]];
    // Assert zero overlapping positions!
    for (let i = 0; i < allCoords.length; i++) {
      for (let j = i + 1; j < allCoords.length; j++) {
        const d = Math.hypot(allCoords[i].x - allCoords[j].x, allCoords[i].y - allCoords[j].y);
        assert.ok(d >= 50, `${shape.id}: overlapping growth node (${d.toFixed(1)}px)`);
      }
    }
  }

  console.log('2. Testing Rainbow Wildcard, Golden Letter, Lightning Round, Combo Fever & strict 5x cap...');
  const sqTopo = buildShapeTopology('square', 'small');
  const letters = [
    'C', 'A', 'T', 'S',
    'R', 'E', 'A', 'D',
    'B', 'I', 'N', 'G',
    'X', 'Q', 'J', 'Z',
  ];
  const board: GridItBoard = {
    id: 'mods_test_sq',
    shapeId: 'square',
    sizeId: 'small',
    language: 'en',
    tiles: sqTopo.tiles.map((t, idx) => ({ ...t, letter: letters[idx], isAuthored: idx < 4 })),
    bounds: sqTopo.bounds,
    tileRadius: sqTopo.tileRadius,
    seed: 55,
  };

  const startedAt = 1_000_000;
  assert.ok(MIN_GRIDIT_MOD_DURATION_SEC >= 10, 'Minimum mod duration constant must be >= 10s');
  assert.ok(DEFAULT_GRIDIT_MODS.rainbowDurationSec >= 10, 'Default rainbow duration must be >= 10s');
  assert.ok(DEFAULT_GRIDIT_MODS.lightningDurationSec >= 10, 'Default lightning duration must be >= 10s');
  assert.ok(DEFAULT_GRIDIT_MODS.comboWindowSec >= 10, 'Default combo window must be >= 10s');

  const clampedMods = normalizeModConfig({
    rainbowWildcard: true,
    goldenLetter: true,
    lightningRound: true,
    comboFever: true,
    growingGrid: true,
    rainbowDurationSec: 4,
    lightningDurationSec: 6,
    comboWindowSec: 5,
  });
  assert.ok(clampedMods.rainbowDurationSec >= 10, 'normalizeModConfig must clamp rainbow >= 10s');
  assert.ok(clampedMods.lightningDurationSec >= 10, 'normalizeModConfig must clamp lightning >= 10s');
  assert.ok(clampedMods.comboWindowSec >= 10, 'normalizeModConfig must clamp comboWindow >= 10s');

  const modConfig = {
    rainbowWildcard: true,
    goldenLetter: true,
    lightningRound: true,
    comboFever: true,
    growingGrid: true,
    rainbowDurationSec: 10,
    lightningDurationSec: 10,
    comboWindowSec: 10,
    maxMultiplierCap: MAX_GRIDIT_MULTIPLIER,
  };

  const schedule = generateModSchedule(board, 120, modConfig, 55, startedAt);
  // Schedule determinism check
  const schedule2 = generateModSchedule(board, 120, modConfig, 55, startedAt);
  assert.deepEqual(schedule, schedule2, 'Schedule must be 100% deterministic for serverless sync');

  for (const dur of [50, 90, 120]) {
    const durSchedule = generateModSchedule(board, dur, modConfig, 55, startedAt);
    for (const rw of durSchedule.rainbowWindows) {
      assert.ok(rw.endAtMs - rw.startAtMs >= 10_000, `${dur}s rainbow window must be >= 10s`);
    }
    for (const gw of durSchedule.goldenWindows) {
      assert.ok(gw.endAtMs - gw.startAtMs >= 10_000, `${dur}s golden window must be >= 10s`);
    }
    for (const lw of durSchedule.lightningWindows) {
      assert.ok(lw.endAtMs - lw.startAtMs >= 10_000, `${dur}s lightning window must be >= 10s`);
    }
  }

  // Construct controlled schedule asserting stacked multipliers respect MAX 5x cap (Golden 2 * Lightning 3 * Combo 2.5 = 15 -> capped at 5!)
  const syntheticSchedule = {
    seed: 1,
    startedAtMs: startedAt,
    rainbowWindows: [{ tileId: 't_15', startAtMs: startedAt + 1000, endAtMs: startedAt + 11000 }],
    goldenWindows: [{ tileId: 't_1', startAtMs: startedAt, endAtMs: startedAt + 50000 }],
    lightningWindows: [{ startAtMs: startedAt + 10000, endAtMs: startedAt + 20000, multiplier: 3 }],
    growthWaves: [
      {
        waveIndex: 1,
        triggerAtMs: startedAt + 25000,
        addedTiles: computeExpansionRings(board, 55, 1)[0],
      },
    ],
  };

  // Rainbow Wildcard test: t_4(R)-t_9(I)-t_14(*) = RIB/RID/RIG with 10s duration
  syntheticSchedule.rainbowWindows = [
    { tileId: 't_14', startAtMs: startedAt + 1000, endAtMs: startedAt + 11000 },
  ];
  const wildRes = resolveWordPathWithMods(board, ['t_4', 't_9', 't_14'], words, new Set(), {
    nowMs: startedAt + 2000,
    schedule: syntheticSchedule,
    modConfig,
    comboCount: 0,
    lastWordAtMs: null,
  });
  assert.equal(wildRes.valid, true, 'Rainbow wildcard must resolve valid dictionary word');
  assert.equal(wildRes.usedRainbow, true);
  assert.equal(board.tiles[14].letter, 'J', 'Wildcard must NEVER mutate underlying tile letter');

  // After 10s rainbow window expires, R-I-J must reject!
  const wildExpired = resolveWordPathWithMods(board, ['t_4', 't_9', 't_14'], words, new Set(), {
    nowMs: startedAt + 12500,
    schedule: syntheticSchedule,
    modConfig,
  });
  assert.equal(wildExpired.valid, false, 'Expired rainbow wildcard must no longer act as wildcard');

  // Stacked Golden (2x) + Lightning (3x) + Combo streak (2.5x) MUST clamp strictly to 5x!
  const stackedRes = resolveWordPathWithMods(board, ['t_0', 't_1', 't_2', 't_3'], words, new Set(), {
    nowMs: startedAt + 12000, // inside Lightning 10s window + on Golden t_1
    schedule: syntheticSchedule,
    modConfig,
    comboCount: 3,
    lastWordAtMs: startedAt + 10000,
  });
  assert.equal(stackedRes.valid, true);
  assert.equal(stackedRes.usedGolden, true);
  assert.equal(stackedRes.inLightningRound, true);
  assert.equal(stackedRes.multiplier, MAX_GRIDIT_MULTIPLIER, 'Combined multiplier MUST clamp strictly at 5x');

  // Growing Grid snapshot preserves original/authored tiles & adds new ring after triggerAtMs
  const beforeGrowth = getBoardSnapshotAtTime(board, syntheticSchedule, startedAt + 15000);
  const afterGrowth = getBoardSnapshotAtTime(board, syntheticSchedule, startedAt + 26000);
  assert.equal(beforeGrowth.board.tiles.length, 16);
  assert.ok(afterGrowth.board.tiles.length > 16);
  for (let i = 0; i < 4; i++) {
    assert.equal(afterGrowth.board.tiles[i].letter, letters[i], 'Authored tiles preserved during Growing Grid');
  }

  console.log('3. Testing Multilingual Pack Architecture & Ranked Language Standardization...');
  assert.ok(GRIDIT_LANGUAGES.some((l) => l.code === 'en' && l.installed));
  const rankedLang = resolveModeLanguage('es', 'ranked');
  assert.equal(rankedLang.language, 'en', 'Ranked mode must standardize on English');
  assert.equal(rankedLang.forcedStandard, true);

  console.log('ALL MILESTONE 5 VERIFICATION TESTS PASSED!');
}

run();
