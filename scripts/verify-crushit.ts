import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  activatePowerUpMove,
  createCrushItGameState,
  ensurePlayableBoard,
  evaluateWordPreview,
  manualReshuffleBoard,
  submitWordMove,
} from '../shared/crushit/engine.js';
import {
  getLetterCategory,
  getLetterColor,
  sampleWeightedLetter,
} from '../shared/crushit/letterConfig.js';
import {
  getEarnedPowerUpForWordLength,
  getPowerUpAffectedCoords,
} from '../shared/crushit/powerUpConfig.js';
import { calculateWordScore } from '../shared/crushit/scoringConfig.js';
import { CRUSHIT_STAGES, CRUSHIT_TOTAL_STAGES } from '../shared/crushit/stagesCatalog.js';
import { buildCrushItTrieFromWords } from '../shared/crushit/trieSolver.js';
import { CrushItBoardGrid, CrushItTile } from '../shared/crushit/types.js';
import { HUB_GAME_TILES, REGISTERED_GAMES } from '../shared/gameRegistry.js';
import { CrushItStateStore } from '../server/games/crushit/CrushItStateStore.js';

function makeDeterministicBoard(letters: string[][]): CrushItBoardGrid {
  let seq = 1;
  return letters.map((row, r) =>
    row.map((letter, c): CrushItTile => ({
      id: `det_${seq++}`,
      letter,
      category: getLetterCategory(letter),
      color: getLetterColor(letter),
      row: r,
      col: c,
      fallDistance: 0,
      isNew: false,
    }))
  );
}

async function main() {
  console.log('=== Verifying Enscribe Game 06: CrushIt ===');

  // 1. Registry & exact spelling
  assert.equal(REGISTERED_GAMES.length, 6, 'Enscribe must contain exactly SIX registered games');
  assert.equal(HUB_GAME_TILES.length, 6, 'Enscribe Hub must contain exactly SIX game tiles');
  const gameNames = REGISTERED_GAMES.map((g) => g.name);
  assert.deepEqual(gameNames, ['ChainIt', 'GridIt', 'GuessIt', 'TwistIt', 'ChangeIt', 'CrushIt']);
  const crushTile = HUB_GAME_TILES.find((t) => t.gameId === 'crushit');
  assert.ok(crushTile, 'CrushIt hub tile must exist');
  assert.equal(crushTile.name, 'CrushIt', 'Official spelling must be exactly CrushIt');
  console.log('✓ 1. Game registry contains exactly 6 games with exact spelling "CrushIt"');

  // 2. All 50 stages configured cleanly
  assert.equal(CRUSHIT_TOTAL_STAGES, 50);
  assert.equal(CRUSHIT_STAGES.length, 50);
  for (let i = 0; i < 50; i++) {
    const st = CRUSHIT_STAGES[i];
    assert.equal(st.stageNumber, i + 1);
    assert.equal(st.boardSize, 8);
    assert.ok(st.scoreTarget > 0);
    assert.ok(st.maxMoves >= 14);
    assert.ok(st.objectives.length >= 2);
  }
  console.log('✓ 2. All 50 single-player stages (Stages 1–50) are configured');

  // 3. Weighted letter distribution & strict color classification
  const counts = { vowel: 0, common: 0, uncommon: 0, rare: 0 };
  const samples = 50000;
  for (let i = 0; i < samples; i++) {
    const s = sampleWeightedLetter();
    counts[s.category]++;
    assert.equal(s.color, getLetterColor(s.letter), 'Tile color must strictly match category');
  }
  const pct = {
    vowel: (counts.vowel / samples) * 100,
    common: (counts.common / samples) * 100,
    uncommon: (counts.uncommon / samples) * 100,
    rare: (counts.rare / samples) * 100,
  };
  assert.ok(Math.abs(pct.vowel - 40) < 1.5, `Vowel % out of bounds: ${pct.vowel}`);
  assert.ok(Math.abs(pct.common - 40) < 1.5, `Common % out of bounds: ${pct.common}`);
  assert.ok(Math.abs(pct.uncommon - 15) < 1.5, `Uncommon % out of bounds: ${pct.uncommon}`);
  assert.ok(Math.abs(pct.rare - 5) < 1.2, `Rare % out of bounds: ${pct.rare}`);

  for (const ch of 'AEIOU') assert.equal(getLetterColor(ch), 'pink');
  for (const ch of 'RSTNLDHCM') assert.equal(getLetterColor(ch), 'blue');
  for (const ch of 'BFGKPVWY') assert.equal(getLetterColor(ch), 'green');
  for (const ch of 'JQXZ') assert.equal(getLetterColor(ch), 'gold');
  console.log(
    `✓ 3. Weighted distribution verified (V:${pct.vowel.toFixed(1)}% C:${pct.common.toFixed(1)}% U:${pct.uncommon.toFixed(1)}% R:${pct.rare.toFixed(1)}%) & strict color rules`
  );

  // 4. Dictionary & Trie Solver performance
  const dictPath = path.resolve(process.cwd(), 'public', 'dictionaries', 'en.txt');
  const rawDict = fs.readFileSync(dictPath, 'utf8');
  const words = new Set<string>();
  for (const line of rawDict.split(/\r?\n/)) {
    const clean = line.trim().toUpperCase();
    if (clean.length >= 3 && clean.length <= 15) words.add(clean);
  }
  assert.ok(words.size > 100000, 'Expected full English dictionary');
  const t0 = performance.now();
  const trie = buildCrushItTrieFromWords(words, 6);
  const buildMs = performance.now() - t0;
  console.log(`✓ 4. Loaded ${words.size.toLocaleString()} words; Trie built in ${buildMs.toFixed(1)}ms (${trie.getNodeCount().toLocaleString()} nodes)`);

  // 5. Board generation, diagonal/irregular paths, invalid word rejection, gravity & refill
  const state1 = createCrushItGameState(1, trie);
  assert.equal(state1.board.length, 8);
  assert.equal(state1.board[0].length, 8);
  assert.ok(trie.hasPlayableWord(state1.board), 'Initial board must be playable');

  // Construct controlled board with diagonal/irregular word "CRUSHING" (8 letters)
  const customLetters = [
    ['C', 'A', 'T', 'S', 'E', 'R', 'O', 'N'],
    ['D', 'R', 'O', 'P', 'A', 'T', 'I', 'L'],
    ['M', 'L', 'U', 'S', 'H', 'I', 'N', 'G'],
    ['B', 'E', 'A', 'R', 'T', 'O', 'P', 'S'],
    ['F', 'O', 'R', 'M', 'S', 'A', 'N', 'D'],
    ['G', 'A', 'M', 'E', 'P', 'L', 'A', 'Y'],
    ['W', 'O', 'R', 'D', 'L', 'I', 'N', 'E'],
    ['Z', 'Q', 'X', 'J', 'K', 'V', 'Y', 'W'],
  ];
  const controlled = { ...state1, board: makeDeterministicBoard(customLetters) };

  // Test invalid submission does not consume moves
  const invalidRes = submitWordMove(
    controlled,
    [
      { row: 7, col: 0 },
      { row: 7, col: 1 },
      { row: 7, col: 2 },
    ],
    words,
    trie
  );
  assert.equal(invalidRes.accepted, false);
  assert.equal(invalidRes.state.movesRemaining, controlled.movesRemaining);

  // Test reused tile rejected
  const reusedPreview = evaluateWordPreview(
    controlled.board,
    [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 0 },
    ],
    words
  );
  assert.equal(reusedPreview.isValid, false);
  assert.equal(reusedPreview.reason, 'invalid_path');

  // Test diagonal + horizontal irregular path: C(0,0)->R(1,1)->U(2,2)->S(2,3)->H(2,4)->I(2,5)->N(2,6)->G(2,7) = CRUSHING (8 letters)
  const crushingPath = [
    { row: 0, col: 0 },
    { row: 1, col: 1 },
    { row: 2, col: 2 },
    { row: 2, col: 3 },
    { row: 2, col: 4 },
    { row: 2, col: 5 },
    { row: 2, col: 6 },
    { row: 2, col: 7 },
  ];
  const valid8 = submitWordMove(controlled, crushingPath, words, trie);
  assert.equal(valid8.accepted, true);
  assert.equal(valid8.event?.earnedPowerUp, 'mega_blast', '8-letter word must grant Mega Blast');
  assert.equal(valid8.state.inventory.mega_blast, 1);
  assert.equal(valid8.state.inventory.line_blast, 0, 'Must grant ONLY highest power-up');
  assert.equal(valid8.state.movesRemaining, controlled.movesRemaining - 1);
  assert.ok(trie.hasPlayableWord(valid8.state.board), 'Board must remain playable after refill');
  // Check gravity: in col 0, row 0 was destroyed so row 0 should be new and row 1 should still be 'D'
  assert.equal(valid8.state.board[0][0].isNew, true);
  assert.equal(valid8.state.board[1][0].letter, 'D');
  assert.equal(valid8.state.board[1][0].fallDistance, 0);
  // In col 2, row 2 was destroyed so old (1,2)='O' falls to (2,2), old (0,2)='T' falls to (1,2), (0,2) is new
  assert.equal(valid8.state.board[2][2].letter, 'O');
  assert.equal(valid8.state.board[2][2].fallDistance, 1);
  assert.equal(valid8.state.board[1][2].letter, 'T');
  assert.equal(valid8.state.board[1][2].fallDistance, 1);
  assert.equal(valid8.state.board[0][2].isNew, true);
  console.log('✓ 5. Diagonal/irregular paths, invalid rejection, gravity & weighted refill verified');

  // 6. Scoring scales meaningfully for longer words
  const score3 = calculateWordScore(['C', 'A', 'T']);
  const score6 = calculateWordScore(['C', 'A', 'S', 'T', 'L', 'E']);
  const score8 = calculateWordScore(['C', 'R', 'U', 'S', 'H', 'I', 'N', 'G']);
  assert.ok(score6 > score3 * 4, `Expected 6-letter (${score6}) >> 3-letter (${score3})`);
  assert.ok(score8 > score6 * 2, `Expected 8-letter (${score8}) >> 6-letter (${score6})`);
  console.log(`✓ 6. Scoring scaling verified (3-ltr=${score3}, 6-ltr=${score6}, 8-ltr=${score8})`);

  // 7. Word-length power-up progression
  assert.equal(getEarnedPowerUpForWordLength(3), null);
  assert.equal(getEarnedPowerUpForWordLength(4), 'line_blast');
  assert.equal(getEarnedPowerUpForWordLength(5), 'cross_blast');
  assert.equal(getEarnedPowerUpForWordLength(6), 'word_bomb');
  assert.equal(getEarnedPowerUpForWordLength(7), 'letter_purge');
  assert.equal(getEarnedPowerUpForWordLength(8), 'mega_blast');
  assert.equal(getEarnedPowerUpForWordLength(11), 'mega_blast');

  // Test every power-up target geometry & execution
  const seeded = {
    ...controlled,
    inventory: {
      line_blast: 2,
      cross_blast: 1,
      word_bomb: 1,
      letter_purge: 1,
      mega_blast: 1,
    },
  };
  assert.equal(
    getPowerUpAffectedCoords(seeded.board, { type: 'line_blast', row: 3, col: 3, orientation: 'row' }).length,
    8
  );
  assert.equal(
    getPowerUpAffectedCoords(seeded.board, { type: 'line_blast', row: 3, col: 3, orientation: 'col' }).length,
    8
  );
  assert.equal(
    getPowerUpAffectedCoords(seeded.board, { type: 'cross_blast', row: 3, col: 3 }).length,
    15
  );
  assert.equal(
    getPowerUpAffectedCoords(seeded.board, { type: 'word_bomb', row: 3, col: 3 }).length,
    9
  );
  const megaAffected = getPowerUpAffectedCoords(seeded.board, { type: 'mega_blast', row: 3, col: 3 });
  assert.equal(megaAffected.length, 31, '5x5 (25) + 6 ray extensions = 31 tiles');

  const pu1 = activatePowerUpMove(
    seeded,
    { type: 'line_blast', row: 2, col: 2, orientation: 'row' },
    trie
  );
  assert.equal(pu1.accepted, true);
  assert.equal(pu1.event?.destroyedTiles.length, 8);
  assert.equal(pu1.state.inventory.line_blast, 1);

  const pu2 = activatePowerUpMove(pu1.state, { type: 'letter_purge', row: 0, col: 0 }, trie);
  assert.equal(pu2.accepted, true);
  assert.ok((pu2.event?.destroyedTiles.length ?? 0) >= 1);

  const pu3 = activatePowerUpMove(pu2.state, { type: 'mega_blast', row: 4, col: 4 }, trie);
  assert.equal(pu3.accepted, true);
  assert.equal(pu3.event?.destroyedTiles.length, 31);
  console.log('✓ 7. All 5 word-length power-ups (Line, Cross, Bomb, Purge, Mega) verified');

  // 8. Automatic dead-board detection & reshuffle
  const deadLetters = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => 'Q')
  );
  const deadBoard = makeDeterministicBoard(deadLetters);
  const deadCheckStart = performance.now();
  assert.equal(trie.hasPlayableWord(deadBoard), false, 'All-Q board must be detected as dead');
  const deadCheckMs = performance.now() - deadCheckStart;
  const fixed = ensurePlayableBoard(deadBoard, trie, 1000);
  assert.equal(fixed.reshuffled, true);
  assert.equal(trie.hasPlayableWord(fixed.board), true, 'Recovered board must be playable');

  const manualShuf = manualReshuffleBoard(state1, trie);
  assert.equal(manualShuf.accepted, true);
  assert.equal(manualShuf.state.movesRemaining, state1.movesRemaining);
  assert.equal(manualShuf.state.score, state1.score);
  console.log(`✓ 8. Automatic dead-board solver (${deadCheckMs.toFixed(2)}ms) & reshuffle recovery verified`);

  // 9. Progression & unlocking persistence
  const store = new CrushItStateStore({ forceLocalMemory: true });
  const initialProg = await store.getProgress('test_player_crushit');
  assert.equal(initialProg.highestUnlockedStage, 1);

  const afterStage1 = await store.recordStageResult('test_player_crushit', {
    stageNumber: 1,
    completed: true,
    score: 520,
    stars: 3,
    movesRemaining: 12,
    wordsFormed: 5,
    longestWordLength: 6,
    powerUpsUsed: 1,
  });
  assert.equal(afterStage1.highestUnlockedStage, 2);
  assert.equal(afterStage1.completedStagesCount, 1);
  assert.equal(afterStage1.stages[1].bestScore, 520);

  // Replaying with lower score must never regress personal best or unlock
  const afterReplayLower = await store.recordStageResult('test_player_crushit', {
    stageNumber: 1,
    completed: true,
    score: 300,
    stars: 1,
    movesRemaining: 5,
    wordsFormed: 4,
    longestWordLength: 4,
    powerUpsUsed: 0,
  });
  assert.equal(afterReplayLower.highestUnlockedStage, 2);
  assert.equal(afterReplayLower.stages[1].bestScore, 520);
  assert.equal(afterReplayLower.stages[1].bestStars, 3);
  console.log('✓ 9. Progression unlocking and monotonic personal-best persistence verified');

  console.log('=== ALL CRUSHIT VERIFICATION CHECKS PASSED ===');
}

main().catch((err) => {
  console.error('CrushIt verification failed:', err);
  process.exit(1);
});
