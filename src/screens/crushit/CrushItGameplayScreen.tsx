import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Crown,
  HelpCircle,
  RotateCcw,
  Shuffle,
  Sparkles,
  Star,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  createCrushItGameState,
  evaluateWordPreview,
  manualReshuffleBoard,
  submitWordMove,
} from '../../../shared/crushit/engine';
import { POWER_UP_CONFIG, POWER_UP_ORDER } from '../../../shared/crushit/powerUpConfig';
import { CRUSHIT_TOTAL_STAGES, getCrushItStage } from '../../../shared/crushit/stagesCatalog';
import {
  BoardCoord,
  CrushItGameState,
  CrushItLifecyclePhase,
  CrushItProgressionState,
  CrushItStageResultPayload,
  PowerUpType,
  TurnResolutionEvent,
} from '../../../shared/crushit/types';
import { ActiveTurnFx, CrushItBoard } from '../../games/crushit/CrushItBoard';
import { CrushItDictionaryBundle, loadCrushItDictionary } from '../../games/crushit/dictionary';
import {
  crushItSfx,
  isSfxMuted,
  setSfxMuted,
  subscribeSfxMute,
} from '../../services/soundEffects';

interface CrushItGameplayScreenProps {
  stageNumber: number;
  progression: CrushItProgressionState;
  onBackToStages: () => void;
  onSelectStage: (stageNumber: number) => void;
  onRecordStageResult: (payload: CrushItStageResultPayload) => void;
}

function getCreatedFeedbackLabel(type: PowerUpType): string {
  switch (type) {
    case 'line_blast':
      return 'LINE BLAST CREATED!';
    case 'cross_blast':
      return 'CROSS BLAST CREATED!';
    case 'word_bomb':
      return 'WORD BOMB CREATED!';
    case 'letter_purge':
      return 'LETTER PURGE CREATED!';
    case 'mega_blast':
      return 'MEGA BLAST CREATED!';
  }
}

function getActivatedFeedbackLabel(type: PowerUpType): string {
  switch (type) {
    case 'line_blast':
      return 'LINE BLAST!';
    case 'cross_blast':
      return 'CROSS BLAST!';
    case 'word_bomb':
      return 'WORD BOMB!';
    case 'letter_purge':
      return 'LETTER PURGE!';
    case 'mega_blast':
      return 'MEGA BLAST!';
  }
}

export const CrushItGameplayScreen: React.FC<CrushItGameplayScreenProps> = ({
  stageNumber,
  progression,
  onBackToStages,
  onSelectStage,
  onRecordStageResult,
}) => {
  const [dictBundle, setDictBundle] = useState<CrushItDictionaryBundle | null>(null);
  const [gameState, setGameState] = useState<CrushItGameState | null>(null);
  const [selectedPath, setSelectedPath] = useState<BoardCoord[]>([]);

  // Explicit stage lifecycle tracking (RESOLVING locks input during animation without altering qualification)
  const [isResolving, setIsResolving] = useState(false);
  const [illuminatedCoordKeys, setIlluminatedCoordKeys] = useState<Set<string>>(() => new Set());
  const [destroyingCoordKeys, setDestroyingCoordKeys] = useState<Set<string>>(() => new Set());
  const [fallAnimationKey, setFallAnimationKey] = useState(0);
  const [isReshuffling, setIsReshuffling] = useState(false);
  const [activeTurnFx, setActiveTurnFx] = useState<ActiveTurnFx | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<{
    text: string;
    tone: 'default' | 'chain' | 'qualified';
  } | null>(null);
  const [invalidShake, setInvalidShake] = useState(false);
  const [justCompletedObjIds, setJustCompletedObjIds] = useState<Set<string>>(() => new Set());

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [isNewPersonalBest, setIsNewPersonalBest] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => isSfxMuted());

  const timersRef = useRef<number[]>([]);
  const recordedSessionIdRef = useRef<string | null>(null);
  const initialBestScoreRef = useRef<number>(0);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    return subscribeSfxMute(setMuted);
  }, []);

  useEffect(() => {
    let active = true;
    loadCrushItDictionary().then((bundle) => {
      if (active) setDictBundle(bundle);
    });
    return () => {
      active = false;
    };
  }, []);

  const startFreshStage = useCallback(
    (targetStageNum: number, bundle: CrushItDictionaryBundle) => {
      clearTimers();
      const fresh = createCrushItGameState(targetStageNum, bundle.trie);
      recordedSessionIdRef.current = null;
      initialBestScoreRef.current = progression.stages[targetStageNum]?.bestScore ?? 0;
      setGameState(fresh);
      setSelectedPath([]);
      setIsResolving(false);
      setIlluminatedCoordKeys(new Set());
      setDestroyingCoordKeys(new Set());
      setFallAnimationKey(0);
      setIsReshuffling(false);
      setActiveTurnFx(null);
      setFeedbackNotice(null);
      setShowResultsModal(false);
      setIsNewPersonalBest(false);
      setJustCompletedObjIds(new Set());
    },
    [clearTimers, progression.stages]
  );

  useEffect(() => {
    if (!dictBundle) return;
    startFreshStage(stageNumber, dictBundle);
    return () => clearTimers();
    // Intentionally only restart when dictionary finishes loading or user switches stageNumber
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictBundle, stageNumber]);

  const effectiveLifecycle: CrushItLifecyclePhase = isResolving
    ? 'RESOLVING'
    : gameState?.lifecyclePhase ?? 'PLAYING';

  const wordPreview = useMemo(() => {
    if (!gameState || !dictBundle) {
      return {
        word: '',
        length: 0,
        isValid: false,
        reason: 'empty' as const,
        potentialScore: 0,
        earnedPowerUp: null,
        includedPowerUps: [],
      };
    }
    return evaluateWordPreview(gameState.board, selectedPath, dictBundle.words);
  }, [gameState, dictBundle, selectedPath]);

  /**
   * Finalizes stage outcome ONLY when movesRemaining === 0 AND all animations/chain reactions
   * have completely finished resolving. Never triggers early while moves remain.
   */
  const finalizeTerminalOutcomeIfReady = useCallback(
    (resolvedState: CrushItGameState) => {
      if (resolvedState.lifecyclePhase !== 'VICTORY' && resolvedState.lifecyclePhase !== 'FAILURE') {
        return;
      }
      if (recordedSessionIdRef.current !== resolvedState.sessionId) {
        recordedSessionIdRef.current = resolvedState.sessionId;
        const beatPriorBest =
          resolvedState.score > 0 && resolvedState.score > initialBestScoreRef.current;
        setIsNewPersonalBest(beatPriorBest);

        onRecordStageResult({
          stageNumber: resolvedState.stage.stageNumber,
          completed: resolvedState.lifecyclePhase === 'VICTORY',
          score: resolvedState.score,
          stars: resolvedState.starsEarned,
          movesRemaining: resolvedState.movesRemaining,
          wordsFormed: resolvedState.wordsFormed,
          longestWordLength: resolvedState.longestWordLength,
          powerUpsUsed: resolvedState.powerUpsUsed,
        });
      }

      if (resolvedState.lifecyclePhase === 'VICTORY') {
        crushItSfx.stageWin();
      } else {
        crushItSfx.stageLose();
      }
      setShowResultsModal(true);
    },
    [onRecordStageResult]
  );

  const runTurnResolution = useCallback(
    (nextState: CrushItGameState, event: TurnResolutionEvent) => {
      setIsResolving(true);
      setSelectedPath([]);

      // Compute centroid for floating score popup
      let sumR = 0;
      let sumC = 0;
      for (const dt of event.destroyedTiles) {
        sumR += dt.row;
        sumC += dt.col;
      }
      const denom = Math.max(1, event.destroyedTiles.length);
      const centroidRow =
        event.activations.length > 0 ? event.activations[0].row : sumR / denom;
      const centroidCol =
        event.activations.length > 0 ? event.activations[0].col : sumC / denom;

      // Determine feedback pill text (unobtrusive, above board)
      let notice: { text: string; tone: 'default' | 'chain' | 'qualified' } | null = null;
      if (event.justQualifiedAllObjectives && nextState.movesRemaining > 0) {
        notice = { text: 'OBJECTIVES COMPLETE!', tone: 'qualified' };
      } else if (event.chainReactionSize >= 2) {
        notice = { text: `CHAIN REACTION ×${event.chainReactionSize}!`, tone: 'chain' };
      } else if (event.activations.length === 1) {
        notice = { text: getActivatedFeedbackLabel(event.activations[0].type), tone: 'chain' };
      } else if (event.createdPowerUp) {
        notice = {
          text: getCreatedFeedbackLabel(event.createdPowerUp.powerUp.type),
          tone: 'default',
        };
      } else if (
        nextState.score > initialBestScoreRef.current &&
        initialBestScoreRef.current > 0 &&
        nextState.score - event.scoreGained <= initialBestScoreRef.current
      ) {
        notice = { text: 'NEW PERSONAL BEST!', tone: 'qualified' };
      }

      if (notice) {
        setFeedbackNotice(notice);
        schedule(() => setFeedbackNotice(null), 1350);
      }

      // Brief illumination preview for Letter Purge / Mega Blast before destruction pop
      const needsPreIlluminate = event.activations.some(
        (a) => a.type === 'letter_purge' || a.type === 'mega_blast'
      );
      const preDelayMs = needsPreIlluminate ? 160 : 0;

      if (needsPreIlluminate) {
        const illumSet = new Set<string>();
        for (const a of event.activations) {
          for (const c of a.affectedCoords) illumSet.add(`${c.row},${c.col}`);
        }
        setIlluminatedCoordKeys(illumSet);
      }

      const startDestructionPhase = () => {
        setIlluminatedCoordKeys(new Set());
        const destroySet = new Set(event.destroyedTiles.map((d) => `${d.row},${d.col}`));
        setDestroyingCoordKeys(destroySet);
        setActiveTurnFx({
          id: `fx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          activations: event.activations,
          destroyedTiles: event.destroyedTiles,
          scoreGained: event.scoreGained,
          centroidRow,
          centroidCol,
        });

        if (event.activations.length > 0) {
          const hasMega = event.activations.some((a) => a.type === 'mega_blast');
          crushItSfx.powerUpBlast(hasMega);
        } else {
          crushItSfx.wordValid(event.word?.length ?? 3);
        }

        if (event.createdPowerUp) {
          schedule(() => crushItSfx.powerUpEarned(), 110);
        }

        const destroyDurationMs = event.chainReactionSize >= 2 ? 320 : 250;

        // Phase 2: Gravity & weighted replenishment
        schedule(() => {
          setDestroyingCoordKeys(new Set());
          setGameState(nextState);
          setFallAnimationKey((k) => k + 1);

          if (event.newlyCompletedObjectiveIds.length > 0) {
            crushItSfx.objectiveComplete();
            setJustCompletedObjIds(new Set(event.newlyCompletedObjectiveIds));
            schedule(() => setJustCompletedObjIds(new Set()), 650);
          }

          // Phase 3: Automatic dead-board reshuffle (if triggered)
          if (event.autoReshuffled) {
            schedule(() => {
              setIsReshuffling(true);
              setFeedbackNotice({ text: 'NO PLAYABLE WORDS — RESHUFFLING!', tone: 'default' });
              crushItSfx.reshuffle();

              schedule(() => {
                setIsReshuffling(false);
                setFeedbackNotice(null);
                setActiveTurnFx(null);
                setIsResolving(false);
                finalizeTerminalOutcomeIfReady(nextState);
              }, 500);
            }, 340);
          } else {
            schedule(() => {
              setActiveTurnFx(null);
              setIsResolving(false);
              finalizeTerminalOutcomeIfReady(nextState);
            }, 360);
          }
        }, destroyDurationMs);
      };

      if (preDelayMs > 0) {
        schedule(startDestructionPhase, preDelayMs);
      } else {
        startDestructionPhase();
      }
    },
    [finalizeTerminalOutcomeIfReady, schedule]
  );

  const handleSubmitWord = useCallback(() => {
    if (!gameState || !dictBundle || isResolving) return;
    if (gameState.lifecyclePhase === 'VICTORY' || gameState.lifecyclePhase === 'FAILURE') return;
    if (selectedPath.length === 0) return;

    const result = submitWordMove(gameState, selectedPath, dictBundle.words, dictBundle.trie);
    if (!result.accepted || !result.event) {
      crushItSfx.wordInvalid();
      setInvalidShake(true);
      schedule(() => setInvalidShake(false), 360);
      return;
    }

    runTurnResolution(result.state, result.event);
  }, [gameState, dictBundle, isResolving, selectedPath, runTurnResolution, schedule]);

  const handleManualReshuffle = useCallback(() => {
    if (!gameState || !dictBundle || isResolving) return;
    if (gameState.lifecyclePhase === 'VICTORY' || gameState.lifecyclePhase === 'FAILURE') return;
    if (gameState.manualShufflesRemaining <= 0) return;

    const res = manualReshuffleBoard(gameState, dictBundle.trie);
    if (!res.accepted) return;

    setSelectedPath([]);
    setIsResolving(true);
    setIsReshuffling(true);
    setFeedbackNotice({ text: 'BOARD RESHUFFLED!', tone: 'default' });
    crushItSfx.reshuffle();

    schedule(() => {
      setGameState(res.state);
      schedule(() => {
        setIsReshuffling(false);
        setFeedbackNotice(null);
        setIsResolving(false);
      }, 280);
    }, 200);
  }, [gameState, dictBundle, isResolving, schedule]);

  const handlePathChange = useCallback(
    (nextPath: BoardCoord[], action: 'select' | 'undo' | 'start') => {
      setSelectedPath(nextPath);
      if (action === 'undo') {
        crushItSfx.tileUndo();
      } else if (nextPath.length > 0) {
        crushItSfx.tileSelect(nextPath.length - 1);
      }
    },
    []
  );

  // Keyboard shortcuts for desktop players
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showHelpModal) {
        if (e.key === 'Escape') setShowHelpModal(false);
        return;
      }
      if (showResultsModal) return;
      if (e.key === 'Escape' && selectedPath.length > 0) {
        setSelectedPath([]);
      } else if (e.key === 'Enter' && selectedPath.length >= 3) {
        handleSubmitWord();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showHelpModal, showResultsModal, selectedPath, handleSubmitWord]);

  // Live unobtrusive hint pill above board when swiping a power-up word or power-up tiles
  const liveSwipePill = useMemo(() => {
    if (feedbackNotice) return feedbackNotice;
    if (!wordPreview.isValid) return null;
    if (wordPreview.earnedPowerUp && wordPreview.includedPowerUps.length > 0) {
      const puDef = POWER_UP_CONFIG[wordPreview.earnedPowerUp];
      return {
        text: `${wordPreview.length}-letter word → ${puDef.shortName} + ${wordPreview.includedPowerUps.length} Blast${wordPreview.includedPowerUps.length > 1 ? 's' : ''}`,
        tone: 'chain' as const,
      };
    }
    if (wordPreview.earnedPowerUp) {
      const puDef = POWER_UP_CONFIG[wordPreview.earnedPowerUp];
      return {
        text: `${wordPreview.length}-letter word → ${puDef.shortName}`,
        tone: 'default' as const,
      };
    }
    if (wordPreview.includedPowerUps.length > 0) {
      return {
        text: `Triggers ${wordPreview.includedPowerUps.length} Power-Up${wordPreview.includedPowerUps.length > 1 ? 's' : ''}!`,
        tone: 'chain' as const,
      };
    }
    return null;
  }, [feedbackNotice, wordPreview]);

  if (!gameState) {
    return (
      <div className="ci6-play-shell">
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: '#c7d2fe',
            fontWeight: 800,
          }}
        >
          <Sparkles size={28} color="#f472b6" />
          <span>Preparing CrushIt Stage {stageNumber}...</span>
        </div>
      </div>
    );
  }

  const stage = gameState.stage;
  const isQualified = gameState.objectivesComplete && gameState.movesRemaining > 0;
  const isTerminal =
    gameState.lifecyclePhase === 'VICTORY' || gameState.lifecyclePhase === 'FAILURE';
  const hasNextStage = stage.stageNumber < CRUSHIT_TOTAL_STAGES;
  const nextStageConfig = hasNextStage ? getCrushItStage(stage.stageNumber + 1) : null;
  const displayBestScore = Math.max(
    progression.stages[stage.stageNumber]?.bestScore ?? 0,
    gameState.score
  );

  return (
    <div className="ci6-play-shell" data-lifecycle={effectiveLifecycle}>
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <div className="ci6-play-inner">
        {/* TOP BRAND BAR */}
        <header className="ci6-topbar">
          <div className="ci6-topbar-left">
            <button
              type="button"
              className="ci6-icon-btn"
              onClick={onBackToStages}
              aria-label="Back to CrushIt stages"
            >
              <ArrowLeft size={18} strokeWidth={2.8} />
            </button>

            <div className="ci6-brand-lockup">
              <img src="/art/brand-en-crown.png" alt="" className="ci6-brand-crown" />
              <div className="ci6-brand-text">
                <span className="ci6-brand-enscribe">Enscribe</span>
                <span className="ci6-brand-title">CrushIt</span>
              </div>
            </div>
          </div>

          <div className="ci6-topbar-right">
            <button
              type="button"
              className="ci6-icon-btn"
              disabled={isResolving || isTerminal || gameState.manualShufflesRemaining <= 0}
              onClick={handleManualReshuffle}
              aria-label={`Shuffle board, ${gameState.manualShufflesRemaining} remaining`}
              title={`Shuffle Board (${gameState.manualShufflesRemaining} free left)`}
            >
              <Shuffle size={15} />
              <span className="ci6-icon-badge">{gameState.manualShufflesRemaining}</span>
            </button>
            <button
              type="button"
              className="ci6-icon-btn"
              onClick={() => setSfxMuted(!muted)}
              aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
              title={muted ? 'Sound Muted' : 'Sound On'}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button
              type="button"
              className="ci6-icon-btn"
              onClick={() => setShowHelpModal(true)}
              aria-label="CrushIt rules and guide"
              title="How to Play CrushIt"
            >
              <HelpCircle size={17} />
            </button>
          </div>
        </header>

        {/* STATS STRIP: Stage | Score | Remaining Moves */}
        <section className="ci6-stats-strip" aria-label="Stage status">
          <div className="ci6-stat-box">
            <span className="ci6-stat-label">Stage</span>
            <span className="ci6-stat-val is-gold">{stage.stageNumber}</span>
          </div>
          <div className="ci6-stat-box">
            <span className="ci6-stat-label">
              <Trophy size={11} color="#fde047" /> Score
            </span>
            <span className="ci6-stat-val">{gameState.score.toLocaleString()}</span>
          </div>
          <div
            className={`ci6-stat-box ${
              gameState.movesRemaining <= 3
                ? 'is-moves-critical'
                : gameState.movesRemaining <= 6
                  ? 'is-moves-low'
                  : ''
            }`}
            aria-label={`${gameState.movesRemaining} moves remaining`}
          >
            <span className="ci6-stat-label">Moves</span>
            <span className="ci6-stat-val">{gameState.movesRemaining}</span>
          </div>
        </section>

        {/* FULL-WIDTH STAGE OBJECTIVE AREA (Transforms into QUALIFIED state when complete!) */}
        <section
          className={`ci6-goal-bar ${gameState.objectivesComplete ? 'is-qualified' : ''}`}
          aria-label="Stage objectives"
        >
          {isQualified ? (
            <>
              <div className="ci6-qualified-banner" role="status" aria-live="polite">
                <CheckCircle2 size={15} color="#fef08a" strokeWidth={2.8} />
                <span>OBJECTIVES COMPLETE — NEXT STAGE QUALIFIED</span>
              </div>
              <div className="ci6-qualified-sub">
                Keep playing your remaining {gameState.movesRemaining} move
                {gameState.movesRemaining === 1 ? '' : 's'} to boost your score!
              </div>
            </>
          ) : (
            <div className="ci6-objectives-row">
              {gameState.objectives.map((obj) => (
                <div
                  key={obj.id}
                  className={`ci6-obj-chip ${obj.completed ? 'is-done' : ''} ${
                    justCompletedObjIds.has(obj.id) ? 'is-just-done' : ''
                  }`}
                  title={obj.label}
                >
                  {obj.completed ? (
                    <CheckCircle2 size={13} color="#6ee7b7" strokeWidth={2.8} />
                  ) : (
                    <Target size={12} color="#fde047" />
                  )}
                  <span>{obj.shortLabel}</span>
                  <strong style={{ color: obj.completed ? '#a7f3d0' : '#fde047' }}>
                    {Math.min(obj.current, obj.target).toLocaleString()}/
                    {obj.target.toLocaleString()}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* UNOBTRUSIVE POWER-UP / CHAIN FEEDBACK SLOT */}
        <div className="ci6-context-slot" aria-live="polite">
          {liveSwipePill && (
            <div
              className={`ci6-context-pill ${
                liveSwipePill.tone === 'chain'
                  ? 'is-chain'
                  : liveSwipePill.tone === 'qualified'
                    ? 'is-qualified'
                    : ''
              }`}
            >
              <Sparkles size={12} />
              <span>{liveSwipePill.text}</span>
            </div>
          )}
        </div>

        {/* CENTER HERO: MAXIMIZED 8x8 INTEGRATED POWER-UP BOARD */}
        <CrushItBoard
          board={gameState.board}
          selectedPath={selectedPath}
          isValidWord={wordPreview.isValid}
          hasPowerUpReward={Boolean(
            wordPreview.isValid &&
              (wordPreview.earnedPowerUp || wordPreview.includedPowerUps.length > 0)
          )}
          isLocked={isResolving || isTerminal}
          isReshuffling={isReshuffling}
          illuminatedCoordKeys={illuminatedCoordKeys}
          destroyingCoordKeys={destroyingCoordKeys}
          fallAnimationKey={fallAnimationKey}
          activeTurnFx={activeTurnFx}
          onPathChange={handlePathChange}
        />

        {/* BOTTOM SECTION: Word Preview + Score + Cancel / Submit (NO inventory toolbar!) */}
        <section
          className={`ci6-bottom-dock ${invalidShake ? 'is-invalid-shake' : ''}`}
          aria-label="Word submission controls"
        >
          <div className="ci6-word-preview-row">
            <div className="ci6-word-left">
              <span
                className={`ci6-word-text ${selectedPath.length === 0 ? 'is-placeholder' : ''}`}
              >
                {wordPreview.word || 'Swipe adjacent tiles'}
              </span>

              {selectedPath.length > 0 && wordPreview.reason === 'too_short' && (
                <span className="ci6-status-pill is-invalid">Need 3+</span>
              )}
              {selectedPath.length > 0 && wordPreview.reason === 'not_in_dictionary' && (
                <span className="ci6-status-pill is-invalid">Not a word</span>
              )}
              {wordPreview.isValid && <span className="ci6-status-pill is-valid">Valid</span>}
            </div>

            <div className="ci6-word-right">
              {wordPreview.isValid ? (
                <>
                  <span className="ci6-word-score-num">
                    +{wordPreview.potentialScore.toLocaleString()}
                  </span>
                  <span className="ci6-word-score-lbl">Word Score</span>
                </>
              ) : (
                <span className="ci6-word-score-lbl">3+ letters • 8 dirs</span>
              )}
            </div>
          </div>

          <div className="ci6-actions-row">
            <button
              type="button"
              className="ci6-btn-cancel"
              disabled={isResolving || selectedPath.length === 0}
              onClick={() => {
                setSelectedPath([]);
                crushItSfx.tileUndo();
              }}
              aria-label="Cancel word selection"
            >
              <X size={17} strokeWidth={2.8} />
              <span>Cancel</span>
            </button>

            <button
              type="button"
              className={`ci6-btn-submit ${wordPreview.isValid ? 'is-ready' : ''}`}
              disabled={isResolving || selectedPath.length === 0 || isTerminal}
              onClick={handleSubmitWord}
              aria-label="Submit word"
            >
              <span>Submit</span>
            </button>
          </div>
        </section>
      </div>

      {/* OPTIONAL HELP DIALOG */}
      {showHelpModal && (
        <div
          className="ci6-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="How to play CrushIt"
          onClick={() => setShowHelpModal(false)}
        >
          <div className="ci6-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 19, fontWeight: 900 }}>How to Play CrushIt</div>
              <button
                type="button"
                className="ci6-icon-btn"
                onClick={() => setShowHelpModal(false)}
                aria-label="Close guide"
              >
                <X size={17} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, color: '#dbeafe', fontWeight: 700 }}>
              Swipe adjacent tiles in any of the 8 directions to form English words (3+ letters).
              Longer words transform their final letter into a glowing Power-Up Tile right on the
              board! Include any Power-Up Tile in a future valid word to automatically blast and
              trigger chain reactions. Play through all allocated moves to maximize your final score!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#fde047', textTransform: 'uppercase' }}>
                Ordinary Letter Colors
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11.5, fontWeight: 800 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span className="ci6-guide-swatch ci6-tile--pink">A</span>
                  <span>Pink: Vowels</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span className="ci6-guide-swatch ci6-tile--blue">T</span>
                  <span>Blue: Common</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span className="ci6-guide-swatch ci6-tile--green">G</span>
                  <span>Green: Uncommon</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span className="ci6-guide-swatch ci6-tile--gold">Z</span>
                  <span>Gold: Rare (High Pts)</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#fde047', textTransform: 'uppercase' }}>
                Integrated Power-Up Tiles
              </div>
              {POWER_UP_ORDER.map((puType) => {
                const def = POWER_UP_CONFIG[puType];
                const swatchCls =
                  puType === 'line_blast'
                    ? 'ci6-tile--pu-line-row'
                    : puType === 'cross_blast'
                      ? 'ci6-tile--pu-cross'
                      : puType === 'word_bomb'
                        ? 'ci6-tile--pu-bomb'
                        : puType === 'letter_purge'
                          ? 'ci6-tile--pu-purge'
                          : 'ci6-tile--pu-mega';
                const sampleCh =
                  puType === 'line_blast'
                    ? 'T'
                    : puType === 'cross_blast'
                      ? 'E'
                      : puType === 'word_bomb'
                        ? 'N'
                        : puType === 'letter_purge'
                          ? 'R'
                          : 'A';
                return (
                  <div
                    key={puType}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 9px',
                      borderRadius: 11,
                      background: 'rgba(10, 16, 68, 0.72)',
                      border: '1px solid rgba(165, 180, 252, 0.24)',
                      fontSize: 11.5,
                    }}
                  >
                    <span className={`ci6-guide-swatch ${swatchCls}`}>{sampleCh}</span>
                    <div style={{ minWidth: 0 }}>
                      <strong>
                        {def.minWordLength === 8 ? '8+' : def.minWordLength} Letters — {def.name}:
                      </strong>{' '}
                      <span style={{ color: '#c7d2fe' }}>{def.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="ci6-cta-primary"
              onClick={() => setShowHelpModal(false)}
            >
              Got It!
            </button>
          </div>
        </div>
      )}

      {/* FINAL STAGE RESULTS MODAL (Displayed ONLY when moves === 0 and resolution finished) */}
      {showResultsModal && isTerminal && (
        <div
          className="ci6-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={
            gameState.lifecyclePhase === 'VICTORY'
              ? stage.stageNumber === CRUSHIT_TOTAL_STAGES
                ? 'CrushIt Mastery Complete'
                : 'Stage Complete'
              : 'Stage Failed'
          }
        >
          <div className="ci6-modal-card">
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: gameState.lifecyclePhase === 'VICTORY' ? '#6ee7b7' : '#fda4af',
                }}
              >
                Stage {stage.stageNumber} of {CRUSHIT_TOTAL_STAGES} • {stage.title}
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 2 }}>
                {gameState.lifecyclePhase === 'VICTORY'
                  ? stage.stageNumber === CRUSHIT_TOTAL_STAGES
                    ? 'CrushIt Mastered!'
                    : 'Stage Complete!'
                  : 'Stage Incomplete'}
              </div>
              {gameState.lifecyclePhase === 'VICTORY' &&
                stage.stageNumber === CRUSHIT_TOTAL_STAGES && (
                  <div
                    style={{
                      marginTop: 4,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#fde047',
                    }}
                  >
                    <Crown size={15} />
                    <span>All 50 Single-Player Stages Conquered!</span>
                  </div>
                )}
            </div>

            {gameState.lifecyclePhase === 'VICTORY' && (
              <div className="ci6-stars-row" aria-label={`${gameState.starsEarned} of 3 stars`}>
                {[1, 2, 3].map((n) => {
                  const earned = n <= gameState.starsEarned;
                  return (
                    <Star
                      key={n}
                      size={n === 2 ? 40 : 32}
                      fill={earned ? '#fde047' : 'rgba(255,255,255,0.12)'}
                      color={earned ? '#fde047' : 'rgba(255,255,255,0.3)'}
                      className={earned ? 'ci6-star-earned' : undefined}
                      style={{ animationDelay: `${n * 110}ms` }}
                    />
                  );
                })}
              </div>
            )}

            {/* Final Score + Personal Best Callout */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 15,
                background: 'rgba(10, 16, 68, 0.78)',
                border: isNewPersonalBest
                  ? '1.5px solid rgba(253, 224, 71, 0.85)'
                  : '1px solid rgba(165, 180, 252, 0.3)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 900, color: '#a5b4fc', textTransform: 'uppercase' }}>
                Final Total Score
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#fde047', lineHeight: 1.1 }}>
                {gameState.score.toLocaleString()}
              </div>
              <div
                style={{
                  marginTop: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 900,
                  color: isNewPersonalBest ? '#6ee7b7' : '#fde68a',
                }}
              >
                <Trophy size={13} />
                <span>
                  {isNewPersonalBest
                    ? 'NEW PERSONAL BEST!'
                    : `Personal Best: ${displayBestScore.toLocaleString()}`}
                </span>
              </div>
            </div>

            {/* Full Stage Performance Records */}
            <div className="ci6-results-grid">
              <div className="ci6-result-stat">
                <div className="ci6-result-stat-val" style={{ color: '#67e8f9' }}>
                  {gameState.wordsFormed}
                </div>
                <div className="ci6-result-stat-lbl">Valid Words</div>
              </div>
              <div className="ci6-result-stat">
                <div className="ci6-result-stat-val" style={{ color: '#f9a8d4' }}>
                  {gameState.longestWordLength > 0 ? `${gameState.longestWordLength} ltr` : '—'}
                </div>
                <div className="ci6-result-stat-lbl">Longest Word</div>
              </div>
              <div className="ci6-result-stat">
                <div className="ci6-result-stat-val" style={{ color: '#6ee7b7' }}>
                  {gameState.tilesDestroyed}
                </div>
                <div className="ci6-result-stat-lbl">Tiles Crushed</div>
              </div>
              <div className="ci6-result-stat">
                <div className="ci6-result-stat-val" style={{ color: '#c4b5fd' }}>
                  {gameState.powerUpsCreated}
                </div>
                <div className="ci6-result-stat-lbl">PU Created</div>
              </div>
              <div className="ci6-result-stat">
                <div className="ci6-result-stat-val" style={{ color: '#fdba74' }}>
                  {gameState.powerUpsUsed}
                </div>
                <div className="ci6-result-stat-lbl">PU Activated</div>
              </div>
              <div className="ci6-result-stat">
                <div className="ci6-result-stat-val" style={{ color: '#fde047' }}>
                  {gameState.largestChainReaction > 0 ? `×${gameState.largestChainReaction}` : '—'}
                </div>
                <div className="ci6-result-stat-lbl">Max Chain</div>
              </div>
            </div>

            {/* Objective Completion Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {gameState.objectives.map((obj) => (
                <div
                  key={obj.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 9px',
                    borderRadius: 10,
                    background: obj.completed
                      ? 'rgba(16, 185, 129, 0.22)'
                      : 'rgba(244, 63, 94, 0.2)',
                    border: obj.completed
                      ? '1px solid rgba(52, 211, 153, 0.52)'
                      : '1px solid rgba(251, 113, 133, 0.48)',
                    fontSize: 11.5,
                    fontWeight: 800,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {obj.completed ? (
                      <CheckCircle2 size={13} color="#34d399" />
                    ) : (
                      <X size={13} color="#fb7185" />
                    )}
                    {obj.label}
                  </span>
                  <span>
                    {Math.min(obj.current, obj.target).toLocaleString()}/
                    {obj.target.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Navigation Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 2 }}>
              {gameState.lifecyclePhase === 'VICTORY' && nextStageConfig && (
                <button
                  type="button"
                  className="ci6-cta-primary"
                  onClick={() => onSelectStage(nextStageConfig.stageNumber)}
                >
                  <span>
                    Next: Stage {nextStageConfig.stageNumber} — {nextStageConfig.title}
                  </span>
                  <ArrowRight size={17} />
                </button>
              )}

              <button
                type="button"
                className={
                  gameState.lifecyclePhase === 'FAILURE' ? 'ci6-cta-primary' : 'ci6-cta-secondary'
                }
                onClick={() => {
                  if (dictBundle) startFreshStage(stage.stageNumber, dictBundle);
                }}
              >
                <RotateCcw size={15} />
                <span>{gameState.lifecyclePhase === 'VICTORY' ? 'Replay Stage' : 'Retry Stage'}</span>
              </button>

              <button type="button" className="ci6-cta-secondary" onClick={onBackToStages}>
                <ArrowLeft size={15} />
                <span>Back to Stages 1–50</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
