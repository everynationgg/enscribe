import fs from 'node:fs';
import path from 'node:path';

export interface ServerDictionary {
  words: Set<string>;
  prefixes: Set<string>;
}

const CORE_FALLBACK_WORDS = [
  'ART', 'CAT', 'STAR', 'GLOW', 'GRID', 'WORD', 'MINT', 'GLEAM', 'HEART', 'CROWN',
  'GALAXY', 'PUZZLE', 'DRAGON', 'BRIGHT', 'CRYSTAL', 'FORTUNE', 'QUEST', 'SPARK',
  'FLAME', 'SUN', 'CATS', 'RATES', 'TREAD', 'READ', 'STONE', 'SHORE', 'LIGHT',
];

const wordSetCacheByLang = new Map<string, Set<string>>();
const fullDictCacheByLang = new Map<string, ServerDictionary>();

/**
 * Fast O(1) word-validation set loader (~3x faster cold load than full prefix index).
 * Used on hot word-submission paths that do not run board DFS.
 */
export function getServerWordSet(language = 'en'): Set<string> {
  const key = language.toLowerCase();
  const existing = wordSetCacheByLang.get(key);
  if (existing) return existing;

  const dictPath = path.resolve(process.cwd(), 'public', 'dictionaries', `${key}.txt`);
  let list: string[] = CORE_FALLBACK_WORDS;
  try {
    if (fs.existsSync(dictPath)) {
      const parsed = fs.readFileSync(dictPath, 'utf8').split(/\r?\n/).filter(Boolean);
      if (parsed.length > 500) {
        list = parsed;
      }
    }
  } catch {
    // fallback safely
  }

  const words = new Set<string>();
  for (const raw of list) {
    const clean = raw.trim().toUpperCase();
    if (clean.length < 3 || clean.length > 15) continue;
    words.add(clean);
  }

  wordSetCacheByLang.set(key, words);
  return words;
}

/**
 * Full dictionary + prefix index loader for board generation & fairness DFS.
 */
export function getServerDictionary(language = 'en'): ServerDictionary {
  const key = language.toLowerCase();
  const existing = fullDictCacheByLang.get(key);
  if (existing) return existing;

  const words = getServerWordSet(key);
  const prefixes = new Set<string>();
  for (const word of words) {
    const maxP = Math.min(word.length, 6);
    for (let i = 1; i <= maxP; i++) {
      prefixes.add(word.slice(0, i));
    }
  }

  const loaded = { words, prefixes };
  fullDictCacheByLang.set(key, loaded);
  return loaded;
}
