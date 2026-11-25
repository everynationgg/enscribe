import React, { useState } from 'react';
import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  Play,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { CHANGEIT_DIFFICULTY_ORDER, DIFFICULTY_CONFIGS } from '../../../shared/changeit/difficulty';
import {
  ChangeItCustomPuzzleValidation,
  ChangeItDifficulty,
  ChangeItMultiplayerMode,
  ChangeItRoom,
  ChangeItRoomSettings,
  ChangeItTeamId,
  ChangeItWordLength,
  PlayerSession,
  Template,
} from '../../../shared/types';
import { AvatarBadge } from '../../components/Artwork';
import { api } from '../../services/api';
import { buildRoomShareUrl, copyTextToClipboard } from '../../services/shareLink';

interface ChangeItLobbyScreenProps {
  room: ChangeItRoom;
  session: PlayerSession;
  templates: Template[];
  onLeave: () => void;
  onUpdateSettings: (partial: Partial<ChangeItRoomSettings>) => Promise<void>;
  onToggleReady: (isReady: boolean) => Promise<void>;
  onSwitchTeam: (teamId: ChangeItTeamId) => Promise<void>;
  onSetCustomPuzzle: (payload: { startWord?: string; targetWord?: string; clear?: boolean }) => Promise<void>;
  onSaveCustomPuzzleTemplate: (startWord: string, targetWord: string) => Promise<void>;
  onSendChat: (text: string) => Promise<void>;
  onStartMatch: () => Promise<void>;
  onNotify: (msg: string) => void;
}

export const ChangeItLobbyScreen: React.FC<ChangeItLobbyScreenProps> = ({
  room,
  session,
  templates,
  onLeave,
  onUpdateSettings,
  onToggleReady,
  onSwitchTeam,
  onSetCustomPuzzle,
  onSaveCustomPuzzleTemplate,
  onSendChat,
  onStartMatch,
  onNotify,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [customStart, setCustomStart] = useState(room.customPuzzle?.startWord ?? '');
  const [customTarget, setCustomTarget] = useState(room.customPuzzle?.targetWord ?? '');
  const [validationResult, setValidationResult] =
    useState<ChangeItCustomPuzzleValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [starting, setStarting] = useState(false);

  const isHost = room.hostId === session.playerId;
  const me = room.players.find((p) => p.playerId === session.playerId);
  const isRelay = room.settings.mode === 'relay';
  const blueTeam = room.players.filter((p) => p.teamId === 'blue');
  const redTeam = room.players.filter((p) => p.teamId === 'red');

  const changeItTemplates = templates.filter(
    (t) =>
      t.theme.toLowerCase() === 'changeit' &&
      t.words.length === 2 &&
      t.words[0].length === t.words[1].length
  );

  const canStart = (() => {
    if (!isHost || room.players.length < 2) return false;
    if (isRelay) {
      if (blueTeam.length < 1 || redTeam.length < 1) return false;
      if (room.players.length >= 4 && (blueTeam.length < 2 || redTeam.length < 2)) return false;
    }
    return room.players.every((p) => p.isHost || p.isReady);
  })();

  const handleCopyInvite = () => {
    const url = buildRoomShareUrl('changeit', room.code);
    void copyTextToClipboard(url);
    onNotify(`Invite link copied! (${room.code})`);
  };

  const handleValidateCustom = async () => {
    setValidating(true);
    try {
      const res = await api.validateChangeItPuzzle(customStart, customTarget);
      setValidationResult(res);
    } catch (err: any) {
      setValidationResult({
        valid: false,
        startWord: customStart.toUpperCase(),
        targetWord: customTarget.toUpperCase(),
        wordLength: customStart.length,
        minMoves: null,
        familiarPathAvailable: false,
        error: err?.message || 'Validation failed',
      });
    } finally {
      setValidating(false);
    }
  };

  const handleApplyCustom = async () => {
    await onSetCustomPuzzle({ startWord: customStart, targetWord: customTarget });
    onNotify('Custom puzzle locked in for this room!');
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatDraft.trim()) return;
    const text = chatDraft.trim();
    setChatDraft('');
    await onSendChat(text);
  };

  return (
    <div className="ci-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />
      <header className="ci-topbar">
        <button type="button" className="ci-icon-btn" onClick={onLeave} aria-label="Leave room">
          <ArrowLeft size={18} strokeWidth={2.8} />
        </button>
        <div style={{ textAlign: 'center', minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {room.name}
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#a5f3fc' }}>
            {room.settings.mode.replace(/_/g, ' ').toUpperCase()} •{' '}
            {DIFFICULTY_CONFIGS[room.settings.difficulty].label}
          </div>
        </div>
        {isHost ? (
          <button
            type="button"
            className="ci-icon-btn"
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Room settings"
          >
            <Settings size={17} />
          </button>
        ) : (
          <div style={{ width: 36 }} />
        )}
      </header>

      <div className="ci-scroll">
        <div className="ci-wrap">
          {/* Invite Code Card */}
          <div className="ci-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd' }}>ROOM INVITE CODE</div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.14em', color: '#67e8f9' }}>
                {room.code}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyInvite}
              className="ci-pill is-cyan"
              style={{ cursor: 'pointer', padding: '8px 12px' }}
            >
              <Copy size={14} />
              <span>Copy Invite</span>
            </button>
          </div>

          {/* Host Settings Drawer */}
          {isHost && showSettings && (
            <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="ci-card-title">
                <span>Host Match Rules</span>
                <Settings size={14} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#a5f3fc' }}>
                  Mode
                  <select
                    value={room.settings.mode}
                    onChange={(e) =>
                      onUpdateSettings({ mode: e.target.value as ChangeItMultiplayerMode })
                    }
                    className="ens-select-pill"
                    style={{ width: '100%', height: 36, marginTop: 3 }}
                  >
                    <option value="classic_sprint">Classic — Sprint</option>
                    <option value="classic_precision">Classic — Precision</option>
                    <option value="tug_of_war">Tug of War</option>
                    <option value="survival">Survival</option>
                    <option value="restricted">Restricted</option>
                    <option value="relay">Relay (2v2)</option>
                    <option value="sabotage">Sabotage</option>
                  </select>
                </label>

                <label style={{ fontSize: 11, fontWeight: 800, color: '#a5f3fc' }}>
                  Difficulty
                  <select
                    value={room.settings.difficulty}
                    onChange={(e) =>
                      onUpdateSettings({ difficulty: e.target.value as ChangeItDifficulty })
                    }
                    className="ens-select-pill"
                    style={{ width: '100%', height: 36, marginTop: 3 }}
                  >
                    {CHANGEIT_DIFFICULTY_ORDER.map((d) => (
                      <option key={d} value={d}>
                        {DIFFICULTY_CONFIGS[d].label}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ fontSize: 11, fontWeight: 800, color: '#a5f3fc' }}>
                  Word Length
                  <select
                    value={String(room.settings.wordLength)}
                    onChange={(e) =>
                      onUpdateSettings({
                        wordLength:
                          e.target.value === 'auto'
                            ? 'auto'
                            : (Number(e.target.value) as ChangeItWordLength),
                      })
                    }
                    className="ens-select-pill"
                    style={{ width: '100%', height: 36, marginTop: 3 }}
                  >
                    <option value="auto">Auto</option>
                    <option value="3">3 Letters</option>
                    <option value="4">4 Letters</option>
                    <option value="5">5 Letters</option>
                    <option value="6">6 Letters</option>
                  </select>
                </label>

                <label style={{ fontSize: 11, fontWeight: 800, color: '#a5f3fc' }}>
                  Time Limit
                  <select
                    value={room.settings.timeLimitSeconds}
                    onChange={(e) =>
                      onUpdateSettings({ timeLimitSeconds: Number(e.target.value) })
                    }
                    className="ens-select-pill"
                    style={{ width: '100%', height: 36, marginTop: 3 }}
                  >
                    <option value={90}>1m 30s</option>
                    <option value={120}>2m 00s</option>
                    <option value={180}>3m 00s</option>
                    <option value={240}>4m 00s</option>
                    <option value={300}>5m 00s</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          {/* Players / Relay Teams */}
          {isRelay ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(['blue', 'red'] as const).map((tid) => {
                const list = tid === 'blue' ? blueTeam : redTeam;
                return (
                  <div
                    key={tid}
                    className="ci-card"
                    style={{
                      borderColor:
                        tid === 'blue' ? 'rgba(56, 189, 248, 0.6)' : 'rgba(244, 114, 182, 0.6)',
                    }}
                  >
                    <div className="ci-card-title" style={{ color: tid === 'blue' ? '#7dd3fc' : '#f9a8d4' }}>
                      <span>Team {tid === 'blue' ? 'Blue' : 'Red'}</span>
                      <span>{list.length}/2</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                      {list.map((p) => (
                        <div key={p.playerId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800 }}>
                          <AvatarBadge avatarId={p.avatarId} size={24} />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.username}
                          </span>
                          {(p.isHost || p.isReady) && <Check size={14} color="#4ade80" />}
                        </div>
                      ))}
                      {me?.teamId !== tid && list.length < 2 && (
                        <button
                          type="button"
                          onClick={() => onSwitchTeam(tid)}
                          className="ci-pill is-cyan"
                          style={{ justifyContent: 'center', cursor: 'pointer' }}
                        >
                          + Join {tid === 'blue' ? 'Blue' : 'Red'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="ci-card-title">
                <span>
                  Players ({room.players.length}/{room.settings.maxPlayers})
                </span>
                <Users size={14} />
              </div>
              {room.players.map((p) => (
                <div
                  key={p.playerId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 9px',
                    borderRadius: 12,
                    background: 'rgba(10, 20, 76, 0.72)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AvatarBadge avatarId={p.avatarId} size={30} />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span>
                          {p.username} {p.playerId === session.playerId ? '(You)' : ''}
                        </span>
                        {p.isHost && <Crown size={13} color="#fde047" fill="#fde047" />}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd' }}>
                        {p.rankTier}
                      </div>
                    </div>
                  </div>
                  <span className={`ci-pill ${p.isHost || p.isReady ? 'is-green' : 'is-amber'}`}>
                    {p.isHost ? 'HOST' : p.isReady ? 'READY' : 'WAITING'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Custom Puzzle Builder (Host only, non-Survival) */}
          {isHost && room.settings.mode !== 'survival' && (
            <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="ci-card-title">
                <span>Custom Room Puzzle (Optional)</span>
                <Sparkles size={14} color="#67e8f9" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input
                  type="text"
                  value={customStart}
                  onChange={(e) => {
                    setCustomStart(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6));
                    setValidationResult(null);
                  }}
                  placeholder="Start (e.g. COLD)"
                  className="ens-fantasy-input"
                  style={{ minHeight: 38, fontSize: 13.5, fontWeight: 900, letterSpacing: '0.1em' }}
                />
                <input
                  type="text"
                  value={customTarget}
                  onChange={(e) => {
                    setCustomTarget(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6));
                    setValidationResult(null);
                  }}
                  placeholder="Target (e.g. WARM)"
                  className="ens-fantasy-input"
                  style={{ minHeight: 38, fontSize: 13.5, fontWeight: 900, letterSpacing: '0.1em' }}
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button
                  type="button"
                  disabled={validating || customStart.length < 3 || customTarget.length < 3}
                  onClick={handleValidateCustom}
                  className="ci-pill is-cyan"
                  style={{ cursor: 'pointer', padding: '7px 11px' }}
                >
                  {validating ? 'Checking...' : 'Validate Puzzle'}
                </button>
                {validationResult?.valid && (
                  <>
                    <button
                      type="button"
                      onClick={handleApplyCustom}
                      className="ci-pill is-green"
                      style={{ cursor: 'pointer', padding: '7px 11px' }}
                    >
                      <CheckCircle2 size={13} />
                      <span>Use Custom ({validationResult.minMoves} min moves)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onSaveCustomPuzzleTemplate(
                          validationResult.startWord,
                          validationResult.targetWord
                        )
                      }
                      className="ci-pill is-violet"
                      style={{ cursor: 'pointer', padding: '7px 11px' }}
                    >
                      <BookmarkPlus size={13} />
                      <span>Save Template</span>
                    </button>
                  </>
                )}
                {room.customPuzzle && (
                  <button
                    type="button"
                    onClick={() => onSetCustomPuzzle({ clear: true })}
                    className="ci-pill is-amber"
                    style={{ cursor: 'pointer', padding: '7px 11px' }}
                  >
                    <Trash2 size={13} />
                    <span>Clear ({room.customPuzzle.startWord}→{room.customPuzzle.targetWord})</span>
                  </button>
                )}
              </div>

              {validationResult && !validationResult.valid && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#fda4af' }}>
                  <XCircle size={14} />
                  <span>{validationResult.error}</span>
                </div>
              )}

              {changeItTemplates.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {changeItTemplates.slice(0, 6).map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      className="ci-pill"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setCustomStart(tpl.words[0]);
                        setCustomTarget(tpl.words[1]);
                        setValidationResult(null);
                      }}
                    >
                      {tpl.words[0]} → {tpl.words[1]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isHost && room.customPuzzle && (
            <div className="ci-card" style={{ fontSize: 12.5, fontWeight: 800, color: '#6ee7b7' }}>
              Host selected a verified custom puzzle ({room.customPuzzle.wordLength} letters •{' '}
              {room.customPuzzle.minMoves} min moves).
            </div>
          )}

          {/* Room Chat */}
          <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div className="ci-card-title">
              <span>Lobby Chat</span>
            </div>
            <div style={{ maxHeight: 110, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {room.messages.length === 0 ? (
                <div style={{ fontSize: 11.5, color: '#93c5fd', fontWeight: 700 }}>
                  Say hi to players in the lobby!
                </div>
              ) : (
                room.messages.slice(-15).map((m) => (
                  <div key={m.id} style={{ fontSize: 12, fontWeight: 700 }}>
                    <strong style={{ color: '#67e8f9' }}>{m.senderName}: </strong>
                    <span style={{ color: '#f8fafc' }}>{m.text}</span>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleSendChat} style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value.slice(0, 160))}
                placeholder="Type a message..."
                className="ens-fantasy-input"
                style={{ flex: 1, minHeight: 36, fontSize: 12.5 }}
              />
              <button
                type="submit"
                className="ci-icon-btn"
                aria-label="Send chat"
              >
                <Send size={15} />
              </button>
            </form>
          </div>

          {/* Ready / Start CTA */}
          {isHost ? (
            <button
              type="button"
              disabled={!canStart || starting}
              className="ci-cta-green"
              onClick={async () => {
                setStarting(true);
                try {
                  await onStartMatch();
                } finally {
                  setStarting(false);
                }
              }}
            >
              <Play size={18} fill="currentColor" />
              <span>
                {starting
                  ? 'Starting Match...'
                  : canStart
                    ? 'Start ChangeIt Match'
                    : 'Waiting for Players to Ready Up'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onToggleReady(!me?.isReady)}
              className={me?.isReady ? 'ci-pill is-amber' : 'ci-cta-cyan'}
              style={{ width: '100%', minHeight: 44, justifyContent: 'center', cursor: 'pointer' }}
            >
              {me?.isReady ? 'Cancel Ready' : 'Ready Up!'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
