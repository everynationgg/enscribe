import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Crown,
  Gamepad2,
  Hash,
  Mountain,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import {
  OngoingMatchSummary,
  Profile,
  Room,
  RoomRules,
  SoloStage,
} from '../../shared/types';
import { TemplateThumb } from '../components/Artwork';

interface PlayScreenProps {
  profile: Profile;
  ongoingMatches: OngoingMatchSummary[];
  publicRooms: Room[];
  soloStages: SoloStage[];
  rankedQueued: boolean;
  initialSubView?: 'hub' | 'solo' | 'public' | 'create';
  onOpenMatch: (matchId: string) => void;
  onJoinRoomByCode: (code: string) => Promise<void>;
  onCreateRoom: (params: { name: string; isPublic: boolean; rules: Partial<RoomRules> }) => Promise<void>;
  onRefreshPublicRooms: () => void;
  onStartSoloStage: (stageId: string) => Promise<void>;
  onToggleRankedQueue: () => Promise<void>;
  onQuickPlay: () => Promise<void>;
}

export const PlayScreen: React.FC<PlayScreenProps> = ({
  ongoingMatches,
  publicRooms,
  soloStages,
  rankedQueued,
  initialSubView = 'hub',
  onOpenMatch,
  onJoinRoomByCode,
  onCreateRoom,
  onRefreshPublicRooms,
  onStartSoloStage,
  onToggleRankedQueue,
  onQuickPlay,
}) => {
  const [subView, setSubView] = useState<'hub' | 'solo' | 'public' | 'create'>(initialSubView);
  const [roomCode, setRoomCode] = useState('');
  const [newRoomName, setNewRoomName] = useState('Private Room');
  const [newRoomPublic, setNewRoomPublic] = useState(false);
  const [newRoomMode, setNewRoomMode] = useState<'classic' | 'speed_race'>('classic');
  const [newRoomMaxPlayers, setNewRoomMaxPlayers] = useState(2);
  const [newRoomTimer, setNewRoomTimer] = useState(20);
  const [newRoomTimerEnabled, setNewRoomTimerEnabled] = useState(true);
  const [newRoomSource, setNewRoomSource] = useState<'saved_templates' | 'curated_db'>('saved_templates');

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    await onJoinRoomByCode(roomCode.trim().toUpperCase());
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateRoom({
      name: newRoomName.trim() || (newRoomPublic ? 'Public Room' : 'Private Room'),
      isPublic: newRoomPublic,
      rules: {
        mode: newRoomMode,
        maxPlayers: newRoomMaxPlayers,
        timePerWordSeconds: newRoomTimer,
        timerEnabled: newRoomTimerEnabled,
        puzzleSource: newRoomSource,
      },
    });
  };

  return (
    <div className="ens-sheet-screen" style={{ flex: 1, minHeight: 0 }}>
      <header className="ens-royal-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Gamepad2 size={20} color="#7dd3fc" />
          <span style={{ fontSize: 18, fontWeight: 800 }}>Play Chain Clash</span>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            background: 'rgba(255,255,255,0.14)',
            padding: '4px 10px',
            borderRadius: 999,
          }}
        >
          Enscribe Hub
        </span>
      </header>

      <div className="ens-sheet-body">
        {/* Sub-navigation pills */}
        <div className="ens-segmented-tabs" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <button
            type="button"
            className={`ens-seg-tab ${subView === 'hub' ? 'active' : ''}`}
            onClick={() => setSubView('hub')}
          >
            Play
          </button>
          <button
            type="button"
            className={`ens-seg-tab ${subView === 'solo' ? 'active' : ''}`}
            onClick={() => setSubView('solo')}
          >
            Solo
          </button>
          <button
            type="button"
            className={`ens-seg-tab ${subView === 'public' ? 'active' : ''}`}
            onClick={() => {
              setSubView('public');
              onRefreshPublicRooms();
            }}
          >
            Public
          </button>
          <button
            type="button"
            className={`ens-seg-tab ${subView === 'create' ? 'active' : ''}`}
            onClick={() => setSubView('create')}
          >
            Create
          </button>
        </div>

        {subView === 'hub' && (
          <>
            {/* Join by Room Code */}
            <div className="ens-white-card">
              <div className="ens-section-heading">
                <Hash size={15} color="#5b3df5" />
                <span>Join by Room Code</span>
              </div>
              <form onSubmit={handleJoinSubmit} style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Enter code (e.g. 7F3K9)"
                  maxLength={8}
                  className="ens-word-input"
                  style={{ flex: 1 }}
                />
                <button type="submit" className="ens-btn-purple" style={{ padding: '0 16px' }}>
                  Join
                </button>
              </form>
            </div>

            {/* Mode Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              <button type="button" className="ens-mode-card quick-play" onClick={onQuickPlay}>
                <div className="ens-mode-icon">
                  <Zap size={18} fill="#fff" />
                </div>
                <div>
                  <div className="ens-mode-title">Quick Play</div>
                  <div className="ens-mode-sub">Instant lobby</div>
                </div>
              </button>

              <button
                type="button"
                className="ens-mode-card ranked-match"
                onClick={onToggleRankedQueue}
              >
                <div className="ens-mode-icon">
                  <Trophy size={18} color="#ffd34e" />
                </div>
                <div>
                  <div className="ens-mode-title">{rankedQueued ? 'In Queue...' : 'Ranked'}</div>
                  <div className="ens-mode-sub">{rankedQueued ? 'Tap to cancel' : 'Verified RP match'}</div>
                </div>
              </button>

              <button
                type="button"
                className="ens-mode-card solo-adv"
                onClick={() => setSubView('solo')}
              >
                <div className="ens-mode-icon">
                  <Mountain size={18} />
                </div>
                <div>
                  <div className="ens-mode-title">Solo Adventure</div>
                  <div className="ens-mode-sub">Themed stages</div>
                </div>
              </button>

              <button
                type="button"
                className="ens-mode-card public-rooms"
                onClick={() => setSubView('create')}
              >
                <div className="ens-mode-icon">
                  <Plus size={18} />
                </div>
                <div>
                  <div className="ens-mode-title">Friendly Room</div>
                  <div className="ens-mode-sub">Custom rules</div>
                </div>
              </button>
            </div>

            {/* Ongoing Persistent Matches */}
            <section>
              <div className="ens-section-heading">
                <Clock size={15} color="#5b3df5" />
                <span>Ongoing Matches ({ongoingMatches.length})</span>
              </div>
              {ongoingMatches.length === 0 ? (
                <div className="ens-white-card" style={{ fontSize: 12.5, color: '#647096' }}>
                  No ongoing matches yet. Start a Classic or Speed Race match!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {ongoingMatches.map((m) => (
                    <div
                      key={m.matchId}
                      className="ens-white-card"
                      onClick={() => onOpenMatch(m.matchId)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>
                          {m.title} • vs {m.opponentPrimaryName}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#647096', fontWeight: 600 }}>
                          {m.progressLabel} • {m.mode === 'speed_race' ? 'Speed Race' : 'Classic Mode'}
                        </div>
                      </div>
                      <span className={m.isYourTurn ? 'ens-pill-ready' : 'ens-pill-not-ready'}>
                        {m.isYourTurn ? 'Your Turn ▶' : 'Waiting'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Enscribe Multi-Game Platform Shelf */}
            <div className="ens-white-card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  background: '#ece8ff',
                  color: '#5b3df5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>Enscribe Game Collection</div>
                <div style={{ fontSize: 11.5, color: '#647096', fontWeight: 600 }}>
                  Active: Chain Clash • Modular architecture ready for upcoming word games
                </div>
              </div>
            </div>
          </>
        )}

        {subView === 'solo' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div className="ens-section-heading">
              <Mountain size={16} color="#098b72" />
              <span>Solo Adventure — Themed Chains</span>
            </div>
            {soloStages.map((stage) => (
              <div
                key={stage.id}
                className="ens-tpl-card"
                onClick={() => onStartSoloStage(stage.id)}
              >
                <TemplateThumb thumbnailKey={stage.thumbnailKey} size={54} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#5b3df5', textTransform: 'uppercase' }}>
                    Stage {stage.stageNumber} • {stage.theme}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{stage.title}</div>
                  <div style={{ fontSize: 11.5, color: '#647096', fontWeight: 600 }}>
                    {stage.subtitle} ({stage.wordCount} words)
                  </div>
                </div>
                {stage.completed ? (
                  <span className="ens-pill-ready">
                    <CheckCircle2 size={14} />
                    <span>Cleared</span>
                  </span>
                ) : (
                  <span className="ens-btn-purple" style={{ padding: '7px 12px', borderRadius: 10 }}>
                    <Play size={13} fill="#fff" />
                  </span>
                )}
              </div>
            ))}
          </section>
        )}

        {subView === 'public' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="ens-section-heading" style={{ marginBottom: 0 }}>
                <Users size={16} color="#1c51db" />
                <span>Public Rooms ({publicRooms.length})</span>
              </div>
              <button
                type="button"
                onClick={onRefreshPublicRooms}
                style={{
                  border: 'none',
                  background: '#e5e9fa',
                  borderRadius: 9,
                  padding: '5px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={13} />
                <span>Refresh</span>
              </button>
            </div>

            {publicRooms.length === 0 ? (
              <div className="ens-white-card" style={{ textAlign: 'center', fontSize: 13, color: '#647096' }}>
                No open public rooms right now. Create one in the Create tab!
              </div>
            ) : (
              publicRooms.map((r) => (
                <div key={r.id} className="ens-white-card" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{r.name}</div>
                      <div style={{ fontSize: 11.5, color: '#647096', fontWeight: 600 }}>
                        Host: {r.hostName} • Code: <strong>{r.code}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ens-btn-purple"
                      style={{ padding: '7px 14px' }}
                      onClick={() => onJoinRoomByCode(r.code)}
                    >
                      Join ({r.players.length}/{r.rules.maxPlayers})
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    <span className="ens-rule-chip" style={{ fontSize: 11, padding: '3px 8px' }}>
                      {r.rules.mode === 'speed_race' ? 'Speed Race' : 'Classic Mode'}
                    </span>
                    <span className="ens-rule-chip" style={{ fontSize: 11, padding: '3px 8px' }}>
                      {r.rules.timerEnabled ? `${r.rules.timePerWordSeconds}s/word` : 'Untimed'}
                    </span>
                    <span className="ens-rule-chip" style={{ fontSize: 11, padding: '3px 8px' }}>
                      {r.rules.puzzleSource === 'curated_db' ? 'Curated Chains' : 'Custom Templates'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {subView === 'create' && (
          <form onSubmit={handleCreateSubmit} className="ens-white-card" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div className="ens-section-heading" style={{ marginBottom: 0 }}>
              <Crown size={16} color="#5b3df5" />
              <span>Create Multiplayer Room</span>
            </div>

            <label style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', flexDirection: 'column', gap: 4 }}>
              Room Name
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="ens-word-input"
                style={{ textTransform: 'none' }}
              />
            </label>

            <label style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Publicly Discoverable</span>
              <input
                type="checkbox"
                checked={newRoomPublic}
                onChange={(e) => {
                  setNewRoomPublic(e.target.checked);
                  if (newRoomName === 'Private Room' && e.target.checked) setNewRoomName('Public Clash Room');
                  if (newRoomName === 'Public Clash Room' && !e.target.checked) setNewRoomName('Private Room');
                }}
              />
            </label>

            <label style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Game Mode</span>
              <select
                value={newRoomMode}
                onChange={(e) => setNewRoomMode(e.target.value as any)}
                style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid #cbd5e1', fontWeight: 700 }}
              >
                <option value="classic">Classic Mode (Turn-Based)</option>
                <option value="speed_race">Speed Race (Simultaneous)</option>
              </select>
            </label>

            <label style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Players</span>
              <select
                value={newRoomMaxPlayers}
                onChange={(e) => setNewRoomMaxPlayers(Number(e.target.value))}
                style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid #cbd5e1', fontWeight: 700 }}
              >
                <option value={2}>2 Players</option>
                <option value={3}>3 Players</option>
                <option value={4}>4 Players</option>
              </select>
            </label>

            <label style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Puzzle Source</span>
              <select
                value={newRoomSource}
                onChange={(e) => setNewRoomSource(e.target.value as any)}
                style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid #cbd5e1', fontWeight: 700 }}
              >
                <option value="saved_templates">Saved / Custom Templates</option>
                <option value="curated_db">Curated Database Chains</option>
              </select>
            </label>

            <label style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Word Timer ({newRoomTimerEnabled ? `${newRoomTimer}s` : 'Off'})</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={newRoomTimerEnabled}
                  onChange={(e) => setNewRoomTimerEnabled(e.target.checked)}
                />
                {newRoomTimerEnabled && (
                  <select
                    value={newRoomTimer}
                    onChange={(e) => setNewRoomTimer(Number(e.target.value))}
                    style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #cbd5e1', fontWeight: 700 }}
                  >
                    {[15, 20, 30, 45].map((s) => (
                      <option key={s} value={s}>
                        {s}s
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </label>

            <button type="submit" className="ens-btn-purple" style={{ width: '100%', padding: '12px' }}>
              Create &amp; Open Lobby
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
