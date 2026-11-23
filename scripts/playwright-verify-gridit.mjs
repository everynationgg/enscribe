import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const SCREENSHOT_DIR =
  'C:\\Users\\yoggn\\.gemini\\antigravity\\brain\\c5b2887b-85cd-431a-9154-99d6b6183637\\scratch';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:5173';

async function waitForServer(url, timeoutMs = 25000) {
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
  throw new Error(`Server did not respond at ${url} within ${timeoutMs}ms`);
}

async function checkNoOverflow(page, label) {
  const dims = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
  }));
  assert.ok(
    dims.scrollW <= dims.innerW + 2,
    `[${label}] Horizontal overflow detected: scrollW=${dims.scrollW} > innerW=${dims.innerW}`
  );
}

async function enterGuest(page, nickname) {
  await page.waitForSelector('#enscribe-nickname');
  await page.fill('#enscribe-nickname', nickname);
  await page.getByRole('button', { name: /Enter Game Hub|Enter Offline Solo/i }).click();
  await page.waitForSelector('text=Choose Your Game', { timeout: 15000 });
}

async function run() {
  await waitForServer(APP_URL);
  console.log('Dev + Vite server ready at', APP_URL);

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  try {
    // 1. Mobile Hub -> GridIt Home -> Solo Mods -> Physical Dice & Shake -> Board Editor -> ChainIt
    const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page1 = await ctx1.newPage();
    const errors = [];
    page1.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page1.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });

    const nick1 = `GridOne${Math.floor(100 + Math.random() * 899)}`;
    await page1.goto(APP_URL, { waitUntil: 'networkidle' });
    await enterGuest(page1, nick1);
    await checkNoOverflow(page1, 'Enscribe Hub Mobile');
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'verify-hub-mobile.png') });
    console.log('Captured verify-hub-mobile.png');

    // Open GridIt
    await page1.locator('.ens-hub-game-tile.is-gridit').click();
    await page1.waitForSelector('.ens-gridit-hero-card, .ens-intro-overlay', { timeout: 5000 });
    // If intro animation overlay appears, wait for or click Skip
    const skipBtn = page1.locator('.ens-intro-skip-btn');
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click().catch(() => undefined);
    }
    try {
      await page1.waitForSelector('.ens-gridit-hero-card', { timeout: 10000 });
    } catch (e) {
      await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug-after-open-gridit.png') });
      console.error('Debug errors so far:', errors);
      throw e;
    }
    await checkNoOverflow(page1, 'GridIt Home Mobile');
    for (const label of ['Solo', 'Ranked', 'Multiplayer', 'Leaderboard', 'Board Battle', 'Board Editor']) {
      await page1.getByRole('button', { name: label, exact: true }).waitFor();
    }
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'verify-gridit-home-mobile.png') });
    console.log('Captured verify-gridit-home-mobile.png');

    // Solo Setup + 5 Mods check
    await page1.getByRole('button', { name: 'Solo', exact: true }).click();
    await page1.waitForSelector('text=Multiplier Cap: 5× (max)');
    await page1.getByLabel('Toggle Rainbow Wildcard').click();
    await page1.getByLabel('Toggle Lightning Round').click();
    await page1.getByRole('button', { name: /Start Solo Match/i }).click();

    // Verify Shake animation then settle into Playable Physical Dice
    try {
      await page1.waitForSelector('.ens-gridit-board-viewport', { timeout: 18000 });
    } catch (e) {
      await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug-solo-timeout.png') });
      console.error('Debug solo timeout errors:', errors);
      throw e;
    }
    await page1.waitForTimeout(250);
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'verify-gridit-shake-mobile.png') });
    console.log('Captured verify-gridit-shake-mobile.png');

    // Wait for shake animation (~2.3s) to finish
    await page1.waitForSelector('.ens-gridit-tile', { timeout: 6000 });
    await page1.waitForTimeout(2400);

    const diceInfo = await page1.evaluate(() => {
      const tiles = Array.from(document.querySelectorAll('.ens-gridit-tile'));
      const rots = new Set(tiles.map((t) => t.getAttribute('data-rotation-deg')));
      const trayExists = Boolean(document.querySelector('.ens-gridit-tray-svg'));
      const zoomBadge = document.querySelector('.ens-gridit-zoom-badge')?.textContent;
      return { count: tiles.length, uniqueRots: Array.from(rots), trayExists, zoomBadge };
    });
    assert.ok(diceInfo.count >= 15, 'Dice must render on board');
    assert.ok(diceInfo.trayExists, 'Shape-matching tray SVG must render');
    assert.ok(diceInfo.uniqueRots.length >= 2, 'Dice must show varied visual rotations');
    console.log('Physical dice verified:', diceInfo);

    // Zoom in control check
    await page1.getByLabel('Zoom in').click();
    await checkNoOverflow(page1, 'GridIt Solo Play Mobile');
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'verify-gridit-play-mobile.png') });
    console.log('Captured verify-gridit-play-mobile.png');

    // Navigate back to GridIt Home -> Board Editor
    await page1.getByLabel('Back to Solo Setup').click();
    await page1.getByLabel('Back to GridIt Home').click();
    await page1.getByRole('button', { name: 'Board Editor', exact: true }).click();
    await page1.waitForSelector('text=Fill Starter Words');
    await page1.getByRole('button', { name: /Fill Starter Words/i }).click();
    await page1.waitForSelector('text=All Quotas Met ✓');
    await page1.getByRole('button', { name: /Save Template/i }).click();
    await checkNoOverflow(page1, 'GridIt Board Editor Mobile');
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'verify-gridit-editor-mobile.png') });
    console.log('Captured verify-gridit-editor-mobile.png');

    // Go to Board Battle / Host Setup & capture Mockup Screen 2 equivalent
    await page1.getByLabel('Back').click();
    await page1.getByRole('button', { name: 'Board Battle', exact: true }).click();
    await page1.waitForSelector('text=GridIt — Host Setup');
    await checkNoOverflow(page1, 'GridIt Host Setup Mobile');
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'verify-gridit-host-mobile.png') });
    console.log('Captured verify-gridit-host-mobile.png');

    // Create Board Battle room & test 2-player multiplayer flow!
    await page1.getByRole('button', { name: /Create Match/i }).click();
    await page1.waitForSelector('.ens-share-pill');
    const roomCode = (await page1.textContent('.ens-share-pill'))?.trim();
    assert.ok(roomCode && roomCode.length === 6, `Expected 6-char room code, got ${roomCode}`);

    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page2 = await ctx2.newPage();
    page2.on('pageerror', (e) => errors.push(`page2 error: ${e.message}`));
    const nick2 = `GridTwo${Math.floor(100 + Math.random() * 899)}`;
    await page2.goto(APP_URL, { waitUntil: 'networkidle' });
    await enterGuest(page2, nick2);
    await page2.locator('.ens-hub-game-tile.is-gridit').click();
    await page2.waitForSelector('.ens-gridit-hero-card, .ens-intro-overlay', { timeout: 6000 });
    const skip2 = page2.locator('.ens-intro-skip-btn');
    if (await skip2.isVisible().catch(() => false)) {
      await skip2.click().catch(() => undefined);
    }
    await page2.waitForSelector('.ens-gridit-hero-card', { timeout: 10000 });
    await page2.getByRole('button', { name: 'Multiplayer', exact: true }).click();
    await page2.fill('input[placeholder="e.g. GD8F3K"]', roomCode);
    await page2.getByRole('button', { name: 'Join', exact: true }).click();
    await page2.waitForSelector(`text=Players (2/2)`, { timeout: 8000 });

    // Both players Auto-Build & Lock Secret Board
    await page1.getByRole('button', { name: /Auto-Build & Lock Secret Board/i }).click();
    await page2.getByRole('button', { name: /Auto-Build & Lock Secret Board/i }).click();
    await page1.waitForSelector(`text=By `, { timeout: 500 }).catch(() => undefined);
    await page1.waitForTimeout(500);
    await page1.getByRole('button', { name: /Start Match/i }).click();

    await page1.waitForSelector('.ens-gridit-board-viewport', { timeout: 10000 });
    await page2.waitForSelector('.ens-gridit-board-viewport', { timeout: 10000 });
    await page1.waitForTimeout(2600);
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'verify-gridit-battle-mobile.png') });
    console.log('Captured verify-gridit-battle-mobile.png');

    // Navigate back to Hub -> Play ChainIt -> verify Solo ChainIt left alignment & new graphics!
    await page1.locator('.ens-gridit-finish-btn').click();
    await page1.waitForSelector('text=Board Battle Complete!', { timeout: 6000 });
    await page1.getByRole('button', { name: /Back to Hub/i }).click();
    await page1.waitForSelector('.ens-exit-hub-btn', { timeout: 6000 });
    await page1.locator('.ens-exit-hub-btn').first().click();
    await page1.waitForSelector('text=Choose Your Game', { timeout: 6000 });
    await page1.locator('.ens-hub-game-tile.is-chainit').click();
    const skipChain = page1.locator('.ens-intro-skip-btn');
    if (await skipChain.isVisible().catch(() => false)) {
      await skipChain.click().catch(() => undefined);
    }
    await page1.waitForSelector('text=Ready for ChainIt', { timeout: 10000 });
    await page1.getByRole('button', { name: 'Play Solo', exact: true }).click();
    await page1.waitForSelector('.ens-stage-play-circle', { timeout: 8000 });
    await page1.locator('.ens-stage-play-circle').first().click();
    await page1.waitForSelector('.ens-chain-board', { timeout: 8000 });
    await checkNoOverflow(page1, 'ChainIt Solo Mobile');
    const chainAlign = await page1.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('.ens-word-card .ens-word-card-text'));
      return spans.map((s) => getComputedStyle(s).textAlign);
    });
    assert.ok(chainAlign.length >= 3 && chainAlign.every((a) => a === 'left'), 'ChainIt words must stay left-aligned');
    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, 'verify-chainit-mobile.png') });
    console.log('Captured verify-chainit-mobile.png');

    // Cleanly release temporary guest nicknames
    await page1.getByLabel('Back', { exact: true }).click();
    await page1.getByRole('button', { name: /Exit to Game Hub/i }).or(page1.locator('.ens-exit-hub-btn')).first().click();
    await page1.waitForSelector('text=Choose Your Game');
    await page1.getByLabel('Switch guest nickname').click();
    await page2.getByRole('button', { name: /Exit/i }).or(page2.locator('.ens-gridit-finish-btn')).click().catch(() => undefined);

    // Desktop Viewport Check (1280x800)
    const ctxDesk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageDesk = await ctxDesk.newPage();
    pageDesk.on('pageerror', (e) => errors.push(`desk error: ${e.message}`));
    const nickDesk = `Desk${Math.floor(100 + Math.random() * 899)}`;
    await pageDesk.goto(APP_URL, { waitUntil: 'networkidle' });
    await enterGuest(pageDesk, nickDesk);
    await checkNoOverflow(pageDesk, 'Desktop Hub 1280x800');
    await pageDesk.screenshot({ path: path.join(SCREENSHOT_DIR, 'verify-desktop.png') });
    await pageDesk.getByLabel('Switch guest nickname').click();
    console.log('Captured verify-desktop.png');

    await ctxDesk.close();
    await ctx2.close();
    await ctx1.close();

    assert.equal(errors.length, 0, `Unexpected browser errors: ${errors.join('; ')}`);
    console.log('ALL GRIDIT PLAYWRIGHT VISUAL & INTERACTIVE CHECKS PASSED!');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
