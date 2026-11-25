import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  Clock,
  Flag,
  Lightbulb,
  Lock,
  Play,
  RotateCcw,
  ShieldAlert,
  Snowflake,
  Sparkles,
  Star,
  Shuffle,
  Users,
  Zap,
} from 'lucide-react';
import { MODIFIER_CATALOG } from '../../../shared/changeit/modifiers';
import {
  ChangeItAdventureClaimResult,
  ChangeItMatchStateClient,
  ChangeItModifierType,
  ChangeItTransformResponse,
} from '../../../shared/types';
import { ChangeItKeyboard } from '../../games/changeit/ChangeItKeyboard';
import {
  getCachedChangeItClientData,
  loadChangeItClientData,
} from '../../games/changeit/clientDictionary';
import { validateMoveTransformation } from '../../../shared/changeit/wordGraph';

interface ChangeItGameplayScreenProps {
  match: ChangeItMatchStateClient;
  viewerId: string;
  adventureClaim?: ChangeItAdventureClaimResult | null;
  onExit: () => void;
  onSubmitTransform: (word: string, clientRequestId: string) => Promise<ChangeItTransformResponse>;
  onUseHint?: () => Promise<void>;
  onActivateModifier?: (
    modifierType: ChangeItModifierType,
    targetPlayerId?: string,
    clientRequestId?: string
  ) => Promise<void>;
  onForfeit?: () => Promise<void>;
  onRetryAdventure?: () => Promise<void>;
  onNextAdventureStage?: () => void;
  onRematch?: () => Promise<void>;
  onBackToLobby?: () => void;
  onSyncMatch?: () => Promise<void>;
}

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function modifierIcon(type: ChangeItModifierType) {
  switch (type) {
    case 'double_shift':
      return <Zap size={13} color="#22d3ee" />;
    case 'frozen_letter':
      return <Snowflake size={13} color="#38bdf8" />;
    case 'letter_lock':
      return <Lock size={13} color="#fbbf24" />;
    case 'pathfinder':
      return <Sparkles size={13} color="#34d399" />;
    case 'reroute':
      return <Shuffle size={13} color="#c084fc" />;
  }
}

export const ChangeItGameplayScreen: React.FC<ChangeItGameplayScreenProps> = ({
  match,
  viewerId,
  adventureClaim,
  onExit,
  onSubmitTransform,
  onUseHint,
  onActivateModifier,
  onForfeit,
  onRetryAdventure,
  onNextAdventureStage,
  onRematch,
  onBackToLobby,
  onSyncMatch,
}) => {
  const { self } = match;
  const wordLen = self.currentWord.length;

  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [stagedReplacements, setStagedReplacements] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<{ text: string; kind: 'ok' | 'err' | 'info' } | null>(
    null
  );
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const clockOffsetRef = useRef(0);
  const historyEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadChangeItClientData().catch(() => undefined);
  }, []);

  useEffect(() => {
    clockOffsetRef.current = match.serverNowMs - Date.now();
  }, [match.serverNowMs]);

  useEffect(() => {
    if (match.status === 'finished') return;
    const t = window.setInterval(() => setNowMs(Date.now() + clockOffsetRef.current), 250);
    return () => window.clearInterval(t);
  }, [match.status]);

  // Reset staged edits whenever currentWord advances
  useEffect(() => {
    setStagedReplacements({});
    setSelectedIdx(0);
  }, [self.currentWord]);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [self.history.length]);

  const effectiveNow = nowMs;

  const lockedPositions = useMemo(() => {
    const set = new Set<number>(self.restrictions.lockedPositions);
    if (
      self.restrictions.nextMoveLockedPosition !== null &&
      self.restrictions.nextMoveLockedPosition !== undefined
    ) {
      set.add(self.restrictions.nextMoveLockedPosition);
    }
    for (const am of self.activeModifiers) {
      if (am.expiresAtMs !== null && effectiveNow >= am.expiresAtMs) continue;
      if (
        (am.type === 'letter_lock' || am.type === 'frozen_letter') &&
        am.lockedIndex !== null &&
        am.lockedIndex !== undefined
      ) {
        set.add(am.lockedIndex);
      }
    }
    return set;
  }, [self.restrictions, self.activeModifiers, effectiveNow]);

  const hasDoubleShift = useMemo(
    () =>
      self.activeModifiers.some(
        (am) =>
          am.type === 'double_shift' &&
          (am.expiresAtMs === null || effectiveNow < am.expiresAtMs) &&
          (am.remainingCharges === null || am.remainingCharges > 0)
      ),
    [self.activeModifiers, effectiveNow]
  );

  const myRelayTeam = useMemo(() => {
    if (match.mode !== 'relay' || !match.relayTeams) return null;
    if (match.relayTeams.blue.playerIds.includes(viewerId)) return match.relayTeams.blue;
    if (match.relayTeams.red.playerIds.includes(viewerId)) return match.relayTeams.red;
    return null;
  }, [match.mode, match.relayTeams, viewerId]);

  const isMyRelayTurn = match.mode !== 'relay' || myRelayTeam?.activeTurnPlayerId === viewerId;
  const canPlay =
    match.status === 'playing' &&
    !self.completed &&
    !self.forfeited &&
    !self.timedOut &&
    isMyRelayTurn;

  // Build candidate word from currentWord + stagedReplacements
  const candidateWord = useMemo(() => {
    const chars = self.currentWord.split('');
    for (const [idxStr, letter] of Object.entries(stagedReplacements)) {
      const idx = Number(idxStr);
      if (idx >= 0 && idx < chars.length && letter) {
        chars[idx] = letter;
      }
    }
    return chars.join('');
  }, [self.currentWord, stagedReplacements]);

  const stagedChangedCount = useMemo(() => {
    let diff = 0;
    for (let i = 0; i < wordLen; i++) {
      if (candidateWord[i] !== self.currentWord[i]) diff++;
    }
    return diff;
  }, [candidateWord, self.currentWord, wordLen]);

  const handleSelectTile = (idx: number) => {
    if (!canPlay) return;
    if (lockedPositions.has(idx)) {
      setFeedback({ text: `Slot #${idx + 1} is locked.`, kind: 'err' });
      return;
    }
    setSelectedIdx(idx);
  };

  const handleLetterInput = (rawLetter: string) => {
    if (!canPlay) return;
    const ch = rawLetter.toUpperCase();
    if (!/^[A-Z]$/.test(ch)) return;
    if (lockedPositions.has(selectedIdx)) {
      setFeedback({ text: `Slot #${selectedIdx + 1} is locked.`, kind: 'err' });
      return;
    }
    if (ch === self.currentWord[selectedIdx]) {
      setStagedReplacements((prev) => {
        const next = { ...prev };
        delete next[selectedIdx];
        return next;
      });
      return;
    }

    setStagedReplacements((prev) => {
      if (hasDoubleShift) {
        const next = { ...prev, [selectedIdx]: ch };
        const keys = Object.keys(next).map(Number);
        if (keys.length > 2) {
          const oldest = keys.find((k) => k !== selectedIdx);
          if (oldest !== undefined) delete next[oldest];
        }
        return next;
      }
      return { [selectedIdx]: ch };
    });
    setFeedback(null);
  };

  const handleBackspace = () => {
    if (!canPlay) return;
    setStagedReplacements((prev) => {
      if (prev[selectedIdx]) {
        const next = { ...prev };
        delete next[selectedIdx];
        return next;
      }
      return {};
    });
  };

  const handleSubmit = async () => {
    if (!canPlay || submitting || stagedChangedCount === 0) return;

    // Instant client-side feedback check (server remains authoritative)
    const clientData = getCachedChangeItClientData();
    if (clientData) {
      const usedSet = new Set([self.startWord, ...self.history.map((h) => h.word)]);
      const preCheck = validateMoveTransformation({
        currentWord: self.currentWord,
        submittedWord: candidateWord,
        targetWord: self.targetWord,
        usedWords: usedSet,
        validationSet: clientData.validationSet,
        restrictions: self.restrictions,
        lastChangedIndex: self.lastChangedIndex,
        allowDoubleShift: hasDoubleShift,
        extraLockedPositions: lockedPositions,
      });
      if (!preCheck.valid && preCheck.errorCode === 'WRONG_LETTER_DIFF') {
        setFeedback({ text: preCheck.message, kind: 'err' });
        setShake(true);
        window.setTimeout(() => setShake(false), 320);
        return;
      }
    }

    setSubmitting(true);
    const reqId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    try {
      const res = await onSubmitTransform(candidateWord, reqId);
      if (res.accepted) {
        setStagedReplacements({});
        setFeedback({ text: res.message, kind: 'ok' });
      } else {
        setFeedback({ text: res.message, kind: 'err' });
        setShake(true);
        window.setTimeout(() => setShake(false), 320);
      }
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Submission failed.', kind: 'err' });
      setShake(true);
      window.setTimeout(() => setShake(false), 320);
    } finally {
      setSubmitting(false);
    }
  };

  // Physical keyboard support (A-Z, ArrowLeft, ArrowRight, Backspace, Enter)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedIdx((i) => (i - 1 + wordLen) % wordLen);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedIdx((i) => (i + 1) % wordLen);
      } else if (e.key === 'Backspace' || e.key === 'Escape') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        handleLetterInput(e.key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Trigger sync when match timer hits 0
  const expiredSyncTriggeredRef = useRef(false);
  useEffect(() => {
    if (match.status !== 'playing' || !onSyncMatch) return;
    if (effectiveNow >= match.endsAtMs && !expiredSyncTriggeredRef.current) {
      expiredSyncTriggeredRef.current = true;
      onSyncMatch().catch(() => undefined);
    }
  }, [effectiveNow, match.endsAtMs, match.status, onSyncMatch]);

  const isUntimedSolo =
    match.mode === 'solo_adventure' ||
    (match.mode === 'solo_classic' && match.endsAtMs - match.startedAtMs >= 20 * 60 * 1000);
  const remainingClockMs =
    match.mode === 'survival' && self.playerDeadlineMs !== null
      ? Math.max(0, self.playerDeadlineMs - effectiveNow)
      : isUntimedSolo
        ? effectiveNow - match.startedAtMs
        : Math.max(0, match.endsAtMs - effectiveNow);

  const isFinished = match.status === 'finished';
  const didWin = match.winnerIds.includes(viewerId);
  const isDraw = isFinished && match.winnerIds.length === 0;

  return (
    <div className="ci-gameplay-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <div className="ci-arena-inner">
        {/* TOP BAR: Mode, Timer, Controls */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="ci-icon-btn"
            onClick={onExit}
            aria-label="Exit match"
          >
            <ArrowLeft size={17} strokeWidth={2.8} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span className="ci-pill is-cyan">
              {match.stageTitle
                ? match.stageTitle
                : match.mode.replace(/_/g, ' ').toUpperCase()}
              {match.isRanked ? ' • RANKED' : ''}
            </span>
            <span className={`ci-pill ${remainingClockMs < 15000 && !isUntimedSolo ? 'is-amber' : ''}`}>
              <Clock size={12} />
              <span>
                {isUntimedSolo
                  ? formatClock(self.elapsedMs || remainingClockMs)
                  : formatClock(remainingClockMs)}
              </span>
            </span>
          </div>

          {match.mode === 'solo_adventure' && onRetryAdventure ? (
            <button
              type="button"
              className="ci-icon-btn"
              onClick={onRetryAdventure}
              aria-label="Retry level"
              title="Retry level"
            >
              <RotateCcw size={15} />
            </button>
          ) : match.status === 'playing' && onForfeit ? (
            <button
              type="button"
              className="ci-icon-btn"
              onClick={onForfeit}
              aria-label="Forfeit match"
              title="Forfeit match"
            >
              <Flag size={15} />
            </button>
          ) : (
            <div style={{ width: 36 }} />
          )}
        </header>

        {/* OPPONENT / RELAY PROGRESS BAR */}
        {match.mode === 'relay' && match.relayTeams ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
              flexShrink: 0,
            }}
          >
            {(['blue', 'red'] as const).map((tid) => {
              const t = match.relayTeams![tid];
              const isMine = t.playerIds.includes(viewerId);
              const activeName =
                t.activeTurnPlayerId === viewerId
                  ? 'YOU'
                  : match.opponents.find((o) => o.playerId === t.activeTurnPlayerId)?.username ??
                    'Teammate';
              return (
                <div
                  key={tid}
                  style={{
                    padding: '5px 8px',
                    borderRadius: 12,
                    background:
                      tid === 'blue' ? 'rgba(30, 64, 175, 0.55)' : 'rgba(157, 23, 77, 0.55)',
                    border: isMine ? '1.5px solid #22d3ee' : '1px solid rgba(255,255,255,0.2)',
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      {tid.toUpperCase()} {isMine ? '(YOUR TEAM)' : ''}
                    </span>
                    <span>{t.validMoves} moves</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: '#a5f3fc', marginTop: 2 }}>
                    Turn: <strong>{activeName}</strong>
                    {t.turnDeadlineMs ? ` • ${formatClock(t.turnDeadlineMs - effectiveNow)}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        ) : match.opponents.length > 0 ? (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0 }}>
            {match.opponents.map((opp) => (
              <div
                key={opp.playerId}
                style={{
                  flex: 1,
                  minWidth: 135,
                  padding: '5px 8px',
                  borderRadius: 12,
                  background: 'rgba(12, 22, 82, 0.78)',
                  border: opp.completed
                    ? '1px solid #34d399'
                    : '1px solid rgba(103, 232, 249, 0.25)',
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opp.username}
                  </span>
                  <span style={{ color: opp.completed ? '#6ee7b7' : '#a5f3fc' }}>
                    {opp.completed
                      ? `Done (${opp.validMoves})`
                      : opp.forfeited
                        ? 'Forfeit'
                        : match.mode === 'survival'
                          ? `${opp.puzzlesCompleted} solved`
                          : `${opp.validMoves} moves`}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    height: 5,
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.12)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${opp.progressPercent}%`,
                      height: '100%',
                      background: opp.completed
                        ? '#10b981'
                        : 'linear-gradient(90deg, #22d3ee, #a855f7)',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* PUZZLE ENDPOINTS (Target always visible!) */}
        <div className="ci-endpoints-bar">
          <div className="ci-endpoint-box">
            <span className="ci-endpoint-lbl">Start Word</span>
            <span className="ci-endpoint-word">{self.startWord}</span>
          </div>
          <ArrowRight size={18} color="#22d3ee" strokeWidth={2.8} />
          <div className="ci-endpoint-box is-target">
            <span className="ci-endpoint-lbl">Target Word</span>
            <span className="ci-endpoint-word">{self.targetWord}</span>
          </div>
        </div>

        {/* STATS & RESTRICTIONS */}
        <div className="ci-stats-strip">
          <span>Moves: {self.validMoves}</span>
          <span>Min: {self.minMoves}</span>
          <span>Eff: {self.efficiencyPercent}%</span>
          <span>Invalid: {self.invalidAttempts}</span>
          {match.mode === 'survival' && (
            <span style={{ color: '#fde047' }}>Solved: {self.puzzlesCompleted}</span>
          )}
        </div>

        {(self.restrictions.lockedPositions.length > 0 ||
          self.restrictions.forbiddenLetters.length > 0 ||
          self.restrictions.noConsecutiveSamePosition ||
          self.activeModifiers.length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, flexShrink: 0 }}>
            {self.restrictions.lockedPositions.map((pos) => (
              <span key={`lock_${pos}`} className="ci-pill is-amber">
                <Lock size={11} /> Slot #{pos + 1} Locked
              </span>
            ))}
            {self.restrictions.forbiddenLetters.length > 0 && (
              <span className="ci-pill is-amber">
                No {self.restrictions.forbiddenLetters.join(', ')}
              </span>
            )}
            {self.restrictions.noConsecutiveSamePosition && (
              <span className="ci-pill is-violet">No Repeat Slot</span>
            )}
            {self.activeModifiers.map((am) => (
              <span key={am.id} className="ci-pill is-cyan">
                {modifierIcon(am.type)}
                <span>
                  {MODIFIER_CATALOG[am.type].shortLabel}
                  {am.expiresAtMs ? ` (${Math.max(1, Math.ceil((am.expiresAtMs - effectiveNow) / 1000))}s)` : ''}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* TRANSFORMATION HISTORY */}
        <div className="ci-history-scroll" aria-label="Transformation history">
          <div className="ci-history-row" style={{ opacity: 0.85 }}>
            <span className="ci-history-step-num">#0</span>
            <div className="ci-mini-tiles">
              {self.startWord.split('').map((ch, idx) => (
                <span key={idx} className="ci-mini-tile">
                  {ch}
                </span>
              ))}
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#93c5fd' }}>START</span>
          </div>

          {self.history.map((step, sIdx) => {
            const changedSet = new Set(step.changedIndices);
            return (
              <div key={`${sIdx}_${step.word}`} className="ci-history-row">
                <span className="ci-history-step-num">#{sIdx + 1}</span>
                <div className="ci-mini-tiles">
                  {step.word.split('').map((ch, cIdx) => (
                    <span
                      key={cIdx}
                      className={`ci-mini-tile ${changedSet.has(cIdx) ? 'is-changed' : ''}`}
                    >
                      {ch}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: '#6ee7b7' }}>
                  {step.usedDoubleShift ? '2×' : '✓'}
                </span>
              </div>
            );
          })}
          <div ref={historyEndRef} />
        </div>

        {/* ACTIVE TRANSFORMATION TILES */}
        <div className={`ci-active-stage ${shake ? 'is-shake' : ''}`}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#bae6fd', textAlign: 'center' }}>
            {self.completed && match.mode === 'classic_precision'
              ? 'Solved! Waiting for opponents to finish...'
              : !isMyRelayTurn
                ? `Waiting for teammate's move...`
                : hasDoubleShift
                  ? 'Double Shift Active — Tap slots & pick up to 2 letters'
                  : 'Tap a letter tile, pick a replacement letter, then press GO'}
          </div>

          <div className="ci-tiles-row">
            {candidateWord.split('').map((ch, idx) => {
              const isLocked = lockedPositions.has(idx);
              const isSelected = idx === selectedIdx && canPlay;
              const isStaged = ch !== self.currentWord[idx];
              const matchesTarget = ch === self.targetWord[idx];

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!canPlay}
                  onClick={() => handleSelectTile(idx)}
                  className={`ci-letter-tile ${isLocked ? 'is-locked' : ''} ${
                    isSelected ? 'is-selected' : ''
                  } ${isStaged ? 'is-staged' : ''} ${matchesTarget ? 'is-target-match' : ''}`}
                  aria-label={`Letter ${idx + 1}: ${ch}${isLocked ? ' locked' : ''}`}
                >
                  {isLocked && (
                    <span className="ci-tile-lock-badge" aria-hidden="true">
                      <Lock size={10} />
                    </span>
                  )}
                  <span>{ch}</span>
                  <span className="ci-tile-idx-badge">{idx + 1}</span>
                </button>
              );
            })}
          </div>

          {(feedback || self.activeHintWord) && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color:
                  feedback?.kind === 'err'
                    ? '#fda4af'
                    : self.activeHintWord
                      ? '#fde68a'
                      : '#6ee7b7',
                textAlign: 'center',
              }}
              role="status"
            >
              {self.activeHintWord
                ? `Hint: Try "${self.activeHintWord}"`
                : feedback?.text}
            </div>
          )}
        </div>

        {/* HINTS & MODIFIERS ACTION ROW */}
        {(match.hintsAllowed || match.modifiersEnabled) && match.status === 'playing' && (
          <div className="ci-modifiers-bar">
            {match.hintsAllowed && onUseHint && (
              <button
                type="button"
                disabled={!canPlay}
                onClick={onUseHint}
                className="ci-mod-chip"
                style={{ borderColor: 'rgba(250, 204, 21, 0.7)' }}
              >
                <Lightbulb size={13} color="#fde047" />
                <span>
                  Hint{match.mode === 'solo_adventure' ? ' (Caps 2★)' : ''}
                </span>
              </button>
            )}

            {match.modifiersEnabled && onActivateModifier && (
              <>
                <span className="ci-pill is-violet">
                  <ShieldAlert size={11} />
                  <span>Charge {self.modifierProgress}/2</span>
                </span>
                {self.heldModifiers.map((modType, mIdx) => {
                  const cd = self.modifierCooldowns[modType] ?? 0;
                  const onCd = effectiveNow < cd;
                  const def = MODIFIER_CATALOG[modType];
                  return (
                    <button
                      key={`${modType}_${mIdx}`}
                      type="button"
                      disabled={!canPlay || onCd}
                      title={def.description}
                      onClick={() =>
                        onActivateModifier(
                          modType,
                          undefined,
                          `mod_${Date.now()}_${mIdx}`
                        )
                      }
                      className="ci-mod-chip"
                    >
                      {modifierIcon(modType)}
                      <span>
                        {def.shortLabel}
                        {onCd ? ` (${Math.ceil((cd - effectiveNow) / 1000)}s)` : ''}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ON-SCREEN KEYBOARD */}
        {!isFinished && (
          <ChangeItKeyboard
            disabled={!canPlay || submitting}
            forbiddenLetters={self.restrictions.forbiddenLetters}
            canSubmit={stagedChangedCount > 0}
            onLetter={handleLetterInput}
            onBackspace={handleBackspace}
            onSubmit={handleSubmit}
          />
        )}
      </div>

      {/* POST-MATCH / VICTORY MODAL */}
      {isFinished && (
        <div className="ens-modal-backdrop">
          <div className="ens-modal-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {match.mode === 'solo_adventure' ? (
              <>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#67e8f9', textTransform: 'uppercase' }}>
                    {match.stageTitle}
                  </div>
                  <h2 style={{ margin: '4px 0', fontSize: 22, fontWeight: 900 }}>
                    {self.completed ? 'Transformation Complete!' : 'Level Ended'}
                  </h2>
                  {self.completed && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '8px 0' }}>
                      {[1, 2, 3].map((s) => {
                        const earned = adventureClaim?.starsEarned ?? (self.validMoves <= self.minMoves && self.hintsUsed === 0 ? 3 : self.validMoves <= self.minMoves + 2 ? 2 : 1);
                        return (
                          <Star
                            key={s}
                            size={28}
                            fill={s <= earned ? '#fde047' : 'rgba(255,255,255,0.16)'}
                            color={s <= earned ? '#fde047' : 'rgba(255,255,255,0.3)'}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="ci-stats-strip" style={{ justifyContent: 'space-around' }}>
                  <span>Moves: {self.validMoves}/{self.minMoves}</span>
                  <span>Eff: {self.efficiencyPercent}%</span>
                  <span>Time: {(self.elapsedMs / 1000).toFixed(1)}s</span>
                </div>

                {adventureClaim && adventureClaim.coinsAwarded > 0 && (
                  <div className="ci-pill is-amber" style={{ justifyContent: 'center', padding: '7px 12px' }}>
                    <Award size={14} />
                    <span>+{adventureClaim.coinsAwarded} Enscribe Coins Earned!</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {onRetryAdventure && (
                    <button type="button" className="ci-pill is-cyan" style={{ justifyContent: 'center', minHeight: 42, cursor: 'pointer' }} onClick={onRetryAdventure}>
                      <RotateCcw size={14} />
                      <span>Replay</span>
                    </button>
                  )}
                  {onNextAdventureStage ? (
                    <button type="button" className="ci-cta-green" onClick={onNextAdventureStage}>
                      <Play size={15} fill="currentColor" />
                      <span>Next Level</span>
                    </button>
                  ) : (
                    <button type="button" className="ci-cta-cyan" onClick={onExit}>
                      <span>Chapters</span>
                    </button>
                  )}
                </div>
                {onNextAdventureStage && (
                  <button
                    type="button"
                    className="ci-pill"
                    style={{ justifyContent: 'center', width: '100%', minHeight: 36, cursor: 'pointer' }}
                    onClick={onExit}
                  >
                    <span>Back to Chapters</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#67e8f9', textTransform: 'uppercase' }}>
                    {match.mode.replace(/_/g, ' ')} {match.isRanked ? '• RANKED' : ''}
                  </div>
                  <h2 style={{ margin: '4px 0', fontSize: 22, fontWeight: 900 }}>
                    {didWin ? 'Victory!' : isDraw ? 'Draw Match!' : 'Match Complete'}
                  </h2>
                  {match.ratingChanges?.[viewerId] && (
                    <div className="ci-pill is-cyan" style={{ marginTop: 4 }}>
                      <span>
                        Rating: {match.ratingChanges[viewerId].after} RP (
                        {match.ratingChanges[viewerId].delta >= 0 ? '+' : ''}
                        {match.ratingChanges[viewerId].delta})
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                  <div className="ci-card" style={{ padding: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 13 }}>
                      <span>You {didWin && '👑'}</span>
                      <span>
                        {match.mode === 'survival'
                          ? `${self.puzzlesCompleted} solved (${self.efficiencyPercent}% eff)`
                          : self.completed
                            ? `${self.validMoves} moves`
                            : 'Incomplete'}
                      </span>
                    </div>
                  </div>
                  {match.opponents.map((opp) => (
                    <div key={opp.playerId} className="ci-card" style={{ padding: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 13 }}>
                        <span>
                          {opp.username} {opp.isWinner && '👑'}
                        </span>
                        <span>
                          {match.mode === 'survival'
                            ? `${opp.puzzlesCompleted} solved (${opp.efficiencyPercent}% eff)`
                            : opp.completed
                              ? `${opp.validMoves} moves`
                              : opp.forfeited
                                ? 'Forfeited'
                                : 'Incomplete'}
                        </span>
                      </div>
                      {opp.revealedHistory && opp.revealedHistory.length > 0 && (
                        <div style={{ fontSize: 10.5, color: '#93c5fd', marginTop: 4 }}>
                          Path: {opp.revealedHistory.map((h) => h.word).join(' → ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: onRematch ? '1fr 1fr' : '1fr', gap: 8 }}>
                  {onRematch && (
                    <button type="button" className="ci-cta-green" onClick={onRematch}>
                      <RotateCcw size={15} />
                      <span>{match.mode === 'solo_classic' ? 'Next Puzzle' : 'Rematch'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="ci-cta-cyan"
                    onClick={onBackToLobby ?? onExit}
                  >
                    <Check size={15} />
                    <span>{onBackToLobby ? 'Back to Lobby' : 'Done'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
