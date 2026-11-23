import { GridItBoardSize, GridItShapeId } from './types.js';
import { GridItModConfig, GridItModSchedule } from './mods.js';
import { BoardFairnessComparison, BoardFairnessReport } from './fairness.js';
import { GridItBoard, GridItFoundWord } from './types.js';

export type GridItMatchMode = 'classic' | 'board_battle' | 'ranked';
export type GridItRoomStatus = 'waiting' | 'in_progress' | 'finished';

export interface GridItRoomSettings {
  mode: GridItMatchMode;
  shapeId: GridItShapeId;
  sizeId: GridItBoardSize;
  durationSeconds: number;
  language: string;
  capacity: number;
  isPublic: boolean;
  allowSpectators: boolean;
  mods: GridItModConfig;
}

export interface GridItRoomParticipant {
  playerId: string;
  username: string;
  avatarId: string;
  isReady: boolean;
  isHost: boolean;
  isOnline: boolean;
  battleTemplateReady: boolean;
  battleTemplateSummary?: {
    name: string;
    shapeId: GridItShapeId;
    sizeId: GridItBoardSize;
    wordCount: number;
    fairnessGrade?: BoardFairnessReport['grade'];
  } | null;
}

export interface GridItSpectator {
  playerId: string;
  username: string;
  avatarId: string;
  joinedAt: number;
}

export interface GridItChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  kind: 'chat' | 'emoji';
  createdAt: number;
}

export interface GridItRoom {
  id: string;
  code: string;
  name: string;
  hostId: string;
  status: GridItRoomStatus;
  settings: GridItRoomSettings;
  players: GridItRoomParticipant[];
  spectators: GridItSpectator[];
  messages: GridItChatMessage[];
  activeMatchId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface GridItMatchPlayerClient {
  playerId: string;
  username: string;
  avatarId: string;
  isOnline: boolean;
  score: number;
  rawScore: number;
  normalizedScorePercent: number;
  wordsFoundCount: number;
  bestWord: GridItFoundWord | null;
  comboCount: number;
  isWinner: boolean;
  foundWords: GridItFoundWord[];
  assignedBoardFairness?: BoardFairnessReport | null;
  authoredByName?: string | null;
  quotaValidationPassed?: boolean;
}

export interface GridItMatchStateClient {
  id: string;
  roomId: string | null;
  hostPlayerId?: string | null;
  mode: GridItMatchMode;
  status: 'shaking' | 'active' | 'finished';
  settings: GridItRoomSettings;
  serverNowMs: number;
  revealAtMs: number;
  startedAtMs: number;
  endsAtMs: number;
  viewerRole: 'player' | 'spectator';
  spectatingPlayerId?: string | null;
  /** Strictly ONLY the viewer's own board (hidden prior to revealAtMs) */
  board: GridItBoard | null;
  schedule: GridItModSchedule | null;
  players: Record<string, GridItMatchPlayerClient>;
  spectators: GridItSpectator[];
  winnerIds: string[];
  fairnessComparison?: BoardFairnessComparison | null;
  messages: GridItChatMessage[];
}

export interface GridItMatchPlayerDeltaSummary {
  playerId: string;
  username: string;
  avatarId: string;
  isOnline: boolean;
  score: number;
  rawScore: number;
  normalizedScorePercent: number;
  wordsFoundCount: number;
  bestWord: GridItFoundWord | null;
  comboCount: number;
  isWinner: boolean;
}

export interface GridItMatchDelta {
  id: string;
  status: 'shaking' | 'active' | 'finished';
  serverNowMs: number;
  endsAtMs: number;
  players: Record<string, GridItMatchPlayerDeltaSummary>;
  spectators: GridItSpectator[];
  winnerIds: string[];
  messages: GridItChatMessage[];
}

export interface GridItSessionLeaderboardEntry {
  playerId: string;
  username: string;
  avatarId: string;
  matchesPlayed: number;
  wins: number;
  highScore: number;
  bestWord: string | null;
  isGuest: boolean;
}
