import React from 'react';
import { Layers, Link2, Play } from 'lucide-react';
import {
  InAppNotification,
  OngoingMatchSummary,
  Profile,
  SoloStage,
} from '../../shared/types';
import { GameLandingModeCard, GameLandingShell } from '../components/GameLandingShell';

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
  onOpenTemplates?: () => void;
  onSwitchGuest?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  profile,
  ongoingMatches,
  rankedQueued,
  onContinueMatch,
  onRankedMatch,
  onSoloAdventure,
  onLeaderboard,
  onRooms,
  onOpenProfile,
  onExitToHub,
  onOpenTemplates,
  onSwitchGuest,
}) => {
  const primaryMatch =
    ongoingMatches.find((m) => m.isYourTurn) ?? ongoingMatches[0] ?? null;

  const cards: GameLandingModeCard[] = [
    {
      id: 'ranked',
      label: rankedQueued ? 'Ranked — Searching for Match' : 'Ranked — Compete for a higher rank!',
      artSrc: '/art/mode-card-ranked.png',
      glowClass: 'glow-chainit',
      onClick: onRankedMatch,
    },
    {
      id: 'solo',
      label: 'Solo Adventure — Play at your own pace!',
      artSrc: '/art/mode-card-solo.png',
      glowClass: 'glow-gridit',
      onClick: onSoloAdventure,
    },
    {
      id: 'rooms',
      label: 'Rooms — Join or create a private room to play with friends!',
      artSrc: '/art/mode-card-rooms.png',
      glowClass: 'glow-twistit',
      onClick: onRooms,
    },
    {
      id: 'leaderboard',
      label: 'Leaderboard — See the top ChainIt players!',
      artSrc: '/art/mode-card-leaderboard-clean.png',
      glowClass: 'glow-guessit',
      overlaySubtitle: 'See the top ChainIt players!',
      onClick: onLeaderboard,
    },
  ];

  return (
    <GameLandingShell
      gameName="ChainIt"
      badgeIcon={<Link2 size={15} color="#ffffff" strokeWidth={2.8} />}
      badgeBg="linear-gradient(135deg, #c084fc 0%, #7c3aed 100%)"
      heroBannerSrc="/art/hero-chainit-banner.png"
      heroAlt="ChainIt — Build connected word chains!"
      nickname={profile.username}
      avatarId={profile.avatarId}
      coins={profile.matchPointsBalance}
      cards={cards}
      onBackToHub={onExitToHub}
      onOpenProfile={onOpenProfile}
      onSwitchGuest={onSwitchGuest}
      extras={
        <>
          {rankedQueued && (
            <button
              type="button"
              className="ens-landing-mini-pill is-gold"
              onClick={onRankedMatch}
            >
              Searching Ranked Queue... (Tap to cancel)
            </button>
          )}
          {primaryMatch && (
            <button
              type="button"
              className="ens-landing-mini-pill is-gold"
              onClick={() => onContinueMatch(primaryMatch.matchId)}
            >
              <Play size={12} fill="currentColor" />
              <span>Resume vs {primaryMatch.opponentPrimaryName}</span>
            </button>
          )}
          {onOpenTemplates && (
            <button
              type="button"
              className="ens-landing-mini-pill"
              onClick={onOpenTemplates}
            >
              <Layers size={13} />
              <span>My Templates</span>
            </button>
          )}
        </>
      }
    />
  );
};
