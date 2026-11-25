import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase } from '../server/db/sqlite.js';
import { SqliteStorageRepository } from '../server/repositories/StorageRepository.js';
import { DEFAULT_ROOM_RULES, seedInitialData } from '../server/db/seed.js';
import { ChainClashEngine } from '../server/games/chain-clash/ChainClashEngine.js';
import {
  assignCustomPuzzlesDeranged,
  generateDerangementIndices,
  validateChainWords,
} from '../server/games/chain-clash/puzzleAssignment.js';
import { generateWordChain, getSyncOneWordClue } from '../server/games/chain-clash/clueProvider.js';

const testDbPath = path.resolve(process.cwd(), 'data', 'test-verify.sqlite');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const db = getDatabase(testDbPath);
const onlineSet = new Set<string>(['player_alex', 'player_novarex']);
const repo = new SqliteStorageRepository(db, (pid) => onlineSet.has(pid));
seedInitialData(repo);

const baseCosmetics = {
  tileSkin: 'classic_cream',
  boardSkin: 'royal_cosmos',
  backgroundTheme: 'deep_blue',
  chatBubbleStyle: 'frost_pill',
};
repo.upsertProfile({
  id: 'player_alex',
  username: 'Alex',
  avatarId: 'alex',
  rankTier: 'Silver II',
  rankPoints: 1000,
  wins: 0,
  losses: 0,
  matchPointsBalance: 0,
  equippedCosmetics: baseCosmetics,
  createdAt: Date.now(),
});
repo.upsertProfile({
  id: 'player_novarex',
  username: 'NovaRex',
  avatarId: 'novarex',
  rankTier: 'Silver II',
  rankPoints: 1000,
  wins: 0,
  losses: 0,
  matchPointsBalance: 0,
  equippedCosmetics: baseCosmetics,
  createdAt: Date.now(),
});

const engine = new ChainClashEngine(repo, (pid) => onlineSet.has(pid));

console.log('1. Testing Official catalog size, AI chain generator & template persistence...');
const officialList = repo.listTemplates().filter((t) => t.status === 'official');
assert.ok(officialList.length >= 25, `Expected >=25 official templates, got ${officialList.length}`);
const generated = await generateWordChain('Fantasy', 5);
assert.equal(generated.words.length, 5);
assert.equal(validateChainWords(generated.words).valid, true);
assert.equal(getSyncOneWordClue('SCHOOL'), 'ACADEMY');

assert.equal(validateChainWords(['high', 'school', 'bus']).valid, true);
assert.equal(validateChainWords(['high', 'school bus', 'stop']).valid, false);
assert.equal(validateChainWords(['high', '123', 'stop']).valid, false);
assert.equal(validateChainWords(['high', 'bus-stop', 'sign']).valid, false);

const createdTpl = repo.saveTemplate({
  id: 'tpl_test_custom',
  ownerId: 'player_alex',
  name: 'Acceptance Chain',
  theme: 'Custom',
  thumbnailKey: 'custom',
  words: ['SUN', 'FLOWER', 'POT', 'LUCK'],
  status: 'saved',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
assert.equal(repo.getTemplate(createdTpl.id)?.words.join(','), 'SUN,FLOWER,POT,LUCK');

console.log('2. Testing Derangement puzzle assignment (2P & 4P)...');
const twoP = assignCustomPuzzlesDeranged([
  { playerId: 'p1', words: ['A', 'B', 'C'] },
  { playerId: 'p2', words: ['X', 'Y', 'Z'] },
]);
assert.equal(twoP[0].recipientPlayerId, 'p1');
assert.equal(twoP[0].authorPlayerId, 'p2');
assert.equal(twoP[1].recipientPlayerId, 'p2');
assert.equal(twoP[1].authorPlayerId, 'p1');

for (let run = 0; run < 20; run++) {
  const perm = generateDerangementIndices(4);
  for (let i = 0; i < 4; i++) {
    assert.notEqual(perm[i], i, 'Derangement must have zero fixed points');
  }
}

console.log('3. Testing Classic Mode opening race, active turns, wrong guess, pass turn, and victory...');
const match = engine.createMatch({
  roomId: null,
  mode: 'classic',
  title: 'Classic Acceptance Test',
  rules: {
    ...DEFAULT_ROOM_RULES,
    maxPlayers: 2,
    timePerWordSeconds: 20,
    autoRevealAfterAttempts: 2,
  },
  assignments: [
    { recipientPlayerId: 'player_alex', authorPlayerId: 'player_novarex', words: ['HIGH', 'SCHOOL', 'BUS', 'STOP'] },
    { recipientPlayerId: 'player_novarex', authorPlayerId: 'player_alex', words: ['WATER', 'FALL', 'RIVER', 'BANK'] },
  ],
});

assert.equal(match.status, 'opening');
// Anti-cheat check: client view must NOT contain unrevealed target word SCHOOL
const clientViewAlex = engine.sanitizeForViewer(match, 'player_alex');
assert.equal(clientViewAlex.boards['player_alex'].words[1].displayText.includes('SCHOOL'), false);

// Wrong guess does not end turn or skip word
const wrongRes = engine.submitGuess(match.id, 'player_alex', 'WRONG');
assert.equal(wrongRes.correct, false);
assert.equal(wrongRes.match.status, 'opening');

// Alex solves opening word SCHOOL -> gains active turn!
const openWinRes = engine.submitGuess(match.id, 'player_alex', 'school');
assert.equal(openWinRes.correct, true);
assert.equal(openWinRes.match.status, 'active_turns');
assert.equal(openWinRes.match.activeTurnPlayerId, 'player_alex');
assert.equal(openWinRes.match.boards['player_alex'].currentWordIndex, 2);

// NovaRex cannot submit while it's Alex's turn
assert.throws(() => engine.submitGuess(match.id, 'player_novarex', 'FALL'), /not your turn/i);

// Alex tests auto-reveal after 2 wrong attempts on BUS
const w1 = engine.submitGuess(match.id, 'player_alex', 'CAR');
assert.equal(w1.revealedLetterAdded, false);
const w2 = engine.submitGuess(match.id, 'player_alex', 'TRAIN');
assert.equal(w2.revealedLetterAdded, true);
assert.equal(w2.match.boards['player_alex'].words[2].revealedLetters, 2); // B U _
assert.equal(w2.match.boards['player_alex'].words[2].clueWord, 'SHUTTLE');

// Alex passes turn -> NovaRex gets turn, Alex's word BUS stays unresolved (index 2)
const passed = engine.passTurn(match.id, 'player_alex');
assert.equal(passed.activeTurnPlayerId, 'player_novarex');
assert.equal(passed.boards['player_alex'].currentWordIndex, 2);

// NovaRex solves FALL and RIVER
engine.submitGuess(match.id, 'player_novarex', 'FALL');
const novaR = engine.submitGuess(match.id, 'player_novarex', 'RIVER');
assert.equal(novaR.match.boards['player_novarex'].currentWordIndex, 3);

// NovaRex passes back to Alex
engine.passTurn(match.id, 'player_novarex');

// Simulate timeout for Alex -> turns back to NovaRex without skipping Alex's BUS
const timedMatch = repo.getMatch(match.id)!;
timedMatch.turnDeadlineMs = Date.now() - 100;
repo.saveMatch(timedMatch);
const expiredUpdates = engine.processExpiredTimers();
assert.equal(expiredUpdates.length, 1);
assert.equal(expiredUpdates[0].activeTurnPlayerId, 'player_novarex');
assert.equal(expiredUpdates[0].boards['player_alex'].currentWordIndex, 2);

// NovaRex solves final word BANK -> NovaRex wins immediately!
const winRes = engine.submitGuess(match.id, 'player_novarex', 'BANK');
assert.equal(winRes.matchWon, true);
assert.equal(winRes.match.winnerId, 'player_novarex');
assert.equal(winRes.match.status, 'finished');

// Unfinished player Alex can STILL keep solving after NovaRex won!
const alexContinues = engine.submitGuess(match.id, 'player_alex', 'BUS');
assert.equal(alexContinues.correct, true);
assert.equal(alexContinues.match.boards['player_alex'].currentWordIndex, 3);

// Winner NovaRex cannot submit further answers
assert.throws(() => engine.submitGuess(match.id, 'player_novarex', 'EXTRA'), /already completed/i);

console.log('4. Testing offline turn protection & Speed Race...');
onlineSet.delete('player_novarex');
const offlinePass = engine.createMatch({
  roomId: null,
  mode: 'classic',
  title: 'Offline Protection Test',
  rules: { ...DEFAULT_ROOM_RULES, maxPlayers: 2 },
  assignments: [
    { recipientPlayerId: 'player_alex', authorPlayerId: 'player_novarex', words: ['HIGH', 'SCHOOL', 'BUS'] },
    { recipientPlayerId: 'player_novarex', authorPlayerId: 'player_alex', words: ['WATER', 'FALL', 'RIVER'] },
  ],
});
engine.submitGuess(offlinePass.id, 'player_alex', 'SCHOOL');
const afterPassToOffline = engine.passTurn(offlinePass.id, 'player_alex');
assert.equal(afterPassToOffline.turnAwaitingOnline, true);
assert.equal(afterPassToOffline.turnDeadlineMs, null);

// Once NovaRex comes online and opens the match, timer starts!
onlineSet.add('player_novarex');
const activated = engine.activateAwaitingTurnIfOnline(offlinePass.id, 'player_novarex')!;
assert.equal(activated.turnAwaitingOnline, false);
assert.ok(activated.turnDeadlineMs && activated.turnDeadlineMs > Date.now());

// Speed Race simultaneous test
const speedMatch = engine.createMatch({
  roomId: null,
  mode: 'speed_race',
  title: 'Speed Race Test',
  rules: { ...DEFAULT_ROOM_RULES, mode: 'speed_race', maxPlayers: 2 },
  assignments: [
    { recipientPlayerId: 'player_alex', authorPlayerId: null, words: ['DRAGON', 'FIRE', 'STORM'] },
    { recipientPlayerId: 'player_novarex', authorPlayerId: null, words: ['DRAGON', 'FIRE', 'STORM'] },
  ],
});
const srAlex = engine.submitGuess(speedMatch.id, 'player_alex', 'FIRE');
assert.equal(srAlex.correct, true);
const srNova = engine.submitGuess(speedMatch.id, 'player_novarex', 'FIRE');
assert.equal(srNova.correct, true);
// Anti-spoiler check: NovaRex solved FIRE, Alex solved FIRE; if Alex hasn't solved STORM, NovaRex solving STORM shouldn't leak STORM word to Alex
const srNovaWin = engine.submitGuess(speedMatch.id, 'player_novarex', 'STORM');
assert.equal(srNovaWin.matchWon, true);
const alexSees = engine.sanitizeForViewer(repo.getMatch(speedMatch.id)!, 'player_alex');
assert.notEqual(alexSees.boards['player_novarex'].words[2].displayText, 'STORM');

console.log('5. Testing 2-failed-turns letter reveal + 1-word synonym clue unlock...');
const clueMatch = engine.createMatch({
  roomId: null,
  mode: 'classic',
  title: '2 Failed Turns Clue Test',
  rules: { ...DEFAULT_ROOM_RULES, maxPlayers: 2, autoRevealAfterFailedTurns: 2 },
  assignments: [
    { recipientPlayerId: 'player_alex', authorPlayerId: 'player_novarex', words: ['HIGH', 'SCHOOL', 'BUS', 'STOP'] },
    { recipientPlayerId: 'player_novarex', authorPlayerId: 'player_alex', words: ['WATER', 'FALL', 'RIVER', 'BANK'] },
  ],
});
engine.submitGuess(clueMatch.id, 'player_alex', 'SCHOOL');
// Before any failed turn on BUS: revealedLetters = 1, clueWord = null
let viewA = engine.sanitizeForViewer(repo.getMatch(clueMatch.id)!, 'player_alex');
assert.equal(viewA.boards['player_alex'].words[2].revealedLetters, 1);
assert.equal(viewA.boards['player_alex'].words[2].clueWord, null);

// 1st failed turn (Pass) on BUS -> still 1 letter, no clue yet
engine.passTurn(clueMatch.id, 'player_alex');
engine.passTurn(clueMatch.id, 'player_novarex');
viewA = engine.sanitizeForViewer(repo.getMatch(clueMatch.id)!, 'player_alex');
assert.equal(viewA.boards['player_alex'].words[2].revealedLetters, 1);
assert.equal(viewA.boards['player_alex'].words[2].clueWord, null);

// 2nd failed turn (Timeout) on BUS -> 2nd letter revealed + 1-word synonym clue unlocked!
const mTimed = repo.getMatch(clueMatch.id)!;
mTimed.turnDeadlineMs = Date.now() - 100;
repo.saveMatch(mTimed);
engine.processExpiredTimers();
viewA = engine.sanitizeForViewer(repo.getMatch(clueMatch.id)!, 'player_alex');
assert.equal(viewA.boards['player_alex'].words[2].revealedLetters, 2);
assert.equal(viewA.boards['player_alex'].words[2].clueWord, 'SHUTTLE');

console.log('6. Testing Solo wrong-guess clues & mixed Classic wrong-guess + pass clues...');
const soloMatch = engine.createMatch({
  roomId: null,
  mode: 'solo',
  title: 'Solo Clue Test',
  rules: { ...DEFAULT_ROOM_RULES, maxPlayers: 1, timerEnabled: false },
  assignments: [
    { recipientPlayerId: 'player_alex', authorPlayerId: null, words: ['HIGH', 'SCHOOL', 'BUS'] },
  ],
});
const soloWrong1 = engine.submitGuess(soloMatch.id, 'player_alex', 'COLLEGE');
assert.equal(soloWrong1.revealedLetterAdded, false);
assert.equal(soloWrong1.match.boards['player_alex'].words[1].revealedLetters, 1);
assert.equal(soloWrong1.match.boards['player_alex'].words[1].clueWord, null);

const soloWrong2 = engine.submitGuess(soloMatch.id, 'player_alex', 'SYSTEM');
assert.equal(soloWrong2.revealedLetterAdded, true);
assert.equal(soloWrong2.match.boards['player_alex'].words[1].revealedLetters, 2);
assert.equal(soloWrong2.match.boards['player_alex'].words[1].clueWord, 'ACADEMY');

// Mixed Classic failure: 1 wrong guess + 1 pass on same word triggers both clues
const mixedMatch = engine.createMatch({
  roomId: null,
  mode: 'classic',
  title: 'Mixed Failure Clue Test',
  rules: { ...DEFAULT_ROOM_RULES, maxPlayers: 2 },
  assignments: [
    { recipientPlayerId: 'player_alex', authorPlayerId: 'player_novarex', words: ['HIGH', 'SCHOOL', 'BUS', 'STOP'] },
    { recipientPlayerId: 'player_novarex', authorPlayerId: 'player_alex', words: ['WATER', 'FALL', 'RIVER', 'BANK'] },
  ],
});
engine.submitGuess(mixedMatch.id, 'player_alex', 'SCHOOL');
const mixedWrong = engine.submitGuess(mixedMatch.id, 'player_alex', 'CAR');
assert.equal(mixedWrong.match.boards['player_alex'].words[2].revealedLetters, 1);
assert.equal(mixedWrong.match.boards['player_alex'].words[2].clueWord, null);
engine.passTurn(mixedMatch.id, 'player_alex');
const mixedView = engine.sanitizeForViewer(repo.getMatch(mixedMatch.id)!, 'player_alex');
assert.equal(mixedView.boards['player_alex'].words[2].revealedLetters, 2);
assert.equal(mixedView.boards['player_alex'].words[2].clueWord, 'SHUTTLE');

console.log('7. Testing Practice Mode hints, skip-word (0 MP), timed Practice & non-practice guards...');
const practiceMatch = engine.createMatch({
  roomId: null,
  mode: 'solo',
  title: 'Practice • Academy Run',
  theme: 'Education',
  rules: {
    ...DEFAULT_ROOM_RULES,
    maxPlayers: 1,
    chainLength: 4,
    timePerWordSeconds: 20,
    timerEnabled: true,
    chainVisibility: 'progressive',
    autoRevealAfterAttempts: 1,
    autoRevealAfterFailedTurns: 1,
    isPractice: true,
  },
  assignments: [
    { recipientPlayerId: 'player_alex', authorPlayerId: null, words: ['HIGH', 'SCHOOL', 'BUS', 'STOP'] },
  ],
});

assert.ok(
  practiceMatch.speedRaceDeadlines['player_alex'] && practiceMatch.speedRaceDeadlines['player_alex']! > Date.now(),
  'Timed Practice must initialize per-word deadline'
);

// Non-practice matches reject hint & skip-word
assert.throws(() => engine.usePracticeHint(soloMatch.id, 'player_alex'), /Practice Mode/i);
assert.throws(() => engine.skipPracticeWord(mixedMatch.id, 'player_alex'), /Practice Mode/i);

// Hint reveals next letter + clue on active word SCHOOL
const hintRes = engine.usePracticeHint(practiceMatch.id, 'player_alex');
assert.equal(hintRes.revealedLetterAdded, true);
assert.equal(hintRes.clueWord, 'ACADEMY');
assert.equal(hintRes.match.boards['player_alex'].words[1].revealedLetters, 2);
assert.equal(hintRes.match.boards['player_alex'].words[1].clueWord, 'ACADEMY');

// Skip Word reveals SCHOOL with 0 MP and advances to BUS, resetting timer
const skipRes1 = engine.skipPracticeWord(practiceMatch.id, 'player_alex');
assert.equal(skipRes1.revealedWord, 'SCHOOL');
assert.equal(skipRes1.matchWon, false);
assert.equal(skipRes1.match.boards['player_alex'].currentWordIndex, 2);
assert.equal(skipRes1.match.boards['player_alex'].earnedMatchPoints, 0);

// Expired timer on timed Practice reveals letter/clue on BUS without ending match
const timedPractice = repo.getMatch(practiceMatch.id)!;
timedPractice.speedRaceDeadlines['player_alex'] = Date.now() - 200;
repo.saveMatch(timedPractice);
engine.processExpiredTimers();
const afterTimer = engine.sanitizeForViewer(repo.getMatch(practiceMatch.id)!, 'player_alex');
assert.equal(afterTimer.boards['player_alex'].words[2].revealedLetters, 2);
assert.equal(afterTimer.boards['player_alex'].words[2].clueWord, 'SHUTTLE');

// Solve BUS (+10 MP), skip STOP -> finishes Practice chain
const solveBus = engine.submitGuess(practiceMatch.id, 'player_alex', 'BUS');
assert.equal(solveBus.correct, true);
assert.equal(solveBus.match.boards['player_alex'].earnedMatchPoints, 10);
const skipFinal = engine.skipPracticeWord(practiceMatch.id, 'player_alex');
assert.equal(skipFinal.matchWon, true);
assert.equal(skipFinal.match.status, 'finished');
assert.equal(skipFinal.match.boards['player_alex'].earnedMatchPoints, 10);

console.log('ALL BACKEND ENGINE ACCEPTANCE TESTS PASSED!');
db.close();
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`);
if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`);
