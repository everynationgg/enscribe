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
  powerUpTileScoreMultiplier: 1.15,
  powerUpActivationBonus: {
    line_blast: 60,
    cross_blast: 110,
    word_bomb: 140,
    letter_purge: 165,
    mega_blast: 260,
  },
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

export function calculatePowerUpScore(
  powerUpType: PowerUpType,
  destroyedLetters: string[],
  config: ScoringConfig = CRUSHIT_SCORING_CONFIG
): number {
  let tilePoints = 0;
  for (const ch of destroyedLetters) {
    tilePoints += getLetterBasePoints(ch);
  }
  const scaled = Math.round(tilePoints * config.powerUpTileScoreMultiplier);
  const flatBonus = config.powerUpActivationBonus[powerUpType] ?? 50;
  return scaled + flatBonus;
}
