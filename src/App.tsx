import React, { useCallback, useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import {
  InAppNotification,
  MatchHistorySummary,
  MatchStateClient,
  OngoingMatchSummary,
  Profile,
  Room,
  RoomRules,
  SoloStage,
  Template,
  ThumbnailKey,
} from '../shared/types';
import { api } from './services/api';
import { getSocket } from './services/socket';
import { BottomNav, NavTab } from './components/BottomNav';
import { HomeScreen } from './screens/HomeScreen';
import { PlayScreen } from './screens/PlayScreen';
import { TemplatesScreen } from './screens/TemplatesScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameplayScreen } from './screens/GameplayScreen';

type ActiveRoute =
  | { view: 'tab'; tab: NavTab; playSubView?: 'hub' | 'solo' | 'public' | 'create' }
  | { view: 'lobby'; roomId: string }
  | { view: 'match'; matchId: string; soloStageId?: string | null };

const TAB_STORAGE_KEY = 'enscribe_tab_profile_id';
const ROUTE_STORAGE_KEY = 'enscribe_tab_route_v1';

export const App: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>(
    () => sessionStorage.getItem(TAB_STORAGE_KEY) || 'player_alex'
  );
  const [route, setRoute] = useState<ActiveRoute>(() => {
    try {
      const saved = sessionStorage.getItem(ROUTE_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return { view: 'tab', tab: 'home' };
  });

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
    sessionStorage.setItem(TAB_STORAGE_KEY, activeProfileId);
  }, [activeProfileId]);

  useEffect(() => {
    sessionStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(route));
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

  const refreshPlatformData = useCallback(async (pid: string) => {
    try {
      const [allProfs, tpls, ongoing, pubRooms, stages, notifs, detail] = await Promise.all([
        api.listProfiles(),
        api.listTemplates(pid),
        api.listOngoingMatches(pid),
        api.listPublicRooms(),
        api.listSoloStages(pid),
        api.listNotifications(pid),
        api.getProfileDetail(pid),
      ]);
      setProfiles(allProfs);
      setTemplates(tpls);
      setOngoingMatches(ongoing);
      setPublicRooms(pubRooms);
      setSoloStages(stages);
      setNotifications(notifs);
      setMatchHistory(detail.history);
    } catch (err: any) {
      console.error('Failed refreshing platform data:', err);
    }
  }, []);

  useEffect(() => {
    refreshPlatformData(activeProfileId);
  }, [activeProfileId, refreshPlatformData]);

  // Socket.IO connection & real-time events
  useEffect(() => {
    const socket = getSocket();
    const identify = () => {
      socket.emit('auth:identify', activeProfileId);
      if (route.view === 'lobby') {
        socket.emit('room:join_channel', route.roomId);
      }
      if (route.view === 'match') {
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
      setActiveMatch((prev) => (!prev || prev.id === match.id ? match : prev));
      refreshPlatformData(activeProfileId);
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

    socket.on('room:updated', onRoomUpdated);
    socket.on('room:match_started', onRoomMatchStarted);
    socket.on('match:state', onMatchState);
    socket.on('rooms:public_updated', onPublicUpdated);
    socket.on('matchmaking:ranked_matched', onRankedMatched);
    socket.on('match:rematch_created', onRematchCreated);

    return () => {
      socket.off('connect', identify);
      socket.off('room:updated', onRoomUpdated);
      socket.off('room:match_started', onRoomMatchStarted);
      socket.off('match:state', onMatchState);
      socket.off('rooms:public_updated', onPublicUpdated);
      socket.off('matchmaking:ranked_matched', onRankedMatched);
      socket.off('match:rematch_created', onRematchCreated);
    };
  }, [activeProfileId, route.view, (route as any).roomId, (route as any).matchId, notify, refreshPlatformData]);

  // Restore room or match state cleanly on route change or browser refresh
  useEffect(() => {
    const socket = getSocket();
    if (route.view === 'lobby') {
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
  }, [route, activeProfileId, notify]);

  const currentProfile =
    profiles.find((p) => p.id === activeProfileId) ??
    profiles[0] ?? {
      id: 'player_alex',
      username: 'Alex',
      avatarId: 'alex',
      rankTier: 'Gold II',
      rankPoints: 1248,
      wins: 18,
      losses: 9,
      matchPointsBalance: 420,
      equippedCosmetics: {
        tileSkin: 'classic_cream',
        boardSkin: 'royal_cosmos',
        backgroundTheme: 'deep_blue',
        chatBubbleStyle: 'frost_pill',
      },
      createdAt: Date.now(),
    };

  const handleOpenMatch = (matchId: string) => {
    setRoute({ view: 'match', matchId });
  };

  const handleQuickPlay = async () => {
    try {
      const res = await api.quickPlay(currentProfile.id);
      setActiveRoom(res.room);
      setRoute({ view: 'lobby', roomId: res.room.id });
    } catch (err: any) {
      notify(err.message);
    }
  };

  const handleRankedMatch = async () => {
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
    try {
      const room = await api.joinRoom(code, currentProfile.id);
      setActiveRoom(room);
      setRoute({ view: 'lobby', roomId: room.id });
    } catch (err: any) {
      notify(err.message);
    }
  };

  const handlePlayWithTemplate = async (tpl: Template) => {
    try {
      const room = await api.createRoom({
        hostId: currentProfile.id,
        name: `${tpl.name} Room`,
        isPublic: false,
      });
      const updated = await api.submitRoomPuzzle(room.id, currentProfile.id, {
        templateId: tpl.id,
        puzzleStatus: 'ready',
      });
      setActiveRoom(updated);
      setRoute({ view: 'lobby', roomId: updated.id });
      notify(`Room ${updated.code} created with "${tpl.name}" ready!`);
    } catch (err: any) {
      notify(err.message);
    }
  };

  const handleStartSoloStage = async (stageId: string) => {
    try {
      const res = await api.startSoloMatch(currentProfile.id, { stageId });
      setActiveMatch(res.match);
      setRoute({ view: 'match', matchId: res.match.id, soloStageId: res.stageId });
    } catch (err: any) {
      notify(err.message);
    }
  };

  const openNotifications = async () => {
    setShowNotifModal(true);
    await api.markNotificationsRead(currentProfile.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const renderScreen = () => {
    if (route.view === 'lobby' && activeRoom) {
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
            const updated = await api.sendRoomChat(activeRoom.id, currentProfile.id, text);
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

    if (route.view === 'match' && activeMatch) {
      return (
        <GameplayScreen
          match={activeMatch}
          currentProfile={currentProfile}
          onBackHome={() => {
            refreshPlatformData(currentProfile.id);
            setRoute({ view: 'tab', tab: 'home' });
          }}
          onReturnToRoom={(roomId) => setRoute({ view: 'lobby', roomId })}
          onSubmitGuess={async (guess) => {
            const res = await api.submitGuess(
              activeMatch.id,
              currentProfile.id,
              guess,
              route.soloStageId
            );
            setActiveMatch(res.match);
            refreshPlatformData(currentProfile.id);
            return { correct: res.correct, message: res.message };
          }}
          onPassTurn={async () => {
            const updated = await api.passTurn(activeMatch.id, currentProfile.id);
            setActiveMatch(updated);
          }}
          onTypingPreview={(preview) => {
            getSocket().emit('match:typing', {
              matchId: activeMatch.id,
              playerId: currentProfile.id,
              preview,
            });
          }}
          onSendChat={async (text) => {
            await api.sendMatchChat(activeMatch.id, currentProfile.id, text);
          }}
          onRematch={async () => {
            const next = await api.rematch(activeMatch.id, currentProfile.id);
            setActiveMatch(next);
            setRoute({ view: 'match', matchId: next.id });
          }}
        />
      );
    }

    const tab = route.view === 'tab' ? route.tab : 'home';

    return (
      <>
        {tab === 'home' && (
          <HomeScreen
            profile={currentProfile}
            ongoingMatches={ongoingMatches}
            notifications={notifications}
            onOpenNotifications={openNotifications}
            onContinueMatch={handleOpenMatch}
            onViewAllMatches={() => setRoute({ view: 'tab', tab: 'play', playSubView: 'hub' })}
            onQuickPlay={handleQuickPlay}
            onRankedMatch={handleRankedMatch}
            onSoloAdventure={() => setRoute({ view: 'tab', tab: 'play', playSubView: 'solo' })}
            onPublicRooms={() => setRoute({ view: 'tab', tab: 'play', playSubView: 'public' })}
            onCreateRoom={() => setRoute({ view: 'tab', tab: 'play', playSubView: 'create' })}
            onExploreFantasy={() => setRoute({ view: 'tab', tab: 'play', playSubView: 'solo' })}
            onOpenProfile={() => setRoute({ view: 'tab', tab: 'profile' })}
          />
        )}

        {tab === 'play' && (
          <PlayScreen
            key={route.view === 'tab' ? route.playSubView || 'hub' : 'hub'}
            profile={currentProfile}
            ongoingMatches={ongoingMatches}
            publicRooms={publicRooms}
            soloStages={soloStages}
            rankedQueued={rankedQueued}
            initialSubView={route.view === 'tab' ? route.playSubView || 'hub' : 'hub'}
            onOpenMatch={handleOpenMatch}
            onJoinRoomByCode={handleJoinRoomByCode}
            onCreateRoom={handleCreateRoom}
            onRefreshPublicRooms={() => api.listPublicRooms().then(setPublicRooms).catch(() => undefined)}
            onStartSoloStage={handleStartSoloStage}
            onToggleRankedQueue={handleRankedMatch}
            onQuickPlay={handleQuickPlay}
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
              const saved = await api.saveTemplate(tplData);
              await refreshPlatformData(currentProfile.id);
              return saved;
            }}
            onDuplicateTemplate={async (id) => {
              const dup = await api.duplicateTemplate(id, currentProfile.id);
              await refreshPlatformData(currentProfile.id);
              return dup;
            }}
            onDeleteTemplate={async (id) => {
              await api.deleteTemplate(id);
              await refreshPlatformData(currentProfile.id);
            }}
            onPlayWithTemplate={handlePlayWithTemplate}
            onNotify={notify}
          />
        )}

        {tab === 'profile' && (
          <ProfileScreen
            profile={currentProfile}
            allProfiles={profiles}
            matchHistory={matchHistory}
            onSwitchProfile={(pid) => {
              setActiveProfileId(pid);
              setActiveRoom(null);
              setActiveMatch(null);
              notify(`Switched active profile`);
            }}
            onCreateProfile={async (username, avatarId) => {
              const created = await api.createProfile(username, avatarId);
              setActiveProfileId(created.id);
              notify(`Created profile "${created.username}"`);
            }}
            onUpdateCosmetics={async (cosmetics) => {
              await api.updateCosmetics(currentProfile.id, cosmetics);
              await refreshPlatformData(currentProfile.id);
              notify('Cosmetics updated');
            }}
          />
        )}

        <BottomNav
          activeTab={tab}
          onSelect={(nextTab) => setRoute({ view: 'tab', tab: nextTab })}
          hasOngoingMatch={ongoingMatches.some((m) => m.isYourTurn)}
        />
      </>
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
            <span>Offline — Multiplayer paused until reconnected</span>
          </div>
        )}

        {toast && <div className="ens-toast">{toast}</div>}

        {renderScreen()}

        {showNotifModal && (
          <div className="ens-modal-backdrop" onClick={() => setShowNotifModal(false)}>
            <div className="ens-modal-card" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Notifications</h3>
                <button
                  type="button"
                  onClick={() => setShowNotifModal(false)}
                  style={{ border: 'none', background: '#e5e9fa', borderRadius: 8, padding: '4px 10px', fontWeight: 700 }}
                >
                  Close
                </button>
              </div>
              {notifications.length === 0 ? (
                <div style={{ fontSize: 13, color: '#647096' }}>You&apos;re all caught up!</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: '#5d678c', fontWeight: 600 }}>{n.body}</div>
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
