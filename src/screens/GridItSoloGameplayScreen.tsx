import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Crown,
  Flag,
  Lightbulb,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { DEFAULT_GRIDIT_SCORING } from '../../shared/gridit/engine';
import { GridItCustomTemplate } from '../../shared/gridit/editor';
import {
  DEFAULT_GRIDIT_MODS,
  GridItModConfig,
  GridItModSchedule,
  MAX_GRIDIT_MULTIPLIER,
  generateModSchedule,
  getBoardModStateKey,
  getBoardSnapshotAtTime,
  getNextScheduleTransitionDelayMs,
  resolveWordPathWithMods,
} from '../../shared/gridit/mods';
import { getShapeTemplate } from '../../shared/gridit/shapes';
import {
  GridItBoard,
  GridItBoardSize,
  GridItFoundWord,
  GridItShapeId,
  PlayerSession,
} from '../../shared/types';
import { GridItDefinitionModal } from '../components/GridItDefinitionModal';
import { GridItTimerDisplay } from '../components/GridItTimerDisplay';
import { AvatarBadge } from '../components/Artwork';
import {
  fetchWordDefinition,
  loadGridItWordSet,
} from '../games/gridit/dictionary';
import {
  completeTemplateInWorker,
  findHintWordsInWorker,
  generatePlayableBoardInWorker,
} from '../games/gridit/workerClient';
import { GridItBoardCanvas } from '../games/gridit/GridItBoardCanvas';

interface GridItSoloGameplayScreenProps {
  session: PlayerSession;
  shapeId: GridItShapeId;
  sizeId: GridItBoardSize;
  durationSeconds: number;
  mods?: GridItModConfig;
  language?: string;
  customTemplate?: GridItCustomTemplate | null;
  onExitToSetup: () => void;
  onExitToHub: () => void;
}

interface SoloBottomPanelsProps {
  foundWords: GridItFoundWord[];
  score: number;
  bestWord: GridItFoundWord | null;
  maxMultiplierSeen: number;
  tileCount: number;
  onSelectWord: (word: string) => void;
}

const SoloBottomPanels: React.FC<SoloBottomPanelsProps> = memo(
  ({ foundWords, score, bestWord, maxMultiplierSeen, tileCount, onSelectWord }) => (
    <div className="ens-gridit-bottom-panels">
      <div className="ens-gridit-panel">
        <div className="ens-gridit-panel-title">Found Words ({foundWords.length})</div>
        <div className="ens-gridit-found-list">
          {foundWords.length === 0 ? (
            <div className="ens-gridit-empty-hint">
              Tap any found word here to read its dictionary definition.
            </div>
          ) : (
            foundWords.map((fw) => (
              <button
                key={fw.word}
                type="button"
                className="ens-gridit-found-row"
                onClick={() => onSelectWord(fw.word)}
                title={`Look up ${fw.word}`}
              >
                <span className="ens-gridit-found-word">{fw.word.toLowerCase()}</span>
                <span className="ens-gridit-found-right">
                  <span className="ens-gridit-found-pts">+{fw.points}</span>
                  <BookOpen size={13} color="#bae6fd" />
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="ens-gridit-panel">
        <div className="ens-gridit-panel-title">Your Stats</div>
        <div className="ens-gridit-stats-rows">
          <div className="ens-gridit-stat-line">
            <span>Score</span>
            <strong>{score}</strong>
          </div>
          <div className="ens-gridit-stat-line">
            <span>Words</span>
            <strong>{foundWords.length}</strong>
          </div>
          <div className="ens-gridit-stat-line">
            <span>Best</span>
            <strong>{bestWord ? `${bestWord.word} (+${bestWord.points})` : '—'}</strong>
          </div>
          <div className="ens-gridit-stat-line">
            <span>Max Mult</span>
            <strong>
              {maxMultiplierSeen}× (Cap {MAX_GRIDIT_MULTIPLIER}×)
            </strong>
          </div>
          <div className="ens-gridit-stat-line">
            <span>Tiles</span>
            <strong>{tileCount}</strong>
          </div>
        </div>
      </div>
    </div>
  )
);
SoloBottomPanels.displayName = 'SoloBottomPanels';

export const GridItSoloGameplayScreen: React.FC<GridItSoloGameplayScreenProps> = ({
  session,
  shapeId,
  sizeId,
  durationSeconds,
  mods = DEFAULT_GRIDIT_MODS,
  language = 'en',
  customTemplate = null,
  onExitToSetup,
  onExitToHub,
}) => {
  const [wordSet, setWordSet] = useState<Set<string> | null>(null);
  const [isFallbackDict, setIsFallbackDict] = useState(false);
  const [board, setBoard] = useState<GridItBoard | null>(null);
  const [schedule, setSchedule] = useState<GridItModSchedule | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [comboCount, setComboCount] = useState(0);
  const [lastWordAtMs, setLastWordAtMs] = useState<number | null>(null);
  const [maxMultiplierSeen, setMaxMultiplierSeen] = useState(1);
  const [matchPhase, setMatchPhase] = useState<'shaking' | 'playing'>('shaking');
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [foundWords, setFoundWords] = useState<GridItFoundWord[]>([]);
  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [hintTileId, setHintTileId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; tone: 'ok' | 'err' | 'info' } | null>(
    null
  );
  const [definitionWord, setDefinitionWord] = useState<string | null>(null);
  const [bestDefPreview, setBestDefPreview] = useState<string | null>(null);

  const shapeMeta = useMemo(() => getShapeTemplate(shapeId), [shapeId]);
  const feedbackTimerRef = useRef<number | null>(null);
  const shakeTimerRef = useRef<number | null>(null);
  const genReqRef = useRef(0);

  const showFeedback = useCallback((text: string, tone: 'ok' | 'err' | 'info') => {
    setFeedback({ text, tone });
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
    }, 1800);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
    };
  }, []);

  // Generate complete board inside Web Worker off the main thread, while loading lightweight word set for O(1) validation
  const startNewBoard = useCallback(async () => {
    const reqId = ++genReqRef.current;
    const [words, generated] = await Promise.all([
      loadGridItWordSet(language),
      customTemplate
        ? completeTemplateInWorker({
            template: customTemplate,
            stripAuthoredFlag: true,
          })
        : generatePlayableBoardInWorker({
            shapeId,
            sizeId,
            language,
          }),
    ]);
    if (reqId !== genReqRef.current) return;

    const newBoard = generated.board;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const shakeMs = reduced ? 350 : 2300;
    const playStartAt = Date.now() + shakeMs;
    const newSchedule = generateModSchedule(
      newBoard,
      durationSeconds,
      mods,
      newBoard.seed,
      playStartAt
    );

    setWordSet(words);
    setIsFallbackDict(generated.isFallback);
    setBoard(newBoard);
    setSchedule(newSchedule);
    setNowMs(Date.now());
    setComboCount(0);
    setLastWordAtMs(null);
    setMaxMultiplierSeen(1);
    setMatchPhase('shaking');
    setSelectedPath([]);
    setFoundWords([]);
    setScore(0);
    setSecondsLeft(durationSeconds);
    setPaused(false);
    setFinished(false);
    setHintTileId(null);
    setFeedback(null);
    setBestDefPreview(null);

    if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = window.setTimeout(() => {
      setNowMs(Date.now());
      setMatchPhase('playing');
      showFeedback('Board ready! Go!', 'info');
    }, shakeMs);
  }, [customTemplate, durationSeconds, language, mods, shapeId, showFeedback, sizeId]);

  useEffect(() => {
    startNewBoard();
    return () => {
      genReqRef.current++;
    };
  }, [startNewBoard]);

  // Schedule exact timeout only for the next mod window boundary (zero 250ms full-screen polling)
  useEffect(() => {
    if (!board || matchPhase !== 'playing' || paused || finished) return;
    const delay = getNextScheduleTransitionDelayMs(schedule, Date.now());
    if (delay === null) return;
    const timer = window.setTimeout(() => {
      setNowMs(Date.now());
    }, delay);
    return () => window.clearTimeout(timer);
  }, [board, matchPhase, paused, finished, schedule, nowMs]);

  useEffect(() => {
    if (!board || matchPhase !== 'playing' || durationSeconds <= 0 || paused || finished) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          setFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [board, matchPhase, durationSeconds, paused, finished]);

  const modStateKey = useMemo(
    () => getBoardModStateKey(board?.id ?? '', schedule, nowMs),
    [board?.id, schedule, nowMs]
  );

  const boardSnapshot = useMemo(() => {
    if (!board) return null;
    return getBoardSnapshotAtTime(board, schedule, nowMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, schedule, modStateKey]);

  const activeBoard = boardSnapshot?.board ?? board;

  const foundWordSet = useMemo(
    () => new Set(foundWords.map((w) => w.word)),
    [foundWords]
  );

  const bestWord = useMemo(() => {
    if (foundWords.length === 0) return null;
    return [...foundWords].sort(
      (a, b) => b.points - a.points || b.word.length - a.word.length
    )[0];
  }, [foundWords]);

  // Fetch brief preview definition for Best Word when match finishes
  useEffect(() => {
    if (!finished || !bestWord) return;
    let cancelled = false;
    fetchWordDefinition(bestWord.word, 'en').then((res) => {
      if (cancelled) return;
      const firstDef = res.meanings[0]?.definitions[0]?.definition;
      if (firstDef) {
        setBestDefPreview(firstDef);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [finished, bestWord]);

  const handleSubmitPath = useCallback(
    (path: string[]) => {
      if (!board || !wordSet || matchPhase !== 'playing' || paused || finished) return;
      const submitNow = Date.now();
      const result = resolveWordPathWithMods(board, path, wordSet, foundWordSet, {
        nowMs: submitNow,
        schedule,
        modConfig: mods,
        comboCount,
        lastWordAtMs,
        scoringConfig: DEFAULT_GRIDIT_SCORING,
      });
      setSelectedPath([]);
      setHintTileId(null);

      if (!result.valid) {
        const msgMap: Record<string, string> = {
          too_short: `Need at least ${DEFAULT_GRIDIT_SCORING.minWordLength} letters`,
          already_found: `${result.word} already found`,
          not_in_dictionary: `${result.word} not in dictionary`,
          duplicate_tile: 'Tile cannot be reused in one word',
          not_adjacent: 'Letters must touch sequentially',
          invalid_path: 'Select neighboring letters',
        };
        showFeedback(msgMap[result.reason || 'invalid_path'] || 'Invalid word', 'err');
        return;
      }

      const entry: GridItFoundWord = {
        word: result.word,
        tilePath: [...path],
        points: result.finalPoints,
        foundAtMs: submitNow,
      };
      setFoundWords((prev) => [entry, ...prev]);
      setScore((prev) => prev + result.finalPoints);
      setComboCount(result.nextComboCount);
      setLastWordAtMs(submitNow);
      setMaxMultiplierSeen((prev) => Math.max(prev, result.multiplier));
      const multNote = result.multiplier > 1 ? ` (${result.multiplier}×)` : '';
      showFeedback(`+${result.finalPoints} pts${multNote} • ${result.word}!`, 'ok');
    },
    [board, comboCount, finished, foundWordSet, lastWordAtMs, matchPhase, mods, paused, schedule, showFeedback, wordSet]
  );

  const handleHint = useCallback(async () => {
    if (!activeBoard || paused || finished) return;
    const { candidates } = await findHintWordsInWorker({
      board: activeBoard,
      language,
      excludeWords: Array.from(foundWordSet),
      maxWords: 20,
    });
    if (candidates.length === 0) {
      showFeedback('No more hints available on this board!', 'info');
      return;
    }
    const pick = candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];
    const startId = pick.tilePath[0];
    setHintTileId(startId);
    showFeedback(`Hint: look for a ${pick.word.length}-letter word starting at glow!`, 'info');
  }, [activeBoard, finished, foundWordSet, language, paused, showFeedback]);

  const activeTileLetterMap = useMemo(() => {
    const map = new Map<string, string>();
    if (activeBoard) {
      for (const t of activeBoard.tiles) map.set(t.id, t.letter);
    }
    return map;
  }, [activeBoard]);

  const activeWordPreview = useMemo(() => {
    if (!activeBoard || selectedPath.length === 0) return '';
    return selectedPath
      .map((id) => {
        if (boardSnapshot?.activeRainbowIds.has(id)) return '★';
        return activeTileLetterMap.get(id) ?? '';
      })
      .join('');
  }, [activeBoard, activeTileLetterMap, boardSnapshot?.activeRainbowIds, selectedPath]);

  if (!activeBoard || !wordSet) {
    return (
      <div className="ens-fantasy-page ens-gridit-page">
        <div className="ens-sky-sparkles" aria-hidden="true" />
        <div className="ens-gridit-loading-shell">
          <Loader2 size={32} className="ens-spin" color="#fde047" />
          <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            Building {shapeMeta.name} Board...
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#c7d2fe' }}>
            Preparing dictionary &amp; validating playable letters
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ens-fantasy-page ens-gridit-page">
      <div className="ens-sky-sparkles" aria-hidden="true" />
      <img
        src="/art/gridit-home-hero-bg.png"
        alt=""
        className="ens-gridit-play-backdrop"
        aria-hidden="true"
      />

      <div className="ens-gridit-play-shell">
        {/* Top Match HUD matching Screen 3 */}
        <header className="ens-gridit-hud">
          <button
            type="button"
            className="ens-exit-hub-btn is-compact"
            onClick={onExitToSetup}
            aria-label="Back to Solo Setup"
          >
            <ArrowLeft size={14} strokeWidth={2.8} />
          </button>

          <div className="ens-gridit-hud-player">
            <AvatarBadge avatarId={session.avatarId} size={30} ringColor="#fde047" />
            <div className="ens-gridit-hud-player-meta">
              <span className="ens-gridit-hud-name">{session.nickname}</span>
              <span className="ens-gridit-hud-score">{score} pts</span>
            </div>
          </div>

          <GridItTimerDisplay
            mode="solo"
            durationSeconds={durationSeconds}
            secondsLeft={secondsLeft}
          />

          <button
            type="button"
            className="ens-gridit-finish-btn"
            onClick={() => setFinished(true)}
            title="Finish Solo match"
          >
            <Flag size={13} />
            <span>Finish</span>
          </button>
        </header>

        <div className="ens-gridit-substrip">
          <span>
            GridIt • Solo • {shapeMeta.name} ({activeBoard.tiles.length} tiles)
          </span>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {boardSnapshot?.inLightningRound && (
              <span className="ens-gridit-live-mod-pill is-lightning">⚡ 3× LIGHTNING</span>
            )}
            {mods.comboFever && comboCount >= 2 && (
              <span className="ens-gridit-live-mod-pill is-combo">🔥 COMBO ×{comboCount}</span>
            )}
            {(boardSnapshot?.activeGrowthWaveCount ?? 0) > 0 && (
              <span className="ens-gridit-live-mod-pill is-growth">
                +RING {boardSnapshot?.activeGrowthWaveCount}
              </span>
            )}
            {isFallbackDict && <span className="ens-gridit-offline-chip">Offline Core Dict</span>}
          </div>
        </div>

        {/* Interactive Board Viewport (Zoom, Pan, Drag-Trace, Physical Dice & Shake) */}
        <div className="ens-gridit-board-stage">
          <GridItBoardCanvas
            board={activeBoard}
            selectedPath={selectedPath}
            hintTileId={hintTileId}
            paused={paused}
            isShaking={matchPhase === 'shaking'}
            activeRainbowIds={boardSnapshot?.activeRainbowIds}
            activeGoldenIds={boardSnapshot?.activeGoldenIds}
            lightningActive={boardSnapshot?.inLightningRound}
            onPathChange={setSelectedPath}
            onSubmitPath={handleSubmitPath}
          />

          {paused && !finished && (
            <div className="ens-gridit-pause-overlay">
              <Pause size={34} color="#fde047" />
              <div style={{ fontSize: 20, fontWeight: 900, color: '#ffffff' }}>Match Paused</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#c7d2fe' }}>
                Tiles hidden while Solo timer is paused
              </div>
              <button
                type="button"
                className="ens-gridit-green-cta"
                style={{ maxWidth: 200, minHeight: 44 }}
                onClick={() => setPaused(false)}
              >
                <Play size={16} fill="#ffffff" color="#ffffff" />
                <span>Resume</span>
              </button>
            </div>
          )}
        </div>

        {/* Active Word Preview + Submit Row matching Screen 3 */}
        <div className="ens-gridit-wordbar">
          <div className="ens-gridit-preview-box">
            <span className={`ens-gridit-preview-text ${activeWordPreview ? '' : 'is-empty'}`}>
              {activeWordPreview || 'Trace or tap letters...'}
            </span>
            {selectedPath.length > 0 && (
              <button
                type="button"
                className="ens-gridit-clear-btn"
                onClick={() => setSelectedPath([])}
                aria-label="Clear selected letters"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="ens-gridit-submit-btn"
            disabled={selectedPath.length === 0 || paused || finished}
            onClick={() => handleSubmitPath(selectedPath)}
          >
            Submit
          </button>
        </div>

        {feedback && (
          <div className={`ens-gridit-feedback-pill is-${feedback.tone}`} role="status">
            {feedback.text}
          </div>
        )}

        <SoloBottomPanels
          foundWords={foundWords}
          score={score}
          bestWord={bestWord}
          maxMultiplierSeen={maxMultiplierSeen}
          tileCount={activeBoard.tiles.length}
          onSelectWord={setDefinitionWord}
        />

        {/* Bottom Solo Utility Bar */}
        <div className="ens-gridit-toolbar">
          <button
            type="button"
            className="ens-gridit-tool-btn"
            onClick={handleHint}
            disabled={paused || finished}
          >
            <Lightbulb size={15} color="#fde047" />
            <span>Hint</span>
          </button>

          <button
            type="button"
            className="ens-gridit-tool-btn"
            onClick={() => {
              const target = bestWord?.word || foundWords[0]?.word;
              if (target) {
                setDefinitionWord(target);
              } else {
                showFeedback('Find a word first, then tap it to view definitions!', 'info');
              }
            }}
          >
            <BookOpen size={15} color="#7dd3fc" />
            <span>Dictionary</span>
          </button>

          <button
            type="button"
            className="ens-gridit-tool-btn"
            onClick={() => setPaused((p) => !p)}
            disabled={finished}
          >
            {paused ? <Play size={15} color="#4ade80" /> : <Pause size={15} color="#f472b6" />}
            <span>{paused ? 'Resume' : 'Pause'}</span>
          </button>
        </div>
      </div>

      {/* Match Results Overlay matching Mockup Screen 4 */}
      {finished && (
        <div className="ens-modal-backdrop" style={{ alignItems: 'center' }}>
          <div className="ens-modal-card ens-fantasy-modal ens-gridit-results-modal">
            <div className="ens-gridit-results-header">
              <Crown size={34} color="#fde047" fill="#fde047" />
              <h2 className="ens-gridit-results-title">Solo Complete!</h2>
              <p className="ens-gridit-results-sub">
                {shapeMeta.name} ({activeBoard.tiles.length} tiles)
              </p>
            </div>

            <div className="ens-gridit-results-hero">
              <AvatarBadge avatarId={session.avatarId} size={48} ringColor="#fde047" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
                  {session.nickname}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#c7d2fe' }}>
                  {foundWords.length} valid word{foundWords.length === 1 ? '' : 's'} discovered
                </div>
              </div>
              <div className="ens-gridit-results-score">{score}</div>
            </div>

            {bestWord && (
              <button
                type="button"
                className="ens-gridit-results-best"
                onClick={() => setDefinitionWord(bestWord.word)}
              >
                <div className="ens-gridit-results-best-head">
                  <span>
                    <Sparkles size={13} color="#fde047" /> Best Word:{' '}
                    <strong>{bestWord.word}</strong> (+{bestWord.points})
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#7dd3fc' }}>
                    <BookOpen size={13} /> Definition
                  </span>
                </div>
                {bestDefPreview && (
                  <div className="ens-gridit-results-best-def">
                    {bestWord.word.toLowerCase()} — {bestDefPreview}
                  </div>
                )}
              </button>
            )}

            {foundWords.length > 0 && (
              <div className="ens-gridit-results-words">
                {foundWords.map((fw) => (
                  <button
                    key={fw.word}
                    type="button"
                    className="ens-gridit-results-word-chip"
                    onClick={() => setDefinitionWord(fw.word)}
                  >
                    <span>{fw.word.toLowerCase()}</span>
                    <strong>+{fw.points}</strong>
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="ens-gridit-green-cta"
                onClick={() => startNewBoard()}
              >
                <RotateCcw size={16} />
                <span>Play Again</span>
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  className="ens-btn-white"
                  onClick={onExitToSetup}
                >
                  <SlidersHorizontal size={14} />
                  <span>Change Setup</span>
                </button>
                <button
                  type="button"
                  className="ens-btn-white"
                  onClick={onExitToHub}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Hub</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <GridItDefinitionModal
        word={definitionWord}
        onClose={() => setDefinitionWord(null)}
      />
    </div>
  );
};
