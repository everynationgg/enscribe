import React, { useMemo, useState } from 'react';
import { Award, Lock, Play, Star, Target } from 'lucide-react';
import { Profile, SoloStage } from '../../shared/types';
import { FantasyPageHeader } from '../components/FantasyPageHeader';
import {
  GiftBoxIcon,
  GoldCrownIcon,
  MountainFlagIcon,
  PurpleGemIcon,
} from '../components/GameIcons';
import { GradientButton } from '../components/GradientButton';
import { ProgressStars } from '../components/ProgressStars';
import { RoundedTabs } from '../components/RoundedTabs';

interface SoloScreenProps {
  profile: Profile;
  soloStages: SoloStage[];
  onBack: () => void;
  onStartSoloStage: (stageId: string) => Promise<void>;
}

type SoloTab = 'adventure' | 'challenges' | 'trials';

const STAGE_ART_BY_INDEX = [
  '/art/stage-coastal.png',
  '/art/stage-ruin.png',
  '/art/stage-echo.png',
  '/art/stage-mistfall.png',
  '/art/room-castle.png',
  '/art/room-crystals.png',
];

export const SoloScreen: React.FC<SoloScreenProps> = ({
  profile,
  soloStages,
  onBack,
  onStartSoloStage,
}) => {
  const [activeTab, setActiveTab] = useState<SoloTab>('adventure');
  const [showHelp, setShowHelp] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  const defaultSelected = useMemo(
    () => soloStages.find((s) => !s.completed) ?? soloStages[0] ?? null,
    [soloStages]
  );
  const [selectedId, setSelectedId] = useState<string | null>(defaultSelected?.id ?? null);

  const selectedStage =
    soloStages.find((s) => s.id === selectedId) ?? defaultSelected;

  const completedCount = soloStages.filter((s) => s.completed).length;
  const totalStages = soloStages.length;
  const totalStars = totalStages * 3;
  const earnedStars = completedCount * 3;
  const progressPct = totalStages > 0 ? Math.round((completedCount / totalStages) * 100) : 0;

  // Real Match Points earned per solved word in ChainClashEngine (+10 MP per word)
  const chapterTotalMp = soloStages.reduce((sum, s) => sum + s.wordCount * 10, 0);

  const handleLaunchStage = async (stageId: string) => {
    if (startingId) return;
    setStartingId(stageId);
    try {
      await onStartSoloStage(stageId);
    } finally {
      setStartingId(null);
    }
  };

  return (
    <div className="ens-fantasy-page ens-subpage-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <FantasyPageHeader
        title="Solo"
        subtitle="Play alone, solve challenges, and progress at your own pace."
        icon={<MountainFlagIcon size={34} />}
        backdropSrc="/art/header-fantasy.png"
        onBack={onBack}
        onHelp={() => setShowHelp(true)}
      />

      <div className="ens-subpage-scroll">
        <div className="ens-subpage-inner">
          <RoundedTabs<SoloTab>
            ariaLabel="Solo sections"
            value={activeTab}
            onChange={setActiveTab}
            options={[
              {
                id: 'adventure',
                label: 'Adventure',
                icon: <Play size={14} fill="currentColor" />,
              },
              {
                id: 'challenges',
                label: 'Challenges',
                icon: <Target size={15} />,
              },
              {
                id: 'trials',
                label: 'Trials',
                icon: <Award size={15} />,
              },
            ]}
          />

          {activeTab === 'adventure' && (
            <>
              {/* Chapter 1 Scenic Banner */}
              <div className="ens-chapter-card">
                <img
                  src="/art/chapter1-banner-art.png"
                  alt=""
                  className="ens-chapter-art"
                  aria-hidden="true"
                />
                <div className="ens-chapter-content">
                  <div className="ens-chapter-eyebrow">Chapter 1</div>
                  <div className="ens-chapter-title">The Word Isles</div>

                  <div className="ens-chapter-stars-row">
                    <Star size={17} fill="#FFD54A" color="#FFD54A" />
                    <span>
                      {earnedStars} / {totalStars}
                    </span>
                  </div>

                  <div className="ens-chapter-track" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
                    <div
                      className="ens-chapter-fill"
                      style={{ width: `${Math.max(progressPct, completedCount > 0 ? 12 : 4)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Stage List */}
              <div className="ens-stage-list">
                {soloStages.map((stage, idx) => {
                  const isSelected = selectedStage?.id === stage.id;
                  const thumbSrc = STAGE_ART_BY_INDEX[idx % STAGE_ART_BY_INDEX.length];
                  return (
                    <div
                      key={stage.id}
                      className={`ens-stage-row ${isSelected ? 'is-selected' : ''} ${stage.completed ? 'is-done' : ''}`}
                      onClick={() => setSelectedId(stage.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedId(stage.id);
                        }
                      }}
                    >
                      <div className="ens-stage-thumb-frame">
                        <img src={thumbSrc} alt="" className="ens-stage-thumb-img" />
                      </div>

                      <div className="ens-stage-meta">
                        <div className="ens-stage-num">
                          Stage {stage.stageNumber} • {stage.theme}
                        </div>
                        <div className="ens-stage-title">{stage.title}</div>
                      </div>

                      <div className="ens-stage-right">
                        <ProgressStars earned={stage.completed ? 3 : 0} size={18} />
                        <button
                          type="button"
                          className="ens-stage-play-circle"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(stage.id);
                            handleLaunchStage(stage.id);
                          }}
                          disabled={startingId !== null}
                          aria-label={`Play Stage ${stage.stageNumber}: ${stage.title}`}
                        >
                          <Play size={15} fill="#5C28E6" color="#5C28E6" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chapter Rewards Panel (Honest Match Points from backend) */}
              <div className="ens-rewards-panel">
                <div className="ens-rewards-left">
                  <GiftBoxIcon size={36} />
                  <div>
                    <div className="ens-rewards-title">Chapter Rewards</div>
                    <div className="ens-rewards-sub">
                      Complete all stages ({completedCount}/{totalStages})
                    </div>
                  </div>
                </div>

                <div className="ens-rewards-boxes">
                  <div className="ens-reward-box" title="Total chapter Match Points earned from solving words">
                    <GoldCrownIcon size={22} />
                    <span>×{chapterTotalMp} MP</span>
                  </div>
                  <div className="ens-reward-box" title="Your current Match Points balance">
                    <PurpleGemIcon size={22} />
                    <span>{profile.matchPointsBalance}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab !== 'adventure' && (
            <div className="ens-coming-soon-card">
              <div className="ens-coming-lock">
                <Lock size={26} color="#E6D8FF" />
              </div>
              <div className="ens-coming-title">
                {activeTab === 'challenges' ? 'Daily Challenges' : 'Master Trials'} — Coming Soon
              </div>
              <p className="ens-coming-sub">
                Timed solo sprints and ranked gauntlet trials are not yet active. Switch back to Adventure to play all {totalStages} themed stages!
              </p>
              <GradientButton
                variant="lavender"
                size="md"
                onClick={() => setActiveTab('adventure')}
              >
                Back to Adventure
              </GradientButton>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sticky Action */}
      {activeTab === 'adventure' && selectedStage && (
        <div className="ens-sticky-cta-bar">
          <GradientButton
            variant="radiant"
            size="lg"
            fullWidth
            loading={startingId === selectedStage.id}
            leftIcon={<Play size={18} fill="#FFFFFF" color="#FFFFFF" />}
            onClick={() => handleLaunchStage(selectedStage.id)}
          >
            {startingId === selectedStage.id
              ? 'Starting Stage...'
              : `${selectedStage.completed ? 'Replay' : 'Start'} Stage ${selectedStage.stageNumber}`}
          </GradientButton>
        </div>
      )}

      {showHelp && (
        <div className="ens-modal-backdrop" onClick={() => setShowHelp(false)}>
          <div className="ens-modal-card ens-fantasy-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: '#FFFFFF' }}>
              How Solo Adventure Works
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: 13.5, color: '#D4DCFF', lineHeight: 1.5 }}>
              Each stage gives you a themed word chain starting from the top anchor word. Solve each linked word in order at your own pace with no turn timer. Every word you solve awards +10 Match Points (MP).
            </p>
            <GradientButton variant="lavender" size="md" fullWidth onClick={() => setShowHelp(false)}>
              Got It
            </GradientButton>
          </div>
        </div>
      )}
    </div>
  );
};
