import React from 'react';
import { Layers, Repeat, Star } from 'lucide-react';
import { ChangeItAdventureProgressClient, PlayerSession, Profile } from '../../../shared/types';
import { GameLandingModeCard, GameLandingShell } from '../../components/GameLandingShell';

interface ChangeItHomeScreenProps {
  session: PlayerSession;
  profile?: Profile | null;
  adventureProgress?: ChangeItAdventureProgressClient | null;
  onExitToHub: () => void;
  onOpenRanked: () => void;
  onOpenAdventure: () => void;
  onOpenRooms: () => void;
  onOpenLeaderboard: () => void;
  onOpenTemplates: () => void;
  onOpenProfile: () => void;
  onSwitchGuest?: () => void;
}

export const ChangeItHomeScreen: React.FC<ChangeItHomeScreenProps> = ({
  session,
  profile,
  adventureProgress,
  onExitToHub,
  onOpenRanked,
  onOpenAdventure,
  onOpenRooms,
  onOpenLeaderboard,
  onOpenTemplates,
  onOpenProfile,
  onSwitchGuest,
}) => {
  // Strictly exposes Ranked, Solo Adventure, Rooms, and Leaderboard (no Quick Match).
  const cards: GameLandingModeCard[] = [
    {
      id: 'ranked',
      label: 'Ranked — Compete in Sprint & Precision 1v1!',
      artSrc: '/art/mode-card-ranked.png',
      glowClass: 'glow-chainit',
      onClick: onOpenRanked,
    },
    {
      id: 'solo',
      label: 'Solo Adventure — Climb themed word-ladder chapters!',
      artSrc: '/art/mode-card-solo.png',
      glowClass: 'glow-changeit',
      onClick: onOpenAdventure,
    },
    {
      id: 'rooms',
      label: 'Rooms — Create or join custom & public rooms!',
      artSrc: '/art/mode-card-rooms.png',
      glowClass: 'glow-twistit',
      onClick: onOpenRooms,
    },
    {
      id: 'leaderboard',
      label: 'Leaderboard — See the top ChangeIt players!',
      artSrc: '/art/mode-card-leaderboard-clean.png',
      glowClass: 'glow-guessit',
      overlaySubtitle: 'See the top ChangeIt players!',
      onClick: onOpenLeaderboard,
    },
  ];

  return (
    <GameLandingShell
      gameName="ChangeIt"
      badgeIcon={<Repeat size={15} color="#083344" strokeWidth={2.8} />}
      badgeBg="linear-gradient(135deg, #22d3ee 0%, #8b5cf6 100%)"
      heroBannerSrc="/art/hero-changeit-banner.png"
      heroAlt="ChangeIt — Every letter changes everything!"
      nickname={session.nickname}
      avatarId={session.avatarId}
      coins={profile?.matchPointsBalance ?? 0}
      isOffline={session.isOffline}
      cards={cards}
      onBackToHub={onExitToHub}
      onOpenProfile={onOpenProfile}
      onSwitchGuest={onSwitchGuest}
      extras={
        <>
          {adventureProgress && adventureProgress.totalStars > 0 && (
            <div className="ens-landing-mini-pill is-gold" style={{ cursor: 'default' }}>
              <Star size={12} fill="currentColor" />
              <span>
                {adventureProgress.totalStars}/{adventureProgress.maxStars} Adventure Stars
              </span>
            </div>
          )}
          <button
            type="button"
            className="ens-landing-mini-pill"
            onClick={onOpenTemplates}
          >
            <Layers size={13} />
            <span>Custom Puzzles</span>
          </button>
        </>
      }
    />
  );
};
