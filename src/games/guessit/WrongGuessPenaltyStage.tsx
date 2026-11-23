import React, { useEffect, useState } from 'react';
import { Clapperboard, Lock, Sparkles, Users } from 'lucide-react';

interface WrongGuessPenaltyStageProps {
  /** Authoritative server timestamp when input unlocks (null when not locked) */
  penaltyUntilMs: number | null;
  penaltyDurationMs: number;
  /** Live estimated server clock offset: serverNow = Date.now() + clockOffsetMs */
  clockOffsetMs: number;
  wrongCount: number;
  maxMistakes: number;
  lastFeedbackText?: string | null;
  lastFeedbackTone?: 'ok' | 'err' | 'info';
  waitingForTeammateName?: string | null;
  compact?: boolean;
}

/**
 * Isolated, replaceable nonviolent wrong-guess animation component.
 * Countdown and progress bar are derived directly from the server-authorized penalty timestamp.
 */
export const WrongGuessPenaltyStage: React.FC<WrongGuessPenaltyStageProps> = ({
  penaltyUntilMs,
  penaltyDurationMs,
  clockOffsetMs,
  wrongCount,
  maxMistakes,
  lastFeedbackText,
  lastFeedbackTone = 'info',
  waitingForTeammateName,
  compact = false,
}) => {
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    penaltyUntilMs ? Math.max(0, penaltyUntilMs - (Date.now() + clockOffsetMs)) : 0
  );

  useEffect(() => {
    if (!penaltyUntilMs) {
      setRemainingMs(0);
      return;
    }
    const update = () => {
      const rem = Math.max(0, penaltyUntilMs - (Date.now() + clockOffsetMs));
      setRemainingMs(rem);
    };
    update();
    const timer = window.setInterval(update, 50);
    return () => window.clearInterval(timer);
  }, [penaltyUntilMs, clockOffsetMs]);

  const isLocked = remainingMs > 0;
  const pct =
    penaltyDurationMs > 0 && isLocked
      ? Math.max(0, Math.min(100, (remainingMs / penaltyDurationMs) * 100))
      : 0;
  const waitSecLabel = (remainingMs / 1000).toFixed(1);

  if (compact) {
    if (isLocked) {
      return (
        <div className="ens-guessit-penalty-stage is-compact" role="status" aria-live="polite">
          <Lock size={16} color="#ff6b8b" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 900, color: '#ff8fab' }}>
              Wrong Guess! Wait {waitSecLabel}s...
            </div>
            <div className="ens-guessit-penalty-track" style={{ height: 7, maxWidth: 'none', marginTop: 3 }}>
              <div className="ens-guessit-penalty-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      );
    }

    if (waitingForTeammateName) {
      return (
        <div
          className="ens-guessit-penalty-stage is-compact"
          style={{ borderColor: 'rgba(56, 189, 248, 0.55)' }}
          role="status"
        >
          <Users size={15} color="#7dd3fc" />
          <span style={{ fontSize: 12.5, fontWeight: 800, color: '#bae6fd' }}>
            {waitingForTeammateName} is up next — get ready!
          </span>
        </div>
      );
    }

    return (
      <div
        className="ens-guessit-penalty-stage is-compact"
        style={{ borderColor: 'rgba(165, 180, 252, 0.45)' }}
      >
        <Sparkles size={15} color="#fde047" />
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 800,
            color:
              lastFeedbackTone === 'ok'
                ? '#6ee7b7'
                : lastFeedbackTone === 'err'
                  ? '#fda4af'
                  : '#dbeafe',
          }}
        >
          {lastFeedbackText || `Tap any A–Z key! Mistakes: ${wrongCount}/${maxMistakes}`}
        </span>
      </div>
    );
  }

  return (
    <div className="ens-guessit-penalty-stage" role="status" aria-live="polite">
      <div className="ens-guessit-penalty-mascots">
        <img
          src="/art/hero-mascot.png"
          alt="GuessIt Mascot"
          className={`ens-guessit-penalty-mascot-img ${isLocked ? 'is-shaken' : ''}`}
        />
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: isLocked
              ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.35) 0%, rgba(139, 92, 246, 0.45) 100%)'
              : 'linear-gradient(135deg, rgba(59, 130, 246, 0.35) 0%, rgba(168, 85, 247, 0.45) 100%)',
            border: '1.5px solid rgba(255, 255, 255, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: isLocked ? 'rotate(-10deg) scale(1.06)' : 'rotate(4deg)',
            transition: 'transform 0.2s ease',
          }}
          aria-hidden="true"
        >
          <Clapperboard size={26} color={isLocked ? '#fda4af' : '#fde047'} />
        </div>
      </div>

      {isLocked ? (
        <>
          <div className="ens-guessit-wrong-headline">Wrong Guess!</div>
          <div className="ens-guessit-penalty-sub">Wait {waitSecLabel}s...</div>
          <div className="ens-guessit-penalty-track">
            <div className="ens-guessit-penalty-fill" style={{ width: `${pct}%` }} />
          </div>
        </>
      ) : waitingForTeammateName ? (
        <>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#7dd3fc' }}>
            Teammate&apos;s Turn
          </div>
          <div className="ens-guessit-penalty-sub">
            Waiting for <strong>{waitingForTeammateName}</strong> to submit a letter...
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              fontSize: 14,
              fontWeight: 900,
              color:
                lastFeedbackTone === 'ok'
                  ? '#6ee7b7'
                  : lastFeedbackTone === 'err'
                    ? '#fda4af'
                    : '#fef08a',
            }}
          >
            {lastFeedbackText || 'Pick a letter below to reveal tiles!'}
          </div>
          <div className="ens-guessit-penalty-sub">
            Mistakes used: {wrongCount} / {maxMistakes}
          </div>
        </>
      )}
    </div>
  );
};
