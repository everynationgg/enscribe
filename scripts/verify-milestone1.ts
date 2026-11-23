import assert from 'node:assert/strict';
import http from 'node:http';
import { createEnscribeApp } from '../server/app.js';
import {
  GuestNicknameConflictError,
  GuestSessionStore,
} from '../server/platform/GuestSessionStore.js';

async function run() {
  console.log('1. Testing GuestSessionStore uniqueness, concurrency race, rename, TTL expiry & release...');
  const store = new GuestSessionStore({ forceLocalMemory: true, isServerless: false });

  const s1 = await store.claimNickname('NovaGuest', 'alex');
  assert.ok(s1.sessionId.startsWith('guest_'), 'Guest sessionId should start with guest_');
  assert.ok(s1.sessionToken.startsWith('gtok_'), 'Guest sessionToken should start with gtok_');
  assert.equal(s1.nickname, 'NovaGuest');

  // Case-insensitive duplicate claim must be rejected
  await assert.rejects(
    () => store.claimNickname('novaguest', 'spark'),
    (err: any) => err instanceof GuestNicknameConflictError && err.statusCode === 409
  );

  // Concurrent race of 8 simultaneous claims for the exact same nickname
  const raceResults = await Promise.allSettled(
    Array.from({ length: 8 }, (_, idx) => store.claimNickname('RaceWinner', `avatar_${idx}`))
  );
  const winners = raceResults.filter((r) => r.status === 'fulfilled');
  const conflicts = raceResults.filter(
    (r) => r.status === 'rejected' && r.reason instanceof GuestNicknameConflictError
  );
  assert.equal(winners.length, 1, 'Exactly one concurrent claim must win the nickname');
  assert.equal(conflicts.length, 7, 'All other 7 concurrent claims must get 409 conflict');

  // Same token refresh / rename succeeds and frees old nickname
  const renamed = await store.claimNickname('NovaRenamed', 'knight', s1.sessionToken);
  assert.equal(renamed.sessionId, s1.sessionId);
  assert.equal(renamed.nickname, 'NovaRenamed');

  const reusedOld = await store.claimNickname('NovaGuest', 'leafy');
  assert.equal(reusedOld.nickname, 'NovaGuest');

  // Release immediately frees nickname
  await store.releaseSession(reusedOld.sessionToken);
  const reclaimedAfterRelease = await store.claimNickname('NovaGuest', 'pixelmochi');
  assert.notEqual(reclaimedAfterRelease.sessionId, reusedOld.sessionId);

  // Short TTL expiration makes inactive nickname available again
  const shortLived = await store.claimNickname('ExpiringHero', 'alex', null, 1);
  assert.ok(shortLived.expiresAtMs > Date.now());
  await new Promise((r) => setTimeout(r, 1150));
  const afterExpiry = await store.claimNickname('expiringhero', 'spark');
  assert.notEqual(afterExpiry.sessionId, shortLived.sessionId);

  console.log('2. Testing HTTP API: Game Registry, Guest Isolation from Legacy Profiles, and ChainIt Solo...');
  const runtime = createEnscribeApp({}, {
    forceLocalGuestMemory: true,
    disableCloudSync: true,
    inMemoryOnly: true,
  });
  // Seed a legacy profile to verify guest entry NEVER exposes or mutates legacy accounts
  runtime.repo.upsertProfile({
    id: 'player_alex_legacy',
    username: 'Alex',
    avatarId: 'alex',
    rankTier: 'Gold I',
    rankPoints: 1400,
    wins: 12,
    losses: 4,
    matchPointsBalance: 250,
    equippedCosmetics: {
      tileSkin: 'classic_cream',
      boardSkin: 'royal_cosmos',
      backgroundTheme: 'deep_blue',
      chatBubbleStyle: 'frost_pill',
    },
    createdAt: Date.now() - 500000,
  });

  const server = http.createServer(runtime.app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const gamesRes = await fetch(`${baseUrl}/api/games`);
    assert.equal(gamesRes.status, 200);
    const games = (await gamesRes.json()) as Array<{ id: string; name: string }>;
    assert.ok(games.some((g) => g.id === 'chain_clash' && g.name === 'ChainIt'), 'ChainIt must be registered');
    assert.ok(games.some((g) => g.id === 'gridit' && g.name === 'GridIt'), 'GridIt must be registered');

    // Claiming "Alex" as a guest must create an ephemeral guest_ session and NOT log into legacy player_alex_legacy
    const claimRes = await fetch(`${baseUrl}/api/guest/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Alex', avatarId: 'novarex' }),
    });
    assert.equal(claimRes.status, 200);
    const claimBody = (await claimRes.json()) as any;
    assert.ok(claimBody.session.sessionId.startsWith('guest_'));
    assert.notEqual(claimBody.session.sessionId, 'player_alex_legacy');
    assert.equal(claimBody.profile.isGuest, true);

    // Second concurrent/online user claiming "alex" must fail with 409
    const dupRes = await fetch(`${baseUrl}/api/guest/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'alex', avatarId: 'leafy' }),
    });
    assert.equal(dupRes.status, 409);

    const token = claimBody.session.sessionToken as string;
    const guestId = claimBody.session.sessionId as string;

    // Guest bootstrap works cleanly
    const bootRes = await fetch(`${baseUrl}/api/bootstrap/${guestId}`, {
      headers: { 'x-guest-session-token': token },
    });
    assert.equal(bootRes.status, 200);
    const bootData = (await bootRes.json()) as any;
    assert.equal(bootData.profile.id, guestId);
    assert.equal(bootData.profile.isGuest, true);

    // Guest cannot write guest templates into shared persistent template store
    const tplRejectRes = await fetch(`${baseUrl}/api/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-guest-session-token': token },
      body: JSON.stringify({
        ownerId: guestId,
        name: 'Guest Chain',
        theme: 'Custom',
        thumbnailKey: 'custom',
        words: ['SUN', 'FLOWER', 'POT'],
        status: 'saved',
      }),
    });
    assert.equal(tplRejectRes.status, 403);

    // Guest can play & complete ChainIt Solo without creating permanent progression records
    const soloStartRes = await fetch(`${baseUrl}/api/solo/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-guest-session-token': token },
      body: JSON.stringify({ playerId: guestId, stageId: 'solo_fantasy_1' }),
    });
    assert.equal(soloStartRes.status, 201);
    const soloStart = (await soloStartRes.json()) as any;
    const matchId = soloStart.match.id as string;

    for (const word of ['FIRE', 'STORM', 'CLOUD', 'CASTLE']) {
      const gRes = await fetch(`${baseUrl}/api/matches/${matchId}/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-guest-session-token': token },
        body: JSON.stringify({ playerId: guestId, guess: word, soloStageId: 'solo_fantasy_1' }),
      });
      assert.equal(gRes.status, 200);
    }

    // Verify permanent snapshot & profiles never store guest progression or overwrite legacy Alex
    const snap = runtime.repo.toSnapshot();
    assert.equal(Object.keys(snap.profiles).some((id) => id.startsWith('guest_')), false);
    assert.equal(runtime.repo.listProfiles().some((p) => p.id.startsWith('guest_')), false);
    assert.equal(snap.profiles['player_alex_legacy']?.rankPoints, 1400);
    assert.equal(Object.keys(snap.soloProgress).some((id) => id.startsWith('guest_')), false);
    assert.equal(snap.pointsEvents.some((e) => e.playerId.startsWith('guest_')), false);

    // Guest rename and release
    const renameRes = await fetch(`${baseUrl}/api/guest/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: token, nickname: 'AlexTwo', avatarId: 'spark' }),
    });
    assert.equal(renameRes.status, 200);
    const renameBody = (await renameRes.json()) as any;
    assert.equal(renameBody.session.nickname, 'AlexTwo');

    const releaseRes = await fetch(`${baseUrl}/api/guest/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: token }),
    });
    assert.equal(releaseRes.status, 200);

    // Nickname AlexTwo is now free again
    const reclaimRes = await fetch(`${baseUrl}/api/guest/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'AlexTwo', avatarId: 'alex' }),
    });
    assert.equal(reclaimRes.status, 200);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('ALL MILESTONE 1 VERIFICATION TESTS PASSED!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
