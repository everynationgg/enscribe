import React, { useId } from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

export const GoldCrownIcon: React.FC<IconProps> = ({ size = 18, className }) => {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="4" y1="6" x2="28" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF08A" />
          <stop offset="48%" stopColor="#FFD038" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <path
        d="M5.5 23.5L3.5 11.2C3.3 10 4.8 9.3 5.7 10.1L10.8 14.8L14.8 7.6C15.4 6.6 16.6 6.6 17.2 7.6L21.2 14.8L26.3 10.1C27.2 9.3 28.7 10 28.5 11.2L26.5 23.5C26.3 24.4 25.5 25 24.6 25H7.4C6.5 25 5.7 24.4 5.5 23.5Z"
        fill={`url(#${id}-g)`}
        stroke="#FFF7C2"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <rect x="6.5" y="23.5" width="19" height="3" rx="1.5" fill="#F59E0B" stroke="#FFF4B8" strokeWidth="0.9" />
      <circle cx="4" cy="9.5" r="2" fill="#FFF08A" />
      <circle cx="16" cy="6.2" r="2.2" fill="#FFF7C2" />
      <circle cx="28" cy="9.5" r="2" fill="#FFF08A" />
    </svg>
  );
};

export const LightningBoltIcon: React.FC<IconProps> = ({ size = 24, className }) => {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-b`} x1="6" y1="2" x2="22" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF48D" />
          <stop offset="50%" stopColor="#FFD234" />
          <stop offset="100%" stopColor="#FF961F" />
        </linearGradient>
      </defs>
      <path
        d="M16.2 2.4L6.2 14.9C5.6 15.6 6.1 16.7 7 16.7H13.1L11.4 25.1C11.2 26 12.3 26.6 12.9 25.8L22.6 13.5C23.2 12.8 22.7 11.7 21.8 11.7H15.8L17.6 3.1C17.8 2.2 16.8 1.7 16.2 2.4Z"
        fill={`url(#${id}-b)`}
        stroke="#FFF9C4"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const SparkleClusterIcon: React.FC<IconProps> = ({ size = 22, className }) => {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-s`} x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF8A8" />
          <stop offset="55%" stopColor="#FFD342" />
          <stop offset="100%" stopColor="#FF9F2E" />
        </linearGradient>
      </defs>
      <path
        d="M11.5 3L13.6 9.4L20 11.5L13.6 13.6L11.5 20L9.4 13.6L3 11.5L9.4 9.4L11.5 3Z"
        fill={`url(#${id}-s)`}
        stroke="#FFFBE0"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path
        d="M21 15L22.3 18.7L26 20L22.3 21.3L21 25L19.7 21.3L16 20L19.7 18.7L21 15Z"
        fill={`url(#${id}-s)`}
      />
      <circle cx="21" cy="6.5" r="1.7" fill="#FFF39E" />
    </svg>
  );
};

export const WaveHandIcon: React.FC<IconProps> = ({ size = 20, className }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
    <path
      d="M7.5 13.5L5.2 9.4C4.7 8.5 5.4 7.4 6.4 7.7C7 7.8 7.5 8.3 7.8 8.9L9.8 12.2L8.4 6.2C8.1 5.1 9.1 4.2 10.1 4.6C10.8 4.8 11.2 5.4 11.4 6L12.7 11.5L13.4 4.8C13.5 3.7 14.7 3.2 15.6 3.8C16.2 4.2 16.4 4.9 16.3 5.6L15.7 11.8L18.2 7.2C18.7 6.3 19.9 6.2 20.6 7C21.1 7.6 21.1 8.4 20.7 9.1L17.6 15.2L19.9 13.7C20.7 13.2 21.8 13.6 22 14.6C22.2 15.3 21.9 16.1 21.3 16.6L16.8 21.2C14.7 23.4 11.5 23.9 8.9 22.4C6.4 21 5.2 18.1 6.1 15.3L6.6 13.9L7.5 13.5Z"
      fill="#FFD25A"
      stroke="#FFF3C4"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path d="M4.2 5.5C3.4 6.5 3 7.8 3.1 9.1" stroke="#FFF29C" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M22.8 10.4C23.8 11.3 24.3 12.6 24.2 13.9" stroke="#FFF29C" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const MountainFlagIcon: React.FC<IconProps> = ({ size = 62, className }) => {
  const id = useId();
  return (
    <svg width={size} height={Math.round(size * 0.8)} viewBox="0 0 72 58" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-m1`} x1="18" y1="14" x2="54" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="52%" stopColor="#E0FFF8" />
          <stop offset="100%" stopColor="#9CF5E0" />
        </linearGradient>
        <linearGradient id={`${id}-m2`} x1="4" y1="22" x2="32" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F2FFFC" />
          <stop offset="100%" stopColor="#7DECD2" />
        </linearGradient>
        <linearGradient id={`${id}-flag`} x1="37" y1="3" x2="58" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF7EC2" />
          <stop offset="100%" stopColor="#EC258B" />
        </linearGradient>
      </defs>
      {/* Flagpole + bold pink pennant */}
      <path d="M38 19V5.5" stroke="#4D1E96" strokeWidth="3.2" strokeLinecap="round" />
      <path
        d="M38.5 5.2L57.5 10.6C58.4 10.9 58.4 12.1 57.5 12.4L38.5 17.6V5.2Z"
        fill={`url(#${id}-flag)`}
        stroke="#FFE0F2"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Left smaller twin peak */}
      <path
        d="M4 50L22 22.5C22.8 21.3 24.6 21.3 25.4 22.6L40 50H4Z"
        fill={`url(#${id}-m2)`}
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M23.7 22.2L30 34L25.5 32.5L22.5 35.5L18.5 32L23.7 22.2Z" fill="#FFFFFF" />
      {/* Main snowy peak */}
      <path
        d="M17 50L36.2 17.2C37.1 15.6 39.4 15.6 40.3 17.2L65.5 50H17Z"
        fill={`url(#${id}-m1)`}
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Snow cap highlight & shaded right facet */}
      <path d="M38.2 16.5L47.5 31L41.5 29.2L37.2 33.8L32.8 29.8L38.2 16.5Z" fill="#FFFFFF" />
      <path d="M38.2 16.8L64.8 49.5H41.5L37.2 33.8L41.5 29.2L47.5 31L38.2 16.8Z" fill="#0B9E81" fillOpacity="0.18" />
      {/* Soft snow puffs at base */}
      <ellipse cx="14" cy="49.5" rx="9" ry="4" fill="#DCFFF7" fillOpacity="0.95" />
      <ellipse cx="57" cy="49.5" rx="9.5" ry="4" fill="#DCFFF7" fillOpacity="0.95" />
    </svg>
  );
};

export const TrophyLaurelIcon: React.FC<IconProps> = ({ size = 64, className }) => {
  const id = useId();
  return (
    <svg width={size} height={Math.round(size * 0.8)} viewBox="0 0 76 60" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-t`} x1="20" y1="6" x2="56" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF7AD" />
          <stop offset="42%" stopColor="#FFD236" />
          <stop offset="100%" stopColor="#F5950A" />
        </linearGradient>
        <linearGradient id={`${id}-leaf`} x1="8" y1="14" x2="22" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E9C7FF" />
        </linearGradient>
      </defs>
      {/* Left lush solid laurel branch */}
      <path d="M18 46C10.5 39 9.5 25 16.5 16" stroke="#F8E2FF" strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="11.2" cy="40.5" rx="4.2" ry="2.2" transform="rotate(-38 11.2 40.5)" fill={`url(#${id}-leaf)`} />
      <ellipse cx="9.2" cy="33.5" rx="4.5" ry="2.3" transform="rotate(-18 9.2 33.5)" fill={`url(#${id}-leaf)`} />
      <ellipse cx="9.8" cy="26.2" rx="4.4" ry="2.2" transform="rotate(6 9.8 26.2)" fill={`url(#${id}-leaf)`} />
      <ellipse cx="12.5" cy="19.5" rx="4" ry="2.1" transform="rotate(28 12.5 19.5)" fill={`url(#${id}-leaf)`} />
      <ellipse cx="17.8" cy="46.2" rx="4" ry="2.1" transform="rotate(14 17.8 46.2)" fill={`url(#${id}-leaf)`} />
      {/* Right lush solid laurel branch */}
      <path d="M58 46C65.5 39 66.5 25 59.5 16" stroke="#F8E2FF" strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="64.8" cy="40.5" rx="4.2" ry="2.2" transform="rotate(38 64.8 40.5)" fill={`url(#${id}-leaf)`} />
      <ellipse cx="66.8" cy="33.5" rx="4.5" ry="2.3" transform="rotate(18 66.8 33.5)" fill={`url(#${id}-leaf)`} />
      <ellipse cx="66.2" cy="26.2" rx="4.4" ry="2.2" transform="rotate(-6 66.2 26.2)" fill={`url(#${id}-leaf)`} />
      <ellipse cx="63.5" cy="19.5" rx="4" ry="2.1" transform="rotate(-28 63.5 19.5)" fill={`url(#${id}-leaf)`} />
      <ellipse cx="58.2" cy="46.2" rx="4" ry="2.1" transform="rotate(-14 58.2 46.2)" fill={`url(#${id}-leaf)`} />
      {/* Chunky Trophy Handles */}
      <path d="M23 14H16.2C14 14 13.2 16 14 18.8C15.2 23 19 26 24.5 26.8" stroke="#FFD654" strokeWidth="4.2" strokeLinecap="round" />
      <path d="M53 14H59.8C62 14 62.8 16 62 18.8C60.8 23 57 26 51.5 26.8" stroke="#FFD654" strokeWidth="4.2" strokeLinecap="round" />
      {/* Bold Trophy Cup */}
      <path
        d="M21 8.5H55L52.6 26.5C51.7 33.5 45.6 38 38 38C30.4 38 24.3 33.5 23.4 26.5L21 8.5Z"
        fill={`url(#${id}-t)`}
        stroke="#FFFBE0"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Specular Vertical Gloss on Cup */}
      <path d="M25.5 12H30.5L29 29C26.8 27 26 24.5 25.5 12Z" fill="#FFFFFF" fillOpacity="0.45" />
      {/* Stem & Tiered Base */}
      <rect x="33.5" y="37" width="9" height="9" rx="2.5" fill="#F59B14" stroke="#FFF4B8" strokeWidth="1.2" />
      <rect x="24" y="45" width="28" height="7" rx="3.5" fill={`url(#${id}-t)`} stroke="#FFFBE0" strokeWidth="1.6" />
      {/* Ruby-Pink Emblem Star */}
      <path
        d="M38 14.2L40.1 18.7L45.1 19.4L41.4 22.9L42.3 27.8L38 25.4L33.7 27.8L34.6 22.9L30.9 19.4L35.9 18.7L38 14.2Z"
        fill="#F43594"
        stroke="#FFE4F4"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const PodiumCrownIcon: React.FC<IconProps> = ({ size = 64, className }) => {
  const id = useId();
  return (
    <svg width={size} height={Math.round(size * 0.8)} viewBox="0 0 76 60" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-c`} x1="23" y1="3" x2="53" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF7AD" />
          <stop offset="48%" stopColor="#FFD236" />
          <stop offset="100%" stopColor="#F5950A" />
        </linearGradient>
        <linearGradient id={`${id}-p`} x1="16" y1="24" x2="60" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#B8E3FF" />
        </linearGradient>
        <linearGradient id={`${id}-leaf`} x1="8" y1="16" x2="20" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#C2ECFF" />
        </linearGradient>
      </defs>
      {/* Left solid cyan-white laurel branch */}
      <path d="M16 46C9.5 39 9 26 15.5 17" stroke="#E0F6FF" strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="10.2" cy="40.5" rx="4.1" ry="2.1" transform="rotate(-38 10.2 40.5)" fill={`url(#${id}-leaf)`} />
      <ellipse cx="8.6" cy="33.5" rx="4.4" ry="2.2" transform="rotate(-18 8.6 33.5)" fill={`url(#${id}-leaf)`} />
      <ellipse cx="9.2" cy="26.2" rx="4.3" ry="2.2" transform="rotate(6 9.2 26.2)" fill={`url(#${id}-leaf)`} />
      <ellipse cx="11.8" cy="19.5" rx="3.9" ry="2" transform="rotate(28 11.8 19.5)" fill={`url(#${id}-leaf)`} />
      {/* Right solid cyan-white laurel branch */}
      <path d="M60 46C66.5 39 67 26 60.5 17" stroke="#E0F6FF" strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="65.8" cy="40.5" rx="4.1" ry="2.1" transform="rotate(38 65.8 40.5)" fill={`url(#${id}-leaf)`} />
      <ellipse cx="67.4" cy="33.5" rx="4.4" ry="2.2" transform="rotate(18 67.4 33.5)" fill={`url(#${id}-leaf)`} />
      <ellipse cx="66.8" cy="26.2" rx="4.3" ry="2.2" transform="rotate(-6 66.8 26.2)" fill={`url(#${id}-leaf)`} />
      <ellipse cx="64.2" cy="19.5" rx="3.9" ry="2" transform="rotate(-28 64.2 19.5)" fill={`url(#${id}-leaf)`} />
      {/* Chunky 3-step Podium */}
      <rect x="15" y="34.5" width="14" height="17.5" rx="3.5" fill="#C9E6FF" stroke="#FFFFFF" strokeWidth="1.8" />
      <rect x="47" y="38.5" width="14" height="13.5" rx="3.5" fill="#B2DAFF" stroke="#FFFFFF" strokeWidth="1.8" />
      <rect x="29" y="26.5" width="18" height="25.5" rx="4" fill={`url(#${id}-p)`} stroke="#FFFFFF" strokeWidth="2" />
      {/* Subtle rank numbers on podium steps */}
      <rect x="33" y="30" width="10" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.85" />
      {/* Prominent Golden Crown above Center Podium */}
      <path
        d="M25.5 22L22.8 10.6C22.5 9.3 24.1 8.4 25.1 9.3L30.8 14.3L36.4 6.4C37.2 5.3 38.8 5.3 39.6 6.4L45.2 14.3L50.9 9.3C51.9 8.4 53.5 9.3 53.2 10.6L50.5 22H25.5Z"
        fill={`url(#${id}-c)`}
        stroke="#FFFBE0"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <rect x="26.5" y="21.5" width="23" height="3.2" rx="1.6" fill="#F59B14" stroke="#FFF4B8" strokeWidth="1" />
      <circle cx="23.5" cy="9.2" r="2.2" fill="#FFF7AD" />
      <circle cx="38" cy="5.5" r="2.5" fill="#FFFBE0" />
      <circle cx="52.5" cy="9.2" r="2.2" fill="#FFF7AD" />
    </svg>
  );
};

export const RoomsUsersIcon: React.FC<IconProps & { color?: string }> = ({
  size = 24,
  color = 'currentColor',
  className,
}) => (
  <svg width={size} height={size} viewBox="0 0 28 24" fill="none" className={className} aria-hidden="true">
    <circle cx="10.5" cy="7.5" r="4.2" stroke={color} strokeWidth="2.2" />
    <path d="M3.2 20.5C3.6 16.4 6.6 14 10.5 14C14.4 14 17.4 16.4 17.8 20.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="19.2" cy="8.2" r="3.4" stroke={color} strokeWidth="2.1" />
    <path d="M18.6 14.3C21.8 14.5 24.3 16.7 24.8 20.3" stroke={color} strokeWidth="2.1" strokeLinecap="round" />
  </svg>
);

export const HouseRoomIcon: React.FC<IconProps & { color?: string }> = ({
  size = 24,
  color = 'currentColor',
  className,
}) => (
  <svg width={size} height={size} viewBox="0 0 26 26" fill="none" className={className} aria-hidden="true">
    <path
      d="M4.5 12.2L13 4.8L21.5 12.2V20.5C21.5 21.3 20.8 22 20 22H6C5.2 22 4.5 21.3 4.5 20.5V12.2Z"
      stroke={color}
      strokeWidth="2.3"
      strokeLinejoin="round"
    />
    <path d="M10.3 22V15.4C10.3 14.6 11 14 11.8 14H14.2C15 14 15.7 14.6 15.7 15.4V22" stroke={color} strokeWidth="2.1" strokeLinejoin="round" />
  </svg>
);

export const QrCodeIcon: React.FC<IconProps> = ({ size = 22, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="2" />
    <rect x="5.8" y="5.8" width="2" height="2" rx="0.4" fill="currentColor" />
    <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="2" />
    <rect x="16.3" y="5.8" width="2" height="2" rx="0.4" fill="currentColor" />
    <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="2" />
    <rect x="5.8" y="16.3" width="2" height="2" rx="0.4" fill="currentColor" />
    <path d="M14 14H17V17H14V14ZM18.5 14H20.5V16H18.5V14ZM14 18.5H16.5V20.5H14V18.5ZM18 18H20.5V20.5H18V18Z" fill="currentColor" />
  </svg>
);

export const GiftBoxIcon: React.FC<IconProps> = ({ size = 34, className }) => {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-box`} x1="6" y1="12" x2="32" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF72C6" />
          <stop offset="100%" stopColor="#D6258F" />
        </linearGradient>
      </defs>
      <rect x="6" y="16" width="26" height="17" rx="3.5" fill={`url(#${id}-box)`} stroke="#FFC4E9" strokeWidth="1.3" />
      <rect x="4" y="11.5" width="30" height="6" rx="2.5" fill="#FF89D2" stroke="#FFD6EF" strokeWidth="1.2" />
      <rect x="16.5" y="11.5" width="5" height="21.5" fill="#FFE05D" />
      <path d="M19 11.5C15.5 11.5 12 9 13 6.8C13.8 5 17 6 19 11.5Z" fill="#FFE873" stroke="#FFF9D6" strokeWidth="1" />
      <path d="M19 11.5C22.5 11.5 26 9 25 6.8C24.2 5 21 6 19 11.5Z" fill="#FFD342" stroke="#FFF9D6" strokeWidth="1" />
    </svg>
  );
};

export const PurpleGemIcon: React.FC<IconProps> = ({ size = 24, className }) => {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-gem`} x1="5" y1="3" x2="23" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5A6FF" />
          <stop offset="50%" stopColor="#B84DFF" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
      </defs>
      <polygon points="14,2.5 23,9 19.5,24.5 8.5,24.5 5,9" fill={`url(#${id}-gem)`} stroke="#FCE7FF" strokeWidth="1.3" strokeLinejoin="round" />
      <polygon points="14,2.5 18.5,9.5 14,19 9.5,9.5" fill="#F8D2FF" fillOpacity="0.45" />
    </svg>
  );
};

export const PuzzleBadgeIcon: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M11 3.5C12.4 3.5 13.4 4.5 13.4 5.7C13.4 6.2 13.2 6.6 13 7H17.5C18.3 7 19 7.7 19 8.5V12C19.4 11.8 19.8 11.7 20.3 11.7C21.5 11.7 22.5 12.7 22.5 14C22.5 15.3 21.5 16.3 20.3 16.3C19.8 16.3 19.4 16.1 19 15.9V19.5C19 20.3 18.3 21 17.5 21H13.5C13.7 20.6 13.9 20.1 13.9 19.6C13.9 18.3 12.9 17.3 11.6 17.3C10.3 17.3 9.3 18.3 9.3 19.6C9.3 20.1 9.5 20.6 9.7 21H6C5.2 21 4.5 20.3 4.5 19.5V15.3C4.1 15.5 3.7 15.6 3.2 15.6C2 15.6 1 14.6 1 13.4C1 12.2 2 11.2 3.2 11.2C3.7 11.2 4.1 11.3 4.5 11.5V8.5C4.5 7.7 5.2 7 6 7H9.1C8.9 6.6 8.7 6.2 8.7 5.7C8.7 4.5 9.7 3.5 11 3.5Z"
      fill="url(#puzGrad)"
      stroke="#FFD6F6"
      strokeWidth="1.2"
    />
    <defs>
      <linearGradient id="puzGrad" x1="2" y1="4" x2="21" y2="21" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FF97D5" />
        <stop offset="100%" stopColor="#9E6BFF" />
      </linearGradient>
    </defs>
  </svg>
);

export const GearBadgeIcon: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M12 8.6A3.4 3.4 0 1 0 12 15.4A3.4 3.4 0 1 0 12 8.6Z"
      stroke="#E6E1FF"
      strokeWidth="2.1"
    />
    <path
      d="M19.4 13.5C19.5 13 19.5 11 19.4 10.5L21.3 9L19.5 5.9L17.2 6.7C16.5 6.1 15.7 5.7 14.8 5.4L14.3 3H10.7L10.2 5.4C9.3 5.7 8.5 6.1 7.8 6.7L5.5 5.9L3.7 9L5.6 10.5C5.5 11 5.5 13 5.6 13.5L3.7 15L5.5 18.1L7.8 17.3C8.5 17.9 9.3 18.3 10.2 18.6L10.7 21H14.3L14.8 18.6C15.7 18.3 16.5 17.9 17.2 17.3L19.5 18.1L21.3 15L19.4 13.5Z"
      stroke="#D5CEFF"
      strokeWidth="1.9"
      strokeLinejoin="round"
    />
  </svg>
);
