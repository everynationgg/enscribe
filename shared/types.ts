export type GameModuleId = 'chain_clash';

export interface GameModuleDescriptor {
  id: GameModuleId;
  name: string;
  tagline: string;
  supportedModes: Array<'classic' | 'speed_race' | 'solo' | 'ranked'>;
  minPlayers: number;
  maxPlayers: number;
}

export interface EquippedCosmetics {
  tileSkin: string;
  boardSkin: string;
  backgroundTheme: string;
  chatBubbleStyle: string;
}

export interface Profile {
  id: string;
  username: string;
  avatarId: string;
  rankTier: string;
  rankPoints: number;
  wins: number;
  losses: number;
  matchPointsBalance: number;
  equippedCosmetics: EquippedCosmetics;
  createdAt: number;
}

export interface PointsEvent {
  id: string;
  playerId: string;
  matchId: string;
  gameType: GameModuleId;
  amount: number;
  reason: string;
  createdAt: number;
}

export interface MatchHistorySummary {
  matchId: string;
  gameType: GameModuleId;
  mode: ChainClashMode;
  opponentNames: string[];
  winnerId: string | null;
  didWin: boolean;
  finishedAt: number;
}

export interface InAppNotification {
  id: string;
  playerId: string;
  type: 'your_turn' | 'match_started' | 'match_finished' | 'room_update';
  title: string;
  body: string;
  matchId?: string;
  roomId?: string;
  read: boolean;
  createdAt: number;
}

export type TemplateStatus = 'saved' | 'draft' | 'official';

export type ThumbnailKey = 'school' | 'castle' | 'burger' | 'scifi' | 'myth' | 'horror' | 'nature' | 'custom';

export interface Template {
  id: string;
  ownerId: string;
  name: string;
  theme: string;
  thumbnailKey: ThumbnailKey;
  words: string[];
  status: TemplateStatus;
  createdAt: number;
  updatedAt: number;
}

export type ChainClashMode = 'classic' | 'speed_race' | 'solo' | 'ranked';
export type ChainVisibility = 'full_chain' | 'progressive';
export type OpponentVisibility = 'full_live' | 'words_only' | 'minimal';
export type PuzzleSource = 'saved_templates' | 'custom_create' | 'curated_db';

export interface RoomRules {
  gameType: GameModuleId;
  mode: 'classic' | 'speed_race';
  maxPlayers: number;
  chainLength: number;
  timePerWordSeconds: number;
  timerEnabled: boolean;
  puzzleSource: PuzzleSource;
  chainVisibility: ChainVisibility;
  wordLengthVisible: boolean;
  autoRevealAfterAttempts: number;
  autoRevealAfterPasses: number;
  opponentVisibility: OpponentVisibility;
  difficultyPreset: 'casual' | 'competitive' | 'custom';
  theme?: string;
}

export type PuzzlePrepStatus = 'none' | 'creating' | 'ready';

export interface RoomPlayer {
  playerId: string;
  username: string;
  avatarId: string;
  rankTier: string;
  isHost: boolean;
  isReady: boolean;
  puzzleStatus: PuzzlePrepStatus;
  submittedTemplateId: string | null;
  submittedTemplateName: string | null;
  hasCustomWords: boolean;
  isOnline: boolean;
}

export interface RoomMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  createdAt: number;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  isPublic: boolean;
  status: 'lobby' | 'in_progress' | 'completed';
  rules: RoomRules;
  activeMatchId: string | null;
  players: RoomPlayer[];
  messages: RoomMessage[];
  createdAt: number;
}

export interface SanitizedWordSlot {
  index: number;
  length: number;
  isCompleted: boolean;
  isActive: boolean;
  isUpcomingMasked: boolean;
  displayText: string;
  revealedLetters: number;
}

export interface ClientBoardState {
  playerId: string;
  username: string;
  avatarId: string;
  isWinner: boolean;
  isOnline: boolean;
  statusText: string;
  currentWordIndex: number;
  totalWords: number;
  words: SanitizedWordSlot[];
  liveInputPreview: string;
  completedAtMs: number | null;
  wrongAttemptsCurrentWord: number;
  passesCurrentWord: number;
  earnedMatchPoints: number;
}

export interface MatchChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  createdAt: number;
}

export interface FinishEntry {
  playerId: string;
  username: string;
  avatarId: string;
  completedAtMs: number;
  rank: number;
}

export interface MatchStateClient {
  id: string;
  roomId: string | null;
  gameType: GameModuleId;
  mode: ChainClashMode;
  title: string;
  theme?: string;
  status: 'opening' | 'active_turns' | 'finished';
  activeTurnPlayerId: string | null;
  turnOrder: string[];
  turnDeadlineMs: number | null;
  turnStartedAtMs: number | null;
  turnAwaitingOnline: boolean;
  speedRaceDeadlines: Record<string, number | null>;
  winnerId: string | null;
  finishOrder: FinishEntry[];
  rules: RoomRules;
  boards: Record<string, ClientBoardState>;
  messages: MatchChatMessage[];
  serverNowMs: number;
  isDemoSeed?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface OngoingMatchSummary {
  matchId: string;
  gameType: GameModuleId;
  mode: ChainClashMode;
  title: string;
  status: 'opening' | 'active_turns' | 'finished';
  isYourTurn: boolean;
  opponentNames: string[];
  opponentPrimaryName: string;
  progressLabel: string;
  updatedAt: number;
}

export interface SoloStage {
  id: string;
  theme: string;
  stageNumber: number;
  title: string;
  subtitle: string;
  thumbnailKey: ThumbnailKey;
  templateId: string;
  wordCount: number;
  completed: boolean;
}

export interface GuessResult {
  correct: boolean;
  wordCompleted: boolean;
  matchWon: boolean;
  revealedLetterAdded: boolean;
  message: string;
  match: MatchStateClient;
}
