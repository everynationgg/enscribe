import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  ChevronLeft,
  Delete,
  Eye,
  Gamepad2,
  Home,
  MessageCircle,
  MoreHorizontal,
  RotateCcw,
  Send,
  Sparkles,
  Timer,
  Trophy,
  Users,
} from 'lucide-react';
import { MatchStateClient, Profile } from '../../shared/types';
import { AvatarBadge } from '../components/Artwork';

interface GameplayScreenProps {
  match: MatchStateClient;
  currentProfile: Profile;
  onBackHome: () => void;
  onReturnToRoom: (roomId: string) => void;
  onSubmitGuess: (guess: string) => Promise<{ correct: boolean; message: string }>;
  onPassTurn: () => Promise<void>;
  onTypingPreview: (preview: string) => void;
  onSendChat: (text: string) => Promise<void>;
  onRematch: () => Promise<void>;
  onTimerExpired?: () => void;
}

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['SHIFT', 'Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

export const GameplayScreen: React.FC<GameplayScreenProps> = ({
  match,
  currentProfile,
  onBackHome,
  onReturnToRoom,
  onSubmitGuess,
  onPassTurn,
  onTypingPreview,
  onSendChat,
  onRematch,
  onTimerExpired,
}) => {
  const myBoard = match.boards[currentProfile.id];
  const opponentBoards = Object.values(match.boards).filter(
    (b) => b.playerId !== currentProfile.id
  );
  const [selectedOpponentId, setSelectedOpponentId] = useState<string>(
    opponentBoards[0]?.playerId ?? ''
  );
  const [inspectingBoardId, setInspectingBoardId] = useState<string | null>(null);
  const [showVictoryBanner, setShowVictoryBanner] = useState<boolean>(false);
  const [showResultsModal, setShowResultsModal] = useState<boolean>(false);
  const [showMenuModal, setShowMenuModal] = useState<boolean>(false);
  const [showChatInput, setShowChatInput] = useState<boolean>(false);
  const [chatDraft, setChatDraft] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [typedSuffix, setTypedSuffix] = useState<string>('');
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const prevWinnerRef = useRef<string | null>(match.winnerId);
  const lastTickedDeadlineRef = useRef<number | null>(null);

  // Sync clock offset so countdown remains accurate against authoritative server deadline
  const clockOffsetRef = useRef<number>(match.serverNowMs - Date.now());
  useEffect(() => {
    clockOffsetRef.current = match.serverNowMs - Date.now();
  }, [match.serverNowMs]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (opponentBoards.length > 0 && !opponentBoards.some((o) => o.playerId === selectedOpponentId)) {
      setSelectedOpponentId(opponentBoards[0].playerId);
    }
  }, [opponentBoards, selectedOpponentId]);

  // Show victory announcement banner when winner appears (WITHOUT closing the match screen!)
  useEffect(() => {
    if (match.winnerId && match.winnerId !== prevWinnerRef.current) {
      setShowVictoryBanner(true);
    }
    prevWinnerRef.current = match.winnerId;
  }, [match.winnerId]);

  const activeBoard = useMemo(() => {
    if (inspectingBoardId && match.boards[inspectingBoardId]) {
      return match.boards[inspectingBoardId];
    }
    return myBoard;
  }, [inspectingBoardId, match.boards, myBoard]);

  const activeWordSlot = myBoard?.words.find((w) => w.isActive) ?? null;

  // Reset typed suffix whenever active word index changes or on new match
  useEffect(() => {
    if (!activeWordSlot) {
      setTypedSuffix('');
      return;
    }
    // Preserve seeded liveInputPreview only if it starts with the revealed prefix
    const revealedPrefix = activeWordSlot.displayText.replace(/[^A-Z]/g, '');
    if (myBoard?.liveInputPreview && myBoard.liveInputPreview.startsWith(revealedPrefix)) {
      setTypedSuffix(myBoard.liveInputPreview.slice(revealedPrefix.length));
    } else {
      setTypedSuffix('');
    }
  }, [activeWordSlot?.index, match.id]);

  const revealedPrefix = useMemo(() => {
    if (!activeWordSlot) return '';
    return activeWordSlot.displayText
      .replace(/\s+/g, '')
      .replace(/[^A-Z]/g, '');
  }, [activeWordSlot]);

  const fullGuess = (revealedPrefix + typedSuffix).toUpperCase();
  const targetLen = activeWordSlot?.length || Math.max(fullGuess.length, 4);

  const canAct = useMemo(() => {
    if (!myBoard || myBoard.completedAtMs !== null) return false;
    if (inspectingBoardId && inspectingBoardId !== currentProfile.id) return false;
    if (match.mode === 'solo' || match.mode === 'speed_race') return true;
    if (match.status === 'finished') return true; // Post-victory free solving for unfinished players
    if (match.status === 'opening') return true;
    return match.activeTurnPlayerId === currentProfile.id;
  }, [myBoard, inspectingBoardId, currentProfile.id, match.mode, match.status, match.activeTurnPlayerId]);

  // Compute authoritative countdown display
  const timerDisplay = useMemo(() => {
    if (!match.rules.timerEnabled) return '∞';
    let deadline: number | null = null;
    if (match.mode === 'speed_race') {
      deadline = match.speedRaceDeadlines[currentProfile.id] ?? null;
    } else if (match.status !== 'finished') {
      deadline = match.turnDeadlineMs;
    }
    if (deadline === null) {
      const secs = match.rules.timePerWordSeconds;
      return `00:${String(secs).padStart(2, '0')}`;
    }
    const serverNow = nowMs + clockOffsetRef.current;
    const rawRemaining = Math.max(0, Math.ceil((deadline - serverNow) / 1000));
    const remainingSec = Math.min(match.rules.timePerWordSeconds, rawRemaining);
    const mins = Math.floor(remainingSec / 60);
    const secs = remainingSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [match, currentProfile.id, nowMs]);

  // Trigger authoritative server deadline check when countdown hits 00:00 (for Vercel serverless)
  useEffect(() => {
    if (!onTimerExpired || !match.rules.timerEnabled || match.status === 'finished') return;
    const deadline =
      match.mode === 'speed_race'
        ? (match.speedRaceDeadlines[currentProfile.id] ?? null)
        : match.turnDeadlineMs;
    if (!deadline) return;
    const serverNow = nowMs + clockOffsetRef.current;
    if (serverNow >= deadline + 150 && lastTickedDeadlineRef.current !== deadline) {
      lastTickedDeadlineRef.current = deadline;
      onTimerExpired();
    }
  }, [nowMs, match.rules.timerEnabled, match.status, match.mode, match.speedRaceDeadlines, match.turnDeadlineMs, currentProfile.id, onTimerExpired]);

  const turnLabel = useMemo(() => {
    if (match.status === 'finished' && match.winnerId) {
      const winner = match.boards[match.winnerId];
      if (match.winnerId === currentProfile.id) return 'You Won! 🏆';
      return `${winner?.username ?? 'Winner'} Won • Keep Solving!`;
    }
    if (match.mode === 'solo') return 'Solo Adventure';
    if (match.mode === 'speed_race') return 'Speed Race — Go!';
    if (match.status === 'opening') return 'Opening Race — First Wins Turn!';
    if (match.activeTurnPlayerId === currentProfile.id) return 'Your Turn';
    const activePlayer = match.activeTurnPlayerId ? match.boards[match.activeTurnPlayerId] : null;
    return `${activePlayer?.username ?? 'Opponent'}'s Turn`;
  }, [match, currentProfile.id]);

  const isMyTurnHighlight =
    match.mode === 'solo' ||
    match.mode === 'speed_race' ||
    match.status === 'opening' ||
    match.activeTurnPlayerId === currentProfile.id;

  const pushKey = (letter: string) => {
    if (!canAct || !activeWordSlot) return;
    const maxSuffixLen = Math.max(0, (activeWordSlot.length || 16) - revealedPrefix.length);
    if (typedSuffix.length >= maxSuffixLen && maxSuffixLen > 0) return;
    const next = (typedSuffix + letter.toUpperCase()).replace(/[^A-Z]/g, '');
    setTypedSuffix(next);
    onTypingPreview(revealedPrefix + next);
  };

  const popKey = () => {
    if (!canAct) return;
    if (typedSuffix.length === 0) return;
    const next = typedSuffix.slice(0, -1);
    setTypedSuffix(next);
    onTypingPreview(revealedPrefix + next);
  };

  const handleSubmit = async () => {
    if (!canAct || !activeWordSlot) return;
    const guessToSend = fullGuess;
    if (guessToSend.length < 2) {
      setFeedbackMsg('Type the word first!');
      return;
    }
    try {
      const res = await onSubmitGuess(guessToSend);
      setFeedbackMsg(res.message);
      if (res.correct) {
        setTypedSuffix('');
      }
    } catch (err: any) {
      setFeedbackMsg(err.message || 'Could not submit guess');
    }
  };

  const handlePass = async () => {
    if (!canAct) return;
    try {
      await onPassTurn();
      setTypedSuffix('');
      setFeedbackMsg('Turn passed');
    } catch (err: any) {
      setFeedbackMsg(err.message);
    }
  };

  // Physical / mobile keyboard listener unified with on-screen keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showChatInput || showResultsModal || showMenuModal) return;
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && document.activeElement !== hiddenInputRef.current) {
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        pushKey(e.key.toUpperCase());
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        popKey();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => {
    if (!feedbackMsg) return;
    const t = window.setTimeout(() => setFeedbackMsg(null), 2400);
    return () => window.clearTimeout(t);
  }, [feedbackMsg]);

  const selectedOpponent =
    opponentBoards.find((o) => o.playerId === selectedOpponentId) ?? opponentBoards[0] ?? null;
  const latestMessage = match.messages[match.messages.length - 1] ?? null;

  const handleSendQuickChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatDraft.trim()) return;
    const msg = chatDraft;
    setChatDraft('');
    setShowChatInput(false);
    await onSendChat(msg);
  };

  return (
    <div className="ens-match-screen">
      {/* Hidden input for mobile native keyboard focus when user taps letter boxes */}
      <input
        ref={hiddenInputRef}
        type="text"
        aria-label="Word answer input"
        value={typedSuffix}
        onChange={(e) => {
          if (!canAct || !activeWordSlot) return;
          const clean = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
          const maxSuffix = Math.max(1, (activeWordSlot.length || 16) - revealedPrefix.length);
          const sliced = clean.slice(0, maxSuffix);
          setTypedSuffix(sliced);
          onTypingPreview(revealedPrefix + sliced);
        }}
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          width: 1,
          height: 1,
        }}
      />

      {/* Header */}
      <header className="ens-match-header">
        <button type="button" className="ens-icon-btn" onClick={onBackHome} aria-label="Back">
          <ChevronLeft size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 18, fontWeight: 800 }}>
          <Gamepad2 size={19} color="#7dd3fc" />
          <span>{match.title}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              background: 'rgba(28, 43, 122, 0.85)',
              border: '1px solid rgba(132, 162, 255, 0.35)',
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: 12.5,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Users size={14} color="#7dd3fc" />
            <span>{Object.keys(match.boards).length}</span>
          </span>
          <button
            type="button"
            className="ens-icon-btn"
            onClick={() => setShowMenuModal(true)}
            aria-label="Match menu"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </header>

      {/* Compact Purple Opponent Panel */}
      {selectedOpponent && (
        <div className="ens-opponent-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 112 }}>
            <AvatarBadge avatarId={selectedOpponent.avatarId} size={44} ringColor="#d8b4fe" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
                {selectedOpponent.username}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#c4f5df',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: selectedOpponent.isOnline ? '#22c55e' : '#94a3b8',
                    display: 'inline-block',
                  }}
                />
                <span>{selectedOpponent.statusText}</span>
              </div>
              {opponentBoards.length > 1 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  {opponentBoards.map((o) => (
                    <button
                      key={o.playerId}
                      type="button"
                      onClick={() => setSelectedOpponentId(o.playerId)}
                      style={{
                        border: 'none',
                        borderRadius: 6,
                        padding: '1px 5px',
                        fontSize: 10,
                        fontWeight: 800,
                        cursor: 'pointer',
                        background:
                          o.playerId === selectedOpponent.playerId ? '#ffd34e' : 'rgba(255,255,255,0.2)',
                        color: o.playerId === selectedOpponent.playerId ? '#1e1b4b' : '#ffffff',
                      }}
                    >
                      {o.username.slice(0, 4)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Opponent's actual puzzle progress (left-aligned mini stack) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            {selectedOpponent.words
              .slice(
                Math.max(0, selectedOpponent.currentWordIndex - 2),
                Math.max(3, selectedOpponent.currentWordIndex + 1)
              )
              .map((w) => (
                <div
                  key={w.index}
                  className={`ens-opp-word-row ${w.isCompleted ? 'done' : 'pending'}`}
                >
                  <span style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.displayText}
                    {w.isActive &&
                      selectedOpponent.liveInputPreview &&
                      selectedOpponent.liveInputPreview.length > w.revealedLetters &&
                      match.rules.opponentVisibility === 'full_live' && (
                        <span style={{ opacity: 0.65, marginLeft: 6 }}>
                          ({selectedOpponent.liveInputPreview})
                        </span>
                      )}
                  </span>
                  {w.isCompleted && <Check size={13} strokeWidth={3} color="#0ea359" />}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Post-Victory Non-Blocking Banner */}
      {match.winnerId && (
        <div
          style={{
            margin: '8px 14px 0',
            padding: '8px 12px',
            borderRadius: 14,
            background: 'linear-gradient(90deg, rgba(251,191,36,0.95) 0%, rgba(249,115,22,0.95) 100%)',
            color: '#1e1b4b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: 12.5,
            fontWeight: 800,
            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.45)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trophy size={16} />
            <span>
              {match.boards[match.winnerId]?.username} completed the chain first!
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {opponentBoards.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setInspectingBoardId(
                    inspectingBoardId && inspectingBoardId !== currentProfile.id
                      ? null
                      : selectedOpponent?.playerId ?? null
                  )
                }
                style={{
                  border: 'none',
                  borderRadius: 8,
                  padding: '4px 8px',
                  background: '#1e1b4b',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Eye size={12} />
                <span>{inspectingBoardId ? 'My Board' : 'Inspect'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowResultsModal(true)}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '4px 8px',
                background: '#ffffff',
                color: '#1e1b4b',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Results
            </button>
          </div>
        </div>
      )}

      {/* Glowing Timer & Active Turn Badge */}
      <div className="ens-timer-zone">
        <div className="ens-timer-pill">
          <Timer size={20} />
          <span>{timerDisplay}</span>
        </div>
        <div className={`ens-turn-pill ${isMyTurnHighlight ? '' : 'waiting'}`}>
          {inspectingBoardId && inspectingBoardId !== currentProfile.id
            ? `Inspecting ${activeBoard?.username}'s Board`
            : turnLabel}
        </div>
      </div>

      {/* Main Chain Board — ALL WORDS STRICTLY LEFT-ALIGNED */}
      <div className="ens-chain-board-wrap">
        <div className="ens-chain-board">
          {activeBoard?.words.map((slot) => {
            const stateClass = slot.isCompleted
              ? 'completed'
              : slot.isActive
                ? 'active'
                : 'upcoming';

            return (
              <div key={slot.index} className={`ens-word-card ${stateClass}`}>
                <span className="ens-word-card-text">{slot.displayText}</span>
                {slot.isCompleted && <Check size={20} strokeWidth={3} color="#0d9b58" />}
              </div>
            );
          })}
        </div>

        {/* Floating Speech Bubble + Feedback */}
        <div className="ens-chat-bubble-row">
          {feedbackMsg && (
            <span
              style={{
                background: 'rgba(15, 23, 66, 0.92)',
                border: '1px solid #ffd34e',
                color: '#ffd34e',
                fontSize: 11.5,
                fontWeight: 800,
                padding: '4px 10px',
                borderRadius: 999,
              }}
            >
              {feedbackMsg}
            </span>
          )}
          {latestMessage && (
            <div className="ens-floating-bubble">
              <strong style={{ color: '#5b3df5' }}>{latestMessage.senderName}:</strong>{' '}
              {latestMessage.text}
            </div>
          )}
          <button
            type="button"
            className="ens-icon-btn"
            style={{ width: 28, height: 28 }}
            onClick={() => setShowChatInput((v) => !v)}
            aria-label="Quick chat"
          >
            <MessageCircle size={14} />
          </button>
          {/* Modular Power-up Slot (Architecture Only) */}
          <span
            title="Power-ups slot (coming soon)"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              border: '1px dashed rgba(196, 181, 253, 0.4)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c4b5fd',
            }}
          >
            <Sparkles size={13} />
          </span>
        </div>

        {showChatInput && (
          <form
            onSubmit={handleSendQuickChat}
            style={{ display: 'flex', gap: 6, marginTop: 4 }}
          >
            <input
              type="text"
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="Send quick message bubble..."
              autoFocus
              style={{
                flex: 1,
                borderRadius: 12,
                border: '1px solid rgba(147, 178, 255, 0.45)',
                padding: '6px 10px',
                fontSize: 12.5,
                background: 'rgba(13, 22, 68, 0.92)',
                color: '#fff',
              }}
            />
            <button
              type="submit"
              style={{
                border: 'none',
                borderRadius: 12,
                padding: '0 12px',
                background: '#643bf2',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              <Send size={14} />
            </button>
          </form>
        )}
      </div>

      {/* Unified Letter Input Boxes + Custom Keyboard + Pass / Submit */}
      <div className="ens-input-area">
        {myBoard?.completedAtMs !== null ? (
          <div style={{ display: 'flex', gap: 10, padding: '8px 4px' }}>
            <button
              type="button"
              className="ens-pass-btn"
              style={{ flex: 1 }}
              onClick={() => setShowResultsModal(true)}
            >
              Match Results
            </button>
            <button
              type="button"
              className="ens-submit-btn"
              style={{ flex: 1.4 }}
              onClick={onRematch}
            >
              <RotateCcw size={16} />
              <span>Rematch</span>
            </button>
          </div>
        ) : (
          <>
            {/* Letter Boxes Row */}
            <div
              className="ens-letter-slots-row"
              onClick={() => hiddenInputRef.current?.focus()}
            >
              {Array.from({ length: Math.min(targetLen, 12) }).map((_, idx) => {
                const isPrefilled = idx < revealedPrefix.length;
                const char = fullGuess[idx] ?? '';
                const isCursor = idx === fullGuess.length;
                return (
                  <div
                    key={idx}
                    className={`ens-letter-box ${isPrefilled ? 'prefilled' : ''} ${isCursor && canAct ? 'cursor' : ''}`}
                  >
                    {char}
                  </div>
                );
              })}

              <button
                type="button"
                className="ens-backspace-round"
                onClick={(e) => {
                  e.stopPropagation();
                  popKey();
                }}
                aria-label="Backspace"
              >
                <Delete size={18} />
              </button>
            </div>

            {/* On-Screen QWERTY Keyboard */}
            <div className="ens-kbd">
              {KEYBOARD_ROWS.map((row, rIdx) => (
                <div key={rIdx} className="ens-kbd-row">
                  {row.map((key) => {
                    if (key === 'SHIFT') {
                      return (
                        <button
                          key={key}
                          type="button"
                          className="ens-key wide"
                          onClick={() => {
                            setTypedSuffix('');
                            onTypingPreview(revealedPrefix);
                          }}
                          title="Clear typed letters"
                        >
                          <ArrowUp size={16} />
                        </button>
                      );
                    }
                    return (
                      <button
                        key={key}
                        type="button"
                        className="ens-key"
                        onClick={() => pushKey(key)}
                      >
                        {key}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Pass & Submit */}
            <div className="ens-match-actions">
              <button
                type="button"
                className="ens-pass-btn"
                disabled={
                  !canAct ||
                  match.mode === 'solo' ||
                  match.mode === 'speed_race' ||
                  match.status !== 'active_turns'
                }
                onClick={handlePass}
              >
                Pass
              </button>
              <button
                type="button"
                className="ens-submit-btn"
                disabled={!canAct}
                onClick={handleSubmit}
              >
                <span>Submit</span>
                <Check size={18} strokeWidth={3} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Match Results Modal */}
      {(showResultsModal || showVictoryBanner) && match.winnerId && showResultsModal && (
        <div className="ens-modal-backdrop" onClick={() => setShowResultsModal(false)}>
          <div className="ens-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <Trophy size={40} color="#f59e0b" style={{ marginBottom: 4 }} />
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
                {match.winnerId === currentProfile.id
                  ? 'Victory! You Completed First!'
                  : `${match.boards[match.winnerId]?.username} Wins!`}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#5d678c', fontWeight: 600 }}>
                Chain Clash • {match.title}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {Object.values(match.boards).map((b) => (
                <div key={b.playerId} className="ens-player-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AvatarBadge avatarId={b.avatarId} size={32} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>
                        {b.username} {b.isWinner ? '👑' : ''}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#647096', fontWeight: 600 }}>
                        {b.completedAtMs
                          ? 'Completed full chain'
                          : `${b.currentWordIndex}/${b.totalWords} words solved`}
                      </div>
                    </div>
                  </div>
                  <span className={b.isWinner ? 'ens-pill-ready' : 'ens-pill-not-ready'}>
                    {b.isWinner ? 'Winner' : b.completedAtMs ? 'Finished' : 'In Progress'}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button type="button" className="ens-btn-purple" onClick={onRematch}>
                <RotateCcw size={15} />
                <span>Rematch</span>
              </button>
              {match.roomId && (
                <button
                  type="button"
                  className="ens-btn-white"
                  onClick={() => onReturnToRoom(match.roomId!)}
                >
                  Return to Room
                </button>
              )}
              <button
                type="button"
                className="ens-btn-white"
                onClick={() => setShowResultsModal(false)}
              >
                Inspect Boards
              </button>
              <button type="button" className="ens-btn-white" onClick={onBackHome}>
                <Home size={15} />
                <span>Return Home</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Menu Modal */}
      {showMenuModal && (
        <div className="ens-modal-backdrop" onClick={() => setShowMenuModal(false)}>
          <div className="ens-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 800 }}>Match Options</h3>
            <div style={{ fontSize: 12.5, color: '#5d678c', fontWeight: 600, marginBottom: 12 }}>
              <div>Mode: {match.mode.toUpperCase()}</div>
              <div>Per-word timer: {match.rules.timerEnabled ? `${match.rules.timePerWordSeconds}s` : 'Off'}</div>
              <div>Clues: {match.rules.chainVisibility}</div>
              <div>Your earned points (architecture): {myBoard?.earnedMatchPoints ?? 0} pts</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {match.roomId && (
                <button
                  type="button"
                  className="ens-btn-white"
                  onClick={() => {
                    setShowMenuModal(false);
                    onReturnToRoom(match.roomId!);
                  }}
                >
                  Return to Room Lobby
                </button>
              )}
              <button
                type="button"
                className="ens-btn-purple"
                onClick={() => {
                  setShowMenuModal(false);
                  onBackHome();
                }}
              >
                Save &amp; Exit to Home (Match Persists)
              </button>
              <button
                type="button"
                className="ens-btn-white"
                onClick={() => setShowMenuModal(false)}
              >
                Resume Playing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
