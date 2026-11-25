import React, { useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Compass,
  HelpCircle,
  Lightbulb,
  Play,
  Repeat,
  RotateCw,
  Sliders,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  CHANGEIT_DIFFICULTY_ORDER,
  DIFFICULTY_CONFIGS,
} from '../../shared/changeit/difficulty';
import {
  ChangeItDifficulty,
  ChangeItWordLength,
  TwistItSoloDifficulty,
} from '../../shared/types';
import {
  GuessItCategory,
  GuessItDifficulty,
  GuessItPuzzleFormat,
} from '../../shared/guessit/types';

export type ClassicSoloGame = 'guessit' | 'twistit' | 'changeit';

interface ClassicSoloSetupScreenProps {
  game: ClassicSoloGame;
  onBack: () => void;
  onOpenAdventure?: () => void;
  onStartGuessIt?: (params: {
    difficulty: GuessItDifficulty;
    category: GuessItCategory | 'mix';
    format: GuessItPuzzleFormat;
    timeLimitSeconds: number;
  }) => Promise<void>;
  onStartTwistIt?: (params: {
    difficulty: TwistItSoloDifficulty;
    timeLimitSeconds: number;
  }) => Promise<void>;
  onStartChangeIt?: (params: {
    difficulty: ChangeItDifficulty;
    wordLength: ChangeItWordLength | 'auto';
    timeLimitSeconds: number;
    hintsAllowed: boolean;
  }) => Promise<void>;
}

const GUESSIT_CATS: Array<{ id: GuessItCategory | 'mix'; label: string }> = [
  { id: 'mix', label: 'Random Mix' },
  { id: 'Movies', label: 'Movies' },
  { id: 'Animals', label: 'Animals' },
  { id: 'Food', label: 'Food' },
  { id: 'Science', label: 'Science' },
  { id: 'Geography', label: 'Geography' },
  { id: 'Gaming', label: 'Gaming' },
  { id: 'History', label: 'History' },
  { id: 'General Knowledge', label: 'General' },
];

export const ClassicSoloSetupScreen: React.FC<ClassicSoloSetupScreenProps> = ({
  game,
  onBack,
  onOpenAdventure,
  onStartGuessIt,
  onStartTwistIt,
  onStartChangeIt,
}) => {
  const [busy, setBusy] = useState(false);

  // GuessIt config
  const [giDiff, setGiDiff] = useState<GuessItDifficulty>('medium');
  const [giFormat, setGiFormat] = useState<GuessItPuzzleFormat>('classic');
  const [giCat, setGiCat] = useState<GuessItCategory | 'mix'>('mix');
  const [giTime, setGiTime] = useState<number>(0);

  // TwistIt config
  const [twDiff, setTwDiff] = useState<TwistItSoloDifficulty>('normal');
  const [twTime, setTwTime] = useState<number>(0);

  // ChangeIt config
  const [ciDiff, setCiDiff] = useState<ChangeItDifficulty>('easy');
  const [ciLen, setCiLen] = useState<ChangeItWordLength | 'auto'>('auto');
  const [ciTime, setCiTime] = useState<number>(0);
  const [ciHints, setCiHints] = useState<boolean>(true);

  const headerMeta =
    game === 'guessit'
      ? {
          title: 'GuessIt • Classic Solo',
          sub: 'Freeplay word & crossword puzzles with custom difficulty',
          icon: <HelpCircle size={18} color="#fde047" />,
        }
      : game === 'twistit'
        ? {
            title: 'TwistIt • Classic Solo',
            sub: 'Unscramble 6-letter word sets at your chosen difficulty',
            icon: <RotateCw size={18} color="#c084fc" />,
          }
        : {
            title: 'ChangeIt • Classic Solo',
            sub: 'Endless verified word ladders with custom difficulty',
            icon: <Repeat size={18} color="#22d3ee" />,
          };

  const handleLaunch = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (game === 'guessit' && onStartGuessIt) {
        await onStartGuessIt({
          difficulty: giDiff,
          category: giCat,
          format: giFormat,
          timeLimitSeconds: giTime,
        });
      } else if (game === 'twistit' && onStartTwistIt) {
        await onStartTwistIt({ difficulty: twDiff, timeLimitSeconds: twTime });
      } else if (game === 'changeit' && onStartChangeIt) {
        await onStartChangeIt({
          difficulty: ciDiff,
          wordLength: ciLen,
          timeLimitSeconds: ciTime,
          hintsAllowed: ciHints,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ci-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />
      <header className="ci-topbar">
        <button type="button" className="ci-icon-btn" onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} strokeWidth={2.8} />
        </button>
        <div style={{ textAlign: 'center', minWidth: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 900 }}>
            {headerMeta.icon}
            <span>{headerMeta.title}</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a5f3fc' }}>{headerMeta.sub}</div>
        </div>
        <div style={{ width: 36 }} />
      </header>

      <div className="ci-scroll">
        <div className="ci-wrap">
          {onOpenAdventure && (
            <div
              role="tablist"
              aria-label="Single Player Modes"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 6,
                padding: 4,
                borderRadius: 16,
                background: 'rgba(11, 18, 66, 0.84)',
                border: '1.5px solid rgba(165, 243, 252, 0.35)',
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={false}
                onClick={onOpenAdventure}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '9px 10px',
                  borderRadius: 12,
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: '#dbeafe',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <Compass size={14} />
                <span>Adventure</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={true}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '9px 10px',
                  borderRadius: 12,
                  border: '1.5px solid rgba(254, 240, 138, 0.8)',
                  background: 'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: 'default',
                }}
              >
                <Target size={14} />
                <span>Classic Round</span>
              </button>
            </div>
          )}
          {/* GUESSIT CLASSIC SOLO */}
          {game === 'guessit' && (
            <>
              <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="ci-card-title">
                  <span>Difficulty</span>
                  <Sliders size={14} color="#fde047" />
                </div>
                {(
                  [
                    { id: 'easy', label: 'Easy', desc: '8 lives • Shorter lock • Familiar words' },
                    { id: 'medium', label: 'Medium', desc: '6 lives • Balanced vocabulary' },
                    { id: 'hard', label: 'Hard', desc: '4 lives • Longer lock • Tricky phrases' },
                  ] as const
                ).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setGiDiff(d.id)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 13,
                      border: giDiff === d.id ? '2px solid #fde047' : '1px solid rgba(148,163,184,0.3)',
                      background: giDiff === d.id ? 'rgba(202, 138, 4, 0.34)' : 'rgba(12, 22, 78, 0.72)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 900 }}>{d.label}</div>
                    <div style={{ fontSize: 11.5, color: '#e2e8f0', fontWeight: 600 }}>{d.desc}</div>
                  </button>
                ))}
              </div>

              <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="ci-card-title">
                  <span>Puzzle Format</span>
                  <Sparkles size={14} color="#7dd3fc" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(
                    [
                      { id: 'classic', label: 'Classic Phrase' },
                      { id: 'crossword', label: 'Crossword' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setGiFormat(f.id)}
                      className={giFormat === f.id ? 'ci-cta-cyan' : 'ci-pill'}
                      style={{ minHeight: 40, justifyContent: 'center', cursor: 'pointer' }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="ci-card-title">
                  <span>Category</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {GUESSIT_CATS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setGiCat(c.id)}
                      className={`ci-pill ${giCat === c.id ? 'is-cyan' : ''}`}
                      style={{ cursor: 'pointer', padding: '7px 11px' }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="ci-card-title">
                  <span>Timer</span>
                  <Clock size={14} color="#67e8f9" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { sec: 0, label: 'Relaxed (5m)' },
                    { sec: 120, label: '2:00' },
                    { sec: 180, label: '3:00' },
                  ].map((t) => (
                    <button
                      key={t.sec}
                      type="button"
                      onClick={() => setGiTime(t.sec)}
                      className={giTime === t.sec ? 'ci-cta-cyan' : 'ci-pill'}
                      style={{ minHeight: 38, justifyContent: 'center', cursor: 'pointer' }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* TWISTIT CLASSIC SOLO */}
          {game === 'twistit' && (
            <>
              <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="ci-card-title">
                  <span>Difficulty</span>
                  <Sliders size={14} color="#c084fc" />
                </div>
                {(
                  [
                    { id: 'easy', label: 'Easy', desc: '10–12 target words • Classic 6-letter sets' },
                    { id: 'normal', label: 'Normal', desc: '12–14 target words • Balanced vocabulary' },
                    { id: 'hard', label: 'Hard', desc: '14–16 target words • Skilled 6-letter sets' },
                  ] as const
                ).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setTwDiff(d.id)}
                    style={{
                      textAlign: 'left',
                      padding: '11px 12px',
                      borderRadius: 13,
                      border: twDiff === d.id ? '2px solid #c084fc' : '1px solid rgba(148,163,184,0.3)',
                      background: twDiff === d.id ? 'rgba(124, 58, 237, 0.42)' : 'rgba(12, 22, 78, 0.72)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 14.5, fontWeight: 900 }}>{d.label}</div>
                    <div style={{ fontSize: 11.5, color: '#e2e8f0', fontWeight: 600 }}>{d.desc}</div>
                  </button>
                ))}
              </div>

              <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="ci-card-title">
                  <span>Timer</span>
                  <Clock size={14} color="#67e8f9" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
                  {[
                    { sec: 0, label: 'Untimed' },
                    { sec: 120, label: '2:00' },
                    { sec: 180, label: '3:00' },
                    { sec: 240, label: '4:00' },
                  ].map((t) => (
                    <button
                      key={t.sec}
                      type="button"
                      onClick={() => setTwTime(t.sec)}
                      className={twTime === t.sec ? 'ci-cta-cyan' : 'ci-pill'}
                      style={{ minHeight: 38, justifyContent: 'center', cursor: 'pointer' }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* CHANGEIT CLASSIC SOLO */}
          {game === 'changeit' && (
            <>
              <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="ci-card-title">
                  <span>Difficulty</span>
                  <Sliders size={14} color="#22d3ee" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                  {CHANGEIT_DIFFICULTY_ORDER.map((d) => {
                    const cfg = DIFFICULTY_CONFIGS[d];
                    const active = ciDiff === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setCiDiff(d)}
                        style={{
                          textAlign: 'left',
                          padding: '9px 11px',
                          borderRadius: 13,
                          border: active ? '2px solid #22d3ee' : '1px solid rgba(148,163,184,0.3)',
                          background: active ? 'rgba(8, 145, 178, 0.36)' : 'rgba(12, 22, 78, 0.72)',
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 13.5, fontWeight: 900 }}>{cfg.label}</div>
                        <div style={{ fontSize: 11, color: '#bae6fd', fontWeight: 700 }}>
                          {cfg.wordLengths.join('–')}L • {cfg.minMoves}
                          {cfg.maxMoves >= 20 ? '+' : `–${cfg.maxMoves}`} moves
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div className="ci-card-title" style={{ marginBottom: 6 }}>
                    <span>Word Length</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                    {(['auto', 3, 4, 5, 6] as const).map((len) => (
                      <button
                        key={String(len)}
                        type="button"
                        onClick={() => setCiLen(len)}
                        className={ciLen === len ? 'ci-cta-cyan' : 'ci-pill'}
                        style={{ minHeight: 36, justifyContent: 'center', cursor: 'pointer' }}
                      >
                        {len === 'auto' ? 'Auto' : `${len}L`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="ci-card-title" style={{ marginBottom: 6 }}>
                    <span>Timer</span>
                    <Clock size={14} color="#67e8f9" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {[
                      { sec: 0, label: 'Untimed' },
                      { sec: 120, label: '2:00' },
                      { sec: 180, label: '3:00' },
                      { sec: 300, label: '5:00' },
                    ].map((t) => (
                      <button
                        key={t.sec}
                        type="button"
                        onClick={() => setCiTime(t.sec)}
                        className={ciTime === t.sec ? 'ci-cta-cyan' : 'ci-pill'}
                        style={{ minHeight: 36, justifyContent: 'center', cursor: 'pointer' }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCiHints((v) => !v)}
                  className={`ci-pill ${ciHints ? 'is-green' : ''}`}
                  style={{ cursor: 'pointer', padding: '8px 12px', justifyContent: 'center' }}
                >
                  <Lightbulb size={14} />
                  <span>Hints: {ciHints ? 'Enabled' : 'Disabled'}</span>
                </button>
              </div>
            </>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={handleLaunch}
            className="ci-cta-green"
            style={{ minHeight: 48 }}
          >
            <Play size={18} fill="currentColor" />
            <span>{busy ? 'Starting...' : 'Start Classic Solo'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
