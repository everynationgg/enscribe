import {
  EquippedCosmetics,
  FinishEntry,
  GameModuleId,
  InAppNotification,
  MatchChatMessage,
  MatchHistorySummary,
  PointsEvent,
  Profile,
  PuzzlePrepStatus,
  Room,
  RoomMessage,
  RoomRules,
  Template,
} from '../../shared/types.js';

export interface StoredMatchBoard {
  matchId: string;
  playerId: string;
  authorPlayerId: string | null;
  words: string[];
  currentWordIndex: number;
  revealedCounts: number[];
  wrongAttemptsCurrentWord: number;
  passesCurrentWord: number;
  completedAtMs: number | null;
  liveInputPreview: string;
  earnedMatchPoints: number;
}

export interface StoredMatch {
  id: string;
  roomId: string | null;
  gameType: GameModuleId;
  mode: 'classic' | 'speed_race' | 'solo' | 'ranked';
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
  isDemoSeed: boolean;
  createdAt: number;
  updatedAt: number;
  boards: Record<string, StoredMatchBoard>;
  messages: MatchChatMessage[];
}

export interface StorageRepository {
  runInTransaction<T>(fn: () => T): T;
  setOnlineTracker(fn: (playerId: string) => boolean): void;
  // Profiles
  listProfiles(): Profile[];
  getProfile(id: string): Profile | null;
  upsertProfile(profile: Profile): Profile;
  updateProfileStats(
    playerId: string,
    delta: { wins?: number; losses?: number; rankPointsDelta?: number; matchPointsDelta?: number }
  ): Profile | null;
  updateCosmetics(playerId: string, cosmetics: EquippedCosmetics): Profile | null;
  // Templates
  listTemplates(ownerId?: string): Template[];
  getTemplate(id: string): Template | null;
  saveTemplate(tpl: Template): Template;
  deleteTemplate(id: string): boolean;
  // Rooms
  listPublicRooms(): Room[];
  getRoomById(id: string): Room | null;
  getRoomByCode(code: string): Room | null;
  createRoom(room: {
    id: string;
    code: string;
    name: string;
    hostId: string;
    isPublic: boolean;
    rules: RoomRules;
    createdAt: number;
  }): Room;
  updateRoomRules(roomId: string, rules: RoomRules): void;
  updateRoomStatus(roomId: string, status: 'lobby' | 'in_progress' | 'completed', activeMatchId: string | null): void;
  upsertRoomPlayer(
    roomId: string,
    playerId: string,
    fields: Partial<{
      isReady: boolean;
      puzzleStatus: PuzzlePrepStatus;
      submittedTemplateId: string | null;
      submittedWords: string[] | null;
    }>
  ): void;
  removeRoomPlayer(roomId: string, playerId: string): void;
  deleteRoom(roomId: string): void;
  addRoomMessage(msg: RoomMessage): void;
  getRoomPlayerSubmissions(roomId: string): Array<{
    playerId: string;
    submittedTemplateId: string | null;
    submittedWords: string[] | null;
  }>;
  // Matches
  getMatch(id: string): StoredMatch | null;
  listMatchesForPlayer(playerId: string): StoredMatch[];
  listActiveTimedMatches(): StoredMatch[];
  saveMatch(match: StoredMatch): void;
  updateMatchBoard(board: StoredMatchBoard): void;
  addMatchMessage(msg: MatchChatMessage): void;
  recordPointsEvent(evt: PointsEvent): void;
  listMatchHistory(playerId: string): MatchHistorySummary[];
  // Notifications
  addNotification(notif: InAppNotification): void;
  listNotifications(playerId: string): InAppNotification[];
  markNotificationsRead(playerId: string): void;
  // Solo Adventure
  getCompletedSoloStages(playerId: string): string[];
  markSoloStageCompleted(playerId: string, stageId: string): void;
}

export function computeRankTier(rp: number): string {
  if (rp >= 1800) return 'Diamond I';
  if (rp >= 1600) return 'Platinum II';
  if (rp >= 1450) return 'Platinum I';
  if (rp >= 1350) return 'Gold I';
  if (rp >= 1200) return 'Gold II';
  if (rp >= 1080) return 'Gold III';
  if (rp >= 950) return 'Silver I';
  if (rp >= 800) return 'Silver II';
  return 'Bronze I';
}
