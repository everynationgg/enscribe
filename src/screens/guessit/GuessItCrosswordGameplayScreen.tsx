import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  Clapperboard,
  Clock,
  Grid,
  List,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  GuessItCrosswordView,
  GuessItMatchStateClient,
} from '../../../shared/guessit/types';
import { GuessItCrosswordGrid } from '../../games/guessit/GuessItCrosswordGrid';
import { GuessItKeyboard } from '../../games/guessit/GuessItKeyboard';
import { WrongGuessPenaltyStage } from '../../games/guessit/WrongGuessPenaltyStage';

interface GuessItCrosswordGameplayScreenProps {
  match: GuessItMatchStateClient;
  onExit: () => void;
  onSubmitLetter: (letter: string) => Promise<{ correct: boolean; message: string } | void>;
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export const GuessItCrosswordGameplayScreen: React.FC<GuessItCrosswordGameplayScreenProps> = ({
  match,
  onExit,
  onSubmitLetter,
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
  const [muted, setMuted] = useState(false);
  const [showHudDetail, setShowHudDetail] = useState(false);

  const me = match.participants[match.viewerPlayerId];
  const puzzle =
    me?.puzzle?.format === 'crossword' ? (me.puzzle as GuessItCrosswordView) : null;

  useEffect(() => {
    const update = () => {
      const serverNow = Date.now() + clockOffsetRef.current;
      setSecondsLeft(Math.max(0, Math.ceil((match.roundEndsAtMs - serverNow) / 1000)));
      setIsPenaltyLockedNow(Boolean(me?.penaltyUntilMs && serverNow < me.penaltyUntilMs));
    };
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [match.roundEndsAtMs, me?.penaltyUntilMs]);

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
        setFeedback({ text: res.message, tone: res.correct ? 'ok' : 'err' });
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

  const progressPct =
    puzzle && puzzle.totalLetters > 0
      ? Math.round((puzzle.revealedLettersCount / puzzle.totalLetters) * 100)
      : 0;

  return (
    <div className="ens-guessit-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <header className="ens-guessit-topbar">
        <button
          type="button"
          className="ens-guessit-circle-btn"
          onClick={onExit}
          aria-label="Leave Crossword"
        >
          <ChevronLeft size={22} strokeWidth={2.8} />
        </button>

        <div className="ens-guessit-mode-pill-header">
          <Grid size={14} color="#d8b4fe" />
          <span>Crossword GuessIt</span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="ens-guessit-circle-btn"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button
            type="button"
            className="ens-guessit-circle-btn"
            onClick={() => setShowHudDetail((v) => !v)}
            aria-label="Toggle opponent progress"
          >
            <List size={17} />
          </button>
        </div>
      </header>

      <div className="ens-guessit-gameplay-wrap">
        <div className="ens-guessit-meta-strip">
          <div className="ens-guessit-cat-pill">
            <Clapperboard size={14} color="#c084fc" />
            <span>Category: {match.category}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                padding: '4px 8px',
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.22)',
                border: '1px solid rgba(52, 211, 153, 0.5)',
                color: '#a7f3d0',
              }}
            >
              {progressPct}%
            </span>
            <div className="ens-guessit-timer-pill" aria-label="Crossword timer">
              <Clock size={14} color="#fde047" />
              <span>{formatClock(secondsLeft)}</span>
            </div>
          </div>
        </div>

        <div className="ens-guessit-mistakes-row" aria-label="Mistakes meter">
          <span>
            Global Grid • {puzzle?.entryCount ?? 3} Entries • Mistakes {me?.wrongCount ?? 0}/
            {me?.maxMistakes ?? 6}
          </span>
        </div>

        {showHudDetail && (
          <div className="ens-guessit-glass-card" style={{ padding: '7px 10px', fontSize: 11.5 }}>
            {match.participantOrder.map((pid) => {
              const p = match.participants[pid];
              if (!p) return null;
              return (
                <div
                  key={pid}
                  style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}
                >
                  <span>{p.username}</span>
                  <span style={{ color: '#fde047' }}>
                    {Math.round(p.revealedRatio * 100)}% • {p.wrongCount}/{p.maxMistakes} err
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Responsive Global-Reveal Crossword Grid */}
        {puzzle ? (
          <GuessItCrosswordGrid puzzle={puzzle} justRevealedLetter={justRevealedLetter} />
        ) : (
          <div className="ens-guessit-glass-card" style={{ textAlign: 'center', fontWeight: 800 }}>
            Loading crossword layout...
          </div>
        )}

        <WrongGuessPenaltyStage
          compact
          penaltyUntilMs={me?.penaltyUntilMs ?? null}
          penaltyDurationMs={match.penaltyDurationMs}
          clockOffsetMs={clockOffsetRef.current}
          wrongCount={me?.wrongCount ?? 0}
          maxMistakes={me?.maxMistakes ?? 6}
          lastFeedbackText={feedback?.text}
          lastFeedbackTone={feedback?.tone}
          waitingForTeammateName={relayWaitingName}
        />

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
