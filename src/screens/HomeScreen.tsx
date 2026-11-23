import React from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, Link2, Play } from 'lucide-react';
import {
  InAppNotification,
  OngoingMatchSummary,
  Profile,
  SoloStage,
} from '../../shared/types';
import { AvatarBadge } from '../components/Artwork';
import { BrandedHeader } from '../components/BrandedHeader';
import { GameModeCard } from '../components/GameModeCard';
import {
  LightningBoltIcon,
  RoomsUsersIcon,
  SparkleClusterIcon,
  WaveHandIcon,
} from '../components/GameIcons';

interface HomeScreenProps {
  profile: Profile;
  ongoingMatches: OngoingMatchSummary[];
  soloStages: SoloStage[];
  notifications: InAppNotification[];
  rankedQueued: boolean;
  onOpenNotifications: () => void;
  onContinueMatch: (matchId: string) => void;
  onViewAllMatches: () => void;
  onRankedMatch: () => void;
  onSoloAdventure: () => void;
  onLeaderboard: () => void;
  onRooms: () => void;
  onExploreFantasy: () => void;
  onOpenProfile: () => void;
  onExitToHub: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  profile,
  ongoingMatches,
  soloStages,
  notifications,
  rankedQueued,
  onOpenNotifications,
  onContinueMatch,
  onViewAllMatches,
  onRankedMatch,
  onSoloAdventure,
  onLeaderboard,
  onRooms,
  onExploreFantasy,
  onOpenProfile,
  onExitToHub,
}) => {
  const unreadCount = notifications.filter((n) => !n.read).length;
  const primaryMatch =
    ongoingMatches.find((m) => m.isYourTurn) ?? ongoingMatches[0] ?? null;

  const nextSoloStage =
    soloStages.find((s) => !s.completed) ?? soloStages[0] ?? null;

  const modeSubtitle = (m: OngoingMatchSummary) => {
    if (m.mode === 'solo') return 'Solo Adventure';
    if (m.mode === 'speed_race') return `vs. ${m.opponentPrimaryName} • Speed Race`;
    if (m.mode === 'ranked') return `vs. ${m.opponentPrimaryName} • Ranked`;
    return `vs. ${m.opponentPrimaryName} • Classic`;
  };

  return (
    <div className="ens-fantasy-page ens-home-page">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <div className="ens-scroll-body ens-home-scroll">
        <div className="ens-home-wrap">
          {/* Mandatory Exit to Game Hub Bar + Game Identity */}
          <div className="ens-game-hub-bar">
            <button
              type="button"
              className="ens-exit-hub-btn"
              onClick={onExitToHub}
            >
              <ArrowLeft size={15} strokeWidth={2.8} />
              <span>Exit to Game Hub</span>
            </button>

            <div className="ens-game-identity-pill">
              <Link2 size={14} color="#38bdf8" />
              <span>ChainIt</span>
            </div>
          </div>

          {/* Top Branded Header: [E][N]scribe + Bell + Rank Pill */}
          <BrandedHeader
            profile={profile}
            unreadCount={unreadCount}
            onOpenNotifications={onOpenNotifications}
            onOpenLeaderboard={onLeaderboard}
          />

          {/* Personalized Greeting Row */}
          <div
            className="ens-greeting-row"
            onClick={onOpenProfile}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenProfile();
              }
            }}
            title="View player profile"
          >
            <div className="ens-avatar-ring-wrap">
              <AvatarBadge
                avatarId={profile.avatarId}
                size={46}
                ringColor="#7dd3fc"
              />
            </div>
            <div className="ens-greeting-text">
              <div className="ens-greeting-name">
                <span>Hi, {profile.username}!</span>
                <WaveHandIcon size={19} className="ens-wave-icon" />
              </div>
              <div className="ens-greeting-sub">Ready for a ChainIt match?</div>
            </div>
          </div>

          {/* Primary Hero Card with Integrated Mascot */}
          {primaryMatch ? (
            <div
              className="ens-hero-turn-card"
              onClick={() => onContinueMatch(primaryMatch.matchId)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onContinueMatch(primaryMatch.matchId);
                }
              }}
            >
              <div className="ens-hero-left">
                <div className="ens-hero-title-row">
                  <LightningBoltIcon size={24} />
                  <span>{primaryMatch.isYourTurn ? "It's Your Turn" : 'Active Match'}</span>
                </div>
                <div className="ens-hero-sub">{modeSubtitle(primaryMatch)}</div>

                <button
                  type="button"
                  className="ens-hero-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onContinueMatch(primaryMatch.matchId);
                  }}
                >
                  <Play size={17} fill="#6C30F5" color="#6C30F5" />
                  <span>Continue</span>
                </button>

                {ongoingMatches.length > 1 && (
                  <button
                    type="button"
                    className="ens-hero-more-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewAllMatches();
                    }}
                  >
                    +{ongoingMatches.length - 1} more ongoing • View all
                  </button>
                )}
              </div>

              <div className="ens-hero-mascot-wrap" aria-hidden="true">
                <img
                  src="/art/hero-mascot.png"
                  alt=""
                  className="ens-hero-mascot-img"
                />
              </div>
            </div>
          ) : (
            <div
              className="ens-hero-turn-card"
              onClick={onSoloAdventure}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSoloAdventure();
                }
              }}
            >
              <div className="ens-hero-left">
                <div className="ens-hero-title-row">
                  <LightningBoltIcon size={24} />
                  <span>Ready for ChainIt</span>
                </div>
                <div className="ens-hero-sub">
                  {nextSoloStage
                    ? `Solo Adventure • Stage ${nextSoloStage.stageNumber}`
                    : 'Solo Adventure • Word Chains'}
                </div>

                <button
                  type="button"
                  className="ens-hero-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSoloAdventure();
                  }}
                >
                  <Play size={17} fill="#6C30F5" color="#6C30F5" />
                  <span>Play Solo</span>
                </button>
              </div>

              <div className="ens-hero-mascot-wrap" aria-hidden="true">
                <img
                  src="/art/hero-mascot.png"
                  alt=""
                  className="ens-hero-mascot-img"
                />
              </div>
            </div>
          )}

          {/* LOCKED 3-Card Row Order: SOLO | RANKED | LEADERBOARD */}
          <div className="ens-three-card-row">
            <GameModeCard
              variant="solo"
              label="Solo"
              onClick={onSoloAdventure}
            />
            <GameModeCard
              variant="ranked"
              label="Ranked"
              badgeText={rankedQueued ? 'In Queue' : undefined}
              onClick={onRankedMatch}
            />
            <GameModeCard
              variant="leaderboard"
              label="Leaderboard"
              onClick={onLeaderboard}
            />
          </div>

          {/* Wide Glossy Rooms Pill Button */}
          <button type="button" className="ens-rooms-pill-btn" onClick={onRooms}>
            <span className="ens-rooms-pill-inner">
              <RoomsUsersIcon size={24} color="#281F78" />
              <span className="ens-rooms-pill-label">Rooms</span>
            </span>
            <ChevronRight size={22} strokeWidth={2.6} color="#281F78" />
          </button>

          {/* Fantasy Season Promotional Banner */}
          <div className="ens-promo-banner">
            <img
              src="/art/fantasy-season-art.png"
              alt=""
              className="ens-promo-art-img"
              aria-hidden="true"
            />
            <div className="ens-promo-content">
              <div className="ens-promo-title">
                <SparkleClusterIcon size={21} />
                <span>Fantasy Season</span>
              </div>
              <div className="ens-promo-sub">
                Themed templates, solo stages, and competitive ranks!
              </div>
              <button
                type="button"
                className="ens-promo-btn"
                onClick={onExploreFantasy}
              >
                <span>Explore</span>
                <ArrowRight size={14} strokeWidth={2.7} />
              </button>
            </div>
          </div>

          <div className="ens-carousel-dots" aria-hidden="true">
            <span className="ens-dot active" />
            <span className="ens-dot" />
            <span className="ens-dot" />
          </div>
        </div>
      </div>

      {/* Illustrated Fantasy Horizon Sitting Behind Bottom Area */}
      <div className="ens-home-bottom-art" aria-hidden="true">
        <img
          src="/art/home-bottom-landscape.png"
          alt=""
          className="ens-home-bottom-img"
        />
      </div>
    </div>
  );
};
