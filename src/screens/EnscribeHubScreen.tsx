import React from 'react';
import { Lock, LogOut, Play, Sparkles, Wifi, WifiOff } from 'lucide-react';
import { HUB_GAME_TILES } from '../../shared/gameRegistry';
import { GameModuleId, HubGameTile, PlayerSession } from '../../shared/types';
import { AvatarBadge } from '../components/Artwork';
import { EnscribeBrandLogo } from '../components/BrandedHeader';
import { SparkleClusterIcon, WaveHandIcon } from '../components/GameIcons';

interface EnscribeHubScreenProps {
  session: PlayerSession;
  isOffline: boolean;
  onSelectGame: (gameId: GameModuleId) => void;
  onSwitchGuest: () => void;
}

const COMING_SOON_ART = ['/art/room-crystals.png', '/art/room-island.png'];

export const EnscribeHubScreen: React.FC<EnscribeHubScreenProps> = ({
  session,
  isOffline,
  onSelectGame,
  onSwitchGuest,
}) => {
  const handleTileClick = (tile: HubGameTile) => {
    if (tile.status !== 'playable' || !tile.gameId) return;
    onSelectGame(tile.gameId);
  };

  const playableTiles = HUB_GAME_TILES.filter((t) => t.status === 'playable');
  const comingSoonTiles = HUB_GAME_TILES.filter((t) => t.status === 'coming_soon');

  return (
    <div className="ens-fantasy-page ens-hub-page">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <div className="ens-scroll-body ens-hub-scroll">
        <div className="ens-home-wrap">
          {/* Hub Top Header */}
          <header className="ens-hub-header">
            <EnscribeBrandLogo />

            <div className="ens-hub-guest-bar">
              <div className="ens-hub-guest-chip" title={`Guest session: ${session.nickname}`}>
                <AvatarBadge
                  avatarId={session.avatarId}
                  size={30}
                  ringColor={isOffline || session.isOffline ? '#fbbf24' : '#7dd3fc'}
                />
                <div className="ens-hub-guest-meta">
                  <span className="ens-hub-guest-name">{session.nickname}</span>
                  <span className="ens-hub-guest-status">
                    {isOffline || session.isOffline ? (
                      <>
                        <WifiOff size={10} />
                        <span>Offline Guest</span>
                      </>
                    ) : (
                      <>
                        <Wifi size={10} />
                        <span>Guest</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="ens-hub-switch-btn"
                onClick={onSwitchGuest}
                aria-label="Switch guest nickname"
                title="Switch guest nickname"
              >
                <LogOut size={14} />
              </button>
            </div>
          </header>

          {/* Personalized Greeting Row matching Approved Enscribe Aesthetic */}
          <div className="ens-greeting-row" style={{ cursor: 'default' }}>
            <div className="ens-avatar-ring-wrap">
              <AvatarBadge avatarId={session.avatarId} size={46} ringColor="#7dd3fc" />
            </div>
            <div className="ens-greeting-text">
              <div className="ens-greeting-name">
                <span>Hi, {session.nickname}!</span>
                <WaveHandIcon size={19} className="ens-wave-icon" />
              </div>
              <div className="ens-greeting-sub">Ready for a word game adventure?</div>
            </div>
          </div>

          {/* Glossy Mascot Hero Banner */}
          <section className="ens-hub-hero">
            <span className="ens-home-mode-sheen" aria-hidden="true" />
            <div className="ens-hub-hero-copy">
              <div className="ens-hub-eyebrow">
                <SparkleClusterIcon size={17} />
                <span>ENSCRIBE ARCADE</span>
              </div>
              <h1 className="ens-hub-title">Choose Your Game</h1>
              <p className="ens-hub-sub">
                Pick a word arena below to launch its modes &amp; challenges!
              </p>
            </div>
            <div className="ens-hub-mascot-wrap" aria-hidden="true">
              <img src="/art/hero-mascot.png" alt="" className="ens-hub-mascot-img" />
            </div>
          </section>

          {/* Illustrated Game Registry Tiles */}
          <section className="ens-hub-games-section" aria-label="Word Games">
            <div className="ens-hub-section-label">
              <Sparkles size={13} color="#FFD54A" />
              <span>Featured Word Games</span>
            </div>

            <div className="ens-hub-tiles-stack">
              {playableTiles.map((tile) => {
                const isGridIt = tile.themeVariant === 'gridit';
                const isGuessIt = tile.themeVariant === 'guessit';
                const artSrc = isGridIt
                  ? '/art/hub-gridit-card.png'
                  : isGuessIt
                    ? '/art/chapter1-banner-art.png'
                    : '/art/hub-chainit-card.png';
                const ctaLabel = isGridIt
                  ? 'Open GridIt'
                  : isGuessIt
                    ? 'Play GuessIt'
                    : 'Play ChainIt';
                const variantClass = isGridIt
                  ? 'is-gridit'
                  : isGuessIt
                    ? 'is-guessit'
                    : 'is-chainit';

                return (
                  <button
                    key={tile.id}
                    type="button"
                    className={`ens-hub-game-tile ${variantClass}`}
                    onClick={() => handleTileClick(tile)}
                  >
                    <img src={artSrc} alt="" className="ens-hub-tile-art" aria-hidden="true" />
                    <div className="ens-hub-tile-scrim" aria-hidden="true" />
                    <span className="ens-home-mode-sheen" aria-hidden="true" />

                    <div className="ens-hub-tile-content">
                      <span className={`ens-hub-tile-badge ${isGridIt || isGuessIt ? 'is-new' : 'is-live'}`}>
                        {tile.badgeText}
                      </span>

                      <div className="ens-hub-tile-body">
                        <div className="ens-hub-tile-name">{tile.name}</div>
                        <div className="ens-hub-tile-tagline">{tile.tagline}</div>
                      </div>

                      <div className={`ens-hub-tile-cta ${isGridIt || isGuessIt ? 'is-gold' : 'is-lavender'}`}>
                        <Play
                          size={14}
                          fill={isGridIt || isGuessIt ? '#ffffff' : '#4a1d96'}
                          color={isGridIt || isGuessIt ? '#ffffff' : '#4a1d96'}
                        />
                        <span>{ctaLabel}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="ens-hub-section-label" style={{ marginTop: 14 }}>
              <Sparkles size={13} color="#93c5fd" />
              <span>More Word Games</span>
            </div>

            <div className="ens-hub-coming-grid">
              {comingSoonTiles.map((tile, idx) => (
                <div
                  key={tile.id}
                  className="ens-hub-coming-tile"
                  aria-disabled="true"
                >
                  <img
                    src={COMING_SOON_ART[idx % COMING_SOON_ART.length]}
                    alt=""
                    className="ens-hub-coming-art"
                    aria-hidden="true"
                  />
                  <div className="ens-hub-coming-scrim" aria-hidden="true" />
                  <span className="ens-home-mode-sheen" aria-hidden="true" />
                  <div className="ens-hub-coming-inner">
                    <div className="ens-hub-coming-top">
                      <span className="ens-hub-coming-pill">{tile.badgeText}</span>
                      <span className="ens-hub-coming-lock">
                        <Lock size={12} color="#e0e7ff" />
                      </span>
                    </div>
                    <div className="ens-hub-coming-name">{tile.name}</div>
                    <div className="ens-hub-coming-sub">{tile.tagline}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

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
