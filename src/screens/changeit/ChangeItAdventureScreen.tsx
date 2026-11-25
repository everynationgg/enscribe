import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Lock,
  Play,
  RotateCcw,
  Star,
  Target,
} from 'lucide-react';
import { ChangeItAdventureProgressClient } from '../../../shared/types';

interface ChangeItAdventureScreenProps {
  progress: ChangeItAdventureProgressClient;
  onBack: () => void;
  onStartStage: (stageId: string) => Promise<void>;
  onOpenClassicSolo?: () => void;
}

export const ChangeItAdventureScreen: React.FC<ChangeItAdventureScreenProps> = ({
  progress,
  onBack,
  onStartStage,
  onOpenClassicSolo,
}) => {
  const defaultChapterIdx = useMemo(() => {
    const idx = progress.chapters.findIndex(
      (c) => c.unlocked && c.stages.some((s) => s.unlocked && !s.completed)
    );
    return idx >= 0 ? idx : 0;
  }, [progress.chapters]);

  const [selectedChapterIdx, setSelectedChapterIdx] = useState(defaultChapterIdx);
  const [launchingStageId, setLaunchingStageId] = useState<string | null>(null);

  const chapter = progress.chapters[selectedChapterIdx] ?? progress.chapters[0];

  const handlePlay = async (stageId: string) => {
    if (launchingStageId) return;
    setLaunchingStageId(stageId);
    try {
      await onStartStage(stageId);
    } finally {
      setLaunchingStageId(null);
    }
  };

  return (
    <div className="ci-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />
      <header className="ci-topbar">
        <button
          type="button"
          className="ci-icon-btn"
          onClick={onBack}
          aria-label="Back to ChangeIt"
        >
          <ArrowLeft size={18} strokeWidth={2.8} />
        </button>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <Compass size={18} color="#22d3ee" />
          <span style={{ fontSize: 17, fontWeight: 900 }}>Single Player</span>
        </div>
        <div className="ci-pill is-amber">
          <Star size={12} fill="#fde047" color="#fde047" />
          <span>
            {progress.totalStars}/{progress.maxStars}
          </span>
        </div>
      </header>

      <div className="ci-scroll">
        <div className="ci-wrap">
          {onOpenClassicSolo && (
            <div
              role="tablist"
              aria-label="ChangeIt Single Player Modes"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 6,
                padding: 4,
                borderRadius: 16,
                background: 'rgba(11, 18, 66, 0.84)',
                border: '1.5px solid rgba(34, 211, 238, 0.35)',
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
                  border: '1.5px solid rgba(165, 243, 252, 0.8)',
                  background: 'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: 'default',
                }}
              >
                <Compass size={14} />
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
                  color: '#cffafe',
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
          {/* Chapter Selector Strip */}
          <div
            style={{
              display: 'flex',
              gap: 7,
              overflowX: 'auto',
              paddingBottom: 4,
              scrollbarWidth: 'none',
            }}
          >
            {progress.chapters.map((ch, idx) => {
              const active = idx === selectedChapterIdx;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setSelectedChapterIdx(idx)}
                  style={{
                    flexShrink: 0,
                    padding: '8px 12px',
                    borderRadius: 14,
                    border: active
                      ? '2px solid #22d3ee'
                      : '1.5px solid rgba(165, 243, 252, 0.28)',
                    background: active ? ch.accentGradient : 'rgba(18, 28, 96, 0.85)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    opacity: ch.unlocked ? 1 : 0.68,
                  }}
                >
                  <div style={{ fontSize: 10.5, fontWeight: 900, opacity: 0.9 }}>
                    CH {ch.chapterNumber} {!ch.unlocked && '🔒'}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 900 }}>{ch.title}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: '#fef08a', marginTop: 2 }}>
                    ★ {ch.earnedStars}/{ch.totalStars}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Chapter Banner */}
          <div
            className="ci-card"
            style={{
              background: chapter.accentGradient,
              borderColor: 'rgba(255,255,255,0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', opacity: 0.92 }}>
                  Chapter {chapter.chapterNumber} • {chapter.theme}
                </div>
                <div style={{ fontSize: 19, fontWeight: 900, marginTop: 2 }}>{chapter.title}</div>
                <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 700, opacity: 0.95 }}>
                  {chapter.description}
                </p>
              </div>
              <div className="ci-pill is-amber" style={{ flexShrink: 0 }}>
                <Star size={12} fill="#fde047" color="#fde047" />
                <span>
                  {chapter.earnedStars}/{chapter.totalStars}
                </span>
              </div>
            </div>
          </div>

          {/* Chapter Levels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chapter.stages.map((st) => {
              const isBusy = launchingStageId === st.id;
              return (
                <div
                  key={st.id}
                  className="ci-card"
                  style={{
                    opacity: st.unlocked ? 1 : 0.62,
                    borderColor: st.completed
                      ? 'rgba(52, 211, 153, 0.55)'
                      : st.unlocked
                        ? 'rgba(34, 211, 238, 0.55)'
                        : 'rgba(148, 163, 184, 0.25)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className="ci-pill is-cyan">{st.label}</span>
                        <span style={{ fontSize: 14.5, fontWeight: 900 }}>
                          {st.title} {st.isFinale ? '★' : ''}
                        </span>
                        {st.completed && <CheckCircle2 size={15} color="#34d399" />}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        <strong style={{ fontSize: 14, letterSpacing: '0.1em', color: '#e0f2fe' }}>
                          {st.startWord}
                        </strong>
                        <ArrowRight size={14} color="#22d3ee" />
                        <strong style={{ fontSize: 14, letterSpacing: '0.1em', color: '#6ee7b7' }}>
                          {st.targetWord}
                        </strong>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd' }}>
                          • Min {st.minMoves} moves • +{st.rewardCoins} coins
                        </span>
                      </div>

                      {st.completed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, fontSize: 11.5, fontWeight: 800, color: '#fde68a' }}>
                          <span style={{ display: 'inline-flex', gap: 2 }}>
                            {[1, 2, 3].map((n) => (
                              <Star
                                key={n}
                                size={13}
                                fill={n <= st.bestStars ? '#fde047' : 'rgba(255,255,255,0.18)'}
                                color={n <= st.bestStars ? '#fde047' : 'rgba(255,255,255,0.3)'}
                              />
                            ))}
                          </span>
                          {st.fewestMoves !== null && <span>Best: {st.fewestMoves} moves</span>}
                          {st.bestTimeMs !== null && (
                            <span>{(st.bestTimeMs / 1000).toFixed(1)}s</span>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={!st.unlocked || Boolean(launchingStageId)}
                      onClick={() => handlePlay(st.id)}
                      className={st.completed ? 'ci-pill is-green' : 'ci-cta-cyan'}
                      style={{
                        width: 'auto',
                        minHeight: 38,
                        padding: '0 14px',
                        flexShrink: 0,
                        cursor: st.unlocked ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {!st.unlocked ? (
                        <>
                          <Lock size={14} />
                          <span>Locked</span>
                        </>
                      ) : isBusy ? (
                        <span>Loading...</span>
                      ) : st.completed ? (
                        <>
                          <RotateCcw size={13} />
                          <span>Replay</span>
                        </>
                      ) : (
                        <>
                          <Play size={14} fill="currentColor" />
                          <span>Play</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
