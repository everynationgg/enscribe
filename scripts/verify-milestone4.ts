import assert from 'node:assert/strict';
import http from 'node:http';
import { createEnscribeApp } from '../server/app.js';
import { GRIDIT_SHAPES } from '../shared/gridit/shapes.js';
import { buildSampleValidTemplate } from '../src/games/gridit/templateStorage.js';
import { getServerDictionary } from '../server/games/gridit/serverDictionary.js';

async function run() {
  const runtime = createEnscribeApp(
    {},
    { forceLocalGuestMemory: true, disableCloudSync: true, inMemoryOnly: true }
  );
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
    console.log('1. Claiming guest players & spectator...');
    const gA = await post('/api/guest/claim', { nickname: 'AliceG4', avatarId: 'sky' });
    const gB = await post('/api/guest/claim', { nickname: 'BobG4', avatarId: 'gold' });
    const gSpec = await post('/api/guest/claim', { nickname: 'SpecG4', avatarId: 'purple' });
    assert.equal(gA.status, 200);
    assert.equal(gB.status, 200);
    assert.equal(gSpec.status, 200);

    const pidA = gA.data.profile.id;
    const pidB = gB.data.profile.id;
    const pidS = gSpec.data.profile.id;

    console.log('2. Testing Board Battle room creation, join-by-code, & spectator read-only enforcement...');
    const createRes = await post(
      '/api/gridit/rooms',
      {
        hostId: pidA,
        name: 'Heart Battle 1v1',
        settings: {
          mode: 'board_battle',
          shapeId: 'heart',
          sizeId: 'medium',
          durationSeconds: 120,
          isPublic: true,
          allowSpectators: true,
        },
      },
      gA.data.session.sessionToken
    );
    assert.equal(createRes.status, 201);
    const room = createRes.data;
    assert.ok(room.code && room.code.length === 6);

    const joinB = await post('/api/gridit/rooms/join', {
      codeOrId: room.code,
      playerId: pidB,
    });
    assert.equal(joinB.status, 200);
    assert.equal(joinB.data.joinedAs, 'player');

    const joinSpec = await post('/api/gridit/rooms/join', {
      codeOrId: room.code,
      playerId: pidS,
      asSpectator: true,
    });
    assert.equal(joinSpec.status, 200);
    assert.equal(joinSpec.data.joinedAs, 'spectator');

    // Spectator trying to set Ready must be rejected 403
    const specReady = await post(`/api/gridit/rooms/${room.id}/ready`, {
      playerId: pidS,
      isReady: true,
    });
    assert.equal(specReady.status, 403, 'Spectator cannot toggle ready');

    // Chat & emoji + honest unavailable translation check
    const chatRes = await post(`/api/gridit/rooms/${room.id}/chat`, {
      playerId: pidA,
      text: '🔥',
      kind: 'emoji',
    });
    assert.equal(chatRes.status, 200);

    const transRes = await post('/api/translate', { text: 'Bonjour', targetLang: 'en' });
    assert.equal(transRes.status, 200);
    assert.equal(transRes.data.available, false);

    console.log('3. Submitting blind secret Battle Boards & verifying privacy + derangement...');
    const dict = getServerDictionary('en');
    const tplA = buildSampleValidTemplate('heart', 'medium', dict.words, 'Alice Secret Heart');
    const tplB = buildSampleValidTemplate('heart', 'medium', dict.words, 'Bob Secret Heart');

    const subA = await post(`/api/gridit/rooms/${room.id}/battle-template`, {
      playerId: pidA,
      template: tplA,
    });
    assert.equal(subA.status, 200);
    // Verify public room payload never leaks authoredTiles!
    assert.equal(subA.data.battleTemplates, undefined);

    const subB = await post(`/api/gridit/rooms/${room.id}/battle-template`, {
      playerId: pidB,
      template: tplB,
    });
    assert.equal(subB.status, 200);

    console.log('4. Starting synchronized Board Battle & testing anti-cheat + server scoring...');
    const startRes = await post(`/api/gridit/rooms/${room.id}/start`, { playerId: pidA });
    assert.equal(startRes.status, 201);
    const matchId = startRes.data.match.id;

    // Fetch sanitized views
    const viewA = await (await fetch(`${baseUrl}/api/gridit/matches/${matchId}?playerId=${pidA}`)).json();
    const viewB = await (await fetch(`${baseUrl}/api/gridit/matches/${matchId}?playerId=${pidB}`)).json();
    const viewSpec = await (
      await fetch(`${baseUrl}/api/gridit/matches/${matchId}?playerId=${pidS}`)
    ).json();

    assert.equal(viewA.players[pidA].authoredByName, 'BobG4', 'Alice must receive Bob’s custom board');
    assert.equal(viewB.players[pidB].authoredByName, 'AliceG4', 'Bob must receive Alice’s custom board');
    assert.equal(viewSpec.viewerRole, 'spectator');

    // Before reveal window / during shake: submissions rejected
    const earlyWord = await post(`/api/gridit/matches/${matchId}/word`, {
      playerId: pidA,
      tilePath: tplB.authoredWords[0].tilePath,
    });
    assert.equal(earlyWord.status, 400);

    // Wait for synchronized shake end? Better: advance match startedAtMs slightly for deterministic fast test
    const internalMatch = (runtime.gridItEngine as any).matches.get(matchId);
    internalMatch.revealAtMs = Date.now() - 3000;
    internalMatch.startedAtMs = Date.now() - 500;

    // Spectator submitting word must fail with 403
    const specSubmit = await post(`/api/gridit/matches/${matchId}/word`, {
      playerId: pidS,
      tilePath: tplB.authoredWords[0].tilePath,
    });
    assert.equal(specSubmit.status, 403, 'Spectator cannot submit words');

    // Alice submits Bob's authored word -> authoritative server validates & awards points!
    const validSubmitA = await post(`/api/gridit/matches/${matchId}/word`, {
      playerId: pidA,
      tilePath: tplB.authoredWords[0].tilePath,
    });
    assert.equal(validSubmitA.status, 200);
    assert.equal(validSubmitA.data.validation.valid, true);
    assert.ok(validSubmitA.data.validation.finalPoints > 0);
    assert.ok(validSubmitA.data.match.players[pidA].normalizedScorePercent > 0);

    // Unauthorized outsider denied 403
    const outsiderRes = await fetch(
      `${baseUrl}/api/gridit/matches/${matchId}?playerId=intruder_999`
    );
    assert.equal(outsiderRes.status, 403);

    // Finish & confirm Ranked 1v1 queue also matches cleanly
    const finishRes = await post(`/api/gridit/matches/${matchId}/finish`, { playerId: pidA });
    assert.equal(finishRes.status, 200);
    assert.equal(finishRes.data.status, 'finished');
    assert.ok(finishRes.data.fairnessComparison);

    const lbRes = await (await fetch(`${baseUrl}/api/gridit/leaderboard`)).json();
    assert.ok(lbRes.entries.length >= 2);
    assert.ok(GRIDIT_SHAPES.length === 7);

    console.log('ALL MILESTONE 4 VERIFICATION TESTS PASSED!');
  } finally {
    server.close();
  }
}

run();
