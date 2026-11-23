import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_GRIDIT_SCORING,
  findBoardWords,
  generatePlayableBoard,
  scoreGridItWord,
  validateWordPath,
} from '../shared/gridit/engine.js';
import {
  GRIDIT_SHAPES,
  buildShapeTopology,
} from '../shared/gridit/shapes.js';
import { GridItBoard, GridItBoardSize } from '../shared/gridit/types.js';

const SIZES: GridItBoardSize[] = ['small', 'medium', 'large'];

function run() {
  console.log('1. Testing English dictionary asset (public/dictionaries/en.txt)...');
  const dictPath = path.resolve(process.cwd(), 'public', 'dictionaries', 'en.txt');
  assert.ok(fs.existsSync(dictPath), 'public/dictionaries/en.txt must exist');

  const lines = fs.readFileSync(dictPath, 'utf8').split(/\r?\n/).filter(Boolean);
  assert.ok(lines.length > 50000, `Expected >50,000 English words, got ${lines.length}`);

  const dictionary = new Set<string>();
  const prefixSet = new Set<string>();
  for (const w of lines) {
    assert.match(w, /^[A-Z]{3,15}$/, `Unexpected dictionary token: ${w}`);
    dictionary.add(w);
    const maxP = Math.min(w.length, 6);
    for (let i = 1; i <= maxP; i++) prefixSet.add(w.slice(0, i));
  }
  assert.ok(dictionary.has('GLEAM') && dictionary.has('GRID'), 'Common words must exist');

  console.log('2. Testing all 7 shapes × 3 sizes (21 topologies) for connectivity & symmetry...');
  for (const shape of GRIDIT_SHAPES) {
    for (const sizeId of SIZES) {
      const topo = buildShapeTopology(shape.id, sizeId);
      const expectedCount = shape.sizes[sizeId].tileCount;
      assert.equal(
        topo.tiles.length,
        expectedCount,
        `${shape.id}/${sizeId}: expected ${expectedCount} tiles, got ${topo.tiles.length}`
      );

      const byId = new Map(topo.tiles.map((t) => [t.id, t]));
      assert.equal(byId.size, topo.tiles.length, 'Tile IDs must be unique');

      for (const tile of topo.tiles) {
        assert.ok(!tile.neighbors.includes(tile.id), `${shape.id}/${sizeId}: self-loop on ${tile.id}`);
        assert.ok(tile.neighbors.length > 0, `${shape.id}/${sizeId}: isolated tile ${tile.id}`);
        for (const nId of tile.neighbors) {
          const neighbor = byId.get(nId);
          assert.ok(neighbor, `${shape.id}/${sizeId}: missing neighbor ${nId}`);
          assert.ok(
            neighbor.neighbors.includes(tile.id),
            `${shape.id}/${sizeId}: asymmetric edge ${tile.id} <-> ${nId}`
          );
        }
      }

      // BFS connectivity check (must be a single connected component)
      const visited = new Set<string>();
      const queue = [topo.tiles[0].id];
      visited.add(topo.tiles[0].id);
      while (queue.length > 0) {
        const cur = byId.get(queue.shift()!)!;
        for (const nId of cur.neighbors) {
          if (!visited.has(nId)) {
            visited.add(nId);
            queue.push(nId);
          }
        }
      }
      assert.equal(
        visited.size,
        topo.tiles.length,
        `${shape.id}/${sizeId}: disconnected graph (${visited.size}/${topo.tiles.length})`
      );
    }
  }

  // Spot check mockup-aligned counts
  assert.equal(buildShapeTopology('heart', 'medium').tiles.length, 37);
  assert.equal(buildShapeTopology('square', 'medium').tiles.length, 25);
  assert.equal(buildShapeTopology('hexagon', 'medium').tiles.length, 37);
  assert.equal(buildShapeTopology('triangle', 'small').tiles.length, 15);

  console.log('3. Testing word path validation, adjacency, reuse & configurable scoring...');
  const squareTopo = buildShapeTopology('square', 'small');
  const testLetters = [
    'C', 'A', 'T', 'S',
    'R', 'E', 'A', 'D',
    'B', 'I', 'N', 'G',
    'Z', 'X', 'Q', 'J',
  ];
  const testBoard: GridItBoard = {
    id: 'test_sq',
    shapeId: 'square',
    sizeId: 'small',
    language: 'en',
    tiles: squareTopo.tiles.map((t, i) => ({ ...t, letter: testLetters[i] })),
    bounds: squareTopo.bounds,
    tileRadius: squareTopo.tileRadius,
    seed: 1,
  };

  // Valid horizontal path: C(0)-A(1)-T(2)-S(3) = CATS
  const resCats = validateWordPath(testBoard, ['t_0', 't_1', 't_2', 't_3'], dictionary, new Set());
  assert.equal(resCats.valid, true);
  assert.equal(resCats.word, 'CATS');
  assert.equal(resCats.points, DEFAULT_GRIDIT_SCORING.pointsByLength[4]);

  // Valid diagonal path: A(1)-R(4)-E(5) = ARE
  const resAre = validateWordPath(testBoard, ['t_1', 't_4', 't_5'], dictionary, new Set());
  assert.equal(resAre.valid, true);
  assert.equal(resAre.word, 'ARE');

  // Non-adjacent jump rejected
  const resJump = validateWordPath(testBoard, ['t_0', 't_3', 't_15'], dictionary, new Set());
  assert.equal(resJump.valid, false);
  assert.equal(resJump.reason, 'not_adjacent');

  // Reused tile rejected
  const resDupTile = validateWordPath(testBoard, ['t_0', 't_1', 't_0'], dictionary, new Set());
  assert.equal(resDupTile.valid, false);
  assert.equal(resDupTile.reason, 'duplicate_tile');

  // Too short rejected
  const resShort = validateWordPath(testBoard, ['t_0', 't_1'], dictionary, new Set());
  assert.equal(resShort.valid, false);
  assert.equal(resShort.reason, 'too_short');

  // Non-dictionary word rejected: Z(12)-X(13)-Q(14)
  const resNotWord = validateWordPath(testBoard, ['t_12', 't_13', 't_14'], dictionary, new Set());
  assert.equal(resNotWord.valid, false);
  assert.equal(resNotWord.reason, 'not_in_dictionary');

  // Already found rejected
  const resAlready = validateWordPath(
    testBoard,
    ['t_0', 't_1', 't_2', 't_3'],
    dictionary,
    new Set(['CATS'])
  );
  assert.equal(resAlready.valid, false);
  assert.equal(resAlready.reason, 'already_found');

  // Configurable scoring check
  assert.equal(
    scoreGridItWord('CATS', {
      minWordLength: 3,
      pointsByLength: { 3: 5, 4: 10 },
      extraLetterPoints: 4,
      provisional: false,
    }),
    10
  );

  console.log('4. Testing playable board generation & bounded solver across shaped boards...');
  for (const shapeId of ['heart', 'star', 'hexagon', 'triangle'] as const) {
    const board = generatePlayableBoard(shapeId, 'medium', {
      seed: 4242,
      dictionary,
      prefixSet,
    });
    assert.ok(board.tiles.every((t) => /^[A-Z]$/.test(t.letter)), 'All tiles filled upfront');
    const solved = findBoardWords(board, dictionary, prefixSet, {
      maxWords: 50,
      maxVisits: 5000,
    });
    assert.ok(solved.length >= 10, `${shapeId}/medium should have >=10 words, got ${solved.length}`);
    for (const item of solved.slice(0, 10)) {
      const check = validateWordPath(board, item.tilePath, dictionary, new Set());
      assert.equal(check.valid, true, `Solver path for ${item.word} must validate cleanly`);
    }
  }

  console.log('ALL MILESTONE 2 VERIFICATION TESTS PASSED!');
}

run();
