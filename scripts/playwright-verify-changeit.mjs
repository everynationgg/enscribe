import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const SCREENSHOT_DIR =
  'C:\\Users\\yoggn\\.gemini\\antigravity\\brain\\3aaa6cc0-b5ca-421f-8a79-6758d83178ee\\scratch';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:5173';

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server did not respond at ${url}/api/health within ${timeoutMs}ms`);
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

async function signInGuest(page, nickname) {
  await page.waitForSelector('#enscribe-nickname', { timeout: 15000 });
  await page.fill('#enscribe-nickname', nickname);
  await page.locator('form.ens-signin-card button[type="submit"]').click();
}

async function transformStep(page, slotIndexZeroBased, expectedCurrentChar, targetChar) {
  await page.getByRole('button', { name: new RegExp(`Letter ${slotIndexZeroBased + 1}: ${expectedCurrentChar}`) }).click();
  await page.getByRole('button', { name: `Letter ${targetChar}`, exact: true }).click();
  await page.getByRole('button', { name: 'Submit transformation', exact: true }).click();
}

async function run() {
  await waitForServer(APP_URL);
  console.log('Dev server ready at', APP_URL);

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const pageErrors = [];

  const tag = Date.now().toString().slice(-4);
  const nick1 = `LOne${tag}`;
  const nick2 = `LTwo${tag}`;

  try {
    // 1. Mobile Session (LadderOne) - 390x844
    const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page1 = await ctx1.newPage();
    page1.on('pageerror', (err) => pageErrors.push(`[page1] ${err.message}`));

    await page1.goto(APP_URL, { waitUntil: 'networkidle' });
    await signInGuest(page1, nick1);

    // Verify Enscribe Hub has all 5 playable game cards (ChainIt, GridIt, GuessIt, TwistIt, ChangeIt)
    await page1.waitForSelector('.ens-hub-grid2x2', { timeout: 15000 });
    for (const gameName of ['ChainIt', 'GridIt', 'GuessIt', 'TwistIt', 'ChangeIt']) {
      await page1.getByRole('button', { name: new RegExp(`^${gameName}\\b`, 'i') }).waitFor({ timeout: 8000 });
    }
    await checkNoOverflow(page1, 'Hub 390x844');
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'ci-hub-mobile.png'), fullPage: true });
    console.log('[PASS] Verified Enscribe 5-game Hub at 390x844.');

    // Enter ChangeIt
    await page1.getByRole('button', { name: /^ChangeIt\b/i }).click();
    await page1.getByRole('button', { name: /Ranked/i }).waitFor({ timeout: 8000 });
    await page1.getByRole('button', { name: /Solo Adventure/i }).waitFor();
    await page1.getByRole('button', { name: /Rooms/i }).waitFor();
    await page1.getByRole('button', { name: /Leaderboard/i }).waitFor();
    const quickMatchCount = await page1.getByRole('button', { name: /Quick Match/i }).count();
    assert.equal(quickMatchCount, 0, 'ChangeIt must NOT render a Quick Match button');
    await checkNoOverflow(page1, 'ChangeIt Home 390x844');
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'ci-home-mobile.png') });
    console.log('[PASS] Verified ChangeIt Landing screen (no Quick Match).');

    // Solo Adventure Level 1-1: CAT -> COT -> DOT -> DOG
    await page1.getByRole('button', { name: /Solo Adventure/i }).click();
    await page1.waitForSelector('text=First Steps');
    await checkNoOverflow(page1, 'ChangeIt Adventure Map 390x844');
    await page1.getByRole('button', { name: 'Play', exact: true }).first().click();

    await page1.waitForSelector('text=1-1: Pet Pals');
    await checkNoOverflow(page1, 'ChangeIt Gameplay 390x844');
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'ci-gameplay-mobile.png') });

    // Submit COT, DOT, DOG
    await transformStep(page1, 1, 'A', 'O');
    await page1.waitForSelector('text=Moves: 1', { timeout: 8000 });
    await transformStep(page1, 0, 'C', 'D');
    await page1.waitForSelector('text=Moves: 2', { timeout: 8000 });
    await transformStep(page1, 2, 'T', 'G');

    await page1.waitForSelector('text=Transformation Complete!', { timeout: 8000 });
    await page1.waitForSelector('text=Enscribe Coins Earned!', { timeout: 8000 });
    await checkNoOverflow(page1, 'ChangeIt Victory Modal 390x844');
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'ci-adventure-victory.png') });
    console.log('[PASS] Verified Solo Adventure 1-1 gameplay & coin victory modal.');

    // Exit back to Adventure Map -> verify 1-2 is unlocked -> back to Home
    await page1.getByRole('button', { name: /Back to Chapters/i }).click();
    await page1.waitForSelector('text=1-2');
    const playButtonsCount = await page1.getByRole('button', { name: 'Play', exact: true }).count();
    assert.ok(playButtonsCount >= 1, 'Stage 1-2 Play button must now be unlocked');
    await page1.getByRole('button', { name: 'Back to ChangeIt' }).click();
    await page1.getByRole('button', { name: /Rooms/i }).click();

    // Create Room with custom puzzle COLD -> WARM
    await page1.getByRole('button', { name: /Create Custom or Public Room/i }).click();
    await page1.getByRole('button', { name: /Create & Enter Lobby/i }).click();
    await page1.waitForSelector('text=ROOM INVITE CODE', { timeout: 8000 });
    const roomCode = (
      await page1.locator('text=ROOM INVITE CODE').locator('xpath=following-sibling::div[1]').textContent()
    )?.trim();
    assert.ok(roomCode && roomCode.length >= 5, `Unexpected room code: ${roomCode}`);

    await page1.fill('input[placeholder="Start (e.g. COLD)"]', 'COLD');
    await page1.fill('input[placeholder="Target (e.g. WARM)"]', 'WARM');
    await page1.getByRole('button', { name: 'Validate Puzzle', exact: true }).click();
    await page1.getByRole('button', { name: /Use Custom \(4 min moves\)/i }).click();
    await page1.waitForSelector('text=Clear (COLD→WARM)');
    await checkNoOverflow(page1, 'ChangeIt Lobby 390x844');
    console.log(`[PASS] Created room ${roomCode} with verified custom puzzle COLD -> WARM.`);

    // 2. Desktop Session (LadderTwo) - 1280x800 joins via deep-link URL
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page2 = await ctx2.newPage();
    page2.on('pageerror', (err) => pageErrors.push(`[page2] ${err.message}`));

    await page2.goto(`${APP_URL}/?game=changeit&code=${encodeURIComponent(roomCode)}`, {
      waitUntil: 'networkidle',
    });
    await signInGuest(page2, nick2);
    await page2.waitForSelector('text=ROOM INVITE CODE', { timeout: 15000 });
    await page2.waitForSelector(`text=${nick1}`, { timeout: 10000 });
    await checkNoOverflow(page2, 'ChangeIt Invite Lobby 1280x800');

    // LadderTwo readies up; LadderOne starts match
    await page2.getByRole('button', { name: /Ready Up!/i }).click();
    await page1.getByRole('button', { name: /Start ChangeIt Match/i }).waitFor({ timeout: 8000 });
    await page1.getByRole('button', { name: /Start ChangeIt Match/i }).click();

    // Both enter live gameplay!
    await page1.waitForSelector('text=Target Word', { timeout: 10000 });
    await page2.waitForSelector('text=Target Word', { timeout: 10000 });
    await checkNoOverflow(page2, 'ChangeIt Gameplay 1280x800');

    // LadderOne submits CORD; LadderTwo sees move count = 1, NEVER 'CORD'
    await transformStep(page1, 2, 'L', 'R');
    await page1.waitForSelector('text=Moves: 1', { timeout: 8000 });
    await page2.waitForSelector('text=1 moves', { timeout: 8000 });
    const oppBodyText = await page2.textContent('body');
    assert.ok(!oppBodyText?.includes('CORD'), 'Opponent intermediate word leaked in live UI!');

    // Finish COLD -> CORD -> CARD -> WARD -> WARM in page1
    await transformStep(page1, 1, 'O', 'A');
    await page1.waitForSelector('text=Moves: 2', { timeout: 8000 });
    await transformStep(page1, 0, 'C', 'W');
    await page1.waitForSelector('text=Moves: 3', { timeout: 8000 });
    await transformStep(page1, 3, 'D', 'M');

    await page1.waitForSelector('text=Victory!', { timeout: 10000 });
    await page2.waitForSelector('text=Match Complete', { timeout: 10000 });
    await checkNoOverflow(page2, 'ChangeIt Post-Match 1280x800');
    await page2.screenshot({ path: path.join(SCREENSHOT_DIR, 'ci-postmatch-desktop.png') });
    console.log('[PASS] Verified live 2-browser Sprint match, Socket sync, privacy, and post-match summary.');

    assert.equal(pageErrors.length, 0, `Uncaught page errors: ${pageErrors.join(' | ')}`);
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Playwright ChangeIt verification FAILED:', err);
  process.exit(1);
});
