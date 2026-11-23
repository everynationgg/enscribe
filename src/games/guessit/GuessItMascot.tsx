import React from 'react';
import { Clapperboard, Crown, Sparkles } from 'lucide-react';

export const GuessItEntryHeroArt: React.FC = () => (
  <div className="ens-guessit-entry-hero">
    <div className="ens-guessit-qtile" aria-hidden="true">
      ?
    </div>
    <div className="ens-guessit-logo-main">GuessIt</div>
    <p className="ens-guessit-entry-sub">
      Guess the hidden words! Test your vocabulary, deduction, and speed!
    </p>

    <div className="ens-guessit-mascot-stage">
      <div className="ens-guessit-mascot-aura" aria-hidden="true" />
      <div className="ens-guessit-float-tile is-a" aria-hidden="true">
        A
      </div>
      <img
        src="/art/hero-mascot.png"
        alt="GuessIt Goggle Cat Mascot"
        className="ens-guessit-mascot-img"
      />
      <div className="ens-guessit-float-tile is-z" aria-hidden="true">
        Z
      </div>
    </div>
  </div>
);

export const GuessItCinemaFooterArt: React.FC = () => (
  <div
    aria-hidden="true"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px 2px',
      opacity: 0.72,
      color: '#a5b4fc',
      fontSize: 11,
      fontWeight: 800,
    }}
  >
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <Sparkles size={13} color="#fde047" /> Studio Arena Live
    </span>
    <Clapperboard size={20} color="#c4b5fd" />
  </div>
);

export const GuessItChestHeroArt: React.FC = () => (
  <div
    style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '8px 0 4px',
    }}
  >
    <div
      style={{
        position: 'absolute',
        width: 190,
        height: 150,
        borderRadius: '50%',
        background:
          'radial-gradient(circle, rgba(253, 224, 71, 0.55) 0%, rgba(168, 85, 247, 0.25) 55%, transparent 75%)',
        filter: 'blur(8px)',
      }}
      aria-hidden="true"
    />
    <svg
      width="160"
      height="136"
      viewBox="0 0 160 136"
      fill="none"
      style={{ position: 'relative', zIndex: 2 }}
      aria-label="Golden Adventure Treasure Chest"
    >
      <defs>
        <linearGradient id="chestLid" x1="26" y1="20" x2="134" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id="chestBody" x1="28" y1="64" x2="132" y2="122" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#451a03" />
        </linearGradient>
      </defs>
      {/* Radiant coins glow inside open lid */}
      <ellipse cx="80" cy="66" rx="46" ry="18" fill="#fef08a" />
      <circle cx="58" cy="60" r="8" fill="#facc15" stroke="#fffbeb" strokeWidth="2" />
      <circle cx="80" cy="56" r="10" fill="#fde047" stroke="#fffbeb" strokeWidth="2" />
      <circle cx="102" cy="60" r="8" fill="#facc15" stroke="#fffbeb" strokeWidth="2" />
      <path d="M40 46L80 20L120 46L114 66H46L40 46Z" fill="url(#chestLid)" stroke="#fef08a" strokeWidth="3.5" strokeLinejoin="round" />
      <rect x="32" y="64" width="96" height="54" rx="14" fill="url(#chestBody)" stroke="#facc15" strokeWidth="4" />
      <rect x="68" y="64" width="24" height="54" fill="#fbbf24" />
      <circle cx="80" cy="84" r="9" fill="#fffbeb" stroke="#78350f" strokeWidth="2.5" />
    </svg>
    <div style={{ position: 'relative', zIndex: 3, marginTop: -8 }}>
      <Crown size={20} color="#fde047" fill="#fde047" />
    </div>
  </div>
);
