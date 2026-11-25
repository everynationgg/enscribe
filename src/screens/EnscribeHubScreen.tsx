import React from 'react';
import { HUB_GAME_TILES } from '../../shared/gameRegistry';
import { GameModuleId, HubGameTile, PlayerSession, Profile } from '../../shared/types';
import { EnscribeTopBar } from '../components/EnscribeTopBar';
import { BottomNav, HubDockTab } from '../components/BottomNav';

interface EnscribeHubScreenProps {
  session: PlayerSession;
  profile?: Profile | null;
  isOffline: boolean;
  onSelectGame: (gameId: GameModuleId) => void;
  onOpenProfile: () => void;
  onQuickPlay?: () => void;
  onOpenSocial?: () => void;
  onSwitchGuest: () => void;
}

const HUB_CARD_ART: Record<string, { src: string; glow: string }> = {
  chainit: { src: '/art/hub-card-chainit.png', glow: 'glow-chainit' },
  gridit: { src: '/art/hub-card-gridit.png', glow: 'glow-gridit' },
  guessit: { src: '/art/hub-card-guessit.png', glow: 'glow-guessit' },
  twistit: { src: '/art/hub-card-twistit.png', glow: 'glow-twistit' },
  changeit: { src: '/art/hub-card-changeit.png', glow: 'glow-changeit' },
};

export const EnscribeHubScreen: React.FC<EnscribeHubScreenProps> = ({
  session,
  profile,
  isOffline,
  onSelectGame,
  onOpenProfile,
  onQuickPlay,
  onOpenSocial,
  onSwitchGuest,
}) => {
  const playableTiles = HUB_GAME_TILES.filter((t) => t.status === 'playable' && t.gameId);

  const handleTileClick = (tile: HubGameTile) => {
    if (!tile.gameId) return;
    onSelectGame(tile.gameId);
  };

  const handleDockTab = (tab: HubDockTab) => {
    if (tab === 'profile') {
      onOpenProfile();
    } else if (tab === 'social') {
      if (onOpenSocial) onOpenSocial();
      else onSelectGame('chain_clash');
    } else if (tab === 'home' || tab === 'games') {
      // Already on Games Hub
    }
  };

  return (
    <div className="ens-arcade-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <div className="ens-arcade-scroll">
        <div className="ens-arcade-inner">
          <EnscribeTopBar
            nickname={session.nickname}
            avatarId={session.avatarId}
            coins={profile?.matchPointsBalance ?? 0}
            isOffline={isOffline || session.isOffline}
            onOpenProfile={onOpenProfile}
            onSwitchGuest={onSwitchGuest}
          />

          <section className="ens-hub-hero-row" aria-label="Games Hub">
            <div className="ens-hub-title-lockup">
              <div className="ens-hub-rays" aria-hidden="true">
                <svg width="46" height="16" viewBox="0 0 46 16" fill="none">
                  <line x1="6" y1="13" x2="10" y2="3" stroke="#ffd842" strokeWidth="3.5" strokeLinecap="round" />
                  <line x1="20" y1="12" x2="21" y2="1" stroke="#ffd842" strokeWidth="3.5" strokeLinecap="round" />
                  <line x1="34" y1="13" x2="38" y2="5" stroke="#ffd842" strokeWidth="3.5" strokeLinecap="round" />
                </svg>
              </div>
              <h1 className="ens-hub-h1">
                Games <span className="ens-hub-h1-gold">Hub</span>
              </h1>
              <div className="ens-hub-underline-glow" aria-hidden="true" />
              <p className="ens-hub-subtitle">Choose a Game to Play!</p>
            </div>

            <div className="ens-hub-cat-wrap" aria-hidden="true">
              <img
                src="/art/hub-hero-mascot.png"
                alt=""
                className="ens-hub-cat-mascot"
              />
            </div>
          </section>

          <section className="ens-hub-grid2x2" aria-label="Word Games">
            {playableTiles.map((tile) => {
              const art = HUB_CARD_ART[tile.themeVariant] || HUB_CARD_ART.chainit;
              return (
                <button
                  key={tile.id}
                  type="button"
                  className={`ens-fullbleed-card is-hub-card ${art.glow}`}
                  onClick={() => handleTileClick(tile)}
                  aria-label={`${tile.name} — ${tile.tagline}`}
                >
                  <img
                    src={art.src}
                    alt=""
                    className="ens-fullbleed-card__art"
                  />
                  <span className="ens-sr-letters">{tile.name}</span>
                </button>
              );
            })}
          </section>
        </div>
      </div>

      <BottomNav
        activeTab="home"
        hubActive="games"
        onSelect={() => undefined}
        onSelectHubTab={handleDockTab}
        onQuickPlay={() => (onQuickPlay ? onQuickPlay() : onSelectGame('changeit'))}
      />
    </div>
  );
};
