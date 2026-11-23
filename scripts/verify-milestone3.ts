import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  GridItCustomTemplate,
  canPlaceWordOnTemplate,
  completeBoardFromTemplate,
  validateCustomTemplate,
} from '../shared/gridit/editor.js';
import { validateWordPath } from '../shared/gridit/engine.js';
import {
  analyzeBoardFairness,
  compareBoardsFairness,
  computeNormalizedScore,
} from '../shared/gridit/fairness.js';
import { evaluateQuotaProgress, getBoardQuotas } from '../shared/gridit/quotas.js';
import { GRIDIT_SHAPES, buildShapeTopology } from '../shared/gridit/shapes.js';

function loadEnDict() {
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

function buildValidHeartTemplate(words: Set<string>): GridItCustomTemplate {
  const topo = buildShapeTopology('heart', 'medium');
  const byId = new Map(topo.tiles.map((t) => [t.id, t]));
  const quotas = getBoardQuotas('heart', 'medium');
  const wordBank: Record<number, string[]> = {
    3: ['ART', 'CAT', 'EAR', 'TEA', 'RAT', 'SEA', 'SET', 'MAP', 'ARE', 'TAR'],
    4: ['STAR', 'RATE', 'EAST', 'TEAR', 'REST', 'SEAT', 'GLOW'],
    5: ['HEART', 'STARE', 'GREAT', 'GLEAM', 'CROWN'],
    6: ['MASTER', 'STREAM', 'GALAXY', 'PUZZLE'],
  };

  const tpl: GridItCustomTemplate = {
    id: 'test_heart_tpl',
    name: 'Valid Heart Template',
    shapeId: 'heart',
    sizeId: 'medium',
    language: 'en',
    authoredTiles: {},
    authoredWords: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const used = new Set<string>();
  const findCompatiblePath = (word: string): string[] | null => {
    if (used.size < Math.floor(topo.tiles.length * 0.5)) {
      for (const start of topo.tiles) {
        if (used.has(start.id)) continue;
        const p = [start.id];
        const v = new Set([start.id]);
        const dfs = (): boolean => {
          if (p.length === word.length) return true;
          const curr = byId.get(p[p.length - 1])!;
          for (const n of curr.neighbors) {
            if (used.has(n) || v.has(n)) continue;
            v.add(n);
            p.push(n);
            if (dfs()) return true;
            p.pop();
            v.delete(n);
          }
          return false;
        };
        if (dfs()) return p;
      }
    }

    for (const start of topo.tiles) {
      const existing0 = tpl.authoredTiles[start.id];
      if (existing0 && existing0 !== word[0]) continue;
      const p = [start.id];
      const v = new Set([start.id]);
      const dfs = (idx: number): boolean => {
        if (idx === word.length) return true;
        const curr = byId.get(p[p.length - 1])!;
        for (const n of curr.neighbors) {
          if (v.has(n)) continue;
          const ex = tpl.authoredTiles[n];
          if (ex && ex !== word[idx]) continue;
          v.add(n);
          p.push(n);
          if (dfs(idx + 1)) return true;
          p.pop();
          v.delete(n);
        }
        return false;
      };
      if (dfs(1)) return p;
    }
    return null;
  };

  // Place longest words first so shorter words do not partition the board topology
  const orderedQuotas = [...quotas].sort((a, b) => b.minLength - a.minLength);
  for (const q of orderedQuotas) {
    const cands = wordBank[q.minLength].filter((w) => words.has(w));
    let placed = 0;
    for (const w of cands) {
      if (placed >= q.required) break;
      if (tpl.authoredWords.some((aw) => aw.word === w)) continue;
      const pathIds = findCompatiblePath(w);
      if (!pathIds) continue;
      pathIds.forEach((tid, idx) => {
        used.add(tid);
        tpl.authoredTiles[tid] = w[idx];
      });
      tpl.authoredWords.push({ id: `aw_${tpl.authoredWords.length}`, word: w, tilePath: pathIds });
      placed++;
    }
    assert.equal(placed, q.required, `Must satisfy ${q.label}`);
  }
  return tpl;
}

function run() {
  const { words, prefixes } = loadEnDict();

  console.log('1. Testing data-driven quotas across Small/Medium/Large boards (including 7+ words)...');
  const smallQ = getBoardQuotas('square', 'small');
  const medQ = getBoardQuotas('heart', 'medium');
  const largeQ = getBoardQuotas('heart', 'large');
  assert.ok(smallQ.length === 3);
  assert.ok(medQ.length === 4);
  assert.ok(largeQ.some((q) => q.minLength >= 7), 'Large boards must support 7+ letter word quotas');

  const partialProg = evaluateQuotaProgress(['ART', 'CAT', 'SUN'], 'heart', 'medium');
  assert.equal(partialProg.allMet, false);

  console.log('2. Testing manual placement validation & intersection conflict detection...');
  const tpl = buildValidHeartTemplate(words);
  const fullCheck = validateCustomTemplate(tpl, words);
  assert.equal(fullCheck.valid, true, `Expected valid template, errors: ${fullCheck.errors.join('; ')}`);

  // Intersection conflict: t_0 already holds a letter from first word; try placing conflicting letter
  const firstWord = tpl.authoredWords[0];
  const conflictingChar = firstWord.word[0] === 'A' ? 'B' : 'A';
  const conflictCandidate = `${conflictingChar}OE`;
  const topo = buildShapeTopology('heart', 'medium');
  const firstNode = topo.tiles.find((t) => t.id === firstWord.tilePath[0])!;
  const secondNode = topo.tiles.find((t) => t.id === firstNode.neighbors[0])!;
  const thirdNode = topo.tiles.find((t) => t.neighbors.includes(secondNode.id) && t.id !== firstNode.id)!;
  const conflictCheck = canPlaceWordOnTemplate(
    'heart',
    'medium',
    tpl.authoredTiles,
    tpl.authoredWords,
    words.has(conflictCandidate) ? conflictCandidate : 'ZOE',
    [firstNode.id, secondNode.id, thirdNode.id],
    words
  );
  assert.equal(conflictCheck.ok, false, 'Conflicting intersection letter must be rejected');

  console.log('3. Testing runtime filler completion preserves 100% authored tiles & fills all shapes...');
  const completed = completeBoardFromTemplate(tpl, {
    seed: 99,
    dictionary: words,
    prefixSet: prefixes,
  });
  assert.equal(completed.board.tiles.length, 37);
  assert.ok(completed.board.tiles.every((t) => /^[A-Z]$/.test(t.letter)), 'No empty cells allowed after completion');
  assert.ok(
    completed.board.tiles.every((t) => [0, 90, 180, 270].includes(t.rotationDeg ?? -1)),
    'Completed board must assign deterministic die orientations'
  );
  // Every authored tile & word must remain intact & playable
  for (const [tid, ch] of Object.entries(tpl.authoredTiles)) {
    const found = completed.board.tiles.find((t) => t.id === tid);
    assert.equal(found?.letter, ch, `Authored letter at ${tid} must never change`);
  }
  for (const aw of tpl.authoredWords) {
    const val = validateWordPath(completed.board, aw.tilePath, words, new Set());
    assert.equal(val.valid, true, `Authored word ${aw.word} must remain valid after completion`);
  }

  // Test completion across all 7 shapes
  for (const shape of GRIDIT_SHAPES) {
    const blankTpl: GridItCustomTemplate = {
      id: `s_${shape.id}`,
      name: shape.name,
      shapeId: shape.id,
      sizeId: 'small',
      language: 'en',
      authoredTiles: { t_0: 'S', t_1: 'T' },
      authoredWords: [],
      createdAt: 1,
      updatedAt: 1,
    };
    const res = completeBoardFromTemplate(blankTpl, { seed: 42, dictionary: words, prefixSet: prefixes });
    assert.equal(res.board.tiles[0].letter, 'S');
    assert.equal(res.board.tiles[1].letter, 'T');
    assert.ok(res.board.tiles.every((t) => /^[A-Z]$/.test(t.letter)));
  }

  console.log('4. Testing Board Fairness Engine & normalized comparative scoring...');
  const completedB = completeBoardFromTemplate(tpl, {
    seed: 777,
    dictionary: words,
    prefixSet: prefixes,
  });
  const cmp = compareBoardsFairness(completed.board, completedB.board, words, prefixes);
  assert.ok(cmp.reportA.wordCount >= 10);
  assert.ok(cmp.reportA.maxScorePotential >= 10);
  assert.ok(cmp.potentialRatio > 0 && cmp.potentialRatio <= 1);
  assert.ok(computeNormalizedScore(20, 100) === 20);
  assert.ok(computeNormalizedScore(20, 50) > computeNormalizedScore(20, 100));

  console.log('ALL MILESTONE 3 VERIFICATION TESTS PASSED!');
}

run();
