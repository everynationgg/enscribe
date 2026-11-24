import { Capacitor } from '@capacitor/core';
import {
  EquippedCosmetics,
  GameModuleDescriptor,
  GridItChatMessage,
  GridItMatchStateClient,
  GridItRoom,
  GridItRoomSettings,
  GridItSessionLeaderboardEntry,
  GuessResult,
  GuestSession,
  InAppNotification,
  MatchChatMessage,
  MatchHistorySummary,
  MatchStateClient,
  ModWordValidationResult,
  OngoingMatchSummary,
  Profile,
  Room,
  RoomRules,
  SoloStage,
  Template,
  ThumbnailKey,
} from '../../shared/types';
import { GridItCustomTemplate } from '../../shared/gridit/editor';
import {
  GuessItAdventureClaimResult,
  GuessItAdventureProgressClient,
  GuessItCategory,
  GuessItDifficulty,
  GuessItGuessResponse,
  GuessItMatchStateClient,
  GuessItRoom,
  GuessItRoomSettings,
  GuessItTeamId,
} from '../../shared/guessit/types';
import {
  TwistItMatchView,
  TwistItRoomSettings,
  TwistItRoomView,
  TwistItSoloStats,
  TwistItSubmitResult,
} from '../../shared/twistit/types';

const DEFAULT_PROD_API_BASE_URL = 'https://enscribe-game.fly.dev';
const envApiBase = (
  (import.meta as any).env?.VITE_API_BASE_URL ||
  (import.meta as any).env?.VITE_GAME_SERVER_URL ||
  ''
).trim();
const isLocalBrowser =
  !Capacitor.isNativePlatform() &&
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
export const API_BASE_URL = (
  envApiBase || (isLocalBrowser ? '' : DEFAULT_PROD_API_BASE_URL)
).replace(/\/+$/, '');

let activeGuestSessionToken: string | null = null;

export function setGuestSessionToken(token: string | null): void {
  activeGuestSessionToken = token && token.trim() ? token.trim() : null;
}

export function getGuestSessionToken(): string | null {
  return activeGuestSessionToken;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const resolvedUrl = /^https?:\/\//i.test(url) ? url : `${API_BASE_URL}${url}`;
  const guestHeaders: Record<string, string> = activeGuestSessionToken
    ? { 'x-guest-session-token': activeGuestSessionToken }
    : {};
  const res = await fetch(resolvedUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...guestHeaders,
      ...(options?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getHealth: () =>
    request<{
      ok: boolean;
      platform: string;
      guestStoreBackend?: string;
      games: GameModuleDescriptor[];
    }>('/api/health'),
  getGames: () => request<GameModuleDescriptor[]>('/api/games'),
  claimGuestNickname: (nickname: string, avatarId: string, sessionToken?: string | null) =>
    request<{ session: GuestSession; profile: Profile }>('/api/guest/claim', {
      method: 'POST',
      body: JSON.stringify({ nickname, avatarId, sessionToken: sessionToken || undefined }),
    }),
  heartbeatGuestSession: (sessionToken: string) =>
    request<{ session: GuestSession; profile: Profile }>('/api/guest/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ sessionToken }),
    }),
  getGuestSession: (sessionToken: string) =>
    request<{ session: GuestSession; profile: Profile }>(
      `/api/guest/session?sessionToken=${encodeURIComponent(sessionToken)}`
    ),
  renameGuestSession: (sessionToken: string, nickname: string, avatarId: string) =>
    request<{ session: GuestSession; profile: Profile }>('/api/guest/rename', {
      method: 'POST',
      body: JSON.stringify({ sessionToken, nickname, avatarId }),
    }),
  releaseGuestSession: (sessionToken: string) =>
    request<{ ok: boolean }>('/api/guest/release', {
      method: 'POST',
      body: JSON.stringify({ sessionToken }),
    }),
  getBootstrap: (playerId: string) =>
    request<{
      profile: Profile;
      history: MatchHistorySummary[];
      templates: Template[];
      ongoingMatches: OngoingMatchSummary[];
      publicRooms: Room[];
      soloStages: SoloStage[];
      notifications: InAppNotification[];
    }>(`/api/bootstrap/${encodeURIComponent(playerId)}`),
  signIn: (username: string, avatarId: string) =>
    request<{ profile: Profile; isNew: boolean }>('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ username, avatarId }),
    }),
  listProfiles: () => request<Profile[]>('/api/profiles'),
  getProfileDetail: (id: string) =>
    request<{ profile: Profile; history: MatchHistorySummary[] }>(`/api/profiles/${id}`),
  createProfile: (username: string, avatarId: string) =>
    request<Profile>('/api/profiles', {
      method: 'POST',
      body: JSON.stringify({ username, avatarId }),
    }),
  updateProfile: (id: string, data: { username?: string; avatarId?: string }) =>
    request<Profile>(`/api/profiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  updateCosmetics: (id: string, cosmetics: EquippedCosmetics) =>
    request<Profile>(`/api/profiles/${id}/cosmetics`, {
      method: 'PATCH',
      body: JSON.stringify(cosmetics),
    }),

  listNotifications: (playerId: string) =>
    request<InAppNotification[]>(`/api/notifications/${playerId}`),
  markNotificationsRead: (playerId: string) =>
    request<{ ok: boolean }>(`/api/notifications/${playerId}/read`, { method: 'POST' }),

  listTemplates: (ownerId?: string) =>
    request<Template[]>(`/api/templates${ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : ''}`),
  saveTemplate: (tpl: {
    id?: string;
    ownerId: string;
    name: string;
    theme: string;
    thumbnailKey: ThumbnailKey;
    words: string[];
    status: 'saved' | 'draft';
  }) =>
    request<Template>('/api/templates', {
      method: 'POST',
      body: JSON.stringify(tpl),
    }),
  duplicateTemplate: (id: string, ownerId: string) =>
    request<Template>(`/api/templates/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ ownerId }),
    }),
  deleteTemplate: (id: string) =>
    request<{ ok: boolean }>(`/api/templates/${id}`, { method: 'DELETE' }),
  generateChain: (theme: string, length: number, excludeWords?: string[]) =>
    request<{ name: string; theme: string; words: string[] }>('/api/ai/generate-chain', {
      method: 'POST',
      body: JSON.stringify({ theme, length, excludeWords }),
    }),

  listPublicRooms: () => request<Room[]>('/api/rooms/public'),
  getRoom: (idOrCode: string) => request<Room>(`/api/rooms/${encodeURIComponent(idOrCode)}`),
  createRoom: (data: { hostId: string; name: string; isPublic: boolean; rules?: Partial<RoomRules> }) =>
    request<Room>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  joinRoom: (codeOrId: string, playerId: string) =>
    request<Room>('/api/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ codeOrId, playerId }),
    }),
  leaveRoom: (roomId: string, playerId: string) =>
    request<{ ok: boolean }>(`/api/rooms/${roomId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),
  updateRoomRules: (roomId: string, playerId: string, rules: Partial<RoomRules>) =>
    request<Room>(`/api/rooms/${roomId}/rules`, {
      method: 'PATCH',
      body: JSON.stringify({ playerId, rules }),
    }),
  submitRoomPuzzle: (
    roomId: string,
    playerId: string,
    payload: { templateId?: string | null; customWords?: string[] | null; puzzleStatus?: 'none' | 'creating' | 'ready' }
  ) =>
    request<Room>(`/api/rooms/${roomId}/puzzle`, {
      method: 'POST',
      body: JSON.stringify({ playerId, ...payload }),
    }),
  setRoomReady: (roomId: string, playerId: string, isReady: boolean) =>
    request<Room>(`/api/rooms/${roomId}/ready`, {
      method: 'POST',
      body: JSON.stringify({ playerId, isReady }),
    }),
  sendRoomChat: (roomId: string, playerId: string, text: string) =>
    request<Room>(`/api/rooms/${roomId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ playerId, text }),
    }),
  startRoomMatch: (roomId: string, playerId: string) =>
    request<{ room: Room; match: MatchStateClient }>(`/api/rooms/${roomId}/start`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),

  quickPlay: (playerId: string) =>
    request<{ status: string; room: Room }>('/api/matchmaking/quick-play', {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),
  joinRankedQueue: (playerId: string) =>
    request<{ status: string; matchId?: string; message?: string }>('/api/matchmaking/ranked', {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),
  leaveRankedQueue: (playerId: string) =>
    request<{ ok: boolean }>(`/api/matchmaking/ranked/${playerId}`, { method: 'DELETE' }),

  listSoloStages: (playerId: string) => request<SoloStage[]>(`/api/solo/stages/${playerId}`),
  startSoloMatch: (playerId: string, params: { stageId?: string; templateId?: string }) =>
    request<{ stageId: string | null; match: MatchStateClient }>('/api/solo/start', {
      method: 'POST',
      body: JSON.stringify({ playerId, ...params }),
    }),

  listOngoingMatches: (playerId: string) =>
    request<OngoingMatchSummary[]>(`/api/matches/ongoing/${playerId}`),
  getMatch: (matchId: string, playerId: string) =>
    request<MatchStateClient>(`/api/matches/${matchId}?playerId=${encodeURIComponent(playerId)}`),
  tickMatch: (matchId: string, playerId: string) =>
    request<MatchStateClient>(`/api/matches/${matchId}/tick`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),
  submitGuess: (matchId: string, playerId: string, guess: string, soloStageId?: string | null) =>
    request<GuessResult>(`/api/matches/${matchId}/guess`, {
      method: 'POST',
      body: JSON.stringify({ playerId, guess, soloStageId }),
    }),
  passTurn: (matchId: string, playerId: string) =>
    request<MatchStateClient>(`/api/matches/${matchId}/pass`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),
  sendMatchChat: (matchId: string, playerId: string, text: string) =>
    request<MatchChatMessage>(`/api/matches/${matchId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ playerId, text }),
    }),
  rematch: (matchId: string, playerId: string) =>
    request<MatchStateClient>(`/api/matches/${matchId}/rematch`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),

  // ==================== GRIDIT MULTIPLAYER & BOARD BATTLE ====================
  listGridItPublicRooms: () => request<GridItRoom[]>('/api/gridit/rooms/public'),
  getGridItRoom: (idOrCode: string) =>
    request<GridItRoom>(`/api/gridit/rooms/${encodeURIComponent(idOrCode)}`),
  createGridItRoom: (data: {
    hostId: string;
    name?: string;
    settings?: Partial<GridItRoomSettings>;
  }) =>
    request<GridItRoom>('/api/gridit/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  joinGridItRoom: (codeOrId: string, playerId: string, asSpectator = false) =>
    request<{ room: GridItRoom; joinedAs: 'player' | 'spectator' }>('/api/gridit/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ codeOrId, playerId, asSpectator }),
    }),
  leaveGridItRoom: (roomId: string, playerId: string) =>
    request<{ ok: boolean }>(`/api/gridit/rooms/${roomId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),
  updateGridItRoomSettings: (
    roomId: string,
    playerId: string,
    settings: Partial<GridItRoomSettings>
  ) =>
    request<GridItRoom>(`/api/gridit/rooms/${roomId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify({ playerId, settings }),
    }),
  setGridItRoomReady: (roomId: string, playerId: string, isReady: boolean) =>
    request<GridItRoom>(`/api/gridit/rooms/${roomId}/ready`, {
      method: 'POST',
      body: JSON.stringify({ playerId, isReady }),
    }),
  submitGridItBattleTemplate: (
    roomId: string,
    playerId: string,
    template: GridItCustomTemplate
  ) =>
    request<GridItRoom>(`/api/gridit/rooms/${roomId}/battle-template`, {
      method: 'POST',
      body: JSON.stringify({ playerId, template }),
    }),
  sendGridItRoomChat: (
    roomId: string,
    playerId: string,
    text: string,
    kind: 'chat' | 'emoji' = 'chat'
  ) =>
    request<GridItRoom>(`/api/gridit/rooms/${roomId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ playerId, text, kind }),
    }),
  startGridItRoomMatch: (roomId: string, playerId: string) =>
    request<{ room: GridItRoom; match: GridItMatchStateClient }>(
      `/api/gridit/rooms/${roomId}/start`,
      {
        method: 'POST',
        body: JSON.stringify({ playerId }),
      }
    ),
  joinGridItQuickMatch: (playerId: string) =>
    request<{ status: 'queued' | 'matched'; match?: GridItMatchStateClient }>(
      '/api/gridit/matchmaking/quick',
      {
        method: 'POST',
        body: JSON.stringify({ playerId }),
      }
    ),
  joinGridItRankedQueue: (playerId: string) =>
    request<{ status: 'queued' | 'matched'; match?: GridItMatchStateClient }>(
      '/api/gridit/matchmaking/ranked',
      {
        method: 'POST',
        body: JSON.stringify({ playerId }),
      }
    ),
  leaveGridItRankedQueue: (playerId: string) =>
    request<{ ok: boolean }>(`/api/gridit/matchmaking/ranked/${playerId}`, {
      method: 'DELETE',
    }),
  getGridItMatch: (matchId: string, playerId: string, spectatePlayerId?: string) =>
    request<GridItMatchStateClient>(
      `/api/gridit/matches/${matchId}?playerId=${encodeURIComponent(playerId)}${
        spectatePlayerId ? `&spectatePlayerId=${encodeURIComponent(spectatePlayerId)}` : ''
      }`
    ),
  submitGridItWord: (
    matchId: string,
    playerId: string,
    tilePath: string[],
    preferredWord?: string
  ) =>
    request<{ validation: ModWordValidationResult; match: GridItMatchStateClient }>(
      `/api/gridit/matches/${matchId}/word`,
      {
        method: 'POST',
        body: JSON.stringify({ playerId, tilePath, preferredWord }),
      }
    ),
  sendGridItMatchChat: (
    matchId: string,
    playerId: string,
    text: string,
    kind: 'chat' | 'emoji' = 'chat'
  ) =>
    request<GridItChatMessage>(`/api/gridit/matches/${matchId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ playerId, text, kind }),
    }),
  finishGridItMatch: (matchId: string, playerId: string) =>
    request<GridItMatchStateClient>(`/api/gridit/matches/${matchId}/finish`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),
  rematchGridItMatch: (matchId: string, playerId: string) =>
    request<GridItMatchStateClient>(`/api/gridit/matches/${matchId}/rematch`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),
  getGridItLeaderboard: () =>
    request<{ entries: GridItSessionLeaderboardEntry[]; guestNotice: string }>(
      '/api/gridit/leaderboard'
    ),
  translateMessage: (text: string, targetLang = 'en') =>
    request<{ available: boolean; translatedText: string | null; reason?: string }>(
      '/api/translate',
      {
        method: 'POST',
        body: JSON.stringify({ text, targetLang }),
      }
    ),

  // ==================== GUESSIT MULTIPLAYER, CROSSWORD & ADVENTURE ====================
  listGuessItPublicRooms: () => request<GuessItRoom[]>('/api/guessit/rooms/public'),
  getGuessItRoom: (idOrCode: string) =>
    request<GuessItRoom>(`/api/guessit/rooms/${encodeURIComponent(idOrCode)}`),
  createGuessItRoom: (data: {
    hostId: string;
    name?: string;
    settings?: Partial<GuessItRoomSettings>;
  }) =>
    request<GuessItRoom>('/api/guessit/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  joinGuessItRoom: (codeOrId: string, playerId: string) =>
    request<GuessItRoom>('/api/guessit/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ codeOrId, playerId }),
    }),
  leaveGuessItRoom: (roomId: string, playerId: string) =>
    request<{ ok: boolean }>(`/api/guessit/rooms/${roomId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),
  updateGuessItRoomSettings: (
    roomId: string,
    playerId: string,
    settings: Partial<GuessItRoomSettings>
  ) =>
    request<GuessItRoom>(`/api/guessit/rooms/${roomId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify({ playerId, settings }),
    }),
  setGuessItRoomReady: (roomId: string, playerId: string, isReady: boolean) =>
    request<GuessItRoom>(`/api/guessit/rooms/${roomId}/ready`, {
      method: 'POST',
      body: JSON.stringify({ playerId, isReady }),
    }),
  switchGuessItTeam: (roomId: string, playerId: string, teamId: GuessItTeamId) =>
    request<GuessItRoom>(`/api/guessit/rooms/${roomId}/team`, {
      method: 'POST',
      body: JSON.stringify({ playerId, teamId }),
    }),
  submitGuessItDuelChallenge: (
    roomId: string,
    playerId: string,
    payload: {
      source: 'custom_word' | 'my_templates' | 'curated_db';
      answer?: string;
      templateId?: string;
      category?: GuessItCategory;
      difficulty?: GuessItDifficulty;
      clue?: string;
    }
  ) =>
    request<GuessItRoom>(`/api/guessit/rooms/${roomId}/duel-challenge`, {
      method: 'POST',
      body: JSON.stringify({ playerId, ...payload }),
    }),
  sendGuessItRoomChat: (roomId: string, playerId: string, text: string) =>
    request<GuessItRoom>(`/api/guessit/rooms/${roomId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ playerId, text }),
    }),
  startGuessItRoomMatch: (roomId: string, playerId: string) =>
    request<{ room: GuessItRoom; match: GuessItMatchStateClient }>(
      `/api/guessit/rooms/${roomId}/start`,
      {
        method: 'POST',
        body: JSON.stringify({ playerId }),
      }
    ),
  joinGuessItRankedQueue: (
    playerId: string,
    mode: 'speed_rush' | 'precision_clash' = 'speed_rush',
    format: 'classic' | 'crossword' = 'classic'
  ) =>
    request<{ status: 'queued' | 'matched'; match?: GuessItMatchStateClient }>(
      '/api/guessit/matchmaking/ranked',
      {
        method: 'POST',
        body: JSON.stringify({ playerId, mode, format }),
      }
    ),
  leaveGuessItRankedQueue: (playerId: string) =>
    request<{ ok: boolean }>(`/api/guessit/matchmaking/ranked/${playerId}`, {
      method: 'DELETE',
    }),
  getGuessItMatch: (matchId: string, playerId: string) =>
    request<GuessItMatchStateClient>(
      `/api/guessit/matches/${matchId}?playerId=${encodeURIComponent(playerId)}`
    ),
  submitGuessItLetter: (matchId: string, playerId: string, letter: string) =>
    request<GuessItGuessResponse>(`/api/guessit/matches/${matchId}/guess`, {
      method: 'POST',
      body: JSON.stringify({ playerId, letter }),
    }),
  sendGuessItMatchChat: (matchId: string, playerId: string, text: string) =>
    request<GuessItMatchStateClient>(`/api/guessit/matches/${matchId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ playerId, text }),
    }),
  rematchGuessItMatch: (matchId: string, playerId: string) =>
    request<GuessItMatchStateClient>(`/api/guessit/matches/${matchId}/rematch`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),
  getGuessItAdventureProgress: (playerId: string) =>
    request<GuessItAdventureProgressClient>(
      `/api/guessit/adventure/progress/${encodeURIComponent(playerId)}`
    ),
  startGuessItAdventureStage: (playerId: string, stageId: string) =>
    request<GuessItMatchStateClient>('/api/guessit/adventure/start', {
      method: 'POST',
      body: JSON.stringify({ playerId, stageId }),
    }),
  claimGuessItAdventureReward: (playerId: string, matchId: string) =>
    request<GuessItAdventureClaimResult>('/api/guessit/adventure/claim', {
      method: 'POST',
      body: JSON.stringify({ playerId, matchId }),
    }),
  getTwistItSoloStats: (playerId: string) =>
    request<TwistItSoloStats>(
      `/api/twistit/solo/stats?playerId=${encodeURIComponent(playerId)}`
    ),
  startTwistItSolo: (playerId: string, excludePuzzleIds: string[] = []) =>
    request<TwistItMatchView>('/api/twistit/solo/start', {
      method: 'POST',
      body: JSON.stringify({ playerId, excludePuzzleIds }),
    }),
  listTwistItPublicRooms: () => request<TwistItRoomView[]>('/api/twistit/rooms/public'),
  createTwistItRoom: (hostId: string, settings?: Partial<TwistItRoomSettings>) =>
    request<TwistItRoomView>('/api/twistit/rooms/create', {
      method: 'POST',
      body: JSON.stringify({ playerId: hostId, settings }),
    }),
  joinTwistItRoom: (code: string, playerId: string) =>
    request<TwistItRoomView>('/api/twistit/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ code, playerId }),
    }),
  leaveTwistItRoom: (code: string, playerId: string) =>
    request<{ ok: boolean; room: TwistItRoomView | null }>(
      `/api/twistit/rooms/${encodeURIComponent(code)}/leave`,
      {
        method: 'POST',
        body: JSON.stringify({ playerId }),
      }
    ),
  setTwistItRoomReady: (code: string, playerId: string, ready: boolean) =>
    request<TwistItRoomView>(`/api/twistit/rooms/${encodeURIComponent(code)}/ready`, {
      method: 'POST',
      body: JSON.stringify({ playerId, ready }),
    }),
  updateTwistItRoomSettings: (
    code: string,
    playerId: string,
    settings: Partial<TwistItRoomSettings>
  ) =>
    request<TwistItRoomView>(`/api/twistit/rooms/${encodeURIComponent(code)}/settings`, {
      method: 'POST',
      body: JSON.stringify({ playerId, settings }),
    }),
  sendTwistItRoomChat: (code: string, playerId: string, message: string) =>
    request<TwistItRoomView>(`/api/twistit/rooms/${encodeURIComponent(code)}/chat`, {
      method: 'POST',
      body: JSON.stringify({ playerId, message }),
    }),
  startTwistItRoomMatch: (code: string, playerId: string) =>
    request<{ room: TwistItRoomView; match: TwistItMatchView }>(
      `/api/twistit/rooms/${encodeURIComponent(code)}/start`,
      {
        method: 'POST',
        body: JSON.stringify({ playerId }),
      }
    ),
  rematchTwistItRoom: (code: string, playerId: string) =>
    request<{ room: TwistItRoomView; match: TwistItMatchView }>(
      `/api/twistit/rooms/${encodeURIComponent(code)}/rematch`,
      {
        method: 'POST',
        body: JSON.stringify({ playerId }),
      }
    ),
  getTwistItRoom: (code: string) =>
    request<TwistItRoomView>(`/api/twistit/rooms/${encodeURIComponent(code)}`),
  joinTwistItQuickMatch: (playerId: string) =>
    request<
      | { status: 'queued' }
      | { status: 'matched'; room: TwistItRoomView; match: TwistItMatchView }
    >('/api/twistit/matchmaking/quick/join', {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),
  leaveTwistItQuickMatch: (playerId: string) =>
    request<{ ok: boolean }>('/api/twistit/matchmaking/quick/leave', {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),
  getTwistItMatch: (matchId: string, playerId: string) =>
    request<TwistItMatchView>(
      `/api/twistit/matches/${encodeURIComponent(matchId)}?playerId=${encodeURIComponent(playerId)}`
    ),
  submitTwistItWord: (matchId: string, playerId: string, word: string) =>
    request<TwistItSubmitResult>(`/api/twistit/matches/${encodeURIComponent(matchId)}/submit`, {
      method: 'POST',
      body: JSON.stringify({ playerId, word }),
    }),
};
