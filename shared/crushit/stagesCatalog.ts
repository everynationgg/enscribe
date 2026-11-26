import {
  CrushItStageConfig,
  PowerUpInventory,
  PowerUpType,
  StageObjectiveConfig,
  StageTier,
} from './types.js';

export interface CrushItTierMeta {
  tier: StageTier;
  label: string;
  rangeLabel: string;
  startStage: number;
  endStage: number;
  description: string;
  accentGradient: string;
}

export const CRUSHIT_TIERS: CrushItTierMeta[] = [
  {
    tier: 'introduction',
    label: 'Introduction',
    rangeLabel: 'Stages 1–10',
    startStage: 1,
    endStage: 10,
    description: 'Master swiping words, falling tiles, and your first word-length power-ups.',
    accentGradient: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
  },
  {
    tier: 'development',
    label: 'Development',
    rangeLabel: 'Stages 11–20',
    startStage: 11,
    endStage: 20,
    description: 'Build longer words, activate power-ups strategically, and manage moves wisely.',
    accentGradient: 'linear-gradient(135deg, #0891b2 0%, #4f46e5 100%)',
  },
  {
    tier: 'advanced',
    label: 'Advanced',
    rangeLabel: 'Stages 21–30',
    startStage: 21,
    endStage: 30,
    description: 'Juggle multiple objectives and unleash Cross Blasts and Word Bombs.',
    accentGradient: 'linear-gradient(135deg, #9333ea 0%, #db2777 100%)',
  },
  {
    tier: 'expert',
    label: 'Expert',
    rangeLabel: 'Stages 31–40',
    startStage: 31,
    endStage: 40,
    description: 'Tighter move budgets demand high-value words and surgical power-up blasts.',
    accentGradient: 'linear-gradient(135deg, #e11d48 0%, #7c3aed 100%)',
  },
  {
    tier: 'mastery',
    label: 'Mastery',
    rangeLabel: 'Stages 41–50',
    startStage: 41,
    endStage: 50,
    description: 'Peak CrushIt challenges culminating in the Stage 50 Grand Mastery Finale.',
    accentGradient: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 52%, #7c3aed 100%)',
  },
];

function objScore(target: number): StageObjectiveConfig {
  return {
    id: 'obj_score',
    type: 'reach_score',
    target,
    label: `Reach ${target.toLocaleString()} points`,
    shortLabel: `${target.toLocaleString()} pts`,
  };
}

function objWords(target: number): StageObjectiveConfig {
  return {
    id: `obj_words_${target}`,
    type: 'form_words',
    target,
    label: `Form ${target} valid words`,
    shortLabel: `${target} words`,
  };
}

function objMinLen(minLength: number, target = 1): StageObjectiveConfig {
  return {
    id: `obj_len_${minLength}_${target}`,
    type: target > 1 ? 'form_long_words' : 'word_min_length',
    minLength,
    target,
    label:
      target > 1
        ? `Form ${target} words with ${minLength}+ letters`
        : `Form a ${minLength}+ letter word`,
    shortLabel: target > 1 ? `${target}× ${minLength}+ ltr` : `${minLength}+ ltr word`,
  };
}

function objAnyPowerUp(target: number): StageObjectiveConfig {
  return {
    id: `obj_pu_${target}`,
    type: 'activate_powerups',
    target,
    label: `Activate ${target} power-up${target > 1 ? 's' : ''}`,
    shortLabel: `${target} blast${target > 1 ? 's' : ''}`,
  };
}

function objSpecificPowerUp(
  powerUpType: PowerUpType,
  target: number
): StageObjectiveConfig {
  const names: Record<PowerUpType, { full: string; short: string }> = {
    line_blast: { full: 'Line Blast', short: 'Line Blast' },
    cross_blast: { full: 'Cross Blast', short: 'Cross Blast' },
    word_bomb: { full: 'Word Bomb', short: 'Word Bomb' },
    letter_purge: { full: 'Letter Purge', short: 'Purge' },
    mega_blast: { full: 'Mega Blast', short: 'Mega Blast' },
  };
  const n = names[powerUpType];
  return {
    id: `obj_spu_${powerUpType}_${target}`,
    type: 'activate_specific_powerup',
    powerUpType,
    target,
    label: `Activate ${target} ${n.full}${target > 1 ? 's' : ''}`,
    shortLabel: `${target}× ${n.short}`,
  };
}

function objTiles(target: number): StageObjectiveConfig {
  return {
    id: `obj_tiles_${target}`,
    type: 'destroy_tiles',
    target,
    label: `Destroy ${target} tiles`,
    shortLabel: `${target} tiles`,
  };
}

function objVowels(target: number): StageObjectiveConfig {
  return {
    id: `obj_vowels_${target}`,
    type: 'destroy_vowels',
    target,
    label: `Crush ${target} Pink vowels`,
    shortLabel: `${target} vowels`,
  };
}

function objConsonants(target: number): StageObjectiveConfig {
  return {
    id: `obj_consonants_${target}`,
    type: 'destroy_consonants',
    target,
    label: `Crush ${target} consonants`,
    shortLabel: `${target} cons.`,
  };
}

interface StageSpec {
  stageNumber: number;
  title: string;
  tier: StageTier;
  scoreTarget: number;
  maxMoves: number;
  objectives: StageObjectiveConfig[];
  startingPowerUps?: Partial<PowerUpInventory>;
  description: string;
}

function buildStage(spec: StageSpec): CrushItStageConfig {
  const tierMeta = CRUSHIT_TIERS.find((t) => t.tier === spec.tier)!;
  const s1 = spec.scoreTarget;
  const s2 = Math.round((spec.scoreTarget * 1.35) / 10) * 10;
  const s3 = Math.round((spec.scoreTarget * 1.75) / 10) * 10;
  const manualShuffles = spec.stageNumber <= 20 ? 2 : 1;
  const rewardCoins = 25 + Math.floor(spec.stageNumber * 3.5);

  return {
    stageNumber: spec.stageNumber,
    id: `crushit_stage_${String(spec.stageNumber).padStart(2, '0')}`,
    title: spec.title,
    tier: spec.tier,
    tierLabel: tierMeta.label,
    boardSize: 8,
    scoreTarget: spec.scoreTarget,
    maxMoves: spec.maxMoves,
    manualShuffles,
    objectives: spec.objectives,
    starThresholds: [s1, s2, s3],
    startingPowerUps: spec.startingPowerUps,
    rewardCoins,
    description: spec.description,
  };
}

/**
 * Complete, centralized data-driven catalog of all 50 playable CrushIt stages.
 * Every stage is tested for fair, achievable objectives without frustrating RNG locks.
 */
const STAGE_SPECS: StageSpec[] = [
  // ==================== STAGES 1–10: INTRODUCTION ====================
  {
    stageNumber: 1,
    title: 'First Crush',
    tier: 'introduction',
    scoreTarget: 260,
    maxMoves: 18,
    objectives: [objScore(260), objWords(4)],
    description: 'Swipe adjacent tiles in any direction to form 3+ letter words.',
  },
  {
    stageNumber: 2,
    title: 'Falling Letters',
    tier: 'introduction',
    scoreTarget: 360,
    maxMoves: 18,
    objectives: [objScore(360), objTiles(18)],
    description: 'Destroyed tiles drop the board above — watch new paths open up.',
  },
  {
    stageNumber: 3,
    title: 'Pink Spark',
    tier: 'introduction',
    scoreTarget: 450,
    maxMoves: 18,
    objectives: [objScore(450), objVowels(9)],
    description: 'Pink tiles are always vowels. Link them cleanly to score.',
  },
  {
    stageNumber: 4,
    title: 'Four-Letter Spark',
    tier: 'introduction',
    scoreTarget: 540,
    maxMoves: 18,
    objectives: [objScore(540), objMinLen(4, 2)],
    description: '4-letter words earn a Line Blast power-up and big score bonuses!',
  },
  {
    stageNumber: 5,
    title: 'Line Breaker',
    tier: 'introduction',
    scoreTarget: 680,
    maxMoves: 18,
    objectives: [objScore(680), objSpecificPowerUp('line_blast', 1)],
    startingPowerUps: { line_blast: 1 },
    description: 'Select Line Blast from your toolbar to clear an entire row or column.',
  },
  {
    stageNumber: 6,
    title: 'Consonant Cascade',
    tier: 'introduction',
    scoreTarget: 780,
    maxMoves: 18,
    objectives: [objScore(780), objConsonants(18)],
    description: 'Blue, green, and gold consonants carry higher base point values.',
  },
  {
    stageNumber: 7,
    title: 'Five-Letter Flair',
    tier: 'introduction',
    scoreTarget: 900,
    maxMoves: 19,
    objectives: [objScore(900), objMinLen(5, 1)],
    description: 'Form a 5-letter word to unlock a Cross Blast power-up.',
  },
  {
    stageNumber: 8,
    title: 'Word Wave',
    tier: 'introduction',
    scoreTarget: 1020,
    maxMoves: 19,
    objectives: [objScore(1020), objWords(8), objTiles(34)],
    description: 'Keep the board flowing with steady words and crisp clears.',
  },
  {
    stageNumber: 9,
    title: 'Blast Practice',
    tier: 'introduction',
    scoreTarget: 1150,
    maxMoves: 18,
    objectives: [objScore(1150), objAnyPowerUp(2)],
    description: 'Form 4+ letter words to earn power-ups, then fire two blasts!',
  },
  {
    stageNumber: 10,
    title: 'Rookie Finale',
    tier: 'introduction',
    scoreTarget: 1320,
    maxMoves: 19,
    objectives: [objScore(1320), objMinLen(4, 3), objAnyPowerUp(2)],
    description: 'Prove your fundamentals with three 4+ letter words and two blasts.',
  },

  // ==================== STAGES 11–20: DEVELOPMENT ====================
  {
    stageNumber: 11,
    title: 'Crossroad Surge',
    tier: 'development',
    scoreTarget: 1450,
    maxMoves: 18,
    objectives: [objScore(1450), objSpecificPowerUp('cross_blast', 1)],
    startingPowerUps: { cross_blast: 1 },
    description: 'Unleash a Cross Blast to wipe both a full row and column at once.',
  },
  {
    stageNumber: 12,
    title: 'Vowel Harvest',
    tier: 'development',
    scoreTarget: 1580,
    maxMoves: 18,
    objectives: [objScore(1580), objVowels(20), objMinLen(4, 3)],
    description: 'Clear 20 pink vowels while keeping word lengths strong.',
  },
  {
    stageNumber: 13,
    title: 'Stretch & Score',
    tier: 'development',
    scoreTarget: 1700,
    maxMoves: 18,
    objectives: [objScore(1700), objMinLen(5, 2)],
    description: 'Two 5-letter words will supercharge your score and stock Cross Blasts.',
  },
  {
    stageNumber: 14,
    title: 'Tile Tornado',
    tier: 'development',
    scoreTarget: 1850,
    maxMoves: 18,
    objectives: [objScore(1850), objTiles(58), objAnyPowerUp(2)],
    description: 'Use Line and Cross Blasts to rack up massive tile destruction.',
  },
  {
    stageNumber: 15,
    title: 'Blast Factory',
    tier: 'development',
    scoreTarget: 2000,
    maxMoves: 18,
    objectives: [objScore(2000), objSpecificPowerUp('line_blast', 2), objMinLen(4, 4)],
    description: 'Chain 4-letter words and fire two Line Blasts to dominate the board.',
  },
  {
    stageNumber: 16,
    title: 'Consonant Crush',
    tier: 'development',
    scoreTarget: 2150,
    maxMoves: 18,
    objectives: [objScore(2150), objConsonants(38), objWords(9)],
    description: 'Target high-value green and gold consonants inside longer words.',
  },
  {
    stageNumber: 17,
    title: 'Six-Letter Spark',
    tier: 'development',
    scoreTarget: 2300,
    maxMoves: 19,
    objectives: [objScore(2300), objMinLen(6, 1)],
    description: 'Craft a 6-letter word to forge your first Word Bomb!',
  },
  {
    stageNumber: 18,
    title: 'Bomb Squad',
    tier: 'development',
    scoreTarget: 2450,
    maxMoves: 18,
    objectives: [objScore(2450), objSpecificPowerUp('word_bomb', 1), objTiles(64)],
    startingPowerUps: { word_bomb: 1 },
    description: 'Detonate a 3 × 3 Word Bomb where dense high-value letters cluster.',
  },
  {
    stageNumber: 19,
    title: 'Precision Moves',
    tier: 'development',
    scoreTarget: 2550,
    maxMoves: 16,
    objectives: [objScore(2550), objMinLen(5, 2), objAnyPowerUp(3)],
    description: 'Fewer moves mean every swipe counts. Build blasts early!',
  },
  {
    stageNumber: 20,
    title: 'Development Boss',
    tier: 'development',
    scoreTarget: 2750,
    maxMoves: 18,
    objectives: [objScore(2750), objMinLen(5, 3), objAnyPowerUp(3)],
    description: 'Combine three 5+ letter words with three power-up blasts to advance.',
  },

  // ==================== STAGES 21–30: ADVANCED ====================
  {
    stageNumber: 21,
    title: 'Twin Signals',
    tier: 'advanced',
    scoreTarget: 2900,
    maxMoves: 18,
    objectives: [objScore(2900), objVowels(28), objConsonants(42)],
    description: 'Balance vowels and consonants across sweeping diagonal paths.',
  },
  {
    stageNumber: 22,
    title: 'Crossfire',
    tier: 'advanced',
    scoreTarget: 3050,
    maxMoves: 18,
    objectives: [objScore(3050), objSpecificPowerUp('cross_blast', 2), objTiles(74)],
    description: 'Earn and trigger two Cross Blasts to carve through 74 tiles.',
  },
  {
    stageNumber: 23,
    title: 'Longform Surge',
    tier: 'advanced',
    scoreTarget: 3200,
    maxMoves: 18,
    objectives: [objScore(3200), objMinLen(5, 3), objMinLen(6, 1)],
    description: 'Scan the full 8 × 8 board for plural and -ING/-ED extensions.',
  },
  {
    stageNumber: 24,
    title: 'Chain Reaction',
    tier: 'advanced',
    scoreTarget: 3350,
    maxMoves: 17,
    objectives: [objScore(3350), objAnyPowerUp(4), objTiles(82)],
    description: 'Four blasts plus heavy tile destruction within 17 moves.',
  },
  {
    stageNumber: 25,
    title: 'Purge Prelude',
    tier: 'advanced',
    scoreTarget: 3500,
    maxMoves: 18,
    objectives: [objScore(3500), objSpecificPowerUp('letter_purge', 1), objVowels(30)],
    startingPowerUps: { letter_purge: 1 },
    description: 'Use Letter Purge on the most abundant letter to wipe it everywhere!',
  },
  {
    stageNumber: 26,
    title: 'Wordsmith Rhythm',
    tier: 'advanced',
    scoreTarget: 3650,
    maxMoves: 17,
    objectives: [objScore(3650), objWords(11), objMinLen(4, 5)],
    description: 'Keep up rapid 4+ letter hits without wasting moves on 3-letter fillers.',
  },
  {
    stageNumber: 27,
    title: 'Detonation Zone',
    tier: 'advanced',
    scoreTarget: 3800,
    maxMoves: 18,
    objectives: [objScore(3800), objSpecificPowerUp('word_bomb', 1), objAnyPowerUp(4)],
    description: 'Forge a 6-letter Word Bomb and unleash four total blasts.',
  },
  {
    stageNumber: 28,
    title: 'Emerald & Gold',
    tier: 'advanced',
    scoreTarget: 3950,
    maxMoves: 17,
    objectives: [objScore(3950), objConsonants(54), objMinLen(5, 3)],
    description: 'Weave green and gold consonants into 5-letter multipliers.',
  },
  {
    stageNumber: 29,
    title: 'Skyline Collapse',
    tier: 'advanced',
    scoreTarget: 4100,
    maxMoves: 17,
    objectives: [objScore(4100), objTiles(94), objMinLen(5, 3)],
    description: 'Clear 94 tiles by pairing long words with Cross and Line Blasts.',
  },
  {
    stageNumber: 30,
    title: 'Advanced Boss',
    tier: 'advanced',
    scoreTarget: 4350,
    maxMoves: 18,
    objectives: [objScore(4350), objMinLen(6, 2), objAnyPowerUp(4)],
    startingPowerUps: { line_blast: 1 },
    description: 'Craft two 6-letter words and fire four blasts to enter Expert tier!',
  },

  // ==================== STAGES 31–40: EXPERT ====================
  {
    stageNumber: 31,
    title: 'Tight Quarters',
    tier: 'expert',
    scoreTarget: 4500,
    maxMoves: 16,
    objectives: [objScore(4500), objMinLen(5, 3), objAnyPowerUp(4)],
    description: 'Only 16 moves — every word should earn a power-up or huge score.',
  },
  {
    stageNumber: 32,
    title: 'Cross Matrix',
    tier: 'expert',
    scoreTarget: 4700,
    maxMoves: 16,
    objectives: [objScore(4700), objSpecificPowerUp('cross_blast', 2), objTiles(96)],
    description: 'Fire two Cross Blasts to clear nearly 100 tiles in 16 moves.',
  },
  {
    stageNumber: 33,
    title: 'Seven-Letter Summit',
    tier: 'expert',
    scoreTarget: 4900,
    maxMoves: 18,
    objectives: [objScore(4900), objMinLen(7, 1), objAnyPowerUp(3)],
    description: 'Build a 7-letter word to unlock Letter Purge and massive multiplier points.',
  },
  {
    stageNumber: 34,
    title: 'Prism Cascade',
    tier: 'expert',
    scoreTarget: 5100,
    maxMoves: 16,
    objectives: [objScore(5100), objVowels(38), objConsonants(56)],
    description: 'High-volume dual clear — maximize Cross and Line Blast coverage.',
  },
  {
    stageNumber: 35,
    title: 'Bomb Barrage',
    tier: 'expert',
    scoreTarget: 5300,
    maxMoves: 17,
    objectives: [objScore(5300), objSpecificPowerUp('word_bomb', 2), objTiles(102)],
    startingPowerUps: { word_bomb: 1 },
    description: 'Detonate two Word Bombs and crush over 100 tiles.',
  },
  {
    stageNumber: 36,
    title: 'Lexicon Edge',
    tier: 'expert',
    scoreTarget: 5500,
    maxMoves: 16,
    objectives: [objScore(5500), objMinLen(5, 4), objWords(11)],
    description: 'Four 5+ letter words inside a razor-sharp 16-move budget.',
  },
  {
    stageNumber: 37,
    title: 'Shockwave Alley',
    tier: 'expert',
    scoreTarget: 5750,
    maxMoves: 16,
    objectives: [objScore(5750), objAnyPowerUp(5), objTiles(110)],
    description: 'Keep the power-up toolbar firing — five blasts required!',
  },
  {
    stageNumber: 38,
    title: 'Mega Preview',
    tier: 'expert',
    scoreTarget: 6000,
    maxMoves: 17,
    objectives: [objScore(6000), objSpecificPowerUp('mega_blast', 1), objTiles(115)],
    startingPowerUps: { mega_blast: 1 },
    description: 'Unleash a Mega Blast right into the heart of the 8 × 8 board!',
  },
  {
    stageNumber: 39,
    title: 'Surgical Swipes',
    tier: 'expert',
    scoreTarget: 6200,
    maxMoves: 15,
    objectives: [objScore(6200), objMinLen(6, 2), objAnyPowerUp(4)],
    description: '15 moves only. High-value 6-letter paths are your key to survival.',
  },
  {
    stageNumber: 40,
    title: 'Expert Boss',
    tier: 'expert',
    scoreTarget: 6500,
    maxMoves: 17,
    objectives: [objScore(6500), objMinLen(6, 2), objSpecificPowerUp('cross_blast', 2)],
    startingPowerUps: { cross_blast: 1 },
    description: 'Conquer the Expert Boss to unlock the final Mastery tier!',
  },

  // ==================== STAGES 41–50: MASTERY ====================
  {
    stageNumber: 41,
    title: 'Mastery Awakening',
    tier: 'mastery',
    scoreTarget: 6800,
    maxMoves: 17,
    objectives: [objScore(6800), objMinLen(5, 5), objAnyPowerUp(5)],
    description: 'Five 5+ letter words and five blasts — welcome to Mastery.',
  },
  {
    stageNumber: 42,
    title: 'Obsidian Cascade',
    tier: 'mastery',
    scoreTarget: 7100,
    maxMoves: 17,
    objectives: [objScore(7100), objTiles(124), objVowels(44)],
    startingPowerUps: { line_blast: 1 },
    description: 'Drive huge cascades to clear 124 tiles and 44 pink vowels.',
  },
  {
    stageNumber: 43,
    title: 'Purge Protocol',
    tier: 'mastery',
    scoreTarget: 7400,
    maxMoves: 18,
    objectives: [objScore(7400), objSpecificPowerUp('letter_purge', 1), objMinLen(6, 2)],
    startingPowerUps: { letter_purge: 1 },
    description: 'Time Letter Purge to open dream paths for two 6-letter words.',
  },
  {
    stageNumber: 44,
    title: 'Crown Consonants',
    tier: 'mastery',
    scoreTarget: 7700,
    maxMoves: 17,
    objectives: [objScore(7700), objConsonants(74), objAnyPowerUp(5)],
    description: 'Crush 74 consonants while chaining five strategic power-ups.',
  },
  {
    stageNumber: 45,
    title: 'Starburst Forge',
    tier: 'mastery',
    scoreTarget: 8000,
    maxMoves: 18,
    objectives: [objScore(8000), objMinLen(7, 1), objSpecificPowerUp('word_bomb', 2)],
    startingPowerUps: { word_bomb: 1 },
    description: 'Forge a 7-letter word and detonate two 3 × 3 Word Bombs.',
  },
  {
    stageNumber: 46,
    title: 'Hyper Grid',
    tier: 'mastery',
    scoreTarget: 8300,
    maxMoves: 17,
    objectives: [objScore(8300), objTiles(136), objAnyPowerUp(6)],
    startingPowerUps: { cross_blast: 1 },
    description: 'Six blasts and 136 crushed tiles — total board domination.',
  },
  {
    stageNumber: 47,
    title: 'Golden Lexicon',
    tier: 'mastery',
    scoreTarget: 8600,
    maxMoves: 17,
    objectives: [objScore(8600), objMinLen(6, 3), objWords(12)],
    description: 'Three 6+ letter words and 12 total valid words in 17 moves.',
  },
  {
    stageNumber: 48,
    title: 'Supernova Trail',
    tier: 'mastery',
    scoreTarget: 8900,
    maxMoves: 18,
    objectives: [objScore(8900), objSpecificPowerUp('cross_blast', 3), objTiles(144)],
    startingPowerUps: { cross_blast: 1 },
    description: 'Three Cross Blasts and 144 crushed tiles pave the road to Stage 50.',
  },
  {
    stageNumber: 49,
    title: 'Penultimate Crush',
    tier: 'mastery',
    scoreTarget: 9200,
    maxMoves: 18,
    objectives: [objScore(9200), objMinLen(6, 3), objAnyPowerUp(6)],
    startingPowerUps: { word_bomb: 1 },
    description: 'One step from the summit: 9,200 points, three 6+ words, six blasts.',
  },
  {
    stageNumber: 50,
    title: 'CrushIt Mastery',
    tier: 'mastery',
    scoreTarget: 9800,
    maxMoves: 19,
    objectives: [objScore(9800), objMinLen(7, 1), objAnyPowerUp(6), objTiles(155)],
    startingPowerUps: { cross_blast: 1, mega_blast: 1 },
    description: 'The ultimate Stage 50 CrushIt challenge. Unleash everything you have mastered!',
  },
];

export const CRUSHIT_STAGES: CrushItStageConfig[] = STAGE_SPECS.map(buildStage);

export const CRUSHIT_TOTAL_STAGES = CRUSHIT_STAGES.length; // 50

export function getCrushItStage(stageNumber: number): CrushItStageConfig | undefined {
  if (!Number.isInteger(stageNumber) || stageNumber < 1 || stageNumber > CRUSHIT_STAGES.length) {
    return undefined;
  }
  return CRUSHIT_STAGES[stageNumber - 1];
}
