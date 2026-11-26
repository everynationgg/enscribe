import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bomb,
  Check,
  CheckCircle2,
  Flame,
  HelpCircle,
  Minus,
  Plus,
  RotateCcw,
  Shuffle,
  Sparkles,
  Star,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import {
  activatePowerUpMove,
  createCrushItGameState,
  evaluateWordPreview,
  manualReshuffleBoard,
  submitWordMove,
} from '../../../shared/crushit/engine';
import {
  getPowerUpAffectedCoords,
  POWER_UP_CONFIG,
  POWER_UP_ORDER,
} from '../../../shared/crushit/powerUpConfig';
import { CRUSHIT_TOTAL_STAGES, getCrushItStage } from '../../../shared/crushit/stagesCatalog';
import {
  BoardCoord,
  CrushItGameState,
  CrushItProgressionState,
  CrushItStageResultPayload,
  PowerUpType,
  TurnResolutionEvent,
} from '../../../shared/crushit/types';
import { ActiveBlastFx, CrushItBoard } from '../../games/crushit/CrushItBoard';
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

function renderPowerUpIcon(type: PowerUpType, size = 17) {
  switch (type) {
    case 'line_blast':
      return <Minus size={size} strokeWidth={3} />;
    case 'cross_blast':
      return <Plus size={size} strokeWidth={3} />;
    case 'word_bomb':
      return <Bomb size={size} strokeWidth={2.4} />;
    case 'letter_purge':
      return <Sparkles size={size} strokeWidth={2.4} />;
    case 'mega_blast':
      return <Flame size={size} strokeWidth={2.5} />;
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
  const [activePowerUp, setActivePowerUp] = useState<PowerUpType | null>(null);
  const [lineOrientation, setLineOrientation] = useState<'row' | 'col'>('row');
  const [powerUpTarget, setPowerUpTarget] = useState<BoardCoord | null>(null);

  // Animation states (prevents overlapping animations & input races)
  const [animLocked, setAnimLocked] = useState(false);
  const [destroyingCoordKeys, setDestroyingCoordKeys] = useState<Set<string>>(() => new Set());
  const [fallAnimationKey, setFallAnimationKey] = useState(0);
  const [isReshuffling, setIsReshuffling] = useState(false);
  const [activeBlastFx, setActiveBlastFx] = useState<ActiveBlastFx | null>(null);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [invalidShake, setInvalidShake] = useState(false);
  const [justEarnedPowerUp, setJustEarnedPowerUp] = useState<PowerUpType | null>(null);
  const [justCompletedObjIds, setJustCompletedObjIds] = useState<Set<string>>(() => new Set());

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => isSfxMuted());

  const timersRef = useRef<number[]>([]);
  const recordedSessionIdRef = useRef<string | null>(null);

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
      setGameState(fresh);
      setSelectedPath([]);
      setActivePowerUp(null);
      setPowerUpTarget(null);
      setLineOrientation('row');
      setAnimLocked(false);
      setDestroyingCoordKeys(new Set());
      setFallAnimationKey(0);
      setIsReshuffling(false);
      setActiveBlastFx(null);
      setBannerText(null);
      setShowOutcomeModal(false);
      setJustEarnedPowerUp(null);
      setJustCompletedObjIds(new Set());
    },
    [clearTimers]
  );

  useEffect(() => {
    if (!dictBundle) return;
    startFreshStage(stageNumber, dictBundle);
    return () => clearTimers();
  }, [dictBundle, stageNumber, startFreshStage, clearTimers]);

  const wordPreview = useMemo(() => {
    if (!gameState || !dictBundle) {
      return {
        word: '',
        length: 0,
        isValid: false,
        reason: 'empty' as const,
        potentialScore: 0,
        earnedPowerUp: null,
      };
    }
    return evaluateWordPreview(gameState.board, selectedPath, dictBundle.words);
  }, [gameState, dictBundle, selectedPath]);

  const powerUpPreviewCoords = useMemo(() => {
    if (!gameState || !activePowerUp || !powerUpTarget) return [];
    return getPowerUpAffectedCoords(gameState.board, {
      type: activePowerUp,
      row: powerUpTarget.row,
      col: powerUpTarget.col,
      orientation: activePowerUp === 'line_blast' ? lineOrientation : undefined,
    });
  }, [gameState, activePowerUp, powerUpTarget, lineOrientation]);

  const finalizeOutcomeIfNeeded = useCallback(
    (nextState: CrushItGameState) => {
      if (nextState.status === 'playing') return;
      if (recordedSessionIdRef.current !== nextState.sessionId) {
        recordedSessionIdRef.current = nextState.sessionId;
        onRecordStageResult({
          stageNumber: nextState.stage.stageNumber,
          completed: nextState.status === 'won',
          score: nextState.score,
          stars: nextState.starsEarned,
          movesRemaining: nextState.movesRemaining,
          wordsFormed: nextState.wordsFormed,
          longestWordLength: nextState.longestWordLength,
          powerUpsUsed: nextState.powerUpsUsed,
        });
      }
      if (nextState.status === 'won') {
        crushItSfx.stageWin();
      } else {
        crushItSfx.stageLose();
      }
      setShowOutcomeModal(true);
    },
    [onRecordStageResult]
  );

  const runTurnAnimationSequence = useCallback(
    (nextState: CrushItGameState, event: TurnResolutionEvent) => {
      setAnimLocked(true);
      setSelectedPath([]);
      setActivePowerUp(null);
      setPowerUpTarget(null);

      // Compute centroid for floating score
      let sumR = 0;
      let sumC = 0;
      for (const dt of event.destroyedTiles) {
        sumR += dt.row;
        sumC += dt.col;
      }
      const count = Math.max(1, event.destroyedTiles.length);
      const centroidRow = event.targetCoord ? event.targetCoord.row : sumR / count;
      const centroidCol = event.targetCoord ? event.targetCoord.col : sumC / count;

      // Phase 1: Tile destruction burst & blast effects
      const destroySet = new Set(event.destroyedTiles.map((d) => `${d.row},${d.col}`));
      setDestroyingCoordKeys(destroySet);
      setActiveBlastFx({
        id: `fx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind: event.kind === 'powerup' ? 'powerup' : 'word',
        powerUpType: event.powerUpType,
        targetCoord: event.targetCoord,
        orientation: event.orientation,
        destroyedTiles: event.destroyedTiles,
        scoreGained: event.scoreGained,
        centroidRow,
        centroidCol,
      });

      if (event.kind === 'powerup') {
        crushItSfx.powerUpBlast(event.powerUpType === 'mega_blast');
      } else {
        crushItSfx.wordValid(event.word?.length ?? 3);
      }

      if (event.earnedPowerUp) {
        const puDef = POWER_UP_CONFIG[event.earnedPowerUp];
        setJustEarnedPowerUp(event.earnedPowerUp);
        setBannerText(`+${puDef.name} Earned!`);
        schedule(() => crushItSfx.powerUpEarned(), 110);
        schedule(() => setJustEarnedPowerUp(null), 700);
        schedule(() => setBannerText((prev) => (prev === `+${puDef.name} Earned!` ? null : prev)), 950);
      }

      // Phase 2: Gravity drop & weighted refill
      schedule(() => {
        setDestroyingCoordKeys(new Set());
        setGameState(nextState);
        setFallAnimationKey((k) => k + 1);

        if (event.newlyCompletedObjectiveIds.length > 0) {
          crushItSfx.objectiveComplete();
          setJustCompletedObjIds(new Set(event.newlyCompletedObjectiveIds));
          schedule(() => setJustCompletedObjIds(new Set()), 650);
        }

        // Phase 3: Auto-reshuffle if dead board was detected
        if (event.autoReshuffled) {
          schedule(() => {
            setIsReshuffling(true);
            setBannerText('No playable words — Reshuffling!');
            crushItSfx.reshuffle();

            schedule(() => {
              setIsReshuffling(false);
              setBannerText(null);
              setActiveBlastFx(null);
              setAnimLocked(false);
              finalizeOutcomeIfNeeded(nextState);
            }, 520);
          }, 340);
        } else {
          schedule(() => {
            setActiveBlastFx(null);
            setAnimLocked(false);
            finalizeOutcomeIfNeeded(nextState);
          }, 360);
        }
      }, 240);
    },
    [finalizeOutcomeIfNeeded, schedule]
  );

  const handleConfirmWord = useCallback(() => {
    if (!gameState || !dictBundle || animLocked || gameState.status !== 'playing') return;
    if (selectedPath.length === 0) return;

    const result = submitWordMove(gameState, selectedPath, dictBundle.words, dictBundle.trie);
    if (!result.accepted || !result.event) {
      crushItSfx.wordInvalid();
      setInvalidShake(true);
      schedule(() => setInvalidShake(false), 360);
      return;
    }

    runTurnAnimationSequence(result.state, result.event);
  }, [gameState, dictBundle, animLocked, selectedPath, runTurnAnimationSequence, schedule]);

  const handleActivatePowerUp = useCallback(() => {
    if (
      !gameState ||
      !dictBundle ||
      animLocked ||
      gameState.status !== 'playing' ||
      !activePowerUp ||
      !powerUpTarget
    ) {
      return;
    }

    const res = activatePowerUpMove(
      gameState,
      {
        type: activePowerUp,
        row: powerUpTarget.row,
        col: powerUpTarget.col,
        orientation: activePowerUp === 'line_blast' ? lineOrientation : undefined,
      },
      dictBundle.trie
    );

    if (!res.accepted || !res.event) {
      crushItSfx.wordInvalid();
      return;
    }

    runTurnAnimationSequence(res.state, res.event);
  }, [
    gameState,
    dictBundle,
    animLocked,
    activePowerUp,
    powerUpTarget,
    lineOrientation,
    runTurnAnimationSequence,
  ]);

  const handleManualReshuffle = useCallback(() => {
    if (!gameState || !dictBundle || animLocked || gameState.status !== 'playing') return;
    if (gameState.manualShufflesRemaining <= 0) return;

    const res = manualReshuffleBoard(gameState, dictBundle.trie);
    if (!res.accepted) return;

    setSelectedPath([]);
    setActivePowerUp(null);
    setPowerUpTarget(null);
    setAnimLocked(true);
    setIsReshuffling(true);
    setBannerText('Board Reshuffled!');
    crushItSfx.reshuffle();

    schedule(() => {
      setGameState(res.state);
      schedule(() => {
        setIsReshuffling(false);
        setBannerText(null);
        setAnimLocked(false);
      }, 280);
    }, 200);
  }, [gameState, dictBundle, animLocked, schedule]);

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

  const handleSelectPowerUpSlot = (type: PowerUpType) => {
    if (!gameState || animLocked || gameState.status !== 'playing') return;
    if ((gameState.inventory[type] ?? 0) <= 0) return;

    if (activePowerUp === type) {
      setActivePowerUp(null);
      setPowerUpTarget(null);
      return;
    }

    setSelectedPath([]);
    setActivePowerUp(type);
    // Pre-aim center of board so player immediately sees targeting preview
    setPowerUpTarget({ row: 3, col: 3 });
    crushItSfx.tileSelect(2);
  };

  const handleSelectPowerUpTarget = useCallback((coord: BoardCoord) => {
    setPowerUpTarget(coord);
    crushItSfx.tileSelect(1);
  }, []);

  // Keyboard shortcuts for desktop players (Enter = Confirm, Escape = Cancel)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showHelpModal) {
        if (e.key === 'Escape') setShowHelpModal(false);
        return;
      }
      if (showOutcomeModal) return;
      if (e.key === 'Escape') {
        if (activePowerUp) {
          setActivePowerUp(null);
          setPowerUpTarget(null);
        } else if (selectedPath.length > 0) {
          setSelectedPath([]);
        }
      } else if (e.key === 'Enter') {
        if (activePowerUp && powerUpTarget) {
          handleActivatePowerUp();
        } else if (selectedPath.length >= 3) {
          handleConfirmWord();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    showHelpModal,
    showOutcomeModal,
    activePowerUp,
    powerUpTarget,
    selectedPath,
    handleActivatePowerUp,
    handleConfirmWord,
  ]);

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
  const scorePct = Math.min(100, Math.round((gameState.score / Math.max(1, stage.scoreTarget)) * 100));
  const bestForStage = progression.stages[stage.stageNumber]?.bestScore ?? 0;
  const hasNextStage = stage.stageNumber < CRUSHIT_TOTAL_STAGES;
  const nextStageConfig = hasNextStage ? getCrushItStage(stage.stageNumber + 1) : null;
  const activePuDef = activePowerUp ? POWER_UP_CONFIG[activePowerUp] : null;

  return (
    <div className="ci6-play-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <div className="ci6-play-inner">
        {/* TOP SECTION: Compact Brand Bar + Wide Stage Goal & Objectives */}
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
            <span className="ci6-stage-badge" title={stage.title}>
              Stage {stage.stageNumber}
            </span>
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

        <section className="ci6-hud-panel" aria-label="Stage progress and objectives">
          <div className="ci6-hud-top-row">
            <div className="ci6-score-block">
              <div className="ci6-score-header">
                <span className="ci6-score-value">{gameState.score.toLocaleString()}</span>
                <span className="ci6-score-target">
                  Goal {stage.scoreTarget.toLocaleString()}
                </span>
              </div>
              <div className="ci6-progress-track">
                <div className="ci6-progress-fill" style={{ width: `${scorePct}%` }} />
              </div>
            </div>

            <div
              className={`ci6-moves-pill ${
                gameState.movesRemaining <= 3
                  ? 'is-critical'
                  : gameState.movesRemaining <= 6
                    ? 'is-low'
                    : ''
              }`}
              aria-label={`${gameState.movesRemaining} moves remaining`}
            >
              <span className="ci6-moves-num">{gameState.movesRemaining}</span>
              <span className="ci6-moves-lbl">Moves</span>
            </div>
          </div>

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
                  <CheckCircle2 size={13} color="#34d399" strokeWidth={2.8} />
                ) : (
                  <Target size={12} color="#93c5fd" />
                )}
                <span>{obj.shortLabel}</span>
                <strong style={{ color: obj.completed ? '#6ee7b7' : '#fde047' }}>
                  {Math.min(obj.current, obj.target).toLocaleString()}/{obj.target.toLocaleString()}
                </strong>
              </div>
            ))}
          </div>
        </section>

        {/* CENTER SECTION: Maximized 8x8 Interactive Board */}
        <CrushItBoard
          board={gameState.board}
          selectedPath={selectedPath}
          isValidWord={wordPreview.isValid}
          hasPowerUpReward={Boolean(wordPreview.isValid && wordPreview.earnedPowerUp)}
          isLocked={animLocked || gameState.status !== 'playing'}
          isReshuffling={isReshuffling}
          destroyingCoordKeys={destroyingCoordKeys}
          fallAnimationKey={fallAnimationKey}
          activePowerUp={activePowerUp}
          powerUpPreviewCoords={powerUpPreviewCoords}
          powerUpTargetCoord={powerUpTarget}
          activeBlastFx={activeBlastFx}
          bannerText={bannerText}
          onPathChange={handlePathChange}
          onSelectPowerUpTarget={handleSelectPowerUpTarget}
        />

        {/* BOTTOM SECTION: Word Preview / Targeting Controls + Compact Power-Up Toolbar */}
        <div className="ci6-bottom-dock">
          {activePuDef ? (
            <div className="ci6-word-bar" aria-label="Power-up targeting controls">
              <button
                type="button"
                className="ci6-action-btn is-cancel"
                onClick={() => {
                  setActivePowerUp(null);
                  setPowerUpTarget(null);
                }}
                aria-label="Cancel power-up targeting"
              >
                <X size={20} strokeWidth={2.8} />
              </button>

              <div className="ci6-word-readout">
                <div className="ci6-word-main-row">
                  <span style={{ fontSize: 13.5, fontWeight: 900, color: '#fde047' }}>
                    {activePuDef.name}
                  </span>
                  {activePuDef.requiresOrientation && (
                    <button
                      type="button"
                      className="ci6-orient-toggle"
                      onClick={() =>
                        setLineOrientation((prev) => (prev === 'row' ? 'col' : 'row'))
                      }
                    >
                      {lineOrientation === 'row' ? 'Row ↔' : 'Col ↕'}
                    </button>
                  )}
                </div>
                <div className="ci6-word-sub-row">
                  <span className="ci6-status-pill is-pu">
                    {powerUpPreviewCoords.length > 0
                      ? `Hits ${powerUpPreviewCoords.length} tiles`
                      : 'Tap any tile to target'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="ci6-action-btn is-confirm is-powerup-ready"
                disabled={animLocked || !powerUpTarget || powerUpPreviewCoords.length === 0}
                onClick={handleActivatePowerUp}
                aria-label={`Activate ${activePuDef.name}`}
              >
                <Zap size={16} fill="currentColor" />
                <span>Blast</span>
              </button>
            </div>
          ) : (
            <div
              className={`ci6-word-bar ${invalidShake ? 'is-invalid-shake' : ''}`}
              aria-label="Word submission controls"
            >
              <button
                type="button"
                className="ci6-action-btn is-cancel"
                disabled={animLocked || selectedPath.length === 0}
                onClick={() => {
                  setSelectedPath([]);
                  crushItSfx.tileUndo();
                }}
                aria-label="Cancel word selection"
              >
                <X size={20} strokeWidth={2.8} />
              </button>

              <div className="ci6-word-readout">
                <div className="ci6-word-main-row">
                  <span
                    className={`ci6-word-text ${
                      selectedPath.length === 0 ? 'is-placeholder' : ''
                    }`}
                  >
                    {wordPreview.word || 'Swipe adjacent tiles'}
                  </span>
                </div>

                <div className="ci6-word-sub-row">
                  {selectedPath.length === 0 ? (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#93c5fd' }}>
                      3+ letters • 8 directions • reverse to undo
                    </span>
                  ) : wordPreview.reason === 'too_short' ? (
                    <span className="ci6-status-pill is-invalid">Need 3+ letters</span>
                  ) : wordPreview.reason === 'not_in_dictionary' ? (
                    <span className="ci6-status-pill is-invalid">Not a word</span>
                  ) : wordPreview.isValid ? (
                    <>
                      <span className="ci6-status-pill is-valid">Valid</span>
                      <span className="ci6-status-pill is-score">
                        +{wordPreview.potentialScore}
                      </span>
                      {wordPreview.earnedPowerUp && (
                        <span className="ci6-status-pill is-pu">
                          +{POWER_UP_CONFIG[wordPreview.earnedPowerUp].shortName}
                        </span>
                      )}
                    </>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                className={`ci6-action-btn is-confirm ${
                  wordPreview.isValid && wordPreview.earnedPowerUp ? 'is-powerup-ready' : ''
                }`}
                disabled={animLocked || selectedPath.length === 0 || gameState.status !== 'playing'}
                onClick={handleConfirmWord}
                aria-label="Confirm word"
              >
                <Check size={18} strokeWidth={3} />
                <span>Play</span>
              </button>
            </div>
          )}

          {/* Compact Power-Up Inventory Toolbar + Manual Reshuffle */}
          <div className="ci6-powerup-bar" role="toolbar" aria-label="Power-up inventory">
            {POWER_UP_ORDER.map((puType) => {
              const def = POWER_UP_CONFIG[puType];
              const qty = gameState.inventory[puType] ?? 0;
              const isSelected = activePowerUp === puType;
              const isJustEarned = justEarnedPowerUp === puType;
              return (
                <button
                  key={puType}
                  type="button"
                  className={`ci6-pu-slot ${qty > 0 ? 'is-available' : 'is-empty'} ${
                    isSelected ? 'is-active' : ''
                  } ${isJustEarned ? 'is-just-earned' : ''}`}
                  style={{ '--pu-accent': def.accentColor } as React.CSSProperties}
                  disabled={animLocked || qty <= 0 || gameState.status !== 'playing'}
                  onClick={() => handleSelectPowerUpSlot(puType)}
                  title={`${def.name}: ${def.description}`}
                  aria-label={`${def.name}, ${qty} available`}
                  aria-pressed={isSelected}
                >
                  <span style={{ color: qty > 0 ? def.accentColor : '#94a3b8' }}>
                    {renderPowerUpIcon(puType, 17)}
                  </span>
                  <span className="ci6-pu-label">{def.shortName}</span>
                  <span className="ci6-pu-qty">{qty}</span>
                </button>
              );
            })}

            <button
              type="button"
              className={`ci6-pu-slot ${
                gameState.manualShufflesRemaining > 0 ? 'is-available' : 'is-empty'
              }`}
              style={{ '--pu-accent': '#60a5fa' } as React.CSSProperties}
              disabled={
                animLocked ||
                gameState.manualShufflesRemaining <= 0 ||
                gameState.status !== 'playing'
              }
              onClick={handleManualReshuffle}
              title="Reshuffle board (does not use moves)"
              aria-label={`Reshuffle board, ${gameState.manualShufflesRemaining} left`}
            >
              <Shuffle
                size={16}
                color={gameState.manualShufflesRemaining > 0 ? '#93c5fd' : '#94a3b8'}
              />
              <span className="ci6-pu-label">Mix</span>
              <span className="ci6-pu-qty">{gameState.manualShufflesRemaining}</span>
            </button>
          </div>
        </div>
      </div>

      {/* OPTIONAL HELP DIALOG (Not permanently displayed on gameplay screen) */}
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

            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: '#dbeafe', fontWeight: 700 }}>
              Swipe across adjacent letter tiles in any of the 8 directions to form English words
              (3+ letters). Reverse your swipe to undo. Destroyed tiles trigger gravity and new
              letters fall from above!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11.5, fontWeight: 900, color: '#fde047', textTransform: 'uppercase' }}>
                Letter Tile Colors
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12, fontWeight: 800 }}>
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
              <div style={{ fontSize: 11.5, fontWeight: 900, color: '#fde047', textTransform: 'uppercase' }}>
                Word-Length Power-Ups
              </div>
              {POWER_UP_ORDER.map((puType) => {
                const def = POWER_UP_CONFIG[puType];
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
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: def.accentColor, flexShrink: 0 }}>
                      {renderPowerUpIcon(puType, 16)}
                    </span>
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

      {/* STAGE COMPLETION / FAILURE MODAL */}
      {showOutcomeModal && gameState.status !== 'playing' && (
        <div
          className="ci6-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={gameState.status === 'won' ? 'Stage Complete' : 'Out of Moves'}
        >
          <div className="ci6-modal-card">
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: gameState.status === 'won' ? '#6ee7b7' : '#fda4af',
                }}
              >
                Stage {stage.stageNumber} • {stage.title}
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, marginTop: 2 }}>
                {gameState.status === 'won' ? 'Stage Crushed!' : 'Out of Moves'}
              </div>
            </div>

            {gameState.status === 'won' && (
              <div className="ci6-stars-row" aria-label={`${gameState.starsEarned} of 3 stars`}>
                {[1, 2, 3].map((n) => {
                  const earned = n <= gameState.starsEarned;
                  return (
                    <Star
                      key={n}
                      size={n === 2 ? 42 : 34}
                      fill={earned ? '#fde047' : 'rgba(255,255,255,0.12)'}
                      color={earned ? '#fde047' : 'rgba(255,255,255,0.3)'}
                      className={earned ? 'ci6-star-earned' : undefined}
                      style={{ animationDelay: `${n * 110}ms` }}
                    />
                  );
                })}
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 7,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  padding: '8px 6px',
                  borderRadius: 13,
                  background: 'rgba(10, 16, 68, 0.72)',
                  border: '1px solid rgba(165, 180, 252, 0.25)',
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 900, color: '#fde047' }}>
                  {gameState.score.toLocaleString()}
                </div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#a5b4fc' }}>Score</div>
              </div>
              <div
                style={{
                  padding: '8px 6px',
                  borderRadius: 13,
                  background: 'rgba(10, 16, 68, 0.72)',
                  border: '1px solid rgba(165, 180, 252, 0.25)',
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 900, color: '#67e8f9' }}>
                  {gameState.wordsFormed}
                </div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#a5b4fc' }}>Words</div>
              </div>
              <div
                style={{
                  padding: '8px 6px',
                  borderRadius: 13,
                  background: 'rgba(10, 16, 68, 0.72)',
                  border: '1px solid rgba(165, 180, 252, 0.25)',
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 900, color: '#f9a8d4' }}>
                  {gameState.longestWordLength > 0 ? `${gameState.longestWordLength} ltr` : '—'}
                </div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#a5b4fc' }}>Longest</div>
              </div>
            </div>

            {bestForStage > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#fde68a',
                }}
              >
                <Trophy size={14} />
                <span>Personal Best: {Math.max(bestForStage, gameState.score).toLocaleString()}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {gameState.objectives.map((obj) => (
                <div
                  key={obj.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 10,
                    background: obj.completed
                      ? 'rgba(16, 185, 129, 0.22)'
                      : 'rgba(244, 63, 94, 0.18)',
                    border: obj.completed
                      ? '1px solid rgba(52, 211, 153, 0.5)'
                      : '1px solid rgba(251, 113, 133, 0.45)',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  <span>{obj.label}</span>
                  <span>
                    {Math.min(obj.current, obj.target).toLocaleString()}/{obj.target.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
              {gameState.status === 'won' && nextStageConfig && (
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
                className={gameState.status === 'lost' ? 'ci6-cta-primary' : 'ci6-cta-secondary'}
                onClick={() => {
                  if (dictBundle) startFreshStage(stage.stageNumber, dictBundle);
                }}
              >
                <RotateCcw size={15} />
                <span>{gameState.status === 'won' ? 'Replay Stage' : 'Retry Stage'}</span>
              </button>

              <button
                type="button"
                className="ci6-cta-secondary"
                onClick={onBackToStages}
              >
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
