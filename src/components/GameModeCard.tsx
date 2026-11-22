import React from 'react';
import { MountainFlagIcon, PodiumCrownIcon, TrophyLaurelIcon } from './GameIcons';

export type GameModeCardVariant = 'solo' | 'ranked' | 'leaderboard';

interface GameModeCardProps {
  variant: GameModeCardVariant;
  label: string;
  badgeText?: string;
  onClick: () => void;
}

/**
 * Three-column homepage mode card:
 * Left: Solo (mint + mountain/flag)
 * Center: Ranked (purple + trophy/laurels)
 * Right: Leaderboard (electric blue + crowned podium)
 */
export const GameModeCard: React.FC<GameModeCardProps> = ({
  variant,
  label,
  badgeText,
  onClick,
}) => {
  const renderIcon = () => {
    if (variant === 'solo') return <MountainFlagIcon size={56} />;
    if (variant === 'ranked') return <TrophyLaurelIcon size={56} />;
    return <PodiumCrownIcon size={56} />;
  };

  return (
    <button
      type="button"
      className={`ens-home-mode-card is-${variant}`}
      onClick={onClick}
      aria-label={badgeText ? `${label} (${badgeText})` : label}
    >
      <span className="ens-home-mode-sheen" aria-hidden="true" />
      {badgeText && <span className="ens-home-mode-badge">{badgeText}</span>}
      <span className="ens-home-mode-icon">{renderIcon()}</span>
      <span className="ens-home-mode-label">{label}</span>
    </button>
  );
};
