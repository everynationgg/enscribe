export type GuessItMode =
  | 'speed_rush'
  | 'word_duel'
  | 'precision_clash'
  | 'survival_royale'
  | 'team_relay'
  | 'solo_adventure';

export type GuessItMultiplayerMode = Exclude<GuessItMode, 'solo_adventure'>;

export type GuessItPuzzleFormat = 'classic' | 'crossword';

export type GuessItCategory =
  | 'Movies'
  | 'Animals'
  | 'Food'
  | 'Science'
  | 'Geography'
  | 'Gaming'
  | 'History'
  | 'General Knowledge';

export type GuessItDifficulty = 'easy' | 'medium' | 'hard';

export type GuessItWordSource = 'curated_db' | 'my_templates' | 'custom_word';

export type GuessItContentSource = 'curated' | 'ai_validated' | 'player_custom';

export type GuessItValidationStatus = 'approved' | 'pending' | 'rejected';

export type GuessItTeamId = 'blue' | 'red';

export interface GuessItWordEntry {
  id: string;
  answer: string;
  category: GuessItCategory;
  difficulty: GuessItDifficulty;
  language: string;
  wordCount: number;
  letterCount: number;
  clue?: string;
  contentSource: GuessItContentSource;
  validationStatus: GuessItValidationStatus;
  rankedEligible: boolean;
  adventureEligible: boolean;
  chapterId?: string;
}

export interface GuessItClassicToken {
  index: number;
  kind: 'letter' | 'space' | 'punct';
  /** Exposed only when revealed (or always true for space/punct) */
  char: string | null;
  revealed: boolean;
}

export interface GuessItClassicView {
  format: 'classic';
  category: GuessItCategory;
  clue?: string;
  tokens: GuessItClassicToken[];
  totalLetters: number;
  revealedLettersCount: number;
  wordCount: number;
  /** Revealed only after round/puzzle ends */
  answer?: string;
}

export interface GuessItCrosswordEntryPlacement {
  entryId: string;
  answer: string;
  direction: 'across' | 'down';
  row: number;
  col: number;
  length: number;
}

export interface GuessItCrosswordCell {
  row: number;
  col: number;
  kind: 'letter' | 'space' | 'punct';
  letter: string | null;
  entryIds: string[];
  isIntersection: boolean;
}

export interface GuessItCrosswordLayout {
  rows: number;
  cols: number;
  entries: GuessItCrosswordEntryPlacement[];
  cells: GuessItCrosswordCell[];
  totalLetters: number;
  uniqueLetters: string[];
}

export interface GuessItCrosswordCellView {
  row: number;
  col: number;
  kind: 'letter' | 'space' | 'punct';
  char: string | null;
  revealed: boolean;
  isIntersection: boolean;
  entryIds: string[];
}

export interface GuessItCrosswordView {
  format: 'crossword';
  category: GuessItCategory;
  rows: number;
  cols: number;
  cells: GuessItCrosswordCellView[];
  totalLetters: number;
  revealedLettersCount: number;
  entryCount: number;
  /** Exposed only once puzzle/round finishes */
  solvedAnswers?: string[];
}

export type GuessItPuzzleClientView = GuessItClassicView | GuessItCrosswordView;

export interface GuessItRoomSettings {
  mode: GuessItMultiplayerMode;
  format: GuessItPuzzleFormat;
  category: GuessItCategory;
  difficulty: GuessItDifficulty;
  wordSource: GuessItWordSource;
  roundsCount: number;
  maxMistakes: number;
  roundTimeSeconds: number;
  penaltyMs: number;
  capacity: number;
  isPublic: boolean;
}

export interface GuessItRoomPlayer {
  playerId: string;
  username: string;
  avatarId: string;
  rankTier: string;
  isHost: boolean;
  isReady: boolean;
  teamId: GuessItTeamId | null;
  duelChallengeReady: boolean;
  duelCategory: GuessItCategory | null;
  duelClue?: string | null;
  isOnline: boolean;
  joinedAt: number;
}

export interface GuessItRoomMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  createdAt: number;
}

export interface GuessItRoom {
  id: string;
  code: string;
  name: string;
  hostId: string;
  isPublic: boolean;
  status: 'lobby' | 'in_progress' | 'completed';
  settings: GuessItRoomSettings;
  activeMatchId: string | null;
  players: GuessItRoomPlayer[];
  messages: GuessItRoomMessage[];
  createdAt: number;
}

export interface GuessItParticipantClient {
  playerId: string;
  username: string;
  avatarId: string;
  teamId: GuessItTeamId | null;
  score: number;
  roundsWon: number;
  isWinner: boolean;
  isEliminated: boolean;
  isOnline: boolean;
  /** Progress for the viewer's own / opposing HUD */
  correctLetters: string[];
  wrongLetters: string[];
  guessedLetters: string[];
  wrongCount: number;
  maxMistakes: number;
  penaltyUntilMs: number | null;
  puzzleSolved: boolean;
  puzzleFailed: boolean;
  completionTimeMs: number | null;
  accuracyPercent: number;
  revealedRatio: number;
  activeTurnPlayerId: string | null;
  /** Always populated for the viewer (or viewer's team); summary only for opponents until round finishes */
  puzzle: GuessItPuzzleClientView | null;
}

export interface GuessItRoundSummary {
  roundIndex: number;
  category: GuessItCategory;
  format: GuessItPuzzleFormat;
  revealedAnswers: string[];
  winnerIds: string[];
  winningTeamId: GuessItTeamId | null;
  endedAtMs: number;
}

export interface GuessItMatchStateClient {
  id: string;
  roomId: string | null;
  mode: GuessItMode;
  format: GuessItPuzzleFormat;
  isRanked: boolean;
  status: 'countdown' | 'playing' | 'round_over' | 'finished';
  roundIndex: number;
  totalRounds: number;
  category: GuessItCategory;
  difficulty: GuessItDifficulty;
  roundStartedAtMs: number;
  roundEndsAtMs: number;
  penaltyDurationMs: number;
  serverNowMs: number;
  settings: GuessItRoomSettings;
  viewerPlayerId: string;
  viewerIsSpectator: boolean;
  viewerTeamId: GuessItTeamId | null;
  participants: Record<string, GuessItParticipantClient>;
  participantOrder: string[];
  teamScores: { blue: number; red: number };
  teamActivePlayerIds: { blue: string | null; red: string | null };
  survivorIds: string[];
  winnerIds: string[];
  winningTeamId: GuessItTeamId | null;
  roundSummaries: GuessItRoundSummary[];
  messages: GuessItRoomMessage[];
  stageId?: string | null;
  chapterId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface GuessItGuessResponse {
  accepted: boolean;
  correct: boolean;
  letter: string;
  occurrencesRevealed: number;
  puzzleSolved: boolean;
  roundEnded: boolean;
  matchEnded: boolean;
  penaltyUntilMs: number | null;
  handoffToPlayerId?: string | null;
  message: string;
  match: GuessItMatchStateClient;
}

export interface GuessItAdventureStage {
  id: string;
  chapterId: string;
  stageNumber: number;
  label: string;
  title: string;
  subtitle: string;
  format: GuessItPuzzleFormat;
  category: GuessItCategory;
  difficulty: GuessItDifficulty;
  maxMistakes: number;
  timeLimitSeconds: number;
  penaltyMs: number;
  isFinale?: boolean;
  /** Server-only puzzle data during matchmaking; sanitized out in API summaries if needed */
  answers: string[];
  clue: string;
  rewardExp: number;
  rewardCoins: number;
  rewardShards: number;
}

export interface GuessItAdventureChapter {
  id: string;
  chapterNumber: number;
  title: string;
  theme: string;
  description: string;
  mascotQuote: string;
  completionBonusCoins: number;
  completionBonusExp: number;
  stages: GuessItAdventureStage[];
}

export interface GuessItAdventureStageProgress {
  stageId: string;
  unlocked: boolean;
  completed: boolean;
  bestStars: number;
  bestAccuracy: number;
  bestTimeMs: number | null;
  rewardClaimed: boolean;
}

export interface GuessItAdventureChapterClient {
  id: string;
  chapterNumber: number;
  title: string;
  theme: string;
  description: string;
  mascotQuote: string;
  totalStages: number;
  completedStages: number;
  totalStars: number;
  earnedStars: number;
  stages: Array<
    Omit<GuessItAdventureStage, 'answers'> & {
      progress: GuessItAdventureStageProgress;
    }
  >;
}

export interface GuessItAdventureProgressClient {
  chapters: GuessItAdventureChapterClient[];
  totalCoinsEarned: number;
  totalShards: number;
  totalExp: number;
}

export interface GuessItAdventureClaimResult {
  claimed: boolean;
  alreadyClaimed: boolean;
  stars: number;
  expAwarded: number;
  coinsAwarded: number;
  shardsAwarded: number;
  chapterCompletedCount: number;
  chapterTotalStages: number;
  newCoinsBalance: number;
  newRankPoints: number;
  progress: GuessItAdventureProgressClient;
}
