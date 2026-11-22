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
import { SignInScreen } from './screens/SignInScreen';

type ActiveRoute =
  | { view: 'tab'; tab: NavTab; playSubView?: 'hub' | 'solo' | 'public' | 'create' }
  | { view: 'lobby'; roomId: string }
  | { view: 'match'; matchId: string; soloStageId?: string | null };

const TAB_STORAGE_KEY = 'enscribe_tab_profile_id';
const DEVICE_STORAGE_KEY = 'enscribe_profile_id';
const ROUTE_STORAGE_KEY = 'enscribe_tab_route_v1';

export const App: React.FC = () => {
  const [activeProfileId, setActiveProfileId] = useState<string | null>(
    () => sessionStorage.getItem(TAB_STORAGE_KEY) || localStorage.getItem(DEVICE_STORAGE_KEY) || null
  );
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(Boolean(activeProfileId));
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
    if (activeProfileId) {
      sessionStorage.setItem(TAB_STORAGE_KEY, activeProfileId);
      localStorage.setItem(DEVICE_STORAGE_KEY, activeProfileId);
    } else {
      sessionStorage.removeItem(TAB_STORAGE_KEY);
      localStorage.removeItem(DEVICE_STORAGE_KEY);
    }
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
      const data = await api.getBootstrap(pid);
      setCurrentProfile(data.profile);
      setMatchHistory(data.history);
      setTemplates(data.templates);
      setOngoingMatches(data.ongoingMatches);
      setPublicRooms(data.publicRooms);
      setSoloStages(data.soloStages);
      setNotifications(data.notifications);
    } catch (err: any) {
      console.error('Failed loading profile:', err);
      setCurrentProfile(null);
      setActiveProfileId(null);
    } finally {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!activeProfileId) {
      setCurrentProfile(null);
      setAuthChecking(false);
      return;
    }
    setAuthChecking(true);
    refreshPlatformData(activeProfileId);
  }, [activeProfileId, refreshPlatformData]);

  // Realtime connection & events (Supabase Realtime everywhere + Socket.IO on localhost)
  useEffect(() => {
    if (!activeProfileId) return;
    const socket = getSocket();
    socket.setActivePlayerId(activeProfileId);

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

    socket.on('room:updated', onRoomUpdated);
    socket.on('room:match_started', onRoomMatchStarted);
    socket.on('match:state', onMatchState);
    socket.on('match:typing_live', onTypingLive);
    socket.on('rooms:public_updated', onPublicUpdated);
    socket.on('matchmaking:ranked_matched', onRankedMatched);
    socket.on('match:rematch_created', onRematchCreated);

    return () => {
      socket.off('connect', identify);
      socket.off('room:updated', onRoomUpdated);
      socket.off('room:match_started', onRoomMatchStarted);
      socket.off('match:state', onMatchState);
      socket.off('match:typing_live', onTypingLive);
      socket.off('rooms:public_updated', onPublicUpdated);
      socket.off('matchmaking:ranked_matched', onRankedMatched);
      socket.off('match:rematch_created', onRematchCreated);
    };
  }, [activeProfileId, route.view, (route as any).roomId, (route as any).matchId, notify, refreshPlatformData]);

  // Lightweight resilience sync for serverless/mobile networks when in an active lobby or match
  useEffect(() => {
    if (!activeProfileId || (route.view !== 'lobby' && route.view !== 'match')) return;
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
  }, [route, activeProfileId]);

  // Restore room or match state cleanly on route change or browser refresh
  useEffect(() => {
    if (!activeProfileId) return;
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

  const handleSignIn = async (username: string, avatarId: string) => {
    const res = await api.signIn(username, avatarId);
    setCurrentProfile(res.profile);
    setActiveProfileId(res.profile.id);
    setActiveRoom(null);
    setActiveMatch(null);
    setRoute({ view: 'tab', tab: 'home' });
    notify(res.isNew ? `Welcome, ${res.profile.username}!` : `Welcome back, ${res.profile.username}!`);
  };

  const handleSignOut = () => {
    setActiveProfileId(null);
    setCurrentProfile(null);
    setActiveRoom(null);
    setActiveMatch(null);
    setRoute({ view: 'tab', tab: 'home' });
  };

  const handleOpenMatch = (matchId: string) => {
    setRoute({ view: 'match', matchId });
  };

  const handleQuickPlay = async () => {
    if (!currentProfile) return;
    try {
      const res = await api.quickPlay(currentProfile.id);
      setActiveRoom(res.room);
      setRoute({ view: 'lobby', roomId: res.room.id });
    } catch (err: any) {
      notify(err.message);
    }
  };

  const handleRankedMatch = async () => {
    if (!currentProfile) return;
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
    if (!currentProfile) return;
    try {
      const res = await api.startSoloMatch(currentProfile.id, { stageId });
      setActiveMatch(res.match);
      setRoute({ view: 'match', matchId: res.match.id, soloStageId: res.stageId });
    } catch (err: any) {
      notify(err.message);
    }
  };

  const openNotifications = async () => {
    if (!currentProfile) return;
    setShowNotifModal(true);
    await api.markNotificationsRead(currentProfile.id);
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
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          Signing in...
        </div>
      );
    }

    if (!currentProfile) {
      return <SignInScreen onSignIn={handleSignIn} />;
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
      return (
        <GameplayScreen
          match={activeMatch}
          currentProfile={currentProfile}
          onBackHome={() => {
            setActiveMatch(null);
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
            if (res.matchWon || res.match.status === 'finished') {
              refreshPlatformData(currentProfile.id);
            }
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
            const msg = await api.sendMatchChat(activeMatch.id, currentProfile.id, text);
            setActiveMatch((prev) =>
              prev && prev.id === activeMatch.id && !prev.messages.some((m) => m.id === msg.id)
                ? { ...prev, messages: [...prev.messages, msg] }
                : prev
            );
          }}
          onRematch={async () => {
            const next = await api.rematch(activeMatch.id, currentProfile.id);
            setActiveMatch(next);
            setRoute({ view: 'match', matchId: next.id });
          }}
          onTimerExpired={() => {
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
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          Loading {route.view === 'lobby' ? 'room' : 'match'}...
        </div>
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
              setTemplates((prev) => {
                const rest = prev.filter((t) => t.id !== saved.id);
                return [saved, ...rest];
              });
              return saved;
            }}
            onDuplicateTemplate={async (id) => {
              const dup = await api.duplicateTemplate(id, currentProfile.id);
              setTemplates((prev) => [dup, ...prev]);
              return dup;
            }}
            onDeleteTemplate={async (id) => {
              setTemplates((prev) => prev.filter((t) => t.id !== id));
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
              const updated = await api.updateProfile(currentProfile.id, data);
              setCurrentProfile(updated);
              notify('Profile updated');
            }}
            onUpdateCosmetics={async (cosmetics) => {
              await api.updateCosmetics(currentProfile.id, cosmetics);
              await refreshPlatformData(currentProfile.id);
              notify('Cosmetics updated');
            }}
            onSignOut={handleSignOut}
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
