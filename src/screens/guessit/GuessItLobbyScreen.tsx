import React, { useState } from 'react';
import {
  Check,
  ChevronLeft,
  Copy,
  Crown,
  Film,
  Grid,
  Layers,
  ListChecks,
  Lock,
  Play,
  Send,
  Settings,
  Users,
} from 'lucide-react';
import { GUESSIT_CATEGORIES } from '../../../shared/guessit/catalog';
import {
  GuessItCategory,
  GuessItDifficulty,
  GuessItPuzzleFormat,
  GuessItRoom,
  GuessItRoomSettings,
  GuessItTeamId,
} from '../../../shared/guessit/types';
import { PlayerSession, Template } from '../../../shared/types';
import { AvatarBadge } from '../../components/Artwork';
import { GuessItCinemaFooterArt } from '../../games/guessit/GuessItMascot';
import { buildRoomShareUrl, copyTextToClipboard } from '../../services/shareLink';

interface GuessItLobbyScreenProps {
  room: GuessItRoom;
  session: PlayerSession;
  templates: Template[];
  onBack: () => void;
  onUpdateSettings: (partial: Partial<GuessItRoomSettings>) => Promise<void>;
  onToggleReady: (isReady: boolean) => Promise<void>;
  onSwitchTeam: (teamId: GuessItTeamId) => Promise<void>;
  onSubmitDuelChallenge: (payload: {
    source: 'custom_word' | 'my_templates' | 'curated_db';
    answer?: string;
    templateId?: string;
    category?: GuessItCategory;
    difficulty?: GuessItDifficulty;
    clue?: string;
  }) => Promise<void>;
  onSendChat: (text: string) => Promise<void>;
  onStartMatch: () => Promise<void>;
  onNotify: (msg: string) => void;
}

const MODE_TITLES: Record<GuessItRoomSettings['mode'], string> = {
  speed_rush: 'Speed Rush (1 vs 1)',
  word_duel: 'Word Duel (1 vs 1)',
  precision_clash: 'Precision Clash (1 vs 1)',
  survival_royale: 'Survival Royale (3–8)',
  team_relay: 'Team Relay (2 vs 2)',
};

export const GuessItLobbyScreen: React.FC<GuessItLobbyScreenProps> = ({
  room,
  session,
  templates,
  onBack,
  onUpdateSettings,
  onToggleReady,
  onSwitchTeam,
  onSubmitDuelChallenge,
  onSendChat,
  onStartMatch,
  onNotify,
}) => {
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [duelSource, setDuelSource] = useState<'custom_word' | 'my_templates' | 'curated_db'>(
    'custom_word'
  );
  const [customPhrase, setCustomPhrase] = useState('');
  const [customClue, setCustomClue] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? '');
  const [chatDraft, setChatDraft] = useState('');
  const [starting, setStarting] = useState(false);
  const [savingDuel, setSavingDuel] = useState(false);

  const isHost = room.hostId === session.playerId;
  const me = room.players.find((p) => p.playerId === session.playerId);
  const isTeamRelay = room.settings.mode === 'team_relay';
  const isWordDuel = room.settings.mode === 'word_duel';

  const blueTeam = room.players.filter((p) => p.teamId === 'blue');
  const redTeam = room.players.filter((p) => p.teamId === 'red');

  const handleCopyCode = () => {
    const shareUrl = buildRoomShareUrl('guessit', room.code);
    void copyTextToClipboard(shareUrl);
    onNotify(`Invite link copied! (${room.code})`);
  };

  const handleSaveChallenge = async () => {
    setSavingDuel(true);
    try {
      await onSubmitDuelChallenge({
        source: duelSource,
        answer: duelSource === 'custom_word' ? customPhrase : undefined,
        templateId: duelSource === 'my_templates' ? selectedTemplateId : undefined,
        category: room.settings.category,
        difficulty: room.settings.difficulty,
        clue: customClue.trim() || undefined,
      });
      onNotify('Secret Word Duel challenge locked in!');
    } finally {
      setSavingDuel(false);
    }
  };

  const canStart = (() => {
    if (!isHost) return false;
    if (isTeamRelay) {
      return blueTeam.length === 2 && redTeam.length === 2;
    }
    if (room.settings.mode === 'survival_royale') {
      if (room.players.length < 3) return false;
    } else if (room.players.length < 2) {
      return false;
    }
    if (isWordDuel && room.players.some((p) => !p.duelChallengeReady)) {
      return false;
    }
    return room.players.every((p) => p.isHost || p.isReady);
  })();

  return (
    <div className="ens-guessit-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <header className="ens-guessit-topbar">
        <button
          type="button"
          className="ens-guessit-circle-btn"
          onClick={onBack}
          aria-label="Leave Lobby"
        >
          <ChevronLeft size={22} strokeWidth={2.8} />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 900 }}>
            <Users size={16} color="#bae6fd" />
            <span>{MODE_TITLES[room.settings.mode]}</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#dbeafe' }}>Room Lobby</div>
        </div>

        <button
          type="button"
          className="ens-guessit-circle-btn"
          onClick={() => setShowAdvancedSettings((v) => !v)}
          aria-label="Toggle advanced settings"
        >
          <Settings size={18} />
        </button>
      </header>

      <div className="ens-guessit-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Room Code Box matching Screen 3 */}
        <div className="ens-guessit-code-box">
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#c7d2fe' }}>Room Invite Link</span>
          <div className="ens-guessit-code-row">
            <span className="ens-guessit-code-val">{room.code}</span>
            <button
              type="button"
              onClick={handleCopyCode}
              aria-label="Copy Invite Link"
              title="Copy Invite Link"
              style={{
                border: 'none',
                background: 'rgba(165, 180, 252, 0.2)',
                color: '#ffffff',
                borderRadius: 10,
                padding: '6px 8px',
                cursor: 'pointer',
              }}
            >
              <Copy size={16} />
            </button>
          </div>
        </div>

        {/* Team Blue vs Team Red Cards (Team Relay 2v2) OR Player Roster */}
        {isTeamRelay ? (
          <div className="ens-guessit-teams-grid">
            <div className="ens-guessit-team-card is-blue">
              <div className="ens-guessit-team-head">
                <span style={{ color: '#bae6fd' }}>Team Blue</span>
                <Crown size={14} color="#fde047" fill="#fde047" />
              </div>
              {blueTeam.map((p) => (
                <div key={p.playerId} className="ens-guessit-member-pill">
                  <AvatarBadge avatarId={p.avatarId} size={26} ringColor="#38bdf8" />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.username} {p.playerId === session.playerId ? '(You)' : ''}
                  </span>
                </div>
              ))}
              {blueTeam.length < 2 && me?.teamId !== 'blue' && (
                <button
                  type="button"
                  onClick={() => onSwitchTeam('blue')}
                  style={{
                    borderRadius: 10,
                    border: '1px dashed #7dd3fc',
                    background: 'rgba(56, 189, 248, 0.16)',
                    color: '#e0f2fe',
                    fontSize: 11.5,
                    fontWeight: 800,
                    padding: '6px',
                    cursor: 'pointer',
                  }}
                >
                  + Join Blue
                </button>
              )}
              {blueTeam.length === 0 && (
                <div style={{ fontSize: 11, color: '#bae6fd', fontWeight: 700 }}>Waiting for Blue...</div>
              )}
            </div>

            <div className="ens-guessit-team-card is-red">
              <div className="ens-guessit-team-head">
                <span style={{ color: '#fbcfe8' }}>Team Red</span>
                <span style={{ fontSize: 11, color: '#f9a8d4' }}>{redTeam.length}/2</span>
              </div>
              {redTeam.map((p) => (
                <div key={p.playerId} className="ens-guessit-member-pill">
                  <AvatarBadge avatarId={p.avatarId} size={26} ringColor="#f472b6" />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.username} {p.playerId === session.playerId ? '(You)' : ''}
                  </span>
                </div>
              ))}
              {redTeam.length < 2 && me?.teamId !== 'red' && (
                <button
                  type="button"
                  onClick={() => onSwitchTeam('red')}
                  style={{
                    borderRadius: 10,
                    border: '1px dashed #f472b6',
                    background: 'rgba(244, 114, 182, 0.16)',
                    color: '#fce7f3',
                    fontSize: 11.5,
                    fontWeight: 800,
                    padding: '6px',
                    cursor: 'pointer',
                  }}
                >
                  + Join Red
                </button>
              )}
              {redTeam.length < 2 && me?.teamId === 'red' && (
                <div style={{ fontSize: 11, color: '#fbcfe8', fontWeight: 700 }}>Need 1 more teammate</div>
              )}
            </div>
          </div>
        ) : (
          <div className="ens-guessit-glass-card">
            <div style={{ fontSize: 12.5, fontWeight: 900, color: '#c7d2fe', marginBottom: 6 }}>
              Players ({room.players.length}/{room.settings.capacity})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {room.players.map((p) => (
                <div
                  key={p.playerId}
                  className="ens-guessit-member-pill"
                  style={{ justifyContent: 'space-between', padding: '7px 10px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AvatarBadge avatarId={p.avatarId} size={30} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 900 }}>
                        {p.username} {p.isHost ? '👑' : ''}
                      </div>
                      {isWordDuel && (
                        <div style={{ fontSize: 10.5, color: p.duelChallengeReady ? '#6ee7b7' : '#fde047' }}>
                          {p.duelChallengeReady
                            ? `Challenge locked (${p.duelCategory || 'Movies'})`
                            : 'Preparing secret challenge...'}
                        </div>
                      )}
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '3px 9px',
                      borderRadius: 999,
                      background: p.isReady ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.12)',
                      color: p.isReady ? '#6ee7b7' : '#dbeafe',
                      fontSize: 11,
                      fontWeight: 900,
                    }}
                  >
                    {p.isReady ? 'Ready ✓' : 'Waiting'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Word Duel Secret Challenge Setup (Hidden from Opponent) */}
        {isWordDuel && (
          <div className="ens-guessit-glass-card" style={{ borderColor: '#f472b6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 900, color: '#fbcfe8', marginBottom: 8 }}>
              <Lock size={14} />
              <span>Your Secret Challenge (Hidden From Opponent)</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginBottom: 8 }}>
              {(
                [
                  { id: 'custom_word', label: 'Custom Word' },
                  { id: 'my_templates', label: 'My Templates' },
                  { id: 'curated_db', label: 'Category Pick' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDuelSource(opt.id)}
                  style={{
                    borderRadius: 10,
                    padding: '6px 4px',
                    border:
                      duelSource === opt.id
                        ? '1.5px solid #fde047'
                        : '1px solid rgba(165, 180, 252, 0.35)',
                    background:
                      duelSource === opt.id ? 'rgba(139, 92, 246, 0.7)' : 'rgba(12, 18, 72, 0.7)',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {duelSource === 'custom_word' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                <input
                  type="text"
                  maxLength={42}
                  value={customPhrase}
                  onChange={(e) => setCustomPhrase(e.target.value)}
                  placeholder="Enter hidden word or phrase (e.g. STAR WARS)"
                  style={{
                    borderRadius: 12,
                    border: '1.5px solid rgba(165, 180, 252, 0.45)',
                    background: 'rgba(10, 16, 66, 0.9)',
                    color: '#fff',
                    padding: '8px 10px',
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                />
                <input
                  type="text"
                  maxLength={80}
                  value={customClue}
                  onChange={(e) => setCustomClue(e.target.value)}
                  placeholder="Optional clue for opponent..."
                  style={{
                    borderRadius: 12,
                    border: '1px solid rgba(165, 180, 252, 0.35)',
                    background: 'rgba(10, 16, 66, 0.75)',
                    color: '#dbeafe',
                    padding: '7px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                />
              </div>
            )}

            {duelSource === 'my_templates' && (
              <div style={{ marginBottom: 8 }}>
                <select
                  aria-label="Select template"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  style={{
                    width: '100%',
                    borderRadius: 12,
                    border: '1.5px solid rgba(165, 180, 252, 0.45)',
                    background: 'rgba(10, 16, 66, 0.9)',
                    color: '#fff',
                    padding: '8px 10px',
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.words.length} words)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              disabled={savingDuel}
              onClick={handleSaveChallenge}
              style={{
                width: '100%',
                minHeight: 38,
                borderRadius: 12,
                border: '1.5px solid #d1fae5',
                background: 'linear-gradient(180deg, #34d399 0%, #059669 100%)',
                color: '#052e16',
                fontWeight: 900,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {savingDuel
                ? 'Validating...'
                : me?.duelChallengeReady
                  ? 'Update Locked Challenge ✓'
                  : 'Lock In Secret Challenge'}
            </button>
          </div>
        )}

        {/* Settings Card matching Screen 3 (Rounds, Category, Word Source + Advanced) */}
        <div className="ens-guessit-glass-card">
          <div className="ens-guessit-setting-row">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#dbeafe' }}>
              <ListChecks size={15} color="#7dd3fc" /> Rounds
            </span>
            {isHost ? (
              <select
                aria-label="Rounds"
                value={room.settings.roundsCount}
                onChange={(e) => onUpdateSettings({ roundsCount: Number(e.target.value) })}
                style={{
                  background: 'rgba(12, 18, 72, 0.85)',
                  color: '#fff',
                  border: '1px solid rgba(165, 180, 252, 0.5)',
                  borderRadius: 9,
                  padding: '4px 8px',
                  fontSize: 12.5,
                  fontWeight: 800,
                }}
              >
                <option value={1}>1 Round</option>
                <option value={3}>Best of 3</option>
                <option value={5}>Best of 5</option>
              </select>
            ) : (
              <span>{room.settings.roundsCount === 1 ? '1 Round' : `Best of ${room.settings.roundsCount}`}</span>
            )}
          </div>

          <div className="ens-guessit-setting-row">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#dbeafe' }}>
              <Film size={15} color="#c084fc" /> Category
            </span>
            {isHost ? (
              <select
                aria-label="Category"
                value={room.settings.category}
                onChange={(e) => onUpdateSettings({ category: e.target.value as GuessItCategory })}
                style={{
                  background: 'rgba(12, 18, 72, 0.85)',
                  color: '#fff',
                  border: '1px solid rgba(165, 180, 252, 0.5)',
                  borderRadius: 9,
                  padding: '4px 8px',
                  fontSize: 12.5,
                  fontWeight: 800,
                }}
              >
                {GUESSIT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <span>{room.settings.category}</span>
            )}
          </div>

          <div className="ens-guessit-setting-row">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#dbeafe' }}>
              <Grid size={15} color="#fde047" /> Format
            </span>
            {isHost && !isWordDuel ? (
              <select
                aria-label="Puzzle Format"
                value={room.settings.format}
                onChange={(e) =>
                  onUpdateSettings({ format: e.target.value as GuessItPuzzleFormat })
                }
                style={{
                  background: 'rgba(12, 18, 72, 0.85)',
                  color: '#fff',
                  border: '1px solid rgba(165, 180, 252, 0.5)',
                  borderRadius: 9,
                  padding: '4px 8px',
                  fontSize: 12.5,
                  fontWeight: 800,
                }}
              >
                <option value="classic">Classic Hangman</option>
                <option value="crossword">Crossword Grid</option>
              </select>
            ) : (
              <span>{room.settings.format === 'crossword' ? 'Crossword Grid' : 'Classic'}</span>
            )}
          </div>

          <div className="ens-guessit-setting-row">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#dbeafe' }}>
              <Layers size={15} color="#67e8f9" /> Word Source
            </span>
            <span>
              {room.settings.wordSource === 'my_templates'
                ? 'My Templates'
                : room.settings.wordSource === 'custom_word'
                  ? 'Player Challenges'
                  : 'Curated Database'}
            </span>
          </div>

          {showAdvancedSettings && (
            <>
              <div className="ens-guessit-setting-row">
                <span style={{ color: '#dbeafe' }}>Difficulty</span>
                {isHost ? (
                  <select
                    aria-label="Difficulty"
                    value={room.settings.difficulty}
                    onChange={(e) =>
                      onUpdateSettings({ difficulty: e.target.value as GuessItDifficulty })
                    }
                    style={{
                      background: 'rgba(12, 18, 72, 0.85)',
                      color: '#fff',
                      border: '1px solid rgba(165, 180, 252, 0.5)',
                      borderRadius: 9,
                      padding: '4px 8px',
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                ) : (
                  <span style={{ textTransform: 'capitalize' }}>{room.settings.difficulty}</span>
                )}
              </div>

              <div className="ens-guessit-setting-row">
                <span style={{ color: '#dbeafe' }}>Wrong-Guess Penalty</span>
                {isHost ? (
                  <select
                    aria-label="Penalty Duration"
                    value={room.settings.penaltyMs}
                    onChange={(e) => onUpdateSettings({ penaltyMs: Number(e.target.value) })}
                    style={{
                      background: 'rgba(12, 18, 72, 0.85)',
                      color: '#fff',
                      border: '1px solid rgba(165, 180, 252, 0.5)',
                      borderRadius: 9,
                      padding: '4px 8px',
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    <option value={1500}>1.5s</option>
                    <option value={2000}>2.0s (Default)</option>
                    <option value={2500}>2.5s</option>
                    <option value={3000}>3.0s</option>
                  </select>
                ) : (
                  <span>{(room.settings.penaltyMs / 1000).toFixed(1)}s</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {!isHost && (
            <button
              type="button"
              onClick={() => onToggleReady(!me?.isReady)}
              style={{
                flex: 1,
                minHeight: 50,
                borderRadius: 18,
                border: '1.8px solid #d1fae5',
                background: me?.isReady
                  ? 'linear-gradient(180deg, #34d399 0%, #059669 100%)'
                  : 'rgba(255, 255, 255, 0.16)',
                color: me?.isReady ? '#052e16' : '#ffffff',
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                fontWeight: 900,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Check size={17} />
              <span>{me?.isReady ? 'Ready ✓' : 'Mark Ready'}</span>
            </button>
          )}

          {isHost && (
            <button
              type="button"
              className="ens-guessit-gold-btn"
              disabled={!canStart || starting}
              onClick={async () => {
                setStarting(true);
                try {
                  await onStartMatch();
                } finally {
                  setStarting(false);
                }
              }}
            >
              <Play size={18} fill="#3f1d00" color="#3f1d00" />
              <span>{starting ? 'Starting...' : 'Start Match'}</span>
            </button>
          )}
        </div>

        {/* Compact Lobby Chat */}
        <div className="ens-guessit-glass-card" style={{ padding: 10 }}>
          <div style={{ maxHeight: 74, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
            {room.messages.length === 0 ? (
              <div style={{ fontSize: 11.5, color: '#a5b4fc', fontWeight: 700 }}>
                Room chat ready — share code {room.code} with friends!
              </div>
            ) : (
              room.messages.slice(-10).map((m) => (
                <div key={m.id} style={{ fontSize: 12, fontWeight: 700 }}>
                  <strong style={{ color: '#fde047' }}>{m.senderName}:</strong> {m.text}
                </div>
              ))
            )}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!chatDraft.trim()) return;
              const txt = chatDraft.trim();
              setChatDraft('');
              await onSendChat(txt);
            }}
            style={{ display: 'flex', gap: 6 }}
          >
            <input
              type="text"
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="Say hi..."
              style={{
                flex: 1,
                borderRadius: 10,
                border: '1px solid rgba(165, 180, 252, 0.45)',
                background: 'rgba(10, 16, 66, 0.85)',
                color: '#fff',
                padding: '6px 9px',
                fontSize: 12,
              }}
            />
            <button
              type="submit"
              aria-label="Send lobby message"
              style={{
                borderRadius: 10,
                border: 'none',
                background: '#6366f1',
                color: '#fff',
                padding: '0 12px',
                cursor: 'pointer',
              }}
            >
              <Send size={14} />
            </button>
          </form>
        </div>

        <GuessItCinemaFooterArt />
      </div>
    </div>
  );
};
