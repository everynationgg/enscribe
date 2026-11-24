import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createEnscribeApp } from '../server/app.js';
import {
  TWISTIT_PUZZLE_CATALOG,
  canFormFromLetters,
} from '../shared/twistit/catalog.js';
import { TwistItMatchView } from '../shared/twistit/types.js';

async function jsonRequest<T = any>(
  baseUrl: string,
  method: string,
  urlPath: string,
  body?: any
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}

async function main() {
  // 1. Dictionary & Puzzle Catalog Validation
  const dictPath = path.resolve(process.cwd(), 'public', 'dictionaries', 'en.txt');
  const dictSet = new Set(
    fs
      .readFileSync(dictPath, 'utf8')
      .split(/\r?\n/)
      .map((w) => w.trim().toUpperCase())
      .filter(Boolean)
  );

  assert.ok(
    TWISTIT_PUZZLE_CATALOG.length >= 90,
    `Expected >= 90 puzzles in TwistIt catalog, got ${TWISTIT_PUZZLE_CATALOG.length}`
  );

  const seenPuzzleIds = new Set<string>();
  for (const p of TWISTIT_PUZZLE_CATALOG) {
    assert.ok(!seenPuzzleIds.has(p.id), `Duplicate puzzle ID: ${p.id}`);
    seenPuzzleIds.add(p.id);
    assert.equal(p.letters.length, 6, `${p.id}: expected 6 letters`);
    assert.ok(
      p.answers.length >= 10 && p.answers.length <= 16,
      `${p.id}: expected 10-16 answers, got ${p.answers.length}`
    );
    assert.ok(
      p.answers.some((w) => w.length === 6),
      `${p.id}: missing 6-letter pangram answer`
    );
    const seenWords = new Set<string>();
    for (const ans of p.answers) {
      assert.ok(ans.length >= 3 && ans.length <= 6, `${p.id}: invalid length ${ans}`);
      assert.ok(!seenWords.has(ans), `${p.id}: duplicate answer ${ans}`);
      seenWords.add(ans);
      assert.ok(dictSet.has(ans), `${p.id}: ${ans} missing from en.txt`);
      assert.ok(
        canFormFromLetters(ans, p.letters),
        `${p.id}: ${ans} cannot be formed once-per-tile from ${p.letters.join('')}`
      );
    }
  }
  console.log(`[PASS] Verified all ${TWISTIT_PUZZLE_CATALOG.length} TwistIt puzzles against en.txt.`);

  // Boot test app instance on ephemeral port
  const runtime = createEnscribeApp({}, { forceLocalGuestMemory: true, disableCloudSync: true, inMemoryOnly: true });
  await runtime.prewarm();
  const server = http.createServer(runtime.app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // Claim two guest players
    const gA = await jsonRequest(baseUrl, 'POST', '/api/guest/claim', {
      nickname: 'TwistAlice',
      avatarId: 'av1',
    });
    const gB = await jsonRequest(baseUrl, 'POST', '/api/guest/claim', {
      nickname: 'TwistBob',
      avatarId: 'av2',
    });
    assert.equal(gA.status, 200);
    assert.equal(gB.status, 200);
    const aliceId = gA.data.profile.id as string;
    const bobId = gB.data.profile.id as string;

    // 2. Solo Mode E2E + Countdown Guard + Anti-cheat Slot Hiding + Personal Best
    const soloStart = await jsonRequest<TwistItMatchView>(baseUrl, 'POST', '/api/twistit/solo/start', {
      playerId: aliceId,
    });
    assert.equal(soloStart.status, 201);
    const soloMatchId = soloStart.data.id;
    assert.equal(soloStart.data.status, 'countdown');
    assert.ok(soloStart.data.selfSlots.every((s) => !s.revealed && s.word === null));

    const soloDef = TWISTIT_PUZZLE_CATALOG.find((p) => p.id === soloStart.data.puzzleId)!;
    assert.ok(soloDef, 'Expected puzzle definition in catalog');

    // Early submit during countdown rejected
    const earlySub = await jsonRequest(baseUrl, 'POST', `/api/twistit/matches/${soloMatchId}/submit`, {
      playerId: aliceId,
      word: soloDef.answers[0],
    });
    assert.equal(earlySub.data.accepted, false);
    assert.equal(earlySub.data.errorCode, 'COUNTDOWN_ACTIVE');

    // Advance internal startsAtMs past countdown cleanly for fast deterministic test
    const internalSolo = (await runtime.twistItEngine.store.getMatch(soloMatchId))!;
    internalSolo.startsAtMs = Date.now() - 5000;
    await runtime.twistItEngine.store.saveMatch(internalSolo);

    // Invalid rejections: short, impossible letters, unknown word
    const shortRes = await jsonRequest(baseUrl, 'POST', `/api/twistit/matches/${soloMatchId}/submit`, {
      playerId: aliceId,
      word: 'HI',
    });
    assert.equal(shortRes.data.errorCode, 'TOO_SHORT');

    const badLettersRes = await jsonRequest(baseUrl, 'POST', `/api/twistit/matches/${soloMatchId}/submit`, {
      playerId: aliceId,
      word: 'ZZZZZ',
    });
    assert.equal(badLettersRes.data.errorCode, 'INVALID_LETTERS');

    // Submit first word, then duplicate
    const firstWord = soloDef.answers[0];
    const okFirst = await jsonRequest(baseUrl, 'POST', `/api/twistit/matches/${soloMatchId}/submit`, {
      playerId: aliceId,
      word: firstWord,
    });
    assert.equal(okFirst.data.accepted, true);
    assert.equal(okFirst.data.completedPuzzle, false);

    const dupRes = await jsonRequest(baseUrl, 'POST', `/api/twistit/matches/${soloMatchId}/submit`, {
      playerId: aliceId,
      word: firstWord,
    });
    assert.equal(dupRes.data.accepted, false);
    assert.equal(dupRes.data.errorCode, 'ALREADY_FOUND');

    // Solve remaining words to finish solo puzzle
    for (let i = 1; i < soloDef.answers.length; i++) {
      const r = await jsonRequest(baseUrl, 'POST', `/api/twistit/matches/${soloMatchId}/submit`, {
        playerId: aliceId,
        word: soloDef.answers[i],
      });
      assert.equal(r.data.accepted, true);
      if (i === soloDef.answers.length - 1) {
        assert.equal(r.data.completedPuzzle, true);
        assert.equal(r.data.match.status, 'finished');
        assert.equal(r.data.match.isNewPersonalBest, true);
      }
    }

    const soloStats = await jsonRequest(baseUrl, 'GET', `/api/twistit/solo/stats?playerId=${encodeURIComponent(aliceId)}`);
    assert.equal(soloStats.data.completedPuzzlesCount, 1);
    assert.ok(soloStats.data.bestDurationMs > 0);
    console.log('[PASS] Verified TwistIt Solo lifecycle, rejections, accuracy, completion, and PB.');

    // 3. 1v1 Speed Race Room + Privacy + Concurrent Race + Victory + Rematch Non-Repeat
    const roomCreate = await jsonRequest(baseUrl, 'POST', '/api/twistit/rooms/create', {
      playerId: aliceId,
      settings: { isPublic: true, roundDurationSec: 180 },
    });
    assert.equal(roomCreate.status, 201);
    const roomCode = roomCreate.data.code as string;

    const roomJoin = await jsonRequest(baseUrl, 'POST', '/api/twistit/rooms/join', {
      code: roomCode,
      playerId: bobId,
    });
    assert.equal(roomJoin.status, 200);
    assert.equal(roomJoin.data.players.length, 2);

    // Reject 3rd player since 1v1 capacity is strictly 2
    const gC = await jsonRequest(baseUrl, 'POST', '/api/guest/claim', {
      nickname: 'ThirdWheel',
      avatarId: 'av3',
    });
    const thirdJoin = await jsonRequest(baseUrl, 'POST', '/api/twistit/rooms/join', {
      code: roomCode,
      playerId: gC.data.profile.id,
    });
    assert.equal(thirdJoin.status, 400);

    const start1v1 = await jsonRequest(baseUrl, 'POST', `/api/twistit/rooms/${roomCode}/start`, {
      playerId: aliceId,
    });
    assert.equal(start1v1.status, 201);
    const raceId = start1v1.data.match.id as string;
    const raceDef = TWISTIT_PUZZLE_CATALOG.find((p) => p.id === start1v1.data.match.puzzleId)!;

    // Advance countdown cleanly
    const internalRace = (await runtime.twistItEngine.store.getMatch(raceId))!;
    internalRace.startsAtMs = Date.now() - 2000;
    await runtime.twistItEngine.store.saveMatch(internalRace);

    // Verify identical puzzle letters and counts for both players
    const aliceView0 = await jsonRequest<TwistItMatchView>(
      baseUrl,
      'GET',
      `/api/twistit/matches/${raceId}?playerId=${encodeURIComponent(aliceId)}`
    );
    const bobView0 = await jsonRequest<TwistItMatchView>(
      baseUrl,
      'GET',
      `/api/twistit/matches/${raceId}?playerId=${encodeURIComponent(bobId)}`
    );
    assert.deepEqual(aliceView0.data.scrambledLetters, bobView0.data.scrambledLetters);
    assert.equal(aliceView0.data.totalRequired, bobView0.data.totalRequired);

    // Concurrent submissions by Alice and Bob
    await Promise.all([
      jsonRequest(baseUrl, 'POST', `/api/twistit/matches/${raceId}/submit`, {
        playerId: aliceId,
        word: raceDef.answers[0],
      }),
      jsonRequest(baseUrl, 'POST', `/api/twistit/matches/${raceId}/submit`, {
        playerId: aliceId,
        word: raceDef.answers[1],
      }),
      jsonRequest(baseUrl, 'POST', `/api/twistit/matches/${raceId}/submit`, {
        playerId: bobId,
        word: raceDef.answers[2],
      }),
    ]);

    // STRICT PRIVACY CHECK: Bob sees Alice's foundCount=2, but NEVER Alice's individual words while active
    const bobViewActive = await jsonRequest<TwistItMatchView>(
      baseUrl,
      'GET',
      `/api/twistit/matches/${raceId}?playerId=${encodeURIComponent(bobId)}`
    );
    assert.equal(bobViewActive.data.status, 'playing');
    const aliceInBobView = bobViewActive.data.players.find((p) => p.userId === aliceId)!;
    assert.equal(aliceInBobView.foundCount, 2);
    assert.equal(aliceInBobView.slots, undefined, 'Opponent slots MUST remain hidden during active race');
    assert.equal(bobViewActive.data.selfSlots[0].revealed, false);
    assert.equal(bobViewActive.data.selfSlots[0].word, null);
    assert.equal(bobViewActive.data.selfSlots[2].revealed, true);

    // Alice solves remaining words and wins immediately
    for (let i = 2; i < raceDef.answers.length; i++) {
      await jsonRequest(baseUrl, 'POST', `/api/twistit/matches/${raceId}/submit`, {
        playerId: aliceId,
        word: raceDef.answers[i],
      });
    }
    const aliceFinal = await jsonRequest<TwistItMatchView>(
      baseUrl,
      'GET',
      `/api/twistit/matches/${raceId}?playerId=${encodeURIComponent(aliceId)}`
    );
    assert.equal(aliceFinal.data.status, 'finished');
    assert.equal(aliceFinal.data.finishReason, 'completed_all');
    assert.deepEqual(aliceFinal.data.winnerIds, [aliceId]);

    // Rematch uses a different puzzle
    const rematchRes = await jsonRequest(baseUrl, 'POST', `/api/twistit/rooms/${roomCode}/rematch`, {
      playerId: bobId,
    });
    assert.equal(rematchRes.status, 201);
    const rematchId = rematchRes.data.match.id as string;
    assert.notEqual(rematchRes.data.match.puzzleId, start1v1.data.match.puzzleId);

    // 4. Timeout Tie-breaker Checks:
    // 4a. Same found count -> higher total letters wins
    const rmInternal = (await runtime.twistItEngine.store.getMatch(rematchId))!;
    const rmDef = TWISTIT_PUZZLE_CATALOG.find((p) => p.id === rmInternal.puzzleId)!;
    rmInternal.startsAtMs = Date.now() - 190000;
    rmInternal.endsAtMs = Date.now() - 5000;
    rmInternal.status = 'playing';
    // Alice finds 1 short (3-letter) word; Bob finds 1 long (6-letter) word -> Bob wins tiebreak by letters
    rmInternal.players[aliceId].foundByIndex = { 0: Date.now() - 10000 };
    const longIdx = rmDef.answers.findIndex((w) => w.length === 6);
    rmInternal.players[bobId].foundByIndex = { [longIdx]: Date.now() - 10000 };
    await runtime.twistItEngine.store.saveMatch(rmInternal);

    await runtime.twistItEngine.processExpiredMatches();
    const afterTiebreak = await jsonRequest<TwistItMatchView>(
      baseUrl,
      'GET',
      `/api/twistit/matches/${rematchId}?playerId=${encodeURIComponent(bobId)}`
    );
    assert.equal(afterTiebreak.data.status, 'finished');
    assert.equal(afterTiebreak.data.finishReason, 'timeout_letters_tiebreak');
    assert.deepEqual(afterTiebreak.data.winnerIds, [bobId]);

    // 4b. Quick Match Pairing
    const q1 = await jsonRequest(baseUrl, 'POST', '/api/twistit/matchmaking/quick/join', {
      playerId: aliceId,
    });
    assert.equal(q1.data.status, 'queued');
    const q2 = await jsonRequest(baseUrl, 'POST', '/api/twistit/matchmaking/quick/join', {
      playerId: bobId,
    });
    assert.equal(q2.data.status, 'matched');
    assert.equal(q2.data.match.mode, 'race_1v1');
    console.log('[PASS] Verified TwistIt 1v1 privacy, concurrency, timeout tiebreak, rematch, and quick match.');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

main().catch((err) => {
  console.error('TwistIt verification FAILED:', err);
  process.exit(1);
});
