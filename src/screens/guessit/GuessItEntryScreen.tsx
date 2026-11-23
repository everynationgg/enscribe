import React from 'react';
import {
  ChevronRight,
  Compass,
  FileText,
  Hexagon,
  Plus,
  Users,
} from 'lucide-react';
import { Profile } from '../../../shared/types';
import { GuessItEntryHeroArt } from '../../games/guessit/GuessItMascot';

interface GuessItEntryScreenProps {
  profile: Profile;
  onExitToHub: () => void;
  onPlayMultiplayer: () => void;
  onSoloAdventure: () => void;
  onOpenTemplates: () => void;
}

export const GuessItEntryScreen: React.FC<GuessItEntryScreenProps> = ({
  profile,
  onExitToHub,
  onPlayMultiplayer,
  onSoloAdventure,
  onOpenTemplates,
}) => {
  return (
    <div className="ens-guessit-shell is-scrollable">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <header className="ens-guessit-topbar">
        <button
          type="button"
          className="ens-guessit-brand-btn"
          onClick={onExitToHub}
          aria-label="Back to Enscribe Hub"
          title="Back to Enscribe Hub"
        >
          <Hexagon size={18} color="#38bdf8" fill="rgba(56, 189, 248, 0.3)" />
          <span>Enscribe</span>
        </button>

        <div className="ens-guessit-coin-pill" title="Enscribe Coins">
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: '999px',
              background: 'linear-gradient(180deg, #fef08a 0%, #f59e0b 100%)',
              color: '#78350f',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 900,
            }}
            aria-hidden="true"
          >
            $
          </span>
          <span>{profile.matchPointsBalance.toLocaleString()}</span>
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: '999px',
              background: '#22c55e',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-hidden="true"
          >
            <Plus size={12} strokeWidth={3} />
          </span>
        </div>
      </header>

      <div className="ens-guessit-scroll">
        <GuessItEntryHeroArt />

        <div className="ens-guessit-cta-stack">
          <button
            type="button"
            className="ens-guessit-big-cta is-gold"
            onClick={onPlayMultiplayer}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="ens-guessit-cta-icon">
                <Users size={22} color="#ffffff" />
              </span>
              <span>Play Multiplayer</span>
            </span>
            <ChevronRight size={22} strokeWidth={3} />
          </button>

          <button
            type="button"
            className="ens-guessit-big-cta is-adventure"
            onClick={onSoloAdventure}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="ens-guessit-cta-icon">
                <Compass size={22} color="#ffffff" />
              </span>
              <span>Solo Adventure</span>
            </span>
            <ChevronRight size={22} strokeWidth={3} />
          </button>

          <button
            type="button"
            className="ens-guessit-big-cta is-templates"
            onClick={onOpenTemplates}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="ens-guessit-cta-icon">
                <FileText size={21} color="#ffffff" />
              </span>
              <span>My Templates</span>
            </span>
            <ChevronRight size={22} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
};
