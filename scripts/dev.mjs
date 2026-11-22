import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const tsxCli = path.join(rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const viteCli = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');

function freePortOnWindows(port) {
  if (process.platform !== 'win32') return;
  try {
    const out = execSync('netstat -ano -p tcp', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5) continue;
      const localAddr = parts[1];
      const pid = Number(parts[parts.length - 1]);
      if (
        localAddr.endsWith(`:${port}`) &&
        Number.isInteger(pid) &&
        pid > 0 &&
        pid !== process.pid
      ) {
        pids.add(pid);
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
        console.log(`Freed stale process (PID ${pid}) on port ${port}`);
      } catch {
        // already exited or requires elevation
      }
    }
  } catch {
    // ignore if netstat fails
  }
}

freePortOnWindows(3001);
freePortOnWindows(5173);

function runNodeScript(name, scriptPath, args) {
  const child = spawn(process.execPath, [scriptPath, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  child.stdout?.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr?.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });
  return child;
}

console.log('Starting Enscribe backend (3001) and Vite frontend (5173)...');
const server = runNodeScript('server', tsxCli, ['watch', 'server/index.ts']);
const client = runNodeScript('client', viteCli, ['--port', '5173', '--clearScreen', 'false']);

function killChildTree(child) {
  if (!child || !child.pid) return;
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
      return;
    } catch {
      // fall through
    }
  }
  try {
    child.kill();
  } catch {
    // ignore
  }
}

function shutdown() {
  killChildTree(server);
  killChildTree(client);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => {
  killChildTree(server);
  killChildTree(client);
});
