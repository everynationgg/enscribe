import { generateCrosswordLayout } from './crossword.js';
import {
  countGuessableLetters,
  countWords,
  normalizeGuessItText,
  validateCustomPhrase,
} from './normalize.js';
import {
  GuessItAdventureChapter,
  GuessItCategory,
  GuessItCrosswordLayout,
  GuessItDifficulty,
  GuessItWordEntry,
} from './types.js';
import { GUESSIT_EXPANDED_SEED_SPECS } from './wordBank.js';
import { GUESSIT_MEGA_SEED_SPECS } from './megaBank.js';

export const GUESSIT_CATEGORIES: GuessItCategory[] = [
  'Movies',
  'Animals',
  'Food',
  'Science',
  'Geography',
  'Gaming',
  'History',
  'General Knowledge',
];

function makeSeedWord(
  id: string,
  rawAnswer: string,
  category: GuessItCategory,
  difficulty: GuessItDifficulty,
  clue?: string,
  options?: {
    rankedEligible?: boolean;
    adventureEligible?: boolean;
    chapterId?: string;
  }
): GuessItWordEntry {
  const answer = normalizeGuessItText(rawAnswer);
  return {
    id,
    answer,
    category,
    difficulty,
    language: 'en',
    wordCount: countWords(answer),
    letterCount: countGuessableLetters(answer),
    clue,
    contentSource: 'curated',
    validationStatus: 'approved',
    rankedEligible: options?.rankedEligible ?? true,
    adventureEligible: options?.adventureEligible ?? true,
    chapterId: options?.chapterId,
  };
}

const CORE_GUESSIT_CATALOG: GuessItWordEntry[] = [
  // Movies (incl. multi-word classics + crossword-friendly titles)
  makeSeedWord('mv_01', 'STAR WARS', 'Movies', 'easy', 'Iconic space opera saga', { chapterId: 'ch_1' }),
  makeSeedWord('mv_02', 'THE AVENGERS', 'Movies', 'medium', 'Earth’s mightiest heroes assemble', { chapterId: 'ch_1' }),
  makeSeedWord('mv_03', 'THE LION KING', 'Movies', 'easy', 'Pride Rock animated classic', { chapterId: 'ch_1' }),
  makeSeedWord('mv_04', 'JURASSIC PARK', 'Movies', 'medium', 'Island theme park with dinosaurs', { chapterId: 'ch_1' }),
  makeSeedWord('mv_05', 'THE LORD OF THE RINGS', 'Movies', 'hard', 'Middle-earth quest to Mount Doom', { chapterId: 'ch_1' }),
  makeSeedWord('mv_06', 'AVATAR', 'Movies', 'easy', 'Sci-fi journey to Pandora', { chapterId: 'ch_1' }),
  makeSeedWord('mv_07', 'TITANIC', 'Movies', 'easy', 'Famous ocean liner drama', { chapterId: 'ch_1' }),
  makeSeedWord('mv_08', 'INCEPTION', 'Movies', 'medium', 'Dreams layered inside dreams', { chapterId: 'ch_1' }),
  makeSeedWord('mv_09', 'FROZEN', 'Movies', 'easy', 'Snow queen and winter magic', { chapterId: 'ch_1' }),
  makeSeedWord('mv_10', 'SPIDER-MAN', 'Movies', 'easy', 'Web-slinging neighborhood hero'),
  makeSeedWord('mv_11', 'FINDING NEMO', 'Movies', 'easy', 'Lost clownfish in the Pacific'),
  makeSeedWord('mv_12', 'TOY STORY', 'Movies', 'easy', 'Secret life of Woody and Buzz'),
  makeSeedWord('mv_13', 'INTERSTELLAR', 'Movies', 'hard', 'Wormhole voyage to save humanity'),
  makeSeedWord('mv_14', 'GLADIATOR', 'Movies', 'medium', 'Roman arena champion'),
  makeSeedWord('mv_15', 'THE MATRIX', 'Movies', 'medium', 'Simulated reality rebellion'),
  makeSeedWord('mv_16', 'SHREK', 'Movies', 'easy', 'Swamp ogre fairytale comedy'),
  makeSeedWord('mv_17', 'INSIDE OUT', 'Movies', 'medium', 'Emotions steering young Riley'),
  makeSeedWord('mv_18', 'RATATOUILLE', 'Movies', 'hard', 'Culinary mouse chef in Paris'),
  makeSeedWord('mv_19', 'BACK TO THE FUTURE', 'Movies', 'hard', 'Time-traveling sports car adventure'),
  makeSeedWord('mv_20', 'SPIRITED AWAY', 'Movies', 'hard', 'Magical bathhouse animated tale'),

  // Animals
  makeSeedWord('an_01', 'SNOW LEOPARD', 'Animals', 'medium', 'High-altitude Himalayan big cat'),
  makeSeedWord('an_02', 'RED PANDA', 'Animals', 'easy', 'Fluffy bamboo-loving tree dweller'),
  makeSeedWord('an_03', 'BLUE WHALE', 'Animals', 'easy', 'Largest animal ever on Earth'),
  makeSeedWord('an_04', 'SEA OTTER', 'Animals', 'easy', 'Playful marine mammal holding hands'),
  makeSeedWord('an_05', 'ARCTIC FOX', 'Animals', 'medium', 'Tundra canine with winter white fur'),
  makeSeedWord('an_06', 'GIANT SQUID', 'Animals', 'medium', 'Deep-ocean ten-limbed marvel'),
  makeSeedWord('an_07', 'CHAMELEON', 'Animals', 'medium', 'Color-shifting lizard with turret eyes'),
  makeSeedWord('an_08', 'PENGUIN', 'Animals', 'easy', 'Flightless tuxedo swimmer'),
  makeSeedWord('an_09', 'PLATYPUS', 'Animals', 'hard', 'Egg-laying duck-billed mammal'),
  makeSeedWord('an_10', 'AXOLOTL', 'Animals', 'hard', 'Smiling Mexican walking salamander'),
  makeSeedWord('an_11', 'GOLDEN EAGLE', 'Animals', 'medium', 'Soaring mountain raptor'),
  makeSeedWord('an_12', 'MANTIS SHRIMP', 'Animals', 'hard', 'Reef crustacean with lightning punch'),
  makeSeedWord('an_13', 'CHEETAH', 'Animals', 'easy', 'Fastest sprinter on land'),
  makeSeedWord('an_14', 'DOLPHIN', 'Animals', 'easy', 'Echolocation ocean acrobat'),

  // Food
  makeSeedWord('fd_01', 'PIZZA MARGHERITA', 'Food', 'medium', 'Tomato, mozzarella, and fresh basil'),
  makeSeedWord('fd_02', 'CHOCOLATE CAKE', 'Food', 'easy', 'Rich cocoa layered dessert'),
  makeSeedWord('fd_03', 'GARLIC BREAD', 'Food', 'easy', 'Toasted herb butter baguette'),
  makeSeedWord('fd_04', 'ICE CREAM CONE', 'Food', 'easy', 'Frozen scoop in a crisp wafer'),
  makeSeedWord('fd_05', 'PANCAKE STACK', 'Food', 'medium', 'Griddle cakes with maple syrup'),
  makeSeedWord('fd_06', 'AVOCADO TOAST', 'Food', 'medium', 'Smashed green spread on sourdough'),
  makeSeedWord('fd_07', 'CROISSANT', 'Food', 'medium', 'Flaky crescent French pastry'),
  makeSeedWord('fd_08', 'SPAGHETTI', 'Food', 'easy', 'Long twirlable Italian pasta'),
  makeSeedWord('fd_09', 'RAMEN NOODLES', 'Food', 'medium', 'Savory Japanese broth bowl'),
  makeSeedWord('fd_10', 'MANGO STICKY RICE', 'Food', 'hard', 'Sweet coconut Thai dessert'),
  makeSeedWord('fd_11', 'TIRAMISU', 'Food', 'hard', 'Espresso-soaked mascarpone treat'),
  makeSeedWord('fd_12', 'TACO', 'Food', 'easy', 'Folded corn tortilla favorite'),
  makeSeedWord('fd_13', 'SUSHI', 'Food', 'easy', 'Vinegared rice and fresh seafood'),

  // Science
  makeSeedWord('sc_01', 'SOLAR SYSTEM', 'Science', 'easy', 'Sun and eight orbiting planets'),
  makeSeedWord('sc_02', 'BLACK HOLE', 'Science', 'easy', 'Region where gravity traps light'),
  makeSeedWord('sc_03', 'WATER CYCLE', 'Science', 'easy', 'Evaporation, condensation, precipitation'),
  makeSeedWord('sc_04', 'GRAVITY', 'Science', 'easy', 'Force keeping planets in orbit'),
  makeSeedWord('sc_05', 'PHOTOSYNTHESIS', 'Science', 'hard', 'Plants turning sunlight into energy'),
  makeSeedWord('sc_06', 'MAGNETIC FIELD', 'Science', 'medium', 'Invisible shield protecting Earth'),
  makeSeedWord('sc_07', 'DNA HELIX', 'Science', 'medium', 'Double-spiral genetic blueprint'),
  makeSeedWord('sc_08', 'THERMODYNAMICS', 'Science', 'hard', 'Laws governing heat and energy'),
  makeSeedWord('sc_09', 'SUPERCONDUCTOR', 'Science', 'hard', 'Zero-resistance electrical material'),
  makeSeedWord('sc_10', 'NEUTRON STAR', 'Science', 'medium', 'Ultra-dense collapsed star core'),
  makeSeedWord('sc_11', 'NEBULA', 'Science', 'easy', 'Giant interstellar cloud of dust'),
  makeSeedWord('sc_12', 'QUANTUM', 'Science', 'medium', 'Discrete packet of physical energy'),

  // Geography
  makeSeedWord('gg_01', 'GRAND CANYON', 'Geography', 'easy', 'Carved by the Colorado River'),
  makeSeedWord('gg_02', 'MOUNT EVEREST', 'Geography', 'easy', 'Earth’s tallest mountain peak'),
  makeSeedWord('gg_03', 'AMAZON RIVER', 'Geography', 'easy', 'Vast South American rainforest waterway'),
  makeSeedWord('gg_04', 'GREAT BARRIER REEF', 'Geography', 'hard', 'Living coral system off Australia'),
  makeSeedWord('gg_05', 'SAHARA DESERT', 'Geography', 'medium', 'Sunlit dunes spanning North Africa'),
  makeSeedWord('gg_06', 'NIAGARA FALLS', 'Geography', 'medium', 'Thundering North American waterfalls'),
  makeSeedWord('gg_07', 'ICELAND', 'Geography', 'easy', 'Volcanic island of glaciers and geysers'),
  makeSeedWord('gg_08', 'PACIFIC OCEAN', 'Geography', 'medium', 'Largest body of water on Earth'),
  makeSeedWord('gg_09', 'NORTHERN LIGHTS', 'Geography', 'medium', 'Aurora ribbons across polar skies'),
  makeSeedWord('gg_10', 'MEDITERRANEAN', 'Geography', 'hard', 'Historic sea linking three continents'),
  makeSeedWord('gg_11', 'TOKYO', 'Geography', 'easy', 'Neon capital of Japan'),

  // Gaming
  makeSeedWord('gm_01', 'BOSS BATTLE', 'Gaming', 'easy', 'Climactic stage showdown'),
  makeSeedWord('gm_02', 'HIGH SCORE', 'Gaming', 'easy', 'Top mark on the arcade cabinet'),
  makeSeedWord('gm_03', 'POWER UP', 'Gaming', 'easy', 'Collectible temporary hero boost'),
  makeSeedWord('gm_04', 'OPEN WORLD', 'Gaming', 'medium', 'Freely explorable game map'),
  makeSeedWord('gm_05', 'PIXEL ART', 'Gaming', 'easy', 'Retro grid-crafted sprites'),
  makeSeedWord('gm_06', 'SPEEDRUN', 'Gaming', 'medium', 'Racing a game start-to-finish fast'),
  makeSeedWord('gm_07', 'CHECKPOINT', 'Gaming', 'medium', 'Saved respawn beacon mid-level'),
  makeSeedWord('gm_08', 'BATTLE ROYALE', 'Gaming', 'medium', 'Last survivor standing arena'),
  makeSeedWord('gm_09', 'MULTIPLAYER', 'Gaming', 'medium', 'Competing or cooperating online'),
  makeSeedWord('gm_10', 'CRITICAL HIT', 'Gaming', 'hard', 'Lucky strike dealing bonus damage'),
  makeSeedWord('gm_11', 'EASTER EGG', 'Gaming', 'medium', 'Hidden secret tucked by developers'),

  // History
  makeSeedWord('hs_01', 'SPACE RACE', 'History', 'easy', 'Cold War sprint to the Moon'),
  makeSeedWord('hs_02', 'SILK ROAD', 'History', 'medium', 'Ancient trade network linking East and West'),
  makeSeedWord('hs_03', 'RENAISSANCE', 'History', 'hard', 'European rebirth of art and science'),
  makeSeedWord('hs_04', 'BRONZE AGE', 'History', 'medium', 'Early era of metalworking tools'),
  makeSeedWord('hs_05', 'MOON LANDING', 'History', 'easy', 'Apollo 11 historic touch-down'),
  makeSeedWord('hs_06', 'ROSETTA STONE', 'History', 'hard', 'Key that unlocked Egyptian hieroglyphs'),
  makeSeedWord('hs_07', 'PYRAMIDS', 'History', 'easy', 'Monumental ancient tombs near Giza'),
  makeSeedWord('hs_08', 'INDUSTRIAL ERA', 'History', 'hard', 'Steam engines and factory transformation'),
  makeSeedWord('hs_09', 'GREAT WALL', 'History', 'easy', 'Stone fortification winding over ridges'),

  // General Knowledge
  makeSeedWord('gk_01', 'SOLAR ECLIPSE', 'General Knowledge', 'medium', 'Moon casts shadow across daylight'),
  makeSeedWord('gk_02', 'MORSE CODE', 'General Knowledge', 'medium', 'Dots and dashes signaling messages'),
  makeSeedWord('gk_03', 'COMPASS ROSE', 'General Knowledge', 'medium', 'Cardinal directions star emblem'),
  makeSeedWord('gk_04', 'TIME ZONE', 'General Knowledge', 'easy', 'Standard clock region around the globe'),
  makeSeedWord('gk_05', 'RAINBOW', 'General Knowledge', 'easy', 'Colorful arc after sunshine meets rain'),
  makeSeedWord('gk_06', 'CONSTELLATION', 'General Knowledge', 'hard', 'Named pattern of stars in night sky'),
  makeSeedWord('gk_07', 'ENCYCLOPEDIA', 'General Knowledge', 'hard', 'Compendium covering all human knowledge'),
  makeSeedWord('gk_08', 'LIGHTHOUSE', 'General Knowledge', 'easy', 'Coastal beacon guiding ships safely'),
  makeSeedWord('gk_09', 'ORIGAMI', 'General Knowledge', 'medium', 'Japanese art of paper folding'),
  makeSeedWord('gk_10', 'TREASURE CHEST', 'General Knowledge', 'easy', 'Locked wooden box brimming with gold'),
];

function buildMergedGuessItCatalog(): GuessItWordEntry[] {
  const seenAnswers = new Set<string>();
  const out: GuessItWordEntry[] = [];
  for (const entry of CORE_GUESSIT_CATALOG) {
    if (!seenAnswers.has(entry.answer)) {
      seenAnswers.add(entry.answer);
      out.push(entry);
    }
  }
  for (const spec of [...GUESSIT_EXPANDED_SEED_SPECS, ...GUESSIT_MEGA_SEED_SPECS]) {
    const entry = makeSeedWord(spec.id, spec.answer, spec.category, spec.difficulty, spec.clue);
    if (!seenAnswers.has(entry.answer)) {
      seenAnswers.add(entry.answer);
      out.push(entry);
    }
  }
  return out;
}

export const GUESSIT_WORD_CATALOG: GuessItWordEntry[] = buildMergedGuessItCatalog();

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledWithSeed<T>(items: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Validates AI-generated or external candidate word entries before admitting to catalog.
 */
export function validateCandidateWordEntry(input: {
  answer: string;
  category: GuessItCategory;
  difficulty: GuessItDifficulty;
  language?: string;
  clue?: string;
  contentSource?: 'ai_validated' | 'curated';
  rankedEligible?: boolean;
  adventureEligible?: boolean;
}): { valid: boolean; entry?: GuessItWordEntry; error?: string } {
  if (!GUESSIT_CATEGORIES.includes(input.category)) {
    return { valid: false, error: 'Unsupported category.' };
  }
  const phraseCheck = validateCustomPhrase(input.answer);
  if (!phraseCheck.valid) {
    return { valid: false, error: phraseCheck.error };
  }
  const entry: GuessItWordEntry = {
    id: `cand_${phraseCheck.normalized.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    answer: phraseCheck.normalized,
    category: input.category,
    difficulty: input.difficulty,
    language: input.language || 'en',
    wordCount: countWords(phraseCheck.normalized),
    letterCount: countGuessableLetters(phraseCheck.normalized),
    clue: input.clue?.trim().slice(0, 120) || undefined,
    contentSource: input.contentSource ?? 'ai_validated',
    validationStatus: 'approved',
    rankedEligible: input.rankedEligible ?? true,
    adventureEligible: input.adventureEligible ?? false,
  };
  return { valid: true, entry };
}

/**
 * Selects a curated non-repeating word entry matching optional filters.
 */
export function pickWordFromCatalog(
  extraCatalog: GuessItWordEntry[],
  options: {
    category?: GuessItCategory;
    difficulty?: GuessItDifficulty;
    rankedOnly?: boolean;
    excludeAnswers?: Set<string>;
    seed?: number;
  }
): GuessItWordEntry {
  const deduped = new Map<string, GuessItWordEntry>();
  for (const w of [...GUESSIT_WORD_CATALOG, ...extraCatalog]) {
    if (w.validationStatus === 'approved' && (!options.rankedOnly || w.rankedEligible)) {
      if (!deduped.has(w.answer)) deduped.set(w.answer, w);
    }
  }
  const combined = Array.from(deduped.values());

  let pool = combined.filter(
    (w) =>
      (!options.category || w.category === options.category) &&
      (!options.difficulty || w.difficulty === options.difficulty) &&
      (!options.excludeAnswers || !options.excludeAnswers.has(w.answer))
  );
  if (pool.length === 0 && options.category) {
    pool = combined.filter(
      (w) =>
        w.category === options.category &&
        (!options.excludeAnswers || !options.excludeAnswers.has(w.answer))
    );
  }
  if (pool.length === 0) {
    pool = combined.filter((w) => !options.excludeAnswers || !options.excludeAnswers.has(w.answer));
  }
  if (pool.length === 0) {
    pool = combined;
  }

  const rawSeed =
    options.seed !== undefined
      ? Math.abs(Math.floor(options.seed))
      : Math.floor(Math.random() * 0x7fffffff);
  const rand = mulberry32((rawSeed ^ 0x9e3779b9) >>> 0);
  const idx = Math.floor(rand() * pool.length);
  return pool[idx];
}

/**
 * Builds a guaranteed valid interconnected crossword layout for a category (no spaces intersected).
 */
export function pickCrosswordForCategory(
  extraCatalog: GuessItWordEntry[],
  options: {
    category?: GuessItCategory;
    difficulty?: GuessItDifficulty;
    rankedOnly?: boolean;
    excludeAnswers?: Set<string>;
    entryCount?: number;
    seed?: number;
  }
): { category: GuessItCategory; layout: GuessItCrosswordLayout } {
  const targetCount = options.entryCount ?? (options.difficulty === 'hard' ? 4 : 3);
  const baseSeed =
    options.seed !== undefined
      ? Math.abs(Math.floor(options.seed))
      : Math.floor(Math.random() * 0x7fffffff);

  const deduped = new Map<string, GuessItWordEntry>();
  for (const w of [...GUESSIT_WORD_CATALOG, ...extraCatalog]) {
    if (
      w.validationStatus === 'approved' &&
      (!options.rankedOnly || w.rankedEligible) &&
      w.answer.length <= 13
    ) {
      if (!deduped.has(w.answer)) deduped.set(w.answer, w);
    }
  }
  const broadPool = Array.from(deduped.values());

  const catPool = options.category
    ? broadPool.filter((w) => w.category === options.category)
    : broadPool;
  const diffCatPool = options.difficulty
    ? catPool.filter((w) => w.difficulty === options.difficulty)
    : catPool;

  const isFresh = (w: GuessItWordEntry) =>
    !options.excludeAnswers || !options.excludeAnswers.has(w.answer);

  const freshDiffCat = diffCatPool.filter(isFresh);
  const freshCat = catPool.filter(isFresh);
  const freshBroad = broadPool.filter(isFresh);

  const effectivePool =
    freshDiffCat.length >= targetCount + 2
      ? freshDiffCat
      : freshCat.length >= targetCount
        ? freshCat
        : catPool.length >= targetCount
          ? catPool
          : freshBroad.length >= targetCount
            ? freshBroad
            : broadPool;

  for (let attempt = 0; attempt < 40; attempt++) {
    const attemptSeed = (baseSeed + attempt * 2654435761) >>> 0;
    const shuffled = shuffledWithSeed(effectivePool, attemptSeed);
    const picked: string[] = [];
    const seen = new Set<string>();
    for (const item of shuffled) {
      if (!seen.has(item.answer)) {
        seen.add(item.answer);
        picked.push(item.answer);
        if (picked.length >= targetCount) break;
      }
    }
    if (picked.length < targetCount) continue;
    const layout = generateCrosswordLayout(picked, attemptSeed);
    if (layout) {
      return { category: options.category ?? 'Movies', layout };
    }
  }

  // Fallback across the full category pool before ever falling back to static trio
  const fullFallbackPool = catPool.length >= targetCount ? catPool : broadPool;
  for (let attempt = 0; attempt < 20; attempt++) {
    const attemptSeed = (baseSeed + 99991 + attempt * 1013904223) >>> 0;
    const picked = shuffledWithSeed(fullFallbackPool, attemptSeed)
      .slice(0, targetCount)
      .map((w) => w.answer);
    const layout = generateCrosswordLayout(picked, attemptSeed);
    if (layout) {
      return { category: options.category ?? 'Movies', layout };
    }
  }

  // Deterministic guaranteed fallback layout
  const fallback =
    generateCrosswordLayout(['AVATAR', 'TITANIC', 'INCEPTION'], 1) ??
    generateCrosswordLayout(['STAR WARS', 'AVATAR', 'FROZEN'], 2)!;
  return { category: options.category ?? 'Movies', layout: fallback };
}

/**
 * Themed Solo Adventure progression system.
 * Structured into chapters so future themed chapters can be added cleanly.
 */
export const GUESSIT_ADVENTURE_CHAPTERS: GuessItAdventureChapter[] = [
  {
    id: 'ch_1',
    chapterNumber: 1,
    title: 'The Missing Reel',
    theme: 'Movies',
    description:
      'Five golden film reels have vanished across Moonlight Studio! Solve each GuessIt challenge to restore the premiere.',
    mascotQuote:
      'The film reels are scattered across the studio! Solve each GuessIt challenge to get them back!',
    completionBonusCoins: 250,
    completionBonusExp: 120,
    stages: [
      {
        id: 'ch1_s1',
        chapterId: 'ch_1',
        stageNumber: 1,
        label: '1-1',
        title: 'Studio Gate',
        subtitle: 'Warm up with a timeless galaxy space opera.',
        format: 'classic',
        category: 'Movies',
        difficulty: 'easy',
        maxMistakes: 6,
        timeLimitSeconds: 150,
        penaltyMs: 1800,
        answers: ['STAR WARS'],
        clue: 'Galaxy far, far away classic',
        rewardExp: 50,
        rewardCoins: 100,
        rewardShards: 2,
      },
      {
        id: 'ch1_s2',
        chapterId: 'ch_1',
        stageNumber: 2,
        label: '1-2',
        title: 'Soundstage Spotlight',
        subtitle: 'Spot multi-word spaces across Pride Rock.',
        format: 'classic',
        category: 'Movies',
        difficulty: 'easy',
        maxMistakes: 6,
        timeLimitSeconds: 150,
        penaltyMs: 1800,
        answers: ['THE LION KING'],
        clue: 'Animated savanna royalty',
        rewardExp: 65,
        rewardCoins: 130,
        rewardShards: 2,
      },
      {
        id: 'ch1_s3',
        chapterId: 'ch_1',
        stageNumber: 3,
        label: '1-3',
        title: "Director's Cut",
        subtitle: 'One guessed letter reveals every matching tile across the whole grid!',
        format: 'crossword',
        category: 'Movies',
        difficulty: 'medium',
        maxMistakes: 6,
        timeLimitSeconds: 200,
        penaltyMs: 2000,
        answers: ['AVATAR', 'TITANIC', 'INCEPTION'],
        clue: 'Connected blockbuster trio',
        rewardExp: 90,
        rewardCoins: 180,
        rewardShards: 3,
      },
      {
        id: 'ch1_s4',
        chapterId: 'ch_1',
        stageNumber: 4,
        label: '1-4',
        title: 'Projection Booth',
        subtitle: 'Heroic precision before the reel timer runs down.',
        format: 'classic',
        category: 'Movies',
        difficulty: 'medium',
        maxMistakes: 5,
        timeLimitSeconds: 140,
        penaltyMs: 2000,
        answers: ['THE AVENGERS'],
        clue: 'Superheroes unite in New York',
        rewardExp: 105,
        rewardCoins: 210,
        rewardShards: 4,
      },
      {
        id: 'ch1_s5',
        chapterId: 'ch_1',
        stageNumber: 5,
        label: '1-5',
        title: 'Grand Premiere Finale',
        subtitle: 'Restore the final master reel with a 4-film mega crossword!',
        format: 'crossword',
        category: 'Movies',
        difficulty: 'hard',
        maxMistakes: 6,
        timeLimitSeconds: 240,
        penaltyMs: 2000,
        isFinale: true,
        answers: ['STAR WARS', 'AVATAR', 'FROZEN', 'TITANIC'],
        clue: 'All-star blockbuster premiere crossword',
        rewardExp: 120,
        rewardCoins: 250,
        rewardShards: 5,
      },
    ],
  },
];
