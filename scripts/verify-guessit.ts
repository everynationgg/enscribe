import assert from 'node:assert/strict';
import http from 'node:http';
import {
  GUESSIT_ADVENTURE_CHAPTERS,
  GUESSIT_WORD_CATALOG,
  pickCrosswordForCategory,
  validateCandidateWordEntry,
} from '../shared/guessit/catalog.js';
import {
  generateCrosswordLayout,
  validateCrosswordLayout,
} from '../shared/guessit/crossword.js';
import { buildClassicClientView, extractUniqueLetters } from '../shared/guessit/normalize.js';
import { GuessItClassicView, GuessItCrosswordView } from '../shared/guessit/types.js';
import { createEnscribeApp } from '../server/app.js';

async function run() {
  const runtime = createEnscribeApp(
    {},
    { forceLocalGuestMemory: true, disableCloudSync: true, inMemoryOnly: true }
  );
  const engine = runtime.guessItEngine;
  await runtime.prewarm();

  const server = http.createServer(runtime.app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const post = async (url: string, body: any, token?: string) => {
    const res = await fetch(`${baseUrl}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'x-guest-session-token': token } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: await res.json() };
  };

  try {
    const registerGuest = async (name: string) => {
      const res = await post('/api/guest/claim', { nickname: name, avatarId: 'alex' });
      assert.equal(res.status, 200);
      return {
        profile: res.data.profile as { id: string; username: string; matchPointsBalance: number },
        token: res.data.session.sessionToken as string,
      };
    };

    console.log('1. Verifying multi-word spaces, auto-shown punctuation, and Crossword layout validity...');
    const punctView = buildClassicClientView('SPIDER-MAN: NO WAY', 'Movies', new Set(['S', 'A']), false);
    const hyphenTok = punctView.tokens.find((t) => t.kind === 'punct' && t.char === '-');
    const colonTok = punctView.tokens.find((t) => t.kind === 'punct' && t.char === ':');
    const spaceToks = punctView.tokens.filter((t) => t.kind === 'space');
    assert.ok(hyphenTok?.revealed, 'Hyphen punctuation must be visible automatically');
    assert.ok(colonTok?.revealed, 'Colon punctuation must be visible automatically');
    assert.equal(spaceToks.length, 2, 'Two space separators expected in SPIDER-MAN: NO WAY');
    assert.equal(punctView.totalLetters, 14, 'Spaces and punctuation must be excluded from totalLetters');

    for (const ch of GUESSIT_ADVENTURE_CHAPTERS) {
      for (const st of ch.stages) {
        if (st.format === 'crossword') {
          const layout = generateCrosswordLayout(st.answers, st.stageNumber);
          assert.ok(layout, `Adventure crossword ${st.id} must build cleanly`);
          assert.ok(validateCrosswordLayout(layout!), `Adventure crossword ${st.id} failed validation`);
          assert.ok(layout!.cols <= 13, `Adventure crossword ${st.id} exceeds mobile width budget (${layout!.cols} cols)`);
          const badSpaceIntersection = layout!.cells.some((c) => c.kind !== 'letter' && c.entryIds.length > 1);
          assert.equal(badSpaceIntersection, false, `Crossword ${st.id} intersected on space/punct`);
        }
      }
    }
    const catCw = pickCrosswordForCategory([], { category: 'Movies', difficulty: 'medium', seed: 42 });
    assert.ok(validateCrosswordLayout(catCw.layout), 'Random category crossword must validate cleanly');

    console.log('2. Verifying AI candidate validation & catalog filtering...');
    const badCand = validateCandidateWordEntry({ answer: 'AB', category: 'Movies', difficulty: 'easy' });
    assert.equal(badCand.valid, false);
    const profanityCand = validateCandidateWordEntry({ answer: 'SHIT MOVIE', category: 'Movies', difficulty: 'easy' });
    assert.equal(profanityCand.valid, false);
    const validCand = await engine.validateAndAddCatalogCandidate({
      answer: 'GALAXY QUEST',
      category: 'Movies',
      difficulty: 'medium',
      clue: 'Sci-fi comedy adventure',
    });
    assert.equal(validCand.validationStatus, 'approved');
    assert.equal(validCand.wordCount, 2);

    console.log('3. Verifying Solo Adventure global reveal, HTTP 429 penalty lock, repeat no-penalty & idempotent claim...');
    const solo = await registerGuest('SoloHero');
    const progBefore = await engine.getAdventureProgress(solo.profile.id);
    assert.equal(progBefore.chapters[0].stages[0].progress.unlocked, true, '1-1 starts unlocked');
    assert.equal(progBefore.chapters[0].stages[1].progress.unlocked, false, '1-2 starts locked');

    const s1Start = await post(
      '/api/guessit/adventure/start',
      { playerId: solo.profile.id, stageId: 'ch1_s1' },
      solo.token
    );
    assert.equal(s1Start.status, 201);
    const s1Id = s1Start.data.id as string;

    // Wrong guess -> HTTP 200 with penaltyUntilMs; rapid next guess -> HTTP 429!
    const wrong1 = await post(
      `/api/guessit/matches/${s1Id}/guess`,
      { playerId: solo.profile.id, letter: 'Z' },
      solo.token
    );
    assert.equal(wrong1.status, 200);
    assert.equal(wrong1.data.correct, false);
    assert.ok(wrong1.data.penaltyUntilMs > Date.now());

    const blockedFast = await post(
      `/api/guessit/matches/${s1Id}/guess`,
      { playerId: solo.profile.id, letter: 'X' },
      solo.token
    );
    assert.equal(blockedFast.status, 429, 'Server MUST reject rapid guess during penalty with HTTP 429');

    await new Promise((r) => setTimeout(r, 1850));

    // Repeating Z must fail with 400 and NOT add another wrong guess
    const repeatZ = await post(
      `/api/guessit/matches/${s1Id}/guess`,
      { playerId: solo.profile.id, letter: 'Z' },
      solo.token
    );
    assert.equal(repeatZ.status, 400);
    const afterRepeat = await engine.getMatchForViewer(s1Id, solo.profile.id);
    assert.equal(afterRepeat.participants[solo.profile.id].wrongCount, 1);

    // Correct 'S' reveals both S's in STAR WARS immediately with no lock
    const guessS = await post(
      `/api/guessit/matches/${s1Id}/guess`,
      { playerId: solo.profile.id, letter: 'S' },
      solo.token
    );
    assert.equal(guessS.status, 200);
    assert.equal(guessS.data.correct, true);
    assert.equal(guessS.data.occurrencesRevealed, 2);
    assert.equal(guessS.data.penaltyUntilMs, null);

    for (const ch of ['T', 'A', 'R', 'W']) {
      await post(`/api/guessit/matches/${s1Id}/guess`, { playerId: solo.profile.id, letter: ch }, solo.token);
    }

    // Concurrent claim calls must award coins ONLY ONCE
    const coinsBefore = runtime.repo.getProfile(solo.profile.id)!.matchPointsBalance;
    const [c1, c2] = await Promise.all([
      post('/api/guessit/adventure/claim', { playerId: solo.profile.id, matchId: s1Id }, solo.token),
      post('/api/guessit/adventure/claim', { playerId: solo.profile.id, matchId: s1Id }, solo.token),
    ]);
    assert.equal([c1.data.claimed, c2.data.claimed].filter(Boolean).length, 1);
    assert.equal(runtime.repo.getProfile(solo.profile.id)!.matchPointsBalance - coinsBefore, 100);

    // Unlock progression -> complete 1-2 -> test 1-3 Crossword global reveal
    const s2 = await engine.startAdventureStageRecord(solo.profile.id, 'ch1_s2');
    for (const ch of ['T', 'H', 'E', 'L', 'I', 'O', 'N', 'K', 'G']) {
      await engine.submitGuess(s2.id, solo.profile.id, ch);
    }
    await engine.claimAdventureReward(solo.profile.id, s2.id);

    const s3 = await engine.startAdventureStageRecord(solo.profile.id, 'ch1_s3');
    const cwRes = await engine.submitGuess(s3.id, solo.profile.id, 'A');
    const cwView = cwRes.response.match.participants[solo.profile.id].puzzle as GuessItCrosswordView;
    const revealedACells = cwView.cells.filter((c) => c.kind === 'letter' && c.char === 'A');
    const revealedAEntries = new Set(revealedACells.flatMap((c) => c.entryIds));
    assert.ok(cwRes.response.occurrencesRevealed >= 3, 'Crossword A must reveal all matching grid cells');
    assert.equal(revealedACells.length, cwRes.response.occurrencesRevealed);
    assert.ok(revealedAEntries.size >= 2, 'Crossword A must reveal globally across multiple entries');
    assert.equal(cwView.solvedAnswers, undefined);

    console.log('4. Verifying simultaneous 1v1 Speed Rush, Ranked approved words & Precision Clash accuracy scoring...');
    const p1 = await registerGuest('RacerOne');
    const p2 = await registerGuest('RacerTwo');
    const q1 = await engine.joinRankedQueue(p1.profile.id, 'speed_rush', 'classic');
    assert.equal(q1.status, 'queued');
    const q2 = await engine.joinRankedQueue(p2.profile.id, 'speed_rush', 'classic');
    assert.equal(q2.status, 'matched');
    const rankedAns = q2.match!.units[p1.profile.id].answer;
    assert.ok(GUESSIT_WORD_CATALOG.some((w) => w.answer === rankedAns && w.rankedEligible));

    await engine.submitGuess(q2.match!.id, p1.profile.id, rankedAns[0]);
    const p2View = await engine.getMatchForViewer(q2.match!.id, p2.profile.id);
    assert.equal(p2View.participants[p2.profile.id].correctLetters.length, 0);
    assert.equal(p2View.participants[p1.profile.id].puzzle, null);

    // Precision Clash accuracy emphasis: P1 makes 0 mistakes, P2 makes 2 mistakes -> P1 wins even if slower
    const precRoom = await engine.createRoom({
      hostId: p1.profile.id,
      settings: { mode: 'precision_clash', category: 'Movies', roundsCount: 1, penaltyMs: 500 },
    });
    await engine.joinRoom(precRoom.id, p2.profile.id);
    await engine.setPlayerReady(precRoom.id, p2.profile.id, true);
    const precStart = await engine.startRoomMatch(precRoom.id, p1.profile.id);
    const precId = precStart.matchRecord.id;
    const precAns = precStart.matchRecord.units[p1.profile.id].answer;
    const precReq = extractUniqueLetters(precAns);
    const wrongPool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((c) => !precAns.includes(c));

    // P2 solves first but commits 2 mistakes
    for (let m = 0; m < 2; m++) {
      await engine.submitGuess(precId, p2.profile.id, wrongPool[m]);
      await new Promise((r) => setTimeout(r, 520));
    }
    for (const ch of precReq) {
      await engine.submitGuess(precId, p2.profile.id, ch);
    }
    // P1 solves cleanly with 0 mistakes
    for (const ch of precReq) {
      await engine.submitGuess(precId, p1.profile.id, ch);
    }
    const precDone = await engine.getMatchForViewer(precId, p1.profile.id);
    assert.equal(precDone.status, 'finished');
    assert.deepEqual(precDone.winnerIds, [p1.profile.id], 'Precision Clash must reward 100% accuracy over speed with errors');

    console.log('5. Verifying Word Duel answer privacy & fair scoring...');
    const wdRoom = await engine.createRoom({
      hostId: p1.profile.id,
      settings: { mode: 'word_duel', category: 'Movies', roundsCount: 1, penaltyMs: 500 },
    });
    await engine.joinRoom(wdRoom.id, p2.profile.id);
    await engine.setPlayerReady(wdRoom.id, p2.profile.id, true);
    await engine.submitDuelChallenge(wdRoom.id, p1.profile.id, { source: 'custom_word', answer: 'TOY STORY', category: 'Movies' });
    await engine.submitDuelChallenge(wdRoom.id, p2.profile.id, { source: 'custom_word', answer: 'FINDING NEMO', category: 'Movies' });

    const roomJson = JSON.stringify(await engine.getRoom(wdRoom.id));
    assert.equal(roomJson.includes('TOY STORY'), false);
    assert.equal(roomJson.includes('FINDING NEMO'), false);

    const wdStart = await engine.startRoomMatch(wdRoom.id, p1.profile.id);
    const wdMatchId = wdStart.matchRecord.id;
    const p1ActiveJson = JSON.stringify(await engine.getMatchForViewer(wdMatchId, p1.profile.id));
    assert.equal(p1ActiveJson.includes('FINDING NEMO'), false);
    for (const ch of ['F', 'I', 'N', 'D', 'G', 'E', 'M', 'O']) {
      await engine.submitGuess(wdMatchId, p1.profile.id, ch);
    }
    for (let m = 0; m < 6; m++) {
      await engine.submitGuess(wdMatchId, p2.profile.id, ['X', 'Z', 'Q', 'J', 'K', 'B'][m]);
      if (m < 5) await new Promise((r) => setTimeout(r, 520));
    }
    const wdDone = await engine.getMatchForViewer(wdMatchId, p1.profile.id);
    assert.deepEqual(wdDone.winnerIds, [p1.profile.id]);

    console.log('6. Verifying Survival Royale elimination & spectator lock + Team Relay 2v2 handoff...');
    const p3 = await registerGuest('RelayThree');
    const p4 = await registerGuest('RelayFour');

    // Survival Royale (3 players)
    const survRoom = await engine.createRoom({
      hostId: p1.profile.id,
      settings: { mode: 'survival_royale', category: 'Movies', maxMistakes: 3, roundsCount: 2, penaltyMs: 500 },
    });
    await engine.joinRoom(survRoom.id, p2.profile.id);
    await engine.joinRoom(survRoom.id, p3.profile.id);
    await engine.setPlayerReady(survRoom.id, p2.profile.id, true);
    await engine.setPlayerReady(survRoom.id, p3.profile.id, true);
    const survStart = await engine.startRoomMatch(survRoom.id, p1.profile.id);
    const survId = survStart.matchRecord.id;
    const survAns = survStart.matchRecord.units[p1.profile.id].answer;
    const survWrong = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((c) => !survAns.includes(c));
    const survReq = extractUniqueLetters(survAns);

    // P1 solves, P2 & P3 fail 3 mistakes -> eliminated -> P1 wins!
    for (const ch of survReq) await engine.submitGuess(survId, p1.profile.id, ch);
    for (let m = 0; m < 3; m++) {
      await engine.submitGuess(survId, p2.profile.id, survWrong[m]);
      await engine.submitGuess(survId, p3.profile.id, survWrong[m]);
      if (m < 2) await new Promise((r) => setTimeout(r, 520));
    }
    const survDone = await engine.getMatchForViewer(survId, p2.profile.id);
    assert.equal(survDone.viewerIsSpectator, true, 'Eliminated Survival player becomes spectator');
    assert.equal(survDone.status, 'finished');
    assert.deepEqual(survDone.winnerIds, [p1.profile.id]);

    // Team Relay (2v2)
    const relayRoom = await engine.createRoom({
      hostId: p1.profile.id,
      settings: { mode: 'team_relay', category: 'Movies', roundsCount: 1, penaltyMs: 500 },
    });
    await engine.joinRoom(relayRoom.id, p2.profile.id);
    await engine.joinRoom(relayRoom.id, p3.profile.id);
    await engine.joinRoom(relayRoom.id, p4.profile.id);
    await engine.setPlayerReady(relayRoom.id, p2.profile.id, true);
    await engine.setPlayerReady(relayRoom.id, p3.profile.id, true);
    await engine.setPlayerReady(relayRoom.id, p4.profile.id, true);

    const relayStart = await engine.startRoomMatch(relayRoom.id, p1.profile.id);
    const rMatch = relayStart.matchRecord;
    const blueUnit = rMatch.units['team:blue'];
    const activeBlue = blueUnit.activePlayerId!;
    const waitingBlue = blueUnit.teamPlayerOrder.find((id) => id !== activeBlue)!;
    const targetAns = blueUnit.answer;
    const wrongChar = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((c) => !targetAns.includes(c))!;

    const [actOutcome, waitOutcome] = await Promise.allSettled([
      engine.submitGuess(rMatch.id, activeBlue, wrongChar),
      engine.submitGuess(rMatch.id, waitingBlue, targetAns[0]),
    ]);
    assert.equal(actOutcome.status, 'fulfilled');
    assert.equal(waitOutcome.status, 'rejected');
    assert.equal((actOutcome as PromiseFulfilledResult<any>).value.response.handoffToPlayerId, waitingBlue);

    await new Promise((r) => setTimeout(r, 520));
    await assert.rejects(() => engine.submitGuess(rMatch.id, activeBlue, targetAns[0]), /teammate/i);
    await engine.submitGuess(rMatch.id, waitingBlue, targetAns[0]);

    // Reconnection restoration check
    const restored = await engine.getMatchForViewer(rMatch.id, activeBlue);
    assert.equal(restored.participants[activeBlue].activeTurnPlayerId, waitingBlue);
    assert.equal(
      (restored.participants[activeBlue].puzzle as GuessItClassicView).tokens.some(
        (t) => t.char === targetAns[0] && t.revealed
      ),
      true
    );

    console.log('ALL GUESSIT ENGINE, CONCURRENCY & MULTIPLAYER ACCEPTANCE TESTS PASSED!');
  } finally {
    server.close();
  }
}

run().catch((err) => {
  console.error('GUESSIT TEST FAILED:', err);
  process.exit(1);
});
