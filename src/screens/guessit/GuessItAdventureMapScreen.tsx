import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  Film,
  Grid,
  Info,
  Lock,
  Map as MapIcon,
  Play,
  Star,
  Target,
} from 'lucide-react';
import { GuessItAdventureProgressClient } from '../../../shared/guessit/types';

interface GuessItAdventureMapScreenProps {
  progress: GuessItAdventureProgressClient;
  onBack: () => void;
  onStartStage: (stageId: string) => Promise<void>;
  onOpenClassicSolo?: () => void;
}

export const GuessItAdventureMapScreen: React.FC<GuessItAdventureMapScreenProps> = ({
  progress,
  onBack,
  onStartStage,
  onOpenClassicSolo,
}) => {
  const chapter = progress.chapters[0];
  const defaultStage = useMemo(() => {
    const firstUnlockedUnfinished = chapter.stages.find(
      (s) => s.progress.unlocked && !s.progress.completed
    );
    return firstUnlockedUnfinished ?? chapter.stages[chapter.stages.length - 1] ?? chapter.stages[0];
  }, [chapter.stages]);

  const [selectedStageId, setSelectedStageId] = useState<string>(defaultStage.id);
  const [launching, setLaunching] = useState(false);
  const [showChapterInfo, setShowChapterInfo] = useState(false);

  const selectedStage =
    chapter.stages.find((s) => s.id === selectedStageId) ?? defaultStage;

  const handlePlay = async () => {
    if (!selectedStage.progress.unlocked || launching) return;
    setLaunching(true);
    try {
      await onStartStage(selectedStage.id);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="ens-guessit-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <header className="ens-guessit-topbar">
        <button
          type="button"
          className="ens-guessit-circle-btn"
          onClick={onBack}
          aria-label="Back to GuessIt Entry"
        >
          <ChevronLeft size={22} strokeWidth={2.8} />
        </button>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <MapIcon size={20} color="#7dd3fc" />
          <span className="ens-guessit-screen-title-wordmark" style={{ fontSize: 22 }}>
            Single Player
          </span>
        </div>

        <button
          type="button"
          className="ens-guessit-circle-btn"
          onClick={() => setShowChapterInfo((v) => !v)}
          aria-label="Chapter story info"
        >
          <Info size={18} />
        </button>
      </header>

      <div className="ens-guessit-scroll">
        {onOpenClassicSolo && (
          <div
            role="tablist"
            aria-label="GuessIt Single Player Modes"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
              padding: 4,
              borderRadius: 16,
              background: 'rgba(11, 18, 66, 0.84)',
              border: '1.5px solid rgba(147, 197, 253, 0.35)',
              marginBottom: 12,
            }}
          >
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
                border: '1.5px solid rgba(254, 240, 138, 0.75)',
                background: 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: 13,
                cursor: 'default',
              }}
            >
              <MapIcon size={14} />
              <span>Adventure</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={false}
              onClick={onOpenClassicSolo}
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
              <Target size={14} />
              <span>Classic Round</span>
            </button>
          </div>
        )}
        {/* Chapter 1 Header Card matching Screen 6 */}
        <div className="ens-guessit-chapter-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #c084fc 0%, #6366f1 100%)',
                border: '1.5px solid #fef08a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Film size={22} color="#fffbeb" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#fde047', textTransform: 'uppercase' }}>
                Chapter {chapter.chapterNumber} • {chapter.theme}
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#ffffff' }}>
                {chapter.title}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 10px',
              borderRadius: 999,
              background: 'rgba(12, 18, 72, 0.85)',
              border: '1px solid rgba(250, 204, 21, 0.5)',
              fontSize: 12.5,
              fontWeight: 900,
              color: '#fef08a',
              flexShrink: 0,
            }}
          >
            <Star size={14} fill="#fde047" color="#fde047" />
            <span>
              {chapter.earnedStars}/{chapter.totalStars}
            </span>
          </div>
        </div>

        {showChapterInfo && (
          <div className="ens-guessit-glass-card" style={{ marginBottom: 10, fontSize: 12.5, color: '#dbeafe' }}>
            {chapter.description}
          </div>
        )}

        {/* Scrollable Illustrated Studio Path Map */}
        <div className="ens-guessit-map-canvas">
          {/* Glowing SVG Connector Path behind nodes */}
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 320 420"
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              opacity: 0.72,
            }}
            aria-hidden="true"
          >
            <path
              d="M 75 45 C 230 65, 250 130, 85 170 C 10 195, 250 250, 240 295 C 230 335, 75 350, 155 390"
              stroke="#fde047"
              strokeWidth="4"
              strokeDasharray="10 8"
              fill="none"
              strokeLinecap="round"
            />
          </svg>

          {chapter.stages.map((st, idx) => {
            const isCompleted = st.progress.completed;
            const isUnlocked = st.progress.unlocked;
            const isSelected = st.id === selectedStage.id;
            const statusClass = isCompleted
              ? 'is-completed'
              : isUnlocked
                ? 'is-current'
                : 'is-locked';

            return (
              <div
                key={st.id}
                className={`ens-guessit-map-node-row ${idx % 2 === 1 ? 'is-right' : ''}`}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    disabled={!isUnlocked}
                    className={`ens-guessit-stage-btn ${statusClass} ${
                      isSelected ? 'is-selected' : ''
                    }`}
                    onClick={() => isUnlocked && setSelectedStageId(st.id)}
                    aria-label={`Stage ${st.label}: ${st.title}`}
                  >
                    {!isUnlocked ? (
                      <Lock size={17} />
                    ) : st.format === 'crossword' ? (
                      <Grid size={17} />
                    ) : (
                      <Film size={16} />
                    )}
                    <span>{st.label}</span>
                  </button>

                  {isCompleted && (
                    <div style={{ display: 'flex', gap: 2 }} aria-label={`${st.progress.bestStars} stars`}>
                      {[1, 2, 3].map((s) => (
                        <Star
                          key={s}
                          size={13}
                          fill={s <= st.progress.bestStars ? '#fde047' : 'rgba(255,255,255,0.2)'}
                          color={s <= st.progress.bestStars ? '#fde047' : 'rgba(255,255,255,0.35)'}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    flex: 1,
                    background: 'rgba(12, 18, 72, 0.72)',
                    border: '1px solid rgba(165, 180, 252, 0.35)',
                    borderRadius: 14,
                    padding: '8px 10px',
                    textAlign: idx % 2 === 1 ? 'right' : 'left',
                    opacity: isUnlocked ? 1 : 0.65,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff' }}>
                    {st.title} {st.isFinale ? '★' : ''}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#bae6fd' }}>
                    {st.format === 'crossword' ? 'Crossword GuessIt' : 'Classic Phrase'} • +
                    {st.rewardCoins} Coins
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Mascot Dialogue + Play CTA matching Screen 6 */}
        <div className="ens-guessit-dialogue-dock">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src="/art/hero-mascot.png"
              alt="GuessIt Cat Guide"
              style={{ width: 58, height: 58, objectFit: 'contain', flexShrink: 0 }}
            />
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#e0e7ff', lineHeight: 1.35 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fde047', marginBottom: 2 }}>
                {selectedStage.label} — {selectedStage.title}
              </div>
              {selectedStage.subtitle || chapter.mascotQuote}
            </div>
          </div>

          <button
            type="button"
            className="ens-guessit-gold-btn"
            disabled={!selectedStage.progress.unlocked || launching}
            onClick={handlePlay}
          >
            <Play size={18} fill="#3f1d00" color="#3f1d00" />
            <span>
              {launching
                ? 'Loading Stage...'
                : selectedStage.progress.completed
                  ? `Replay ${selectedStage.label}`
                  : `Play ${selectedStage.label}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
