export type ChangeItWordLength = 3 | 4 | 5 | 6;

export type ChangeItDifficulty =
  | 'beginner'
  | 'easy'
  | 'normal'
  | 'hard'
  | 'expert'
  | 'master';

export type ChangeItMultiplayerMode =
  | 'classic_sprint'
  | 'classic_precision'
  | 'tug_of_war'
  | 'survival'
  | 'restricted'
  | 'relay'
  | 'sabotage';

export type ChangeItMatchMode = 'solo_adventure' | ChangeItMultiplayerMode;

export type ChangeItModifierType =
  | 'letter_lock'
  | 'double_shift'
  | 'frozen_letter'
  | 'pathfinder'
  | 'reroute';

export type ChangeItTeamId = 'blue' | 'red';

export interface ChangeItRestriction {
  lockedPositions: number[];
  forbiddenLetters: string[];
  noConsecutiveSamePosition: boolean;
  nextMoveLockedPosition?: number | null;
}

export interface ChangeItMoveEntry {
  word: string;
  changedIndices: number[];
  timestampMs: number;
  playerId?: string;
  usedDoubleShift?: boolean;
}

export interface ChangeItActiveModifier {
  id: string;
  type: ChangeItModifierType;
  sourcePlayerId: string;
  targetPlayerId: string;
  activatedAtMs: number;
  expiresAtMs: number | null;
  remainingCharges: number | null;
  lockedIndex?: number | null;
  hintWord?: string | null;
  previousTarget?: string | null;
  newTarget?: string | null;
  description: string;
}

export interface ChangeItSelfBoardView {
  currentWord: string;
  startWord: string;
  targetWord: string;
  minMoves: number;
  history: ChangeItMoveEntry[];
  validMoves: number;
  invalidAttempts: number;
  elapsedMs: number;
  efficiencyPercent: number;
  completed: boolean;
  completedAtMs: number | null;
  forfeited: boolean;
  timedOut: boolean;
  hintsUsed: number;
  activeHintWord: string | null;
  restrictions: ChangeItRestriction;
  lastChangedIndex: number | null;
  heldModifiers: ChangeItModifierType[];
  modifierProgress: number;
  modifierCooldowns: Partial<Record<ChangeItModifierType, number>>;
  activeModifiers: ChangeItActiveModifier[];
  puzzlesCompleted: number;
  survivalScore: number;
  playerDeadlineMs: number | null;
}

export interface ChangeItOpponentSummaryView {
  playerId: string;
  username: string;
  avatarId: string;
  teamId: ChangeItTeamId | null;
  isOnline: boolean;
  validMoves: number;
  invalidAttempts: number;
  progressPercent: number;
  completed: boolean;
  completedAtMs: number | null;
  forfeited: boolean;
  timedOut: boolean;
  isWinner: boolean;
  puzzlesCompleted: number;
  survivalScore: number;
  efficiencyPercent: number;
  activeModifiers: Array<Omit<ChangeItActiveModifier, 'hintWord'>>;
  revealedHistory?: ChangeItMoveEntry[];
}

export interface ChangeItRelayTeamView {
  teamId: ChangeItTeamId;
  playerIds: string[];
  activeTurnPlayerId: string | null;
  turnDeadlineMs: number | null;
  currentWord: string | null;
  startWord: string | null;
  targetWord: string | null;
  minMoves: number;
  history?: ChangeItMoveEntry[];
  validMoves: number;
  invalidAttempts: number;
  progressPercent: number;
  completed: boolean;
  completedAtMs: number | null;
}

export interface ChangeItMatchChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  createdAt: number;
}

export interface ChangeItMatchStateClient {
  id: string;
  roomId: string | null;
  mode: ChangeItMatchMode;
  difficulty: ChangeItDifficulty;
  wordLength: ChangeItWordLength;
  isRanked: boolean;
  modifiersEnabled: boolean;
  hintsAllowed: boolean;
  status: 'playing' | 'finished';
  startedAtMs: number;
  endsAtMs: number;
  serverNowMs: number;
  stageId?: string | null;
  chapterId?: string | null;
  stageTitle?: string | null;
  self: ChangeItSelfBoardView;
  opponents: ChangeItOpponentSummaryView[];
  relayTeams?: {
    blue: ChangeItRelayTeamView;
    red: ChangeItRelayTeamView;
  } | null;
  winnerIds: string[];
  winningTeamId: ChangeItTeamId | null;
  finishReason: string | null;
  ratingChanges?: Record<string, { before: number; after: number; delta: number; tier: string }>;
  messages: ChangeItMatchChatMessage[];
}

export interface ChangeItTransformResponse {
  accepted: boolean;
  errorCode?: string;
  message: string;
  completedPuzzle: boolean;
  changedIndices: number[];
  usedDoubleShift: boolean;
  match: ChangeItMatchStateClient;
}

export interface ChangeItModifierResponse {
  activated: boolean;
  message: string;
  match: ChangeItMatchStateClient;
}

export interface ChangeItRoomSettings {
  mode: ChangeItMultiplayerMode;
  difficulty: ChangeItDifficulty;
  wordLength: ChangeItWordLength | 'auto';
  timeLimitSeconds: number;
  maxPlayers: number;
  isPublic: boolean;
  modifiersEnabled: boolean;
  hintsAllowed: boolean;
  relayTurnSeconds: number;
}

export interface ChangeItRoomParticipant {
  playerId: string;
  username: string;
  avatarId: string;
  rankTier: string;
  isHost: boolean;
  isReady: boolean;
  isOnline: boolean;
  teamId: ChangeItTeamId;
}

export interface ChangeItRoomMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  createdAt: number;
}

export interface ChangeItCustomPuzzleSummary {
  startWord: string;
  targetWord: string;
  minMoves: number;
  wordLength: ChangeItWordLength;
  familiarPathAvailable: boolean;
}

export interface ChangeItRoom {
  id: string;
  code: string;
  name: string;
  hostId: string;
  status: 'lobby' | 'in_progress' | 'completed';
  settings: ChangeItRoomSettings;
  players: ChangeItRoomParticipant[];
  messages: ChangeItRoomMessage[];
  activeMatchId: string | null;
  customPuzzle: ChangeItCustomPuzzleSummary | null;
  createdAt: number;
  updatedAt: number;
}

export interface ChangeItCustomPuzzleValidation {
  valid: boolean;
  startWord: string;
  targetWord: string;
  wordLength: number;
  minMoves: number | null;
  familiarPathAvailable: boolean;
  error?: string;
}

export interface ChangeItAdventureStageDefinition {
  id: string;
  chapterId: string;
  stageNumber: number;
  label: string;
  title: string;
  subtitle: string;
  startWord: string;
  targetWord: string;
  wordLength: ChangeItWordLength;
  minMoves: number;
  difficulty: ChangeItDifficulty;
  rewardCoins: number;
  isFinale?: boolean;
}

export interface ChangeItAdventureStageClient extends ChangeItAdventureStageDefinition {
  unlocked: boolean;
  completed: boolean;
  bestStars: number;
  fewestMoves: number | null;
  bestTimeMs: number | null;
  rewardClaimed: boolean;
}

export interface ChangeItAdventureChapterDefinition {
  id: string;
  chapterNumber: number;
  title: string;
  theme: string;
  description: string;
  accentGradient: string;
  stages: ChangeItAdventureStageDefinition[];
}

export interface ChangeItAdventureChapterClient {
  id: string;
  chapterNumber: number;
  title: string;
  theme: string;
  description: string;
  accentGradient: string;
  earnedStars: number;
  totalStars: number;
  unlocked: boolean;
  stages: ChangeItAdventureStageClient[];
}

export interface ChangeItAdventureProgressClient {
  playerId: string;
  totalStars: number;
  maxStars: number;
  completedCount: number;
  totalStages: number;
  chapters: ChangeItAdventureChapterClient[];
}

export interface ChangeItAdventureClaimResult {
  claimed: boolean;
  alreadyClaimed: boolean;
  starsEarned: number;
  movesUsed: number;
  minMoves: number;
  hintsUsed: number;
  elapsedMs: number;
  coinsAwarded: number;
  newCoinsBalance: number;
  progress: ChangeItAdventureProgressClient;
}

export interface ChangeItLeaderboardEntry {
  playerId: string;
  username: string;
  avatarId: string;
  isGuest: boolean;
  rating: number;
  rankTier: string;
  rankedWins: number;
  rankedLosses: number;
  rankedDraws: number;
  matchesPlayed: number;
  totalWins: number;
  puzzlesSolved: number;
  bestEfficiency: number;
  fastestSolveMs: number | null;
}

export interface ChangeItMatchHistoryEntry {
  matchId: string;
  mode: ChangeItMatchMode;
  isRanked: boolean;
  winnerIds: string[];
  didWin: boolean;
  opponentNames: string[];
  validMoves?: number;
  minMoves?: number;
  createdAt: number;
}

export interface ChangeItLeaderboardResponse {
  rankedLeaders: ChangeItLeaderboardEntry[];
  overallLeaders: ChangeItLeaderboardEntry[];
  playerStats: ChangeItLeaderboardEntry | null;
  recentHistory: ChangeItMatchHistoryEntry[];
  guestNotice: string;
}
