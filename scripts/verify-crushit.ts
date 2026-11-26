import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
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
  createTilePowerUp,
  getEarnedPowerUpForWordLength,
  getPowerUpAffectedCoords,
} from '../shared/crushit/powerUpConfig.js';
import { calculateWordScore } from '../shared/crushit/scoringConfig.js';
import { CRUSHIT_STAGES, CRUSHIT_TOTAL_STAGES } from '../shared/crushit/stagesCatalog.js';
import { buildCrushItTrieFromWords } from '../shared/crushit/trieSolver.js';
import { CrushItBoardGrid, CrushItTile, TilePowerUp } from '../shared/crushit/types.js';
import { HUB_GAME_TILES, REGISTERED_GAMES } from '../shared/gameRegistry.js';
import { CrushItStateStore } from '../server/games/crushit/CrushItStateStore.js';

function makeDeterministicBoard(
  letters: string[][],
  powerUps: Record<string, TilePowerUp> = {}
): CrushItBoardGrid {
  let seq = 1;
  return letters.map((row, r) =>
    row.map((letter, c): CrushItTile => ({
      id: `det_${seq++}`,
      letter,
      category: getLetterCategory(letter),
      color: getLetterColor(letter),
      row: r,
      col: c,
      powerUp: powerUps[`${r},${c}`] ?? null,
      fallDistance: 0,
      isNew: false,
      justCreatedPowerUp: false,
    }))
  );
}

async function main() {
  console.log('=== Verifying CrushIt — Integrated Power-Ups & Move-Based Completion ===');

  // 1. Registry & exact spelling
  assert.equal(REGISTERED_GAMES.length, 6);
  assert.equal(HUB_GAME_TILES.length, 6);
  assert.deepEqual(
    REGISTERED_GAMES.map((g) => g.name),
    ['ChainIt', 'GridIt', 'GuessIt', 'TwistIt', 'ChangeIt', 'CrushIt']
  );
  console.log('✓ 1. Game registry has exactly 6 games with exact spelling "CrushIt"');

  // 2. All 50 stages intact
  assert.equal(CRUSHIT_TOTAL_STAGES, 50);
  assert.equal(CRUSHIT_STAGES.length, 50);
  console.log('✓ 2. All 50 single-player stages preserved');

  // 3. Dictionary + Trie
  const dictPath = path.resolve(process.cwd(), 'public', 'dictionaries', 'en.txt');
  const words = new Set<string>();
  for (const line of fs.readFileSync(dictPath, 'utf8').split(/\r?\n/)) {
    const clean = line.trim().toUpperCase();
    if (clean.length >= 3 && clean.length <= 15) words.add(clean);
  }
  const trie = buildCrushItTrieFromWords(words, 6);

  // 4. Weighted letter distribution + strict color classification + Line Blast 50/50 orientation
  const counts = { vowel: 0, common: 0, uncommon: 0, rare: 0 };
  for (let i = 0; i < 30000; i++) {
    const s = sampleWeightedLetter();
    counts[s.category]++;
    assert.equal(s.color, getLetterColor(s.letter));
  }
  assert.ok(Math.abs((counts.vowel / 30000) * 100 - 40) < 1.8);
  assert.ok(Math.abs((counts.common / 30000) * 100 - 40) < 1.8);

  let rowOrient = 0;
  let colOrient = 0;
  for (let i = 0; i < 4000; i++) {
    const lb = createTilePowerUp('line_blast');
    if (lb.orientation === 'row') rowOrient++;
    else if (lb.orientation === 'col') colOrient++;
  }
  assert.ok(Math.abs(rowOrient - colOrient) < 250, `Line Blast orientation should be ~50/50 (${rowOrient}/${colOrient})`);
  console.log('✓ 3. Weighted letter distribution, strict colors & 50/50 Line Blast orientation verified');

  // 5. Integrated power-up creation: PLANET -> Word Bomb with letter 'T', other 5 letters destroyed, does NOT self-detonate
  const gridLetters = [
    ['S', 'T', 'R', 'E', 'A', 'M', 'Q', 'U'],
    ['B', 'L', 'O', 'K', 'G', 'F', 'X', 'D'],
    ['C', 'R', 'E', 'V', 'I', 'S', 'Z', 'H'],
    ['W', 'R', 'D', 'B', 'O', 'G', 'J', 'K'],
    ['P', 'L', 'A', 'N', 'E', 'T', 'F', 'S'],
    ['I', 'V', 'M', 'U', 'N', 'R', 'A', 'I'],
    ['G', 'H', 'Y', 'A', 'T', 'K', 'I', 'N'],
    ['X', 'S', 'O', 'L', 'I', 'T', 'B', 'E'],
  ];
  const baseState = createCrushItGameState(1, trie);
  const s0 = { ...baseState, board: makeDeterministicBoard(gridLetters) };

  const planetPath = [
    { row: 4, col: 0 },
    { row: 4, col: 1 },
    { row: 4, col: 2 },
    { row: 4, col: 3 },
    { row: 4, col: 4 },
    { row: 4, col: 5 },
  ];
  const planetRes = submitWordMove(s0, planetPath, words, trie);
  assert.equal(planetRes.accepted, true);
  assert.equal(planetRes.event?.createdPowerUp?.powerUp.type, 'word_bomb');
  assert.equal(planetRes.event?.createdPowerUp?.letter, 'T');
  assert.equal(planetRes.event?.activations.length, 0, 'Newly created power-up must NOT immediately activate');
  assert.equal(planetRes.event?.destroyedTiles.length, 5, '5 remaining letters destroyed while final tile transforms');
  const createdCoord = planetRes.event!.createdPowerUp!;
  const placedBomb = planetRes.state.board[createdCoord.row][createdCoord.col];
  assert.equal(placedBomb.letter, 'T');
  assert.equal(placedBomb.powerUp?.type, 'word_bomb');
  assert.equal(planetRes.state.powerUpsCreated, 1);
  assert.equal(planetRes.state.powerUpsUsed, 0);
  // Ensure all newly refilled tiles are ordinary tiles
  for (const row of planetRes.state.board) {
    for (const t of row) {
      if (t.isNew) assert.equal(t.powerUp ?? null, null, 'Newly falling tiles must remain ordinary letters');
    }
  }
  console.log('✓ 4. PLANET creates Word Bomb on "T" without immediate detonation; other 5 letters destroyed');

  // 6. Automatic activation when using the power-up tile in a valid word (TRAIN) + no activation on invalid word
  // Place TRAIN starting from the Word Bomb 'T' at (4,5) -> R(5,5) -> A(5,6) -> I(6,6) -> N(6,7)
  const trainGrid = planetRes.state.board.map((r) => r.map((t) => ({ ...t })));
  trainGrid[5][5] = { ...trainGrid[5][5], letter: 'R', category: getLetterCategory('R'), color: getLetterColor('R'), powerUp: null };
  trainGrid[5][6] = { ...trainGrid[5][6], letter: 'A', category: getLetterCategory('A'), color: getLetterColor('A'), powerUp: null };
  trainGrid[6][6] = { ...trainGrid[6][6], letter: 'I', category: getLetterCategory('I'), color: getLetterColor('I'), powerUp: null };
  trainGrid[6][7] = { ...trainGrid[6][7], letter: 'N', category: getLetterCategory('N'), color: getLetterColor('N'), powerUp: null };
  const preTrainState = { ...planetRes.state, board: trainGrid };

  // Invalid word including Word Bomb 'T' must NOT activate it or consume a move
  const invalidWithBomb = submitWordMove(
    preTrainState,
    [
      { row: 4, col: 5 },
      { row: 5, col: 5 },
      { row: 6, col: 7 },
    ],
    words,
    trie
  );
  assert.equal(invalidWithBomb.accepted, false);
  assert.equal(invalidWithBomb.state.movesRemaining, preTrainState.movesRemaining);
  assert.equal(invalidWithBomb.state.board[4][5].powerUp?.type, 'word_bomb');

  // Valid 5-letter word TRAIN using Word Bomb 'T' -> detonates Word Bomb AND creates Cross Blast on final ordinary letter 'N'
  const trainRes = submitWordMove(
    preTrainState,
    [
      { row: 4, col: 5 },
      { row: 5, col: 5 },
      { row: 5, col: 6 },
      { row: 6, col: 6 },
      { row: 6, col: 7 },
    ],
    words,
    trie
  );
  assert.equal(trainRes.accepted, true);
  assert.equal(trainRes.event?.activations.length, 1);
  assert.equal(trainRes.event?.activations[0].type, 'word_bomb');
  assert.equal(trainRes.event?.createdPowerUp?.powerUp.type, 'cross_blast');
  assert.equal(trainRes.event?.createdPowerUp?.letter, 'N');
  assert.equal(trainRes.state.movesRemaining, preTrainState.movesRemaining - 1, 'Auto power-up must not consume extra moves');
  assert.equal(trainRes.state.powerUpsUsed, 1);
  assert.equal(trainRes.state.powerUpsCreated, 2);
  console.log('✓ 5. Using Word Bomb "T" in TRAIN auto-detonates 3x3 blast + creates Cross Blast on "N" with 1 move');

  // 7. Chain reaction test: Line Blast -> Word Bomb -> Cross Blast -> Letter Purge (each activates once, no duplicate tile counting)
  const chainBoard = makeDeterministicBoard(gridLetters, {
    '4,0': { type: 'line_blast', orientation: 'row' }, // 'P' hits row 4 -> hits (4,3) 'N' Word Bomb
    '4,3': { type: 'word_bomb' },                      // 3x3 around (4,3) -> hits (3,3) 'B' Cross Blast
    '3,3': { type: 'cross_blast' },                    // row 3 + col 3 -> hits (3,1) 'R' Letter Purge
    '3,1': { type: 'letter_purge' },                   // destroys all 'R' tiles across board
  });
  // Make (4,0)->(4,1)->(4,2) = PLA? No, let's make (4,0)='C', (4,1)='A', (4,2)='T'
  chainBoard[4][0].letter = 'C';
  chainBoard[4][1].letter = 'A';
  chainBoard[4][2].letter = 'T';

  const chainState = { ...baseState, board: chainBoard };
  const chainRes = submitWordMove(
    chainState,
    [
      { row: 4, col: 0 },
      { row: 4, col: 1 },
      { row: 4, col: 2 },
    ],
    words,
    trie
  );
  assert.equal(chainRes.accepted, true);
  assert.equal(chainRes.event?.activations.length, 4, 'All 4 chained power-ups must trigger exactly once');
  assert.equal(chainRes.event?.chainReactionSize, 4);
  assert.equal(chainRes.state.largestChainReaction, 4);
  assert.equal(chainRes.state.powerUpsUsed, 4);
  assert.equal(chainRes.state.movesRemaining, chainState.movesRemaining - 1);
  // Check no duplicate destroyed tile coords
  const destroyedCoordsUnique = new Set(
    chainRes.event!.destroyedTiles.map((d) => `${d.row},${d.col}`)
  );
  assert.equal(destroyedCoordsUnique.size, chainRes.event!.destroyedTiles.length, 'No duplicate destroyed tiles');
  // Check Mega Blast area is strictly 5x5 (max 25, clipped at boundary)
  assert.equal(getPowerUpAffectedCoords(chainBoard, { type: 'mega_blast', row: 3, col: 3 }).length, 25);
  assert.equal(getPowerUpAffectedCoords(chainBoard, { type: 'mega_blast', row: 0, col: 0 }).length, 9);
  console.log('✓ 6. 4-step chain reaction (Line -> Bomb -> Cross -> Purge) + 5x5 Mega Blast verified without duplicates');

  // 8. Multiple power-ups in ONE word where EVERY tile is an existing power-up (all resolve + new power-up spawns at final vacated slot)
  const allPuBoard = makeDeterministicBoard(gridLetters, {
    '0,0': { type: 'line_blast', orientation: 'col' }, // S
    '0,1': { type: 'word_bomb' },                      // T
    '0,2': { type: 'line_blast', orientation: 'row' }, // R
    '0,3': { type: 'cross_blast' },                    // E
    '0,4': { type: 'word_bomb' },                      // A
    '0,5': { type: 'line_blast', orientation: 'col' }, // M
  });
  const allPuState = { ...baseState, board: allPuBoard };
  const streamRes = submitWordMove(
    allPuState,
    [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
      { row: 0, col: 4 },
      { row: 0, col: 5 },
    ],
    words,
    trie
  );
  assert.equal(streamRes.accepted, true);
  assert.equal(streamRes.event?.activations.length, 6, 'All 6 existing power-ups must activate');
  assert.equal(streamRes.event?.createdPowerUp?.powerUp.type, 'word_bomb', '6-letter STREAM creates new Word Bomb');
  assert.equal(streamRes.event?.createdPowerUp?.letter, 'M', 'Final tile letter M preserved');
  const newBombPos = streamRes.event!.createdPowerUp!;
  assert.equal(
    streamRes.state.board[newBombPos.row][newBombPos.col].powerUp?.type,
    'word_bomb',
    'Newly created power-up must survive the current destruction sequence'
  );
  console.log('✓ 7. All-power-up word activates all existing blasts and spawns surviving new Word Bomb at vacated slot');

  // 9. Reshuffle preserves power-up tiles & orientations without activating them
  const shufRes = manualReshuffleBoard(planetRes.state, trie);
  assert.equal(shufRes.accepted, true);
  const survivingBombs = shufRes.state.board.flat().filter((t) => t.powerUp?.type === 'word_bomb');
  assert.equal(survivingBombs.length, 1, 'Reshuffle must preserve existing power-up tiles');
  assert.equal(survivingBombs[0].letter, 'T');

  const deadBoard = makeDeterministicBoard(
    Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 'Q')),
    { '2,2': { type: 'line_blast', orientation: 'col' } }
  );
  const recovered = ensurePlayableBoard(deadBoard, trie, 900);
  assert.equal(recovered.reshuffled, true);
  assert.equal(trie.hasPlayableWord(recovered.board), true);
  const keptLine = recovered.board.flat().filter((t) => t.powerUp?.type === 'line_blast');
  assert.equal(keptLine.length, 1);
  assert.equal(keptLine[0].powerUp?.orientation, 'col', 'Line Blast orientation preserved through dead-board recovery');
  console.log('✓ 8. Gravity, manual reshuffle & dead-board recovery preserve power-up tiles and orientations');

  // 10. Move-based stage completion: QUALIFIED keeps playing until moves === 0, then VICTORY / FAILURE
  let moveState = createCrushItGameState(1, trie);
  // Stage 1: goal 260 pts + 4 words, 18 moves. Let's simulate 4 valid words using the Trie solver!
  for (let step = 0; step < 4; step++) {
    const found = trie.findPlayableWords(moveState.board, 20, 4);
    const picked = found[0] ?? trie.findPlayableWords(moveState.board, 5, 3)[0];
    assert.ok(picked, 'Playable board must always have a word');
    const r = submitWordMove(moveState, picked.path, words, trie);
    assert.equal(r.accepted, true);
    moveState = r.state;
  }
  // If score still < 260, play until objectivesComplete while moves > 0
  while (!moveState.objectivesComplete && moveState.movesRemaining > 1) {
    const picked =
      trie.findPlayableWords(moveState.board, 20, 4)[0] ??
      trie.findPlayableWords(moveState.board, 5, 3)[0];
    const r = submitWordMove(moveState, picked.path, words, trie);
    assert.equal(r.accepted, true);
    moveState = r.state;
  }
  assert.equal(moveState.objectivesComplete, true, 'Objectives should complete before running out of moves on Stage 1');
  assert.ok(moveState.movesRemaining > 0, 'Moves must still remain');
  assert.equal(
    moveState.lifecyclePhase,
    'QUALIFIED',
    'Completing objectives with remaining moves MUST enter QUALIFIED, NOT terminate early!'
  );

  const scoreAtQualification = moveState.score;
  // Continue playing ALL remaining moves until movesRemaining === 0
  while (moveState.movesRemaining > 0) {
    assert.equal(moveState.lifecyclePhase, 'QUALIFIED');
    const picked = trie.findPlayableWords(moveState.board, 5, 3)[0];
    const r = submitWordMove(moveState, picked.path, words, trie);
    assert.equal(r.accepted, true);
    moveState = r.state;
  }
  assert.equal(moveState.movesRemaining, 0);
  assert.equal(moveState.lifecyclePhase, 'VICTORY', 'Must transition to VICTORY only when moves === 0');
  assert.ok(moveState.score > scoreAtQualification, 'Score must keep accumulating after QUALIFIED without cap');

  // Verify FAILURE when moves === 0 and objectives incomplete
  const failSetup = { ...createCrushItGameState(1, trie), movesRemaining: 1 };
  const oneWord = trie.findPlayableWords(failSetup.board, 5, 3)[0];
  const failRes = submitWordMove(failSetup, oneWord.path, words, trie);
  assert.equal(failRes.accepted, true);
  assert.equal(failRes.state.movesRemaining, 0);
  assert.equal(failRes.state.objectivesComplete, false);
  assert.equal(failRes.state.lifecyclePhase, 'FAILURE');
  console.log(
    `✓ 9. Move-based lifecycle verified (PLAYING -> QUALIFIED @ ${scoreAtQualification} pts -> continued to VICTORY @ ${moveState.score} pts; FAILURE on unmet final move)`
  );

  // 11. Progression persistence sanity check
  const store = new CrushItStateStore({ forceLocalMemory: true });
  const saved = await store.recordStageResult('pw_player', {
    stageNumber: 1,
    completed: true,
    score: moveState.score,
    stars: moveState.starsEarned,
    movesRemaining: 0,
    wordsFormed: moveState.wordsFormed,
    longestWordLength: moveState.longestWordLength,
    powerUpsUsed: moveState.powerUpsUsed,
  });
  assert.equal(saved.highestUnlockedStage, 2);
  assert.equal(saved.stages[1].bestScore, moveState.score);
  console.log('✓ 10. Progression persistence & monotonic unlocking verified');

  // Word length power-up mapping check
  assert.equal(getEarnedPowerUpForWordLength(3), null);
  assert.equal(getEarnedPowerUpForWordLength(4), 'line_blast');
  assert.equal(getEarnedPowerUpForWordLength(5), 'cross_blast');
  assert.equal(getEarnedPowerUpForWordLength(6), 'word_bomb');
  assert.equal(getEarnedPowerUpForWordLength(7), 'letter_purge');
  assert.equal(getEarnedPowerUpForWordLength(8), 'mega_blast');
  assert.ok(calculateWordScore(['P', 'L', 'A', 'N', 'E', 'T']) > calculateWordScore(['C', 'A', 'T']) * 4);

  console.log('=== ALL INTEGRATED CRUSHIT VERIFICATION CHECKS PASSED ===');
}

main().catch((err) => {
  console.error('CrushIt verification failed:', err);
  process.exit(1);
});
