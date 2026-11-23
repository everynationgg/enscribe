import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { WifiOff } from 'lucide-react';
import {
  DEFAULT_GRIDIT_MODS,
  GameModuleId,
  GridItBoardSize,
  GridItMatchMode,
  GridItMatchStateClient,
  GridItModConfig,
  GridItRoom,
  GridItShapeId,
  InAppNotification,
  MatchHistorySummary,
  MatchStateClient,
  OngoingMatchSummary,
  PlayerSession,
  Profile,
  Room,
  RoomRules,
  SoloStage,
  Template,
  ThumbnailKey,
} from '../shared/types';
import { api, setGuestSessionToken } from './services/api';
import { getSocket } from './services/socket';
import {
  createOfflineGuestSession,
  deleteGuestLocalTemplate,
  duplicateGuestLocalTemplate,
  guestSessionToPlayerSession,
  loadActivePlayerSession,
  loadGuestCompletedSoloStages,
  loadGuestLocalTemplates,
  saveActivePlayerSession,
  saveCachedGuestPrefs,
  saveGuestLocalTemplate,
  sessionToGuestProfile,
} from './services/session';
import {
  getOfflineOfficialTemplates,
  getOfflineSoloMatch,
  getOfflineSoloStages,
  isOfflineSoloMatchId,
  startOfflineSoloMatch,
  submitOfflineSoloGuess,
} from './games/chainit/offlineSolo';
import { BottomNav, NavTab } from './components/BottomNav';
import { GameEntryAnimation } from './components/GameEntryAnimation';
import { GuestEntryScreen } from './screens/GuestEntryScreen';
import { EnscribeHubScreen } from './screens/EnscribeHubScreen';
import { GridItHomeScreen } from './screens/GridItHomeScreen';
import { GridItSoloSetupScreen } from './screens/GridItSoloSetupScreen';
import { GridItSoloGameplayScreen } from './screens/GridItSoloGameplayScreen';
import { GridItBoardEditorScreen } from './screens/GridItBoardEditorScreen';
import { GridItHostSetupScreen } from './screens/GridItHostSetupScreen';
import { GridItRoomsBrowserScreen } from './screens/GridItRoomsBrowserScreen';
import { GridItLobbyScreen } from './screens/GridItLobbyScreen';
import { GridItMultiplayerGameplayScreen } from './screens/GridItMultiplayerGameplayScreen';
import { GridItRankedScreen } from './screens/GridItRankedScreen';
import { GridItLeaderboardScreen } from './screens/GridItLeaderboardScreen';
import { GridItCustomTemplate } from '../shared/gridit/editor';
import { HomeScreen } from './screens/HomeScreen';
import { PlayScreen } from './screens/PlayScreen';
import { SoloScreen } from './screens/SoloScreen';
import { RoomsBrowserScreen } from './screens/RoomsBrowserScreen';
import { CreateRoomScreen } from './screens/CreateRoomScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { TemplatesScreen } from './screens/TemplatesScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameplayScreen } from './screens/GameplayScreen';

type ActiveRoute =
  | { view: 'hub' }
  | { view: 'game_intro'; gameId: 'chain_clash' | 'gridit' }
  | { view: 'gridit_home' }
  | { view: 'gridit_solo_setup' }
  | { view: 'gridit_editor'; returnToLobbyRoomId?: string | null }
  | { view: 'gridit_rooms' }
  | { view: 'gridit_host_setup'; defaultMode: GridItMatchMode }
  | { view: 'gridit_lobby'; roomId: string }
  | { view: 'gridit_match'; matchId: string }
  | { view: 'gridit_ranked' }
  | { view: 'gridit_leaderboard' }
  | {
      view: 'gridit_solo_match';
      shapeId: GridItShapeId;
      sizeId: GridItBoardSize;
      durationSeconds: number;
      mods?: GridItModConfig;
      language?: string;
      customTemplate?: GridItCustomTemplate | null;
    }
  | { view: 'tab'; tab: NavTab }
  | { view: 'solo' }
  | { view: 'rooms' }
  | { view: 'create_room'; returnTo?: 'home' | 'rooms' | 'play' }
  | { view: 'leaderboard' }
  | { view: 'lobby'; roomId: string }
  | { view: 'match'; matchId: string; soloStageId?: string | null };

const ROUTE_STORAGE_KEY = 'enscribe_tab_route_v2';

function loadSavedRoute(): ActiveRoute {
  try {
    const saved = sessionStorage.getItem(ROUTE_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.view && parsed.view !== 'game_intro') {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return { view: 'hub' };
}

export const App: React.FC = () => {
  const [playerSession, setPlayerSession] = useState<PlayerSession | null>(() =>
    loadActivePlayerSession()
  );
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(() =>
    Boolean(loadActivePlayerSession())
  );
  const [authError, setAuthError] = useState<string | null>(null);
  const [route, setRoute] = useState<ActiveRoute>(loadSavedRoute);
  const [lastGridItConfig, setLastGridItConfig] = useState<{
    shapeId: GridItShapeId;
    sizeId: GridItBoardSize;
    durationSeconds: number;
    mods: GridItModConfig;
    language: string;
  }>({
    shapeId: 'heart',
    sizeId: 'medium',
    durationSeconds: 120,
    mods: DEFAULT_GRIDIT_MODS,
    language: 'en',
  });
  const [gridItPublicRooms, setGridItPublicRooms] = useState<GridItRoom[]>([]);
  const [activeGridItRoom, setActiveGridItRoom] = useState<GridItRoom | null>(null);
  const [activeGridItMatch, setActiveGridItMatch] = useState<GridItMatchStateClient | null>(null);
  const [gridItQuickQueued, setGridItQuickQueued] = useState(false);
  const [gridItRankedQueued, setGridItRankedQueued] = useState(false);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [ongoingMatches, setOngoingMatches] = useState<OngoingMatchSummary[]>([]);
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  const [soloStages, setSoloStages] = useState<SoloStage[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchHistorySummary[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [activeMatch, setActiveMatch] = useState<MatchStateClient | null>(null);
  const [rankedQueued, setRankedQueued] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    saveActivePlayerSession(playerSession);
    setGuestSessionToken(playerSession?.sessionToken ?? null);
  }, [playerSession]);

  useEffect(() => {
    if (route.view === 'game_intro') return;
    try {
      sessionStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(route));
    } catch {
      // ignore
    }
  }, [route]);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const populateOfflineState = useCallback((session: PlayerSession) => {
    setCurrentProfile(sessionToGuestProfile(session));
    setSoloStages(getOfflineSoloStages());
    setTemplates([
      ...loadGuestLocalTemplates(session.playerId),
      ...getOfflineOfficialTemplates(),
    ]);
    setOngoingMatches([]);
    setPublicRooms([]);
    setNotifications([]);
    setMatchHistory([]);
  }, []);

  const refreshPlatformData = useCallback(
    async (pid: string, sessionOverride?: PlayerSession | null) => {
      const sess = sessionOverride ?? playerSession;
      if (sess?.isOffline || !navigator.onLine) {
        if (sess) populateOfflineState(sess);
        setAuthChecking(false);
        return;
      }

      try {
        const data = await api.getBootstrap(pid);
        setCurrentProfile(data.profile);
        setMatchHistory(data.history);

        if (data.profile.isGuest || pid.startsWith('guest_')) {
          const localGuestTpls = loadGuestLocalTemplates(pid);
          const officialOnly = data.templates.filter((t) => t.status === 'official');
          setTemplates([...localGuestTpls, ...officialOnly]);

          const localCompleted = new Set(loadGuestCompletedSoloStages());
          setSoloStages(
            data.soloStages.map((s) => ({
              ...s,
              completed: s.completed || localCompleted.has(s.id),
            }))
          );
        } else {
          setTemplates(data.templates);
          setSoloStages(data.soloStages);
        }

        setOngoingMatches(data.ongoingMatches);
        setPublicRooms(data.publicRooms);
        setNotifications(data.notifications);
      } catch (err: any) {
        console.error('Failed loading profile/session:', err);
        if (sess && (!navigator.onLine || /failed to fetch|networkerror/i.test(String(err?.message)))) {
          const offlineSess = createOfflineGuestSession(sess.nickname, sess.avatarId);
          setPlayerSession(offlineSess);
          populateOfflineState(offlineSess);
        } else {
          setCurrentProfile(null);
          setPlayerSession(null);
        }
      } finally {
        setAuthChecking(false);
      }
    },
    [playerSession, populateOfflineState]
  );

  // Restore / validate active guest session on boot
  const bootCheckedRef = useRef(false);
  useEffect(() => {
    if (bootCheckedRef.current) return;
    bootCheckedRef.current = true;

    const existing = loadActivePlayerSession();
    if (!existing) {
      setAuthChecking(false);
      return;
    }

    if (!navigator.onLine || existing.isOffline || !existing.sessionToken) {
      populateOfflineState(existing);
      setAuthChecking(false);
      return;
    }

    setGuestSessionToken(existing.sessionToken);
    (async () => {
      try {
        const res = await api.heartbeatGuestSession(existing.sessionToken!);
        const refreshed = guestSessionToPlayerSession(res.session, false);
        setPlayerSession(refreshed);
        setGuestSessionToken(refreshed.sessionToken);
        await refreshPlatformData(refreshed.playerId, refreshed);
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (/fetch|network/i.test(msg) || !navigator.onLine) {
          const offlineSess = createOfflineGuestSession(existing.nickname, existing.avatarId);
          setPlayerSession(offlineSess);
          populateOfflineState(offlineSess);
          setAuthChecking(false);
          return;
        }
        // Session expired across idle refresh — attempt transparent re-claim of cached nickname
        try {
          const reclaimed = await api.claimGuestNickname(existing.nickname, existing.avatarId);
          const nextSess = guestSessionToPlayerSession(reclaimed.session, false);
          setPlayerSession(nextSess);
          setGuestSessionToken(nextSess.sessionToken);
          await refreshPlatformData(nextSess.playerId, nextSess);
        } catch (reclaimErr: any) {
          setGuestSessionToken(null);
          setPlayerSession(null);
          setCurrentProfile(null);
          setAuthError(
            reclaimErr?.message ||
              'Your guest session expired and that nickname is now taken. Pick a nickname to continue.'
          );
          setAuthChecking(false);
        }
      }
    })();
  }, [populateOfflineState, refreshPlatformData]);

  // 30s heartbeat keeps active online guest nickname reservation fresh
  useEffect(() => {
    if (!playerSession?.sessionToken || playerSession.isOffline || isOffline) return;
    const token = playerSession.sessionToken;
    const interval = window.setInterval(async () => {
      try {
        const res = await api.heartbeatGuestSession(token);
        const updated = guestSessionToPlayerSession(res.session, false);
        setPlayerSession((prev) =>
          prev && prev.sessionToken === token ? { ...prev, expiresAtMs: updated.expiresAtMs } : prev
        );
      } catch {
        // handled on next action or online restore
      }
    }, 30000);
    return () => window.clearInterval(interval);
  }, [playerSession?.sessionToken, playerSession?.isOffline, isOffline]);

  // Upgrade an offline guest session to an online reservation automatically when reconnecting
  useEffect(() => {
    if (isOffline || !playerSession?.isOffline) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.claimGuestNickname(playerSession.nickname, playerSession.avatarId);
        if (cancelled) return;
        const upgraded = guestSessionToPlayerSession(res.session, false);
        setGuestSessionToken(upgraded.sessionToken);
        setPlayerSession(upgraded);
        await refreshPlatformData(upgraded.playerId, upgraded);
        notify(`Connected online as ${upgraded.nickname}`);
      } catch (err: any) {
        if (cancelled) return;
        setGuestSessionToken(null);
        setPlayerSession(null);
        setCurrentProfile(null);
        setAuthError(
          err?.message || 'Your offline nickname is already taken online. Choose another nickname.'
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOffline, playerSession?.isOffline, playerSession?.nickname, playerSession?.avatarId, notify, refreshPlatformData]);

  const routeRef = useRef(route);
  const showNotifModalRef = useRef(showNotifModal);
  const currentProfileRef = useRef(currentProfile);
  routeRef.current = route;
  showNotifModalRef.current = showNotifModal;
  currentProfileRef.current = currentProfile;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listenerPromise = CapApp.addListener('backButton', () => {
      if (showNotifModalRef.current) {
        setShowNotifModal(false);
        return;
      }
      const current = routeRef.current;
      if (current.view === 'game_intro') {
        setRoute({ view: 'hub' });
        return;
      }
      if (current.view === 'gridit_home') {
        setRoute({ view: 'hub' });
        return;
      }
      if (
        current.view === 'gridit_solo_setup' ||
        current.view === 'gridit_rooms' ||
        current.view === 'gridit_ranked' ||
        current.view === 'gridit_leaderboard'
      ) {
        setRoute({ view: 'gridit_home' });
        return;
      }
      if (current.view === 'gridit_editor') {
        if (current.returnToLobbyRoomId) {
          setRoute({ view: 'gridit_lobby', roomId: current.returnToLobbyRoomId });
        } else {
          setRoute({ view: 'gridit_home' });
        }
        return;
      }
      if (current.view === 'gridit_host_setup' || current.view === 'gridit_lobby') {
        setRoute({ view: 'gridit_rooms' });
        return;
      }
      if (current.view === 'gridit_match') {
        setActiveGridItMatch(null);
        setRoute({ view: 'gridit_home' });
        return;
      }
      if (current.view === 'gridit_solo_match') {
        setRoute({ view: 'gridit_solo_setup' });
        return;
      }
      if (current.view === 'create_room') {
        const returnView =
          current.returnTo === 'rooms'
            ? ({ view: 'rooms' } as const)
            : current.returnTo === 'play'
              ? ({ view: 'tab', tab: 'play' } as const)
              : ({ view: 'tab', tab: 'home' } as const);
        setRoute(returnView);
        return;
      }
      if (current.view === 'solo' || current.view === 'rooms' || current.view === 'leaderboard') {
        setRoute({ view: 'tab', tab: 'home' });
        return;
      }
      if (current.view === 'lobby') {
        setActiveRoom(null);
        setRoute({ view: 'rooms' });
        return;
      }
      if (current.view === 'match') {
        setActiveMatch(null);
        if (currentProfileRef.current) {
          refreshPlatformData(currentProfileRef.current.id);
        }
        setRoute({ view: 'tab', tab: 'home' });
        return;
      }
      if (current.view === 'tab' && current.tab !== 'home') {
        setRoute({ view: 'tab', tab: 'home' });
        return;
      }
      if (current.view === 'tab' && current.tab === 'home') {
        setRoute({ view: 'hub' });
        return;
      }
      CapApp.exitApp();
    });
    return () => {
      listenerPromise.then((h) => h.remove()).catch(() => undefined);
    };
  }, [refreshPlatformData]);

  const activeProfileId = currentProfile?.id ?? null;

  // Refresh public rooms whenever opening Rooms Browser
  useEffect(() => {
    if (activeProfileId && !playerSession?.isOffline && route.view === 'rooms') {
      api.listPublicRooms().then(setPublicRooms).catch(() => undefined);
    }
    if (activeProfileId && !playerSession?.isOffline && route.view === 'gridit_rooms') {
      api.listGridItPublicRooms().then(setGridItPublicRooms).catch(() => undefined);
    }
  }, [activeProfileId, playerSession?.isOffline, route.view]);

  // Realtime connection & events (Supabase Realtime everywhere + Socket.IO on localhost)
  useEffect(() => {
    if (!activeProfileId || playerSession?.isOffline) return;
    const socket = getSocket();
    socket.setActivePlayerId(activeProfileId);

    const identify = () => {
      socket.emit('auth:identify', activeProfileId);
      if (route.view === 'lobby') {
        socket.emit('room:join_channel', route.roomId);
      }
      if (route.view === 'match' && !isOfflineSoloMatchId(route.matchId)) {
        socket.emit('match:join_channel', { matchId: route.matchId, playerId: activeProfileId });
      }
    };

    if (socket.connected) identify();
    socket.on('connect', identify);

    const onRoomUpdated = (room: Room) => {
      setActiveRoom((prev) => (prev && prev.id === room.id ? room : prev));
    };

    const onRoomMatchStarted = ({ roomId, matchId }: { roomId: string; matchId: string }) => {
      setRoute((prev) => {
        if (prev.view === 'lobby' && prev.roomId === roomId) {
          return { view: 'match', matchId };
        }
        return prev;
      });
    };

    const onMatchState = (match: MatchStateClient) => {
      if (route.view === 'match' && route.matchId === match.id) {
        setActiveMatch(match);
      }
      if (match.status === 'finished') {
        refreshPlatformData(activeProfileId);
      }
    };

    const onTypingLive = ({ matchId, playerId, preview }: { matchId: string; playerId: string; preview: string }) => {
      if (playerId === activeProfileId) return;
      setActiveMatch((prev) => {
        if (!prev || prev.id !== matchId || !prev.boards[playerId]) return prev;
        return {
          ...prev,
          boards: {
            ...prev.boards,
            [playerId]: {
              ...prev.boards[playerId],
              liveInputPreview: preview,
            },
          },
        };
      });
    };

    const onPublicUpdated = () => {
      api.listPublicRooms().then(setPublicRooms).catch(() => undefined);
    };

    const onRankedMatched = ({ matchId }: { matchId: string }) => {
      setRankedQueued(false);
      notify('Ranked match found!');
      setRoute({ view: 'match', matchId });
    };

    const onRematchCreated = ({ newMatchId }: { newMatchId: string }) => {
      notify('Rematch started!');
      setRoute({ view: 'match', matchId: newMatchId });
    };

    const onGridItRoomUpdated = (room: GridItRoom) => {
      setActiveGridItRoom((prev) => (prev && prev.id === room.id ? room : prev));
    };

    const onGridItRoomsUpdated = () => {
      api.listGridItPublicRooms().then(setGridItPublicRooms).catch(() => undefined);
    };

    const onGridItMatchStarted = ({ roomId, matchId }: { roomId: string; matchId: string }) => {
      setRoute((prev) => {
        if (prev.view === 'gridit_lobby' && prev.roomId === roomId) {
          return { view: 'gridit_match', matchId };
        }
        return prev;
      });
    };

    const onGridItMatched = ({ matchId }: { matchId: string }) => {
      setGridItQuickQueued(false);
      setGridItRankedQueued(false);
      notify('GridIt opponent found!');
      setRoute({ view: 'gridit_match', matchId });
    };

    const onGridItMatchState = (match: GridItMatchStateClient) => {
      setRoute((prev) => {
        if (prev.view === 'gridit_match' && prev.matchId === match.id) {
          setActiveGridItMatch(match);
        }
        return prev;
      });
    };

    const onGridItRematch = ({ newMatchId }: { newMatchId: string }) => {
      notify('GridIt rematch started!');
      setRoute({ view: 'gridit_match', matchId: newMatchId });
    };

    socket.on('room:updated', onRoomUpdated);
    socket.on('room:match_started', onRoomMatchStarted);
    socket.on('match:state', onMatchState);
    socket.on('match:typing_live', onTypingLive);
    socket.on('rooms:public_updated', onPublicUpdated);
    socket.on('matchmaking:ranked_matched', onRankedMatched);
    socket.on('match:rematch_created', onRematchCreated);
    socket.on('gridit:room_updated', onGridItRoomUpdated);
    socket.on('gridit:rooms_updated', onGridItRoomsUpdated);
    socket.on('gridit:match_started', onGridItMatchStarted);
    socket.on('gridit:matched', onGridItMatched);
    socket.on('gridit:match_state', onGridItMatchState);
    socket.on('gridit:rematch', onGridItRematch);

    return () => {
      socket.off('connect', identify);
      socket.off('room:updated', onRoomUpdated);
      socket.off('room:match_started', onRoomMatchStarted);
      socket.off('match:state', onMatchState);
      socket.off('match:typing_live', onTypingLive);
      socket.off('rooms:public_updated', onPublicUpdated);
      socket.off('matchmaking:ranked_matched', onRankedMatched);
      socket.off('match:rematch_created', onRematchCreated);
      socket.off('gridit:room_updated', onGridItRoomUpdated);
      socket.off('gridit:rooms_updated', onGridItRoomsUpdated);
      socket.off('gridit:match_started', onGridItMatchStarted);
      socket.off('gridit:matched', onGridItMatched);
      socket.off('gridit:match_state', onGridItMatchState);
      socket.off('gridit:rematch', onGridItRematch);
    };
  }, [activeProfileId, playerSession?.isOffline, route.view, (route as any).roomId, (route as any).matchId, notify, refreshPlatformData]);

  // Lightweight resilience sync for serverless/mobile networks when in an active lobby or match
  useEffect(() => {
    if (!activeProfileId || playerSession?.isOffline || (route.view !== 'lobby' && route.view !== 'match')) return;
    if (route.view === 'match' && isOfflineSoloMatchId(route.matchId)) return;
    const interval = window.setInterval(() => {
      if (route.view === 'lobby') {
        api.getRoom(route.roomId).then((r) => {
          setActiveRoom(r);
          if (r.status === 'in_progress' && r.activeMatchId) {
            setRoute({ view: 'match', matchId: r.activeMatchId });
          }
        }).catch(() => undefined);
      } else if (route.view === 'match') {
        api.getMatch(route.matchId, activeProfileId).then(setActiveMatch).catch(() => undefined);
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [route, activeProfileId, playerSession?.isOffline]);

  // Polling resilience & route restoration for GridIt Multiplayer lobbies and matches
  useEffect(() => {
    if (!activeProfileId || playerSession?.isOffline) return;
    if (route.view === 'gridit_lobby') {
      api
        .getGridItRoom(route.roomId)
        .then((r) => {
          setActiveGridItRoom(r);
          if (r.status === 'in_progress' && r.activeMatchId) {
            setRoute({ view: 'gridit_match', matchId: r.activeMatchId });
          }
        })
        .catch(() => undefined);
    } else if (route.view === 'gridit_match') {
      api
        .getGridItMatch(route.matchId, activeProfileId)
        .then(setActiveGridItMatch)
        .catch((err) => {
          notify(err.message);
          setRoute({ view: 'gridit_home' });
        });
    }
  }, [route, activeProfileId, playerSession?.isOffline, notify]);

  useEffect(() => {
    if (
      !activeProfileId ||
      playerSession?.isOffline ||
      (route.view !== 'gridit_lobby' && route.view !== 'gridit_match')
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      if (route.view === 'gridit_lobby') {
        api
          .getGridItRoom(route.roomId)
          .then((r) => {
            setActiveGridItRoom(r);
            if (r.status === 'in_progress' && r.activeMatchId) {
              setRoute({ view: 'gridit_match', matchId: r.activeMatchId });
            }
          })
          .catch(() => undefined);
      } else if (route.view === 'gridit_match') {
        api
          .getGridItMatch(
            route.matchId,
            activeProfileId,
            activeGridItMatch?.spectatingPlayerId ?? undefined
          )
          .then(setActiveGridItMatch)
          .catch(() => undefined);
      }
    }, 3000);
    return () => window.clearInterval(interval);
  }, [
    route,
    activeProfileId,
    playerSession?.isOffline,
    activeGridItMatch?.spectatingPlayerId,
  ]);

  // Restore room or match state cleanly on route change or browser refresh
  useEffect(() => {
    if (!activeProfileId) return;
    if (route.view === 'lobby') {
      if (playerSession?.isOffline) return;
      const socket = getSocket();
      api
        .getRoom(route.roomId)
        .then((room) => {
          setActiveRoom(room);
          socket.emit('room:join_channel', room.id);
        })
        .catch((err) => {
          notify(err.message);
          setRoute({ view: 'tab', tab: 'home' });
        });
    } else if (route.view === 'match') {
      if (isOfflineSoloMatchId(route.matchId)) {
        const offline = getOfflineSoloMatch(route.matchId);
        if (offline) {
          setActiveMatch(offline);
        } else {
          setRoute({ view: 'solo' });
        }
        return;
      }
      if (playerSession?.isOffline) return;
      const socket = getSocket();
      api
        .getMatch(route.matchId, activeProfileId)
        .then((match) => {
          setActiveMatch(match);
          socket.emit('match:join_channel', { matchId: match.id, playerId: activeProfileId });
        })
        .catch((err) => {
          notify(err.message);
          setRoute({ view: 'tab', tab: 'home' });
        });
    }
  }, [route, activeProfileId, playerSession?.isOffline, notify]);

  const handleEnterGuest = async (nickname: string, avatarId: string) => {
    saveCachedGuestPrefs(nickname, avatarId);
    setAuthError(null);

    if (isOffline) {
      const offlineSess = createOfflineGuestSession(nickname, avatarId);
      setGuestSessionToken(null);
      setPlayerSession(offlineSess);
      populateOfflineState(offlineSess);
      setActiveRoom(null);
      setActiveMatch(null);
      setRoute({ view: 'hub' });
      notify(`Entered Offline Solo as ${offlineSess.nickname}`);
      return;
    }

    const res = await api.claimGuestNickname(nickname, avatarId);
    const nextSess = guestSessionToPlayerSession(res.session, false);
    setGuestSessionToken(nextSess.sessionToken);
    setPlayerSession(nextSess);
    setCurrentProfile(res.profile);
    setActiveRoom(null);
    setActiveMatch(null);
    await refreshPlatformData(nextSess.playerId, nextSess);
    setRoute({ view: 'hub' });
    notify(`Welcome, ${res.session.nickname}!`);
  };

  const handleSwitchGuest = async () => {
    const token = playerSession?.sessionToken;
    if (token && !isOffline) {
      await api.releaseGuestSession(token).catch(() => undefined);
    }
    setGuestSessionToken(null);
    setPlayerSession(null);
    setCurrentProfile(null);
    setActiveRoom(null);
    setActiveMatch(null);
    setRankedQueued(false);
    setAuthError(null);
    setRoute({ view: 'hub' });
    try {
      sessionStorage.removeItem(ROUTE_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleSelectHubGame = (gameId: GameModuleId) => {
    setRoute({ view: 'game_intro', gameId });
  };

  const handleOpenMatch = (matchId: string) => {
    setRoute({ view: 'match', matchId });
  };

  const handleRankedMatch = async () => {
    if (!currentProfile) return;
    if (isOffline || playerSession?.isOffline) {
      notify('Ranked matchmaking requires an online connection.');
      return;
    }
    try {
      if (rankedQueued) {
        await api.leaveRankedQueue(currentProfile.id);
        setRankedQueued(false);
        notify('Left ranked queue');
        return;
      }
      const res = await api.joinRankedQueue(currentProfile.id);
      if (res.status === 'matched' && res.matchId) {
        setRankedQueued(false);
        setRoute({ view: 'match', matchId: res.matchId });
      } else {
        setRankedQueued(true);
        notify('Searching Ranked Queue (open 2nd tab to match!)');
      }
    } catch (err: any) {
      notify(err.message);
    }
  };

  const handleCreateRoom = async (params?: {
    name: string;
    isPublic: boolean;
    rules: Partial<RoomRules>;
  }) => {
    if (!currentProfile) return;
    if (isOffline || playerSession?.isOffline) {
      notify('Multiplayer rooms require an online connection.');
      return;
    }
    try {
      const room = await api.createRoom({
        hostId: currentProfile.id,
        name: params?.name ?? 'Private Room',
        isPublic: params?.isPublic ?? false,
        rules: params?.rules,
      });
      setActiveRoom(room);
      setRoute({ view: 'lobby', roomId: room.id });
    } catch (err: any) {
      notify(err.message);
    }
  };

  const handleJoinRoomByCode = async (code: string) => {
    if (!currentProfile) return;
    if (isOffline || playerSession?.isOffline) {
      notify('Joining rooms requires an online connection.');
      return;
    }
    try {
      const room = await api.joinRoom(code, currentProfile.id);
      setActiveRoom(room);
      setRoute({ view: 'lobby', roomId: room.id });
    } catch (err: any) {
      notify(err.message);
    }
  };

  const handlePlayWithTemplate = async (tpl: Template) => {
    if (!currentProfile) return;
    if (isOffline || playerSession?.isOffline) {
      notify('Hosting multiplayer rooms requires an online connection.');
      return;
    }
    try {
      const room = await api.createRoom({
        hostId: currentProfile.id,
        name: `${tpl.name} Room`,
        isPublic: false,
      });
      const isGuestLocal =
        tpl.status !== 'official' &&
        (tpl.ownerId.startsWith('guest_') || tpl.id.startsWith('tpl_guest_'));
      const updated = await api.submitRoomPuzzle(
        room.id,
        currentProfile.id,
        isGuestLocal
          ? { customWords: tpl.words, templateId: null, puzzleStatus: 'ready' }
          : { templateId: tpl.id, puzzleStatus: 'ready' }
      );
      setActiveRoom(updated);
      setRoute({ view: 'lobby', roomId: updated.id });
      notify(`Room ${updated.code} created with "${tpl.name}" ready!`);
    } catch (err: any) {
      notify(err.message);
    }
  };

  const handleStartSoloStage = async (stageId: string) => {
    if (!currentProfile) return;
    if (isOffline || playerSession?.isOffline) {
      const res = startOfflineSoloMatch(currentProfile, stageId);
      setActiveMatch(res.match);
      setRoute({ view: 'match', matchId: res.match.id, soloStageId: res.stageId });
      return;
    }
    try {
      const res = await api.startSoloMatch(currentProfile.id, { stageId });
      setActiveMatch(res.match);
      setRoute({ view: 'match', matchId: res.match.id, soloStageId: res.stageId });
    } catch (err: any) {
      if (/fetch|network/i.test(String(err?.message)) || !navigator.onLine) {
        const res = startOfflineSoloMatch(currentProfile, stageId);
        setActiveMatch(res.match);
        setRoute({ view: 'match', matchId: res.match.id, soloStageId: res.stageId });
        notify('Started offline Solo stage');
      } else {
        notify(err.message);
      }
    }
  };

  const openNotifications = async () => {
    if (!currentProfile) return;
    setShowNotifModal(true);
    if (!isOffline && !playerSession?.isOffline) {
      await api.markNotificationsRead(currentProfile.id).catch(() => undefined);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const renderScreen = () => {
    if (authChecking) {
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#c7d5ff',
            fontWeight: 800,
            fontSize: 15,
          }}
        >
          Checking guest session...
        </div>
      );
    }

    if (!currentProfile || !playerSession) {
      return (
        <GuestEntryScreen
          isOffline={isOffline}
          initialError={authError}
          onEnterGuest={handleEnterGuest}
        />
      );
    }

    if (route.view === 'hub') {
      return (
        <EnscribeHubScreen
          session={playerSession}
          isOffline={isOffline}
          onSelectGame={handleSelectHubGame}
          onSwitchGuest={handleSwitchGuest}
        />
      );
    }

    if (route.view === 'game_intro') {
      return (
        <GameEntryAnimation
          gameId={route.gameId}
          onComplete={() => {
            if (route.gameId === 'gridit') {
              setRoute({ view: 'gridit_home' });
            } else {
              setRoute({ view: 'tab', tab: 'home' });
            }
          }}
        />
      );
    }

    if (route.view === 'gridit_home') {
      return (
        <GridItHomeScreen
          session={playerSession}
          onExitToHub={() => setRoute({ view: 'hub' })}
          onOpenSolo={() => setRoute({ view: 'gridit_solo_setup' })}
          onOpenRanked={() => setRoute({ view: 'gridit_ranked' })}
          onOpenMultiplayer={() => setRoute({ view: 'gridit_rooms' })}
          onOpenLeaderboard={() => setRoute({ view: 'gridit_leaderboard' })}
          onOpenBoardBattle={() =>
            setRoute({ view: 'gridit_host_setup', defaultMode: 'board_battle' })
          }
          onOpenEditor={() => setRoute({ view: 'gridit_editor', returnToLobbyRoomId: null })}
        />
      );
    }

    if (route.view === 'gridit_ranked') {
      return (
        <GridItRankedScreen
          session={playerSession}
          rankedQueued={gridItRankedQueued}
          isOffline={isOffline || playerSession.isOffline}
          onBack={() => setRoute({ view: 'gridit_home' })}
          onToggleQueue={async () => {
            try {
              if (gridItRankedQueued) {
                await api.leaveGridItRankedQueue(playerSession.playerId);
                setGridItRankedQueued(false);
                notify('Left GridIt Ranked queue');
                return;
              }
              const res = await api.joinGridItRankedQueue(playerSession.playerId);
              if (res.status === 'matched' && res.match) {
                setGridItRankedQueued(false);
                setActiveGridItMatch(res.match);
                setRoute({ view: 'gridit_match', matchId: res.match.id });
              } else {
                setGridItRankedQueued(true);
                notify('Searching GridIt Ranked 1v1 queue...');
              }
            } catch (err: any) {
              notify(err.message);
            }
          }}
        />
      );
    }

    if (route.view === 'gridit_leaderboard') {
      return (
        <GridItLeaderboardScreen
          isOffline={isOffline || playerSession.isOffline}
          onBack={() => setRoute({ view: 'gridit_home' })}
        />
      );
    }

    if (route.view === 'gridit_rooms') {
      return (
        <GridItRoomsBrowserScreen
          publicRooms={gridItPublicRooms}
          quickQueued={gridItQuickQueued}
          isOffline={isOffline || playerSession.isOffline}
          onBack={() => setRoute({ view: 'gridit_home' })}
          onRefresh={() => {
            api.listGridItPublicRooms().then(setGridItPublicRooms).catch(() => undefined);
          }}
          onQuickMatch={async () => {
            try {
              const res = await api.joinGridItQuickMatch(playerSession.playerId);
              if (res.status === 'matched' && res.match) {
                setGridItQuickQueued(false);
                setActiveGridItMatch(res.match);
                setRoute({ view: 'gridit_match', matchId: res.match.id });
              } else {
                setGridItQuickQueued(true);
                notify('Searching random GridIt opponent...');
              }
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onJoinRoom={async (codeOrId, asSpectator = false) => {
            try {
              const res = await api.joinGridItRoom(codeOrId, playerSession.playerId, asSpectator);
              setActiveGridItRoom(res.room);
              if (res.room.status === 'in_progress' && res.room.activeMatchId) {
                setRoute({ view: 'gridit_match', matchId: res.room.activeMatchId });
              } else {
                setRoute({ view: 'gridit_lobby', roomId: res.room.id });
              }
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onOpenCreateRoom={(mode) =>
            setRoute({ view: 'gridit_host_setup', defaultMode: mode })
          }
        />
      );
    }

    if (route.view === 'gridit_host_setup') {
      return (
        <GridItHostSetupScreen
          defaultMode={route.defaultMode}
          onBack={() => setRoute({ view: 'gridit_rooms' })}
          onCreateRoom={async ({ name, settings }) => {
            try {
              const room = await api.createGridItRoom({
                hostId: playerSession.playerId,
                name,
                settings,
              });
              setActiveGridItRoom(room);
              setRoute({ view: 'gridit_lobby', roomId: room.id });
            } catch (err: any) {
              notify(err.message);
            }
          }}
        />
      );
    }

    if (route.view === 'gridit_lobby' && activeGridItRoom?.id === route.roomId) {
      return (
        <GridItLobbyScreen
          room={activeGridItRoom}
          session={playerSession}
          onBack={() => setRoute({ view: 'gridit_rooms' })}
          onLeave={async () => {
            await api.leaveGridItRoom(activeGridItRoom.id, playerSession.playerId).catch(() => undefined);
            setActiveGridItRoom(null);
            setRoute({ view: 'gridit_rooms' });
          }}
          onToggleReady={async (isReady) => {
            const updated = await api.setGridItRoomReady(
              activeGridItRoom.id,
              playerSession.playerId,
              isReady
            );
            setActiveGridItRoom(updated);
          }}
          onSubmitBattleTemplate={async (tpl) => {
            const updated = await api.submitGridItBattleTemplate(
              activeGridItRoom.id,
              playerSession.playerId,
              tpl
            );
            setActiveGridItRoom(updated);
          }}
          onOpenBoardEditor={() =>
            setRoute({ view: 'gridit_editor', returnToLobbyRoomId: activeGridItRoom.id })
          }
          onSendChat={async (text, kind) => {
            const updated = await api.sendGridItRoomChat(
              activeGridItRoom.id,
              playerSession.playerId,
              text,
              kind
            );
            setActiveGridItRoom(updated);
          }}
          onStartMatch={async () => {
            try {
              const res = await api.startGridItRoomMatch(
                activeGridItRoom.id,
                playerSession.playerId
              );
              setActiveGridItRoom(res.room);
              setActiveGridItMatch(res.match);
              setRoute({ view: 'gridit_match', matchId: res.match.id });
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onNotify={notify}
        />
      );
    }

    if (route.view === 'gridit_match' && activeGridItMatch?.id === route.matchId) {
      return (
        <GridItMultiplayerGameplayScreen
          match={activeGridItMatch}
          session={playerSession}
          onExitToHub={() => {
            setActiveGridItMatch(null);
            setRoute({ view: 'gridit_home' });
          }}
          onReturnToRoom={(roomId) => {
            setActiveGridItMatch(null);
            setRoute({ view: 'gridit_lobby', roomId });
          }}
          onSwitchSpectatePlayer={async (targetPid) => {
            const next = await api.getGridItMatch(
              activeGridItMatch.id,
              playerSession.playerId,
              targetPid
            );
            setActiveGridItMatch(next);
          }}
          onSubmitWord={async (tilePath) => {
            const res = await api.submitGridItWord(
              activeGridItMatch.id,
              playerSession.playerId,
              tilePath
            );
            setActiveGridItMatch(res.match);
            if (!res.validation.valid) {
              return {
                valid: false,
                message:
                  res.validation.reason === 'already_found'
                    ? `${res.validation.word} already found`
                    : `${res.validation.word || 'Word'} invalid`,
              };
            }
            const multStr = res.validation.multiplier > 1 ? ` (${res.validation.multiplier}×)` : '';
            return {
              valid: true,
              message: `+${res.validation.finalPoints} pts${multStr} • ${res.validation.word}!`,
            };
          }}
          onSendChat={async (text, kind) => {
            await api.sendGridItMatchChat(activeGridItMatch.id, playerSession.playerId, text, kind);
            const refreshed = await api.getGridItMatch(
              activeGridItMatch.id,
              playerSession.playerId,
              activeGridItMatch.spectatingPlayerId ?? undefined
            );
            setActiveGridItMatch(refreshed);
          }}
          onFinishEarly={async () => {
            const ended = await api.finishGridItMatch(
              activeGridItMatch.id,
              playerSession.playerId
            );
            setActiveGridItMatch(ended);
          }}
          onRematch={async () => {
            const next = await api.rematchGridItMatch(
              activeGridItMatch.id,
              playerSession.playerId
            );
            setActiveGridItMatch(next);
            setRoute({ view: 'gridit_match', matchId: next.id });
          }}
          onNotify={notify}
        />
      );
    }

    if (route.view === 'gridit_editor') {
      const returnRoomId = route.returnToLobbyRoomId ?? null;
      return (
        <GridItBoardEditorScreen
          onBack={() =>
            returnRoomId
              ? setRoute({ view: 'gridit_lobby', roomId: returnRoomId })
              : setRoute({ view: 'gridit_home' })
          }
          selectModeLabel={returnRoomId ? 'Lock In for Battle' : undefined}
          onSelectForBattle={
            returnRoomId
              ? async (tpl) => {
                  try {
                    const updated = await api.submitGridItBattleTemplate(
                      returnRoomId,
                      playerSession.playerId,
                      tpl
                    );
                    setActiveGridItRoom(updated);
                    setRoute({ view: 'gridit_lobby', roomId: returnRoomId });
                    notify('Secret Battle Board locked in!');
                  } catch (err: any) {
                    notify(err.message);
                  }
                }
              : undefined
          }
          onPlayWithTemplate={(tpl) => {
            setRoute({
              view: 'gridit_solo_match',
              shapeId: tpl.shapeId,
              sizeId: tpl.sizeId,
              durationSeconds: 120,
              mods: lastGridItConfig.mods,
              language: tpl.language || 'en',
              customTemplate: tpl,
            });
          }}
        />
      );
    }

    if (route.view === 'gridit_solo_setup') {
      return (
        <GridItSoloSetupScreen
          initialShape={lastGridItConfig.shapeId}
          initialSize={lastGridItConfig.sizeId}
          initialDurationSeconds={lastGridItConfig.durationSeconds}
          initialMods={lastGridItConfig.mods}
          initialLanguage={lastGridItConfig.language}
          onBack={() => setRoute({ view: 'gridit_home' })}
          onStartMatch={(cfg) => {
            setLastGridItConfig(cfg);
            setRoute({ view: 'gridit_solo_match', ...cfg, customTemplate: null });
          }}
        />
      );
    }

    if (route.view === 'gridit_solo_match') {
      return (
        <GridItSoloGameplayScreen
          session={playerSession}
          shapeId={route.shapeId}
          sizeId={route.sizeId}
          durationSeconds={route.durationSeconds}
          mods={route.mods ?? lastGridItConfig.mods}
          language={route.language ?? lastGridItConfig.language}
          customTemplate={route.customTemplate ?? null}
          onExitToSetup={() => setRoute({ view: 'gridit_solo_setup' })}
          onExitToHub={() => setRoute({ view: 'hub' })}
        />
      );
    }

    if (route.view === 'lobby' && activeRoom && activeRoom.id === route.roomId) {
      return (
        <LobbyScreen
          room={activeRoom}
          currentProfile={currentProfile}
          templates={templates}
          onBack={() => setRoute({ view: 'tab', tab: 'home' })}
          onLeave={async () => {
            await api.leaveRoom(activeRoom.id, currentProfile.id).catch(() => undefined);
            setActiveRoom(null);
            setRoute({ view: 'tab', tab: 'home' });
          }}
          onToggleReady={async (nextReady) => {
            setActiveRoom((prev) =>
              prev
                ? {
                    ...prev,
                    players: prev.players.map((p) =>
                      p.playerId === currentProfile.id ? { ...p, isReady: nextReady } : p
                    ),
                  }
                : prev
            );
            const updated = await api.setRoomReady(activeRoom.id, currentProfile.id, nextReady);
            setActiveRoom(updated);
          }}
          onSelectPuzzle={async (payload) => {
            const updated = await api.submitRoomPuzzle(activeRoom.id, currentProfile.id, payload);
            setActiveRoom(updated);
          }}
          onUpdateRules={async (rules) => {
            try {
              const updated = await api.updateRoomRules(activeRoom.id, currentProfile.id, rules);
              setActiveRoom(updated);
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onSendChat={async (text) => {
            const clean = text.trim();
            if (!clean) return;
            setActiveRoom((prev) =>
              prev
                ? {
                    ...prev,
                    messages: [
                      ...prev.messages,
                      {
                        id: `temp_${Date.now()}`,
                        roomId: prev.id,
                        senderId: currentProfile.id,
                        senderName: currentProfile.username,
                        senderAvatar: currentProfile.avatarId,
                        text: clean,
                        createdAt: Date.now(),
                      },
                    ],
                  }
                : prev
            );
            const updated = await api.sendRoomChat(activeRoom.id, currentProfile.id, clean);
            setActiveRoom(updated);
          }}
          onStartMatch={async () => {
            try {
              const res = await api.startRoomMatch(activeRoom.id, currentProfile.id);
              setActiveRoom(res.room);
              setActiveMatch(res.match);
              setRoute({ view: 'match', matchId: res.match.id });
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onNotify={notify}
        />
      );
    }

    if (route.view === 'match' && activeMatch && activeMatch.id === route.matchId) {
      const offlineMatch = isOfflineSoloMatchId(activeMatch.id);
      return (
        <GameplayScreen
          match={activeMatch}
          currentProfile={currentProfile}
          onBackHome={() => {
            setActiveMatch(null);
            if (!offlineMatch) {
              refreshPlatformData(currentProfile.id);
            } else {
              setSoloStages(getOfflineSoloStages());
            }
            setRoute({ view: 'tab', tab: 'home' });
          }}
          onReturnToRoom={(roomId) => setRoute({ view: 'lobby', roomId })}
          onSubmitGuess={async (guess) => {
            if (offlineMatch) {
              const res = submitOfflineSoloGuess(activeMatch.id, guess);
              setActiveMatch(res.match);
              if (res.matchWon) {
                setSoloStages(getOfflineSoloStages());
              }
              return { correct: res.correct, message: res.message };
            }
            const res = await api.submitGuess(
              activeMatch.id,
              currentProfile.id,
              guess,
              route.soloStageId
            );
            setActiveMatch(res.match);
            if (res.matchWon || res.match.status === 'finished') {
              refreshPlatformData(currentProfile.id);
            }
            return { correct: res.correct, message: res.message };
          }}
          onPassTurn={async () => {
            if (offlineMatch) return;
            const updated = await api.passTurn(activeMatch.id, currentProfile.id);
            setActiveMatch(updated);
          }}
          onTypingPreview={(preview) => {
            if (offlineMatch) return;
            getSocket().emit('match:typing', {
              matchId: activeMatch.id,
              playerId: currentProfile.id,
              preview,
            });
          }}
          onSendChat={async (text) => {
            if (offlineMatch) return;
            const msg = await api.sendMatchChat(activeMatch.id, currentProfile.id, text);
            setActiveMatch((prev) =>
              prev && prev.id === activeMatch.id && !prev.messages.some((m) => m.id === msg.id)
                ? { ...prev, messages: [...prev.messages, msg] }
                : prev
            );
          }}
          onRematch={async () => {
            if (offlineMatch) {
              const next = startOfflineSoloMatch(
                currentProfile,
                route.soloStageId ?? undefined
              );
              setActiveMatch(next.match);
              setRoute({ view: 'match', matchId: next.match.id, soloStageId: next.stageId });
              return;
            }
            const next = await api.rematch(activeMatch.id, currentProfile.id);
            setActiveMatch(next);
            setRoute({ view: 'match', matchId: next.id });
          }}
          onTimerExpired={() => {
            if (offlineMatch) return;
            api.tickMatch(activeMatch.id, currentProfile.id).then(setActiveMatch).catch(() => undefined);
          }}
        />
      );
    }

    if (route.view === 'lobby' || route.view === 'match') {
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#c7d5ff',
            fontWeight: 800,
            fontSize: 15,
          }}
        >
          Loading {route.view === 'lobby' ? 'room' : 'match'}...
        </div>
      );
    }

    if (route.view === 'solo') {
      return (
        <SoloScreen
          profile={currentProfile}
          soloStages={soloStages}
          onBack={() => setRoute({ view: 'tab', tab: 'home' })}
          onStartSoloStage={handleStartSoloStage}
        />
      );
    }

    if (route.view === 'rooms') {
      return (
        <RoomsBrowserScreen
          profile={currentProfile}
          publicRooms={publicRooms}
          onBack={() => setRoute({ view: 'tab', tab: 'home' })}
          onRefreshPublicRooms={() => {
            if (!isOffline && !playerSession.isOffline) {
              api.listPublicRooms().then(setPublicRooms).catch(() => undefined);
            }
          }}
          onJoinRoomByCode={handleJoinRoomByCode}
          onOpenCreateRoom={() => setRoute({ view: 'create_room', returnTo: 'rooms' })}
        />
      );
    }

    if (route.view === 'create_room') {
      const returnView = route.returnTo === 'rooms'
        ? { view: 'rooms' as const }
        : route.returnTo === 'play'
          ? { view: 'tab' as const, tab: 'play' as const }
          : { view: 'tab' as const, tab: 'home' as const };
      return (
        <CreateRoomScreen
          onBack={() => setRoute(returnView)}
          onCancel={() => setRoute(returnView)}
          onCreateRoom={handleCreateRoom}
        />
      );
    }

    if (route.view === 'leaderboard') {
      return (
        <LeaderboardScreen
          currentProfile={currentProfile}
          onBack={() => setRoute({ view: 'tab', tab: 'home' })}
        />
      );
    }

    const tab = route.view === 'tab' ? route.tab : 'home';

    return (
      <div className="ens-tab-shell">
        {tab === 'home' && (
          <HomeScreen
            profile={currentProfile}
            ongoingMatches={ongoingMatches}
            soloStages={soloStages}
            notifications={notifications}
            rankedQueued={rankedQueued}
            onOpenNotifications={openNotifications}
            onContinueMatch={handleOpenMatch}
            onViewAllMatches={() => setRoute({ view: 'tab', tab: 'play' })}
            onRankedMatch={handleRankedMatch}
            onSoloAdventure={() => setRoute({ view: 'solo' })}
            onLeaderboard={() => setRoute({ view: 'leaderboard' })}
            onRooms={() => setRoute({ view: 'rooms' })}
            onExploreFantasy={() => setRoute({ view: 'solo' })}
            onOpenProfile={() => setRoute({ view: 'tab', tab: 'profile' })}
            onExitToHub={() => setRoute({ view: 'hub' })}
          />
        )}

        {tab === 'play' && (
          <PlayScreen
            profile={currentProfile}
            ongoingMatches={ongoingMatches}
            publicRooms={publicRooms}
            soloStages={soloStages}
            rankedQueued={rankedQueued}
            onOpenMatch={handleOpenMatch}
            onJoinRoomByCode={handleJoinRoomByCode}
            onOpenSolo={() => setRoute({ view: 'solo' })}
            onOpenRooms={() => setRoute({ view: 'rooms' })}
            onOpenCreateRoom={() => setRoute({ view: 'create_room', returnTo: 'play' })}
            onOpenLeaderboard={() => setRoute({ view: 'leaderboard' })}
            onToggleRankedQueue={handleRankedMatch}
            onExitToHub={() => setRoute({ view: 'hub' })}
          />
        )}

        {tab === 'templates' && (
          <TemplatesScreen
            profile={currentProfile}
            templates={templates}
            onSaveTemplate={async (tplData: {
              id?: string;
              ownerId: string;
              name: string;
              theme: string;
              thumbnailKey: ThumbnailKey;
              words: string[];
              status: 'saved' | 'draft';
            }) => {
              if (currentProfile.isGuest) {
                const saved = saveGuestLocalTemplate(currentProfile.id, tplData);
                setTemplates((prev) => [saved, ...prev.filter((t) => t.id !== saved.id)]);
                return saved;
              }
              const saved = await api.saveTemplate(tplData);
              setTemplates((prev) => {
                const rest = prev.filter((t) => t.id !== saved.id);
                return [saved, ...rest];
              });
              return saved;
            }}
            onDuplicateTemplate={async (id) => {
              if (currentProfile.isGuest) {
                const src = templates.find((t) => t.id === id);
                if (!src) throw new Error('Template not found');
                const dup = duplicateGuestLocalTemplate(currentProfile.id, src);
                setTemplates((prev) => [dup, ...prev]);
                return dup;
              }
              const dup = await api.duplicateTemplate(id, currentProfile.id);
              setTemplates((prev) => [dup, ...prev]);
              return dup;
            }}
            onDeleteTemplate={async (id) => {
              setTemplates((prev) => prev.filter((t) => t.id !== id));
              if (currentProfile.isGuest) {
                deleteGuestLocalTemplate(currentProfile.id, id);
                return;
              }
              await api.deleteTemplate(id);
            }}
            onPlayWithTemplate={handlePlayWithTemplate}
            onNotify={notify}
          />
        )}

        {tab === 'profile' && (
          <ProfileScreen
            profile={currentProfile}
            matchHistory={matchHistory}
            onUpdateProfile={async (data) => {
              if (playerSession.authType === 'guest') {
                saveCachedGuestPrefs(data.username, data.avatarId);
                if (playerSession.isOffline || isOffline || !playerSession.sessionToken) {
                  const updatedSess: PlayerSession = {
                    ...playerSession,
                    nickname: data.username,
                    avatarId: data.avatarId,
                  };
                  setPlayerSession(updatedSess);
                  setCurrentProfile(sessionToGuestProfile(updatedSess, currentProfile.equippedCosmetics));
                  notify('Guest profile updated locally');
                  return;
                }
                const res = await api.renameGuestSession(
                  playerSession.sessionToken,
                  data.username,
                  data.avatarId
                );
                const updatedSess = guestSessionToPlayerSession(res.session, false);
                setPlayerSession(updatedSess);
                setCurrentProfile({
                  ...res.profile,
                  equippedCosmetics: currentProfile.equippedCosmetics,
                });
                notify('Guest nickname updated');
                return;
              }
              const updated = await api.updateProfile(currentProfile.id, data);
              setCurrentProfile(updated);
              notify('Profile updated');
            }}
            onUpdateCosmetics={async (cosmetics) => {
              if (playerSession.isOffline || isOffline) {
                setCurrentProfile((prev) =>
                  prev ? { ...prev, equippedCosmetics: cosmetics } : prev
                );
                notify('Cosmetics updated locally');
                return;
              }
              await api.updateCosmetics(currentProfile.id, cosmetics);
              await refreshPlatformData(currentProfile.id);
              notify('Cosmetics updated');
            }}
            onSignOut={handleSwitchGuest}
          />
        )}

        <BottomNav
          activeTab={tab}
          onSelect={(nextTab) => setRoute({ view: 'tab', tab: nextTab })}
          hasOngoingMatch={ongoingMatches.some((m) => m.isYourTurn)}
        />
      </div>
    );
  };

  return (
    <div className="ens-shell-outer">
      <div className="ens-app-viewport">
        {isOffline && (
          <div
            style={{
              background: '#dc2626',
              color: '#fff',
              fontSize: 12,
              fontWeight: 800,
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              zIndex: 80,
            }}
          >
            <WifiOff size={14} />
            <span>Offline — Solo works offline; multiplayer paused</span>
          </div>
        )}

        {toast && <div className="ens-toast">{toast}</div>}

        {renderScreen()}

        {showNotifModal && (
          <div className="ens-modal-backdrop" onClick={() => setShowNotifModal(false)}>
            <div className="ens-modal-card" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#ffffff' }}>Notifications</h3>
                <button
                  type="button"
                  onClick={() => setShowNotifModal(false)}
                  className="ens-btn-white"
                  style={{ minHeight: 32, padding: '4px 12px', fontSize: 12 }}
                >
                  Close
                </button>
              </div>
              {notifications.length === 0 ? (
                <div style={{ fontSize: 13.5, color: '#d4dcff', fontWeight: 700 }}>You&apos;re all caught up!</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="ens-white-card"
                      onClick={() => {
                        setShowNotifModal(false);
                        if (n.matchId) setRoute({ view: 'match', matchId: n.matchId });
                      }}
                      style={{ cursor: n.matchId ? 'pointer' : 'default' }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>{n.title}</div>
                      <div style={{ fontSize: 12.5, color: '#cdd6ff', fontWeight: 600, marginTop: 2 }}>{n.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
