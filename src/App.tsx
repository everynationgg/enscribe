import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { WifiOff } from 'lucide-react';
import {
  DEFAULT_GRIDIT_MODS,
  GameModuleId,
  GridItBoardSize,
  GridItMatchDelta,
  GridItMatchMode,
  GridItMatchStateClient,
  GridItModConfig,
  GridItRoom,
  GridItShapeId,
  GuessItAdventureClaimResult,
  GuessItAdventureProgressClient,
  GuessItMatchStateClient,
  GuessItRoom,
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
  TwistItMatchView,
  TwistItRoomView,
  TwistItSoloDifficulty,
  TwistItSoloStats,
  ChangeItAdventureClaimResult,
  ChangeItAdventureProgressClient,
  ChangeItLeaderboardResponse,
  ChangeItMatchStateClient,
  ChangeItRoom,
  ChainItPracticeConfig,
} from '../shared/types';
import {
  ALL_CHANGEIT_ADVENTURE_STAGES,
} from '../shared/changeit/adventureCatalog';
import {
  claimOfflineChangeItReward,
  getOfflineChangeItAdventureProgress,
  isOfflineChangeItMatchId,
  nextOfflineChangeItClassicSolo,
  retryOfflineChangeItMatch,
  startOfflineChangeItClassicSolo,
  startOfflineChangeItStage,
  submitOfflineChangeItTransform,
  useOfflineChangeItHint,
} from './games/changeit/offlineAdventure';
import { ChangeItHomeScreen } from './screens/changeit/ChangeItHomeScreen';
import { ChangeItRankedScreen } from './screens/changeit/ChangeItRankedScreen';
import { ChangeItAdventureScreen } from './screens/changeit/ChangeItAdventureScreen';
import { ChangeItRoomsScreen } from './screens/changeit/ChangeItRoomsScreen';
import { ChangeItLobbyScreen } from './screens/changeit/ChangeItLobbyScreen';
import { ChangeItLeaderboardScreen } from './screens/changeit/ChangeItLeaderboardScreen';
import { ChangeItGameplayScreen } from './screens/changeit/ChangeItGameplayScreen';
import {
  getOfflineTwistItSoloStats,
  isOfflineTwistItMatch,
  startOfflineTwistItSolo,
  submitOfflineTwistItWord,
} from './games/twistit/offlineSolo';
import { TwistItHomeScreen } from './screens/twistit/TwistItHomeScreen';
import { TwistItMultiplayerScreen } from './screens/twistit/TwistItMultiplayerScreen';
import { TwistItLobbyScreen } from './screens/twistit/TwistItLobbyScreen';
import { TwistItGameplayScreen } from './screens/twistit/TwistItGameplayScreen';
import { api, setGuestSessionToken } from './services/api';
import { getSocket } from './services/socket';
import {
  GAME_DISPLAY_NAMES,
  PendingRoomInvite,
  clearRoomInviteFromUrl,
  parseRoomInviteFromUrl,
} from './services/shareLink';
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
  ChainItPracticeStats,
  getOfflineOfficialTemplates,
  getOfflineSoloMatch,
  getOfflineSoloStages,
  isOfflineSoloMatchId,
  loadChainItPracticeStats,
  recordChainItPracticeChainComplete,
  rematchOfflineSoloOrPractice,
  skipOfflinePracticeWord,
  startOfflinePracticeMatch,
  startOfflineSoloMatch,
  submitOfflineSoloGuess,
  tickOfflinePracticeMatch,
  useOfflinePracticeHint,
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
import { GuessItEntryScreen } from './screens/guessit/GuessItEntryScreen';
import { GuessItModeSelectScreen } from './screens/guessit/GuessItModeSelectScreen';
import { GuessItLobbyScreen } from './screens/guessit/GuessItLobbyScreen';
import { GuessItClassicGameplayScreen } from './screens/guessit/GuessItClassicGameplayScreen';
import { GuessItCrosswordGameplayScreen } from './screens/guessit/GuessItCrosswordGameplayScreen';
import { GuessItAdventureMapScreen } from './screens/guessit/GuessItAdventureMapScreen';
import { GuessItResultsScreen } from './screens/guessit/GuessItResultsScreen';
import { GuessItAdventureRewardScreen } from './screens/guessit/GuessItAdventureRewardScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PlayScreen } from './screens/PlayScreen';
import { SoloScreen } from './screens/SoloScreen';
import { RoomsBrowserScreen } from './screens/RoomsBrowserScreen';
import { CreateRoomScreen } from './screens/CreateRoomScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { TemplatesScreen } from './screens/TemplatesScreen';
import { GameTemplatesScreen, GuessItCustomPack } from './screens/GameTemplatesScreen';
import { ClassicSoloSetupScreen } from './screens/ClassicSoloSetupScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameplayScreen } from './screens/GameplayScreen';

type ActiveRoute =
  | { view: 'hub' }
  | { view: 'game_intro'; gameId: 'chain_clash' | 'gridit' | 'guessit' | 'twistit' | 'changeit' }
  | { view: 'changeit_home' }
  | { view: 'changeit_solo_setup' }
  | { view: 'changeit_templates' }
  | { view: 'changeit_ranked' }
  | { view: 'changeit_adventure' }
  | { view: 'changeit_rooms' }
  | { view: 'changeit_lobby'; roomId: string }
  | { view: 'changeit_match'; matchId: string }
  | { view: 'changeit_leaderboard' }
  | { view: 'guessit_entry' }
  | { view: 'guessit_solo_setup' }
  | { view: 'guessit_templates' }
  | { view: 'guessit_modes'; pathway?: 'rooms' | 'ranked' }
  | { view: 'guessit_leaderboard' }
  | { view: 'guessit_lobby'; roomId: string }
  | { view: 'guessit_match'; matchId: string }
  | { view: 'guessit_adventure' }
  | { view: 'guessit_adventure_reward' }
  | { view: 'twistit_home' }
  | { view: 'twistit_solo_setup' }
  | { view: 'twistit_templates' }
  | { view: 'twistit_multiplayer' }
  | { view: 'twistit_lobby'; roomCode: string }
  | { view: 'twistit_match'; matchId: string }
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
  | { view: 'solo'; tab?: 'adventure' | 'practice' }
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
    shapeId: 'square',
    sizeId: 'large',
    durationSeconds: 120,
    mods: DEFAULT_GRIDIT_MODS,
    language: 'en',
  });
  const [gridItPublicRooms, setGridItPublicRooms] = useState<GridItRoom[]>([]);
  const [activeGridItRoom, setActiveGridItRoom] = useState<GridItRoom | null>(null);
  const [activeGridItMatch, setActiveGridItMatch] = useState<GridItMatchStateClient | null>(null);
  const [gridItQuickQueued, setGridItQuickQueued] = useState(false);
  const [gridItRankedQueued, setGridItRankedQueued] = useState(false);
  const [guessItPublicRooms, setGuessItPublicRooms] = useState<GuessItRoom[]>([]);
  const [activeGuessItRoom, setActiveGuessItRoom] = useState<GuessItRoom | null>(null);
  const [activeGuessItMatch, setActiveGuessItMatch] = useState<GuessItMatchStateClient | null>(null);
  const [guessItAdventureProgress, setGuessItAdventureProgress] =
    useState<GuessItAdventureProgressClient | null>(null);
  const [guessItAdventureClaim, setGuessItAdventureClaim] =
    useState<GuessItAdventureClaimResult | null>(null);
  const [guessItRankedKey, setGuessItRankedKey] = useState<string | null>(null);
  const [twistItPublicRooms, setTwistItPublicRooms] = useState<TwistItRoomView[]>([]);
  const [activeTwistItRoom, setActiveTwistItRoom] = useState<TwistItRoomView | null>(null);
  const [activeTwistItMatch, setActiveTwistItMatch] = useState<TwistItMatchView | null>(null);
  const [twistItSoloStats, setTwistItSoloStats] = useState<TwistItSoloStats>(() =>
    getOfflineTwistItSoloStats()
  );
  const [lastTwistItSoloConfig, setLastTwistItSoloConfig] = useState<{
    difficulty: TwistItSoloDifficulty;
    timeLimitSeconds: number;
  }>({ difficulty: 'normal', timeLimitSeconds: 0 });
  const [twistItQuickQueued, setTwistItQuickQueued] = useState(false);

  const [changeItPublicRooms, setChangeItPublicRooms] = useState<ChangeItRoom[]>([]);
  const [activeChangeItRoom, setActiveChangeItRoom] = useState<ChangeItRoom | null>(null);
  const [activeChangeItMatch, setActiveChangeItMatch] = useState<ChangeItMatchStateClient | null>(null);
  const [changeItAdventureProgress, setChangeItAdventureProgress] =
    useState<ChangeItAdventureProgressClient | null>(null);
  const [changeItAdventureClaim, setChangeItAdventureClaim] =
    useState<ChangeItAdventureClaimResult | null>(null);
  const [changeItRankedFormat, setChangeItRankedFormat] = useState<
    'classic_sprint' | 'classic_precision' | null
  >(null);
  const [changeItLeaderboardData, setChangeItLeaderboardData] =
    useState<ChangeItLeaderboardResponse | null>(null);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [ongoingMatches, setOngoingMatches] = useState<OngoingMatchSummary[]>([]);
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  const [soloStages, setSoloStages] = useState<SoloStage[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchHistorySummary[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [activeMatch, setActiveMatch] = useState<MatchStateClient | null>(null);
  const [chainItPracticeStats, setChainItPracticeStats] = useState<ChainItPracticeStats>({
    chainsCompleted: 0,
    wordsSolved: 0,
    currentStreak: 0,
    bestStreak: 0,
  });
  const practiceSkippedMatchIdsRef = useRef<Set<string>>(new Set());
  const practiceSolvedWordsRef = useRef<Record<string, number>>({});
  const [rankedQueued, setRankedQueued] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingInvite, setPendingInvite] = useState<PendingRoomInvite | null>(() =>
    parseRoomInviteFromUrl()
  );
  const [joiningInvite, setJoiningInvite] = useState(false);
  const inviteJoinInFlightRef = useRef(false);

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
    setChainItPracticeStats(loadChainItPracticeStats(session.playerId));
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
        setChainItPracticeStats(loadChainItPracticeStats(pid));

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
  const pendingChainMatchByIdRef = useRef<Map<string, MatchStateClient>>(new Map());
  const pendingGridItMatchByIdRef = useRef<Map<string, GridItMatchStateClient>>(new Map());
  const pendingGuessItMatchByIdRef = useRef<Map<string, GuessItMatchStateClient>>(new Map());
  const pendingChangeItMatchByIdRef = useRef<Map<string, ChangeItMatchStateClient>>(new Map());
  const claimedChangeItMatchIdsRef = useRef<Set<string>>(new Set());
  const claimedAdventureMatchIdsRef = useRef<Set<string>>(new Set());
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
      if (
        current.view === 'gridit_home' ||
        current.view === 'guessit_entry' ||
        current.view === 'twistit_home' ||
        current.view === 'changeit_home'
      ) {
        setRoute({ view: 'hub' });
        return;
      }
      if (
        current.view === 'changeit_ranked' ||
        current.view === 'changeit_adventure' ||
        current.view === 'changeit_rooms' ||
        current.view === 'changeit_leaderboard'
      ) {
        setRoute({ view: 'changeit_home' });
        return;
      }
      if (current.view === 'changeit_lobby') {
        setActiveChangeItRoom(null);
        setRoute({ view: 'changeit_rooms' });
        return;
      }
      if (current.view === 'changeit_match') {
        const wasAdv = activeChangeItMatch?.mode === 'solo_adventure';
        setActiveChangeItMatch(null);
        setRoute({ view: wasAdv ? 'changeit_adventure' : 'changeit_home' });
        return;
      }
      if (current.view === 'twistit_multiplayer') {
        setRoute({ view: 'twistit_home' });
        return;
      }
      if (current.view === 'twistit_lobby') {
        setActiveTwistItRoom(null);
        setRoute({ view: 'twistit_multiplayer' });
        return;
      }
      if (current.view === 'twistit_match') {
        const roomCode = activeTwistItMatch?.roomCode ?? null;
        setActiveTwistItMatch(null);
        setRoute(roomCode ? { view: 'twistit_lobby', roomCode } : { view: 'twistit_home' });
        return;
      }
      if (current.view === 'guessit_modes' || current.view === 'guessit_adventure' || current.view === 'guessit_leaderboard') {
        setRoute({ view: 'guessit_entry' });
        return;
      }
      if (current.view === 'guessit_lobby') {
        setActiveGuessItRoom(null);
        setRoute({ view: 'guessit_modes' });
        return;
      }
      if (current.view === 'guessit_match') {
        const wasAdventure = activeGuessItMatch?.mode === 'solo_adventure';
        setActiveGuessItMatch(null);
        setRoute({ view: wasAdventure ? 'guessit_adventure' : 'guessit_modes' });
        return;
      }
      if (current.view === 'guessit_adventure_reward') {
        setRoute({ view: 'guessit_adventure' });
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
    if (activeProfileId && !playerSession?.isOffline && route.view === 'guessit_modes') {
      api.listGuessItPublicRooms().then(setGuessItPublicRooms).catch(() => undefined);
    }
    if (activeProfileId && !playerSession?.isOffline && route.view === 'guessit_adventure') {
      api
        .getGuessItAdventureProgress(activeProfileId)
        .then(setGuessItAdventureProgress)
        .catch(() => undefined);
    }
    if (route.view === 'twistit_home') {
      if (activeProfileId && !playerSession?.isOffline) {
        api.getTwistItSoloStats(activeProfileId).then(setTwistItSoloStats).catch(() => undefined);
      } else {
        setTwistItSoloStats(getOfflineTwistItSoloStats());
      }
    }
    if (activeProfileId && !playerSession?.isOffline && route.view === 'twistit_multiplayer') {
      api.listTwistItPublicRooms().then(setTwistItPublicRooms).catch(() => undefined);
    }
    if (route.view === 'changeit_home' || route.view === 'changeit_adventure') {
      if (activeProfileId && !playerSession?.isOffline && !isOffline) {
        api
          .getChangeItAdventureProgress(activeProfileId)
          .then(setChangeItAdventureProgress)
          .catch(() => {
            if (activeProfileId) {
              setChangeItAdventureProgress(getOfflineChangeItAdventureProgress(activeProfileId));
            }
          });
      } else if (activeProfileId) {
        setChangeItAdventureProgress(getOfflineChangeItAdventureProgress(activeProfileId));
      }
    }
    if (activeProfileId && !playerSession?.isOffline && route.view === 'changeit_rooms') {
      api.listChangeItPublicRooms().then(setChangeItPublicRooms).catch(() => undefined);
    }
    if (activeProfileId && !playerSession?.isOffline && route.view === 'changeit_ranked') {
      api.getChangeItLeaderboard(activeProfileId).then(setChangeItLeaderboardData).catch(() => undefined);
    }
  }, [activeProfileId, playerSession?.isOffline, isOffline, route.view]);

  // Realtime connection via Fly.io Socket.IO WebSocket (listeners bound once per active player)
  useEffect(() => {
    if (!activeProfileId || playerSession?.isOffline) return;
    const socket = getSocket();
    socket.setActivePlayerId(activeProfileId);

    const identify = () => {
      socket.emit('auth:identify', activeProfileId);
      const curr = routeRef.current;
      if (curr.view === 'lobby' || curr.view === 'gridit_lobby') {
        socket.emit('room:join_channel', curr.roomId);
      }
      if (curr.view === 'match' && !isOfflineSoloMatchId(curr.matchId)) {
        socket.emit('match:join_channel', { matchId: curr.matchId, playerId: activeProfileId });
      }
      if (curr.view === 'gridit_match') {
        socket.emit('gridit:join_match', curr.matchId);
      }
    };

    if (socket.connected) identify();
    socket.on('connect', identify);

    const onRoomUpdated = (room: Room) => {
      setActiveRoom((prev) => (prev && prev.id === room.id ? room : prev));
    };

    const onRoomMatchStarted = ({ roomId, matchId }: { roomId: string; matchId: string }) => {
      const pending = pendingChainMatchByIdRef.current.get(matchId);
      if (pending) {
        pendingChainMatchByIdRef.current.delete(matchId);
        setActiveMatch(pending);
      }
      setRoute((prev) => {
        if (prev.view === 'lobby' && prev.roomId === roomId) {
          return { view: 'match', matchId };
        }
        return prev;
      });
    };

    const onMatchState = (match: MatchStateClient) => {
      const curr = routeRef.current;
      if (curr.view === 'match' && curr.matchId === match.id) {
        setActiveMatch(match);
      } else {
        pendingChainMatchByIdRef.current.set(match.id, match);
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
      const curr = routeRef.current;
      if (curr.view === 'rooms' || (curr.view === 'tab' && curr.tab === 'play')) {
        api.listPublicRooms().then(setPublicRooms).catch(() => undefined);
      }
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
      if (routeRef.current.view === 'gridit_rooms') {
        api.listGridItPublicRooms().then(setGridItPublicRooms).catch(() => undefined);
      }
    };

    const onGridItMatchStarted = ({ roomId, matchId }: { roomId: string; matchId: string }) => {
      const pending = pendingGridItMatchByIdRef.current.get(matchId);
      if (pending) {
        pendingGridItMatchByIdRef.current.delete(matchId);
        setActiveGridItMatch(pending);
      }
      setRoute((prev) => {
        if (prev.view === 'gridit_lobby' && prev.roomId === roomId) {
          return { view: 'gridit_match', matchId };
        }
        return prev;
      });
    };

    const onGridItMatched = ({ matchId }: { matchId: string }) => {
      const pending = pendingGridItMatchByIdRef.current.get(matchId);
      if (pending) {
        pendingGridItMatchByIdRef.current.delete(matchId);
        setActiveGridItMatch(pending);
      }
      setGridItQuickQueued(false);
      setGridItRankedQueued(false);
      notify('GridIt opponent found!');
      setRoute({ view: 'gridit_match', matchId });
    };

    const onGridItMatchState = (match: GridItMatchStateClient) => {
      const curr = routeRef.current;
      if (curr.view === 'gridit_match' && curr.matchId === match.id) {
        setActiveGridItMatch(match);
      } else {
        pendingGridItMatchByIdRef.current.set(match.id, match);
      }
    };

    const onGridItMatchDelta = (delta: GridItMatchDelta) => {
      setActiveGridItMatch((prev) => {
        if (!prev || prev.id !== delta.id) return prev;
        const nextPlayers: GridItMatchStateClient['players'] = { ...prev.players };
        for (const [pid, summary] of Object.entries(delta.players)) {
          const existing = prev.players[pid];
          if (existing) {
            nextPlayers[pid] = {
              ...existing,
              isOnline: summary.isOnline,
              score: summary.score,
              rawScore: summary.rawScore,
              normalizedScorePercent: summary.normalizedScorePercent,
              wordsFoundCount: summary.wordsFoundCount,
              bestWord: summary.bestWord,
              comboCount: summary.comboCount,
              isWinner: summary.isWinner,
            };
          }
        }
        return {
          ...prev,
          status: delta.status,
          serverNowMs: delta.serverNowMs,
          endsAtMs: delta.endsAtMs,
          players: nextPlayers,
          spectators: delta.spectators,
          winnerIds: delta.winnerIds,
          messages: delta.messages,
        };
      });
    };

    const onGridItRematch = ({ newMatchId }: { newMatchId: string }) => {
      notify('GridIt rematch started!');
      setRoute({ view: 'gridit_match', matchId: newMatchId });
    };

    const onGuessItRoomUpdated = (room: GuessItRoom) => {
      setActiveGuessItRoom((prev) => (prev && prev.id === room.id ? room : prev));
    };

    const onGuessItRoomsUpdated = () => {
      if (routeRef.current.view === 'guessit_modes') {
        api.listGuessItPublicRooms().then(setGuessItPublicRooms).catch(() => undefined);
      }
    };

    const onGuessItMatchStarted = ({ roomId, matchId }: { roomId: string; matchId: string }) => {
      const pending = pendingGuessItMatchByIdRef.current.get(matchId);
      if (pending) {
        pendingGuessItMatchByIdRef.current.delete(matchId);
        setActiveGuessItMatch(pending);
      }
      setRoute((prev) => {
        if (prev.view === 'guessit_lobby' && prev.roomId === roomId) {
          return { view: 'guessit_match', matchId };
        }
        return prev;
      });
    };

    const onGuessItMatched = ({ matchId }: { matchId: string }) => {
      const pending = pendingGuessItMatchByIdRef.current.get(matchId);
      if (pending) {
        pendingGuessItMatchByIdRef.current.delete(matchId);
        setActiveGuessItMatch(pending);
      }
      setGuessItRankedKey(null);
      notify('Ranked GuessIt match found!');
      setRoute({ view: 'guessit_match', matchId });
    };

    const onGuessItMatchState = (match: GuessItMatchStateClient) => {
      const curr = routeRef.current;
      if (curr.view === 'guessit_match' && curr.matchId === match.id) {
        setActiveGuessItMatch(match);
      } else {
        pendingGuessItMatchByIdRef.current.set(match.id, match);
      }
    };

    const onGuessItRematch = ({ newMatchId }: { newMatchId: string }) => {
      notify('GuessIt rematch started!');
      setRoute({ view: 'guessit_match', matchId: newMatchId });
    };

    const onTwistItRoomUpdated = (room: TwistItRoomView) => {
      setActiveTwistItRoom((prev) => (prev && prev.code === room.code ? room : prev));
    };

    const onTwistItRoomsUpdated = () => {
      if (routeRef.current.view === 'twistit_multiplayer') {
        api.listTwistItPublicRooms().then(setTwistItPublicRooms).catch(() => undefined);
      }
    };

    const onTwistItMatchStarted = ({ match }: { roomCode: string; match: TwistItMatchView }) => {
      setActiveTwistItMatch(match);
      setRoute({ view: 'twistit_match', matchId: match.id });
    };

    const onTwistItMatchState = (match: TwistItMatchView) => {
      setActiveTwistItMatch((prev) => {
        if (routeRef.current.view === 'twistit_match' && routeRef.current.matchId === match.id) {
          return match;
        }
        return prev?.id === match.id ? match : prev;
      });
    };

    const onTwistItQuickMatched = ({ room, match }: { room: TwistItRoomView; match: TwistItMatchView }) => {
      setTwistItQuickQueued(false);
      setActiveTwistItRoom(room);
      setActiveTwistItMatch(match);
      notify('1v1 Speed Race opponent found!');
      setRoute({ view: 'twistit_match', matchId: match.id });
    };

    const onChangeItRoomUpdated = (room: ChangeItRoom) => {
      setActiveChangeItRoom((prev) => (prev && prev.id === room.id ? room : prev));
    };

    const onChangeItRoomsUpdated = () => {
      if (routeRef.current.view === 'changeit_rooms') {
        api.listChangeItPublicRooms().then(setChangeItPublicRooms).catch(() => undefined);
      }
    };

    const onChangeItMatchStarted = ({ roomId, matchId }: { roomId: string; matchId: string }) => {
      const pending = pendingChangeItMatchByIdRef.current.get(matchId);
      if (pending) {
        pendingChangeItMatchByIdRef.current.delete(matchId);
        setActiveChangeItMatch(pending);
      }
      setRoute((prev) => {
        if (prev.view === 'changeit_lobby' && prev.roomId === roomId) {
          return { view: 'changeit_match', matchId };
        }
        return prev;
      });
    };

    const onChangeItMatched = ({ matchId }: { matchId: string }) => {
      const pending = pendingChangeItMatchByIdRef.current.get(matchId);
      if (pending) {
        pendingChangeItMatchByIdRef.current.delete(matchId);
        setActiveChangeItMatch(pending);
      }
      setChangeItRankedFormat(null);
      notify('Ranked ChangeIt opponent found!');
      setRoute({ view: 'changeit_match', matchId });
    };

    const onChangeItMatchState = (match: ChangeItMatchStateClient) => {
      const curr = routeRef.current;
      if (curr.view === 'changeit_match' && curr.matchId === match.id) {
        setActiveChangeItMatch(match);
      } else {
        pendingChangeItMatchByIdRef.current.set(match.id, match);
      }
    };

    const onChangeItRematch = ({ newMatchId }: { newMatchId: string }) => {
      notify('ChangeIt rematch started!');
      setRoute({ view: 'changeit_match', matchId: newMatchId });
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
    socket.on('gridit:match_delta', onGridItMatchDelta);
    socket.on('gridit:rematch', onGridItRematch);
    socket.on('guessit:room_updated', onGuessItRoomUpdated);
    socket.on('guessit:rooms_updated', onGuessItRoomsUpdated);
    socket.on('guessit:match_started', onGuessItMatchStarted);
    socket.on('guessit:matched', onGuessItMatched);
    socket.on('guessit:match_state', onGuessItMatchState);
    socket.on('guessit:rematch', onGuessItRematch);
    socket.on('twistit:room_updated', onTwistItRoomUpdated);
    socket.on('twistit:rooms_updated', onTwistItRoomsUpdated);
    socket.on('twistit:match_started', onTwistItMatchStarted);
    socket.on('twistit:match_state', onTwistItMatchState);
    socket.on('twistit:quick_matched', onTwistItQuickMatched);
    socket.on('changeit:room_updated', onChangeItRoomUpdated);
    socket.on('changeit:rooms_updated', onChangeItRoomsUpdated);
    socket.on('changeit:match_started', onChangeItMatchStarted);
    socket.on('changeit:matched', onChangeItMatched);
    socket.on('changeit:match_state', onChangeItMatchState);
    socket.on('changeit:rematch', onChangeItRematch);

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
      socket.off('gridit:match_delta', onGridItMatchDelta);
      socket.off('gridit:rematch', onGridItRematch);
      socket.off('guessit:room_updated', onGuessItRoomUpdated);
      socket.off('guessit:rooms_updated', onGuessItRoomsUpdated);
      socket.off('guessit:match_started', onGuessItMatchStarted);
      socket.off('guessit:matched', onGuessItMatched);
      socket.off('guessit:match_state', onGuessItMatchState);
      socket.off('guessit:rematch', onGuessItRematch);
      socket.off('twistit:room_updated', onTwistItRoomUpdated);
      socket.off('twistit:rooms_updated', onTwistItRoomsUpdated);
      socket.off('twistit:match_started', onTwistItMatchStarted);
      socket.off('twistit:match_state', onTwistItMatchState);
      socket.off('twistit:quick_matched', onTwistItQuickMatched);
      socket.off('changeit:room_updated', onChangeItRoomUpdated);
      socket.off('changeit:rooms_updated', onChangeItRoomsUpdated);
      socket.off('changeit:match_started', onChangeItMatchStarted);
      socket.off('changeit:matched', onChangeItMatched);
      socket.off('changeit:match_state', onChangeItMatchState);
      socket.off('changeit:rematch', onChangeItRematch);
    };
  }, [activeProfileId, playerSession?.isOffline, notify, refreshPlatformData]);

  // Lightweight channel join/leave sync when navigating between lobbies and matches
  useEffect(() => {
    if (!activeProfileId || playerSession?.isOffline) return;
    const socket = getSocket();
    if (
      route.view === 'lobby' ||
      route.view === 'gridit_lobby' ||
      route.view === 'guessit_lobby' ||
      route.view === 'changeit_lobby'
    ) {
      const rid = route.roomId;
      socket.emit('room:join_channel', rid);
      return () => {
        socket.emit('room:leave_channel', rid);
      };
    }
    if (route.view === 'changeit_match' && !isOfflineChangeItMatchId(route.matchId)) {
      const mid = route.matchId;
      socket.emit('changeit:join_match', mid);
      return () => {
        socket.emit('changeit:leave_match', mid);
      };
    }
    if (route.view === 'match' && !isOfflineSoloMatchId(route.matchId)) {
      socket.emit('match:join_channel', { matchId: route.matchId, playerId: activeProfileId });
      return;
    }
    if (route.view === 'gridit_match') {
      const mid = route.matchId;
      socket.emit('gridit:join_match', mid);
      return () => {
        socket.emit('gridit:leave_match', mid);
      };
    }
    if (route.view === 'guessit_match') {
      const mid = route.matchId;
      socket.emit('guessit:join_match', mid);
      return () => {
        socket.emit('guessit:leave_match', mid);
      };
    }
    if (route.view === 'twistit_lobby') {
      const code = route.roomCode;
      socket.emit('room:join_channel', code);
      return () => {
        socket.emit('room:leave_channel', code);
      };
    }
    if (route.view === 'twistit_match' && !isOfflineTwistItMatch(route.matchId)) {
      const mid = route.matchId;
      socket.emit('twistit:join_match', mid);
      return () => {
        socket.emit('twistit:leave_match', mid);
      };
    }
  }, [
    activeProfileId,
    playerSession?.isOffline,
    route.view,
    (route as any).roomId,
    (route as any).roomCode,
    (route as any).matchId,
  ]);

  const activeGridItRoomRef = useRef(activeGridItRoom);
  const activeGridItMatchRef = useRef(activeGridItMatch);
  const activeGuessItRoomRef = useRef(activeGuessItRoom);
  const activeGuessItMatchRef = useRef(activeGuessItMatch);
  const activeRoomRef = useRef(activeRoom);
  const activeMatchRef = useRef(activeMatch);
  const typingThrottleTimerRef = useRef<number | null>(null);
  const lastTypingEmitAtRef = useRef(0);
  const pendingTypingPayloadRef = useRef<{ matchId: string; playerId: string; preview: string } | null>(null);
  activeGridItRoomRef.current = activeGridItRoom;
  activeGridItMatchRef.current = activeGridItMatch;
  activeGuessItRoomRef.current = activeGuessItRoom;
  activeGuessItMatchRef.current = activeGuessItMatch;
  activeRoomRef.current = activeRoom;
  activeMatchRef.current = activeMatch;

  // Adaptive fallback sync for ChainIt lobbies/matches (18s drift check when WebSocket connected, 4s fallback when disconnected)
  useEffect(() => {
    if (!activeProfileId || playerSession?.isOffline || (route.view !== 'lobby' && route.view !== 'match')) return;
    if (route.view === 'match' && isOfflineSoloMatchId(route.matchId)) return;
    let timer: number | null = null;
    const scheduleTick = () => {
      const delayMs = getSocket().connected ? 18000 : 4000;
      timer = window.setTimeout(() => {
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
        scheduleTick();
      }, delayMs);
    };
    scheduleTick();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [route, activeProfileId, playerSession?.isOffline]);

  // Route restoration for GridIt Multiplayer lobbies and matches (skips duplicate fetch when state is already populated)
  useEffect(() => {
    if (!activeProfileId || playerSession?.isOffline) return;
    if (route.view === 'gridit_lobby') {
      if (activeGridItRoomRef.current?.id === route.roomId) return;
      api
        .getGridItRoom(route.roomId)
        .then((r) => {
          setActiveGridItRoom(r);
          if (r.status === 'in_progress' && r.activeMatchId) {
            setRoute({ view: 'gridit_match', matchId: r.activeMatchId });
          }
        })
        .catch((err) => {
          notify(err.message || 'GridIt room not found');
          setActiveGridItRoom(null);
          setRoute({ view: 'gridit_rooms' });
        });
    } else if (route.view === 'gridit_match') {
      const pending = pendingGridItMatchByIdRef.current.get(route.matchId);
      if (pending) {
        pendingGridItMatchByIdRef.current.delete(route.matchId);
        setActiveGridItMatch(pending);
        if (pending.board) return;
      }
      if (activeGridItMatchRef.current?.id === route.matchId && activeGridItMatchRef.current.board) {
        return;
      }
      api
        .getGridItMatch(route.matchId, activeProfileId)
        .then(setActiveGridItMatch)
        .catch((err) => {
          notify(err.message || 'GridIt match not found');
          setActiveGridItMatch(null);
          setRoute({ view: 'gridit_home' });
        });
    }
  }, [route, activeProfileId, playerSession?.isOffline, notify]);

  // One-shot board reveal fetch if match arrived before revealAtMs
  useEffect(() => {
    if (!activeProfileId || playerSession?.isOffline || route.view !== 'gridit_match') return;
    if (!activeGridItMatch || activeGridItMatch.id !== route.matchId || activeGridItMatch.board) return;
    const serverNowApprox = activeGridItMatch.serverNowMs;
    const delayMs = Math.max(60, activeGridItMatch.revealAtMs - serverNowApprox + 30);
    const t = window.setTimeout(() => {
      api
        .getGridItMatch(
          route.matchId,
          activeProfileId,
          activeGridItMatchRef.current?.spectatingPlayerId ?? undefined
        )
        .then(setActiveGridItMatch)
        .catch(() => undefined);
    }, delayMs);
    return () => window.clearTimeout(t);
  }, [activeProfileId, playerSession?.isOffline, route, activeGridItMatch]);

  // Adaptive fallback sync for GridIt lobbies/matches (15s safety reconciliation when realtime connected, 3s fallback when disconnected)
  useEffect(() => {
    if (
      !activeProfileId ||
      playerSession?.isOffline ||
      (route.view !== 'gridit_lobby' &&
        route.view !== 'gridit_match' &&
        route.view !== 'guessit_lobby' &&
        route.view !== 'guessit_match' &&
        route.view !== 'twistit_lobby' &&
        route.view !== 'twistit_match' &&
        route.view !== 'changeit_lobby' &&
        route.view !== 'changeit_match')
    ) {
      return;
    }
    if (route.view === 'twistit_match' && isOfflineTwistItMatch(route.matchId)) {
      return;
    }
    if (route.view === 'changeit_match' && isOfflineChangeItMatchId(route.matchId)) {
      return;
    }
    let timer: number | null = null;
    const scheduleTick = () => {
      const delayMs = getSocket().connected ? 12000 : 2500;
      timer = window.setTimeout(() => {
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
              activeGridItMatchRef.current?.spectatingPlayerId ?? undefined
            )
            .then(setActiveGridItMatch)
            .catch(() => undefined);
        } else if (route.view === 'guessit_lobby') {
          api
            .getGuessItRoom(route.roomId)
            .then((r) => {
              setActiveGuessItRoom(r);
              if (r.status === 'in_progress' && r.activeMatchId) {
                setRoute({ view: 'guessit_match', matchId: r.activeMatchId });
              }
            })
            .catch(() => undefined);
        } else if (route.view === 'guessit_match') {
          api
            .getGuessItMatch(route.matchId, activeProfileId)
            .then(setActiveGuessItMatch)
            .catch(() => undefined);
        } else if (route.view === 'twistit_lobby') {
          api
            .getTwistItRoom(route.roomCode)
            .then((r) => {
              setActiveTwistItRoom(r);
              if (r.status === 'in_match' && r.activeMatchId) {
                setRoute({ view: 'twistit_match', matchId: r.activeMatchId });
              }
            })
            .catch(() => undefined);
        } else if (route.view === 'twistit_match') {
          api
            .getTwistItMatch(route.matchId, activeProfileId)
            .then(setActiveTwistItMatch)
            .catch(() => undefined);
        } else if (route.view === 'changeit_lobby') {
          api
            .getChangeItRoom(route.roomId)
            .then((r) => {
              setActiveChangeItRoom(r);
              if (r.status === 'in_progress' && r.activeMatchId) {
                setRoute({ view: 'changeit_match', matchId: r.activeMatchId });
              }
            })
            .catch(() => undefined);
        } else if (route.view === 'changeit_match') {
          api
            .getChangeItMatch(route.matchId, activeProfileId)
            .then(setActiveChangeItMatch)
            .catch(() => undefined);
        }
        scheduleTick();
      }, delayMs);
    };
    scheduleTick();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [route, activeProfileId, playerSession?.isOffline]);

  // Route restoration for GuessIt Multiplayer lobbies & matches
  useEffect(() => {
    if (!activeProfileId || playerSession?.isOffline) return;
    if (route.view === 'guessit_lobby') {
      if (activeGuessItRoomRef.current?.id === route.roomId) return;
      api
        .getGuessItRoom(route.roomId)
        .then((r) => {
          setActiveGuessItRoom(r);
          if (r.status === 'in_progress' && r.activeMatchId) {
            setRoute({ view: 'guessit_match', matchId: r.activeMatchId });
          }
        })
        .catch((err) => {
          notify(err.message || 'GuessIt room not found');
          setActiveGuessItRoom(null);
          setRoute({ view: 'guessit_modes' });
        });
    } else if (route.view === 'guessit_match') {
      const pending = pendingGuessItMatchByIdRef.current.get(route.matchId);
      if (pending) {
        pendingGuessItMatchByIdRef.current.delete(route.matchId);
        setActiveGuessItMatch(pending);
        return;
      }
      if (activeGuessItMatchRef.current?.id === route.matchId) return;
      api
        .getGuessItMatch(route.matchId, activeProfileId)
        .then(setActiveGuessItMatch)
        .catch((err) => {
          notify(err.message || 'GuessIt match not found');
          setActiveGuessItMatch(null);
          setRoute({ view: 'guessit_entry' });
        });
    } else if (route.view === 'twistit_lobby' && activeTwistItRoom?.code !== route.roomCode) {
      api
        .getTwistItRoom(route.roomCode)
        .then((r) => {
          setActiveTwistItRoom(r);
          if (r.status === 'in_match' && r.activeMatchId) {
            setRoute({ view: 'twistit_match', matchId: r.activeMatchId });
          }
        })
        .catch((err) => {
          notify(err.message || 'TwistIt room not found');
          setActiveTwistItRoom(null);
          setRoute({ view: 'twistit_multiplayer' });
        });
    } else if (
      route.view === 'twistit_match' &&
      !isOfflineTwistItMatch(route.matchId) &&
      activeTwistItMatch?.id !== route.matchId
    ) {
      api
        .getTwistItMatch(route.matchId, activeProfileId)
        .then(setActiveTwistItMatch)
        .catch((err) => {
          notify(err.message || 'TwistIt match not found');
          setActiveTwistItMatch(null);
          setRoute({ view: 'twistit_home' });
        });
    } else if (route.view === 'changeit_lobby' && activeChangeItRoom?.id !== route.roomId) {
      api
        .getChangeItRoom(route.roomId)
        .then((r) => {
          setActiveChangeItRoom(r);
          if (r.status === 'in_progress' && r.activeMatchId) {
            setRoute({ view: 'changeit_match', matchId: r.activeMatchId });
          }
        })
        .catch((err) => {
          notify(err.message || 'ChangeIt room not found');
          setActiveChangeItRoom(null);
          setRoute({ view: 'changeit_rooms' });
        });
    } else if (
      route.view === 'changeit_match' &&
      !isOfflineChangeItMatchId(route.matchId) &&
      activeChangeItMatch?.id !== route.matchId
    ) {
      const pending = pendingChangeItMatchByIdRef.current.get(route.matchId);
      if (pending) {
        pendingChangeItMatchByIdRef.current.delete(route.matchId);
        setActiveChangeItMatch(pending);
      } else {
        api
          .getChangeItMatch(route.matchId, activeProfileId)
          .then(setActiveChangeItMatch)
          .catch((err) => {
            notify(err.message || 'ChangeIt match not found');
            setActiveChangeItMatch(null);
            setRoute({ view: 'changeit_home' });
          });
      }
    }
  }, [
    route,
    activeProfileId,
    playerSession?.isOffline,
    activeTwistItRoom?.code,
    activeTwistItMatch?.id,
    activeChangeItRoom?.id,
    activeChangeItMatch?.id,
    notify,
  ]);

  // Automatic idempotent ChangeIt Solo Adventure reward claim
  useEffect(() => {
    if (
      route.view !== 'changeit_match' ||
      !activeChangeItMatch ||
      activeChangeItMatch.mode !== 'solo_adventure' ||
      activeChangeItMatch.status !== 'finished' ||
      !activeChangeItMatch.self.completed ||
      !activeProfileId
    ) {
      return;
    }
    if (claimedChangeItMatchIdsRef.current.has(activeChangeItMatch.id)) return;
    claimedChangeItMatchIdsRef.current.add(activeChangeItMatch.id);

    if (isOfflineChangeItMatchId(activeChangeItMatch.id)) {
      const res = claimOfflineChangeItReward(activeProfileId, activeChangeItMatch.id);
      setChangeItAdventureClaim(res);
      setChangeItAdventureProgress(res.progress);
      return;
    }

    api
      .claimChangeItAdventureReward(activeProfileId, activeChangeItMatch.id)
      .then((res) => {
        setChangeItAdventureClaim(res);
        setChangeItAdventureProgress(res.progress);
        setCurrentProfile((prev) =>
          prev ? { ...prev, matchPointsBalance: res.newCoinsBalance } : prev
        );
      })
      .catch((err) => {
        claimedChangeItMatchIdsRef.current.delete(activeChangeItMatch.id);
        notify(err?.message || 'Could not claim ChangeIt reward');
      });
  }, [route.view, activeChangeItMatch, activeProfileId, notify]);

  // Server-confirmed Solo Adventure reward claim upon stage victory (strictly idempotent)
  useEffect(() => {
    if (
      route.view !== 'guessit_match' ||
      !activeGuessItMatch ||
      activeGuessItMatch.mode !== 'solo_adventure' ||
      !activeGuessItMatch.stageId ||
      activeGuessItMatch.status !== 'finished' ||
      !activeProfileId ||
      !activeGuessItMatch.winnerIds.includes(activeProfileId)
    ) {
      return;
    }
    if (claimedAdventureMatchIdsRef.current.has(activeGuessItMatch.id)) return;
    claimedAdventureMatchIdsRef.current.add(activeGuessItMatch.id);

    api
      .claimGuessItAdventureReward(activeProfileId, activeGuessItMatch.id)
      .then((res) => {
        setGuessItAdventureClaim(res);
        setGuessItAdventureProgress(res.progress);
        setCurrentProfile((prev) =>
          prev
            ? {
                ...prev,
                matchPointsBalance: res.newCoinsBalance,
                rankPoints: res.newRankPoints,
              }
            : prev
        );
        setRoute({ view: 'guessit_adventure_reward' });
      })
      .catch((err) => {
        claimedAdventureMatchIdsRef.current.delete(activeGuessItMatch.id);
        notify(err?.message || 'Could not claim Adventure reward');
      });
  }, [route.view, activeGuessItMatch, activeProfileId, notify]);

  // Restore room or match state cleanly on route change or browser refresh (skips duplicate fetch when state is already populated)
  useEffect(() => {
    if (!activeProfileId) return;
    if (route.view === 'lobby') {
      if (playerSession?.isOffline) return;
      if (activeRoomRef.current?.id === route.roomId) return;
      api
        .getRoom(route.roomId)
        .then((room) => {
          setActiveRoom(room);
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
      const pending = pendingChainMatchByIdRef.current.get(route.matchId);
      if (pending) {
        pendingChainMatchByIdRef.current.delete(route.matchId);
        setActiveMatch(pending);
        return;
      }
      if (activeMatchRef.current?.id === route.matchId) return;
      api
        .getMatch(route.matchId, activeProfileId)
        .then((match) => {
          setActiveMatch(match);
        })
        .catch((err) => {
          notify(err.message);
          setRoute({ view: 'tab', tab: 'home' });
        });
    }
  }, [route, activeProfileId, playerSession?.isOffline, notify]);

  const joinInvitedRoom = useCallback(
    async (invite: PendingRoomInvite, playerId: string) => {
      try {
        if (invite.game === 'chainit') {
          const room = await api.joinRoom(invite.code, playerId);
          setActiveRoom(room);
          if (room.status === 'in_progress' && room.activeMatchId) {
            setRoute({ view: 'match', matchId: room.activeMatchId });
          } else {
            setRoute({ view: 'lobby', roomId: room.id });
          }
          notify(`Joined ChainIt room ${room.code}!`);
          return;
        }
        if (invite.game === 'gridit') {
          const res = await api.joinGridItRoom(invite.code, playerId, false);
          setActiveGridItRoom(res.room);
          if (res.room.status === 'in_progress' && res.room.activeMatchId) {
            setRoute({ view: 'gridit_match', matchId: res.room.activeMatchId });
          } else {
            setRoute({ view: 'gridit_lobby', roomId: res.room.id });
          }
          notify(`Joined GridIt room ${res.room.code}!`);
          return;
        }
        if (invite.game === 'twistit') {
          const room = await api.joinTwistItRoom(invite.code, playerId);
          setActiveTwistItRoom(room);
          if (room.status === 'in_match' && room.activeMatchId) {
            setRoute({ view: 'twistit_match', matchId: room.activeMatchId });
          } else {
            setRoute({ view: 'twistit_lobby', roomCode: room.code });
          }
          notify(`Joined TwistIt room ${room.code}!`);
          return;
        }
        if (invite.game === 'changeit') {
          const room = await api.joinChangeItRoom(invite.code, playerId);
          setActiveChangeItRoom(room);
          if (room.status === 'in_progress' && room.activeMatchId) {
            setRoute({ view: 'changeit_match', matchId: room.activeMatchId });
          } else {
            setRoute({ view: 'changeit_lobby', roomId: room.id });
          }
          notify(`Joined ChangeIt room ${room.code}!`);
          return;
        }
        const room = await api.joinGuessItRoom(invite.code, playerId);
        setActiveGuessItRoom(room);
        if (room.status === 'in_progress' && room.activeMatchId) {
          setRoute({ view: 'guessit_match', matchId: room.activeMatchId });
        } else {
          setRoute({ view: 'guessit_lobby', roomId: room.id });
        }
        notify(`Joined GuessIt room ${room.code}!`);
      } catch (err: any) {
        notify(err?.message || `Could not join ${GAME_DISPLAY_NAMES[invite.game]} room.`);
        setRoute({ view: 'hub' });
      }
    },
    [notify]
  );

  useEffect(() => {
    if (
      authChecking ||
      !pendingInvite ||
      !currentProfile ||
      !playerSession ||
      inviteJoinInFlightRef.current
    ) {
      return;
    }
    if (isOffline || playerSession.isOffline) {
      setPendingInvite(null);
      clearRoomInviteFromUrl();
      notify('Joining rooms requires an online connection.');
      return;
    }
    const invite = pendingInvite;
    inviteJoinInFlightRef.current = true;
    setJoiningInvite(true);
    setPendingInvite(null);
    clearRoomInviteFromUrl();
    joinInvitedRoom(invite, playerSession.playerId).finally(() => {
      inviteJoinInFlightRef.current = false;
      setJoiningInvite(false);
    });
  }, [authChecking, pendingInvite, currentProfile, playerSession, isOffline, joinInvitedRoom, notify]);

  const handleEnterGuest = async (nickname: string, avatarId: string) => {
    saveCachedGuestPrefs(nickname, avatarId);
    setAuthError(null);

    if (isOffline) {
      if (pendingInvite) {
        setPendingInvite(null);
        clearRoomInviteFromUrl();
        notify('Joining rooms requires an online connection.');
      }
      const offlineSess = createOfflineGuestSession(nickname, avatarId);
      setGuestSessionToken(null);
      setPlayerSession(offlineSess);
      populateOfflineState(offlineSess);
      setActiveRoom(null);
      setActiveMatch(null);
      setRoute({ view: 'hub' });
      if (!pendingInvite) {
        notify(`Entered Offline Solo as ${offlineSess.nickname}`);
      }
      return;
    }

    const res = await api.claimGuestNickname(nickname, avatarId);
    const nextSess = guestSessionToPlayerSession(res.session, false);
    setGuestSessionToken(nextSess.sessionToken);

    if (pendingInvite) {
      const invite = pendingInvite;
      inviteJoinInFlightRef.current = true;
      setJoiningInvite(true);
      setPendingInvite(null);
      clearRoomInviteFromUrl();
      setPlayerSession(nextSess);
      setCurrentProfile(res.profile);
      setActiveRoom(null);
      setActiveMatch(null);
      void refreshPlatformData(nextSess.playerId, nextSess);
      try {
        await joinInvitedRoom(invite, nextSess.playerId);
      } finally {
        inviteJoinInFlightRef.current = false;
        setJoiningInvite(false);
      }
      return;
    }

    setPlayerSession(nextSess);
    setCurrentProfile(res.profile);
    setActiveRoom(null);
    setActiveMatch(null);
    setRoute({ view: 'hub' });
    notify(`Welcome, ${res.session.nickname}!`);
    await refreshPlatformData(nextSess.playerId, nextSess);
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
      if (/fetch|network|404|502|503/i.test(String(err?.message)) || !navigator.onLine) {
        const res = startOfflineSoloMatch(currentProfile, stageId);
        setActiveMatch(res.match);
        setRoute({ view: 'match', matchId: res.match.id, soloStageId: res.stageId });
        notify('Started offline Solo stage');
      } else {
        notify(err.message);
      }
    }
  };

  const handleStartPractice = async (config: ChainItPracticeConfig) => {
    if (!currentProfile) return;
    const pickedTpl = config.templateId
      ? templates.find((t) => t.id === config.templateId)
      : undefined;

    if (isOffline || playerSession?.isOffline || (pickedTpl && currentProfile.isGuest && pickedTpl.status !== 'official')) {
      const res = startOfflinePracticeMatch(currentProfile, config, pickedTpl);
      setActiveMatch(res.match);
      setRoute({ view: 'match', matchId: res.match.id, soloStageId: null });
      return;
    }

    try {
      const res = await api.startPracticeMatch(currentProfile.id, config);
      setActiveMatch(res.match);
      setRoute({ view: 'match', matchId: res.match.id, soloStageId: null });
    } catch (err: any) {
      if (/fetch|network|404|502|503/i.test(String(err?.message)) || !navigator.onLine) {
        const res = startOfflinePracticeMatch(currentProfile, config, pickedTpl);
        setActiveMatch(res.match);
        setRoute({ view: 'match', matchId: res.match.id, soloStageId: null });
        notify('Started offline Practice chain');
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
          pendingInvite={pendingInvite}
          onEnterGuest={handleEnterGuest}
        />
      );
    }

    if (joiningInvite) {
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
          Joining room...
        </div>
      );
    }

    if (route.view === 'hub') {
      return (
        <EnscribeHubScreen
          session={playerSession}
          profile={currentProfile}
          isOffline={isOffline}
          onSelectGame={handleSelectHubGame}
          onOpenProfile={() => setRoute({ view: 'tab', tab: 'profile' })}
          onQuickPlay={() => setRoute({ view: 'changeit_home' })}
          onOpenSocial={() => setRoute({ view: 'rooms' })}
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
            } else if (route.gameId === 'guessit') {
              setRoute({ view: 'guessit_entry' });
            } else if (route.gameId === 'twistit') {
              setRoute({ view: 'twistit_home' });
            } else if (route.gameId === 'changeit') {
              setRoute({ view: 'changeit_home' });
            } else {
              setRoute({ view: 'tab', tab: 'home' });
            }
          }}
        />
      );
    }

    if (route.view === 'changeit_home') {
      return (
        <ChangeItHomeScreen
          session={playerSession}
          profile={currentProfile}
          adventureProgress={changeItAdventureProgress}
          onExitToHub={() => setRoute({ view: 'hub' })}
          onOpenRanked={() => setRoute({ view: 'changeit_ranked' })}
          onOpenAdventure={() => setRoute({ view: 'changeit_adventure' })}
          onOpenClassicSolo={() => setRoute({ view: 'changeit_solo_setup' })}
          onOpenRooms={() => setRoute({ view: 'changeit_rooms' })}
          onOpenLeaderboard={() => setRoute({ view: 'changeit_leaderboard' })}
          onOpenTemplates={() => setRoute({ view: 'changeit_templates' })}
          onOpenProfile={() => setRoute({ view: 'tab', tab: 'profile' })}
          onSwitchGuest={handleSwitchGuest}
        />
      );
    }

    if (route.view === 'changeit_solo_setup') {
      return (
        <ClassicSoloSetupScreen
          game="changeit"
          onBack={() => setRoute({ view: 'changeit_home' })}
          onStartChangeIt={async (params) => {
            setChangeItAdventureClaim(null);
            if (isOffline || playerSession.isOffline) {
              const m = await startOfflineChangeItClassicSolo(params);
              setActiveChangeItMatch(m);
              setRoute({ view: 'changeit_match', matchId: m.id });
              return;
            }
            try {
              const m = await api.startChangeItClassicSolo(playerSession.playerId, {
                difficulty: params.difficulty,
                wordLength: params.wordLength === 'auto' ? undefined : params.wordLength,
                timeLimitSeconds: params.timeLimitSeconds,
                hintsAllowed: params.hintsAllowed,
              });
              setActiveChangeItMatch(m);
              setRoute({ view: 'changeit_match', matchId: m.id });
            } catch (err: any) {
              if (/fetch|network|404|502|503/i.test(String(err?.message)) || !navigator.onLine) {
                const m = await startOfflineChangeItClassicSolo(params);
                setActiveChangeItMatch(m);
                setRoute({ view: 'changeit_match', matchId: m.id });
              } else {
                notify(err.message);
              }
            }
          }}
        />
      );
    }

    if (
      route.view === 'changeit_templates' ||
      route.view === 'guessit_templates' ||
      route.view === 'twistit_templates'
    ) {
      const scopedGame =
        route.view === 'changeit_templates'
          ? 'changeit'
          : route.view === 'guessit_templates'
            ? 'guessit'
            : 'twistit';
      const backRoute: ActiveRoute =
        scopedGame === 'changeit'
          ? { view: 'changeit_home' }
          : scopedGame === 'guessit'
            ? { view: 'guessit_entry' }
            : { view: 'twistit_home' };

      return (
        <GameTemplatesScreen
          game={scopedGame}
          profile={currentProfile}
          templates={templates}
          onBack={() => setRoute(backRoute)}
          onSaveChainItStyleTemplate={async (tplData) => {
            if (currentProfile.isGuest) {
              const saved = saveGuestLocalTemplate(currentProfile.id, tplData);
              setTemplates((prev) => [saved, ...prev.filter((t) => t.id !== saved.id)]);
              return saved;
            }
            const saved = await api.saveTemplate(tplData);
            setTemplates((prev) => [saved, ...prev.filter((t) => t.id !== saved.id)]);
            return saved;
          }}
          onDeleteTemplate={async (id) => {
            setTemplates((prev) => prev.filter((t) => t.id !== id));
            if (currentProfile.isGuest) {
              deleteGuestLocalTemplate(currentProfile.id, id);
              return;
            }
            await api.deleteTemplate(id);
          }}
          onPlayChangeItCustom={async (startWord, targetWord) => {
            setChangeItAdventureClaim(null);
            if (isOffline || playerSession.isOffline) {
              const m = await startOfflineChangeItClassicSolo({
                difficulty: 'normal',
                customStartWord: startWord,
                customTargetWord: targetWord,
                hintsAllowed: true,
              });
              setActiveChangeItMatch(m);
              setRoute({ view: 'changeit_match', matchId: m.id });
              return;
            }
            try {
              const m = await api.startChangeItClassicSolo(playerSession.playerId, {
                difficulty: 'normal',
                customStartWord: startWord,
                customTargetWord: targetWord,
                hintsAllowed: true,
              });
              setActiveChangeItMatch(m);
              setRoute({ view: 'changeit_match', matchId: m.id });
            } catch (err: any) {
              if (/fetch|network|404|502|503/i.test(String(err?.message)) || !navigator.onLine) {
                const m = await startOfflineChangeItClassicSolo({
                  difficulty: 'normal',
                  customStartWord: startWord,
                  customTargetWord: targetWord,
                  hintsAllowed: true,
                });
                setActiveChangeItMatch(m);
                setRoute({ view: 'changeit_match', matchId: m.id });
              } else {
                notify(err.message);
              }
            }
          }}
          onPlayGuessItCustom={async (pack: GuessItCustomPack) => {
            try {
              const m = await api.startGuessItClassicSolo(playerSession.playerId, {
                difficulty: pack.difficulty,
                category: pack.category,
                format: 'classic',
                customAnswer: pack.answer,
                customClue: pack.clue,
              });
              setActiveGuessItMatch(m);
              setRoute({ view: 'guessit_match', matchId: m.id });
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onPlayTwistItCustom={async (baseWord, answers) => {
            if (isOffline || playerSession.isOffline) {
              const m = startOfflineTwistItSolo(playerSession.playerId, playerSession.nickname, [], {
                customBaseWord: baseWord,
                customAnswers: answers,
              });
              setActiveTwistItMatch(m);
              setRoute({ view: 'twistit_match', matchId: m.id });
              return;
            }
            try {
              const m = await api.startTwistItSolo(playerSession.playerId, [], {
                customBaseWord: baseWord,
                customAnswers: answers,
              });
              setActiveTwistItMatch(m);
              setRoute({ view: 'twistit_match', matchId: m.id });
            } catch (err: any) {
              if (/fetch|network|404|502|503/i.test(String(err?.message)) || !navigator.onLine) {
                const m = startOfflineTwistItSolo(playerSession.playerId, playerSession.nickname, [], {
                  customBaseWord: baseWord,
                  customAnswers: answers,
                });
                setActiveTwistItMatch(m);
                setRoute({ view: 'twistit_match', matchId: m.id });
              } else {
                notify(err.message);
              }
            }
          }}
          onNotify={notify}
        />
      );
    }

    if (route.view === 'changeit_ranked') {
      return (
        <ChangeItRankedScreen
          session={playerSession}
          playerStats={changeItLeaderboardData?.playerStats ?? null}
          queuedFormat={changeItRankedFormat}
          isOffline={isOffline || playerSession.isOffline}
          onBack={() => setRoute({ view: 'changeit_home' })}
          onJoinQueue={async (format) => {
            try {
              const res = await api.joinChangeItRankedQueue(playerSession.playerId, format);
              if (res.status === 'matched' && res.match) {
                setChangeItRankedFormat(null);
                setActiveChangeItMatch(res.match);
                setRoute({ view: 'changeit_match', matchId: res.match.id });
              } else {
                setChangeItRankedFormat(format);
                notify(`Searching Ranked ${format === 'classic_sprint' ? 'Sprint' : 'Precision'}...`);
              }
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onLeaveQueue={async () => {
            await api.leaveChangeItRankedQueue(playerSession.playerId).catch(() => undefined);
            setChangeItRankedFormat(null);
            notify('Left ChangeIt Ranked queue');
          }}
        />
      );
    }

    if (route.view === 'changeit_adventure') {
      const progress =
        changeItAdventureProgress ?? getOfflineChangeItAdventureProgress(playerSession.playerId);
      return (
        <ChangeItAdventureScreen
          progress={progress}
          onBack={() => setRoute({ view: 'changeit_home' })}
          onStartStage={async (stageId) => {
            setChangeItAdventureClaim(null);
            if (isOffline || playerSession.isOffline) {
              const m = await startOfflineChangeItStage(stageId);
              setActiveChangeItMatch(m);
              setRoute({ view: 'changeit_match', matchId: m.id });
              return;
            }
            try {
              const m = await api.startChangeItAdventureStage(playerSession.playerId, stageId);
              setActiveChangeItMatch(m);
              setRoute({ view: 'changeit_match', matchId: m.id });
            } catch (err: any) {
              if (/fetch|network|404|502|503/i.test(String(err?.message)) || !navigator.onLine) {
                const m = await startOfflineChangeItStage(stageId);
                setActiveChangeItMatch(m);
                setRoute({ view: 'changeit_match', matchId: m.id });
              } else {
                notify(err.message);
              }
            }
          }}
        />
      );
    }

    if (route.view === 'changeit_rooms') {
      return (
        <ChangeItRoomsScreen
          publicRooms={changeItPublicRooms}
          isOffline={isOffline || playerSession.isOffline}
          onBack={() => setRoute({ view: 'changeit_home' })}
          onRefresh={() => {
            api.listChangeItPublicRooms().then(setChangeItPublicRooms).catch(() => undefined);
          }}
          onCreateRoom={async ({ name, settings }) => {
            try {
              const rm = await api.createChangeItRoom({
                hostId: playerSession.playerId,
                name,
                settings,
              });
              setActiveChangeItRoom(rm);
              setRoute({ view: 'changeit_lobby', roomId: rm.id });
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onJoinRoom={async (codeOrId) => {
            try {
              const rm = await api.joinChangeItRoom(codeOrId, playerSession.playerId);
              setActiveChangeItRoom(rm);
              if (rm.status === 'in_progress' && rm.activeMatchId) {
                setRoute({ view: 'changeit_match', matchId: rm.activeMatchId });
              } else {
                setRoute({ view: 'changeit_lobby', roomId: rm.id });
              }
            } catch (err: any) {
              notify(err.message);
            }
          }}
        />
      );
    }

    if (route.view === 'changeit_leaderboard') {
      return (
        <ChangeItLeaderboardScreen
          session={playerSession}
          isOffline={isOffline || playerSession.isOffline}
          onBack={() => setRoute({ view: 'changeit_home' })}
        />
      );
    }

    if (route.view === 'changeit_lobby' && activeChangeItRoom?.id === route.roomId) {
      return (
        <ChangeItLobbyScreen
          room={activeChangeItRoom}
          session={playerSession}
          templates={templates}
          onLeave={() => {
            const rid = activeChangeItRoom.id;
            setActiveChangeItRoom(null);
            setRoute({ view: 'changeit_rooms' });
            api.leaveChangeItRoom(rid, playerSession.playerId).catch(() => undefined);
          }}
          onUpdateSettings={async (partial) => {
            try {
              const updated = await api.updateChangeItRoomSettings(
                activeChangeItRoom.id,
                playerSession.playerId,
                partial
              );
              setActiveChangeItRoom(updated);
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onToggleReady={async (isReady) => {
            try {
              const updated = await api.setChangeItRoomReady(
                activeChangeItRoom.id,
                playerSession.playerId,
                isReady
              );
              setActiveChangeItRoom(updated);
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onSwitchTeam={async (teamId) => {
            try {
              const updated = await api.switchChangeItTeam(
                activeChangeItRoom.id,
                playerSession.playerId,
                teamId
              );
              setActiveChangeItRoom(updated);
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onSetCustomPuzzle={async (payload) => {
            try {
              const updated = await api.setChangeItCustomPuzzle(
                activeChangeItRoom.id,
                playerSession.playerId,
                payload
              );
              setActiveChangeItRoom(updated);
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onSaveCustomPuzzleTemplate={async (startWord, targetWord) => {
            try {
              const tplData = {
                ownerId: playerSession.playerId,
                name: `${startWord} → ${targetWord}`,
                theme: 'ChangeIt',
                thumbnailKey: 'custom' as const,
                words: [startWord, targetWord],
                status: 'saved' as const,
              };
              const saved = currentProfile.isGuest
                ? saveGuestLocalTemplate(playerSession.playerId, tplData)
                : await api.saveTemplate(tplData);
              setTemplates((prev) => [saved, ...prev.filter((t) => t.id !== saved.id)]);
              notify(`Saved "${saved.name}" to Templates!`);
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onSendChat={async (text) => {
            try {
              const updated = await api.sendChangeItRoomChat(
                activeChangeItRoom.id,
                playerSession.playerId,
                text
              );
              setActiveChangeItRoom(updated);
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onStartMatch={async () => {
            try {
              const res = await api.startChangeItRoomMatch(
                activeChangeItRoom.id,
                playerSession.playerId
              );
              setActiveChangeItRoom(res.room);
              setActiveChangeItMatch(res.match);
              setRoute({ view: 'changeit_match', matchId: res.match.id });
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onNotify={notify}
        />
      );
    }

    if (route.view === 'changeit_match' && activeChangeItMatch?.id === route.matchId) {
      const offline = isOfflineChangeItMatchId(activeChangeItMatch.id);
      const nextStageObj = (() => {
        if (activeChangeItMatch.mode !== 'solo_adventure' || !activeChangeItMatch.stageId) {
          return null;
        }
        const idx = ALL_CHANGEIT_ADVENTURE_STAGES.findIndex(
          (s) => s.id === activeChangeItMatch.stageId
        );
        return idx >= 0 && idx + 1 < ALL_CHANGEIT_ADVENTURE_STAGES.length
          ? ALL_CHANGEIT_ADVENTURE_STAGES[idx + 1]
          : null;
      })();

      return (
        <ChangeItGameplayScreen
          match={activeChangeItMatch}
          viewerId={offline ? 'offline_player' : playerSession.playerId}
          adventureClaim={changeItAdventureClaim}
          onExit={() => {
            const wasAdv = activeChangeItMatch.mode === 'solo_adventure';
            const wasClassicSolo = activeChangeItMatch.mode === 'solo_classic';
            const rid = activeChangeItMatch.roomId;
            setActiveChangeItMatch(null);
            setChangeItAdventureClaim(null);
            setRoute(
              wasAdv
                ? { view: 'changeit_adventure' }
                : wasClassicSolo
                  ? { view: 'changeit_solo_setup' }
                  : rid
                    ? { view: 'changeit_lobby', roomId: rid }
                    : { view: 'changeit_home' }
            );
          }}
          onSubmitTransform={async (word, clientRequestId) => {
            if (offline) {
              const res = await submitOfflineChangeItTransform(activeChangeItMatch.id, word);
              setActiveChangeItMatch(res.match);
              return res;
            }
            const res = await api.submitChangeItTransform(
              activeChangeItMatch.id,
              playerSession.playerId,
              word,
              clientRequestId
            );
            setActiveChangeItMatch(res.match);
            return res;
          }}
          onUseHint={async () => {
            try {
              const next = offline
                ? await useOfflineChangeItHint(activeChangeItMatch.id)
                : await api.useChangeItHint(activeChangeItMatch.id, playerSession.playerId);
              setActiveChangeItMatch(next);
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onActivateModifier={
            !offline
              ? async (modifierType, targetPlayerId, clientRequestId) => {
                  try {
                    const res = await api.activateChangeItModifier(
                      activeChangeItMatch.id,
                      playerSession.playerId,
                      modifierType,
                      targetPlayerId,
                      clientRequestId
                    );
                    setActiveChangeItMatch(res.match);
                    notify(res.message);
                  } catch (err: any) {
                    notify(err.message);
                  }
                }
              : undefined
          }
          onForfeit={
            !offline && activeChangeItMatch.mode !== 'solo_adventure'
              ? async () => {
                  try {
                    const next = await api.forfeitChangeItMatch(
                      activeChangeItMatch.id,
                      playerSession.playerId
                    );
                    setActiveChangeItMatch(next);
                  } catch (err: any) {
                    notify(err.message);
                  }
                }
              : undefined
          }
          onRetryAdventure={
            activeChangeItMatch.mode === 'solo_adventure'
              ? async () => {
                  setChangeItAdventureClaim(null);
                  claimedChangeItMatchIdsRef.current.delete(activeChangeItMatch.id);
                  const next = offline
                    ? retryOfflineChangeItMatch(activeChangeItMatch.id)
                    : await api.retryChangeItAdventureMatch(
                        playerSession.playerId,
                        activeChangeItMatch.id
                      );
                  setActiveChangeItMatch(next);
                }
              : undefined
          }
          onNextAdventureStage={
            nextStageObj && activeChangeItMatch.self.completed
              ? async () => {
                  setChangeItAdventureClaim(null);
                  const nextMatch = offline
                    ? await startOfflineChangeItStage(nextStageObj.id)
                    : await api.startChangeItAdventureStage(
                        playerSession.playerId,
                        nextStageObj.id
                      );
                  setActiveChangeItMatch(nextMatch);
                  setRoute({ view: 'changeit_match', matchId: nextMatch.id });
                }
              : undefined
          }
          onRematch={
            activeChangeItMatch.mode === 'solo_classic'
              ? async () => {
                  try {
                    const next = offline
                      ? await nextOfflineChangeItClassicSolo(activeChangeItMatch.id)
                      : await api.rematchChangeItMatch(
                          activeChangeItMatch.id,
                          playerSession.playerId
                        );
                    setActiveChangeItMatch(next);
                    setRoute({ view: 'changeit_match', matchId: next.id });
                  } catch (err: any) {
                    notify(err.message);
                  }
                }
              : !offline &&
                  activeChangeItMatch.mode !== 'solo_adventure' &&
                  !activeChangeItMatch.isRanked
                ? async () => {
                    try {
                      const next = await api.rematchChangeItMatch(
                        activeChangeItMatch.id,
                        playerSession.playerId
                      );
                      setActiveChangeItMatch(next);
                      setRoute({ view: 'changeit_match', matchId: next.id });
                    } catch (err: any) {
                      notify(err.message);
                    }
                  }
                : undefined
          }
          onBackToLobby={
            activeChangeItMatch.roomId
              ? () => {
                  const rid = activeChangeItMatch.roomId!;
                  setActiveChangeItMatch(null);
                  setRoute({ view: 'changeit_lobby', roomId: rid });
                }
              : undefined
          }
          onSyncMatch={
            !offline
              ? async () => {
                  const fresh = await api.getChangeItMatch(
                    activeChangeItMatch.id,
                    playerSession.playerId
                  );
                  setActiveChangeItMatch(fresh);
                }
              : undefined
          }
        />
      );
    }

    if (route.view === 'changeit_lobby' || route.view === 'changeit_match') {
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#a5f3fc',
            fontWeight: 800,
            fontSize: 15,
          }}
        >
          Loading ChangeIt {route.view === 'changeit_lobby' ? 'lobby' : 'match'}...
        </div>
      );
    }

    if (route.view === 'guessit_entry') {
      return (
        <GuessItEntryScreen
          profile={currentProfile}
          onExitToHub={() => setRoute({ view: 'hub' })}
          onPlayMultiplayer={(pathway) => setRoute({ view: 'guessit_modes', pathway })}
          onSoloAdventure={() => setRoute({ view: 'guessit_adventure' })}
          onClassicSolo={() => setRoute({ view: 'guessit_solo_setup' })}
          onOpenLeaderboard={() => setRoute({ view: 'guessit_leaderboard' })}
          onOpenTemplates={() => setRoute({ view: 'guessit_templates' })}
          onOpenProfile={() => setRoute({ view: 'tab', tab: 'profile' })}
          onSwitchGuest={handleSwitchGuest}
        />
      );
    }

    if (route.view === 'guessit_solo_setup') {
      return (
        <ClassicSoloSetupScreen
          game="guessit"
          onBack={() => setRoute({ view: 'guessit_entry' })}
          onStartGuessIt={async (params) => {
            try {
              const m = await api.startGuessItClassicSolo(playerSession.playerId, {
                difficulty: params.difficulty,
                category: params.category,
                format: params.format,
                timeLimitSeconds: params.timeLimitSeconds,
              });
              setActiveGuessItMatch(m);
              setRoute({ view: 'guessit_match', matchId: m.id });
            } catch (err: any) {
              notify(err.message);
            }
          }}
        />
      );
    }

    if (route.view === 'guessit_leaderboard') {
      return (
        <LeaderboardScreen
          currentProfile={currentProfile}
          gameTitle="GuessIt"
          onBack={() => setRoute({ view: 'guessit_entry' })}
        />
      );
    }

    if (route.view === 'guessit_modes') {
      return (
        <GuessItModeSelectScreen
          publicRooms={guessItPublicRooms}
          rankedSearchingKey={guessItRankedKey}
          initialPathway={route.pathway ?? 'rooms'}
          isOffline={isOffline || playerSession.isOffline}
          onBack={() => setRoute({ view: 'guessit_entry' })}
          onRefreshRooms={() => {
            api.listGuessItPublicRooms().then(setGuessItPublicRooms).catch(() => undefined);
          }}
          onCreateRoom={async (settings) => {
            try {
              const room = await api.createGuessItRoom({
                hostId: playerSession.playerId,
                settings,
              });
              setActiveGuessItRoom(room);
              setRoute({ view: 'guessit_lobby', roomId: room.id });
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onJoinRoomByCode={async (codeOrId) => {
            try {
              const room = await api.joinGuessItRoom(codeOrId, playerSession.playerId);
              setActiveGuessItRoom(room);
              if (room.status === 'in_progress' && room.activeMatchId) {
                setRoute({ view: 'guessit_match', matchId: room.activeMatchId });
              } else {
                setRoute({ view: 'guessit_lobby', roomId: room.id });
              }
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onJoinRanked={async (mode, format) => {
            try {
              const res = await api.joinGuessItRankedQueue(playerSession.playerId, mode, format);
              if (res.status === 'matched' && res.match) {
                setGuessItRankedKey(null);
                setActiveGuessItMatch(res.match);
                setRoute({ view: 'guessit_match', matchId: res.match.id });
              } else {
                setGuessItRankedKey(`${mode}:${format}`);
                notify('Searching Ranked GuessIt queue...');
              }
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onLeaveRanked={async () => {
            await api.leaveGuessItRankedQueue(playerSession.playerId).catch(() => undefined);
            setGuessItRankedKey(null);
          }}
        />
      );
    }

    if (route.view === 'guessit_lobby' && activeGuessItRoom?.id === route.roomId) {
      return (
        <GuessItLobbyScreen
          room={activeGuessItRoom}
          session={playerSession}
          templates={templates}
          onBack={() => {
            const rid = activeGuessItRoom.id;
            setActiveGuessItRoom(null);
            setRoute({ view: 'guessit_modes' });
            api.leaveGuessItRoom(rid, playerSession.playerId).catch(() => undefined);
          }}
          onUpdateSettings={async (partial) => {
            try {
              const updated = await api.updateGuessItRoomSettings(
                activeGuessItRoom.id,
                playerSession.playerId,
                partial
              );
              setActiveGuessItRoom(updated);
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onToggleReady={async (isReady) => {
            try {
              const updated = await api.setGuessItRoomReady(
                activeGuessItRoom.id,
                playerSession.playerId,
                isReady
              );
              setActiveGuessItRoom(updated);
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onSwitchTeam={async (teamId) => {
            try {
              const updated = await api.switchGuessItTeam(
                activeGuessItRoom.id,
                playerSession.playerId,
                teamId
              );
              setActiveGuessItRoom(updated);
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onSubmitDuelChallenge={async (payload) => {
            try {
              const updated = await api.submitGuessItDuelChallenge(
                activeGuessItRoom.id,
                playerSession.playerId,
                payload
              );
              setActiveGuessItRoom(updated);
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onSendChat={async (text) => {
            try {
              const updated = await api.sendGuessItRoomChat(
                activeGuessItRoom.id,
                playerSession.playerId,
                text
              );
              setActiveGuessItRoom(updated);
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onStartMatch={async () => {
            try {
              const res = await api.startGuessItRoomMatch(
                activeGuessItRoom.id,
                playerSession.playerId
              );
              setActiveGuessItRoom(res.room);
              setActiveGuessItMatch(res.match);
              setRoute({ view: 'guessit_match', matchId: res.match.id });
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onNotify={notify}
        />
      );
    }

    if (route.view === 'guessit_match' && activeGuessItMatch?.id === route.matchId) {
      if (activeGuessItMatch.status === 'finished') {
        if (
          activeGuessItMatch.mode === 'solo_adventure' &&
          Boolean(activeGuessItMatch.stageId) &&
          activeGuessItMatch.winnerIds.includes(playerSession.playerId)
        ) {
          return (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fef08a',
                fontWeight: 800,
              }}
            >
              Claiming Adventure Reward...
            </div>
          );
        }

        return (
          <GuessItResultsScreen
            match={activeGuessItMatch}
            onPlayAgain={async () => {
              try {
                const next = await api.rematchGuessItMatch(
                  activeGuessItMatch.id,
                  playerSession.playerId
                );
                setActiveGuessItMatch(next);
                setRoute({ view: 'guessit_match', matchId: next.id });
              } catch (err: any) {
                notify(err.message);
              }
            }}
            onBackToLobby={() => {
              const rid = activeGuessItMatch.roomId;
              const wasAdv =
                activeGuessItMatch.mode === 'solo_adventure' && Boolean(activeGuessItMatch.stageId);
              const wasClassicSolo =
                activeGuessItMatch.mode === 'solo_adventure' && !activeGuessItMatch.stageId;
              setActiveGuessItMatch(null);
              if (wasAdv) {
                setRoute({ view: 'guessit_adventure' });
              } else if (wasClassicSolo) {
                setRoute({ view: 'guessit_solo_setup' });
              } else if (rid) {
                setRoute({ view: 'guessit_lobby', roomId: rid });
              } else {
                setRoute({ view: 'guessit_modes' });
              }
            }}
          />
        );
      }

      const exitMatch = () => {
        const wasAdv =
          activeGuessItMatch.mode === 'solo_adventure' && Boolean(activeGuessItMatch.stageId);
        const wasClassicSolo =
          activeGuessItMatch.mode === 'solo_adventure' && !activeGuessItMatch.stageId;
        setActiveGuessItMatch(null);
        setRoute({
          view: wasAdv
            ? 'guessit_adventure'
            : wasClassicSolo
              ? 'guessit_solo_setup'
              : 'guessit_modes',
        });
      };

      const submitGuessHandler = async (letter: string) => {
        const res = await api.submitGuessItLetter(
          activeGuessItMatch.id,
          playerSession.playerId,
          letter
        );
        setActiveGuessItMatch(res.match);
        return { correct: res.correct, message: res.message };
      };

      if (activeGuessItMatch.format === 'crossword') {
        return (
          <GuessItCrosswordGameplayScreen
            match={activeGuessItMatch}
            onExit={exitMatch}
            onSubmitLetter={submitGuessHandler}
          />
        );
      }

      return (
        <GuessItClassicGameplayScreen
          match={activeGuessItMatch}
          onExit={exitMatch}
          onSubmitLetter={submitGuessHandler}
          onSendChat={async (text) => {
            try {
              const next = await api.sendGuessItMatchChat(
                activeGuessItMatch.id,
                playerSession.playerId,
                text
              );
              setActiveGuessItMatch(next);
            } catch (err: any) {
              notify(err.message);
            }
          }}
        />
      );
    }

    if (route.view === 'guessit_adventure') {
      if (!guessItAdventureProgress) {
        return (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dbeafe',
              fontWeight: 800,
            }}
          >
            Loading Chapter 1: The Missing Reel...
          </div>
        );
      }
      return (
        <GuessItAdventureMapScreen
          progress={guessItAdventureProgress}
          onBack={() => setRoute({ view: 'guessit_entry' })}
          onStartStage={async (stageId) => {
            try {
              const match = await api.startGuessItAdventureStage(playerSession.playerId, stageId);
              setActiveGuessItMatch(match);
              setRoute({ view: 'guessit_match', matchId: match.id });
            } catch (err: any) {
              notify(err.message);
            }
          }}
        />
      );
    }

    if (route.view === 'guessit_adventure_reward' && guessItAdventureClaim) {
      return (
        <GuessItAdventureRewardScreen
          claimResult={guessItAdventureClaim}
          chapterTitle={
            guessItAdventureProgress?.chapters[0]
              ? `Chapter ${guessItAdventureProgress.chapters[0].chapterNumber}: ${guessItAdventureProgress.chapters[0].title}`
              : 'Chapter 1: The Missing Reel'
          }
          onContinue={() => {
            setActiveGuessItMatch(null);
            setRoute({ view: 'guessit_adventure' });
          }}
        />
      );
    }

    if (route.view === 'guessit_lobby' || route.view === 'guessit_match') {
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
          Loading GuessIt {route.view === 'guessit_lobby' ? 'lobby' : 'match'}...
        </div>
      );
    }

    if (route.view === 'gridit_home') {
      return (
        <GridItHomeScreen
          session={playerSession}
          profile={currentProfile}
          onExitToHub={() => setRoute({ view: 'hub' })}
          onOpenSolo={() => setRoute({ view: 'gridit_solo_setup' })}
          onOpenRanked={() => setRoute({ view: 'gridit_ranked' })}
          onOpenMultiplayer={() => setRoute({ view: 'gridit_rooms' })}
          onOpenLeaderboard={() => setRoute({ view: 'gridit_leaderboard' })}
          onOpenBoardBattle={() =>
            setRoute({ view: 'gridit_host_setup', defaultMode: 'board_battle' })
          }
          onOpenEditor={() => setRoute({ view: 'gridit_editor', returnToLobbyRoomId: null })}
          onOpenProfile={() => setRoute({ view: 'tab', tab: 'profile' })}
          onSwitchGuest={handleSwitchGuest}
        />
      );
    }

    if (route.view === 'twistit_home') {
      return (
        <TwistItHomeScreen
          session={playerSession}
          profile={currentProfile}
          soloStats={twistItSoloStats}
          onExitToHub={() => setRoute({ view: 'hub' })}
          onStartSolo={() => setRoute({ view: 'twistit_solo_setup' })}
          onOpenMultiplayer={() => setRoute({ view: 'twistit_multiplayer' })}
          onOpenTemplates={() => setRoute({ view: 'twistit_templates' })}
          onOpenProfile={() => setRoute({ view: 'tab', tab: 'profile' })}
          onSwitchGuest={handleSwitchGuest}
        />
      );
    }

    if (route.view === 'twistit_solo_setup') {
      return (
        <ClassicSoloSetupScreen
          game="twistit"
          onBack={() => setRoute({ view: 'twistit_home' })}
          onStartTwistIt={async (params) => {
            setLastTwistItSoloConfig(params);
            if (isOffline || playerSession.isOffline) {
              const m = startOfflineTwistItSolo(
                playerSession.playerId,
                playerSession.nickname,
                [],
                params
              );
              setActiveTwistItMatch(m);
              setRoute({ view: 'twistit_match', matchId: m.id });
              return;
            }
            try {
              const m = await api.startTwistItSolo(playerSession.playerId, [], params);
              setActiveTwistItMatch(m);
              setRoute({ view: 'twistit_match', matchId: m.id });
            } catch (err: any) {
              if (/fetch|network|404|502|503/i.test(String(err?.message)) || !navigator.onLine) {
                const m = startOfflineTwistItSolo(
                  playerSession.playerId,
                  playerSession.nickname,
                  [],
                  params
                );
                setActiveTwistItMatch(m);
                setRoute({ view: 'twistit_match', matchId: m.id });
              } else {
                notify(err.message);
              }
            }
          }}
        />
      );
    }

    if (route.view === 'twistit_multiplayer') {
      return (
        <TwistItMultiplayerScreen
          session={playerSession}
          profile={currentProfile}
          publicRooms={twistItPublicRooms}
          searchingQuick={twistItQuickQueued}
          isOffline={isOffline || playerSession.isOffline}
          onBack={() => setRoute({ view: 'twistit_home' })}
          onOpenProfile={() => setRoute({ view: 'tab', tab: 'profile' })}
          onRefreshRooms={() => {
            api.listTwistItPublicRooms().then(setTwistItPublicRooms).catch(() => undefined);
          }}
          onQuickMatch={async () => {
            try {
              const res = await api.joinTwistItQuickMatch(playerSession.playerId);
              if (res.status === 'matched') {
                setTwistItQuickQueued(false);
                setActiveTwistItRoom(res.room);
                setActiveTwistItMatch(res.match);
                setRoute({ view: 'twistit_match', matchId: res.match.id });
              } else {
                setTwistItQuickQueued(true);
                notify('Searching 1v1 TwistIt queue...');
              }
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onCancelQuickMatch={async () => {
            await api.leaveTwistItQuickMatch(playerSession.playerId).catch(() => undefined);
            setTwistItQuickQueued(false);
          }}
          onCreateRoom={async (settings) => {
            try {
              const rm = await api.createTwistItRoom(playerSession.playerId, settings);
              setActiveTwistItRoom(rm);
              setRoute({ view: 'twistit_lobby', roomCode: rm.code });
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onJoinRoomByCode={async (code) => {
            try {
              const rm = await api.joinTwistItRoom(code, playerSession.playerId);
              setActiveTwistItRoom(rm);
              if (rm.status === 'in_match' && rm.activeMatchId) {
                setRoute({ view: 'twistit_match', matchId: rm.activeMatchId });
              } else {
                setRoute({ view: 'twistit_lobby', roomCode: rm.code });
              }
            } catch (err: any) {
              notify(err.message);
            }
          }}
        />
      );
    }

    if (route.view === 'twistit_lobby' && activeTwistItRoom?.code === route.roomCode) {
      return (
        <TwistItLobbyScreen
          room={activeTwistItRoom}
          session={playerSession}
          profile={currentProfile}
          onLeave={() => {
            const code = activeTwistItRoom.code;
            setActiveTwistItRoom(null);
            setRoute({ view: 'twistit_multiplayer' });
            api.leaveTwistItRoom(code, playerSession.playerId).catch(() => undefined);
          }}
          onOpenProfile={() => setRoute({ view: 'tab', tab: 'profile' })}
          onToggleReady={async (ready) => {
            try {
              const updated = await api.setTwistItRoomReady(
                activeTwistItRoom.code,
                playerSession.playerId,
                ready
              );
              setActiveTwistItRoom(updated);
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onUpdateSettings={async (patch) => {
            try {
              const updated = await api.updateTwistItRoomSettings(
                activeTwistItRoom.code,
                playerSession.playerId,
                patch
              );
              setActiveTwistItRoom(updated);
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onSendChat={async (message) => {
            try {
              const updated = await api.sendTwistItRoomChat(
                activeTwistItRoom.code,
                playerSession.playerId,
                message
              );
              setActiveTwistItRoom(updated);
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onStartRace={async () => {
            try {
              const res = await api.startTwistItRoomMatch(
                activeTwistItRoom.code,
                playerSession.playerId
              );
              setActiveTwistItRoom(res.room);
              setActiveTwistItMatch(res.match);
              setRoute({ view: 'twistit_match', matchId: res.match.id });
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onNotify={notify}
        />
      );
    }

    if (route.view === 'twistit_match' && activeTwistItMatch?.id === route.matchId) {
      const offline = isOfflineTwistItMatch(activeTwistItMatch.id);
      return (
        <TwistItGameplayScreen
          match={activeTwistItMatch}
          viewerUserId={playerSession.playerId}
          onExit={() => {
            const roomCode = activeTwistItMatch.roomCode;
            setActiveTwistItMatch(null);
            if (roomCode) {
              setRoute({ view: 'twistit_multiplayer' });
            } else {
              setRoute({ view: 'twistit_home' });
            }
          }}
          onSubmitWord={async (word) => {
            if (offline) {
              const res = submitOfflineTwistItWord(activeTwistItMatch.id, word);
              setActiveTwistItMatch(res.match);
              if (res.completedPuzzle) {
                setTwistItSoloStats(getOfflineTwistItSoloStats());
              }
              return res;
            }
            const res = await api.submitTwistItWord(
              activeTwistItMatch.id,
              playerSession.playerId,
              word
            );
            setActiveTwistItMatch(res.match);
            if (res.completedPuzzle) {
              refreshPlatformData(playerSession.playerId);
              if (res.match.mode === 'solo') {
                api
                  .getTwistItSoloStats(playerSession.playerId)
                  .then(setTwistItSoloStats)
                  .catch(() => undefined);
              }
            }
            return res;
          }}
          onPlayAnotherSolo={async (excludePuzzleId) => {
            if (offline || isOffline || playerSession.isOffline) {
              const next = startOfflineTwistItSolo(
                playerSession.playerId,
                playerSession.nickname,
                [excludePuzzleId],
                lastTwistItSoloConfig
              );
              setActiveTwistItMatch(next);
              setRoute({ view: 'twistit_match', matchId: next.id });
              return;
            }
            const next = await api.startTwistItSolo(
              playerSession.playerId,
              [excludePuzzleId],
              lastTwistItSoloConfig
            );
            setActiveTwistItMatch(next);
            setRoute({ view: 'twistit_match', matchId: next.id });
          }}
          onRematch1v1={
            activeTwistItMatch.roomCode
              ? async () => {
                  try {
                    const res = await api.rematchTwistItRoom(
                      activeTwistItMatch.roomCode!,
                      playerSession.playerId
                    );
                    setActiveTwistItRoom(res.room);
                    setActiveTwistItMatch(res.match);
                    setRoute({ view: 'twistit_match', matchId: res.match.id });
                  } catch (err: any) {
                    notify(err.message);
                  }
                }
              : undefined
          }
          onBackToLobby={
            activeTwistItMatch.roomCode
              ? () => {
                  const code = activeTwistItMatch.roomCode!;
                  setActiveTwistItMatch(null);
                  setRoute({ view: 'twistit_lobby', roomCode: code });
                }
              : undefined
          }
          onSyncMatch={
            !offline
              ? async () => {
                  const fresh = await api.getTwistItMatch(
                    activeTwistItMatch.id,
                    playerSession.playerId
                  );
                  setActiveTwistItMatch(fresh);
                }
              : undefined
          }
        />
      );
    }

    if (route.view === 'twistit_lobby' || route.view === 'twistit_match') {
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
          Loading TwistIt {route.view === 'twistit_lobby' ? 'lobby' : 'race'}...
        </div>
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
          onLeave={() => {
            const rid = activeGridItRoom.id;
            setActiveGridItRoom(null);
            setRoute({ view: 'gridit_rooms' });
            api.leaveGridItRoom(rid, playerSession.playerId).catch(() => undefined);
          }}
          onToggleReady={async (isReady) => {
            const roomId = activeGridItRoom.id;
            const prevReady = !isReady;
            setActiveGridItRoom((prev) =>
              prev && prev.id === roomId
                ? {
                    ...prev,
                    players: prev.players.map((p) =>
                      p.playerId === playerSession.playerId ? { ...p, isReady } : p
                    ),
                  }
                : prev
            );
            try {
              const updated = await api.setGridItRoomReady(
                roomId,
                playerSession.playerId,
                isReady
              );
              setActiveGridItRoom(updated);
            } catch (err: any) {
              setActiveGridItRoom((prev) =>
                prev && prev.id === roomId
                  ? {
                      ...prev,
                      players: prev.players.map((p) =>
                        p.playerId === playerSession.playerId ? { ...p, isReady: prevReady } : p
                      ),
                    }
                  : prev
              );
              notify(err.message);
            }
          }}
          onSubmitBattleTemplate={async (tpl) => {
            try {
              const updated = await api.submitGridItBattleTemplate(
                activeGridItRoom.id,
                playerSession.playerId,
                tpl
              );
              setActiveGridItRoom(updated);
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onOpenBoardEditor={() =>
            setRoute({ view: 'gridit_editor', returnToLobbyRoomId: activeGridItRoom.id })
          }
          onSendChat={async (text, kind) => {
            const clean = text.trim();
            if (!clean) return;
            const roomId = activeGridItRoom.id;
            const tempId = `temp_gmsg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            setActiveGridItRoom((prev) =>
              prev && prev.id === roomId
                ? {
                    ...prev,
                    messages: [
                      ...prev.messages,
                      {
                        id: tempId,
                        senderId: playerSession.playerId,
                        senderName: playerSession.nickname,
                        senderAvatar: playerSession.avatarId,
                        text: clean,
                        kind,
                        createdAt: Date.now(),
                      },
                    ],
                  }
                : prev
            );
            try {
              const updated = await api.sendGridItRoomChat(
                roomId,
                playerSession.playerId,
                clean,
                kind
              );
              setActiveGridItRoom(updated);
            } catch (err: any) {
              setActiveGridItRoom((prev) =>
                prev && prev.id === roomId
                  ? { ...prev, messages: prev.messages.filter((m) => m.id !== tempId) }
                  : prev
              );
              notify(err.message);
            }
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
            try {
              const next = await api.getGridItMatch(
                activeGridItMatch.id,
                playerSession.playerId,
                targetPid
              );
              setActiveGridItMatch(next);
            } catch (err: any) {
              notify(err.message);
            }
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
            const clean = text.trim();
            if (!clean) return;
            const matchId = activeGridItMatch.id;
            const tempId = `temp_gm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            setActiveGridItMatch((prev) =>
              prev && prev.id === matchId
                ? {
                    ...prev,
                    messages: [
                      ...prev.messages,
                      {
                        id: tempId,
                        senderId: playerSession.playerId,
                        senderName:
                          prev.players[playerSession.playerId]?.username || playerSession.nickname,
                        senderAvatar: playerSession.avatarId,
                        text: clean,
                        kind,
                        createdAt: Date.now(),
                      },
                    ],
                  }
                : prev
            );
            try {
              const msg = await api.sendGridItMatchChat(
                matchId,
                playerSession.playerId,
                clean,
                kind
              );
              setActiveGridItMatch((prev) => {
                if (!prev || prev.id !== matchId) return prev;
                const withoutTemp = prev.messages.filter((m) => m.id !== tempId);
                if (withoutTemp.some((m) => m.id === msg.id)) {
                  return { ...prev, messages: withoutTemp };
                }
                return { ...prev, messages: [...withoutTemp, msg] };
              });
            } catch (err: any) {
              setActiveGridItMatch((prev) =>
                prev && prev.id === matchId
                  ? { ...prev, messages: prev.messages.filter((m) => m.id !== tempId) }
                  : prev
              );
              notify(err.message);
            }
          }}
          onFinishEarly={async () => {
            try {
              const ended = await api.finishGridItMatch(
                activeGridItMatch.id,
                playerSession.playerId
              );
              setActiveGridItMatch(ended);
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onRematch={async () => {
            try {
              const next = await api.rematchGridItMatch(
                activeGridItMatch.id,
                playerSession.playerId
              );
              setActiveGridItMatch(next);
              setRoute({ view: 'gridit_match', matchId: next.id });
            } catch (err: any) {
              notify(err.message);
            }
          }}
          onNotify={notify}
        />
      );
    }

    if (route.view === 'gridit_lobby' || route.view === 'gridit_match') {
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
          Loading GridIt {route.view === 'gridit_lobby' ? 'arena' : 'match'}...
        </div>
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
          onLeave={() => {
            const rid = activeRoom.id;
            setActiveRoom(null);
            setRoute({ view: 'tab', tab: 'home' });
            api.leaveRoom(rid, currentProfile.id).catch(() => undefined);
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
      const isPractice = Boolean(activeMatch.rules.isPractice);
      const recordPracticeFinish = (matchId: string) => {
        if (!isPractice) return;
        const skippedAny = practiceSkippedMatchIdsRef.current.has(matchId);
        const solvedWords = practiceSolvedWordsRef.current[matchId] ?? 0;
        const updatedStats = recordChainItPracticeChainComplete(
          currentProfile.id,
          solvedWords,
          skippedAny
        );
        setChainItPracticeStats(updatedStats);
      };

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
            setRoute(
              isPractice ? { view: 'solo', tab: 'practice' } : { view: 'tab', tab: 'home' }
            );
          }}
          onReturnToRoom={(roomId) => setRoute({ view: 'lobby', roomId })}
          onSubmitGuess={async (guess) => {
            if (offlineMatch) {
              const res = submitOfflineSoloGuess(activeMatch.id, guess);
              if (res.correct) {
                practiceSolvedWordsRef.current[activeMatch.id] =
                  (practiceSolvedWordsRef.current[activeMatch.id] ?? 0) + 1;
              }
              setActiveMatch(res.match);
              if (res.matchWon) {
                if (isPractice) recordPracticeFinish(activeMatch.id);
                else setSoloStages(getOfflineSoloStages());
              }
              return { correct: res.correct, message: res.message };
            }
            const res = await api.submitGuess(
              activeMatch.id,
              currentProfile.id,
              guess,
              route.soloStageId
            );
            if (res.correct) {
              practiceSolvedWordsRef.current[activeMatch.id] =
                (practiceSolvedWordsRef.current[activeMatch.id] ?? 0) + 1;
            }
            setActiveMatch(res.match);
            if (res.matchWon || res.match.status === 'finished') {
              if (isPractice && res.matchWon) recordPracticeFinish(activeMatch.id);
              refreshPlatformData(currentProfile.id);
            }
            return { correct: res.correct, message: res.message };
          }}
          onUseHint={
            isPractice
              ? async () => {
                  const res = offlineMatch
                    ? useOfflinePracticeHint(activeMatch.id)
                    : await api.useChainItPracticeHint(activeMatch.id, currentProfile.id);
                  setActiveMatch(res.match);
                  return { message: res.message };
                }
              : undefined
          }
          onSkipWord={
            isPractice
              ? async () => {
                  practiceSkippedMatchIdsRef.current.add(activeMatch.id);
                  const res = offlineMatch
                    ? skipOfflinePracticeWord(activeMatch.id)
                    : await api.skipChainItPracticeWord(activeMatch.id, currentProfile.id);
                  setActiveMatch(res.match);
                  if (res.matchWon) {
                    recordPracticeFinish(activeMatch.id);
                  }
                  return { message: res.message };
                }
              : undefined
          }
          onPassTurn={async () => {
            if (offlineMatch) return;
            const updated = await api.passTurn(activeMatch.id, currentProfile.id);
            setActiveMatch(updated);
          }}
          onTypingPreview={(preview) => {
            if (offlineMatch) return;
            const payload = {
              matchId: activeMatch.id,
              playerId: currentProfile.id,
              preview,
            };
            const now = Date.now();
            const elapsed = now - lastTypingEmitAtRef.current;
            if (elapsed >= 100) {
              lastTypingEmitAtRef.current = now;
              pendingTypingPayloadRef.current = null;
              if (typingThrottleTimerRef.current !== null) {
                window.clearTimeout(typingThrottleTimerRef.current);
                typingThrottleTimerRef.current = null;
              }
              getSocket().emit('match:typing', payload);
            } else {
              pendingTypingPayloadRef.current = payload;
              if (typingThrottleTimerRef.current === null) {
                typingThrottleTimerRef.current = window.setTimeout(() => {
                  typingThrottleTimerRef.current = null;
                  const latest = pendingTypingPayloadRef.current;
                  pendingTypingPayloadRef.current = null;
                  if (latest) {
                    lastTypingEmitAtRef.current = Date.now();
                    getSocket().emit('match:typing', latest);
                  }
                }, 100 - elapsed);
              }
            }
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
              const next = rematchOfflineSoloOrPractice(
                currentProfile,
                activeMatch.id,
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
            if (offlineMatch) {
              const updated = tickOfflinePracticeMatch(activeMatch.id);
              if (updated) setActiveMatch(updated);
              return;
            }
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
          initialTab={route.tab ?? 'adventure'}
          templates={templates}
          practiceStats={chainItPracticeStats}
          onBack={() => setRoute({ view: 'tab', tab: 'home' })}
          onStartSoloStage={handleStartSoloStage}
          onStartPractice={handleStartPractice}
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
            onSoloAdventure={() => setRoute({ view: 'solo', tab: 'adventure' })}
            onPractice={() => setRoute({ view: 'solo', tab: 'practice' })}
            onLeaderboard={() => setRoute({ view: 'leaderboard' })}
            onRooms={() => setRoute({ view: 'rooms' })}
            onExploreFantasy={() => setRoute({ view: 'solo' })}
            onOpenProfile={() => setRoute({ view: 'tab', tab: 'profile' })}
            onExitToHub={() => setRoute({ view: 'hub' })}
            onOpenTemplates={() => setRoute({ view: 'tab', tab: 'templates' })}
            onSwitchGuest={handleSwitchGuest}
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
            onOpenSolo={() => setRoute({ view: 'solo', tab: 'adventure' })}
            onOpenPractice={() => setRoute({ view: 'solo', tab: 'practice' })}
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

        {tab !== 'home' && (
          <BottomNav
            activeTab={tab}
            onSelect={(nextTab) => setRoute({ view: 'tab', tab: nextTab })}
            onSelectHubTab={(dockTab) => {
              if (dockTab === 'games' || dockTab === 'home') {
                setRoute({ view: 'hub' });
              } else if (dockTab === 'social') {
                setRoute({ view: 'rooms' });
              } else {
                setRoute({ view: 'tab', tab: 'profile' });
              }
            }}
            onQuickPlay={() => setRoute({ view: 'changeit_home' })}
            hasOngoingMatch={ongoingMatches.some((m) => m.isYourTurn)}
          />
        )}
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
