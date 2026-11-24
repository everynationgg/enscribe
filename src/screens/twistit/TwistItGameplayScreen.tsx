import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Check,
  Delete,
  Eraser,
  RefreshCw,
  RotateCcw,
  Shuffle,
  Timer,
  Trophy,
} from 'lucide-react';
import {
  TwistItMatchView,
  TwistItSubmitResult,
  TwistItWordLength,
} from '../../../shared/twistit/types';
import { twistTileIndices } from '../../../shared/twistit/catalog';

interface TwistItGameplayScreenProps {
  match: TwistItMatchView;
  viewerUserId: string;
  onExit: () => void;
  onSubmitWord: (word: string) => Promise<TwistItSubmitResult>;
  onPlayAnotherSolo: (excludePuzzleId: string) => Promise<void>;
  onRematch1v1?: () => Promise<void>;
  onBackToLobby?: () => void;
  onSyncMatch?: () => Promise<void>;
}

const WORD_LENGTHS: TwistItWordLength[] = [3, 4, 5, 6];

function formatClockMs(ms: number): string {
  const safe = Math.max(0, ms);
  const totalSec = Math.floor(safe / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export const TwistItGameplayScreen: React.FC<TwistItGameplayScreenProps> = ({
  match,
  viewerUserId,
  onExit,
  onSubmitWord,
  onPlayAnotherSolo,
  onRematch1v1,
  onBackToLobby,
  onSyncMatch,
}) => {
  // Visual tile order permutation (indices into match.scrambledLetters).
  // Twisting rearranges tileOrder visually WITHOUT changing letters, answers, or timer.
  const [tileOrder, setTileOrder] = useState<number[]>([0, 1, 2, 3, 4, 5]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isTwisting, setIsTwisting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shakeTray, setShakeTray] = useState(false);
  const [flashSuccess, setFlashSuccess] = useState(false);
  const [justFoundIdx, setJustFoundIdx] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err' | 'idle'; text: string }>({
    kind: 'idle',
    text: 'Tap tiles or type letters to twist words!',
  });

  // Clock offset so client display stays synchronized with server time
  const clockOffsetRef = useRef<number>(match.serverNowMs - Date.now());
  const [nowSynced, setNowSynced] = useState<number>(match.serverNowMs);
  const timeoutSyncedRef = useRef(false);

  useEffect(() => {
    clockOffsetRef.current = match.serverNowMs - Date.now();
    setNowSynced(match.serverNowMs);
  }, [match.serverNowMs]);

  useEffect(() => {
    // Reset local selection ONLY when switching to a brand new matchId
    setTileOrder([0, 1, 2, 3, 4, 5]);
    setSelectedIndices([]);
    setJustFoundIdx(null);
    timeoutSyncedRef.current = false;
    setFeedback({ kind: 'idle', text: 'Tap tiles or type letters to twist words!' });
  }, [match.id]);

  useEffect(() => {
    if (match.status === 'finished') return;
    const interval = window.setInterval(() => {
      const est = Date.now() + clockOffsetRef.current;
      setNowSynced(est);
      if (
        match.mode === 'race_1v1' &&
        match.endsAtMs !== null &&
        est >= match.endsAtMs + 250 &&
        !timeoutSyncedRef.current &&
        onSyncMatch
      ) {
        timeoutSyncedRef.current = true;
        onSyncMatch().catch(() => undefined);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [match.status, match.endsAtMs, match.mode, onSyncMatch]);

  const countdownRemainingSec =
    nowSynced < match.startsAtMs ? Math.ceil((match.startsAtMs - nowSynced) / 1000) : 0;
  const isCountdownActive = match.status !== 'finished' && countdownRemainingSec > 0;
  const isFinished = match.status === 'finished';

  const selfPlayer = match.players.find((p) => p.userId === viewerUserId) ?? match.players[0];
  const oppPlayer = match.mode === 'race_1v1' ? match.players.find((p) => p.userId !== viewerUserId) : undefined;

  const elapsedMs = isFinished
    ? selfPlayer?.completionDurationMs ?? Math.max(0, (match.finishedAtMs ?? nowSynced) - match.startsAtMs)
    : Math.max(0, nowSynced - match.startsAtMs);

  const raceRemainingMs =
    match.endsAtMs !== null
      ? isFinished
        ? 0
        : Math.max(0, match.endsAtMs - nowSynced)
      : 0;

  const groupedSlots = useMemo(() => {
    const groups: Record<TwistItWordLength, typeof match.selfSlots> = { 3: [], 4: [], 5: [], 6: [] };
    for (const slot of match.selfSlots) {
      groups[slot.length].push(slot);
    }
    return groups;
  }, [match.selfSlots]);

  const handleTwist = useCallback(() => {
    setTileOrder((prev) => twistTileIndices(prev, Date.now()));
    setIsTwisting(true);
    window.setTimeout(() => setIsTwisting(false), 290);
  }, []);

  const handleSelectTileIndex = useCallback(
    (letterIndex: number) => {
      if (isCountdownActive || isFinished) return;
      setSelectedIndices((prev) => {
        if (prev.includes(letterIndex)) return prev;
        if (prev.length >= 6) return prev;
        return [...prev, letterIndex];
      });
    },
    [isCountdownActive, isFinished]
  );

  const handleBackspace = useCallback(() => {
    setSelectedIndices((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setSelectedIndices([]);
  }, []);

  const constructedWord = selectedIndices.map((idx) => match.scrambledLetters[idx] || '').join('');

  const handleSubmit = useCallback(async () => {
    if (submitting || isCountdownActive || isFinished) return;
    if (!constructedWord) {
      setShakeTray(true);
      setFeedback({ kind: 'err', text: 'Select at least 3 letters first!' });
      window.setTimeout(() => setShakeTray(false), 360);
      return;
    }

    setSubmitting(true);
    try {
      const res = await onSubmitWord(constructedWord);
      setSelectedIndices([]);
      if (res.accepted) {
        setFlashSuccess(true);
        setJustFoundIdx(typeof res.slotIndex === 'number' ? res.slotIndex : null);
        setFeedback({ kind: 'ok', text: res.message });
        window.setTimeout(() => setFlashSuccess(false), 450);
      } else {
        setShakeTray(true);
        setFeedback({ kind: 'err', text: res.message });
        window.setTimeout(() => setShakeTray(false), 360);
      }
    } catch (err: any) {
      setShakeTray(true);
      setFeedback({ kind: 'err', text: err?.message || 'Could not submit word.' });
      window.setTimeout(() => setShakeTray(false), 360);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, isCountdownActive, isFinished, constructedWord, onSubmitWord]);

  // Desktop Keyboard Input Support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isCountdownActive || isFinished) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        handleTwist();
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const ch = e.key.toUpperCase();
        // Find first unused tile matching pressed letter in current visual order
        const matchIdx = tileOrder.find(
          (idx) => match.scrambledLetters[idx] === ch && !selectedIndices.includes(idx)
        );
        if (typeof matchIdx === 'number') {
          e.preventDefault();
          handleSelectTileIndex(matchIdx);
        } else {
          setShakeTray(true);
          window.setTimeout(() => setShakeTray(false), 260);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isCountdownActive,
    isFinished,
    tileOrder,
    selectedIndices,
    match.scrambledLetters,
    handleSubmit,
    handleBackspace,
    handleClear,
    handleTwist,
    handleSelectTileIndex,
  ]);

  const didWin = match.winnerIds.includes(viewerUserId);

  return (
    <div className="twist-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <div className="twist-scroll">
        <div className="twist-inner">
          {/* Top Bar */}
          <div className="twist-hud-bar">
            <button type="button" className="ens-back-hub-pill" onClick={onExit}>
              <ArrowLeft size={14} strokeWidth={2.8} />
              <span>{match.mode === 'solo' ? 'TwistIt' : 'Exit Race'}</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="twist-stat-chip">
                <Check size={13} color="#4ade80" />
                <span>
                  {selfPlayer?.foundCount ?? 0} / {match.totalRequired}
                </span>
              </span>

              {match.mode === 'solo' ? (
                <span className="twist-stat-chip is-gold">
                  <Timer size={13} />
                  <span>{formatClockMs(elapsedMs)}</span>
                </span>
              ) : (
                <span className={`twist-stat-chip ${raceRemainingMs <= 20000 ? 'is-urgent' : 'is-gold'}`}>
                  <Timer size={13} />
                  <span>{formatClockMs(raceRemainingMs)}</span>
                </span>
              )}
            </div>
          </div>

          {/* Mode-Specific Status Header (Solo PB vs 1v1 Live Race Progress) */}
          {match.mode === 'solo' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', fontSize: 12, fontWeight: 800, color: '#cbd5ff' }}>
              <span>Accuracy: {selfPlayer?.accuracyPercent ?? 100}%</span>
              {typeof match.personalBestDurationMs === 'number' && (
                <span style={{ color: '#fde047', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Award size={13} /> Best Time: {formatClockMs(match.personalBestDurationMs)}
                </span>
              )}
            </div>
          ) : (
            <div className="twist-race-duel-bar" aria-label="1v1 race progress">
              <div className="twist-racer-col">
                <div className="twist-racer-name-row">
                  <span className="twist-racer-name">{selfPlayer?.displayName || 'You'}</span>
                  <span style={{ color: '#7dd3fc' }}>
                    {selfPlayer?.foundCount ?? 0}/{match.totalRequired}
                  </span>
                </div>
                <div className="twist-racer-bar-track">
                  <div
                    className="twist-racer-bar-fill"
                    style={{ width: `${selfPlayer?.completionPercent ?? 0}%` }}
                  />
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 900, color: '#fde047' }}>VS</div>

              <div className="twist-racer-col is-opp">
                <div className="twist-racer-name-row">
                  <span style={{ color: '#f9a8d4' }}>
                    {oppPlayer?.foundCount ?? 0}/{match.totalRequired}
                  </span>
                  <span className="twist-racer-name">{oppPlayer?.displayName || 'Opponent'}</span>
                </div>
                <div className="twist-racer-bar-track">
                  <div
                    className="twist-racer-bar-fill is-opp"
                    style={{ width: `${oppPlayer?.completionPercent ?? 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Solution Slots Board Grouped by Word Length */}
          <section className="twist-board" aria-label="Solution board">
            {WORD_LENGTHS.map((len) => {
              const slots = groupedSlots[len];
              if (!slots || slots.length === 0) return null;
              const solvedCount = slots.filter((s) => s.revealed).length;
              return (
                <div key={len} className="twist-length-group">
                  <div className="twist-length-label">
                    <span>{len}-Letter Words</span>
                    <span>
                      {solvedCount}/{slots.length}
                    </span>
                  </div>
                  <div className="twist-slots-wrap">
                    {slots.map((slot) => (
                      <div
                        key={slot.index}
                        className={`twist-slot-word ${slot.revealed ? 'is-solved' : ''} ${
                          justFoundIdx === slot.index ? 'is-just-found' : ''
                        }`}
                      >
                        {Array.from({ length: slot.length }).map((_, cIdx) => {
                          const letter = slot.word ? slot.word[cIdx] : '';
                          return (
                            <span
                              key={cIdx}
                              className={`twist-slot-cell ${
                                slot.revealed ? 'is-revealed' : slot.word ? 'is-missed' : ''
                              }`}
                            >
                              {letter || '_'}
                            </span>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>

          {/* Word Construction Preview & Feedback */}
          <section className="twist-tray-section">
            <div
              className={`twist-preview-tray ${shakeTray ? 'is-shake' : ''} ${
                flashSuccess ? 'is-success' : ''
              }`}
              aria-label="Selected word preview"
            >
              {selectedIndices.length === 0 ? (
                <span style={{ fontSize: 13, fontWeight: 700, color: '#93c5fd' }}>
                  Build a 3–6 letter word...
                </span>
              ) : (
                selectedIndices.map((tileIdx, pos) => (
                  <button
                    key={`${tileIdx}-${pos}`}
                    type="button"
                    className="twist-preview-tile"
                    onClick={() =>
                      setSelectedIndices((prev) => prev.filter((_, i) => i !== pos))
                    }
                    aria-label={`Remove ${match.scrambledLetters[tileIdx]}`}
                  >
                    {match.scrambledLetters[tileIdx]}
                  </button>
                ))
              )}
            </div>

            <div
              className={`twist-feedback-pill ${
                feedback.kind === 'ok' ? 'is-ok' : feedback.kind === 'err' ? 'is-err' : ''
              }`}
              role="status"
            >
              {feedback.text}
            </div>
          </section>

          {/* 6 Interactive Letter Tiles */}
          <section
            className={`twist-rack-grid ${isTwisting ? 'is-twisting' : ''}`}
            aria-label="Available letter tiles"
          >
            {tileOrder.map((letterIdx) => {
              const ch = match.scrambledLetters[letterIdx];
              const used = selectedIndices.includes(letterIdx);
              return (
                <button
                  key={letterIdx}
                  type="button"
                  className={`twist-letter-tile ${used ? 'is-used' : ''}`}
                  disabled={used || isCountdownActive || isFinished}
                  onClick={() => handleSelectTileIndex(letterIdx)}
                  aria-label={`Letter ${ch}`}
                >
                  {ch}
                </button>
              );
            })}
          </section>

          {/* Controls: Twist / Clear / Backspace / Submit */}
          <section className="twist-controls-row">
            <button
              type="button"
              className="twist-btn-cyan"
              onClick={handleTwist}
              disabled={isFinished}
            >
              <Shuffle size={15} />
              <span>Twist</span>
            </button>

            <button
              type="button"
              className="twist-btn-ghost"
              onClick={handleClear}
              disabled={selectedIndices.length === 0 || isFinished}
              aria-label="Clear selected letters"
            >
              <Eraser size={15} />
              <span>Clear</span>
            </button>

            <button
              type="button"
              className="twist-btn-ghost"
              onClick={handleBackspace}
              disabled={selectedIndices.length === 0 || isFinished}
              aria-label="Backspace"
            >
              <Delete size={16} />
            </button>

            <button
              type="button"
              className="twist-btn-gold"
              onClick={handleSubmit}
              disabled={selectedIndices.length < 3 || submitting || isCountdownActive || isFinished}
            >
              <Check size={16} strokeWidth={3} />
              <span>Submit</span>
            </button>
          </section>
        </div>
      </div>

      {/* Countdown Overlay */}
      {isCountdownActive && (
        <div className="twist-overlay-backdrop" role="status" aria-live="assertive">
          <div className="twist-countdown-orb">
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.08em', color: '#e0e7ff' }}>
              GET READY
            </div>
            <div className="twist-countdown-num">{countdownRemainingSec}</div>
          </div>
        </div>
      )}

      {/* Finished Celebration / 1v1 Results Modal */}
      {isFinished && (
        <div className="twist-overlay-backdrop">
          <div className="twist-results-modal" role="dialog" aria-label="Match results">
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 999,
                background: 'linear-gradient(135deg, #fde047 0%, #f59e0b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(245, 158, 11, 0.5)',
              }}
            >
              <Trophy size={30} color="#451a03" />
            </div>

            {match.mode === 'solo' ? (
              <>
                <h2 style={{ margin: 0, fontSize: 23, fontWeight: 900 }}>Puzzle Complete!</h2>
                {match.isNewPersonalBest && (
                  <div
                    style={{
                      padding: '4px 12px',
                      borderRadius: 999,
                      background: 'rgba(250, 204, 21, 0.22)',
                      border: '1px solid #fde047',
                      color: '#fde047',
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    NEW PERSONAL BEST!
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
                  <div className="twist-card" style={{ padding: 10 }}>
                    <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 800 }}>COMPLETION TIME</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#fde047' }}>
                      {formatClockMs(elapsedMs)}
                    </div>
                  </div>
                  <div className="twist-card" style={{ padding: 10 }}>
                    <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 800 }}>ACCURACY</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#86efac' }}>
                      {selfPlayer?.accuracyPercent ?? 100}%
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <button type="button" className="twist-btn-ghost" style={{ flex: 1 }} onClick={onExit}>
                    TwistIt Home
                  </button>
                  <button
                    type="button"
                    className="twist-btn-gold"
                    style={{ flex: 1.4 }}
                    onClick={() => onPlayAnotherSolo(match.puzzleId)}
                  >
                    <RotateCcw size={15} />
                    <span>Next Puzzle</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: match.isDraw ? '#fde047' : didWin ? '#86efac' : '#fda4af' }}>
                  {match.isDraw ? 'Match Draw!' : didWin ? 'Victory!' : 'Race Finished!'}
                </h2>
                <p style={{ margin: 0, fontSize: 12.5, color: '#cbd5ff', fontWeight: 700 }}>
                  {match.finishReason === 'completed_all'
                    ? didWin
                      ? 'You discovered all required words first!'
                      : `${oppPlayer?.displayName || 'Opponent'} completed all words first.`
                    : match.finishReason === 'timeout_lead'
                      ? 'Time expired — decided by most words discovered.'
                      : match.finishReason === 'timeout_letters_tiebreak'
                        ? 'Words tied — decided by total letters discovered!'
                        : 'Time expired — exact tie!'}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
                  {match.players.map((p) => (
                    <div key={p.userId} className="twist-card" style={{ padding: 10, textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: p.userId === viewerUserId ? '#7dd3fc' : '#f9a8d4', marginBottom: 4 }}>
                        {p.displayName}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800 }}>
                        Words: {p.foundCount}/{p.totalRequired}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#cbd5ff', fontWeight: 700 }}>
                        Letters: {p.totalLettersFound}
                      </div>
                      {p.completionDurationMs !== null && (
                        <div style={{ fontSize: 11.5, color: '#fde047', fontWeight: 800 }}>
                          Time: {formatClockMs(p.completionDurationMs)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <button
                    type="button"
                    className="twist-btn-ghost"
                    style={{ flex: 1 }}
                    onClick={onBackToLobby || onExit}
                  >
                    Back to Lobby
                  </button>
                  {onRematch1v1 && (
                    <button
                      type="button"
                      className="twist-btn-gold"
                      style={{ flex: 1.3 }}
                      onClick={onRematch1v1}
                    >
                      <RefreshCw size={15} />
                      <span>Play Again</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
