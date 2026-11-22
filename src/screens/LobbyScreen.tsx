import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Coffee,
  Copy,
  Crown,
  Eye,
  Gamepad2,
  Loader2,
  MessageSquare,
  Send,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import { Profile, Room, RoomRules, Template } from '../../shared/types';
import { api } from '../services/api';
import { AvatarBadge, TemplateThumb } from '../components/Artwork';

interface LobbyScreenProps {
  room: Room;
  currentProfile: Profile;
  templates: Template[];
  onBack: () => void;
  onLeave: () => void;
  onToggleReady: (nextReady: boolean) => Promise<void>;
  onSelectPuzzle: (payload: {
    templateId?: string | null;
    customWords?: string[] | null;
    puzzleStatus: 'none' | 'creating' | 'ready';
  }) => Promise<void>;
  onUpdateRules: (rules: Partial<RoomRules>) => Promise<void>;
  onSendChat: (text: string) => Promise<void>;
  onStartMatch: () => Promise<void>;
  onNotify: (msg: string) => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  room,
  currentProfile,
  templates,
  onBack,
  onLeave,
  onToggleReady,
  onSelectPuzzle,
  onUpdateRules,
  onSendChat,
  onStartMatch,
  onNotify,
}) => {
  const [chatText, setChatText] = useState('');
  const [showPuzzleModal, setShowPuzzleModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [customWords, setCustomWords] = useState<string[]>(['STAR', 'LIGHT', 'HOUSE', 'KEY']);
  const [puzzleTab, setPuzzleTab] = useState<'saved' | 'custom'>('saved');
  const [starting, setStarting] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);

  const me = room.players.find((p) => p.playerId === currentProfile.id);
  const isHost = room.hostId === currentProfile.id;

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [room.messages.length]);

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(room.code).catch(() => undefined);
    onNotify(`Room code ${room.code} copied!`);
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    const text = chatText;
    setChatText('');
    await onSendChat(text);
  };

  const openPuzzleSelector = async () => {
    setShowPuzzleModal(true);
    if (me && me.puzzleStatus === 'none') {
      await onSelectPuzzle({ puzzleStatus: 'creating' }).catch(() => undefined);
    }
  };

  const handlePickTemplate = async (tpl: Template) => {
    await onSelectPuzzle({ templateId: tpl.id, customWords: null, puzzleStatus: 'ready' });
    setShowPuzzleModal(false);
    onNotify(`Prepared "${tpl.name}" for an opponent`);
  };

  const handleSubmitCustomWords = async () => {
    const cleaned = customWords.map((w) => w.trim().toUpperCase()).filter(Boolean);
    await onSelectPuzzle({ templateId: null, customWords: cleaned, puzzleStatus: 'ready' });
    setShowPuzzleModal(false);
    onNotify(`Custom ${cleaned.length}-word chain locked in!`);
  };

  const handleForceStart = async () => {
    setStarting(true);
    try {
      await onStartMatch();
    } finally {
      setStarting(false);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const playableTemplates = templates.filter((t) => t.words.length >= 3);

  return (
    <div className="ens-sheet-screen">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      {/* Top Royal Header */}
      <header className="ens-royal-topbar">
        <img src="/art/header-fantasy.png" alt="" className="ens-royal-topbar-art" aria-hidden="true" />
        <button type="button" className="ens-icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeft size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 18, fontWeight: 900, fontStyle: 'italic' }}>
          <Users size={19} />
          <span>{room.name}</span>
        </div>

        <button type="button" className="ens-leave-btn" onClick={onLeave}>
          Leave
        </button>
      </header>

      {/* Host + Share Code Subbar */}
      <div className="ens-lobby-subbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AvatarBadge avatarId={room.hostAvatar} size={32} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 800 }}>
            <Crown size={15} fill="#ffd34e" color="#ffd34e" />
            <span>Host: {room.hostName}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#c7d5ff' }}>Share Code</span>
          <button type="button" className="ens-share-pill" onClick={handleCopyCode}>
            <span>{room.code}</span>
            <Copy size={13} />
          </button>
        </div>
      </div>

      {/* Lavender Sheet Body */}
      <div className="ens-sheet-body">
        {/* Players List */}
        <section>
          <div className="ens-section-heading">
            <Users size={16} color="#a5f3fc" />
            <span>
              Players ({room.players.length} / {room.rules.maxPlayers})
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {room.players.map((p) => (
              <div key={p.playerId} className="ens-player-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <AvatarBadge avatarId={p.avatarId} size={36} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14.5, fontWeight: 800, color: '#ffffff' }}>
                      <span>{p.username}</span>
                      {p.isHost && <span style={{ fontSize: 12, fontWeight: 700, color: '#ffd54a' }}>(Host) 👑</span>}
                    </div>
                    {p.submittedTemplateName && (
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#c4b5fd' }}>
                        Puzzle: {p.submittedTemplateName}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  {p.puzzleStatus === 'creating' ? (
                    <span className="ens-pill-creating">
                      <Loader2 size={12} />
                      <span>Creating Puzzle...</span>
                    </span>
                  ) : p.isReady ? (
                    <span className="ens-pill-ready">
                      <span>Ready</span>
                      <Check size={13} strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="ens-pill-not-ready">
                      <span>Not Ready</span>
                      <Circle size={12} />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Rules Summary */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div className="ens-section-heading" style={{ marginBottom: 0 }}>
              <Settings size={16} color="#f0abfc" />
              <span>Rules</span>
            </div>
            {isHost && (
              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                className="ens-draft-link-btn"
              >
                Edit Rules
              </button>
            )}
          </div>
          <div className="ens-rule-chips" onClick={() => isHost && setShowRulesModal(true)}>
            <span className="ens-rule-chip">
              <Gamepad2 size={14} color="#c4b5fd" />
              {room.rules.mode === 'speed_race' ? 'Speed Race' : 'Classic Mode'}
            </span>
            <span className="ens-rule-chip">
              <Clock size={14} color="#fda4af" />
              {room.rules.timerEnabled ? `${room.rules.timePerWordSeconds}s per word` : 'No Timer'}
            </span>
            <span className="ens-rule-chip">
              <Eye size={14} color="#7dd3fc" />
              {room.rules.chainVisibility === 'full_chain' ? 'Full Chain Visible' : 'Progressive Clues'}
            </span>
            <span className="ens-rule-chip">
              <Users size={14} color="#a5b4fc" />
              {room.rules.maxPlayers} Players
            </span>
            <span className="ens-rule-chip">
              <Coffee size={14} color="#f0abfc" />
              {room.rules.difficultyPreset === 'competitive' ? 'Competitive' : 'Casual'}
            </span>
          </div>
        </section>

        {/* Puzzle Source */}
        <section>
          <div className="ens-section-heading">
            <BookOpen size={16} color="#a5f3fc" />
            <span>Puzzle Source</span>
          </div>
          <div
            className="ens-white-card"
            onClick={openPuzzleSelector}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.35) 0%, rgba(99, 102, 241, 0.4) 100%)',
                  border: '1px solid rgba(206, 188, 255, 0.5)',
                  color: '#f5d8ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BookOpen size={19} />
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#ffffff' }}>
                  {room.rules.puzzleSource === 'curated_db'
                    ? 'Curated Database Chains'
                    : room.rules.puzzleSource === 'custom_create'
                      ? 'Create Custom Chains'
                      : 'Use Saved Templates'}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#cdd6ff' }}>
                  {me?.submittedTemplateName
                    ? `Selected: ${me.submittedTemplateName}`
                    : 'Pick from your template library'}
                </div>
              </div>
            </div>
            <ChevronRight size={18} color="#cdd6ff" />
          </div>
        </section>

        {/* Room Chat */}
        <section>
          <div className="ens-section-heading">
            <MessageSquare size={16} color="#f0abfc" />
            <span>Room Chat</span>
          </div>
          <div className="ens-white-card" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div ref={chatBoxRef} style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {room.messages.length === 0 ? (
                <div style={{ fontSize: 12.5, color: '#cdd6ff', textAlign: 'center', padding: 10, fontWeight: 600 }}>
                  No messages yet. Say hello or coordinate rules!
                </div>
              ) : (
                room.messages.map((m) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <AvatarBadge avatarId={m.senderAvatar} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#ffffff' }}>
                          {m.senderName}
                        </span>
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: '#aeb9f0' }}>
                          {formatTime(m.createdAt)}
                        </span>
                      </div>
                      <div className="ens-chat-msg-bubble">
                        {m.text}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendChat} style={{ display: 'flex', gap: 7, marginTop: 2 }}>
              <input
                type="text"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Message room..."
                className="ens-chat-input"
              />
              <button
                type="submit"
                style={{
                  border: '1.5px solid rgba(226, 204, 255, 0.72)',
                  borderRadius: 12,
                  padding: '0 13px',
                  background: 'var(--ens-grad-btn-purple)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Send chat message"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </section>
      </div>

      {/* Bottom 3 Action Buttons */}
      <footer className="ens-lobby-footer">
        <button
          type="button"
          className="ens-btn-green"
          onClick={() => onToggleReady(!(me?.isReady ?? false))}
        >
          <Check size={16} strokeWidth={3} />
          <span>{me?.isReady ? 'Ready' : 'Not Ready'}</span>
        </button>

        <button type="button" className="ens-btn-white" onClick={openPuzzleSelector}>
          <BookOpen size={15} color="#5b3df5" />
          <span>Select Template</span>
        </button>

        <button
          type="button"
          className="ens-btn-purple"
          disabled={!isHost || starting}
          onClick={handleForceStart}
          title={isHost ? 'Start match immediately' : 'Only the host can start the match'}
        >
          <Crown size={15} fill="#ffd34e" color="#ffd34e" />
          <span>{starting ? 'Starting...' : isHost ? 'Force Start (Host)' : 'Wait for Host'}</span>
        </button>
      </footer>

      {/* Puzzle Selection / Creation Modal */}
      {showPuzzleModal && (
        <div className="ens-modal-backdrop" onClick={() => setShowPuzzleModal(false)}>
          <div className="ens-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 17.5, fontWeight: 900, color: '#ffffff' }}>Prepare Puzzle for Opponent</h3>
              <button
                type="button"
                onClick={() => setShowPuzzleModal(false)}
                className="ens-btn-white"
                style={{ minHeight: 32, padding: '4px 12px', fontSize: 12 }}
              >
                Close
              </button>
            </div>
            <p style={{ margin: '0 0 11px', fontSize: 12.5, color: '#d4dcff', fontWeight: 600 }}>
              In custom multiplayer, your chosen puzzle is assigned to another player — you will never solve your own puzzle!
            </p>

            <div className="ens-segmented-tabs" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 11 }}>
              <button
                type="button"
                className={`ens-seg-tab ${puzzleTab === 'saved' ? 'active' : ''}`}
                onClick={() => setPuzzleTab('saved')}
              >
                Saved Templates
              </button>
              <button
                type="button"
                className={`ens-seg-tab ${puzzleTab === 'custom' ? 'active' : ''}`}
                onClick={() => setPuzzleTab('custom')}
              >
                Write Custom Chain
              </button>
            </div>

            {puzzleTab === 'saved' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                {playableTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className={`ens-tpl-card ${me?.submittedTemplateId === tpl.id ? 'selected' : ''}`}
                    onClick={() => handlePickTemplate(tpl)}
                  >
                    <TemplateThumb thumbnailKey={tpl.thumbnailKey} size={46} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>{tpl.name}</div>
                      <div style={{ fontSize: 11.5, color: '#cdd6ff', fontWeight: 600 }}>
                        {tpl.words.length} words • {tpl.theme}
                      </div>
                    </div>
                    <span className="ens-pill-ready">Use</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {customWords.map((w, idx) => (
                  <div key={idx} className="ens-word-input-row">
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#cdd6ff' }}>Word {idx + 1}</span>
                    <input
                      className="ens-word-input"
                      value={w}
                      onChange={(e) => {
                        const copy = [...customWords];
                        copy[idx] = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
                        setCustomWords(copy);
                      }}
                    />
                    {customWords.length > 3 && (
                      <button
                        type="button"
                        className="ens-delete-word-btn"
                        onClick={() => setCustomWords(customWords.filter((_, i) => i !== idx))}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="ens-btn-white"
                    onClick={() => setCustomWords([...customWords, ''])}
                  >
                    + Add Word
                  </button>
                  <button
                    type="button"
                    className="ens-btn-white"
                    onClick={async () => {
                      const gen = await api.generateChain('Adventure', Math.max(4, customWords.length));
                      setCustomWords(gen.words);
                    }}
                  >
                    <Sparkles size={14} color="#5b3df5" />
                    <span>Generate</span>
                  </button>
                  <button
                    type="button"
                    className="ens-btn-purple"
                    style={{ flex: 1 }}
                    onClick={handleSubmitCustomWords}
                  >
                    Lock In Custom Chain
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Host Rules Config Modal */}
      {showRulesModal && isHost && (
        <div className="ens-modal-backdrop" onClick={() => setShowRulesModal(false)}>
          <div className="ens-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 900, color: '#ffffff' }}>Host Room Rules</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: 13, fontWeight: 800, color: '#ffffff' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span>Game Mode</span>
                <div className="ens-select-pill-wrap">
                  <select
                    value={room.rules.mode}
                    onChange={(e) => onUpdateRules({ mode: e.target.value as 'classic' | 'speed_race' })}
                    className="ens-select-pill"
                  >
                    <option value="classic">Classic Mode (Turn-Based)</option>
                    <option value="speed_race">Speed Race (Simultaneous)</option>
                  </select>
                  <ChevronDown size={14} className="ens-select-chevron" aria-hidden="true" />
                </div>
              </label>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span>Puzzle Source</span>
                <div className="ens-select-pill-wrap">
                  <select
                    value={room.rules.puzzleSource}
                    onChange={(e) => onUpdateRules({ puzzleSource: e.target.value as any })}
                    className="ens-select-pill"
                  >
                    <option value="saved_templates">Use Saved / Custom Templates</option>
                    <option value="curated_db">Curated Database Puzzles</option>
                  </select>
                  <ChevronDown size={14} className="ens-select-chevron" aria-hidden="true" />
                </div>
              </label>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span>Max Players</span>
                <div className="ens-select-pill-wrap">
                  <select
                    value={room.rules.maxPlayers}
                    onChange={(e) => onUpdateRules({ maxPlayers: Number(e.target.value) })}
                    className="ens-select-pill"
                  >
                    {[2, 3, 4, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} Players
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="ens-select-chevron" aria-hidden="true" />
                </div>
              </label>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span>Timer Enabled</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={room.rules.timerEnabled}
                  className={`ens-glossy-switch ${room.rules.timerEnabled ? 'is-on' : 'is-off'}`}
                  onClick={() => onUpdateRules({ timerEnabled: !room.rules.timerEnabled })}
                >
                  <span className="ens-switch-thumb" />
                </button>
              </label>

              {room.rules.timerEnabled && (
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span>Seconds Per Word</span>
                  <div className="ens-select-pill-wrap">
                    <select
                      value={room.rules.timePerWordSeconds}
                      onChange={(e) => onUpdateRules({ timePerWordSeconds: Number(e.target.value) })}
                      className="ens-select-pill"
                    >
                      {[10, 15, 20, 30, 45, 60].map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}s
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="ens-select-chevron" aria-hidden="true" />
                  </div>
                </label>
              )}

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span>Clue Visibility</span>
                <div className="ens-select-pill-wrap">
                  <select
                    value={room.rules.chainVisibility}
                    onChange={(e) => onUpdateRules({ chainVisibility: e.target.value as any })}
                    className="ens-select-pill"
                  >
                    <option value="full_chain">Full Chain Visible</option>
                    <option value="progressive">Progressive Clues</option>
                  </select>
                  <ChevronDown size={14} className="ens-select-chevron" aria-hidden="true" />
                </div>
              </label>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span>Opponent Board Visibility</span>
                <div className="ens-select-pill-wrap">
                  <select
                    value={room.rules.opponentVisibility}
                    onChange={(e) => onUpdateRules({ opponentVisibility: e.target.value as any })}
                    className="ens-select-pill"
                  >
                    <option value="full_live">Full Live Progress</option>
                    <option value="words_only">Completed &amp; Clues Only</option>
                    <option value="minimal">Minimal (Masked)</option>
                  </select>
                  <ChevronDown size={14} className="ens-select-chevron" aria-hidden="true" />
                </div>
              </label>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span>Auto-Reveal After Wrong Guesses</span>
                <div className="ens-select-pill-wrap">
                  <select
                    value={room.rules.autoRevealAfterAttempts}
                    onChange={(e) => onUpdateRules({ autoRevealAfterAttempts: Number(e.target.value) })}
                    className="ens-select-pill"
                  >
                    <option value={0}>Off</option>
                    <option value={2}>Every 2 wrong</option>
                    <option value={3}>Every 3 wrong</option>
                    <option value={5}>Every 5 wrong</option>
                  </select>
                  <ChevronDown size={14} className="ens-select-chevron" aria-hidden="true" />
                </div>
              </label>
            </div>

            <button
              type="button"
              className="ens-btn-purple"
              style={{ width: '100%', marginTop: 14 }}
              onClick={() => setShowRulesModal(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
