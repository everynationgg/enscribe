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

const cacheByLang = new Map<string, ServerDictionary>();

export function getServerDictionary(language = 'en'): ServerDictionary {
  const key = language.toLowerCase();
  const existing = cacheByLang.get(key);
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
  const prefixes = new Set<string>();
  for (const raw of list) {
    const clean = raw.trim().toUpperCase();
    if (clean.length < 3 || clean.length > 15) continue;
    words.add(clean);
    const maxP = Math.min(clean.length, 6);
    for (let i = 1; i <= maxP; i++) prefixes.add(clean.slice(0, i));
  }

  const loaded = { words, prefixes };
  cacheByLang.set(key, loaded);
  return loaded;
}
