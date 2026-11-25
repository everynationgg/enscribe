import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  Play,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { GRIDIT_LANGUAGES } from '../../shared/gridit/languages';
import { DEFAULT_GRIDIT_MODS, GridItModConfig } from '../../shared/gridit/mods';
import { GRIDIT_SHAPES, getShapeTemplate } from '../../shared/gridit/shapes';
import { GridItBoardSize, GridItShapeId } from '../../shared/gridit/types';
import { GridItModToggles } from '../components/GridItModToggles';
import { GridItShapeMiniPreview } from '../components/GridItShapePreview';

interface GridItSoloSetupScreenProps {
  initialShape?: GridItShapeId;
  initialSize?: GridItBoardSize;
  initialDurationSeconds?: number;
  initialMods?: GridItModConfig;
  initialLanguage?: string;
  onBack: () => void;
  onStartMatch: (config: {
    shapeId: GridItShapeId;
    sizeId: GridItBoardSize;
    durationSeconds: number;
    mods: GridItModConfig;
    language: string;
  }) => void;
}

const SIZE_ORDER: GridItBoardSize[] = ['small', 'medium', 'large'];
type GridItSoloDifficulty = 'easy' | 'normal' | 'hard' | 'expert';
const GRIDIT_DIFFICULTIES: Array<{
  id: GridItSoloDifficulty;
  label: string;
  desc: string;
  sizeId: GridItBoardSize;
  durationSeconds: number;
  mods: GridItModConfig;
}> = [
  {
    id: 'easy',
    label: 'Easy',
    desc: 'Small • 3:00 • Wildcard',
    sizeId: 'small',
    durationSeconds: 180,
    mods: { ...DEFAULT_GRIDIT_MODS, rainbowWildcard: true },
  },
  {
    id: 'normal',
    label: 'Normal',
    desc: 'Medium • 2:00',
    sizeId: 'medium',
    durationSeconds: 120,
    mods: { ...DEFAULT_GRIDIT_MODS },
  },
  {
    id: 'hard',
    label: 'Hard',
    desc: 'Large • 1:30 • Combo',
    sizeId: 'large',
    durationSeconds: 90,
    mods: { ...DEFAULT_GRIDIT_MODS, comboFever: true },
  },
  {
    id: 'expert',
    label: 'Expert',
    desc: 'Large • 1:30 • All-Out',
    sizeId: 'large',
    durationSeconds: 90,
    mods: { ...DEFAULT_GRIDIT_MODS, comboFever: true, lightningRound: true, growingGrid: true },
  },
];
const TIMER_OPTIONS = [
  { seconds: 90, label: '1:30' },
  { seconds: 120, label: '2:00' },
  { seconds: 180, label: '3:00' },
  { seconds: 0, label: 'Untimed' },
];

export const GridItSoloSetupScreen: React.FC<GridItSoloSetupScreenProps> = ({
  initialShape = 'heart',
  initialSize = 'medium',
  initialDurationSeconds = 120,
  initialMods = DEFAULT_GRIDIT_MODS,
  initialLanguage = 'en',
  onBack,
  onStartMatch,
}) => {
  const [shapeId, setShapeId] = useState<GridItShapeId>(initialShape);
  const [difficulty, setDifficulty] = useState<GridItSoloDifficulty>('normal');
  const [sizeId, setSizeId] = useState<GridItBoardSize>(initialSize);
  const [durationSeconds, setDurationSeconds] = useState<number>(initialDurationSeconds);
  const [mods, setMods] = useState<GridItModConfig>(initialMods);
  const [language, setLanguage] = useState<string>(initialLanguage);

  const applyDifficultyPreset = (preset: (typeof GRIDIT_DIFFICULTIES)[number]) => {
    setDifficulty(preset.id);
    setSizeId(preset.sizeId);
    setDurationSeconds(preset.durationSeconds);
    setMods({ ...preset.mods });
  };

  const selectedShape = getShapeTemplate(shapeId);
  const selectedLang = GRIDIT_LANGUAGES.find((l) => l.code === language) ?? GRIDIT_LANGUAGES[0];
  const sizeIndex = SIZE_ORDER.indexOf(sizeId);
  const cycleSize = (delta: number) => {
    const next = (sizeIndex + delta + SIZE_ORDER.length) % SIZE_ORDER.length;
    setSizeId(SIZE_ORDER[next]);
  };

  return (
    <div className="ens-fantasy-page ens-gridit-page">
      <div className="ens-sky-sparkles" aria-hidden="true" />
      <img
        src="/art/gridit-home-hero-bg.png"
        alt=""
        className="ens-gridit-play-backdrop"
        aria-hidden="true"
      />

      <div className="ens-scroll-body ens-gridit-scroll">
        <div className="ens-gridit-wrap">
          {/* Header matching Mockup Screen 2 */}
          <header className="ens-gridit-setup-header">
            <button
              type="button"
              className="ens-exit-hub-btn is-compact"
              onClick={onBack}
              aria-label="Back to GridIt Home"
            >
              <ArrowLeft size={15} strokeWidth={2.8} />
            </button>
            <div className="ens-gridit-setup-title-wrap">
              <div className="ens-gridit-setup-title">GridIt — Classic Solo</div>
              <div className="ens-gridit-setup-sub">
                Choose your difficulty, shape, size &amp; timer
              </div>
            </div>
          </header>

          {/* Difficulty Preset Selector */}
          <section className="ens-gridit-setup-card">
            <div className="ens-gridit-setup-label">
              <Sliders size={14} color="#fde047" />
              <span>Difficulty</span>
            </div>
            <div className="ens-gridit-timer-pills">
              {GRIDIT_DIFFICULTIES.map((preset) => {
                const active = difficulty === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`ens-gridit-timer-pill ${active ? 'is-selected' : ''}`}
                    onClick={() => applyDifficultyPreset(preset)}
                    title={preset.desc}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div className="ens-gridit-shape-desc">
              {GRIDIT_DIFFICULTIES.find((d) => d.id === difficulty)?.desc}
            </div>
          </section>

          {/* Shape Template Selector */}
          <section className="ens-gridit-setup-card">
            <div className="ens-gridit-setup-label">
              <Sparkles size={14} color="#fde047" />
              <span>Shape Template</span>
            </div>

            <div className="ens-gridit-shape-picker-grid">
              {GRIDIT_SHAPES.map((s) => {
                const active = s.id === shapeId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`ens-gridit-shape-option ${active ? 'is-selected' : ''}`}
                    onClick={() => setShapeId(s.id)}
                  >
                    {active && (
                      <span className="ens-gridit-shape-check" aria-hidden="true">
                        <Check size={11} strokeWidth={3.5} />
                      </span>
                    )}
                    <GridItShapeMiniPreview shapeId={s.id} />
                    <span className="ens-gridit-shape-option-name">{s.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="ens-gridit-shape-desc">{selectedShape.description}</div>
          </section>

          {/* Board Size Stepper (matching Mockup Screen 2: "< Medium (37 tiles) >") */}
          <section className="ens-gridit-setup-card">
            <div className="ens-gridit-setup-label">
              <span>Board Size</span>
            </div>

            <div className="ens-gridit-size-stepper">
              <button
                type="button"
                className="ens-gridit-step-btn"
                onClick={() => cycleSize(-1)}
                aria-label="Smaller board size"
              >
                <ChevronLeft size={18} strokeWidth={2.8} />
              </button>

              <div className="ens-gridit-size-value">
                {selectedShape.sizes[sizeId].label}
              </div>

              <button
                type="button"
                className="ens-gridit-step-btn"
                onClick={() => cycleSize(1)}
                aria-label="Larger board size"
              >
                <ChevronRight size={18} strokeWidth={2.8} />
              </button>
            </div>
          </section>

          {/* Timer Selection */}
          <section className="ens-gridit-setup-card">
            <div className="ens-gridit-setup-label">
              <Clock size={14} color="#7dd3fc" />
              <span>Match Timer</span>
            </div>

            <div className="ens-gridit-timer-pills">
              {TIMER_OPTIONS.map((opt) => {
                const active = durationSeconds === opt.seconds;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    className={`ens-gridit-timer-pill ${active ? 'is-selected' : ''}`}
                    onClick={() => setDurationSeconds(opt.seconds)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Mods Selector (Strictly the 5 Approved Mods + 5x Cap) */}
          <section className="ens-gridit-setup-card">
            <div className="ens-gridit-setup-label">
              <Sliders size={14} color="#f472b6" />
              <span>Mods</span>
            </div>
            <GridItModToggles mods={mods} onChange={setMods} />
          </section>

          {/* Language Pack Selector */}
          <section className="ens-gridit-setup-card">
            <div className="ens-gridit-setup-label">
              <Globe size={14} color="#67e8f9" />
              <span>Dictionary Language</span>
            </div>
            <div className="ens-gridit-timer-pills" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {GRIDIT_LANGUAGES.map((pack) => {
                const active = pack.code === language;
                return (
                  <button
                    key={pack.code}
                    type="button"
                    className={`ens-gridit-timer-pill ${active ? 'is-selected' : ''}`}
                    onClick={() => setLanguage(pack.code)}
                  >
                    {pack.name} {!pack.installed ? '(Soon)' : ''}
                  </button>
                );
              })}
            </div>
            <div className="ens-gridit-shape-desc">
              {selectedLang.wordCountLabel} &bull; {selectedLang.note}
            </div>
          </section>

          <div className="ens-gridit-provisional-note">
            Provisional scoring: 3L = 1pt • 4L = 2pt • 5L = 4pt • 6L = 7pt • 7L = 11pt+
          </div>

          <button
            type="button"
            className="ens-gridit-green-cta"
            onClick={() =>
              onStartMatch({
                shapeId,
                sizeId,
                durationSeconds,
                mods,
                language: selectedLang.installed ? selectedLang.code : 'en',
              })
            }
          >
            <Play size={20} fill="#ffffff" color="#ffffff" />
            <span>Start Solo Match</span>
          </button>
        </div>
      </div>
    </div>
  );
};
