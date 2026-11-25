import fs from 'node:fs';
import path from 'node:path';
import {
  ChangeItEngineData,
  ChangeItVocabJson,
  buildChangeItEngineData,
} from '../../../shared/changeit/wordGraph.js';

let cachedServerData: ChangeItEngineData | null = null;

const FALLBACK_VOCAB: ChangeItVocabJson = {
  version: '1.0.0-fallback',
  puzzleByLength: {
    '3': ['CAT', 'COT', 'DOT', 'DOG', 'SUN', 'BUN', 'BAN', 'BAY', 'DAY', 'BOY', 'MAN', 'SAD', 'SAY', 'JAY', 'JOY'],
    '4': ['COLD', 'CORD', 'CARD', 'WARD', 'WARM', 'HEAD', 'HEAL', 'TEAL', 'TELL', 'TALL', 'TAIL', 'DARK', 'DARN', 'DAWN'],
    '5': ['STONE', 'SHONE', 'SHINE', 'SPACE', 'SPARE', 'STARE', 'STARS', 'DREAM', 'DREAD', 'BREAD', 'BREED', 'BLEED', 'BLEEP', 'SLEEP'],
    '6': ['WINTER', 'SUMMER', 'BROKEN', 'BITTEN'],
  },
  validationExtraByLength: {
    '3': [],
    '4': [],
    '5': [],
    '6': [],
  },
};

export function getChangeItServerData(): ChangeItEngineData {
  if (cachedServerData) return cachedServerData;

  const vocabPath = path.resolve(
    process.cwd(),
    'public',
    'dictionaries',
    'changeit_vocab_v1.json'
  );
  let parsed: ChangeItVocabJson = FALLBACK_VOCAB;
  try {
    if (fs.existsSync(vocabPath)) {
      const raw = fs.readFileSync(vocabPath, 'utf8');
      const json = JSON.parse(raw) as ChangeItVocabJson;
      if (json?.puzzleByLength && json?.validationExtraByLength) {
        parsed = json;
      }
    }
  } catch (err) {
    console.warn('[ChangeItServerVocab] Falling back to minimal vocab:', err);
  }

  cachedServerData = buildChangeItEngineData(parsed);
  return cachedServerData;
}
