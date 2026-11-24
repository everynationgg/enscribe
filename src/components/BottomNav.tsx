import React from 'react';
import { Gamepad2, Home, Play, User, Users } from 'lucide-react';

export type NavTab = 'home' | 'play' | 'templates' | 'profile';
export type HubDockTab = 'home' | 'games' | 'social' | 'profile';

interface BottomNavProps {
  activeTab: NavTab;
  hubActive?: HubDockTab;
  onSelect: (tab: NavTab) => void;
  onSelectHubTab?: (tab: HubDockTab) => void;
  onQuickPlay?: () => void;
  hasOngoingMatch?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  hubActive,
  onSelect,
  onSelectHubTab,
  onQuickPlay,
  hasOngoingMatch,
}) => {
  const activeKey = hubActive ?? (activeTab === 'home' ? 'games' : activeTab === 'templates' ? 'social' : activeTab);

  const handleDockSelect = (key: HubDockTab, legacyTab: NavTab) => {
    if (onSelectHubTab) {
      onSelectHubTab(key);
    } else {
      onSelect(legacyTab);
    }
  };

  return (
    <div className="ens-ref-bottom-wrap">
      <div className="ens-ref-cloud-lip" aria-hidden="true" />
      <nav className="ens-ref-bottom-nav" aria-label="Main navigation">
        <button
          type="button"
          className={`ens-ref-nav-item ${activeKey === 'home' ? 'is-active' : ''}`}
          onClick={() => handleDockSelect('home', 'home')}
        >
          <Home size={20} strokeWidth={2.4} />
          <span>Home</span>
        </button>

        <button
          type="button"
          className={`ens-ref-nav-item ${activeKey === 'games' ? 'is-active' : ''}`}
          onClick={() => handleDockSelect('games', 'home')}
        >
          <Gamepad2 size={21} strokeWidth={2.4} />
          <span>Games</span>
        </button>

        <div className="ens-ref-nav-play-slot">
          <button
            type="button"
            className="ens-ref-nav-play-orb"
            onClick={() => (onQuickPlay ? onQuickPlay() : onSelect('play'))}
            aria-label="Play a word game"
          >
            <Play size={22} fill="#ffffff" strokeWidth={2} style={{ marginLeft: 2 }} />
            <span className="ens-ref-nav-play-label">Play</span>
            {hasOngoingMatch && <span className="ens-nav-dot" />}
          </button>
        </div>

        <button
          type="button"
          className={`ens-ref-nav-item ${activeKey === 'social' ? 'is-active' : ''}`}
          onClick={() => handleDockSelect('social', 'templates')}
        >
          <Users size={20} strokeWidth={2.3} />
          <span>Social</span>
        </button>

        <button
          type="button"
          className={`ens-ref-nav-item ${activeKey === 'profile' ? 'is-active' : ''}`}
          onClick={() => handleDockSelect('profile', 'profile')}
        >
          <User size={20} strokeWidth={2.3} />
          <span>Profile</span>
        </button>
      </nav>
    </div>
  );
};

export const EnscribeBottomNav = BottomNav;
