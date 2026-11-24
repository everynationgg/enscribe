import {
  CHAIN_SYNONYMS,
  ChainHistoryTracker,
  generateUniqueGraphChain,
} from '../../../shared/chainit/wordGraph.js';
import { validateSingleChainWord } from './puzzleAssignment.js';

const globalChainHistory = new ChainHistoryTracker({
  chains: 300,
  starts: 65,
  words: 200,
  edges: 350,
});

function sanitizeCandidate(raw: string, target: string): string | null {
  const clean = raw.trim().toUpperCase();
  if (!/^[A-Z]{2,14}$/.test(clean)) return null;
  if (clean === target) return null;
  if (clean.includes(target) || target.includes(clean)) return null;
  return clean;
}

/**
 * Instant synchronous 1-word synonym clue from built-in dictionary.
 * Returns null if word is custom and not yet resolved asynchronously.
 */
export function getSyncOneWordClue(word: string): string | null {
  const upper = word.trim().toUpperCase();
  return CHAIN_SYNONYMS[upper] ?? null;
}

/**
 * Zero-key 1-word synonym resolver: checks built-in map first (0ms),
 * then falls back to free Datamuse API for custom player words.
 */
export async function resolveOneWordClue(word: string): Promise<string> {
  const target = word.trim().toUpperCase();
  const local = CHAIN_SYNONYMS[target];
  if (local) return local;

  try {
    const res = await fetch(
      `https://api.datamuse.com/words?ml=${encodeURIComponent(target.toLowerCase())}&max=14`,
      { signal: AbortSignal.timeout(1500) }
    );
    if (res.ok) {
      const rows = (await res.json()) as Array<{ word: string }>;
      for (const row of rows) {
        const candidate = sanitizeCandidate(row.word, target);
        if (candidate) return candidate;
      }
    }
  } catch {
    // offline or timeout fallback below
  }

  return 'HINT';
}

/**
 * Synchronous, ultra-fast (<1ms) unique word-chain generator backed by
 * the 50,000+ path graph and anti-repetition history tracker.
 */
export function generateLocalWordChainSync(
  themeRaw: string,
  desiredLength: number,
  options?: { excludeWords?: string[]; excludeChains?: string[] }
): { name: string; theme: string; words: string[] } {
  return generateUniqueGraphChain({
    theme: themeRaw,
    length: desiredLength,
    excludeWords: options?.excludeWords,
    excludeChains: options?.excludeChains,
    recentHistory: globalChainHistory,
  });
}

/**
 * Generates a valid multi-word connected chain for a theme without repeating recent words.
 * Uses Gemini 2.5 Flash if GEMINI_API_KEY is configured (with strict anti-repetition & validation),
 * and immediately serves from the 50,000+ path graph when unavailable or offline.
 */
export async function generateWordChain(
  themeRaw: string,
  desiredLength: number,
  options?: { excludeWords?: string[]; excludeChains?: string[] }
): Promise<{ name: string; theme: string; words: string[] }> {
  const length = Math.max(3, Math.min(8, Math.round(desiredLength || 5)));
  const cleanTheme = themeRaw.trim() || 'Adventure';
  const excludeWords = options?.excludeWords ?? [];

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (apiKey) {
    try {
      const avoidList = Array.from(
        new Set(excludeWords.map((w) => w.trim().toUpperCase()).filter(Boolean))
      ).slice(0, 24);
      const prompt = [
        `Generate a brand-new, creative English compound-word / two-word-phrase chain for the game ChainIt.`,
        `Theme: "${cleanTheme}". Exact word count: ${length}.`,
        `Rules:`,
        `1. Return ONLY single alphabetic uppercase English words (no spaces, hyphens, or numbers).`,
        `2. Every consecutive pair (word[i] + " " + word[i+1]) MUST form a common, recognizable English compound word or everyday phrase (e.g. STAR -> LIGHT -> HOUSE -> BOAT -> DOCK).`,
        `3. All ${length} words in the chain must be distinct.`,
        avoidList.length > 0 ? `4. Do NOT use any of these recent words: ${avoidList.join(', ')}.` : '',
        `Respond ONLY with JSON: {"name": "<short creative 2-3 word title>", "words": ["WORD1", ...]}`,
      ]
        .filter(Boolean)
        .join('\n');

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
          apiKey
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 1.0 },
          }),
          signal: AbortSignal.timeout(3000),
        }
      );

      if (res.ok) {
        const data = (await res.json()) as any;
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text) as { name?: string; words?: string[] };
          const rawWords = Array.isArray(parsed?.words) ? parsed.words : [];
          const normalized = rawWords
            .map((w) => validateSingleChainWord(String(w || '')).normalized)
            .filter((w) => validateSingleChainWord(w).valid);
          const unique = Array.from(new Set(normalized));
          const avoidSet = new Set(avoidList);
          const hasAvoided = unique.some((w) => avoidSet.has(w));
          const sig = unique.slice(0, length).join('>');

          if (
            unique.length === length &&
            !hasAvoided &&
            !globalChainHistory.hasChain(sig) &&
            !options?.excludeChains?.includes(sig)
          ) {
            const finalWords = unique.slice(0, length);
            globalChainHistory.record(finalWords);
            return {
              name: String(parsed.name || `${cleanTheme} Spark`).trim().slice(0, 36),
              theme: cleanTheme,
              words: finalWords,
            };
          }
        }
      }
    } catch {
      // Fall back cleanly to local combinatorial graph below
    }
  }

  return generateLocalWordChainSync(cleanTheme, length, options);
}
