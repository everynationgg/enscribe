import React, { useState } from 'react';
import {
  ChevronLeft,
  Grid,
  Plus,
  RefreshCw,
  Swords,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import {
  GuessItCategory,
  GuessItMultiplayerMode,
  GuessItPuzzleFormat,
  GuessItRoom,
  GuessItRoomSettings,
} from '../../../shared/guessit/types';
import { GUESSIT_CATEGORIES } from '../../../shared/guessit/catalog';

interface GuessItModeSelectScreenProps {
  publicRooms: GuessItRoom[];
  rankedSearchingKey: string | null;
  initialPathway?: 'rooms' | 'ranked';
  isOffline: boolean;
  onBack: () => void;
  onRefreshRooms: () => void;
  onCreateRoom: (settings: Partial<GuessItRoomSettings>) => Promise<void>;
  onJoinRoomByCode: (codeOrId: string) => Promise<void>;
  onJoinRanked: (
    mode: 'speed_rush' | 'precision_clash',
    format: GuessItPuzzleFormat
  ) => Promise<void>;
  onLeaveRanked: () => Promise<void>;
}

const CROSSWORD_COMPATIBLE_MODES: Array<{
  mode: GuessItMultiplayerMode;
  title: string;
  desc: string;
  players: string;
}> = [
  {
    mode: 'speed_rush',
    title: 'Crossword Speed Rush',
    desc: 'Same grid. First player to reveal every word wins!',
    players: '1 vs 1',
  },
  {
    mode: 'precision_clash',
    title: 'Crossword Precision Clash',
    desc: 'Highest accuracy across shared crossword intersections wins.',
    players: '1 vs 1',
  },
  {
    mode: 'team_relay',
    title: 'Crossword Team Relay',
    desc: '2v2 alternating teammate guesses across one shared grid!',
    players: '2 vs 2',
  },
  {
    mode: 'survival_royale',
    title: 'Crossword Survival',
    desc: 'Survive escalating crossword waves without running out of tries.',
    players: '3 - 8',
  },
];

export const GuessItModeSelectScreen: React.FC<GuessItModeSelectScreenProps> = ({
  publicRooms,
  rankedSearchingKey,
  initialPathway = 'rooms',
  isOffline,
  onBack,
  onRefreshRooms,
  onCreateRoom,
  onJoinRoomByCode,
  onJoinRanked,
  onLeaveRanked,
}) => {
  const [pathway, setPathway] = useState<'rooms' | 'ranked'>(initialPathway);
  const [showCrosswordPicker, setShowCrosswordPicker] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<GuessItCategory>('Movies');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const launchModeRoom = async (
    key: string,
    mode: GuessItMultiplayerMode,
    format: GuessItPuzzleFormat
  ) => {
    if (busyKey || isOffline) return;
    setBusyKey(key);
    try {
      await onCreateRoom({
        mode,
        format,
        category: selectedCategory,
        isPublic: true,
      });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="ens-guessit-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <header className="ens-guessit-topbar">
        <button
          type="button"
          className="ens-guessit-circle-btn"
          onClick={onBack}
          aria-label="Back to GuessIt Entry"
        >
          <ChevronLeft size={22} strokeWidth={2.8} />
        </button>

        <div className="ens-guessit-screen-title-wordmark">GuessIt</div>

        <button
          type="button"
          className="ens-guessit-circle-btn"
          onClick={() => setShowJoinModal(true)}
          aria-label="Join room by code"
          title="Join room by code"
        >
          <Plus size={20} strokeWidth={2.8} />
        </button>
      </header>

      <div className="ens-guessit-scroll">
        <div className="ens-guessit-subhead">Choose a Multiplayer Mode</div>

        {/* Enscribe Multiplayer Entry Structure: Rooms vs Ranked (No Quick Match) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 10,
            background: 'rgba(14, 21, 82, 0.72)',
            padding: 4,
            borderRadius: 14,
            border: '1px solid rgba(165, 180, 252, 0.4)',
          }}
          role="tablist"
          aria-label="Multiplayer entry pathway"
        >
          <button
            type="button"
            role="tab"
            aria-selected={pathway === 'rooms'}
            onClick={() => setPathway('rooms')}
            style={{
              minHeight: 34,
              borderRadius: 10,
              border: 'none',
              background:
                pathway === 'rooms'
                  ? 'linear-gradient(180deg, #8b5cf6 0%, #5b21b6 100%)'
                  : 'transparent',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Rooms
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pathway === 'ranked'}
            onClick={() => setPathway('ranked')}
            style={{
              minHeight: 34,
              borderRadius: 10,
              border: 'none',
              background:
                pathway === 'ranked'
                  ? 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)'
                  : 'transparent',
              color: pathway === 'ranked' ? '#3f1d00' : '#ffffff',
              fontWeight: 900,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Ranked
          </button>
        </div>

        {pathway === 'ranked' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="ens-guessit-glass-card" style={{ fontSize: 12, color: '#dbeafe', fontWeight: 700 }}>
              Ranked matches use strictly curated, developer-approved words and identical fair puzzles.
            </div>

            {rankedSearchingKey && (
              <div
                className="ens-guessit-glass-card"
                style={{
                  borderColor: '#fde047',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 900, color: '#fef08a' }}>
                  Searching Ranked ({rankedSearchingKey.replace(':', ' • ')})...
                </span>
                <button
                  type="button"
                  onClick={() => onLeaveRanked()}
                  style={{
                    borderRadius: 10,
                    padding: '5px 10px',
                    border: '1px solid #fecdd3',
                    background: '#e11d48',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            <button
              type="button"
              className="ens-guessit-mode-card is-speed"
              disabled={isOffline}
              onClick={() => onJoinRanked('speed_rush', 'classic')}
            >
              <div className="ens-guessit-mode-badge-icon">
                <Zap size={22} color="#fde047" fill="#fde047" />
              </div>
              <div className="ens-guessit-mode-info">
                <div className="ens-guessit-mode-title">Ranked Speed Rush</div>
                <div className="ens-guessit-mode-desc">
                  Best-of-3 approved phrases. First to solve takes the round!
                </div>
              </div>
              <span className="ens-guessit-cap-pill">
                <Users size={11} /> 1 vs 1
              </span>
            </button>

            <button
              type="button"
              className="ens-guessit-mode-card is-precision"
              disabled={isOffline}
              onClick={() => onJoinRanked('precision_clash', 'classic')}
            >
              <div className="ens-guessit-mode-badge-icon">
                <Target size={22} color="#fb7185" />
              </div>
              <div className="ens-guessit-mode-info">
                <div className="ens-guessit-mode-title">Ranked Precision Clash</div>
                <div className="ens-guessit-mode-desc">
                  Equivalent approved puzzles. Highest accuracy + speed wins!
                </div>
              </div>
              <span className="ens-guessit-cap-pill">
                <Users size={11} /> 1 vs 1
              </span>
            </button>

            <button
              type="button"
              className="ens-guessit-mode-card is-crossword"
              disabled={isOffline}
              onClick={() => onJoinRanked('speed_rush', 'crossword')}
            >
              <div className="ens-guessit-mode-badge-icon">
                <Grid size={22} color="#c084fc" />
              </div>
              <div className="ens-guessit-mode-info">
                <div className="ens-guessit-mode-title">Ranked Crossword Rush</div>
                <div className="ens-guessit-mode-desc">
                  Identical curated crossword grid. One guess reveals every match!
                </div>
              </div>
              <span className="ens-guessit-cap-pill">
                <Users size={11} /> 1 vs 1
              </span>
            </button>
          </div>
        ) : (
          <>
            {/* 6 Mode Cards matching Reference Screen 2 */}
            <div className="ens-guessit-mode-cards">
              <button
                type="button"
                className="ens-guessit-mode-card is-speed"
                disabled={busyKey !== null || isOffline}
                onClick={() => launchModeRoom('speed', 'speed_rush', 'classic')}
              >
                <div className="ens-guessit-mode-badge-icon">
                  <Zap size={22} color="#fde047" fill="#fde047" />
                </div>
                <div className="ens-guessit-mode-info">
                  <div className="ens-guessit-mode-title">
                    Speed Rush <span style={{ color: '#bae6fd', fontSize: 13 }}>1v1</span>
                  </div>
                  <div className="ens-guessit-mode-desc">
                    Same word. First to solve wins!
                  </div>
                </div>
                <span className="ens-guessit-cap-pill">
                  <Users size={11} /> 1 vs 1
                </span>
              </button>

              <button
                type="button"
                className="ens-guessit-mode-card is-duel"
                disabled={busyKey !== null || isOffline}
                onClick={() => launchModeRoom('duel', 'word_duel', 'classic')}
              >
                <div className="ens-guessit-mode-badge-icon">
                  <Swords size={22} color="#a5f3fc" />
                </div>
                <div className="ens-guessit-mode-info">
                  <div className="ens-guessit-mode-title">
                    Word Duel <span style={{ color: '#bae6fd', fontSize: 13 }}>1v1</span>
                  </div>
                  <div className="ens-guessit-mode-desc">
                    Use your own word or template and challenge your opponent!
                  </div>
                </div>
                <span className="ens-guessit-cap-pill">
                  <Users size={11} /> 1 vs 1
                </span>
              </button>

              <button
                type="button"
                className="ens-guessit-mode-card is-precision"
                disabled={busyKey !== null || isOffline}
                onClick={() => launchModeRoom('precision', 'precision_clash', 'classic')}
              >
                <div className="ens-guessit-mode-badge-icon">
                  <Target size={22} color="#fb7185" />
                </div>
                <div className="ens-guessit-mode-info">
                  <div className="ens-guessit-mode-title">
                    Precision Clash <span style={{ color: '#bae6fd', fontSize: 13 }}>1v1</span>
                  </div>
                  <div className="ens-guessit-mode-desc">
                    Solve within the time limit. Highest accuracy wins!
                  </div>
                </div>
                <span className="ens-guessit-cap-pill">
                  <Users size={11} /> 1 vs 1
                </span>
              </button>

              <button
                type="button"
                className="ens-guessit-mode-card is-royale"
                disabled={busyKey !== null || isOffline}
                onClick={() => launchModeRoom('royale', 'survival_royale', 'classic')}
              >
                <div className="ens-guessit-mode-badge-icon">
                  <Trophy size={22} color="#facc15" />
                </div>
                <div className="ens-guessit-mode-info">
                  <div className="ens-guessit-mode-title">Survival Royale</div>
                  <div className="ens-guessit-mode-desc">
                    Multiple players. Last player standing wins!
                  </div>
                </div>
                <span className="ens-guessit-cap-pill">
                  <Users size={11} /> 3 - 8
                </span>
              </button>

              <button
                type="button"
                className="ens-guessit-mode-card is-relay"
                disabled={busyKey !== null || isOffline}
                onClick={() => launchModeRoom('relay', 'team_relay', 'classic')}
              >
                <div className="ens-guessit-mode-badge-icon">
                  <Users size={22} color="#7dd3fc" />
                </div>
                <div className="ens-guessit-mode-info">
                  <div className="ens-guessit-mode-title">Team Relay</div>
                  <div className="ens-guessit-mode-desc">
                    Work together! Alternate guesses to solve the word!
                  </div>
                </div>
                <span className="ens-guessit-cap-pill">
                  <Users size={11} /> 2 vs 2
                </span>
              </button>

              <button
                type="button"
                className="ens-guessit-mode-card is-crossword"
                disabled={busyKey !== null || isOffline}
                onClick={() => setShowCrosswordPicker(true)}
              >
                <div className="ens-guessit-mode-badge-icon">
                  <Grid size={22} color="#d8b4fe" />
                </div>
                <div className="ens-guessit-mode-info">
                  <div className="ens-guessit-mode-title">Crossword GuessIt</div>
                  <div className="ens-guessit-mode-desc">
                    A crossword-style Hangman! Guess letters for the whole grid!
                  </div>
                </div>
                <span className="ens-guessit-cap-pill">
                  <Users size={11} /> 1 - 4
                </span>
              </button>
            </div>

            {/* Category + Join-by-Code + Open Public Rooms */}
            <div className="ens-guessit-glass-card" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#fef08a' }}>
                  Open Rooms ({publicRooms.length})
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <select
                    aria-label="Room Category"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as GuessItCategory)}
                    style={{
                      background: 'rgba(14, 21, 82, 0.9)',
                      color: '#fff',
                      border: '1px solid rgba(165, 180, 252, 0.5)',
                      borderRadius: 10,
                      padding: '4px 8px',
                      fontSize: 11.5,
                      fontWeight: 800,
                    }}
                  >
                    {GUESSIT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={onRefreshRooms}
                    aria-label="Refresh public rooms"
                    className="ens-guessit-circle-btn"
                    style={{ width: 30, height: 30 }}
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  type="text"
                  maxLength={10}
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="Enter Room Code (e.g. H7K4P)"
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    border: '1.5px solid rgba(165, 180, 252, 0.45)',
                    background: 'rgba(10, 16, 66, 0.85)',
                    color: '#fff',
                    padding: '8px 10px',
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                  }}
                />
                <button
                  type="button"
                  disabled={!codeInput.trim() || isOffline}
                  onClick={() => onJoinRoomByCode(codeInput.trim())}
                  style={{
                    borderRadius: 12,
                    border: '1.5px solid #fffbeb',
                    background: 'linear-gradient(180deg, #ffe266 0%, #f59e0b 100%)',
                    color: '#3f1d00',
                    fontWeight: 900,
                    fontSize: 13,
                    padding: '0 14px',
                    cursor: 'pointer',
                  }}
                >
                  Join
                </button>
              </div>

              {publicRooms.length === 0 ? (
                <div style={{ fontSize: 12, color: '#c7d2fe', fontWeight: 700, textAlign: 'center', padding: '6px 0' }}>
                  No public GuessIt rooms open — tap any mode above to create one!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {publicRooms.map((rm) => (
                    <div
                      key={rm.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 12,
                        background: 'rgba(14, 21, 82, 0.78)',
                        border: '1px solid rgba(165, 180, 252, 0.35)',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 900 }}>{rm.name}</div>
                        <div style={{ fontSize: 11, color: '#bae6fd', fontWeight: 700 }}>
                          {rm.code} • {rm.settings.mode.replace('_', ' ')} ({rm.settings.format}) •{' '}
                          {rm.players.length}/{rm.settings.capacity}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onJoinRoomByCode(rm.id)}
                        style={{
                          borderRadius: 10,
                          border: 'none',
                          background: '#22c55e',
                          color: '#fff',
                          fontWeight: 900,
                          fontSize: 12,
                          padding: '6px 12px',
                          cursor: 'pointer',
                        }}
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Crossword-Compatible Mode Picker Sheet */}
      {showCrosswordPicker && (
        <div
          className="ens-modal-backdrop"
          style={{ alignItems: 'center' }}
          onClick={() => setShowCrosswordPicker(false)}
        >
          <div
            className="ens-guessit-glass-card"
            style={{ width: '92%', maxWidth: 370 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 17, fontWeight: 900 }}>Crossword GuessIt Mode</div>
              <button
                type="button"
                onClick={() => setShowCrosswordPicker(false)}
                style={{
                  border: 'none',
                  background: 'rgba(255,255,255,0.16)',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '4px 10px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#dbeafe', fontWeight: 700, marginBottom: 10 }}>
              Choose a Crossword-compatible multiplayer ruleset:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {CROSSWORD_COMPATIBLE_MODES.map((cm) => (
                <button
                  key={cm.mode}
                  type="button"
                  className="ens-guessit-mode-card is-crossword"
                  onClick={() => {
                    setShowCrosswordPicker(false);
                    launchModeRoom(`cw_${cm.mode}`, cm.mode, 'crossword');
                  }}
                >
                  <div className="ens-guessit-mode-info">
                    <div className="ens-guessit-mode-title">{cm.title}</div>
                    <div className="ens-guessit-mode-desc">{cm.desc}</div>
                  </div>
                  <span className="ens-guessit-cap-pill">{cm.players}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Join Code Modal on "+" */}
      {showJoinModal && (
        <div
          className="ens-modal-backdrop"
          style={{ alignItems: 'center' }}
          onClick={() => setShowJoinModal(false)}
        >
          <div
            className="ens-guessit-glass-card"
            style={{ width: '90%', maxWidth: 350 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 6 }}>Join Room by Code</div>
            <input
              type="text"
              maxLength={10}
              autoFocus
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. H7K4P"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: 12,
                border: '1.5px solid rgba(165, 180, 252, 0.55)',
                background: 'rgba(10, 16, 66, 0.9)',
                color: '#fff',
                padding: '10px 12px',
                fontSize: 16,
                fontWeight: 900,
                letterSpacing: '0.12em',
                marginBottom: 10,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="ens-guessit-gold-btn"
                style={{ minHeight: 42, fontSize: 15 }}
                disabled={!codeInput.trim()}
                onClick={async () => {
                  const code = codeInput.trim();
                  setShowJoinModal(false);
                  if (code) await onJoinRoomByCode(code);
                }}
              >
                Join Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
