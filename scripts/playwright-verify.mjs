import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const SCREENSHOT_DIR =
  'C:\\Users\\yoggn\\.gemini\\antigravity\\brain\\2f027c71-1c2c-4b38-8d0f-d975fd8c8747\\scratch';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:5173';

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch {
      try {
        const res2 = await fetch(`http://127.0.0.1:5173/api/health`);
        if (res2.ok) return;
      } catch {
        // retry
      }
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  throw new Error(`Server did not respond at ${url} within ${timeoutMs}ms`);
}

async function checkNoOverflow(page, label) {
  const dims = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
  }));
  assert.ok(
    dims.scrollW <= dims.innerW + 1,
    `[${label}] Horizontal overflow detected: scrollW=${dims.scrollW} > innerW=${dims.innerW}`
  );
}

async function signInPlayer(page, nickname, avatarLabel) {
  await page.waitForSelector('#enscribe-nickname');
  if (avatarLabel) {
    await page.getByLabel(`Select ${avatarLabel} avatar`).click();
  }
  await page.fill('#enscribe-nickname', nickname);
  await page.getByRole('button', { name: /Enter Enscribe/i }).click();
  await page.waitForSelector(`text=Hi, ${nickname}!`);
}

async function run() {
  await waitForServer(APP_URL);
  console.log('Dev server ready at', APP_URL);
  const resetRes = await fetch(`${APP_URL}/api/dev/reset-seed`, { method: 'POST' });
  if (!resetRes.ok) {
    throw new Error(`reset-seed failed with ${resetRes.status}: ${await resetRes.text()}`);
  }

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  try {
    // 1. Mobile Sign-In, Home, Templates, Solo Gameplay checks (390x844)
    const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page1 = await ctx1.newPage();
    const consoleErrors = [];
    page1.on('pageerror', (err) => consoleErrors.push(err.message));

    await page1.goto(APP_URL, { waitUntil: 'networkidle' });
    await page1.waitForSelector('#enscribe-nickname');
    await checkNoOverflow(page1, 'SignIn 390x844');
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen0-signin.png') });
    console.log('Captured screen0-signin.png');

    await signInPlayer(page1, 'SkyWalker', 'Blue');
    assert.equal(await page1.textContent('.ens-brand-title'), 'Enscribe');
    await checkNoOverflow(page1, 'Home 390x844');
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen1-home.png') });
    console.log('Captured screen1-home.png');

    // Templates create/save/reload/duplicate
    await page1.locator('.ens-bottom-nav').getByRole('button', { name: 'Templates', exact: true }).click();
    await page1.waitForSelector('.ens-editor-card');
    await checkNoOverflow(page1, 'Templates 390x844');
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen4-templates.png') });

    await page1.getByLabel('Create new template').click();
    await page1.locator('.ens-editor-card input[placeholder="Template name"]').fill('Playwright Chain');
    const wordInputs = page1.locator('.ens-editor-card .ens-word-input-row input');
    await wordInputs.nth(0).fill('SUN');
    await wordInputs.nth(1).fill('FLOWER');
    await wordInputs.nth(2).fill('POT');
    await wordInputs.nth(3).fill('LUCK');
    await page1.locator('.ens-btn-green', { hasText: 'Save' }).click();
    await page1.waitForSelector('text=Playwright Chain');
    await page1.reload({ waitUntil: 'networkidle' });
    await page1.locator('.ens-bottom-nav').getByRole('button', { name: 'Templates', exact: true }).click();
    await page1.waitForSelector('text=Playwright Chain');
    await page1.getByRole('button', { name: /Duplicate/i }).click();
    await page1.waitForSelector('text=Playwright Chain Copy');
    console.log('Template create/save/reload/duplicate verified!');

    // Profile tab shows real Player ID and Sign Out works
    await page1.locator('.ens-bottom-nav').getByRole('button', { name: 'Profile', exact: true }).click();
    await page1.waitForSelector('text=Player ID:');
    await checkNoOverflow(page1, 'Profile 390x844');
    await page1.getByRole('button', { name: /Sign Out/i }).click();
    await page1.waitForSelector('#enscribe-nickname');
    console.log('Profile & Sign Out verified!');
    await ctx1.close();

    // 2. Real Two-Player Nickname Sign-In + Live Multiplayer Test
    const ctxHost = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const ctxGuest = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const hostPage = await ctxHost.newPage();
    const guestPage = await ctxGuest.newPage();

    await hostPage.goto(APP_URL, { waitUntil: 'networkidle' });
    await guestPage.goto(APP_URL, { waitUntil: 'networkidle' });

    await signInPlayer(hostPage, 'HostAce', 'Blue');
    await signInPlayer(guestPage, 'GuestNova', 'Neon');

    // Host creates a 2-player room
    await hostPage.getByRole('button', { name: /Create Room/i }).click();
    await hostPage.getByRole('button', { name: /Create & Open Lobby/i }).click();
    await hostPage.waitForSelector('.ens-share-pill');
    const code = (await hostPage.textContent('.ens-share-pill'))?.trim();
    assert.ok(code && code.length >= 4, 'Created room must show share code');

    // Guest joins using Share Code
    await guestPage.locator('.ens-bottom-nav').getByRole('button', { name: 'Play', exact: true }).click();
    await guestPage.fill('input[placeholder="Enter room code"]', code);
    await guestPage.getByRole('button', { name: 'Join' }).click();
    await guestPage.waitForSelector('text=Players (2 / 2)');
    await hostPage.waitForSelector('text=Players (2 / 2)');
    await checkNoOverflow(hostPage, 'Lobby 390x844');
    await hostPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen2-lobby.png') });

    // Exchange lobby chat messages
    await guestPage.fill('input[placeholder="Message room..."]', 'Ready when you are!');
    await guestPage.click('button[aria-label="Send chat message"]');
    await hostPage.waitForSelector('text=Ready when you are!');

    // Host prepares ALPHA -> BETA -> GAMMA -> DELTA
    await hostPage.getByRole('button', { name: /Select Template/i }).click();
    await hostPage.getByRole('button', { name: /Write Custom Chain/i }).click();
    const hostCustom = hostPage.locator('.ens-modal-card .ens-word-input-row input');
    await hostCustom.nth(0).fill('ALPHA');
    await hostCustom.nth(1).fill('BETA');
    await hostCustom.nth(2).fill('GAMMA');
    await hostCustom.nth(3).fill('DELTA');
    await hostPage.getByRole('button', { name: /Lock In Custom Chain/i }).click();

    // Guest prepares MOON -> LIGHT -> HOUSE -> BOAT
    await guestPage.getByRole('button', { name: /Select Template/i }).click();
    await guestPage.getByRole('button', { name: /Write Custom Chain/i }).click();
    const guestCustom = guestPage.locator('.ens-modal-card .ens-word-input-row input');
    await guestCustom.nth(0).fill('MOON');
    await guestCustom.nth(1).fill('LIGHT');
    await guestCustom.nth(2).fill('HOUSE');
    await guestCustom.nth(3).fill('BOAT');
    await guestPage.getByRole('button', { name: /Lock In Custom Chain/i }).click();

    await hostPage.waitForTimeout(400);
    await hostPage.getByRole('button', { name: /Force Start/i }).click();
    await hostPage.waitForSelector('.ens-chain-board');
    await guestPage.waitForSelector('.ens-chain-board');

    // Verify neither player received their own authored puzzle!
    const hostAnchor = await hostPage.locator('.ens-word-card-text').first().textContent();
    const guestAnchor = await guestPage.locator('.ens-word-card-text').first().textContent();
    assert.equal(hostAnchor?.trim(), 'MOON', 'Host must receive Guest puzzle MOON');
    assert.equal(guestAnchor?.trim(), 'ALPHA', 'Guest must receive Host puzzle ALPHA');
    console.log('Multiplayer derangement verified: Host got MOON, Guest got ALPHA!');

    // Verify ALL gameplay words are LEFT-ALIGNED and capture Classic Match screenshot
    const alignmentReport = await guestPage.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.ens-word-card'));
      return cards.map((card) => {
        const span = card.querySelector('.ens-word-card-text');
        const csSpan = span ? getComputedStyle(span) : null;
        const rectCard = card.getBoundingClientRect();
        const rectSpan = span ? span.getBoundingClientRect() : null;
        return {
          text: span?.textContent?.trim(),
          textAlign: csSpan?.textAlign,
          leftOffsetFromCard: rectSpan ? Math.round(rectSpan.left - rectCard.left) : null,
        };
      });
    });
    for (const row of alignmentReport) {
      assert.equal(row.textAlign, 'left', `Word "${row.text}" must have textAlign=left`);
      assert.ok(row.leftOffsetFromCard !== null && row.leftOffsetFromCard <= 24);
    }

    // Opening race: Guest solves BETA using unified on-screen + physical keyboard!
    await guestPage.locator('.ens-kbd .ens-key', { hasText: /^E$/ }).click();
    await guestPage.keyboard.type('ta');
    await guestPage.click('.ens-submit-btn');
    await guestPage.waitForSelector('.ens-turn-pill:has-text("Your Turn")');
    await hostPage.waitForSelector('.ens-turn-pill:has-text("GuestNova\'s Turn")');
    await guestPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen3-match.png') });
    console.log('Captured screen3-match.png');

    // Reload persistence & unauthorized player check
    await guestPage.reload({ waitUntil: 'networkidle' });
    await guestPage.waitForSelector('.ens-turn-pill:has-text("Your Turn")');
    const guestSecondWord = await guestPage.locator('.ens-word-card-text').nth(1).textContent();
    assert.equal(guestSecondWord?.trim(), 'BETA');

    const matchId = await guestPage.evaluate(() => {
      const saved = sessionStorage.getItem('enscribe_tab_route_v1');
      return saved ? JSON.parse(saved).matchId : null;
    });
    assert.ok(matchId);
    const unauthRes = await fetch(`${APP_URL}/api/matches/${matchId}?playerId=player_intruder`);
    assert.equal(unauthRes.status, 403);
    console.log('Reload persistence & unauthorized rejection verified!');

    assert.equal(consoleErrors.length, 0, `Unexpected page errors: ${consoleErrors.join('; ')}`);

    // Leave Supabase clean with zero fake test players/rooms!
    await fetch(`${APP_URL}/api/dev/reset-seed`, { method: 'POST' });
    console.log('ALL SIGN-IN, VISUAL & MULTIPLAYER ACCEPTANCE TESTS PASSED!');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
