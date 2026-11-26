import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCRATCH_DIR =
  'C:\\Users\\yoggn\\.gemini\\antigravity\\brain\\8e1862f0-e66b-4a53-8fc1-2fdd6c175396\\scratch';
fs.mkdirSync(SCRATCH_DIR, { recursive: true });

const PORT = 4177;
const API_PORT = 3099;
const APP_URL = `http://127.0.0.1:${PORT}`;
const API_URL = `http://127.0.0.1:${API_PORT}`;

function startPreviewServer() {
  return spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    }
  );
}

function startBackendServer() {
  return spawn(process.execPath, ['dist-server/server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(API_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitForUrl(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server did not respond at ${url}`);
}

async function run() {
  const server = startPreviewServer();
  const apiServer = startBackendServer();
  const pageErrors = [];

  try {
    await Promise.all([waitForUrl(APP_URL), waitForUrl(`${API_URL}/api/health`)]);
    console.log(`Preview (${APP_URL}) and Backend (${API_URL}) ready`);

    // Verify backend /api/games returns exactly 6 games including CrushIt
    const gamesRes = await fetch(`${API_URL}/api/games`);
    const gamesList = await gamesRes.json();
    assert.equal(gamesList.length, 6, `Backend /api/games must return 6 games, got ${gamesList.length}`);
    assert.ok(gamesList.some((g) => g.id === 'crushit' && g.name === 'CrushIt'));
    console.log('✓ Backend /api/games returns exactly 6 games including CrushIt');

    const browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu'],
    });

    try {
      // Pixel 7 Pro FHD+ portrait viewport (412 x 892 CSS px @ 2.625x => ~1080 x 2340 physical px)
      const context = await browser.newContext({
        viewport: { width: 412, height: 892 },
        deviceScaleFactor: 2.625,
        hasTouch: true,
        isMobile: true,
      });
      const page = await context.newPage();
      page.on('pageerror', (err) => pageErrors.push(err.message));

      // Proxy /api/** requests from vite preview to the real built backend server
      await page.route('**/api/**', async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        const target = `${API_URL}${url.pathname}${url.search}`;
        try {
          const resp = await fetch(target, {
            method: req.method(),
            headers: { 'content-type': 'application/json' },
            body: req.method() === 'GET' || req.method() === 'HEAD' ? undefined : req.postData() ?? undefined,
          });
          const body = await resp.text();
          await route.fulfill({
            status: resp.status,
            contentType: resp.headers.get('content-type') || 'application/json',
            body,
          });
        } catch (err) {
          await route.abort();
        }
      });

      await page.goto(APP_URL, { waitUntil: 'networkidle' });

      // Sign in as Guest through the real UI
      await page.waitForSelector('#enscribe-nickname', { timeout: 15000 });
      await page.fill('#enscribe-nickname', `CrushPro${Math.floor(Math.random() * 900 + 100)}`);
      await page.locator('form.ens-signin-card button[type="submit"]').click();

      // 1. Verify Hub has exactly 6 game cards and CrushIt is present
      const hubCards = page.locator('button.ens-fullbleed-card.is-hub-card');
      await hubCards.first().waitFor({ timeout: 10000 });
      const cardCount = await hubCards.count();
      assert.equal(cardCount, 6, `Expected 6 hub game cards, got ${cardCount}`);

      const crushCard = page.getByRole('button', { name: /^CrushIt\b/ });
      assert.equal(await crushCard.count(), 1, 'CrushIt hub card must exist');
      await page.screenshot({ path: path.join(SCRATCH_DIR, '01-hub-6-games.png') });
      console.log('✓ Hub displays all 6 games including CrushIt');

      // 2. Enter CrushIt -> Stage Selection (Stages 1–50)
      await crushCard.click();
      await page.getByRole('button', { name: /Play Stage 1/i }).waitFor({ timeout: 10000 });
      await page.screenshot({ path: path.join(SCRATCH_DIR, '02-crushit-stages.png') });

      // Verify Full Map shows all 50 stages (Stage 1 unlocked, Stage 2 locked)
      await page.getByRole('button', { name: /Full Map/i }).click();
      const stageCards = page.locator('button.ci6-stage-card');
      assert.equal(await stageCards.count(), 50, 'Full Map must display all 50 stages');
      assert.equal(await page.locator('button.ci6-stage-card.is-locked').count(), 49);
      console.log('✓ Stage Selection displays all 50 stages (Stage 1 unlocked, 2–50 locked)');

      // 3. Launch Stage 1 -> Live Gameplay UI
      await page.getByRole('button', { name: /Play Stage 1/i }).click();
      await page.locator('.ci6-board-frame').waitFor({ timeout: 10000 });
      await page.waitForTimeout(300);

      // Verify 64 tiles (8x8), zero overflow on Pixel 7 Pro viewport, maximized board width
      const boardMetrics = await page.evaluate(() => {
        const shell = document.querySelector('.ci6-play-shell');
        const frame = document.querySelector('.ci6-board-frame');
        const tiles = Array.from(document.querySelectorAll('.ci6-tile'));
        const rect = frame?.getBoundingClientRect();
        const colorViolations = [];
        const vowels = new Set(['A', 'E', 'I', 'O', 'U']);
        const common = new Set(['R', 'S', 'T', 'N', 'L', 'D', 'H', 'C', 'M']);
        const uncommon = new Set(['B', 'F', 'G', 'K', 'P', 'V', 'W', 'Y']);
        const rare = new Set(['J', 'Q', 'X', 'Z']);
        for (const el of tiles) {
          const ch = el.getAttribute('data-letter') || '';
          const col = el.getAttribute('data-color') || '';
          const expected = vowels.has(ch)
            ? 'pink'
            : common.has(ch)
              ? 'blue'
              : uncommon.has(ch)
                ? 'green'
                : rare.has(ch)
                  ? 'gold'
                  : 'unknown';
          if (col !== expected) colorViolations.push(`${ch}:${col}!=${expected}`);
        }
        return {
          tileCount: tiles.length,
          colorViolations,
          boardW: rect?.width ?? 0,
          boardH: rect?.height ?? 0,
          shellScrollH: shell?.scrollHeight ?? 0,
          shellClientH: shell?.clientHeight ?? 0,
          docScrollW: document.documentElement.scrollWidth,
          innerW: window.innerWidth,
        };
      });

      assert.equal(boardMetrics.tileCount, 64, 'Board must have 64 tiles (8x8)');
      assert.equal(
        boardMetrics.colorViolations.length,
        0,
        `Tile color violations: ${boardMetrics.colorViolations.join(', ')}`
      );
      assert.ok(boardMetrics.boardW >= 380, `Board width should fill screen (${boardMetrics.boardW}px)`);
      assert.ok(
        Math.abs(boardMetrics.boardW - boardMetrics.boardH) <= 2,
        'Board must maintain square proportions'
      );
      assert.ok(
        boardMetrics.shellScrollH <= boardMetrics.shellClientH + 2,
        `Gameplay must fit without scrolling: scrollH=${boardMetrics.shellScrollH}, clientH=${boardMetrics.shellClientH}`
      );
      assert.ok(boardMetrics.docScrollW <= boardMetrics.innerW + 1, 'No horizontal overflow');

      // Find an actual valid 3+ letter word on the live rendered board and swipe/tap it!
      const gridLetters = await page.evaluate(() => {
        const grid = Array.from({ length: 8 }, () => new Array(8).fill(''));
        document.querySelectorAll('.ci6-tile').forEach((el) => {
          const r = Number(el.getAttribute('data-row'));
          const c = Number(el.getAttribute('data-col'));
          grid[r][c] = el.getAttribute('data-letter') || '';
        });
        return grid;
      });

      const dictWords = new Set(
        fs
          .readFileSync(path.resolve(process.cwd(), 'public', 'dictionaries', 'en.txt'), 'utf8')
          .split(/\r?\n/)
          .map((w) => w.trim().toUpperCase())
          .filter((w) => w.length >= 3 && w.length <= 6)
      );

      // Quick DFS to locate a real 4-letter (or 3-letter) word path on the live board
      let chosenPath = null;
      const dirs = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1],
      ];
      function findWord(targetLen) {
        const visited = Array.from({ length: 8 }, () => new Array(8).fill(false));
        const dfs = (r, c, cur, pathCoords) => {
          if (cur.length === targetLen) {
            if (dictWords.has(cur)) return pathCoords;
            return null;
          }
          visited[r][c] = true;
          for (const [dr, dc] of dirs) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8 || visited[nr][nc]) continue;
            const found = dfs(nr, nc, cur + gridLetters[nr][nc], [...pathCoords, { row: nr, col: nc }]);
            if (found) return found;
          }
          visited[r][c] = false;
          return null;
        };
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const res = dfs(r, c, gridLetters[r][c], [{ row: r, col: c }]);
            if (res) return res;
          }
        }
        return null;
      }

      chosenPath = findWord(4) || findWord(3);
      assert.ok(chosenPath, 'Live board must contain a valid word');
      const wordText = chosenPath.map((p) => gridLetters[p.row][p.col]).join('');

      // Swipe across the chosen path using mouse pointer events
      const centers = [];
      for (const p of chosenPath) {
        const box = await page.locator(`.ci6-tile[data-row="${p.row}"][data-col="${p.col}"]`).boundingBox();
        assert.ok(box, 'Tile box must exist');
        centers.push({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
      }
      await page.mouse.move(centers[0].x, centers[0].y);
      await page.mouse.down();
      for (let i = 1; i < centers.length; i++) {
        await page.mouse.move(centers[i].x, centers[i].y, { steps: 6 });
      }
      await page.mouse.up();
      await page.waitForTimeout(150);

      const displayedWord = await page.locator('.ci6-word-text').textContent();
      assert.equal(displayedWord?.trim(), wordText, `Live readout should display "${wordText}"`);
      assert.ok(
        (await page.locator('.ci6-status-pill.is-valid').count()) === 1,
        'Valid badge must appear'
      );
      await page.screenshot({ path: path.join(SCRATCH_DIR, '03-crushit-swipe-live.png') });

      // Confirm word and verify score increased and moves decreased
      await page.getByRole('button', { name: 'Confirm word' }).click();
      await page.waitForTimeout(750);

      const scoreAfter = await page.locator('.ci6-score-value').textContent();
      const movesAfter = await page.locator('.ci6-moves-num').textContent();
      assert.ok(Number((scoreAfter || '0').replace(/,/g, '')) > 0, 'Score must increase after valid word');
      assert.equal(Number(movesAfter), 17, 'Moves remaining must decrement from 18 to 17');
      await page.screenshot({ path: path.join(SCRATCH_DIR, '04-crushit-after-crush.png') });
      console.log(
        `✓ Live gameplay verified at Pixel 7 Pro (412×892 @2.625x): swiped "${wordText}" -> score=${scoreAfter}, moves=${movesAfter}, board=${Math.round(boardMetrics.boardW)}×${Math.round(boardMetrics.boardH)}px, zero scroll`
      );

      // 4. Verify optional Help modal opens and closes
      await page.getByRole('button', { name: 'CrushIt rules and guide' }).click();
      await page.getByRole('dialog', { name: 'How to play CrushIt' }).waitFor({ timeout: 3000 });
      await page.getByRole('button', { name: 'Got It!' }).click();
      console.log('✓ Optional Help dialog opens and closes cleanly');

      assert.equal(pageErrors.length, 0, `Page errors detected: ${pageErrors.join(' | ')}`);
      console.log('=== PLAYWRIGHT PIXEL 7 PRO VERIFICATION PASSED ===');
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
    apiServer.kill();
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('Playwright CrushIt verification failed:', err);
  process.exit(1);
});
