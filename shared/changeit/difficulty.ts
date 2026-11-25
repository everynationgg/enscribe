import { ChangeItDifficulty, ChangeItWordLength } from './types.js';

export interface ChangeItDifficultyRule {
  id: ChangeItDifficulty;
  label: string;
  description: string;
  wordLengths: ChangeItWordLength[];
  minMoves: number;
  maxMoves: number;
  /** Maximum allowed delta between familiar Puzzle Vocabulary optimal path and Validation optimal path */
  maxFamiliarSlack: number;
  defaultTimeLimitSeconds: number;
}

export const DIFFICULTY_CONFIGS: Record<ChangeItDifficulty, ChangeItDifficultyRule> = {
  beginner: {
    id: 'beginner',
    label: 'Beginner',
    description: '3-letter words • 2–3 transformations',
    wordLengths: [3],
    minMoves: 2,
    maxMoves: 3,
    maxFamiliarSlack: 0,
    defaultTimeLimitSeconds: 90,
  },
  easy: {
    id: 'easy',
    label: 'Easy',
    description: '4-letter words • 2–4 transformations',
    wordLengths: [4],
    minMoves: 2,
    maxMoves: 4,
    maxFamiliarSlack: 0,
    defaultTimeLimitSeconds: 120,
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    description: '4-letter words • 5–6 transformations',
    wordLengths: [4],
    minMoves: 5,
    maxMoves: 6,
    maxFamiliarSlack: 0,
    defaultTimeLimitSeconds: 150,
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    description: '4-letter words • 7–9 transformations',
    wordLengths: [4],
    minMoves: 7,
    maxMoves: 9,
    maxFamiliarSlack: 1,
    defaultTimeLimitSeconds: 180,
  },
  expert: {
    id: 'expert',
    label: 'Expert',
    description: '5-letter words • 5–8 transformations',
    wordLengths: [5],
    minMoves: 5,
    maxMoves: 8,
    maxFamiliarSlack: 0,
    defaultTimeLimitSeconds: 210,
  },
  master: {
    id: 'master',
    label: 'Master',
    description: '5–6 letter words • 9+ transformations',
    wordLengths: [5, 6],
    minMoves: 9,
    maxMoves: 14,
    maxFamiliarSlack: 1,
    defaultTimeLimitSeconds: 240,
  },
};

export const CHANGEIT_DIFFICULTY_ORDER: ChangeItDifficulty[] = [
  'beginner',
  'easy',
  'normal',
  'hard',
  'expert',
  'master',
];
