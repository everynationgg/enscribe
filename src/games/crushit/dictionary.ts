import { buildCrushItTrieFromWords, CrushItWordTrie } from '../../../shared/crushit/trieSolver';
import { loadGridItWordSet } from '../gridit/dictionary';

export interface CrushItDictionaryBundle {
  words: Set<string>;
  trie: CrushItWordTrie;
}

let cachedBundlePromise: Promise<CrushItDictionaryBundle> | null = null;

/**
 * Reuses Enscribe's existing English dictionary (`/dictionaries/en.txt` via loadGridItWordSet)
 * and builds a compact, prefix-pruning Trie for instant dead-board detection.
 * Zero AI API calls are used.
 */
export function loadCrushItDictionary(): Promise<CrushItDictionaryBundle> {
  if (cachedBundlePromise) return cachedBundlePromise;

  cachedBundlePromise = (async () => {
    const words = await loadGridItWordSet('en');
    // Index words of length 3..6 in the Trie for near-instant (<25ms) build and <1ms dead-board detection,
    // while keeping full-length 3..15+ letter word validation via the complete `words` Set.
    const trie = buildCrushItTrieFromWords(words, 6);
    return { words, trie };
  })();

  return cachedBundlePromise;
}
