import React, { useState } from 'react';
import {
  ArrowLeft,
  Flame,
  Globe,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import { CHANGEIT_DIFFICULTY_ORDER, DIFFICULTY_CONFIGS } from '../../../shared/changeit/difficulty';
import {
  ChangeItDifficulty,
  ChangeItMultiplayerMode,
  ChangeItRoom,
  ChangeItRoomSettings,
  ChangeItWordLength,
} from '../../../shared/types';

interface ChangeItRoomsScreenProps {
  publicRooms: ChangeItRoom[];
  isOffline: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onCreateRoom: (params: { name?: string; settings: Partial<ChangeItRoomSettings> }) => Promise<void>;
  onJoinRoom: (codeOrId: string) => Promise<void>;
}

const MODE_OPTIONS: Array<{
  id: ChangeItMultiplayerMode;
  label: string;
  desc: string;
  icon: React.ReactNode;
}> = [
  { id: 'classic_sprint', label: 'Classic — Sprint', desc: 'First to reach target wins', icon: <Zap size={14} color="#22d3ee" /> },
  { id: 'classic_precision', label: 'Classic — Precision', desc: 'Fewest moves wins under timer', icon: <Target size={14} color="#c084fc" /> },
  { id: 'tug_of_war', label: 'Tug of War', desc: 'Opposite ends of same ladder', icon: <Sparkles size={14} color="#34d399" /> },
  { id: 'survival', label: 'Survival', desc: 'Chain puzzles for bonus time', icon: <Flame size={14} color="#fb923c" /> },
  { id: 'restricted', label: 'Restricted', desc: 'Verified letter & slot locks', icon: <Lock size={14} color="#fbbf24" /> },
  { id: 'relay', label: 'Relay (2v2)', desc: 'Teammates alternate moves', icon: <Users size={14} color="#60a5fa" /> },
  { id: 'sabotage', label: 'Sabotage', desc: 'Earn & fire tactical modifiers', icon: <ShieldAlert size={14} color="#f472b6" /> },
];

export const ChangeItRoomsScreen: React.FC<ChangeItRoomsScreenProps> = ({
  publicRooms,
  isOffline,
  onBack,
  onRefresh,
  onCreateRoom,
  onJoinRoom,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [mode, setMode] = useState<ChangeItMultiplayerMode>('classic_sprint');
  const [difficulty, setDifficulty] = useState<ChangeItDifficulty>('easy');
  const [wordLength, setWordLength] = useState<ChangeItWordLength | 'auto'>('auto');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(180);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [isPublic, setIsPublic] = useState(true);
  const [modifiersEnabled, setModifiersEnabled] = useState(false);
  const [hintsAllowed, setHintsAllowed] = useState(true);
  const [busy, setBusy] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || busy || isOffline) return;
    setBusy(true);
    try {
      await onJoinRoom(joinCode.trim().toUpperCase());
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (busy || isOffline) return;
    setBusy(true);
    try {
      await onCreateRoom({
        name: roomName.trim() || undefined,
        settings: {
          mode,
          difficulty,
          wordLength,
          timeLimitSeconds,
          maxPlayers: mode === 'relay' ? 4 : mode === 'tug_of_war' ? 2 : maxPlayers,
          isPublic,
          modifiersEnabled: mode === 'sabotage' ? true : modifiersEnabled,
          hintsAllowed,
        },
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ci-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />
      <header className="ci-topbar">
        <button
          type="button"
          className="ci-icon-btn"
          onClick={onBack}
          aria-label="Back to ChangeIt"
        >
          <ArrowLeft size={18} strokeWidth={2.8} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 900 }}>ChangeIt Rooms</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#a5f3fc' }}>
            Public Lobbies &amp; Private Rooms
          </div>
        </div>
        <button
          type="button"
          className="ci-icon-btn"
          onClick={onRefresh}
          disabled={isOffline}
          aria-label="Refresh public rooms"
        >
          <RefreshCw size={15} />
        </button>
      </header>

      <div className="ci-scroll">
        <div className="ci-wrap">
          {/* Join by Code */}
          <form onSubmit={handleJoin} className="ci-card" style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 8))}
                placeholder="Enter Room Code (e.g. C4X9K2)"
                className="ens-fantasy-input"
                style={{ width: '100%', minHeight: 42, fontSize: 13.5, fontWeight: 800, paddingLeft: 34 }}
              />
              <KeyRound
                size={15}
                color="#67e8f9"
                style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
            <button
              type="submit"
              disabled={isOffline || busy || joinCode.trim().length < 4}
              className="ci-cta-cyan"
              style={{ width: 'auto', minHeight: 42, padding: '0 16px' }}
            >
              Join
            </button>
          </form>

          {/* Create Room Toggle / Panel */}
          {!showCreate ? (
            <button
              type="button"
              disabled={isOffline}
              className="ci-cta-green"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={18} strokeWidth={2.8} />
              <span>Create Custom or Public Room</span>
            </button>
          ) : (
            <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="ci-card-title">
                <span>Configure ChangeIt Room</span>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="ci-pill"
                  style={{ cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>

              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value.slice(0, 40))}
                placeholder="Room name (optional)"
                className="ens-fantasy-input"
                style={{ minHeight: 40, fontSize: 13.5 }}
              />

              <div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#a5f3fc', marginBottom: 6 }}>
                  Game Mode
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {MODE_OPTIONS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setMode(m.id);
                        if (m.id === 'sabotage') setModifiersEnabled(true);
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '8px 9px',
                        borderRadius: 12,
                        border:
                          mode === m.id
                            ? '2px solid #22d3ee'
                            : '1px solid rgba(148, 163, 184, 0.28)',
                        background:
                          mode === m.id ? 'rgba(8, 145, 178, 0.34)' : 'rgba(10, 20, 76, 0.65)',
                        color: '#ffffff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 900 }}>
                        {m.icon}
                        <span>{m.label}</span>
                      </div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#cbd5e1', marginTop: 2 }}>
                        {m.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, fontWeight: 800, color: '#a5f3fc' }}>
                  <span>Difficulty</span>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as ChangeItDifficulty)}
                    className="ens-select-pill"
                    style={{ height: 38, width: '100%' }}
                  >
                    {CHANGEIT_DIFFICULTY_ORDER.map((d) => (
                      <option key={d} value={d}>
                        {DIFFICULTY_CONFIGS[d].label}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, fontWeight: 800, color: '#a5f3fc' }}>
                  <span>Word Length</span>
                  <select
                    value={String(wordLength)}
                    onChange={(e) =>
                      setWordLength(
                        e.target.value === 'auto' ? 'auto' : (Number(e.target.value) as ChangeItWordLength)
                      )
                    }
                    className="ens-select-pill"
                    style={{ height: 38, width: '100%' }}
                  >
                    <option value="auto">Auto (By Difficulty)</option>
                    <option value="3">3 Letters</option>
                    <option value="4">4 Letters</option>
                    <option value="5">5 Letters</option>
                    <option value="6">6 Letters</option>
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, fontWeight: 800, color: '#a5f3fc' }}>
                  <span>Time Limit</span>
                  <select
                    value={timeLimitSeconds}
                    onChange={(e) => setTimeLimitSeconds(Number(e.target.value))}
                    className="ens-select-pill"
                    style={{ height: 38, width: '100%' }}
                  >
                    <option value={90}>1m 30s</option>
                    <option value={120}>2m 00s</option>
                    <option value={180}>3m 00s</option>
                    <option value={240}>4m 00s</option>
                    <option value={300}>5m 00s</option>
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, fontWeight: 800, color: '#a5f3fc' }}>
                  <span>Max Players</span>
                  <select
                    value={mode === 'relay' ? 4 : mode === 'tug_of_war' ? 2 : maxPlayers}
                    disabled={mode === 'relay' || mode === 'tug_of_war'}
                    onChange={(e) => setMaxPlayers(Number(e.target.value))}
                    className="ens-select-pill"
                    style={{ height: 38, width: '100%' }}
                  >
                    <option value={2}>2 Players</option>
                    <option value={4}>4 Players</option>
                    <option value={6}>6 Players</option>
                    <option value={8}>8 Players</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsPublic((v) => !v)}
                  className={`ci-pill ${isPublic ? 'is-cyan' : ''}`}
                  style={{ cursor: 'pointer', padding: '7px 11px' }}
                >
                  {isPublic ? <Globe size={13} /> : <Lock size={13} />}
                  <span>{isPublic ? 'Public Room' : 'Private Room'}</span>
                </button>

                {(mode === 'classic_sprint' || mode === 'classic_precision') && (
                  <button
                    type="button"
                    onClick={() => setModifiersEnabled((v) => !v)}
                    className={`ci-pill ${modifiersEnabled ? 'is-violet' : ''}`}
                    style={{ cursor: 'pointer', padding: '7px 11px' }}
                  >
                    <ShieldAlert size={13} />
                    <span>Modifiers: {modifiersEnabled ? 'ON' : 'OFF'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setHintsAllowed((v) => !v)}
                  className={`ci-pill ${hintsAllowed ? 'is-green' : ''}`}
                  style={{ cursor: 'pointer', padding: '7px 11px' }}
                >
                  <Sparkles size={13} />
                  <span>Hints: {hintsAllowed ? 'Allowed' : 'Off'}</span>
                </button>
              </div>

              <button
                type="button"
                disabled={busy || isOffline}
                className="ci-cta-cyan"
                onClick={handleCreate}
              >
                {busy ? 'Creating Room...' : 'Create & Enter Lobby'}
              </button>
            </div>
          )}

          {/* Public Rooms List */}
          <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="ci-card-title">
              <span>Public Rooms ({publicRooms.length})</span>
              <Globe size={14} color="#22d3ee" />
            </div>

            {publicRooms.length === 0 ? (
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#cbd5e1' }}>
                No public ChangeIt rooms waiting right now. Create one or enter a private code!
              </div>
            ) : (
              publicRooms.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '9px 11px',
                    borderRadius: 14,
                    background: 'rgba(10, 20, 76, 0.78)',
                    border: '1px solid rgba(103, 232, 249, 0.25)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', marginTop: 2 }}>
                      {r.settings.mode.replace(/_/g, ' ').toUpperCase()} •{' '}
                      {DIFFICULTY_CONFIGS[r.settings.difficulty].label} • {r.players.length}/
                      {r.settings.maxPlayers} players
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isOffline || busy}
                    onClick={() => onJoinRoom(r.code)}
                    className="ci-cta-cyan"
                    style={{ width: 'auto', minHeight: 36, padding: '0 14px', fontSize: 12.5 }}
                  >
                    Join
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
