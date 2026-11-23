import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  Clapperboard,
  Clock,
  Info,
  MessageCircle,
  Send,
  Users,
} from 'lucide-react';
import {
  GuessItClassicView,
  GuessItMatchStateClient,
} from '../../../shared/guessit/types';
import { AvatarBadge } from '../../components/Artwork';
import { GuessItKeyboard } from '../../games/guessit/GuessItKeyboard';
import { GuessItWordTiles } from '../../games/guessit/GuessItWordTiles';
import { WrongGuessPenaltyStage } from '../../games/guessit/WrongGuessPenaltyStage';

interface GuessItClassicGameplayScreenProps {
  match: GuessItMatchStateClient;
  onExit: () => void;
  onSubmitLetter: (letter: string) => Promise<{ correct: boolean; message: string } | void>;
  onSendChat: (text: string) => Promise<void>;
}

const MODE_LABELS: Record<GuessItMatchStateClient['mode'], string> = {
  speed_rush: '1v1 Speed Rush',
  word_duel: '1v1 Word Duel',
  precision_clash: '1v1 Precision Clash',
  survival_royale: 'Survival Royale',
  team_relay: 'Team Relay 2v2',
  solo_adventure: 'Solo Adventure',
};

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export const GuessItClassicGameplayScreen: React.FC<GuessItClassicGameplayScreenProps> = ({
  match,
  onExit,
  onSubmitLetter,
  onSendChat,
}) => {
  // Recompute the server clock offset only when a fresh server snapshot arrives,
  // never on local re-renders (which would freeze the estimated server clock).
  const clockOffsetRef = useRef(match.serverNowMs - Date.now());
  const lastServerNowRef = useRef(match.serverNowMs);
  if (lastServerNowRef.current !== match.serverNowMs) {
    lastServerNowRef.current = match.serverNowMs;
    clockOffsetRef.current = match.serverNowMs - Date.now();
  }

  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    Math.max(0, Math.ceil((match.roundEndsAtMs - match.serverNowMs) / 1000))
  );
  const [justRevealedLetter, setJustRevealedLetter] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; tone: 'ok' | 'err' | 'info' } | null>(
    null
  );
  const [isPenaltyLockedNow, setIsPenaltyLockedNow] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [chatDraft, setChatDraft] = useState('');

  const me = match.participants[match.viewerPlayerId];
  const puzzle = me?.puzzle?.format === 'classic' ? (me.puzzle as GuessItClassicView) : null;

  useEffect(() => {
    const update = () => {
      const serverNow = Date.now() + clockOffsetRef.current;
      setSecondsLeft(Math.max(0, Math.ceil((match.roundEndsAtMs - serverNow) / 1000)));
      const locked = Boolean(me?.penaltyUntilMs && serverNow < me.penaltyUntilMs);
      setIsPenaltyLockedNow(locked);
    };
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [match.roundEndsAtMs, me?.penaltyUntilMs]);

  const opponent = useMemo(() => {
    if (match.mode === 'team_relay') {
      const oppId = match.participantOrder.find(
        (id) => match.participants[id]?.teamId !== match.viewerTeamId
      );
      return oppId ? match.participants[oppId] : null;
    }
    const oppId = match.participantOrder.find((id) => id !== match.viewerPlayerId);
    return oppId ? match.participants[oppId] : null;
  }, [match]);

  const relayWaitingName = useMemo(() => {
    if (match.mode !== 'team_relay' || !me?.activeTurnPlayerId) return null;
    if (me.activeTurnPlayerId === match.viewerPlayerId) return null;
    return match.participants[me.activeTurnPlayerId]?.username ?? 'Teammate';
  }, [match.mode, match.participants, match.viewerPlayerId, me?.activeTurnPlayerId]);

  const inputDisabled =
    pendingSubmit ||
    match.status !== 'playing' ||
    match.viewerIsSpectator ||
    Boolean(me?.puzzleSolved) ||
    Boolean(me?.puzzleFailed) ||
    isPenaltyLockedNow ||
    Boolean(relayWaitingName);

  const handlePressLetter = async (letter: string) => {
    if (inputDisabled) return;
    setPendingSubmit(true);
    try {
      const res = await onSubmitLetter(letter);
      if (res) {
        setFeedback({
          text: res.message,
          tone: res.correct ? 'ok' : 'err',
        });
        if (res.correct) {
          setJustRevealedLetter(letter);
          window.setTimeout(() => setJustRevealedLetter(null), 650);
        }
      }
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Guess rejected', tone: 'err' });
    } finally {
      setPendingSubmit(false);
    }
  };

  return (
    <div className="ens-guessit-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <header className="ens-guessit-topbar">
        <button
          type="button"
          className="ens-guessit-circle-btn"
          onClick={onExit}
          aria-label="Leave Match"
        >
          <ChevronLeft size={22} strokeWidth={2.8} />
        </button>

        <div className="ens-guessit-mode-pill-header">
          <Users size={14} color="#bae6fd" />
          <span>
            {MODE_LABELS[match.mode]}
            {match.totalRounds > 1 ? ` • R${match.roundIndex}/${match.totalRounds}` : ''}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {match.mode !== 'solo_adventure' && (
            <button
              type="button"
              className="ens-guessit-circle-btn"
              onClick={() => setShowChat((v) => !v)}
              aria-label="Toggle match chat"
            >
              <MessageCircle size={17} />
            </button>
          )}
          <button
            type="button"
            className="ens-guessit-circle-btn"
            onClick={() => setShowInfo((v) => !v)}
            aria-label="Puzzle clue and details"
          >
            <Info size={17} />
          </button>
        </div>
      </header>

      <div className="ens-guessit-gameplay-wrap">
        {/* Versus / Team / Survival HUD */}
        <div className="ens-guessit-vs-bar">
          <div className="ens-guessit-hud-player is-blue">
            <AvatarBadge avatarId={me?.avatarId || 'alex'} size={34} ringColor="#38bdf8" />
            <div style={{ minWidth: 0 }}>
              <div className="ens-guessit-hud-name">
                {match.mode === 'team_relay'
                  ? `Blue (${me?.username || 'You'})`
                  : `${me?.username || 'You'}`}
              </div>
              <div className="ens-guessit-hud-score">
                {match.mode === 'team_relay'
                  ? `Sets: ${match.teamScores.blue}`
                  : (me?.score ?? 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="ens-guessit-vs-badge">
            {match.mode === 'solo_adventure'
              ? 'SOLO'
              : match.mode === 'survival_royale'
                ? `${match.survivorIds.length} ALIVE`
                : 'VS'}
          </div>

          {opponent ? (
            <div className="ens-guessit-hud-player is-pink">
              <AvatarBadge avatarId={opponent.avatarId} size={34} ringColor="#f472b6" />
              <div style={{ minWidth: 0 }}>
                <div className="ens-guessit-hud-name">
                  {match.mode === 'team_relay'
                    ? `Red (${opponent.username})`
                    : opponent.username}
                </div>
                <div className="ens-guessit-hud-score">
                  {match.mode === 'team_relay'
                    ? `Sets: ${match.teamScores.red}`
                    : opponent.score.toLocaleString()}
                </div>
              </div>
            </div>
          ) : (
            <div className="ens-guessit-hud-player is-pink" style={{ justifyContent: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#fbcfe8' }}>
                {puzzle ? `${puzzle.revealedLettersCount}/${puzzle.totalLetters} Letters` : 'Stage Active'}
              </div>
            </div>
          )}
        </div>

        {/* Category Pill + Countdown Timer */}
        <div className="ens-guessit-meta-strip">
          <div className="ens-guessit-cat-pill">
            <Clapperboard size={14} color="#c084fc" />
            <span>Category: {match.category}</span>
          </div>

          <div className="ens-guessit-timer-pill" aria-label="Round timer">
            <Clock size={14} color="#fde047" />
            <span>{formatClock(secondsLeft)}</span>
          </div>
        </div>

        {/* Mistakes Meter */}
        <div className="ens-guessit-mistakes-row" aria-label="Mistake count">
          <span>
            Mistakes {me?.wrongCount ?? 0}/{me?.maxMistakes ?? 6}
          </span>
          {Array.from({ length: me?.maxMistakes ?? 6 }).map((_, i) => (
            <span
              key={i}
              className={`ens-guessit-mistake-pip ${i < (me?.wrongCount ?? 0) ? 'is-used' : ''}`}
            />
          ))}
        </div>

        {/* Hidden Multi-Word Phrase Tiles */}
        {puzzle ? (
          <GuessItWordTiles puzzle={puzzle} justRevealedLetter={justRevealedLetter} />
        ) : (
          <div className="ens-guessit-glass-card" style={{ textAlign: 'center', fontWeight: 800 }}>
            Waiting for puzzle state...
          </div>
        )}

        {/* Clue banner when toggled */}
        {showInfo && puzzle?.clue && (
          <div
            style={{
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 800,
              color: '#fef08a',
              background: 'rgba(18, 26, 94, 0.85)',
              padding: '5px 10px',
              borderRadius: 10,
              border: '1px solid rgba(250, 204, 21, 0.45)',
            }}
          >
            Clue: {puzzle.clue}
          </div>
        )}

        {/* Spectator / Round Transition Banner */}
        {match.viewerIsSpectator && (
          <div
            style={{
              textAlign: 'center',
              padding: '6px 10px',
              borderRadius: 12,
              background: 'rgba(225, 29, 72, 0.25)',
              border: '1px solid #fb7185',
              fontSize: 12.5,
              fontWeight: 900,
            }}
          >
            Eliminated — Spectating remaining survivors!
          </div>
        )}

        {/* Wrong-Guess Mascot & Server-Enforced Penalty Countdown */}
        <WrongGuessPenaltyStage
          penaltyUntilMs={me?.penaltyUntilMs ?? null}
          penaltyDurationMs={match.penaltyDurationMs}
          clockOffsetMs={clockOffsetRef.current}
          wrongCount={me?.wrongCount ?? 0}
          maxMistakes={me?.maxMistakes ?? 6}
          lastFeedbackText={feedback?.text}
          lastFeedbackTone={feedback?.tone}
          waitingForTeammateName={relayWaitingName}
        />

        {/* Match Chat Drawer */}
        {showChat && (
          <div className="ens-guessit-glass-card" style={{ padding: 8 }}>
            <div style={{ maxHeight: 62, overflowY: 'auto', fontSize: 11.5, marginBottom: 5 }}>
              {match.messages.slice(-8).map((m) => (
                <div key={m.id}>
                  <strong style={{ color: '#fde047' }}>{m.senderName}:</strong> {m.text}
                </div>
              ))}
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!chatDraft.trim()) return;
                const txt = chatDraft.trim();
                setChatDraft('');
                await onSendChat(txt);
              }}
              style={{ display: 'flex', gap: 5 }}
            >
              <input
                type="text"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder="Chat..."
                style={{
                  flex: 1,
                  borderRadius: 8,
                  border: '1px solid rgba(165, 180, 252, 0.4)',
                  background: 'rgba(10, 16, 66, 0.9)',
                  color: '#fff',
                  padding: '5px 8px',
                  fontSize: 12,
                }}
              />
              <button
                type="submit"
                aria-label="Send message"
                style={{
                  borderRadius: 8,
                  border: 'none',
                  background: '#6366f1',
                  color: '#fff',
                  padding: '0 10px',
                }}
              >
                <Send size={13} />
              </button>
            </form>
          </div>
        )}

        {/* Bottom A-Z Keyboard */}
        <GuessItKeyboard
          correctLetters={me?.correctLetters ?? []}
          wrongLetters={me?.wrongLetters ?? []}
          disabled={inputDisabled}
          onPressLetter={handlePressLetter}
        />
      </div>
    </div>
  );
};
