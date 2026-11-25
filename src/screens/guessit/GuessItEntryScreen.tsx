import React from 'react';
import { FileText, HelpCircle, Target } from 'lucide-react';
import { Profile } from '../../../shared/types';
import { GameLandingModeCard, GameLandingShell } from '../../components/GameLandingShell';

interface GuessItEntryScreenProps {
  profile: Profile;
  onExitToHub: () => void;
  onPlayMultiplayer: (pathway?: 'rooms' | 'ranked') => void;
  onSoloAdventure: () => void;
  onClassicSolo?: () => void;
  onOpenLeaderboard?: () => void;
  onOpenTemplates: () => void;
  onOpenProfile?: () => void;
  onSwitchGuest?: () => void;
}

export const GuessItEntryScreen: React.FC<GuessItEntryScreenProps> = ({
  profile,
  onExitToHub,
  onPlayMultiplayer,
  onSoloAdventure,
  onClassicSolo,
  onOpenLeaderboard,
  onOpenTemplates,
  onOpenProfile,
  onSwitchGuest,
}) => {
  const cards: GameLandingModeCard[] = [
    {
      id: 'ranked',
      label: 'Ranked — Compete for a higher rank!',
      artSrc: '/art/mode-card-ranked.png',
      glowClass: 'glow-chainit',
      onClick: () => onPlayMultiplayer('ranked'),
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
      onClick: () => onPlayMultiplayer('rooms'),
    },
    {
      id: 'leaderboard',
      label: 'Leaderboard — See the top GuessIt players!',
      artSrc: '/art/mode-card-leaderboard-guessit.png',
      glowClass: 'glow-guessit',
      onClick: () => (onOpenLeaderboard ? onOpenLeaderboard() : onPlayMultiplayer('ranked')),
    },
  ];

  return (
    <GameLandingShell
      gameName="GuessIt"
      badgeIcon={<HelpCircle size={15} color="#78350f" strokeWidth={2.8} />}
      badgeBg="linear-gradient(135deg, #fde047 0%, #f59e0b 100%)"
      heroBannerSrc="/art/hero-guessit-banner.png"
      heroAlt="GuessIt — Guess the hidden word!"
      nickname={profile.username}
      avatarId={profile.avatarId}
      coins={profile.matchPointsBalance}
      cards={cards}
      onBackToHub={onExitToHub}
      onOpenProfile={() => (onOpenProfile ? onOpenProfile() : onExitToHub())}
      onSwitchGuest={onSwitchGuest}
      extras={
        <>
          {onClassicSolo && (
            <button
              type="button"
              className="ens-landing-mini-pill is-gold"
              onClick={onClassicSolo}
            >
              <Target size={13} />
              <span>Classic Solo</span>
            </button>
          )}
          <button
            type="button"
            className="ens-landing-mini-pill"
            onClick={onOpenTemplates}
          >
            <FileText size={13} />
            <span>Custom Word Packs</span>
          </button>
        </>
      }
    />
  );
};
