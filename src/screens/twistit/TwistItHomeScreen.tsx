import React from 'react';
import { Award, RotateCw, Timer } from 'lucide-react';
import { PlayerSession, Profile } from '../../../shared/types';
import { TwistItSoloStats } from '../../../shared/twistit/types';
import { GameLandingModeCard, GameLandingShell } from '../../components/GameLandingShell';

interface TwistItHomeScreenProps {
  session: PlayerSession;
  profile?: Profile | null;
  soloStats: TwistItSoloStats;
  onExitToHub: () => void;
  onStartSolo: () => void;
  onOpenMultiplayer: () => void;
  onOpenProfile: () => void;
  onSwitchGuest?: () => void;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export const TwistItHomeScreen: React.FC<TwistItHomeScreenProps> = ({
  session,
  profile,
  soloStats,
  onExitToHub,
  onStartSolo,
  onOpenMultiplayer,
  onOpenProfile,
  onSwitchGuest,
}) => {
  // STRICT: Only Solo and Multiplayer modes on TwistIt's landing page.
  const cards: GameLandingModeCard[] = [
    {
      id: 'solo',
      label: 'Solo — Solve word puzzles solo!',
      artSrc: '/art/twistit-card-solo.png',
      glowClass: 'glow-gridit',
      onClick: onStartSolo,
    },
    {
      id: 'multiplayer',
      label: 'Multiplayer — 1v1 real-time word race!',
      artSrc: '/art/twistit-card-multiplayer.png',
      glowClass: 'glow-twistit',
      onClick: onOpenMultiplayer,
    },
  ];

  return (
    <GameLandingShell
      gameName="TwistIt"
      badgeIcon={<RotateCw size={15} color="#ffffff" strokeWidth={2.8} />}
      badgeBg="linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)"
      heroBannerSrc="/art/hero-twistit-banner.png"
      heroAlt="TwistIt — Twist letters into words!"
      nickname={session.nickname}
      avatarId={session.avatarId}
      coins={profile?.matchPointsBalance ?? 0}
      isOffline={session.isOffline}
      cards={cards}
      cardSize="large"
      onBackToHub={onExitToHub}
      onOpenProfile={onOpenProfile}
      onSwitchGuest={onSwitchGuest}
      extras={
        soloStats.completedPuzzlesCount > 0 ? (
          <div className="ens-landing-mini-pill is-gold" style={{ cursor: 'default' }}>
            <Award size={13} />
            <span>{soloStats.completedPuzzlesCount} Solved</span>
            {soloStats.bestDurationMs !== null && (
              <>
                <span style={{ opacity: 0.5 }}>•</span>
                <Timer size={12} />
                <span>Best {formatDuration(soloStats.bestDurationMs)}</span>
              </>
            )}
          </div>
        ) : undefined
      }
    />
  );
};
