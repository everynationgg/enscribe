import React from 'react';
import { ThumbnailKey } from '../../shared/types';

export const EnscribeLogo: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="ensLinkCyan" x1="4" y1="8" x2="28" y2="34" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#63f8ff" />
        <stop offset="55%" stopColor="#00c4ff" />
        <stop offset="100%" stopColor="#1464ff" />
      </linearGradient>
      <linearGradient id="ensLinkPink" x1="18" y1="14" x2="44" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ff58b2" />
        <stop offset="55%" stopColor="#d138ff" />
        <stop offset="100%" stopColor="#6e2eff" />
      </linearGradient>
    </defs>
    <g transform="translate(24 24) rotate(-32) translate(-24 -24)">
      <rect
        x="6"
        y="14"
        width="22"
        height="13"
        rx="6.5"
        stroke="url(#ensLinkCyan)"
        strokeWidth="5.5"
        fill="none"
      />
      <rect
        x="20"
        y="21"
        width="22"
        height="13"
        rx="6.5"
        stroke="url(#ensLinkPink)"
        strokeWidth="5.5"
        fill="none"
      />
      <path d="M12 14.5H20" stroke="#b8feff" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
      <path d="M28 21.5H36" stroke="#ffc2e6" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
    </g>
  </svg>
);

export const AvatarBadge: React.FC<{
  avatarId: string;
  size?: number;
  ringColor?: string;
}> = ({ avatarId, size = 44, ringColor }) => {
  const configs: Record<
    string,
    { bg: string; hair: string; skin: string; shirt: string; accent?: string; glasses?: boolean; hat?: string }
  > = {
    alex: {
      bg: 'linear-gradient(135deg, #4285f4 0%, #2447b8 100%)',
      hair: '#3e2723',
      skin: '#f6c29b',
      shirt: '#1d4ed8',
      accent: '#60a5fa',
    },
    novarex: {
      bg: 'linear-gradient(135deg, #ec4899 0%, #7c3aed 100%)',
      hair: '#ff499e',
      skin: '#fde0cd',
      shirt: '#4c1d95',
      accent: '#f472b6',
    },
    pixelmochi: {
      bg: 'linear-gradient(135deg, #8b5cf6 0%, #4338ca 100%)',
      hair: '#4a2c2a',
      skin: '#f8cba6',
      shirt: '#dc2626',
      glasses: true,
    },
    leafy: {
      bg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
      hair: '#5c3a21',
      skin: '#f4c095',
      shirt: '#065f46',
      hat: '#22c55e',
    },
    spark: {
      bg: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
      hair: '#fbbf24',
      skin: '#f6c29b',
      shirt: '#7c2d12',
    },
    knight: {
      bg: 'linear-gradient(135deg, #06b6d4 0%, #1e3a8a 100%)',
      hair: '#1e293b',
      skin: '#e8b490',
      shirt: '#334155',
    },
  };

  const cfg = configs[avatarId] || configs.alex;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: cfg.bg,
        border: `2px solid ${ringColor || 'rgba(130, 210, 255, 0.7)'}`,
        boxShadow: '0 2px 8px rgba(10, 18, 60, 0.35)',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        {/* Shoulders */}
        <path d="M12 64C14 48 22 43 32 43C42 43 50 48 52 64Z" fill={cfg.shirt} />
        {/* Neck */}
        <rect x="27" y="38" width="10" height="8" rx="4" fill={cfg.skin} />
        {/* Hair back */}
        {avatarId === 'novarex' && (
          <path d="M14 26C14 14 22 9 32 9C42 9 50 14 50 26L52 46C46 44 43 40 43 40H21C21 40 18 44 12 46Z" fill={cfg.hair} />
        )}
        {/* Face */}
        <circle cx="32" cy="28" r="14" fill={cfg.skin} />
        {/* Hair front */}
        {cfg.hat ? (
          <path d="M16 25C16 14 23 10 32 10C41 10 48 14 48 25C43 22 21 22 16 25Z" fill={cfg.hat} />
        ) : (
          <path
            d="M17 26C17 15 24 10 32 10C40 10 47 15 47 26C44 21 38 19 32 20C25 19 20 22 17 26Z"
            fill={cfg.hair}
          />
        )}
        {/* Eyes */}
        <circle cx="26.5" cy="28.5" r="2.2" fill="#1e2240" />
        <circle cx="37.5" cy="28.5" r="2.2" fill="#1e2240" />
        <circle cx="27.2" cy="27.8" r="0.7" fill="#fff" />
        <circle cx="38.2" cy="27.8" r="0.7" fill="#fff" />
        {cfg.glasses && (
          <g stroke="#1e293b" strokeWidth="1.6" fill="rgba(255,255,255,0.2)">
            <circle cx="26.5" cy="28.5" r="4.5" />
            <circle cx="37.5" cy="28.5" r="4.5" />
            <line x1="31" y1="28.5" x2="33" y2="28.5" />
          </g>
        )}
        {/* Smile */}
        <path d="M27.5 34.5C29.5 36.8 34.5 36.8 36.5 34.5" stroke="#9d5846" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
};

export const TemplateThumb: React.FC<{ thumbnailKey: ThumbnailKey; size?: number }> = ({
  thumbnailKey,
  size = 54,
}) => {
  const renderArt = () => {
    switch (thumbnailKey) {
      case 'school':
        return (
          <svg viewBox="0 0 64 64" width={size} height={size}>
            <defs>
              <linearGradient id="skySch" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8bd4ff" />
                <stop offset="100%" stopColor="#d8f1ff" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="12" fill="url(#skySch)" />
            <rect x="0" y="48" width="64" height="16" fill="#4cd47a" />
            <rect x="12" y="28" width="40" height="22" rx="2" fill="#ffd257" />
            <polygon points="8,28 32,16 56,28" fill="#ff6b57" />
            <rect x="24" y="12" width="16" height="14" fill="#ffe17d" />
            <polygon points="22,12 32,5 42,12" fill="#ff5247" />
            <circle cx="32" cy="18" r="4" fill="#ffffff" stroke="#1e293b" strokeWidth="1" />
            <rect x="28" y="37" width="8" height="13" rx="1.5" fill="#8b4513" />
            <rect x="16" y="34" width="6" height="7" rx="1" fill="#8bd4ff" />
            <rect x="42" y="34" width="6" height="7" rx="1" fill="#8bd4ff" />
          </svg>
        );
      case 'castle':
        return (
          <svg viewBox="0 0 64 64" width={size} height={size}>
            <defs>
              <linearGradient id="skyCas" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#4c2889" />
                <stop offset="100%" stopColor="#a755f7" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="12" fill="url(#skyCas)" />
            <circle cx="15" cy="14" r="1.5" fill="#fde047" />
            <circle cx="50" cy="18" r="1.5" fill="#fde047" />
            <rect x="14" y="30" width="10" height="26" fill="#d8b4fe" />
            <polygon points="12,30 19,17 26,30" fill="#ec4899" />
            <rect x="40" y="30" width="10" height="26" fill="#d8b4fe" />
            <polygon points="38,30 45,17 52,30" fill="#ec4899" />
            <rect x="24" y="24" width="16" height="32" fill="#ede9fe" />
            <polygon points="22,24 32,9 42,24" fill="#f43f5e" />
            <path d="M27 56V44C27 41 37 41 37 44V56Z" fill="#581c87" />
          </svg>
        );
      case 'burger':
        return (
          <svg viewBox="0 0 64 64" width={size} height={size}>
            <defs>
              <linearGradient id="skyBrg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffedd5" />
                <stop offset="100%" stopColor="#fed7aa" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="12" fill="url(#skyBrg)" />
            <path d="M12 30C12 18 52 18 52 30Z" fill="#f59e0b" />
            <circle cx="24" cy="23" r="1.5" fill="#fef3c7" />
            <circle cx="33" cy="21" r="1.5" fill="#fef3c7" />
            <circle cx="41" cy="24" r="1.5" fill="#fef3c7" />
            <path d="M11 32C15 30 20 34 26 31C32 29 38 34 45 31C49 30 52 32 53 33L52 36H12Z" fill="#22c55e" />
            <polygon points="14,35 50,35 45,42 32,37 19,42" fill="#facc15" />
            <rect x="12" y="37" width="40" height="8" rx="4" fill="#78350f" />
            <rect x="14" y="45" width="36" height="8" rx="4" fill="#d97706" />
          </svg>
        );
      case 'scifi':
        return (
          <svg viewBox="0 0 64 64" width={size} height={size}>
            <rect width="64" height="64" rx="12" fill="#0f172a" />
            <circle cx="14" cy="14" r="1.5" fill="#38bdf8" />
            <circle cx="48" cy="12" r="2" fill="#a855f7" />
            <circle cx="50" cy="46" r="1.5" fill="#e0f2fe" />
            <path d="M32 10L41 34L32 42L23 34Z" fill="#38bdf8" />
            <circle cx="32" cy="26" r="4.5" fill="#e0f2fe" />
            <polygon points="23,34 14,44 26,40" fill="#6366f1" />
            <polygon points="41,34 50,44 38,40" fill="#6366f1" />
            <polygon points="28,42 32,54 36,42" fill="#fb923c" />
          </svg>
        );
      case 'myth':
        return (
          <svg viewBox="0 0 64 64" width={size} height={size}>
            <rect width="64" height="64" rx="12" fill="#1e1b4b" />
            <polygon points="36,10 22,34 33,34 26,54 44,28 33,28" fill="#facc15" />
          </svg>
        );
      case 'horror':
        return (
          <svg viewBox="0 0 64 64" width={size} height={size}>
            <rect width="64" height="64" rx="12" fill="#1f1638" />
            <circle cx="48" cy="16" r="8" fill="#fef08a" opacity="0.85" />
            <path d="M22 50V30C22 21 42 21 42 30V50L37 46L32 50L27 46Z" fill="#e2e8f0" />
            <circle cx="28" cy="31" r="2.3" fill="#0f172a" />
            <circle cx="36" cy="31" r="2.3" fill="#0f172a" />
          </svg>
        );
      case 'nature':
        return (
          <svg viewBox="0 0 64 64" width={size} height={size}>
            <rect width="64" height="64" rx="12" fill="#064e3b" />
            <polygon points="10,50 26,20 42,50" fill="#10b981" />
            <polygon points="28,50 42,26 56,50" fill="#34d399" />
            <path d="M0 49C16 44 42 54 64 47V64H0Z" fill="#0ea5e9" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 64 64" width={size} height={size}>
            <rect width="64" height="64" rx="12" fill="#312e81" />
            <rect x="14" y="18" width="22" height="14" rx="7" stroke="#38bdf8" strokeWidth="4" fill="none" />
            <rect x="28" y="32" width="22" height="14" rx="7" stroke="#f472b6" strokeWidth="4" fill="none" />
          </svg>
        );
    }
  };

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: '0 3px 10px rgba(15, 23, 66, 0.14)',
      }}
    >
      {renderArt()}
    </div>
  );
};

export const FantasyBannerArt: React.FC = () => (
  <svg
    viewBox="0 0 180 120"
    style={{ position: 'absolute', right: 0, bottom: 0, width: '54%', height: '100%', pointerEvents: 'none' }}
    preserveAspectRatio="xMaxYMax slice"
  >
    <defs>
      <linearGradient id="castleGlow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#9f7aea" />
        <stop offset="100%" stopColor="#4c1d95" />
      </linearGradient>
    </defs>
    {/* Distant glowing mist */}
    <ellipse cx="120" cy="95" rx="65" ry="30" fill="#38bdf8" opacity="0.22" />
    {/* Hills */}
    <path d="M20 120 Q80 75 180 95 L180 120 Z" fill="#1e1b4b" opacity="0.7" />
    {/* Castle */}
    <g fill="url(#castleGlow)">
      <rect x="92" y="56" width="14" height="50" />
      <polygon points="89,56 99,36 109,56" fill="#ec4899" />
      <rect x="110" y="42" width="20" height="64" />
      <polygon points="107,42 120,16 133,42" fill="#f472b6" />
      <rect x="134" y="52" width="16" height="54" />
      <polygon points="131,52 142,30 153,52" fill="#ec4899" />
      <rect x="153" y="64" width="12" height="42" />
      <polygon points="150,64 159,46 168,64" fill="#c084fc" />
    </g>
    {/* Glowing castle windows */}
    <rect x="117" y="52" width="6" height="10" rx="3" fill="#fde047" />
    <rect x="96" y="66" width="5" height="8" rx="2.5" fill="#fde047" />
    <rect x="139" y="64" width="5" height="8" rx="2.5" fill="#fde047" />
    {/* Flying dragon silhouette */}
    <path
      d="M84 36 C78 30 70 32 67 27 C72 26 76 28 80 28 C82 22 88 20 93 24 C89 27 88 31 92 35 C89 35 87 35 84 36 Z"
      fill="#31105f"
    />
    {/* Sparkles */}
    <circle cx="65" cy="18" r="1.5" fill="#fde047" />
    <circle cx="152" cy="18" r="2" fill="#fde047" />
    <circle cx="166" cy="36" r="1.5" fill="#38bdf8" />
    <circle cx="80" cy="54" r="1.5" fill="#f9a8d4" />
  </svg>
);
