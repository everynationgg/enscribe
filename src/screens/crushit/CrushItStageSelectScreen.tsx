import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Flame,
  Lock,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-react';
import {
  CRUSHIT_STAGES,
  CRUSHIT_TIERS,
  CRUSHIT_TOTAL_STAGES,
  getCrushItStage,
} from '../../../shared/crushit/stagesCatalog';
import { CrushItProgressionState, StageTier } from '../../../shared/crushit/types';

interface CrushItStageSelectScreenProps {
  progression: CrushItProgressionState;
  onExitToHub: () => void;
  onPlayStage: (stageNumber: number) => void;
}

export const CrushItStageSelectScreen: React.FC<CrushItStageSelectScreenProps> = ({
  progression,
  onExitToHub,
  onPlayStage,
}) => {
  const nextStageNumber = Math.max(
    1,
    Math.min(CRUSHIT_TOTAL_STAGES, progression.highestUnlockedStage || 1)
  );
  const nextStage = getCrushItStage(nextStageNumber) ?? CRUSHIT_STAGES[0];

  const [selectedTier, setSelectedTier] = useState<StageTier | 'all'>(nextStage.tier);

  const totalStars = useMemo(() => {
    return Object.values(progression.stages).reduce((acc, rec) => acc + (rec.bestStars || 0), 0);
  }, [progression.stages]);

  const maxStars = CRUSHIT_TOTAL_STAGES * 3;

  const visibleTiers = useMemo(() => {
    if (selectedTier === 'all') return CRUSHIT_TIERS;
    return CRUSHIT_TIERS.filter((t) => t.tier === selectedTier);
  }, [selectedTier]);

  return (
    <div className="ci6-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <header
        className="ci6-topbar"
        style={{
          padding: 'max(10px, env(safe-area-inset-top)) 12px 8px',
          background: 'linear-gradient(180deg, rgba(10, 20, 92, 0.92) 0%, rgba(10, 20, 92, 0.5) 100%)',
          borderBottom: '1px solid rgba(196, 181, 253, 0.25)',
        }}
      >
        <div className="ci6-topbar-left">
          <button
            type="button"
            className="ci6-icon-btn"
            onClick={onExitToHub}
            aria-label="Back to Enscribe Games Hub"
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
          <div
            className="ci6-stage-badge"
            style={{
              borderColor: 'rgba(253, 224, 71, 0.65)',
              background: 'rgba(120, 53, 15, 0.45)',
            }}
          >
            <Star size={12} fill="#fde047" color="#fde047" />
            <span>
              {totalStars}/{maxStars}
            </span>
          </div>
        </div>
      </header>

      <div className="ci6-map-scroll">
        <div className="ci6-map-wrap">
          {/* Next Available Stage Hero Card */}
          <section className="ci6-hero-card" aria-label="Continue CrushIt adventure">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#fef08a',
                  }}
                >
                  <Sparkles size={13} />
                  <span>
                    Stage {nextStage.stageNumber} of {CRUSHIT_TOTAL_STAGES} • {nextStage.tierLabel}
                  </span>
                </div>
                <h1 style={{ margin: '3px 0 0', fontSize: 22, fontWeight: 900, lineHeight: 1.15 }}>
                  {nextStage.title}
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, fontWeight: 700, color: '#f3e8ff' }}>
                  {nextStage.description}
                </p>
              </div>
              <div
                style={{
                  flexShrink: 0,
                  padding: '6px 10px',
                  borderRadius: 13,
                  background: 'rgba(11, 17, 74, 0.48)',
                  border: '1px solid rgba(255, 255, 255, 0.45)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 900 }}>{progression.completedStagesCount}/50</div>
                <div style={{ fontSize: 9.5, fontWeight: 800, opacity: 0.9 }}>Cleared</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {nextStage.objectives.map((obj) => (
                <span
                  key={obj.id}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: 'rgba(10, 16, 70, 0.45)',
                    border: '1px solid rgba(255, 255, 255, 0.36)',
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {obj.label}
                </span>
              ))}
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: 'rgba(254, 240, 138, 0.22)',
                  border: '1px solid rgba(254, 240, 138, 0.6)',
                  fontSize: 11,
                  fontWeight: 900,
                  color: '#fef08a',
                }}
              >
                {nextStage.maxMoves} Moves
              </span>
            </div>

            <button
              type="button"
              className="ci6-cta-primary"
              onClick={() => onPlayStage(nextStage.stageNumber)}
            >
              <Play size={16} fill="currentColor" />
              <span>Play Stage {nextStage.stageNumber}</span>
            </button>
          </section>

          {/* Tier Filter Strip */}
          <nav className="ci6-tier-tabs" aria-label="Stage tiers">
            <button
              type="button"
              className={`ci6-tier-tab ${selectedTier === 'all' ? 'is-active' : ''}`}
              style={
                selectedTier === 'all'
                  ? { background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }
                  : undefined
              }
              onClick={() => setSelectedTier('all')}
            >
              <div style={{ fontSize: 10, fontWeight: 900, opacity: 0.88 }}>ALL 1–50</div>
              <div style={{ fontSize: 12.5, fontWeight: 900 }}>Full Map</div>
            </button>

            {CRUSHIT_TIERS.map((tier) => {
              const active = selectedTier === tier.tier;
              const clearedInTier = CRUSHIT_STAGES.filter(
                (s) => s.tier === tier.tier && progression.stages[s.stageNumber]?.completed
              ).length;
              return (
                <button
                  key={tier.tier}
                  type="button"
                  className={`ci6-tier-tab ${active ? 'is-active' : ''}`}
                  style={active ? { background: tier.accentGradient } : undefined}
                  onClick={() => setSelectedTier(tier.tier)}
                >
                  <div style={{ fontSize: 10, fontWeight: 900, opacity: 0.9 }}>
                    {tier.rangeLabel}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 900 }}>{tier.label}</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#fde68a', marginTop: 1 }}>
                    {clearedInTier}/10 Cleared
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Stages 1–50 Sections */}
          {visibleTiers.map((tier) => {
            const tierStages = CRUSHIT_STAGES.filter((s) => s.tier === tier.tier);
            return (
              <section key={tier.tier} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div
                  style={{
                    borderRadius: 16,
                    padding: '10px 13px',
                    background: tier.accentGradient,
                    border: '1.5px solid rgba(255, 255, 255, 0.5)',
                    boxShadow: '0 8px 20px rgba(4, 10, 48, 0.42)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 15, fontWeight: 900 }}>{tier.label}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 900,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: 'rgba(10, 16, 68, 0.42)',
                      }}
                    >
                      {tier.rangeLabel}
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: 11.5, fontWeight: 700, opacity: 0.95 }}>
                    {tier.description}
                  </p>
                </div>

                <div className="ci6-stage-grid">
                  {tierStages.map((st) => {
                    const rec = progression.stages[st.stageNumber];
                    const completed = Boolean(rec?.completed);
                    const unlocked = st.stageNumber <= nextStageNumber || completed;
                    const isNext = st.stageNumber === nextStageNumber && !completed;
                    const bestStars = rec?.bestStars ?? 0;

                    return (
                      <button
                        key={st.id}
                        type="button"
                        disabled={!unlocked}
                        onClick={() => onPlayStage(st.stageNumber)}
                        className={`ci6-stage-card ${
                          !unlocked
                            ? 'is-locked'
                            : isNext
                              ? 'is-next'
                              : completed
                                ? 'is-completed'
                                : ''
                        }`}
                        aria-label={`Stage ${st.stageNumber}: ${st.title}${
                          !unlocked ? ' (Locked)' : completed ? ' (Completed)' : ' (Next stage)'
                        }`}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 4,
                            width: '100%',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 900,
                              padding: '2px 7px',
                              borderRadius: 999,
                              background: isNext
                                ? '#fde047'
                                : completed
                                  ? 'rgba(16, 185, 129, 0.3)'
                                  : 'rgba(10, 16, 68, 0.6)',
                              color: isNext ? '#3b1700' : '#ffffff',
                            }}
                          >
                            Stage {st.stageNumber}
                          </span>

                          {!unlocked ? (
                            <Lock size={14} color="#94a3b8" />
                          ) : completed ? (
                            <CheckCircle2 size={15} color="#34d399" />
                          ) : isNext ? (
                            <Flame size={15} color="#fde047" />
                          ) : null}
                        </div>

                        <div style={{ fontSize: 13.5, fontWeight: 900, lineHeight: 1.2 }}>
                          {st.title}
                        </div>

                        <div style={{ fontSize: 11, fontWeight: 700, color: '#c7d2fe' }}>
                          Goal {st.scoreTarget.toLocaleString()} • {st.maxMoves} moves
                        </div>

                        <div
                          style={{
                            marginTop: 'auto',
                            paddingTop: 4,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                          }}
                        >
                          {completed ? (
                            <>
                              <span style={{ display: 'inline-flex', gap: 2 }}>
                                {[1, 2, 3].map((n) => (
                                  <Star
                                    key={n}
                                    size={12}
                                    fill={n <= bestStars ? '#fde047' : 'rgba(255,255,255,0.16)'}
                                    color={n <= bestStars ? '#fde047' : 'rgba(255,255,255,0.28)'}
                                  />
                                ))}
                              </span>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  fontSize: 10.5,
                                  fontWeight: 900,
                                  color: '#6ee7b7',
                                }}
                              >
                                <Trophy size={10} />
                                {(rec?.bestScore ?? 0).toLocaleString()}
                              </span>
                            </>
                          ) : unlocked ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 900,
                                color: '#fde047',
                              }}
                            >
                              {isNext ? <Play size={11} fill="currentColor" /> : <RotateCcw size={11} />}
                              <span>{isNext ? 'Play Now' : 'Open'}</span>
                            </span>
                          ) : (
                            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8' }}>
                              Clear Stage {st.stageNumber - 1}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};
