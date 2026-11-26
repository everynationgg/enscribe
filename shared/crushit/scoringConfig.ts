import { getLetterBasePoints } from './letterConfig.js';
import { PowerUpType } from './types.js';

export interface ScoringConfig {
  minWordLength: number;
  lengthMultipliers: Record<number, number>;
  lengthBonuses: Record<number, number>;
  extraLengthStepMultiplier: number;
  extraLengthStepBonus: number;
  powerUpTileScoreMultiplier: number;
  powerUpActivationBonus: Record<PowerUpType, number>;
  /** Extra multiplier per chained power-up beyond the first in a single move. */
  chainReactionBonusPerExtra: number;
}

/**
 * Configurable scoring rules for CrushIt.
 * Longer words scale super-linearly so forming 5-8+ letter words meaningfully
 * outperforms repeatedly submitting 3-letter words.
 */
export const CRUSHIT_SCORING_CONFIG: ScoringConfig = {
  minWordLength: 3,
  lengthMultipliers: {
    3: 1.0,
    4: 1.5,
    5: 2.1,
    6: 2.8,
    7: 3.6,
    8: 4.5,
  },
  lengthBonuses: {
    3: 0,
    4: 35,
    5: 90,
    6: 175,
    7: 300,
    8: 480,
  },
  extraLengthStepMultiplier: 0.75,
  extraLengthStepBonus: 140,
  powerUpTileScoreMultiplier: 1.25,
  powerUpActivationBonus: {
    line_blast: 60,
    cross_blast: 110,
    word_bomb: 145,
    letter_purge: 175,
    mega_blast: 260,
  },
  chainReactionBonusPerExtra: 95,
};

export function calculateWordScore(
  letters: string[],
  config: ScoringConfig = CRUSHIT_SCORING_CONFIG
): number {
  const len = letters.length;
  if (len < config.minWordLength) return 0;

  let basePoints = 0;
  for (const ch of letters) {
    basePoints += getLetterBasePoints(ch);
  }

  let multiplier: number;
  let bonus: number;

  if (len <= 8) {
    multiplier = config.lengthMultipliers[len] ?? 1.0;
    bonus = config.lengthBonuses[len] ?? 0;
  } else {
    const extra = len - 8;
    multiplier = (config.lengthMultipliers[8] ?? 4.5) + extra * config.extraLengthStepMultiplier;
    bonus = (config.lengthBonuses[8] ?? 480) + extra * config.extraLengthStepBonus;
  }

  return Math.round(basePoints * multiplier + bonus);
}

/**
 * Calculates total bonus score for power-up destruction during a move.
 * Every affected extra tile is counted strictly ONCE (deduplicated before calling).
 */
export function calculatePowerUpDestructionScore(
  activatedTypes: PowerUpType[],
  uniqueExtraDestroyedLetters: string[],
  config: ScoringConfig = CRUSHIT_SCORING_CONFIG
): number {
  if (activatedTypes.length === 0) return 0;

  let tilePoints = 0;
  for (const ch of uniqueExtraDestroyedLetters) {
    tilePoints += getLetterBasePoints(ch);
  }
  const scaledTilePts = Math.round(tilePoints * config.powerUpTileScoreMultiplier);

  let activationBonuses = 0;
  for (const t of activatedTypes) {
    activationBonuses += config.powerUpActivationBonus[t] ?? 50;
  }

  const chainBonus =
    activatedTypes.length > 1
      ? (activatedTypes.length - 1) * config.chainReactionBonusPerExtra
      : 0;

  return scaledTilePts + activationBonuses + chainBonus;
}
