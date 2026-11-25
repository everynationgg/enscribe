import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { EXCLUDED_WORDS, OBSCURE_PUZZLE_EXCLUSIONS } from '../shared/changeit/excludedWords.js';

const require = createRequire(import.meta.url);
const npmWordsRaw: string[] = require('an-array-of-english-words');

const ENABLE1_URL = 'https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt';
const POPULAR_URL = 'https://raw.githubusercontent.com/dolph/dictionary/master/popular.txt';
const GOOGLE_10K_URL =
  'https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-usa-no-swears.txt';

function parseWordList(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const clean = raw.trim().toUpperCase();
    if (/^[A-Z]{3,6}$/.test(clean) && /[AEIOUY]/.test(clean)) {
      out.add(clean);
    }
  }
  return out;
}

async function main() {
  console.log('Fetching ENABLE1 (Public Domain) and common English frequency lists...');
  const [enableRes, popularRes, g10kRes] = await Promise.all([
    fetch(ENABLE1_URL, { signal: AbortSignal.timeout(15000) }),
    fetch(POPULAR_URL, { signal: AbortSignal.timeout(15000) }),
    fetch(GOOGLE_10K_URL, { signal: AbortSignal.timeout(15000) }),
  ]);

  if (!enableRes.ok || !popularRes.ok || !g10kRes.ok) {
    throw new Error(
      `Failed fetching word lists: enable=${enableRes.status}, popular=${popularRes.status}, g10k=${g10kRes.status}`
    );
  }

  const enableSet = parseWordList(await enableRes.text());
  const popularSet = parseWordList(await popularRes.text());
  const g10kSet = parseWordList(await g10kRes.text());

  const npmSet = new Set<string>();
  for (const raw of npmWordsRaw) {
    const clean = String(raw || '').trim().toUpperCase();
    if (/^[A-Z]{3,6}$/.test(clean) && /[AEIOUY]/.test(clean)) {
      npmSet.add(clean);
    }
  }

  const puzzleByLength: Record<'3' | '4' | '5' | '6', string[]> = {
    '3': [],
    '4': [],
    '5': [],
    '6': [],
  };
  const validationExtraByLength: Record<'3' | '4' | '5' | '6', string[]> = {
    '3': [],
    '4': [],
    '5': [],
    '6': [],
  };

  let excludedCount = 0;
  for (const word of Array.from(enableSet).sort()) {
    if (EXCLUDED_WORDS.has(word)) {
      excludedCount++;
      continue;
    }
    const lenKey = String(word.length) as '3' | '4' | '5' | '6';
    const isFamiliar =
      (popularSet.has(word) || g10kSet.has(word)) &&
      !OBSCURE_PUZZLE_EXCLUSIONS.has(word) &&
      npmSet.has(word);

    if (isFamiliar) {
      puzzleByLength[lenKey].push(word);
    } else {
      validationExtraByLength[lenKey].push(word);
    }
  }

  const totalPuzzle =
    puzzleByLength['3'].length +
    puzzleByLength['4'].length +
    puzzleByLength['5'].length +
    puzzleByLength['6'].length;
  const totalValidation =
    totalPuzzle +
    validationExtraByLength['3'].length +
    validationExtraByLength['4'].length +
    validationExtraByLength['5'].length +
    validationExtraByLength['6'].length;

  const payload = {
    version: '1.0.0',
    source: {
      validation: 'ENABLE1 (Enhanced North American Benchmark LExicon, Public Domain)',
      familiarity:
        'dolph/dictionary popular.txt (ENABLE1 x Wiktionary frequency, Public Domain) + google-10000-english-usa-no-swears (MIT) + an-array-of-english-words (MIT)',
      license: 'Public Domain (ENABLE1) & MIT',
    },
    stats: {
      totalPuzzleWords: totalPuzzle,
      totalValidationWords: totalValidation,
      excludedMatchedCount: excludedCount,
      byLength: {
        '3': {
          puzzle: puzzleByLength['3'].length,
          validation: puzzleByLength['3'].length + validationExtraByLength['3'].length,
        },
        '4': {
          puzzle: puzzleByLength['4'].length,
          validation: puzzleByLength['4'].length + validationExtraByLength['4'].length,
        },
        '5': {
          puzzle: puzzleByLength['5'].length,
          validation: puzzleByLength['5'].length + validationExtraByLength['5'].length,
        },
        '6': {
          puzzle: puzzleByLength['6'].length,
          validation: puzzleByLength['6'].length + validationExtraByLength['6'].length,
        },
      },
    },
    puzzleByLength,
    validationExtraByLength,
  };

  const outDir = path.resolve(process.cwd(), 'public', 'dictionaries');
  const outFile = path.join(outDir, 'changeit_vocab_v1.json');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(payload), 'utf8');

  const sizeKb = Math.round(fs.statSync(outFile).size / 1024);
  console.log(`Generated ${outFile} (${sizeKb} KB)`);
  console.log('Vocabulary stats:', JSON.stringify(payload.stats, null, 2));
}

main().catch((err) => {
  console.error('Failed building ChangeIt vocabulary:', err);
  process.exit(1);
});
