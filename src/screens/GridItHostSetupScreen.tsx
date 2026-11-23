import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Globe,
  Link2,
  Play,
  Sliders,
  Sparkles,
  Users,
} from 'lucide-react';
import { GRIDIT_LANGUAGES } from '../../shared/gridit/languages';
import { DEFAULT_GRIDIT_MODS, GridItModConfig } from '../../shared/gridit/mods';
import { GridItMatchMode, GridItRoomSettings } from '../../shared/gridit/multiplayerTypes';
import { GRIDIT_SHAPES, getShapeTemplate } from '../../shared/gridit/shapes';
import { GridItBoardSize, GridItShapeId } from '../../shared/gridit/types';
import { GridItModToggles } from '../components/GridItModToggles';
import { GridItShapeMiniPreview } from '../components/GridItShapePreview';

interface GridItHostSetupScreenProps {
  defaultMode?: GridItMatchMode;
  onBack: () => void;
  onCreateRoom: (params: {
    name: string;
    settings: Partial<GridItRoomSettings>;
  }) => Promise<void>;
}

const SIZE_ORDER: GridItBoardSize[] = ['small', 'medium', 'large'];
const TIMER_OPTIONS = [
  { seconds: 90, label: '1:30' },
  { seconds: 120, label: '2:00' },
  { seconds: 180, label: '3:00' },
];

export const GridItHostSetupScreen: React.FC<GridItHostSetupScreenProps> = ({
  defaultMode = 'board_battle',
  onBack,
  onCreateRoom,
}) => {
  const [roomName, setRoomName] = useState(
    defaultMode === 'board_battle' ? 'Board Battle Arena' : 'GridIt Room'
  );
  const [mode, setMode] = useState<GridItMatchMode>(
    defaultMode === 'board_battle' ? 'board_battle' : 'classic'
  );
  const [shapeId, setShapeId] = useState<GridItShapeId>('heart');
  const [sizeId, setSizeId] = useState<GridItBoardSize>('medium');
  const [durationSeconds, setDurationSeconds] = useState<number>(120);
  const [capacity, setCapacity] = useState<number>(2);
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [allowSpectators, setAllowSpectators] = useState<boolean>(true);
  const [language, setLanguage] = useState<string>('en');
  const [mods, setMods] = useState<GridItModConfig>({
    ...DEFAULT_GRIDIT_MODS,
    rainbowWildcard: true,
    goldenLetter: true,
    comboFever: true,
  });
  const [creating, setCreating] = useState(false);

  const selectedShape = getShapeTemplate(shapeId);
  const sizeIndex = SIZE_ORDER.indexOf(sizeId);
  const cycleSize = (delta: number) => {
    const next = (sizeIndex + delta + SIZE_ORDER.length) % SIZE_ORDER.length;
    setSizeId(SIZE_ORDER[next]);
  };

  const handleSubmit = async () => {
    if (creating) return;
    setCreating(true);
    try {
      await onCreateRoom({
        name: roomName.trim() || 'GridIt Arena',
        settings: {
          mode,
          shapeId,
          sizeId,
          durationSeconds,
          capacity,
          isPublic,
          allowSpectators,
          language,
          mods,
        },
      });
    } finally {
      setCreating(false);
    }
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
        <div className="ens-gridit-wrap" style={{ paddingBottom: 24 }}>
          {/* Header matching Approved GridIt Mockup Screen 2 */}
          <header className="ens-gridit-setup-header">
            <button
              type="button"
              className="ens-exit-hub-btn is-compact"
              onClick={onBack}
              aria-label="Back"
            >
              <ArrowLeft size={15} strokeWidth={2.8} />
            </button>
            <div className="ens-gridit-setup-title-wrap">
              <div className="ens-gridit-setup-title">GridIt — Host Setup</div>
              <div className="ens-gridit-setup-sub">
                Create a match and customize your game
              </div>
            </div>
          </header>

          {/* Shape Template Card */}
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
          </section>

          {/* Board Size Stepper Card */}
          <section className="ens-gridit-setup-card">
            <div className="ens-gridit-setup-label">
              <span>Board Size</span>
            </div>
            <div className="ens-gridit-size-stepper">
              <button
                type="button"
                className="ens-gridit-step-btn"
                onClick={() => cycleSize(-1)}
                aria-label="Smaller board"
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
                aria-label="Larger board"
              >
                <ChevronRight size={18} strokeWidth={2.8} />
              </button>
            </div>
          </section>

          {/* Mods Card (Strictly 5 Approved Mods + 5x Cap) */}
          <section className="ens-gridit-setup-card">
            <div className="ens-gridit-setup-label">
              <Sliders size={14} color="#f472b6" />
              <span>Mods</span>
            </div>
            <GridItModToggles mods={mods} onChange={setMods} />
          </section>

          {/* Room Settings Card matching Mockup Screen 2 bottom */}
          <section className="ens-gridit-setup-card">
            <div className="ens-gridit-setup-label">
              <Link2 size={14} color="#7dd3fc" />
              <span>Match Options</span>
            </div>

            <input
              type="text"
              maxLength={40}
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Room name..."
              className="ens-gridit-editor-name-input"
              aria-label="Room name"
            />

            <div className="ens-gridit-host-row">
              <span className="ens-gridit-host-key">Mode</span>
              <div className="ens-gridit-host-seg">
                <button
                  type="button"
                  className={`ens-gridit-mini-pill ${mode === 'classic' ? 'is-on' : ''}`}
                  onClick={() => setMode('classic')}
                >
                  Classic
                </button>
                <button
                  type="button"
                  className={`ens-gridit-mini-pill ${mode === 'board_battle' ? 'is-on' : ''}`}
                  onClick={() => setMode('board_battle')}
                >
                  Board Battle
                </button>
              </div>
            </div>

            <div className="ens-gridit-host-row">
              <span className="ens-gridit-host-key">
                <Users size={13} /> Players
              </span>
              <div className="ens-gridit-host-seg">
                {[2, 4, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`ens-gridit-mini-pill ${capacity === n ? 'is-on' : ''}`}
                    onClick={() => setCapacity(n)}
                  >
                    {n === 2 ? '2 Players (1v1)' : `${n}P`}
                  </button>
                ))}
              </div>
            </div>

            <div className="ens-gridit-host-row">
              <span className="ens-gridit-host-key">
                <Clock size={13} /> Duration
              </span>
              <div className="ens-gridit-host-seg">
                {TIMER_OPTIONS.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    className={`ens-gridit-mini-pill ${durationSeconds === t.seconds ? 'is-on' : ''}`}
                    onClick={() => setDurationSeconds(t.seconds)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ens-gridit-host-row">
              <span className="ens-gridit-host-key">
                <Globe size={13} /> Language
              </span>
              <div className="ens-gridit-host-seg">
                {GRIDIT_LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    className={`ens-gridit-mini-pill ${language === l.code ? 'is-on' : ''}`}
                    onClick={() => setLanguage(l.code)}
                    title={l.note}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="ens-gridit-host-row">
              <span className="ens-gridit-host-key">Visibility</span>
              <div className="ens-gridit-host-seg">
                <button
                  type="button"
                  className={`ens-gridit-mini-pill ${isPublic ? 'is-on' : ''}`}
                  onClick={() => setIsPublic(true)}
                >
                  Public
                </button>
                <button
                  type="button"
                  className={`ens-gridit-mini-pill ${!isPublic ? 'is-on' : ''}`}
                  onClick={() => setIsPublic(false)}
                >
                  Private
                </button>
              </div>
            </div>

            <div className="ens-gridit-host-row">
              <span className="ens-gridit-host-key">
                <Eye size={13} /> Allow Spectators
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={allowSpectators}
                aria-label="Allow Spectators"
                className={`ens-gridit-switch ${allowSpectators ? 'is-on' : ''}`}
                onClick={() => setAllowSpectators((v) => !v)}
              >
                <span className="ens-gridit-switch-thumb" />
              </button>
            </div>
          </section>

          <button
            type="button"
            className="ens-gridit-green-cta"
            onClick={handleSubmit}
            disabled={creating}
          >
            <Play size={19} fill="#ffffff" color="#ffffff" />
            <span>{creating ? 'Creating Room...' : 'Create Match'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
