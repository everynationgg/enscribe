import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const wordsRaw: string[] = require('an-array-of-english-words');

const outDir = path.resolve(process.cwd(), 'public', 'dictionaries');
const outFile = path.join(outDir, 'en.txt');

const filtered = new Set<string>();
for (const w of wordsRaw) {
  const clean = String(w || '').trim().toLowerCase();
  if (/^[a-z]{3,15}$/.test(clean)) {
    filtered.add(clean.toUpperCase());
  }
}

const sorted = Array.from(filtered).sort();
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, `${sorted.join('\n')}\n`, 'utf8');

const sizeKb = Math.round(fs.statSync(outFile).size / 1024);
console.log(`Generated ${outFile}: ${sorted.length.toLocaleString()} words (${sizeKb} KB)`);
