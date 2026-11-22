import React from 'react';
import { Home, Layers, Play, User } from 'lucide-react';

export type NavTab = 'home' | 'play' | 'templates' | 'profile';

interface BottomNavProps {
  activeTab: NavTab;
  onSelect: (tab: NavTab) => void;
  hasOngoingMatch?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelect, hasOngoingMatch }) => {
  const items: Array<{ id: NavTab; label: string; Icon: React.ComponentType<any> }> = [
    { id: 'home', label: 'Home', Icon: Home },
    { id: 'play', label: 'Play', Icon: Play },
    { id: 'templates', label: 'Templates', Icon: Layers },
    { id: 'profile', label: 'Profile', Icon: User },
  ];

  return (
    <nav className="ens-bottom-nav" aria-label="Main navigation">
      {items.map(({ id, label, Icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            className={`ens-nav-btn ${active ? 'is-active' : ''}`}
            onClick={() => onSelect(id)}
          >
            <span className="ens-nav-icon-wrap">
              <Icon size={20} strokeWidth={active ? 2.4 : 2} fill={active && id !== 'profile' ? 'currentColor' : 'none'} />
              {id === 'play' && hasOngoingMatch && <span className="ens-nav-dot" />}
            </span>
            <span className="ens-nav-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
};
