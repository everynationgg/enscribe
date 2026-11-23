import React from 'react';
import { Bell } from 'lucide-react';
import { Profile } from '../../shared/types';
import { GoldCrownIcon } from './GameIcons';

interface EnscribeBrandLogoProps {
  compact?: boolean;
  centered?: boolean;
}

/**
 * LOCKED Enscribe Brand Logo:
 * [Crown + E cyan tile + N pink tile] + "scribe" + "WORD GAMES HUB" + underline flourish.
 * Reads as "Enscribe" cleanly without duplicating E or N.
 */
export const EnscribeBrandLogo: React.FC<EnscribeBrandLogoProps> = ({
  compact = false,
  centered = false,
}) => (
  <div className={`ens-logo-lockup ${compact ? 'is-compact' : ''} ${centered ? 'is-centered' : ''}`}>
    <div className="ens-logo-main">
      <div className="ens-logo-tiles" aria-hidden="true">
        <span className="ens-logo-crown">
          <GoldCrownIcon size={compact ? 17 : 20} />
        </span>
        <span className="ens-logo-sparkle s1">✦</span>
        <span className="ens-logo-sparkle s2">✦</span>
        <span className="ens-tile ens-tile-e">E</span>
        <span className="ens-tile ens-tile-n">N</span>
      </div>
      <span className="ens-brand-title" aria-label="Enscribe">
        <span className="ens-sr-letters">EN</span>
        <span className="ens-wordmark-scribe">scribe</span>
      </span>
    </div>

    <div className="ens-logo-sub-wrap">
      <span className="ens-logo-sub">WORD GAMES HUB</span>
      <svg className="ens-logo-flourish" viewBox="0 0 130 12" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="ensLogoSwoosh" x1="0" y1="6" x2="130" y2="6" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.1" />
            <stop offset="30%" stopColor="#E040FB" />
            <stop offset="72%" stopColor="#FF72C6" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path
          d="M8 7.5C38 11.2 88 10.5 122 3.2"
          stroke="url(#ensLogoSwoosh)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  </div>
);

interface BrandedHeaderProps {
  profile: Profile;
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenLeaderboard: () => void;
}

export const BrandedHeader: React.FC<BrandedHeaderProps> = ({
  profile,
  unreadCount,
  onOpenNotifications,
  onOpenLeaderboard,
}) => (
  <header className="ens-home-header">
    <EnscribeBrandLogo />

    <div className="ens-header-actions">
      <button
        type="button"
        className="ens-bell-btn"
        onClick={onOpenNotifications}
        aria-label="Notifications"
      >
        <Bell size={19} strokeWidth={2.3} />
        {unreadCount > 0 && <span className="ens-unread-dot" />}
      </button>

      <button
        type="button"
        className="ens-rank-pill"
        onClick={onOpenLeaderboard}
        aria-label={
          profile.isGuest
            ? 'Guest Session — open ChainIt leaderboard'
            : `Rank ${profile.rankTier}, ${profile.rankPoints} RP — open leaderboard`
        }
      >
        <span className="ens-rank-pill-crown">
          <GoldCrownIcon size={17} />
        </span>
        <span className="ens-rank-pill-meta">
          <span className="ens-rank-tier">{profile.isGuest ? 'Guest Mode' : profile.rankTier}</span>
          <span className="ens-rank-rp">
            {profile.isGuest ? 'ChainIt' : `${profile.rankPoints.toLocaleString()} RP`}
          </span>
        </span>
      </button>
    </div>
  </header>
);
