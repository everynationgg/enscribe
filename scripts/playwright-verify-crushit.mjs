import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCRATCH_DIR =
  'C:\\Users\\yoggn\\.gemini\\antigravity\\brain\\8e1862f0-e66b-4a53-8fc1-2fdd6c175396\\scratch';
fs.mkdirSync(SCRATCH_DIR, { recursive: true });

const PORT = 4178;
const API_PORT = 3102;
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

    const browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu'],
    });

    try {
      const context = await browser.newContext({
        viewport: { width: 412, height: 892 },
        deviceScaleFactor: 2.625,
        hasTouch: true,
        isMobile: true,
      });
      const page = await context.newPage();
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await page.route('**/api/**', async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        const target = `${API_URL}${url.pathname}${url.search}`;
        try {
          const resp = await fetch(target, {
            method: req.method(),
            headers: { 'content-type': 'application/json' },
            body:
              req.method() === 'GET' || req.method() === 'HEAD'
                ? undefined
                : (req.postData() ?? undefined),
          });
          const body = await resp.text();
          await route.fulfill({
            status: resp.status,
            contentType: resp.headers.get('content-type') || 'application/json',
            body,
          });
        } catch {
          await route.abort();
        }
      });

      await page.goto(APP_URL, { waitUntil: 'networkidle' });

      // Guest sign-in
      await page.waitForSelector('#enscribe-nickname', { timeout: 15000 });
      await page.fill('#enscribe-nickname', `CrushV2_${Math.floor(Math.random() * 900 + 100)}`);
      await page.locator('form.ens-signin-card button[type="submit"]').click();

      // Open CrushIt -> Stage 1
      await page.getByRole('button', { name: /^CrushIt\b/ }).click();
      await page.getByRole('button', { name: /Play Stage 1/i }).click();
      await page.locator('.ci6-board-frame').waitFor({ timeout: 10000 });
      await page.waitForTimeout(300);

      // Verify NO power-up inventory toolbar exists
      assert.equal(await page.locator('.ci6-powerup-bar').count(), 0, 'Power-up inventory toolbar must be removed');
      assert.equal(await page.locator('[role="toolbar"]').count(), 0, 'No manual power-up toolbar allowed');

      // Check zero scroll and maximized board
      const metrics = await page.evaluate(() => {
        const shell = document.querySelector('.ci6-play-shell');
        const frame = document.querySelector('.ci6-board-frame');
        const rect = frame?.getBoundingClientRect();
        return {
          boardW: rect?.width ?? 0,
          boardH: rect?.height ?? 0,
          shellScrollH: shell?.scrollHeight ?? 0,
          shellClientH: shell?.clientHeight ?? 0,
        };
      });
      assert.ok(metrics.boardW >= 390, `Board should be maximized (${metrics.boardW}px)`);
      assert.ok(metrics.shellScrollH <= metrics.shellClientH + 2, 'Zero vertical scroll during gameplay');

      const dictWords = new Set(
        fs
          .readFileSync(path.resolve(process.cwd(), 'public', 'dictionaries', 'en.txt'), 'utf8')
          .split(/\r?\n/)
          .map((w) => w.trim().toUpperCase())
          .filter((w) => w.length >= 3 && w.length <= 6)
      );

      const dirs = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1],
      ];

      async function findBoardWord(preferMinLen, requirePowerUp = false) {
        const boardData = await page.evaluate(() => {
          const grid = Array.from({ length: 8 }, () => new Array(8).fill(null));
          document.querySelectorAll('.ci6-tile').forEach((el) => {
            const r = Number(el.getAttribute('data-row'));
            const c = Number(el.getAttribute('data-col'));
            grid[r][c] = {
              letter: el.getAttribute('data-letter') || '',
              powerUp: el.getAttribute('data-powerup') || '',
            };
          });
          return grid;
        });

        function searchLen(targetLen) {
          const visited = Array.from({ length: 8 }, () => new Array(8).fill(false));
          const dfs = (r, c, cur, coords, hasPu) => {
            if (cur.length === targetLen) {
              if (dictWords.has(cur) && (!requirePowerUp || hasPu)) return { word: cur, coords };
              return null;
            }
            visited[r][c] = true;
            for (const [dr, dc] of dirs) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8 || visited[nr][nc]) continue;
              const cell = boardData[nr][nc];
              const res = dfs(
                nr,
                nc,
                cur + cell.letter,
                [...coords, { row: nr, col: nc }],
                hasPu || Boolean(cell.powerUp)
              );
              if (res) return res;
            }
            visited[r][c] = false;
            return null;
          };
          for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
              const cell = boardData[r][c];
              const res = dfs(r, c, cell.letter, [{ row: r, col: c }], Boolean(cell.powerUp));
              if (res) return res;
            }
          }
          return null;
        }

        for (let len = preferMinLen; len >= 3; len--) {
          const hit = searchLen(len);
          if (hit) return hit;
        }
        return null;
      }

      async function swipeWord(coords) {
        const centers = [];
        for (const p of coords) {
          const box = await page
            .locator(`.ci6-tile[data-row="${p.row}"][data-col="${p.col}"]`)
            .boundingBox();
          assert.ok(box);
          centers.push({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
        }
        await page.mouse.move(centers[0].x, centers[0].y);
        await page.mouse.down();
        for (let i = 1; i < centers.length; i++) {
          await page.mouse.move(centers[i].x, centers[i].y, { steps: 5 });
        }
        await page.mouse.up();
        await page.waitForTimeout(120);
      }

      // 1. Swipe a 5 or 4-letter word to create an integrated power-up tile right on the board!
      const firstWord = (await findBoardWord(5)) || (await findBoardWord(4));
      assert.ok(firstWord && firstWord.word.length >= 4, 'Must find a 4+ letter word to create a power-up tile');
      await swipeWord(firstWord.coords);
      await page.screenshot({ path: path.join(SCRATCH_DIR, 'v2-01-swipe-powerup-word.png') });
      await page.getByRole('button', { name: 'Submit word' }).click();
      await page.waitForTimeout(750);

      const puTilesCount = await page.locator('.ci6-tile[data-powerup]:not([data-powerup=""])').count();
      assert.ok(puTilesCount >= 1, `Expected integrated power-up tile on board after "${firstWord.word}"`);
      await page.screenshot({ path: path.join(SCRATCH_DIR, 'v2-02-integrated-powerup-tile.png') });
      console.log(`✓ Swiped "${firstWord.word}" -> created integrated power-up tile directly on board`);

      // 2. Keep playing until QUALIFIED (objectives complete while moves remain!)
      let sawQualified = false;
      for (let turn = 0; turn < 10; turn++) {
        const lifecycle = await page.locator('.ci6-play-shell').getAttribute('data-lifecycle');
        if (lifecycle === 'QUALIFIED') {
          sawQualified = true;
          break;
        }
        const nextWord =
          (await findBoardWord(5, true)) ||
          (await findBoardWord(4, true)) ||
          (await findBoardWord(5, false)) ||
          (await findBoardWord(4, false));
        assert.ok(nextWord, 'Board must remain playable');
        await swipeWord(nextWord.coords);
        await page.getByRole('button', { name: 'Submit word' }).click();
        await page.waitForTimeout(820);
      }

      const lifecycleAfter = await page.locator('.ci6-play-shell').getAttribute('data-lifecycle');
      assert.equal(lifecycleAfter, 'QUALIFIED', 'Completing Stage 1 objectives early MUST enter QUALIFIED');
      const qualifiedBanner = await page.locator('.ci6-qualified-banner').textContent();
      assert.ok(
        qualifiedBanner?.includes('OBJECTIVES COMPLETE — NEXT STAGE QUALIFIED'),
        `Expected QUALIFIED banner, got "${qualifiedBanner}"`
      );
      assert.equal(
        await page.getByRole('dialog', { name: /Stage Complete/i }).count(),
        0,
        'Victory modal MUST NOT appear while moves remain!'
      );
      await page.screenshot({ path: path.join(SCRATCH_DIR, 'v2-03-qualified-keep-playing.png') });
      console.log('✓ Objectives completed early -> entered QUALIFIED banner with zero premature modal!');

      assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
      console.log('=== PLAYWRIGHT PIXEL 7 PRO V2 VERIFICATION PASSED ===');
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
  console.error('Playwright CrushIt V2 verification failed:', err);
  process.exit(1);
});
