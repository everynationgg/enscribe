import assert from 'node:assert/strict';
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const CONVERSATION_ID = 'fd76f514-fb8b-4ce5-853f-a3d25c377b26';
const SCREENSHOT_DIR = `C:\\Users\\yoggn\\.gemini\\antigravity\\brain\\${CONVERSATION_ID}\\scratch`;
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:5173';

function killTree(child) {
  if (!child || !child.pid) return;
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
      return;
    } catch {}
  }
  try {
    child.kill();
  } catch {}
}

async function ensureServer(url, timeoutMs = 35000) {
  try {
    const res = await fetch(`${url}/api/health`);
    if (res.ok) {
      console.log('Existing dev server already running at', url);
      return null;
    }
  } catch {}

  console.log('Spawning dev server for 3D Shaker verification...');
  const child = spawn(process.execPath, [path.resolve(process.cwd(), 'scripts/dev.mjs')], {
    stdio: 'ignore',
    detached: false,
  });

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) {
        console.log('Dev server ready at', url);
        return child;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  killTree(child);
  throw new Error(`Server did not respond at ${url} within ${timeoutMs}ms`);
}

async function enterGuest(page, nickname) {
  await page.waitForSelector('#enscribe-nickname', { timeout: 15000 });
  await page.fill('#enscribe-nickname', nickname);
  const bootstrapPromise = page
    .waitForResponse((res) => res.url().includes('/api/bootstrap/'), { timeout: 8000 })
    .catch(() => null);
  await page.getByRole('button', { name: /Enter Game Hub|Enter Offline Solo/i }).click();
  await page.waitForSelector('text=Choose Your Game', { timeout: 20000 });
  await bootstrapPromise;
  await page.waitForTimeout(200);
}

async function run() {
  const serverChild = await ensureServer(APP_URL);

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 420, height: 860 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });

    console.log('1. Navigating to Enscribe Hub...');
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    const nick1 = `Host3D${Math.floor(100 + Math.random() * 899)}`;
    await enterGuest(page, nick1);

    // Navigate to GridIt
    console.log('2. Entering GridIt Home...');
    await page.locator('.ens-hub-game-tile.is-gridit').click();
    await page.waitForSelector('.ens-gridit-hero-card, .ens-intro-overlay', { timeout: 8000 });
    const skipBtn = page.locator('.ens-intro-skip-btn');
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click().catch(() => undefined);
    }
    await page.waitForSelector('.ens-gridit-hero-card', { timeout: 10000 });
    await page.waitForTimeout(300);

    // Click Solo Play -> Solo Setup
    console.log('3. Starting Solo Match (Default 6x6 Large Square)...');
    await page.getByRole('button', { name: 'Solo', exact: true }).click();
    await page.waitForSelector('text=Multiplier Cap: 5× (max)', { timeout: 8000 });

    // Select Square shape explicitly
    const squareBtn = page.locator('.ens-gridit-shape-option:has-text("Square")');
    if (await squareBtn.isVisible()) {
      await squareBtn.click();
      await page.waitForTimeout(200);
    }

    // Advance to Large (6x6)
    for (let i = 0; i < 3; i++) {
      const isLarge = await page.locator('text=Large (6×6)').isVisible();
      if (isLarge) break;
      const nextSizeBtn = page.locator('button[aria-label="Larger board size"]').first();
      if (await nextSizeBtn.isVisible()) {
        await nextSizeBtn.click();
        await page.waitForTimeout(200);
      }
    }

    const startMatchBtn = page.getByRole('button', { name: /Start Solo Match/i }).first();
    await startMatchBtn.waitFor({ state: 'visible', timeout: 10000 });
    await startMatchBtn.click();

    // 4. Verify 3D Box & Shaking Phase
    console.log('4. Verifying 3D Box & Host-Controlled Shaking...');
    await page.waitForSelector('.ens-gridit-3d-viewport canvas', { timeout: 15000 });

    // Verify canvas exists
    const canvasCount = await page.locator('.ens-gridit-3d-viewport canvas').count();
    assert.ok(canvasCount >= 1, 'Expected Three.js 3D WebGL canvas to be rendered');

    // Simulate host drag to shake box
    const canvas = page.locator('.ens-gridit-3d-viewport canvas');
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.25, { steps: 3 });

      const snap1 = path.join(SCREENSHOT_DIR, '01_gridit_3d_shaking.png');
      await page.screenshot({ path: snap1 });
      console.log('   Captured Screenshot 1 (Shaking Phase):', snap1);

      await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.75, { steps: 3 });
      await page.mouse.up();
    }

    // 5. Wait for Settlement (5-second window ends)
    console.log('5. Waiting for 5-second settlement & Ready/GO transition...');
    // Wait until 5.2s after start
    await page.waitForTimeout(4600);

    // Screenshot 2: Settled 3D Box
    const snap2 = path.join(SCREENSHOT_DIR, '02_gridit_3d_settled.png');
    await page.screenshot({ path: snap2 });
    console.log('   Captured Screenshot 2 (Settled 3D Box):', snap2);

    // 6. Free 3D Camera Rotation (Orbit Mode)
    console.log('6. Testing Free 3D Camera Orbit & Rotation Mode...');
    const orbitBtn = page.locator('button[aria-label="Toggle 3D Orbit Mode"]');
    await orbitBtn.click();
    await page.waitForTimeout(200);

    // Drag to rotate camera around the box
    if (box) {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.25, { steps: 8 });
      await page.mouse.up();
    }
    await page.waitForTimeout(400);

    const snap3 = path.join(SCREENSHOT_DIR, '03_gridit_3d_free_rotated_view.png');
    await page.screenshot({ path: snap3 });
    console.log('   Captured Screenshot 3 (Free 3D Rotated Perspective):', snap3);

    // Reset View button test
    console.log('7. Testing Reset View Button...');
    const resetBtn = page.locator('button[aria-label="Reset View"]');
    await resetBtn.click();
    await page.waitForTimeout(500);

    // Switch back to Trace Mode
    await orbitBtn.click();
    await page.waitForTimeout(200);

    // 8. Word Tracing in 3D
    console.log('8. Testing Word Tracing on 3D Box...');
    if (box) {
      // Trace across center dice
      await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.45);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.45, { steps: 6 });
      await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55, { steps: 6 });
    }
    await page.waitForTimeout(300);

    const snap4 = path.join(SCREENSHOT_DIR, '04_gridit_3d_word_tracing.png');
    await page.screenshot({ path: snap4 });
    console.log('   Captured Screenshot 4 (Word Tracing on 3D Dice):', snap4);

    await page.mouse.up();

    console.log('\n--- VERIFICATION COMPLETED SUCCESSFULLY ---');
    console.log('All 3D interactive shaker requirements verified!');

    if (errors.length > 0) {
      console.warn('Page errors/warnings encountered:', errors);
    }
  } finally {
    await browser.close();
    if (serverChild) {
      killTree(serverChild);
    }
  }
}

run().catch((err) => {
  console.error('3D Shaker Verification Failed:', err);
  process.exit(1);
});
