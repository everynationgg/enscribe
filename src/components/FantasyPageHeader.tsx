import React from 'react';
import { ChevronLeft, HelpCircle } from 'lucide-react';

interface FantasyPageHeaderProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  backdropSrc?: string;
  onBack: () => void;
  onHelp?: () => void;
}

/**
 * Illustrated scenic fantasy header shared by Solo, Rooms, Create Room, and Leaderboard.
 */
export const FantasyPageHeader: React.FC<FantasyPageHeaderProps> = ({
  title,
  subtitle,
  icon,
  backdropSrc = '/art/header-fantasy.png',
  onBack,
  onHelp,
}) => (
  <header className="ens-fantasy-page-header">
    <div className="ens-fph-backdrop" aria-hidden="true">
      <img src={backdropSrc} alt="" className="ens-fph-img" />
      <div className="ens-fph-vignette" />
    </div>

    <div className="ens-fph-top">
      <button
        type="button"
        className="ens-circle-glass-btn"
        onClick={onBack}
        aria-label="Go back"
      >
        <ChevronLeft size={22} strokeWidth={2.6} />
      </button>

      <div className="ens-fph-title-group">
        <span className="ens-fph-icon">{icon}</span>
        <h1 className="ens-fph-title">{title}</h1>
      </div>

      {onHelp ? (
        <button
          type="button"
          className="ens-circle-glass-btn"
          onClick={onHelp}
          aria-label={`${title} help`}
        >
          <HelpCircle size={20} strokeWidth={2.3} />
        </button>
      ) : (
        <span className="ens-circle-spacer" aria-hidden="true" />
      )}
    </div>

    <p className="ens-fph-subtitle">{subtitle}</p>
  </header>
);
