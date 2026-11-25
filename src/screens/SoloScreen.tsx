import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Clock,
  Flame,
  Layers,
  Lock,
  Play,
  Shuffle,
  Sliders,
  Sparkles,
  Star,
  Target,
} from 'lucide-react';
import {
  ChainItPracticeConfig,
  ChainItPracticeDifficulty,
  Profile,
  SoloStage,
  Template,
} from '../../shared/types';
import { ChainItPracticeStats } from '../games/chainit/offlineSolo';
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
  initialTab?: SoloTab;
  templates?: Template[];
  practiceStats?: ChainItPracticeStats;
  onBack: () => void;
  onStartSoloStage: (stageId: string) => Promise<void>;
  onStartPractice?: (config: ChainItPracticeConfig) => Promise<void>;
}

export type SoloTab = 'adventure' | 'practice' | 'challenges';

const PRACTICE_THEMES = [
  { id: 'mix', label: 'Random Mix' },
  { id: 'Everyday', label: 'Everyday' },
  { id: 'Fantasy', label: 'Fantasy' },
  { id: 'Science Fiction', label: 'Sci-Fi' },
  { id: 'Nature', label: 'Nature' },
  { id: 'Food', label: 'Food' },
  { id: 'Sports', label: 'Sports' },
  { id: 'Music', label: 'Music' },
  { id: 'Mystery', label: 'Mystery' },
  { id: 'Animals', label: 'Animals' },
];

const PRACTICE_DIFFICULTIES: Array<{
  id: ChainItPracticeDifficulty;
  label: string;
  desc: string;
}> = [
  {
    id: 'relaxed',
    label: 'Relaxed',
    desc: 'Full chain visible • Hint clue unlocks after 1 miss',
  },
  {
    id: 'standard',
    label: 'Standard',
    desc: 'Full chain visible • Clue after 2 misses',
  },
  {
    id: 'challenge',
    label: 'Challenge',
    desc: 'Progressive hidden links • Clue after 3 misses',
  },
];

const PRACTICE_LENGTHS = [4, 5, 6, 7, 8];
const PRACTICE_TIMERS = [
  { seconds: 0, label: 'Untimed' },
  { seconds: 20, label: '20s' },
  { seconds: 30, label: '30s' },
  { seconds: 45, label: '45s' },
];

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
  initialTab = 'adventure',
  templates = [],
  practiceStats = { chainsCompleted: 0, wordsSolved: 0, currentStreak: 0, bestStreak: 0 },
  onBack,
  onStartSoloStage,
  onStartPractice,
}) => {
  const [activeTab, setActiveTab] = useState<SoloTab>(initialTab);
  const [showHelp, setShowHelp] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  const [practiceTheme, setPracticeTheme] = useState<string>('mix');
  const [practiceLength, setPracticeLength] = useState<number>(5);
  const [practiceDifficulty, setPracticeDifficulty] =
    useState<ChainItPracticeDifficulty>('standard');
  const [practiceTimerSec, setPracticeTimerSec] = useState<number>(0);
  const [practiceTemplateId, setPracticeTemplateId] = useState<string>('');
  const [startingPractice, setStartingPractice] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const chainTemplates = useMemo(
    () => templates.filter((t) => t.words.length >= 3 && t.theme.toLowerCase() !== 'changeit'),
    [templates]
  );

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

  const handleLaunchPractice = async () => {
    if (!onStartPractice || startingPractice) return;
    setStartingPractice(true);
    try {
      await onStartPractice({
        theme: practiceTheme,
        chainLength: practiceLength,
        difficulty: practiceDifficulty,
        timePerWordSeconds: practiceTimerSec,
        templateId: practiceTemplateId || null,
      });
    } finally {
      setStartingPractice(false);
    }
  };

  return (
    <div className="ens-fantasy-page ens-subpage-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <FantasyPageHeader
        title="Solo"
        subtitle="Play alone, practice custom chains, and progress at your own pace."
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
                id: 'practice',
                label: 'Classic Round',
                icon: <Target size={15} />,
              },
              {
                id: 'challenges',
                label: 'Challenges',
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

          {activeTab === 'practice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Practice Stats Banner */}
              <div
                className="ens-rewards-panel"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(45, 55, 145, 0.85) 100%)',
                  borderColor: 'rgba(134, 239, 172, 0.5)',
                }}
              >
                <div className="ens-rewards-left">
                  <Target size={30} color="#86efac" />
                  <div>
                    <div className="ens-rewards-title">ChainIt Practice</div>
                    <div className="ens-rewards-sub">
                      Train solo with custom length, clues &amp; hints
                    </div>
                  </div>
                </div>
                <div className="ens-rewards-boxes">
                  <div className="ens-reward-box" title="Chains cleared in Practice">
                    <Sparkles size={15} color="#fde047" />
                    <span>{practiceStats.chainsCompleted} runs</span>
                  </div>
                  <div className="ens-reward-box" title="Clean streak without skipping">
                    <Flame size={15} color="#fb923c" />
                    <span>{practiceStats.bestStreak} best</span>
                  </div>
                </div>
              </div>

              {/* Theme Picker */}
              <div className="ens-play-code-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="ens-play-section-label">
                  <Shuffle size={14} color="#86efac" />
                  <span>Chain Theme</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {PRACTICE_THEMES.map((t) => {
                    const selected = !practiceTemplateId && practiceTheme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setPracticeTemplateId('');
                          setPracticeTheme(t.id);
                        }}
                        style={{
                          borderRadius: 999,
                          padding: '7px 12px',
                          fontSize: 12.5,
                          fontWeight: 800,
                          cursor: 'pointer',
                          border: selected
                            ? '1.5px solid #86efac'
                            : '1px solid rgba(165, 180, 252, 0.35)',
                          background: selected
                            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                            : 'rgba(20, 30, 88, 0.72)',
                          color: '#ffffff',
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {chainTemplates.length > 0 && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 800, color: '#cbd5ff' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Layers size={13} color="#a78bfa" />
                      <span>Or practice a saved/official template (optional)</span>
                    </span>
                    <select
                      value={practiceTemplateId}
                      onChange={(e) => setPracticeTemplateId(e.target.value)}
                      className="ens-select-pill"
                      style={{ width: '100%', height: 38 }}
                    >
                      <option value="">Auto-generate fresh chain</option>
                      {chainTemplates.slice(0, 24).map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name} ({tpl.words.length} words • {tpl.theme})
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {/* Chain Length & Per-Word Timer */}
              <div className="ens-play-code-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {!practiceTemplateId && (
                  <div>
                    <div className="ens-play-section-label" style={{ marginBottom: 7 }}>
                      <Sliders size={14} color="#7dd3fc" />
                      <span>Chain Length</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 7 }}>
                      {PRACTICE_LENGTHS.map((len) => {
                        const selected = practiceLength === len;
                        return (
                          <button
                            key={len}
                            type="button"
                            onClick={() => setPracticeLength(len)}
                            style={{
                              minHeight: 38,
                              borderRadius: 12,
                              fontSize: 13.5,
                              fontWeight: 900,
                              cursor: 'pointer',
                              border: selected
                                ? '1.5px solid #7dd3fc'
                                : '1px solid rgba(165, 180, 252, 0.35)',
                              background: selected
                                ? 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)'
                                : 'rgba(20, 30, 88, 0.72)',
                              color: '#ffffff',
                            }}
                          >
                            {len}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <div className="ens-play-section-label" style={{ marginBottom: 7 }}>
                    <Clock size={14} color="#fde047" />
                    <span>Per-Word Timer</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
                    {PRACTICE_TIMERS.map((opt) => {
                      const selected = practiceTimerSec === opt.seconds;
                      return (
                        <button
                          key={opt.seconds}
                          type="button"
                          onClick={() => setPracticeTimerSec(opt.seconds)}
                          style={{
                            minHeight: 38,
                            borderRadius: 12,
                            fontSize: 12.5,
                            fontWeight: 900,
                            cursor: 'pointer',
                            border: selected
                              ? '1.5px solid #fde047'
                              : '1px solid rgba(165, 180, 252, 0.35)',
                            background: selected
                              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                              : 'rgba(20, 30, 88, 0.72)',
                            color: '#ffffff',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Difficulty Preset */}
              <div className="ens-play-code-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="ens-play-section-label">
                  <Award size={14} color="#c4b5fd" />
                  <span>Difficulty &amp; Clues</span>
                </div>
                {PRACTICE_DIFFICULTIES.map((d) => {
                  const selected = practiceDifficulty === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setPracticeDifficulty(d.id)}
                      style={{
                        textAlign: 'left',
                        borderRadius: 14,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        border: selected
                          ? '1.5px solid #c4b5fd'
                          : '1px solid rgba(165, 180, 252, 0.28)',
                        background: selected
                          ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.55) 0%, rgba(59, 130, 246, 0.45) 100%)'
                          : 'rgba(18, 28, 82, 0.7)',
                        color: '#ffffff',
                      }}
                    >
                      <div style={{ fontSize: 13.5, fontWeight: 900 }}>{d.label}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#dbeafe', marginTop: 2 }}>
                        {d.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'challenges' && (
            <div className="ens-coming-soon-card">
              <div className="ens-coming-lock">
                <Lock size={26} color="#E6D8FF" />
              </div>
              <div className="ens-coming-title">Daily Challenges — Coming Soon</div>
              <p className="ens-coming-sub">
                Timed daily challenge brackets are coming soon. Play unlimited custom runs in Practice or clear all {totalStages} Adventure stages!
              </p>
              <GradientButton
                variant="lavender"
                size="md"
                onClick={() => setActiveTab('practice')}
              >
                Open Practice Mode
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

      {activeTab === 'practice' && onStartPractice && (
        <div className="ens-sticky-cta-bar">
          <GradientButton
            variant="radiant"
            size="lg"
            fullWidth
            loading={startingPractice}
            leftIcon={<Play size={18} fill="#FFFFFF" color="#FFFFFF" />}
            onClick={handleLaunchPractice}
          >
            {startingPractice ? 'Generating Chain...' : 'Start Practice Chain'}
          </GradientButton>
        </div>
      )}

      {showHelp && (
        <div className="ens-modal-backdrop" onClick={() => setShowHelp(false)}>
          <div className="ens-modal-card ens-fantasy-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: '#FFFFFF' }}>
              How ChainIt Solo &amp; Practice Work
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: 13.5, color: '#D4DCFF', lineHeight: 1.5 }}>
              In Adventure, solve themed stages to unlock progress. In Practice Mode, choose any theme, chain length, difficulty, or per-word timer — and use Hint or Skip Word anytime without risking rank points. Every word you solve directly awards +10 Match Points (MP).
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
