import React from 'react';
import { ArrowRight, Lock, LogOut, Sparkles, Wifi, WifiOff } from 'lucide-react';
import { HUB_GAME_TILES } from '../../shared/gameRegistry';
import { GameModuleId, HubGameTile, PlayerSession } from '../../shared/types';
import { AvatarBadge } from '../components/Artwork';
import { EnscribeBrandLogo } from '../components/BrandedHeader';

interface EnscribeHubScreenProps {
  session: PlayerSession;
  isOffline: boolean;
  onSelectGame: (gameId: GameModuleId) => void;
  onSwitchGuest: () => void;
}

const ChainItTileEmblem: React.FC = () => (
  <svg width="68" height="44" viewBox="0 0 68 44" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="hubChainTileA" x1="0" y1="0" x2="26" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#67e8f9" />
        <stop offset="100%" stopColor="#2563eb" />
      </linearGradient>
      <linearGradient id="hubChainTileB" x1="40" y1="14" x2="66" y2="42" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f472b6" />
        <stop offset="100%" stopColor="#9333ea" />
      </linearGradient>
    </defs>
    <rect x="2" y="4" width="26" height="26" rx="8" fill="url(#hubChainTileA)" stroke="#ffffff" strokeWidth="2" />
    <text x="15" y="22" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="900" fontFamily="Nunito, sans-serif">
      C
    </text>
    <path
      d="M27 17 C33 17, 35 27, 41 27"
      stroke="#FFD54A"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeDasharray="4 2"
    />
    <circle cx="34" cy="22" r="4" fill="#FFD54A" />
    <rect x="40" y="14" width="26" height="26" rx="8" fill="url(#hubChainTileB)" stroke="#ffffff" strokeWidth="2" />
    <text x="53" y="32" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="900" fontFamily="Nunito, sans-serif">
      I
    </text>
  </svg>
);

const GridItTileEmblem: React.FC = () => (
  <svg width="70" height="48" viewBox="0 0 70 48" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="hubGridBoardBg" x1="0" y1="0" x2="70" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#e879f9" stopOpacity="0.3" />
      </linearGradient>
    </defs>
    {/* Mini Heart + Tiles motif inspired by GridIt mockup */}
    <rect x="4" y="4" width="20" height="20" rx="6" fill="#fef3c7" stroke="#ffffff" strokeWidth="1.8" />
    <text x="14" y="18.5" textAnchor="middle" fill="#1e1b4b" fontSize="12" fontWeight="900" fontFamily="Nunito, sans-serif">
      G
    </text>
    <rect x="26" y="4" width="20" height="20" rx="6" fill="#fde047" stroke="#ffffff" strokeWidth="1.8" />
    <text x="36" y="18.5" textAnchor="middle" fill="#422006" fontSize="12" fontWeight="900" fontFamily="Nunito, sans-serif">
      R
    </text>
    <rect x="48" y="4" width="20" height="20" rx="6" fill="#f0abfc" stroke="#ffffff" strokeWidth="1.8" />
    <text x="58" y="18.5" textAnchor="middle" fill="#4a044e" fontSize="12" fontWeight="900" fontFamily="Nunito, sans-serif">
      I
    </text>
    <rect x="15" y="25" width="20" height="20" rx="6" fill="#7dd3fc" stroke="#ffffff" strokeWidth="1.8" />
    <text x="25" y="39.5" textAnchor="middle" fill="#0c4a6e" fontSize="12" fontWeight="900" fontFamily="Nunito, sans-serif">
      D
    </text>
    <path
      d="M49 27 C46 24, 41 26, 41 31 C41 36, 49 41, 49 41 C49 41, 57 36, 57 31 C57 26, 52 24, 49 27 Z"
      fill="#f472b6"
      stroke="#ffffff"
      strokeWidth="1.8"
    />
  </svg>
);

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
                  ringColor={isOffline || session.isOffline ? '#fbbf24' : '#38bdf8'}
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

          {/* Hub Welcome Banner with Established Enscribe Mascot */}
          <section className="ens-hub-hero">
            <div className="ens-hub-hero-copy">
              <div className="ens-hub-eyebrow">
                <Sparkles size={14} color="#FFD54A" />
                <span>ENSCRIBE ARCADE</span>
              </div>
              <h1 className="ens-hub-title">Choose Your Game</h1>
              <p className="ens-hub-sub">
                Pick a word arena below. Each game has its own modes, rules, and leaderboards.
              </p>
            </div>
            <div className="ens-hub-mascot-wrap" aria-hidden="true">
              <img src="/art/hero-mascot.png" alt="" className="ens-hub-mascot-img" />
            </div>
          </section>

          {/* Game Registry Tiles */}
          <section className="ens-hub-games-section" aria-label="Word Games">
            <div className="ens-hub-section-label">Available Games</div>

            <div className="ens-hub-tiles-stack">
              {HUB_GAME_TILES.filter((t) => t.status === 'playable').map((tile) => {
                const isGridIt = tile.themeVariant === 'gridit';
                return (
                  <button
                    key={tile.id}
                    type="button"
                    className={`ens-hub-game-tile ${isGridIt ? 'is-gridit' : 'is-chainit'}`}
                    onClick={() => handleTileClick(tile)}
                  >
                    <div className="ens-hub-tile-top">
                      <span className={`ens-hub-tile-badge ${isGridIt ? 'is-new' : 'is-live'}`}>
                        {tile.badgeText}
                      </span>
                      <div className="ens-hub-tile-emblem">
                        {isGridIt ? <GridItTileEmblem /> : <ChainItTileEmblem />}
                      </div>
                    </div>

                    <div className="ens-hub-tile-body">
                      <div className="ens-hub-tile-name">{tile.name}</div>
                      <div className="ens-hub-tile-tagline">{tile.tagline}</div>
                    </div>

                    <div className="ens-hub-tile-cta">
                      <span>Enter {tile.name}</span>
                      <ArrowRight size={16} strokeWidth={2.8} />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="ens-hub-section-label" style={{ marginTop: 14 }}>
              More Word Games
            </div>

            <div className="ens-hub-coming-grid">
              {HUB_GAME_TILES.filter((t) => t.status === 'coming_soon').map((tile) => (
                <div
                  key={tile.id}
                  className="ens-hub-coming-tile"
                  aria-disabled="true"
                >
                  <div className="ens-hub-coming-top">
                    <span className="ens-hub-coming-pill">{tile.badgeText}</span>
                    <Lock size={14} color="rgba(216, 224, 255, 0.72)" />
                  </div>
                  <div className="ens-hub-coming-name">{tile.name}</div>
                  <div className="ens-hub-coming-sub">{tile.tagline}</div>
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
