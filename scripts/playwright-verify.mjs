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
    bodyScrollW: document.body.scrollWidth,
  }));
  assert.ok(
    dims.scrollW <= dims.innerW + 1,
    `[${label}] Horizontal overflow detected: scrollW=${dims.scrollW} > innerW=${dims.innerW}`
  );
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
    // 1. Mobile Portrait Visual Captures + Core Screens Check (390x844)
    const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page1 = await ctx1.newPage();
    const consoleErrors = [];
    page1.on('pageerror', (err) => consoleErrors.push(err.message));

    await page1.goto(APP_URL, { waitUntil: 'networkidle' });
    await page1.waitForSelector('.ens-brand-title');
    assert.equal(await page1.textContent('.ens-brand-title'), 'Enscribe');
    await checkNoOverflow(page1, 'Home 390x844');
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen1-home.png') });
    console.log('Captured screen1-home.png');

    // Screen 4: My Templates
    await page1.locator('.ens-bottom-nav').getByRole('button', { name: 'Templates', exact: true }).click();
    await page1.waitForSelector('.ens-editor-card');
    await checkNoOverflow(page1, 'Templates 390x844');
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen4-templates.png') });
    console.log('Captured screen4-templates.png');

    // Screen 2: Lobby (Join seeded Private Room 7F3K9 cleanly before mutations)
    await page1.locator('.ens-bottom-nav').getByRole('button', { name: 'Play', exact: true }).click();
    await page1.fill('input[placeholder*="7F3K9"]', '7F3K9');
    await page1.getByRole('button', { name: 'Join' }).click();
    await page1.waitForSelector('.ens-share-pill');
    await checkNoOverflow(page1, 'Lobby 390x844');
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen2-lobby.png') });
    console.log('Captured screen2-lobby.png');

    // Screen 3: Classic Match (Return Home -> Continue Match on seeded active match)
    await page1.getByLabel('Back').click();
    await page1.locator('.ens-bottom-nav').getByRole('button', { name: 'Home', exact: true }).click();
    await page1.waitForSelector('.ens-hero-btn');
    await page1.click('.ens-hero-btn');
    await page1.waitForSelector('.ens-chain-board');
    await checkNoOverflow(page1, 'Classic Match 390x844');

    // CRITICAL CHECK: Verify ALL words inside the gameplay chain are LEFT-ALIGNED!
    const alignmentReport = await page1.evaluate(() => {
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
    console.log('Gameplay word alignment:', alignmentReport);
    for (const row of alignmentReport) {
      assert.equal(row.textAlign, 'left', `Word "${row.text}" must have textAlign=left`);
      assert.ok(
        row.leftOffsetFromCard !== null && row.leftOffsetFromCard <= 24,
        `Word "${row.text}" left offset ${row.leftOffsetFromCard}px should be left-padded (~18px), not centered`
      );
    }

    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen3-match.png') });
    console.log('Captured screen3-match.png');

    // Check 320px and 430px widths too
    await page1.setViewportSize({ width: 320, height: 568 });
    await checkNoOverflow(page1, 'Classic Match 320x568');
    await page1.setViewportSize({ width: 430, height: 932 });
    await checkNoOverflow(page1, 'Classic Match 430x932');

    // Test on-screen keyboard + physical keyboard on seeded match (word 4: S T _ _ -> STOP)
    await page1.setViewportSize({ width: 390, height: 844 });
    await page1.locator('.ens-kbd .ens-key', { hasText: /^O$/ }).click();
    await page1.keyboard.press('p');
    await page1.click('.ens-submit-btn');
    await page1.waitForSelector('text=completed the chain first');
    console.log('On-screen + physical keyboard unified input & victory verified!');

    // Test Template create, save, reload persistence, duplicate
    await page1.getByLabel('Back').click();
    await page1.locator('.ens-bottom-nav').getByRole('button', { name: 'Templates', exact: true }).click();
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
    await ctx1.close();

    // 2. Two-Browser-Session Real-Time Multiplayer Acceptance Test
    const ctxHost = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const ctxGuest = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const hostPage = await ctxHost.newPage();
    const guestPage = await ctxGuest.newPage();

    // Host = Alex (default), Guest = NovaRex
    await hostPage.goto(APP_URL, { waitUntil: 'networkidle' });
    await guestPage.goto(APP_URL, { waitUntil: 'networkidle' });
    await guestPage.locator('.ens-bottom-nav').getByRole('button', { name: 'Profile', exact: true }).click();
    await guestPage.locator('button', { hasText: 'NovaRex' }).click();

    // Host creates a new 2-player room
    await hostPage.getByRole('button', { name: /Create Room/i }).click();
    await hostPage.getByRole('button', { name: /Create & Open Lobby/i }).click();
    await hostPage.waitForSelector('.ens-share-pill');
    const code = (await hostPage.textContent('.ens-share-pill'))?.trim();
    assert.ok(code && code.length >= 4, 'Created room must show share code');

    // Guest joins using code
    await guestPage.locator('.ens-bottom-nav').getByRole('button', { name: 'Play', exact: true }).click();
    await guestPage.fill('input[placeholder*="7F3K9"]', code);
    await guestPage.getByRole('button', { name: 'Join' }).click();
    await guestPage.waitForSelector('text=Players (2 / 2)');
    await hostPage.waitForSelector('text=Players (2 / 2)');

    // Exchange lobby chat messages
    await guestPage.fill('input[placeholder="Message room..."]', 'Ready when you are!');
    await guestPage.click('button[aria-label="Send chat message"]');
    await hostPage.waitForSelector('text=Ready when you are!');

    // Host prepares custom chain ALPHA -> BETA -> GAMMA -> DELTA
    await hostPage.getByRole('button', { name: /Select Template/i }).click();
    await hostPage.getByRole('button', { name: /Write Custom Chain/i }).click();
    const hostCustom = hostPage.locator('.ens-modal-card .ens-word-input-row input');
    await hostCustom.nth(0).fill('ALPHA');
    await hostCustom.nth(1).fill('BETA');
    await hostCustom.nth(2).fill('GAMMA');
    await hostCustom.nth(3).fill('DELTA');
    await hostPage.getByRole('button', { name: /Lock In Custom Chain/i }).click();

    // Guest prepares custom chain MOON -> LIGHT -> HOUSE -> BOAT
    await guestPage.getByRole('button', { name: /Select Template/i }).click();
    await guestPage.getByRole('button', { name: /Write Custom Chain/i }).click();
    const guestCustom = guestPage.locator('.ens-modal-card .ens-word-input-row input');
    await guestCustom.nth(0).fill('MOON');
    await guestCustom.nth(1).fill('LIGHT');
    await guestCustom.nth(2).fill('HOUSE');
    await guestCustom.nth(3).fill('BOAT');
    await guestPage.getByRole('button', { name: /Lock In Custom Chain/i }).click();

    await hostPage.waitForTimeout(300);
    // Host Force Starts match
    await hostPage.getByRole('button', { name: /Force Start/i }).click();
    await hostPage.waitForSelector('.ens-chain-board');
    await guestPage.waitForSelector('.ens-chain-board');

    // Verify neither player received their own authored puzzle!
    const hostAnchor = await hostPage.locator('.ens-word-card-text').first().textContent();
    const guestAnchor = await guestPage.locator('.ens-word-card-text').first().textContent();
    assert.equal(hostAnchor?.trim(), 'MOON', 'Host must receive Guest puzzle MOON');
    assert.equal(guestAnchor?.trim(), 'ALPHA', 'Guest must receive Host puzzle ALPHA');
    console.log('Multiplayer derangement verified: Host got MOON, Guest got ALPHA!');

    // Opening race: Guest solves BETA first -> Guest wins active turn!
    await guestPage.keyboard.type('eta');
    await guestPage.click('.ens-submit-btn');
    await guestPage.waitForSelector('.ens-turn-pill:has-text("Your Turn")');
    await hostPage.waitForSelector('.ens-turn-pill:has-text("NovaRex\'s Turn")');

    // Reload browser on Guest and verify match restores with exact turn & solved words!
    await guestPage.reload({ waitUntil: 'networkidle' });
    await guestPage.waitForSelector('.ens-turn-pill:has-text("Your Turn")');
    const guestSecondWord = await guestPage.locator('.ens-word-card-text').nth(1).textContent();
    assert.equal(guestSecondWord?.trim(), 'BETA', 'Solved word BETA persisted across reload');

    // Unauthorized player (PixelMochi) must be rejected from entering this ongoing match via API
    const matchId = await guestPage.evaluate(() => {
      const saved = sessionStorage.getItem('enscribe_tab_route_v1');
      return saved ? JSON.parse(saved).matchId : null;
    });
    assert.ok(matchId);
    const unauthRes = await fetch(`${APP_URL}/api/matches/${matchId}?playerId=player_pixelmochi`);
    assert.equal(unauthRes.status, 403, 'Unauthorized player must receive 403');
    console.log('Reload persistence & unauthorized rejection verified!');

    assert.equal(consoleErrors.length, 0, `Unexpected page errors: ${consoleErrors.join('; ')}`);
    // Restore clean seeded demo state for user inspection
    await fetch(`${APP_URL}/api/dev/reset-seed`, { method: 'POST' });
    console.log('ALL PLAYWRIGHT VISUAL & MULTIPLAYER ACCEPTANCE TESTS PASSED!');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
