import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { EnscribeTopBar } from './EnscribeTopBar';

export interface GameLandingModeCard {
  id: string;
  label: string;
  artSrc: string;
  glowClass: 'glow-chainit' | 'glow-gridit' | 'glow-guessit' | 'glow-twistit';
  overlaySubtitle?: string;
  onClick: () => void;
}

interface GameLandingShellProps {
  gameName: string;
  badgeIcon: React.ReactNode;
  badgeBg: string;
  heroBannerSrc: string;
  heroAlt: string;
  nickname: string;
  avatarId: string;
  coins: number;
  isOffline?: boolean;
  cards: GameLandingModeCard[];
  cardSize?: 'standard' | 'large';
  extras?: React.ReactNode;
  onBackToHub: () => void;
  onOpenProfile: () => void;
  onSwitchGuest?: () => void;
}

export const GameLandingShell: React.FC<GameLandingShellProps> = ({
  gameName,
  badgeIcon,
  badgeBg,
  heroBannerSrc,
  heroAlt,
  nickname,
  avatarId,
  coins,
  isOffline,
  cards,
  cardSize = 'standard',
  extras,
  onBackToHub,
  onOpenProfile,
  onSwitchGuest,
}) => {
  return (
    <div className="ens-arcade-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <div className="ens-arcade-scroll">
        <div className="ens-arcade-inner">
          <EnscribeTopBar
            nickname={nickname}
            avatarId={avatarId}
            coins={coins}
            isOffline={isOffline}
            onBrandClick={onBackToHub}
            onOpenProfile={onOpenProfile}
            onSwitchGuest={onSwitchGuest}
          />

          <div className="ens-landing-subbar">
            <button
              type="button"
              className="ens-back-hub-pill"
              onClick={onBackToHub}
            >
              <ArrowLeft size={14} strokeWidth={2.8} />
              <span>Games Hub</span>
            </button>

            <span className="ens-landing-subbar-sep" aria-hidden="true" />

            <div className="ens-landing-game-crumb">
              <span className="ens-landing-game-badge" style={{ background: badgeBg }}>
                {badgeIcon}
              </span>
              <span>{gameName}</span>
            </div>
          </div>

          <section className="ens-landing-hero-stage" aria-label={`${gameName} overview`}>
            <h1 className="ens-sr-letters">{gameName}</h1>
            <img
              src={heroBannerSrc}
              alt={heroAlt}
              className="ens-landing-hero-img"
            />
          </section>

          <section className="ens-landing-mode-grid" aria-label={`${gameName} modes`}>
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={`ens-fullbleed-card ${cardSize === 'large' ? 'is-mode-card-lg' : 'is-mode-card'} ${card.glowClass}`}
                onClick={card.onClick}
                aria-label={card.label}
              >
                <img
                  src={card.artSrc}
                  alt=""
                  className="ens-fullbleed-card__art"
                />
                {card.overlaySubtitle && (
                  <span className="ens-leaderboard-pill-overlay" aria-hidden="true">
                    {card.overlaySubtitle}
                  </span>
                )}
                <span className="ens-sr-letters">{card.label}</span>
              </button>
            ))}
          </section>

          {extras && <div className="ens-landing-extras-row">{extras}</div>}

          <div className="ens-landing-footer-spacer" />

          <div className="ens-landing-word-footer" aria-hidden="true">
            <img
              src="/art/footer-word-clouds.png"
              alt=""
              className="ens-landing-word-footer-img"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
