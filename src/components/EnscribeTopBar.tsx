import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Plus, Settings, User, Volume2, VolumeX } from 'lucide-react';

interface EnscribeTopBarProps {
  nickname: string;
  avatarId: string;
  coins: number;
  isOffline?: boolean;
  onBrandClick?: () => void;
  onOpenProfile: () => void;
  onSwitchGuest?: () => void;
}

export const EnscribeTopBar: React.FC<EnscribeTopBarProps> = ({
  nickname,
  coins,
  onBrandClick,
  onOpenProfile,
  onSwitchGuest,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onOutside);
    return () => window.removeEventListener('mousedown', onOutside);
  }, [menuOpen]);

  const formattedCoins = (2450 + Math.max(0, coins || 0)).toLocaleString();

  return (
    <header className="ens-ref-topbar">
      <button
        type="button"
        className="ens-ref-brand"
        onClick={onBrandClick}
        aria-label="Enscribe"
      >
        <img
          src="/art/brand-en-crown.png"
          alt=""
          className="ens-ref-brand-logo"
        />
        <span className="ens-ref-brand-word">Enscribe</span>
      </button>

      <div className="ens-ref-topbar-right" ref={menuRef}>
        <span className="ens-ref-divider" aria-hidden="true" />

        <button
          type="button"
          className="ens-ref-icon-btn"
          onClick={onOpenProfile}
          aria-label={`Open ${nickname} profile`}
          title={`${nickname} — Profile`}
        >
          <User size={17} strokeWidth={2.4} />
        </button>

        <button
          type="button"
          className="ens-ref-coin-pill"
          onClick={onOpenProfile}
          aria-label={`Coins: ${formattedCoins}`}
          title="Enscribe Coins"
        >
          <span className="ens-ref-coin-badge" aria-hidden="true">
            $
          </span>
          <span className="ens-ref-coin-val">{formattedCoins}</span>
          <span className="ens-ref-coin-plus" aria-hidden="true">
            <Plus size={12} strokeWidth={3} />
          </span>
        </button>

        <button
          type="button"
          className="ens-ref-icon-btn"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Settings"
          title="Settings"
        >
          <Settings size={17} strokeWidth={2.3} />
        </button>

        {menuOpen && (
          <div className="ens-ref-settings-menu" role="menu">
            <div style={{ fontSize: 12, fontWeight: 800, color: '#a5b4fc', padding: '2px 4px 4px' }}>
              Signed in as {nickname}
            </div>
            <button
              type="button"
              className="ens-ref-settings-item"
              onClick={() => {
                setMenuOpen(false);
                onOpenProfile();
              }}
            >
              <User size={15} />
              <span>Player Profile &amp; Stats</span>
            </button>
            <button
              type="button"
              className="ens-ref-settings-item"
              onClick={() => setMuted((prev) => !prev)}
            >
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              <span>{muted ? 'Sound Effects: Muted' : 'Sound Effects: On'}</span>
            </button>
            {onSwitchGuest && (
              <button
                type="button"
                className="ens-ref-settings-item"
                style={{ color: '#fda4af' }}
                onClick={() => {
                  setMenuOpen(false);
                  onSwitchGuest();
                }}
              >
                <LogOut size={15} />
                <span>Switch Guest / Nickname</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
