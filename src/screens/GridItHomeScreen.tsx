import React from 'react';
import { Grid, Pencil, Swords } from 'lucide-react';
import { PlayerSession, Profile } from '../../shared/types';
import { GameLandingModeCard, GameLandingShell } from '../components/GameLandingShell';

interface GridItHomeScreenProps {
  session: PlayerSession;
  profile?: Profile | null;
  onExitToHub: () => void;
  onOpenSolo: () => void;
  onOpenRanked: () => void;
  onOpenMultiplayer: () => void;
  onOpenLeaderboard: () => void;
  onOpenBoardBattle: () => void;
  onOpenEditor: () => void;
  onOpenProfile?: () => void;
  onSwitchGuest?: () => void;
}

export const GridItHomeScreen: React.FC<GridItHomeScreenProps> = ({
  session,
  profile,
  onExitToHub,
  onOpenSolo,
  onOpenRanked,
  onOpenMultiplayer,
  onOpenLeaderboard,
  onOpenBoardBattle,
  onOpenEditor,
  onOpenProfile,
  onSwitchGuest,
}) => {
  const cards: GameLandingModeCard[] = [
    {
      id: 'ranked',
      label: 'Ranked — Compete for a higher rank!',
      artSrc: '/art/mode-card-ranked.png',
      glowClass: 'glow-chainit',
      onClick: onOpenRanked,
    },
    {
      id: 'solo',
      label: 'Solo Adventure — Play at your own pace!',
      artSrc: '/art/mode-card-solo.png',
      glowClass: 'glow-gridit',
      onClick: onOpenSolo,
    },
    {
      id: 'rooms',
      label: 'Rooms — Join or create a private room to play with friends!',
      artSrc: '/art/mode-card-rooms.png',
      glowClass: 'glow-twistit',
      onClick: onOpenMultiplayer,
    },
    {
      id: 'leaderboard',
      label: 'Leaderboard — See the top GridIt players!',
      artSrc: '/art/mode-card-leaderboard-clean.png',
      glowClass: 'glow-guessit',
      overlaySubtitle: 'See the top GridIt players!',
      onClick: onOpenLeaderboard,
    },
  ];

  return (
    <GameLandingShell
      gameName="GridIt"
      badgeIcon={<Grid size={15} color="#ffffff" strokeWidth={2.6} />}
      badgeBg="linear-gradient(135deg, #22d3ee 0%, #2563eb 100%)"
      heroBannerSrc="/art/hero-gridit-banner.png"
      heroAlt="GridIt — Find words in a letter grid!"
      nickname={session.nickname}
      avatarId={session.avatarId}
      coins={profile?.matchPointsBalance ?? 0}
      isOffline={session.isOffline}
      cards={cards}
      onBackToHub={onExitToHub}
      onOpenProfile={() => (onOpenProfile ? onOpenProfile() : onExitToHub())}
      onSwitchGuest={onSwitchGuest}
      extras={
        <>
          <button
            type="button"
            className="ens-landing-mini-pill"
            onClick={onOpenBoardBattle}
          >
            <Swords size={13} />
            <span>Board Battle</span>
          </button>
          <button
            type="button"
            className="ens-landing-mini-pill"
            onClick={onOpenEditor}
          >
            <Pencil size={13} />
            <span>Board Editor</span>
          </button>
        </>
      }
    />
  );
};
