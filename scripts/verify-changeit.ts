import assert from 'node:assert/strict';
import http from 'node:http';
import { createEnscribeApp } from '../server/app.js';
import { getChangeItServerData } from '../server/games/changeit/serverVocab.js';
import { ALL_CHANGEIT_ADVENTURE_STAGES } from '../shared/changeit/adventureCatalog.js';
import { DIFFICULTY_CONFIGS } from '../shared/changeit/difficulty.js';
import { isExcludedWord } from '../shared/changeit/excludedWords.js';
import { generateVerifiedPuzzle } from '../shared/changeit/generator.js';
import {
  ChangeItAdventureClaimResult,
  ChangeItAdventureProgressClient,
  ChangeItCustomPuzzleValidation,
  ChangeItDifficulty,
  ChangeItLeaderboardResponse,
  ChangeItMatchStateClient,
  ChangeItModifierResponse,
  ChangeItRoom,
  ChangeItTransformResponse,
  ChangeItWordLength,
} from '../shared/changeit/types.js';
import { bfsShortestPath, canonicalPuzzleKey } from '../shared/changeit/wordGraph.js';

async function jsonRequest<T = any>(
  baseUrl: string,
  method: string,
  urlPath: string,
  body?: unknown
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}

async function claimGuest(baseUrl: string, nickname: string, avatarId: string): Promise<string> {
  const res = await jsonRequest(baseUrl, 'POST', '/api/guest/claim', { nickname, avatarId });
  assert.equal(res.status, 200, `Failed to claim guest ${nickname}: ${JSON.stringify(res.data)}`);
  return res.data.profile.id as string;
}

async function createAndJoinRoom(
  baseUrl: string,
  hostId: string,
  guestIds: string[],
  settings: Record<string, unknown>,
  customPuzzle?: { startWord: string; targetWord: string }
): Promise<ChangeItRoom> {
  const created = await jsonRequest<ChangeItRoom>(baseUrl, 'POST', '/api/changeit/rooms', {
    hostId,
    name: `Verify ${String(settings.mode || 'sprint')}`,
    settings: { isPublic: true, ...settings },
  });
  assert.equal(created.status, 201, `Create room failed: ${JSON.stringify(created.data)}`);
  let room = created.data;

  for (const gid of guestIds) {
    const joined = await jsonRequest<ChangeItRoom>(baseUrl, 'POST', '/api/changeit/rooms/join', {
      codeOrId: room.code,
      playerId: gid,
    });
    assert.equal(joined.status, 200, `Join room failed: ${JSON.stringify(joined.data)}`);
    const ready = await jsonRequest<ChangeItRoom>(
      baseUrl,
      'POST',
      `/api/changeit/rooms/${room.id}/ready`,
      { playerId: gid, isReady: true }
    );
    assert.equal(ready.status, 200, `Ready toggle failed: ${JSON.stringify(ready.data)}`);
    room = ready.data;
  }

  if (customPuzzle) {
    const cp = await jsonRequest<ChangeItRoom>(
      baseUrl,
      'POST',
      `/api/changeit/rooms/${room.id}/custom-puzzle`,
      { playerId: hostId, ...customPuzzle }
    );
    assert.equal(cp.status, 200, `Set custom puzzle failed: ${JSON.stringify(cp.data)}`);
    room = cp.data;
  }

  return room;
}

async function main() {
  const data = getChangeItServerData();

  // 1. Dictionary & Adventure Catalog Mathematical Verification
  assert.equal(data.validationSet.size, 28575, 'Expected 28,575 approved validation words');
  assert.equal(data.puzzleSet.size, 9808, 'Expected 9,808 approved puzzle words');
  for (const w of data.validationSet) {
    assert.ok(!isExcludedWord(w), `Excluded word leaked into validationSet: ${w}`);
  }
  for (const w of data.puzzleSet) {
    assert.ok(data.validationSet.has(w), `Puzzle word missing from validationSet: ${w}`);
    assert.ok(!isExcludedWord(w), `Excluded word leaked into puzzleSet: ${w}`);
  }

  assert.equal(ALL_CHANGEIT_ADVENTURE_STAGES.length, 36, 'Expected 36 Solo Adventure levels (6x6)');
  for (const st of ALL_CHANGEIT_ADVENTURE_STAGES) {
    assert.equal(st.startWord.length, st.wordLength, `${st.id} startWord length mismatch`);
    assert.equal(st.targetWord.length, st.wordLength, `${st.id} targetWord length mismatch`);
    assert.ok(data.puzzleSet.has(st.startWord), `${st.id} startWord missing from puzzleSet`);
    assert.ok(data.puzzleSet.has(st.targetWord), `${st.id} targetWord missing from puzzleSet`);
    const puzBfs = bfsShortestPath(data.puzzleGraphs[st.wordLength], st.startWord, st.targetWord);
    const valBfs = bfsShortestPath(data.validationGraphs[st.wordLength], st.startWord, st.targetWord);
    assert.ok(puzBfs.solvable, `${st.id} not solvable in puzzle graph`);
    assert.ok(valBfs.solvable, `${st.id} not solvable in validation graph`);
    assert.equal(puzBfs.minMoves, st.minMoves, `${st.id} puz minMoves mismatch`);
    assert.equal(valBfs.minMoves, st.minMoves, `${st.id} val minMoves mismatch`);
  }
  console.log('[PASS] Verified 28,575 validation words, 9,808 puzzle words, and all 36 Adventure stages.');

  // 2. Difficulty Pools & Anti-Repetition Engine
  const difficulties: ChangeItDifficulty[] = ['beginner', 'easy', 'normal', 'hard', 'expert', 'master'];
  for (const diff of difficulties) {
    const p = generateVerifiedPuzzle(data, { difficulty: diff, wordLength: 'auto' });
    const cfg = DIFFICULTY_CONFIGS[diff];
    assert.ok(cfg.wordLengths.includes(p.wordLength), `${diff} produced unexpected length ${p.wordLength}`);
    assert.ok(p.minMoves >= cfg.minMoves, `${diff} minMoves ${p.minMoves} < ${cfg.minMoves}`);
    assert.ok(p.minMoves <= cfg.maxMoves, `${diff} minMoves ${p.minMoves} > ${cfg.maxMoves}`);
    assert.equal(p.canonicalKey, canonicalPuzzleKey(p.startWord, p.targetWord));
  }
  assert.equal(canonicalPuzzleKey('cold', 'warm'), canonicalPuzzleKey('WARM', 'COLD'));

  // Non-stalling relaxation when completedKeys & recentWords are heavily populated
  const stuffedRecent = new Set(data.puzzleByLength[4]);
  const stuffedKeys = new Set<string>(['COLD:WARM', 'HEAD:TAIL']);
  const relaxed = generateVerifiedPuzzle(data, {
    difficulty: 'easy',
    wordLength: 4,
    completedPuzzleKeys: stuffedKeys,
    recentWords: stuffedRecent,
    maxAttempts: 15,
  });
  assert.ok(
    bfsShortestPath(data.validationGraphs[4], relaxed.startWord, relaxed.targetWord).solvable,
    'Relaxed fallback puzzle must remain solvable'
  );
  console.log('[PASS] Verified all 6 difficulty pools and non-stalling canonical anti-repetition.');

  // Boot HTTP runtime
  const runtime = createEnscribeApp(
    {},
    { forceLocalGuestMemory: true, disableCloudSync: true, inMemoryOnly: true }
  );
  await runtime.prewarm();
  const server = http.createServer(runtime.app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const [aliceId, bobId, caraId, danId] = await Promise.all([
      claimGuest(baseUrl, 'ChangeAlice', 'av1'),
      claimGuest(baseUrl, 'ChangeBob', 'av2'),
      claimGuest(baseUrl, 'ChangeCara', 'av3'),
      claimGuest(baseUrl, 'ChangeDan', 'av4'),
    ]);

    // 3. Custom Puzzle Validation API & Privacy
    const validCustom = await jsonRequest<ChangeItCustomPuzzleValidation>(
      baseUrl,
      'POST',
      '/api/changeit/puzzles/validate',
      { startWord: 'cold', targetWord: 'warm' }
    );
    assert.equal(validCustom.status, 200);
    assert.equal(validCustom.data.valid, true);
    assert.equal(validCustom.data.minMoves, 4);
    assert.equal((validCustom.data as any).solutionPath, undefined, 'Never leak solutionPath');

    const badLen = await jsonRequest<ChangeItCustomPuzzleValidation>(
      baseUrl,
      'POST',
      '/api/changeit/puzzles/validate',
      { startWord: 'cat', targetWord: 'warm' }
    );
    assert.equal(badLen.data.valid, false);

    const badWord = await jsonRequest<ChangeItCustomPuzzleValidation>(
      baseUrl,
      'POST',
      '/api/changeit/puzzles/validate',
      { startWord: 'zzzz', targetWord: 'warm' }
    );
    assert.equal(badWord.data.valid, false);

    // Find a verified disconnected pair in length 5 validationGraph (since comp 0 isn't the only component)
    const g5 = data.validationGraphs[5];
    const w0 = g5.words[0];
    const comp0 = g5.componentIds[0];
    const otherIdx = g5.words.findIndex((_w, i) => g5.componentIds[i] !== comp0);
    if (otherIdx !== -1) {
      const disconn = await jsonRequest<ChangeItCustomPuzzleValidation>(
        baseUrl,
        'POST',
        '/api/changeit/puzzles/validate',
        { startWord: w0, targetWord: g5.words[otherIdx] }
      );
      assert.equal(disconn.data.valid, false, 'Disconnected pair must fail custom validation');
    }
    console.log('[PASS] Verified custom puzzle validator & disconnected graph detection.');

    // 4. Solo Adventure Progression, Core Rules, Hint Cap, Retry & Idempotent Reward Claim
    const lockedStart = await jsonRequest(baseUrl, 'POST', '/api/changeit/adventure/start', {
      playerId: aliceId,
      stageId: 'ci_ch1_s2',
    });
    assert.equal(lockedStart.status, 403, 'Locked level 1-2 must not be playable before 1-1');

    const s1 = await jsonRequest<ChangeItMatchStateClient>(
      baseUrl,
      'POST',
      '/api/changeit/adventure/start',
      { playerId: aliceId, stageId: 'ci_ch1_s1' }
    );
    assert.equal(s1.status, 201);
    const m1Id = s1.data.id;
    assert.equal(s1.data.self.startWord, 'CAT');
    assert.equal(s1.data.self.targetWord, 'DOG');
    assert.equal(s1.data.self.minMoves, 3);

    // Invalid word
    const invWord = await jsonRequest<ChangeItTransformResponse>(
      baseUrl,
      'POST',
      `/api/changeit/matches/${m1Id}/transform`,
      { playerId: aliceId, word: 'CXT' }
    );
    assert.equal(invWord.data.accepted, false);
    assert.equal(invWord.data.match.self.validMoves, 0);
    assert.equal(invWord.data.match.self.invalidAttempts, 1);

    // Two-letter jump without double_shift
    const twoJump = await jsonRequest<ChangeItTransformResponse>(
      baseUrl,
      'POST',
      `/api/changeit/matches/${m1Id}/transform`,
      { playerId: aliceId, word: 'COG' }
    );
    assert.equal(twoJump.data.accepted, false);
    assert.equal(twoJump.data.match.self.validMoves, 0);

    // Valid move CAT -> COT
    const step1 = await jsonRequest<ChangeItTransformResponse>(
      baseUrl,
      'POST',
      `/api/changeit/matches/${m1Id}/transform`,
      { playerId: aliceId, word: 'COT' }
    );
    assert.equal(step1.data.accepted, true);
    assert.equal(step1.data.match.self.currentWord, 'COT');
    assert.equal(step1.data.match.self.validMoves, 1);

    // Reuse CAT rejected
    const reuse = await jsonRequest<ChangeItTransformResponse>(
      baseUrl,
      'POST',
      `/api/changeit/matches/${m1Id}/transform`,
      { playerId: aliceId, word: 'CAT' }
    );
    assert.equal(reuse.data.accepted, false);

    // Complete COT -> DOT -> DOG
    await jsonRequest(baseUrl, 'POST', `/api/changeit/matches/${m1Id}/transform`, {
      playerId: aliceId,
      word: 'DOT',
    });
    const fin1 = await jsonRequest<ChangeItTransformResponse>(
      baseUrl,
      'POST',
      `/api/changeit/matches/${m1Id}/transform`,
      { playerId: aliceId, word: 'DOG' }
    );
    assert.equal(fin1.data.accepted, true);
    assert.equal(fin1.data.completedPuzzle, true);
    assert.equal(fin1.data.match.status, 'finished');

    // Concurrent duplicate claim -> coins awarded strictly once, 3★ earned
    const [claimA, claimB] = await Promise.all([
      jsonRequest<ChangeItAdventureClaimResult>(baseUrl, 'POST', '/api/changeit/adventure/claim', {
        playerId: aliceId,
        matchId: m1Id,
      }),
      jsonRequest<ChangeItAdventureClaimResult>(baseUrl, 'POST', '/api/changeit/adventure/claim', {
        playerId: aliceId,
        matchId: m1Id,
      }),
    ]);
    assert.equal(claimA.status, 200);
    assert.equal(claimB.status, 200);
    assert.equal(claimA.data.starsEarned, 3);
    assert.equal(claimA.data.coinsAwarded + claimB.data.coinsAwarded, 80);
    assert.ok(
      (claimA.data.claimed && !claimB.data.claimed) || (!claimA.data.claimed && claimB.data.claimed),
      'Exactly one concurrent adventure claim may award coins'
    );

    // Stage 1-2 now unlocked: BOY -> MAN (minMoves = 3). Test hint caps stars at 2, retry upgrades to 3.
    const progRes = await jsonRequest<ChangeItAdventureProgressClient>(
      baseUrl,
      'GET',
      `/api/changeit/adventure/progress/${aliceId}`
    );
    assert.equal(progRes.data.chapters[0].stages[1].unlocked, true);

    const s2 = await jsonRequest<ChangeItMatchStateClient>(
      baseUrl,
      'POST',
      '/api/changeit/adventure/start',
      { playerId: aliceId, stageId: 'ci_ch1_s2' }
    );
    assert.equal(s2.status, 201);
    const m2Id = s2.data.id;
    const hintRes = await jsonRequest<ChangeItMatchStateClient>(
      baseUrl,
      'POST',
      `/api/changeit/matches/${m2Id}/hint`,
      { playerId: aliceId }
    );
    assert.equal(hintRes.status, 200);
    assert.ok(hintRes.data.self.activeHintWord);
    assert.equal(hintRes.data.self.hintsUsed, 1);

    // Solve BOY -> BAY -> MAY -> MAN in 3 moves with 1 hint -> max 2★
    for (const w of ['BAY', 'MAY', 'MAN']) {
      await jsonRequest(baseUrl, 'POST', `/api/changeit/matches/${m2Id}/transform`, {
        playerId: aliceId,
        word: w,
      });
    }
    const hintClaim = await jsonRequest<ChangeItAdventureClaimResult>(
      baseUrl,
      'POST',
      '/api/changeit/adventure/claim',
      { playerId: aliceId, matchId: m2Id }
    );
    assert.equal(hintClaim.data.starsEarned, 2, 'Using hint must cap star rating at 2 stars');

    // Retry stage 1-2 with 4+2 moves (1★), then alternate clean 3-move path (3★)
    const retried = await jsonRequest<ChangeItMatchStateClient>(
      baseUrl,
      'POST',
      '/api/changeit/adventure/retry',
      { playerId: aliceId, matchId: m2Id }
    );
    assert.equal(retried.data.self.currentWord, 'BOY');
    assert.equal(retried.data.self.validMoves, 0);
    assert.equal(retried.data.self.hintsUsed, 0);

    for (const w of ['BOG', 'BAG', 'BAD', 'MAD', 'MAY', 'MAN']) {
      await jsonRequest(baseUrl, 'POST', `/api/changeit/matches/${m2Id}/transform`, {
        playerId: aliceId,
        word: w,
      });
    }
    const lowStarClaim = await jsonRequest<ChangeItAdventureClaimResult>(
      baseUrl,
      'POST',
      '/api/changeit/adventure/claim',
      { playerId: aliceId, matchId: m2Id }
    );
    assert.equal(lowStarClaim.data.starsEarned, 1, '6 moves vs min 3 moves should earn 1 star');
    assert.equal(lowStarClaim.data.coinsAwarded, 0, 'Replay must not re-award coins');

    await jsonRequest(baseUrl, 'POST', '/api/changeit/adventure/retry', {
      playerId: aliceId,
      matchId: m2Id,
    });
    for (const w of ['BAY', 'MAY', 'MAN']) {
      await jsonRequest(baseUrl, 'POST', `/api/changeit/matches/${m2Id}/transform`, {
        playerId: aliceId,
        word: w,
      });
    }
    const threeStarClaim = await jsonRequest<ChangeItAdventureClaimResult>(
      baseUrl,
      'POST',
      '/api/changeit/adventure/claim',
      { playerId: aliceId, matchId: m2Id }
    );
    assert.equal(threeStarClaim.data.starsEarned, 3);
    assert.equal(threeStarClaim.data.progress.chapters[0].stages[1].bestStars, 3);
    console.log('[PASS] Verified Solo Adventure rules, hint star cap, retry, and idempotent reward claims.');

    // 5A. Multiplayer Mode 1: Classic — Sprint + Opponent Privacy + Alternative Path Acceptance
    const sprintRoom = await createAndJoinRoom(
      baseUrl,
      aliceId,
      [bobId],
      { mode: 'classic_sprint', difficulty: 'easy', modifiersEnabled: false },
      { startWord: 'COLD', targetWord: 'WARM' }
    );
    const sprintStart = await jsonRequest<{ match: ChangeItMatchStateClient }>(
      baseUrl,
      'POST',
      `/api/changeit/rooms/${sprintRoom.id}/start`,
      { playerId: aliceId }
    );
    assert.equal(sprintStart.status, 201);
    const sprintId = sprintStart.data.match.id;

    // Alice plays alternative path CORD -> WORD -> WORM -> WARM
    await jsonRequest(baseUrl, 'POST', `/api/changeit/matches/${sprintId}/transform`, {
      playerId: aliceId,
      word: 'CORD',
    });

    // Bob must NOT see Alice's word "CORD" while active
    const bobActiveView = await jsonRequest<ChangeItMatchStateClient>(
      baseUrl,
      'GET',
      `/api/changeit/matches/${sprintId}?playerId=${bobId}`
    );
    assert.equal(bobActiveView.data.status, 'playing');
    assert.equal(bobActiveView.data.opponents[0].validMoves, 1);
    assert.equal(bobActiveView.data.opponents[0].revealedHistory, undefined);
    assert.ok(
      !JSON.stringify(bobActiveView.data.opponents).includes('CORD'),
      'Opponent intermediate word leaked during active Sprint match!'
    );

    for (const w of ['WORD', 'WORM', 'WARM']) {
      await jsonRequest(baseUrl, 'POST', `/api/changeit/matches/${sprintId}/transform`, {
        playerId: aliceId,
        word: w,
      });
    }
    const sprintBobFinal = await jsonRequest<ChangeItMatchStateClient>(
      baseUrl,
      'GET',
      `/api/changeit/matches/${sprintId}?playerId=${bobId}`
    );
    assert.equal(sprintBobFinal.data.status, 'finished');
    assert.deepEqual(sprintBobFinal.data.winnerIds, [aliceId]);
    assert.equal(sprintBobFinal.data.opponents[0].revealedHistory?.length, 4);
    console.log('[PASS] Verified Classic — Sprint, alternative paths, and strict anti-cheat privacy.');

    // 5B. Multiplayer Mode 2: Classic — Precision (must NOT end early on 1st finisher)
    const precRoom = await createAndJoinRoom(
      baseUrl,
      aliceId,
      [bobId],
      { mode: 'classic_precision', difficulty: 'easy', timeLimitSeconds: 180 },
      { startWord: 'COLD', targetWord: 'WARM' }
    );
    const precStart = await jsonRequest<{ match: ChangeItMatchStateClient }>(
      baseUrl,
      'POST',
      `/api/changeit/rooms/${precRoom.id}/start`,
      { playerId: aliceId }
    );
    assert.equal(precStart.status, 201);
    const precId = precStart.data.match.id;

    // Alice finishes FIRST using 6 moves (COLD -> BOLD -> BALD -> BARD -> WARD -> WORM -> WARM? Wait verify!)
    const alice6Moves = ['SOLD', 'SOLE', 'SALE', 'PALE', 'PARE', 'WARE', 'WARM']; // wait 7, let's check via path: COLD -> BOLD -> BALD -> BARD -> CARD -> WARD -> WARM (6 moves)
    for (const w of ['BOLD', 'BALD', 'BARD', 'CARD', 'WARD', 'WARM']) {
      const r = await jsonRequest<ChangeItTransformResponse>(
        baseUrl,
        'POST',
        `/api/changeit/matches/${precId}/transform`,
        { playerId: aliceId, word: w }
      );
      assert.equal(r.data.accepted, true, `Expected Precision step ${w} valid: ${r.data.message}`);
    }

    const midPrec = await jsonRequest<ChangeItMatchStateClient>(
      baseUrl,
      'GET',
      `/api/changeit/matches/${precId}?playerId=${bobId}`
    );
    assert.equal(midPrec.data.status, 'playing', 'Precision MUST NOT end early when first player finishes!');
    assert.equal(midPrec.data.opponents[0].completed, true);

    // Bob finishes slower in 4 optimal moves and MUST win
    for (const w of ['CORD', 'CARD', 'WARD', 'WARM']) {
      await jsonRequest(baseUrl, 'POST', `/api/changeit/matches/${precId}/transform`, {
        playerId: bobId,
        word: w,
      });
    }
    const endPrec = await jsonRequest<ChangeItMatchStateClient>(
      baseUrl,
      'GET',
      `/api/changeit/matches/${precId}?playerId=${aliceId}`
    );
    assert.equal(endPrec.data.status, 'finished');
    assert.deepEqual(endPrec.data.winnerIds, [bobId], 'Fewer-move solver must win Classic — Precision');
    console.log('[PASS] Verified Classic — Precision non-early completion and efficiency winner.');

    // 5C. Multiplayer Mode 3: Tug of War (opposite ends of same puzzle)
    const towRoom = await createAndJoinRoom(
      baseUrl,
      aliceId,
      [bobId],
      { mode: 'tug_of_war', difficulty: 'easy' },
      { startWord: 'COLD', targetWord: 'WARM' }
    );
    const towStart = await jsonRequest<{ match: ChangeItMatchStateClient }>(
      baseUrl,
      'POST',
      `/api/changeit/rooms/${towRoom.id}/start`,
      { playerId: aliceId }
    );
    assert.equal(towStart.status, 201);
    const towId = towStart.data.match.id;
    const towBobView = await jsonRequest<ChangeItMatchStateClient>(
      baseUrl,
      'GET',
      `/api/changeit/matches/${towId}?playerId=${bobId}`
    );
    assert.equal(towStart.data.match.self.startWord, 'COLD');
    assert.equal(towStart.data.match.self.targetWord, 'WARM');
    assert.equal(towBobView.data.self.startWord, 'WARM');
    assert.equal(towBobView.data.self.targetWord, 'COLD');
    assert.equal(towStart.data.match.self.minMoves, towBobView.data.self.minMoves);

    for (const w of ['WARD', 'CARD', 'CORD', 'COLD']) {
      await jsonRequest(baseUrl, 'POST', `/api/changeit/matches/${towId}/transform`, {
        playerId: bobId,
        word: w,
      });
    }
    const towAfter = await jsonRequest<ChangeItMatchStateClient>(
      baseUrl,
      'GET',
      `/api/changeit/matches/${towId}?playerId=${aliceId}`
    );
    assert.equal(towAfter.data.status, 'finished');
    assert.deepEqual(towAfter.data.winnerIds, [bobId]);
    console.log('[PASS] Verified Tug of War opposite-direction mirrored puzzle & victory.');

    // 5D. Multiplayer Mode 4: Survival (shared chain advancement & timer extension)
    const survRoom = await createAndJoinRoom(baseUrl, aliceId, [bobId], {
      mode: 'survival',
      difficulty: 'easy',
      wordLength: 4,
    });
    const survStart = await jsonRequest<{ match: ChangeItMatchStateClient }>(
      baseUrl,
      'POST',
      `/api/changeit/rooms/${survRoom.id}/start`,
      { playerId: aliceId }
    );
    assert.equal(survStart.status, 201);
    const survId = survStart.data.match.id;
    const deadlineBefore = survStart.data.match.self.playerDeadlineMs!;
    const firstTarget = survStart.data.match.self.targetWord;
    const survBfs = bfsShortestPath(
      data.validationGraphs[4],
      survStart.data.match.self.startWord,
      firstTarget
    );
    assert.ok(survBfs.solvable);
    for (let i = 1; i < survBfs.path.length; i++) {
      await jsonRequest(baseUrl, 'POST', `/api/changeit/matches/${survId}/transform`, {
        playerId: aliceId,
        word: survBfs.path[i],
      });
    }
    const survAfter1 = await jsonRequest<ChangeItMatchStateClient>(
      baseUrl,
      'GET',
      `/api/changeit/matches/${survId}?playerId=${aliceId}`
    );
    assert.equal(survAfter1.data.status, 'playing');
    assert.equal(survAfter1.data.self.puzzlesCompleted, 1);
    assert.equal(survAfter1.data.self.startWord, firstTarget, 'Completed target must become next start word');
    assert.ok(
      (survAfter1.data.self.playerDeadlineMs ?? 0) > deadlineBefore,
      'Solving in Survival must extend player deadline'
    );
    // Bob forfeits -> Alice wins
    await jsonRequest(baseUrl, 'POST', `/api/changeit/matches/${survId}/forfeit`, {
      playerId: bobId,
    });
    const survEnd = await jsonRequest<ChangeItMatchStateClient>(
      baseUrl,
      'GET',
      `/api/changeit/matches/${survId}?playerId=${aliceId}`
    );
    assert.equal(survEnd.data.status, 'finished');
    assert.deepEqual(survEnd.data.winnerIds, [aliceId]);
    console.log('[PASS] Verified Survival chain advancement, time bonus, and scoring.');

    // 5E. Multiplayer Mode 5: Restricted (mathematical solvability & constraint enforcement)
    const restRoom = await createAndJoinRoom(baseUrl, aliceId, [bobId], {
      mode: 'restricted',
      difficulty: 'normal',
      wordLength: 4,
    });
    const restStart = await jsonRequest<{ match: ChangeItMatchStateClient }>(
      baseUrl,
      'POST',
      `/api/changeit/rooms/${restRoom.id}/start`,
      { playerId: aliceId }
    );
    assert.equal(restStart.status, 201);
    const restId = restStart.data.match.id;
    const rSelf = restStart.data.match.self;
    const r = rSelf.restrictions;
    assert.ok(
      r.lockedPositions.length > 0 || r.forbiddenLetters.length > 0 || r.noConsecutiveSamePosition,
      'Restricted mode must apply at least one mathematical restriction'
    );
    const restPath = bfsShortestPath(
      data.validationGraphs[rSelf.startWord.length as ChangeItWordLength],
      rSelf.startWord,
      rSelf.targetWord,
      {
        lockedPositions: new Set(r.lockedPositions),
        forbiddenLetters: new Set(r.forbiddenLetters),
        noConsecutiveSamePosition: r.noConsecutiveSamePosition,
      }
    );
    assert.ok(restPath.solvable, 'Restricted puzzle MUST be mathematically solvable under its restrictions');
    for (let i = 1; i < restPath.path.length; i++) {
      const step = await jsonRequest<ChangeItTransformResponse>(
        baseUrl,
        'POST',
        `/api/changeit/matches/${restId}/transform`,
        { playerId: aliceId, word: restPath.path[i] }
      );
      assert.equal(step.data.accepted, true, `Restricted BFS step ${restPath.path[i]} failed: ${step.data.message}`);
    }
    const restFinal = await jsonRequest<ChangeItMatchStateClient>(
      baseUrl,
      'GET',
      `/api/changeit/matches/${restId}?playerId=${aliceId}`
    );
    assert.equal(restFinal.data.status, 'finished');
    assert.deepEqual(restFinal.data.winnerIds, [aliceId]);
    console.log('[PASS] Verified Restricted mode BFS solvability & completion.');

    // 5F. Multiplayer Mode 6: Relay (2v2 team turns, invalid keeps turn, turn timeout auto-advance)
    const relayRoom = await createAndJoinRoom(
      baseUrl,
      aliceId,
      [bobId, caraId, danId],
      { mode: 'relay', difficulty: 'easy', relayTurnSeconds: 15 },
      { startWord: 'COLD', targetWord: 'WARM' }
    );
    // Assign Alice + Cara -> blue, Bob + Dan -> red
    await jsonRequest(baseUrl, 'POST', `/api/changeit/rooms/${relayRoom.id}/team`, {
      playerId: aliceId,
      teamId: 'blue',
    });
    await jsonRequest(baseUrl, 'POST', `/api/changeit/rooms/${relayRoom.id}/team`, {
      playerId: caraId,
      teamId: 'blue',
    });
    await jsonRequest(baseUrl, 'POST', `/api/changeit/rooms/${relayRoom.id}/team`, {
      playerId: bobId,
      teamId: 'red',
    });
    await jsonRequest(baseUrl, 'POST', `/api/changeit/rooms/${relayRoom.id}/team`, {
      playerId: danId,
      teamId: 'red',
    });
    const relayStart = await jsonRequest<{ match: ChangeItMatchStateClient }>(
      baseUrl,
      'POST',
      `/api/changeit/rooms/${relayRoom.id}/start`,
      { playerId: aliceId }
    );
    assert.equal(relayStart.status, 201);
    const relayId = relayStart.data.match.id;
    assert.equal(relayStart.data.match.relayTeams?.blue.activeTurnPlayerId, aliceId);

    // Non-active teammate Cara rejected
    const outOfTurn = await jsonRequest(baseUrl, 'POST', `/api/changeit/matches/${relayId}/transform`, {
      playerId: caraId,
      word: 'CORD',
    });
    assert.equal(outOfTurn.status, 400);

    // Invalid word keeps turn on Alice
    const invalidRelay = await jsonRequest<ChangeItTransformResponse>(
      baseUrl,
      'POST',
      `/api/changeit/matches/${relayId}/transform`,
      { playerId: aliceId, word: 'ZZZZ' }
    );
    assert.equal(invalidRelay.data.accepted, false);
    assert.equal(invalidRelay.data.match.relayTeams?.blue.activeTurnPlayerId, aliceId);

    // Valid move by Alice passes turn to Cara
    const validRelay1 = await jsonRequest<ChangeItTransformResponse>(
      baseUrl,
      'POST',
      `/api/changeit/matches/${relayId}/transform`,
      { playerId: aliceId, word: 'CORD' }
    );
    assert.equal(validRelay1.data.accepted, true);
    assert.equal(validRelay1.data.match.relayTeams?.blue.activeTurnPlayerId, caraId);

    // Expire Cara's turn timer and verify processExpiredTimers advances back to Alice safely
    const internalRelay = (await runtime.changeItEngine.store.getMatch(relayId))!;
    internalRelay.relayTeams!.blue.turnDeadlineMs = Date.now() - 1000;
    await runtime.changeItEngine.store.insertMatch(internalRelay);
    await runtime.changeItEngine.processExpiredTimers();
    const afterTimeout = await jsonRequest<ChangeItMatchStateClient>(
      baseUrl,
      'GET',
      `/api/changeit/matches/${relayId}?playerId=${aliceId}`
    );
    assert.equal(
      afterTimeout.data.relayTeams?.blue.activeTurnPlayerId,
      aliceId,
      'Expired Relay turn timer should hand turn cleanly to next teammate'
    );

    // Finish Relay alternating Alice -> Cara -> Alice
    await jsonRequest(baseUrl, 'POST', `/api/changeit/matches/${relayId}/transform`, {
      playerId: aliceId,
      word: 'CARD',
    });
    await jsonRequest(baseUrl, 'POST', `/api/changeit/matches/${relayId}/transform`, {
      playerId: caraId,
      word: 'WARD',
    });
    const relayWin = await jsonRequest<ChangeItTransformResponse>(
      baseUrl,
      'POST',
      `/api/changeit/matches/${relayId}/transform`,
      { playerId: aliceId, word: 'WARM' }
    );
    assert.equal(relayWin.data.completedPuzzle, true);
    assert.equal(relayWin.data.match.status, 'finished');
    assert.equal(relayWin.data.match.winningTeamId, 'blue');
    console.log('[PASS] Verified 2v2 Relay turn handoffs, out-of-turn guard, timer expiry, and team win.');

    // 5G. Multiplayer Mode 7: Sabotage & All 5 Verified Modifiers
    const sabRoom = await createAndJoinRoom(
      baseUrl,
      aliceId,
      [bobId],
      { mode: 'sabotage', difficulty: 'easy', modifiersEnabled: true },
      { startWord: 'COLD', targetWord: 'WARM' }
    );
    const sabStart = await jsonRequest<{ match: ChangeItMatchStateClient }>(
      baseUrl,
      'POST',
      `/api/changeit/rooms/${sabRoom.id}/start`,
      { playerId: aliceId }
    );
    assert.equal(sabStart.status, 201);
    const sabId = sabStart.data.match.id;
    assert.ok(
      sabStart.data.match.self.heldModifiers.includes('double_shift'),
      'Sabotage match must provide starter tactical modifier'
    );

    // 1) Double Shift -> 2-letter jump COLD -> CARD!
    const actDS = await jsonRequest<ChangeItModifierResponse>(
      baseUrl,
      'POST',
      `/api/changeit/matches/${sabId}/modifier`,
      { playerId: aliceId, modifierType: 'double_shift' }
    );
    assert.equal(actDS.data.activated, true);
    const jump2 = await jsonRequest<ChangeItTransformResponse>(
      baseUrl,
      'POST',
      `/api/changeit/matches/${sabId}/transform`,
      { playerId: aliceId, word: 'CARD' }
    );
    assert.equal(jump2.data.accepted, true);
    assert.equal(jump2.data.usedDoubleShift, true);

    // Stock Alice with remaining 4 modifier charges via store for deterministic verification of all 5 modifiers
    const sabInternal1 = (await runtime.changeItEngine.store.getMatch(sabId))!;
    sabInternal1.boards[aliceId].heldModifiers = [
      'pathfinder',
      'letter_lock',
      'frozen_letter',
      'reroute',
    ];
    await runtime.changeItEngine.store.insertMatch(sabInternal1);

    // 2) Pathfinder -> reveals optimal next move from CARD toward WARM (WARD)
    const actPF = await jsonRequest<ChangeItModifierResponse>(
      baseUrl,
      'POST',
      `/api/changeit/matches/${sabId}/modifier`,
      { playerId: aliceId, modifierType: 'pathfinder' }
    );
    assert.equal(actPF.data.activated, true);
    assert.equal(actPF.data.match.self.activeHintWord, 'WARD');

    // 3) Softlock guard: before Bob matches any letter of WARM from COLD, locking ANY slot blocks COLD->WARM
    const preLockRefusal = await jsonRequest(
      baseUrl,
      'POST',
      `/api/changeit/matches/${sabId}/modifier`,
      { playerId: aliceId, modifierType: 'letter_lock', targetPlayerId: bobId }
    );
    assert.equal(
      preLockRefusal.status,
      400,
      'Letter Lock must refuse when every slot differs from target and locking would softlock'
    );

    // Bob plays CORD (now index 2 'R' agrees with WARM[2])
    const bobStep = await jsonRequest<ChangeItTransformResponse>(
      baseUrl,
      'POST',
      `/api/changeit/matches/${sabId}/transform`,
      { playerId: bobId, word: 'CORD' }
    );
    assert.equal(bobStep.data.accepted, true);

    // Now Letter Lock on Bob succeeds safely + anti-stacking blocks simultaneous Frozen Letter
    const actLL = await jsonRequest<ChangeItModifierResponse>(
      baseUrl,
      'POST',
      `/api/changeit/matches/${sabId}/modifier`,
      { playerId: aliceId, modifierType: 'letter_lock', targetPlayerId: bobId }
    );
    assert.equal(actLL.status, 200, `Letter Lock failed: ${JSON.stringify(actLL.data)}`);
    assert.equal(actLL.data.activated, true);
    const stackedFL = await jsonRequest(baseUrl, 'POST', `/api/changeit/matches/${sabId}/modifier`, {
      playerId: aliceId,
      modifierType: 'frozen_letter',
      targetPlayerId: bobId,
    });
    assert.equal(stackedFL.status, 400, 'Anti-stacking must prevent simultaneous letter lock & freeze');

    // Verify Bob's board remains mathematically solvable under active lock!
    const bobLockedMatch = (await runtime.changeItEngine.store.getMatch(sabId))!;
    const bobLockedIndices = bobLockedMatch.boards[bobId].activeModifiers
      .filter((m) => m.type === 'letter_lock' && m.lockedIndex !== undefined && m.lockedIndex !== null)
      .map((m) => m.lockedIndex as number);
    assert.equal(bobLockedIndices.length, 1);
    assert.ok(
      bfsShortestPath(data.validationGraphs[4], bobLockedMatch.boards[bobId].currentWord, 'WARM', {
        lockedPositions: new Set(bobLockedIndices),
        excludedWords: new Set(bobLockedMatch.boards[bobId].usedWords),
      }).solvable,
      'Letter lock must always leave Bob with a valid BFS path to target'
    );

    // Clear Bob's active lock + immunity cleanly in test store, then test 4) Frozen Letter & 5) Reroute
    bobLockedMatch.boards[bobId].activeModifiers = [];
    bobLockedMatch.boards[bobId].disruptionImmunityUntilMs = 0;
    await runtime.changeItEngine.store.insertMatch(bobLockedMatch);

    const actFL = await jsonRequest<ChangeItModifierResponse>(
      baseUrl,
      'POST',
      `/api/changeit/matches/${sabId}/modifier`,
      { playerId: aliceId, modifierType: 'frozen_letter', targetPlayerId: bobId }
    );
    assert.equal(actFL.status, 200, `Frozen Letter failed: ${JSON.stringify(actFL.data)}`);
    assert.equal(actFL.data.activated, true);

    const actRR = await jsonRequest<ChangeItModifierResponse>(
      baseUrl,
      'POST',
      `/api/changeit/matches/${sabId}/modifier`,
      { playerId: aliceId, modifierType: 'reroute', targetPlayerId: bobId }
    );
    assert.equal(actRR.status, 200, `Reroute failed: ${JSON.stringify(actRR.data)}`);
    assert.equal(actRR.data.activated, true);
    const bobAfterReroute = await jsonRequest<ChangeItMatchStateClient>(
      baseUrl,
      'GET',
      `/api/changeit/matches/${sabId}?playerId=${bobId}`
    );
    assert.notEqual(bobAfterReroute.data.self.targetWord, 'WARM', 'Reroute must change opponent target word');
    assert.equal(bobAfterReroute.data.self.minMoves, 4, 'Reroute must preserve equivalent remaining difficulty');

    // Finish Sabotage match
    await jsonRequest(baseUrl, 'POST', `/api/changeit/matches/${sabId}/transform`, {
      playerId: aliceId,
      word: 'WARD',
    });
    const sabFin = await jsonRequest<ChangeItTransformResponse>(
      baseUrl,
      'POST',
      `/api/changeit/matches/${sabId}/transform`,
      { playerId: aliceId, word: 'WARM' }
    );
    assert.equal(sabFin.data.completedPuzzle, true);
    console.log('[PASS] Verified Sabotage & all 5 modifiers (Double Shift, Pathfinder, Letter Lock, Frozen Letter, Reroute).');

    // 6. Ranked Sprint & Ranked Precision Matchmaking + Elo Leaderboard + Reconnect
    const q1 = await jsonRequest(baseUrl, 'POST', '/api/changeit/matchmaking/ranked', {
      playerId: aliceId,
      format: 'classic_sprint',
    });
    assert.equal(q1.data.status, 'queued');
    const q2 = await jsonRequest(baseUrl, 'POST', '/api/changeit/matchmaking/ranked', {
      playerId: bobId,
      format: 'classic_sprint',
    });
    assert.equal(q2.data.status, 'matched');
    const rankedSprintMatch = q2.data.match as ChangeItMatchStateClient;
    assert.equal(rankedSprintMatch.isRanked, true);
    assert.equal(rankedSprintMatch.modifiersEnabled, false, 'Ranked must disable modifiers');
    assert.equal(rankedSprintMatch.hintsAllowed, false, 'Ranked must disable hints');

    // Forfeit updates Elo RP & Leaderboard
    await jsonRequest(baseUrl, 'POST', `/api/changeit/matches/${rankedSprintMatch.id}/forfeit`, {
      playerId: bobId,
    });
    const lb = await jsonRequest<ChangeItLeaderboardResponse>(
      baseUrl,
      'GET',
      `/api/changeit/leaderboard?playerId=${aliceId}`
    );
    assert.equal(lb.status, 200);
    const aliceStats = lb.data.rankedLeaders.find((s) => s.playerId === aliceId);
    const bobStats = lb.data.rankedLeaders.find((s) => s.playerId === bobId);
    assert.ok(aliceStats && aliceStats.rating > 1000, 'Ranked winner RP should exceed 1000');
    assert.ok(bobStats && bobStats.rating < 1000, 'Ranked loser RP should drop below 1000');
    assert.ok(lb.data.recentHistory.length >= 1, 'Expected match history entries for Alice');

    // Ranked Precision pair test
    const qp1 = await jsonRequest(baseUrl, 'POST', '/api/changeit/matchmaking/ranked', {
      playerId: caraId,
      format: 'classic_precision',
    });
    assert.equal(qp1.data.status, 'queued');
    const qp2 = await jsonRequest(baseUrl, 'POST', '/api/changeit/matchmaking/ranked', {
      playerId: danId,
      format: 'classic_precision',
    });
    assert.equal(qp2.data.status, 'matched');
    assert.equal(qp2.data.match.mode, 'classic_precision');
    console.log('[PASS] Verified Ranked Sprint & Ranked Precision queues, Elo RP, forfeit, and leaderboard.');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

main().catch((err) => {
  console.error('ChangeIt verification FAILED:', err);
  process.exit(1);
});
