export type TwistItWordLength = 3 | 4 | 5 | 6;
export type TwistItSoloDifficulty = 'easy' | 'normal' | 'hard';

export interface TwistItPuzzleDefinition {
  id: string;
  baseWord: string;
  letters: string[];
  answers: string[];
  difficulty: 'classic' | 'skilled';
}

export interface TwistItAnswerSlot {
  index: number;
  length: TwistItWordLength;
  revealed: boolean;
  word: string | null;
  foundAtMs?: number;
}

export type TwistItMode = 'solo' | 'race_1v1';

export type TwistItMatchStatus = 'countdown' | 'playing' | 'finished';

export type TwistItFinishReason =
  | 'completed_all'
  | 'timeout_lead'
  | 'timeout_letters_tiebreak'
  | 'timeout_draw'
  | 'forfeit';

export interface TwistItPlayerProgress {
  userId: string;
  displayName: string;
  avatarColor: string;
  foundCount: number;
  totalRequired: number;
  totalLettersFound: number;
  completionPercent: number;
  attemptsCount: number;
  validSubmissionsCount: number;
  accuracyPercent: number;
  completedAtMs: number | null;
  completionDurationMs: number | null;
  connected: boolean;
  /**
   * Populated ONLY for the viewing player during active play, and for both
   * players once the match status transitions to 'finished'.
   */
  slots?: TwistItAnswerSlot[];
}

export interface TwistItMatchView {
  id: string;
  roomCode: string | null;
  mode: TwistItMode;
  status: TwistItMatchStatus;
  puzzleId: string;
  scrambledLetters: string[];
  totalRequired: number;
  lengthCounts: Record<TwistItWordLength, number>;
  createdAtMs: number;
  startsAtMs: number;
  endsAtMs: number | null;
  finishedAtMs: number | null;
  serverNowMs: number;
  players: TwistItPlayerProgress[];
  selfSlots: TwistItAnswerSlot[];
  winnerIds: string[];
  isDraw: boolean;
  finishReason: TwistItFinishReason | null;
  personalBestDurationMs?: number | null;
  isNewPersonalBest?: boolean;
}

export type TwistItSubmitErrorCode =
  | 'MATCH_NOT_ACTIVE'
  | 'COUNTDOWN_ACTIVE'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'INVALID_LETTERS'
  | 'ALREADY_FOUND'
  | 'NOT_IN_PUZZLE';

export interface TwistItSubmitResult {
  accepted: boolean;
  normalizedWord: string;
  errorCode?: TwistItSubmitErrorCode;
  message: string;
  slotIndex?: number;
  completedPuzzle: boolean;
  match: TwistItMatchView;
}

export interface TwistItRoomSettings {
  isPublic: boolean;
  roundDurationSec: 120 | 180 | 240;
}

export interface TwistItRoomPlayer {
  userId: string;
  displayName: string;
  avatarColor: string;
  isHost: boolean;
  isReady: boolean;
  connected: boolean;
  joinedAt: string;
}

export interface TwistItRoomChatMessage {
  id: string;
  userId: string;
  displayName: string;
  message: string;
  createdAt: string;
}

export interface TwistItRoomView {
  code: string;
  hostUserId: string;
  status: 'lobby' | 'in_match';
  capacity: 2;
  settings: TwistItRoomSettings;
  players: TwistItRoomPlayer[];
  chat: TwistItRoomChatMessage[];
  activeMatchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TwistItSoloStats {
  completedPuzzlesCount: number;
  bestDurationMs: number | null;
  recentPuzzleIds: string[];
  bestByPuzzleId: Record<string, number>;
}
