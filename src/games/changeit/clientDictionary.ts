import {
  ChangeItEngineData,
  ChangeItVocabJson,
  buildChangeItEngineData,
} from '../../../shared/changeit/wordGraph';

let cachedPromise: Promise<ChangeItEngineData> | null = null;
let cachedSyncData: ChangeItEngineData | null = null;

const MINIMAL_FALLBACK_VOCAB: ChangeItVocabJson = {
  version: '1.0.0-client-fallback',
  puzzleByLength: {
    '3': ['CAT', 'COT', 'DOT', 'DOG', 'BOY', 'BAY', 'BAN', 'MAN', 'SAD', 'SAY', 'JAY', 'JOY', 'SUN', 'BUN', 'DAY'],
    '4': ['COLD', 'CORD', 'CARD', 'WARD', 'WARM', 'HEAD', 'HEAL', 'TEAL', 'TELL', 'TALL', 'TAIL', 'WOOD', 'WOOL', 'COOL', 'COAL', 'ROCK', 'SOCK', 'SACK', 'SANK', 'SAND', 'DARK', 'DARN', 'DAWN'],
    '5': ['BLACK', 'SLACK', 'SLICK', 'SLICE', 'SPICE', 'SPINE', 'SHINE', 'SPACE', 'SPARE', 'STARE', 'STARS', 'DREAM', 'DREAD', 'BREAD', 'BREED', 'BLEED', 'BLEEP', 'SLEEP'],
    '6': ['BROKEN', 'BITTEN'],
  },
  validationExtraByLength: { '3': [], '4': [], '5': [], '6': [] },
};

export function getCachedChangeItClientData(): ChangeItEngineData | null {
  return cachedSyncData;
}

/**
 * Lazy-loads the ChangeIt versioned vocabulary JSON only when entering ChangeIt,
 * keeping initial Enscribe hub and other games lightweight.
 */
export function loadChangeItClientData(): Promise<ChangeItEngineData> {
  if (cachedSyncData) return Promise.resolve(cachedSyncData);
  if (cachedPromise) return cachedPromise;

  cachedPromise = (async () => {
    try {
      const res = await fetch('/dictionaries/changeit_vocab_v1.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ChangeItVocabJson;
      if (json?.puzzleByLength && json?.validationExtraByLength) {
        const built = buildChangeItEngineData(json);
        cachedSyncData = built;
        return built;
      }
      throw new Error('Malformed vocabulary payload');
    } catch {
      const built = buildChangeItEngineData(MINIMAL_FALLBACK_VOCAB);
      cachedSyncData = built;
      return built;
    }
  })();

  return cachedPromise;
}
