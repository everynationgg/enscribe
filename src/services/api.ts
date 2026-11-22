import {
  EquippedCosmetics,
  GameModuleDescriptor,
  GuessResult,
  InAppNotification,
  MatchChatMessage,
  MatchHistorySummary,
  MatchStateClient,
  OngoingMatchSummary,
  Profile,
  Room,
  RoomRules,
  SoloStage,
  Template,
  ThumbnailKey,
} from '../../shared/types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getHealth: () => request<{ ok: boolean; platform: string; games: GameModuleDescriptor[] }>('/api/health'),
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
};
