import {
  GuessItCategory,
  GuessItClassicToken,
  GuessItClassicView,
} from './types.js';

export const GUESSIT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const ALLOWED_PUNCTUATION = new Set(["'", '-', '&', '!', ':', '.']);

const BLOCKED_SUBSTRINGS = [
  'FUCK',
  'SHIT',
  'BITCH',
  'ASS',
  'CUNT',
  'DICK',
  'COCK',
  'SLUT',
  'WHORE',
  'NIGGER',
  'FAGGOT',
  'RAPE',
  'NAZI',
];

/**
 * Normalizes GuessIt answers consistently while keeping spaces and safe punctuation intact.
 */
export function normalizeGuessItText(raw: string): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isEnglishUpperLetter(ch: string): boolean {
  return ch.length === 1 && ch >= 'A' && ch <= 'Z';
}

export function extractUniqueLetters(answer: string): string[] {
  const norm = normalizeGuessItText(answer);
  const seen = new Set<string>();
  for (const ch of norm) {
    if (isEnglishUpperLetter(ch)) seen.add(ch);
  }
  return Array.from(seen);
}

export function countGuessableLetters(answer: string): number {
  const norm = normalizeGuessItText(answer);
  let total = 0;
  for (const ch of norm) {
    if (isEnglishUpperLetter(ch)) total++;
  }
  return total;
}

export function countWords(answer: string): number {
  const norm = normalizeGuessItText(answer);
  if (!norm) return 0;
  return norm.split(' ').filter(Boolean).length;
}

export function validateCustomPhrase(raw: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = normalizeGuessItText(raw);
  if (normalized.length < 3 || normalized.length > 42) {
    return {
      valid: false,
      normalized,
      error: 'Answer must be between 3 and 42 characters long.',
    };
  }

  for (const ch of normalized) {
    if (!isEnglishUpperLetter(ch) && ch !== ' ' && !ALLOWED_PUNCTUATION.has(ch)) {
      return {
        valid: false,
        normalized,
        error: `Unsupported character "${ch}". Use English A–Z letters, spaces, and basic punctuation (' - & ! : .).`,
      };
    }
  }

  const letters = countGuessableLetters(normalized);
  if (letters < 3) {
    return {
      valid: false,
      normalized,
      error: 'Answer must contain at least 3 English A–Z letters.',
    };
  }

  const words = countWords(normalized);
  if (words > 5) {
    return {
      valid: false,
      normalized,
      error: 'Phrases may contain at most 5 words.',
    };
  }

  const compactAlpha = normalized.replace(/[^A-Z]/g, '');
  for (const bad of BLOCKED_SUBSTRINGS) {
    const tokenPattern = new RegExp(`(^|[^A-Z])${bad}([^A-Z]|$)`);
    if (bad.length >= 4 ? compactAlpha.includes(bad) : tokenPattern.test(normalized)) {
      return {
        valid: false,
        normalized,
        error: 'Please enter a clean, player-friendly word or phrase.',
      };
    }
  }

  return { valid: true, normalized };
}

/**
 * Builds the classic Hangman token list.
 * Spaces and punctuation are ALWAYS visible from the beginning and excluded from letter completion counts.
 */
export function buildClassicClientView(
  answer: string,
  category: GuessItCategory,
  guessedLetters: Set<string>,
  revealFull: boolean,
  clue?: string
): GuessItClassicView {
  const normalized = normalizeGuessItText(answer);
  const tokens: GuessItClassicToken[] = [];
  let totalLetters = 0;
  let revealedLettersCount = 0;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === ' ') {
      tokens.push({ index: i, kind: 'space', char: ' ', revealed: true });
    } else if (isEnglishUpperLetter(ch)) {
      totalLetters++;
      const isShown = revealFull || guessedLetters.has(ch);
      if (isShown) revealedLettersCount++;
      tokens.push({
        index: i,
        kind: 'letter',
        char: isShown ? ch : null,
        revealed: isShown,
      });
    } else {
      // Supported punctuation shown immediately and never needs guessing
      tokens.push({ index: i, kind: 'punct', char: ch, revealed: true });
    }
  }

  return {
    format: 'classic',
    category,
    clue,
    tokens,
    totalLetters,
    revealedLettersCount,
    wordCount: countWords(normalized),
    answer: revealFull ? normalized : undefined,
  };
}

export function isClassicSolved(answer: string, guessedLetters: Set<string>): boolean {
  const required = extractUniqueLetters(answer);
  if (required.length === 0) return false;
  return required.every((l) => guessedLetters.has(l));
}

export function countOccurrencesInClassic(answer: string, letter: string): number {
  const upper = letter.toUpperCase();
  const norm = normalizeGuessItText(answer);
  let count = 0;
  for (const ch of norm) {
    if (ch === upper) count++;
  }
  return count;
}

export function computeAccuracyPercent(correctUnique: number, wrongUnique: number): number {
  const total = correctUnique + wrongUnique;
  if (total <= 0) return 100;
  return Math.round((correctUnique / total) * 100);
}

/**
 * Precision Clash deterministic scoring:
 * Prioritizes solving + accuracy, with remaining mistakes & completion speed as secondary bonuses.
 */
export function computePrecisionScore(params: {
  solved: boolean;
  correctUnique: number;
  wrongUnique: number;
  maxMistakes: number;
  completionTimeMs: number | null;
  roundTimeMs: number;
}): number {
  const acc = computeAccuracyPercent(params.correctUnique, params.wrongUnique);
  const solvedBonus = params.solved ? 1000 : 0;
  const accuracyScore = Math.round((acc / 100) * 600);
  const remainingMistakes = Math.max(0, params.maxMistakes - params.wrongUnique);
  const lifeBonus = params.solved ? remainingMistakes * 50 : 0;
  const timeBonus =
    params.solved && params.completionTimeMs !== null && params.roundTimeMs > 0
      ? Math.max(
          0,
          Math.min(
            250,
            Math.round(((params.roundTimeMs - params.completionTimeMs) / params.roundTimeMs) * 250)
          )
        )
      : 0;
  const partialProgress = params.solved ? 0 : params.correctUnique * 35;

  return Math.max(0, solvedBonus + accuracyScore + lifeBonus + timeBonus + partialProgress);
}

/**
 * Word Duel fair scoring:
 * Prevents cheesy wins from submitting impossible obscure words by rewarding solver accuracy,
 * speed, and granting creator points when opponent falls short WITHOUT outscoring a clean solve.
 */
export function computeWordDuelScore(params: {
  solved: boolean;
  correctUnique: number;
  wrongUnique: number;
  maxMistakes: number;
  completionTimeMs: number | null;
  roundTimeMs: number;
  opponentSolvedOnYourWord: boolean;
}): number {
  const solvePoints = computePrecisionScore({
    solved: params.solved,
    correctUnique: params.correctUnique,
    wrongUnique: params.wrongUnique,
    maxMistakes: params.maxMistakes,
    completionTimeMs: params.completionTimeMs,
    roundTimeMs: params.roundTimeMs,
  });
  const creatorDefenseBonus = params.opponentSolvedOnYourWord ? 0 : 180;
  return solvePoints + creatorDefenseBonus;
}
