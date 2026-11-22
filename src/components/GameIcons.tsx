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

export const MountainFlagIcon: React.FC<IconProps> = ({ size = 46, className }) => {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 56" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-m1`} x1="18" y1="18" x2="48" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#D6FFF7" />
          <stop offset="100%" stopColor="#94F2DC" />
        </linearGradient>
        <linearGradient id={`${id}-m2`} x1="6" y1="26" x2="28" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E6FFF9" />
          <stop offset="100%" stopColor="#6FE3C7" />
        </linearGradient>
        <linearGradient id={`${id}-flag`} x1="33" y1="6" x2="50" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF75B5" />
          <stop offset="100%" stopColor="#EB378D" />
        </linearGradient>
      </defs>
      {/* Flagpole + pink pennant */}
      <path d="M33 21V7.5" stroke="#5E299E" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M33.5 7.8L48 12.2L33.5 16.8V7.8Z" fill={`url(#${id}-flag)`} stroke="#FFD3EB" strokeWidth="1.1" strokeLinejoin="round" />
      {/* Back left smaller peak */}
      <path d="M7 47L21 25L33 47H7Z" fill={`url(#${id}-m2)`} stroke="#FFFFFF" strokeWidth="1.4" strokeLinejoin="round" />
      {/* Main snowy peak */}
      <path d="M16 47L33 19.5L54 47H16Z" fill={`url(#${id}-m1)`} stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round" />
      {/* Snow ridge shading */}
      <path d="M33 19.5L40 31.5L35 30L31.5 34L27.5 30.5L33 19.5Z" fill="#FFFFFF" />
      <path d="M33 20L53.5 47H35L31.5 34L35 30L40 31.5L33 20Z" fill="#18B899" fillOpacity="0.16" />
      {/* Soft snow clouds around base */}
      <ellipse cx="14" cy="46.5" rx="7" ry="3.2" fill="#D5FFF5" fillOpacity="0.85" />
      <ellipse cx="50" cy="46.5" rx="7" ry="3.2" fill="#D5FFF5" fillOpacity="0.85" />
    </svg>
  );
};

export const TrophyLaurelIcon: React.FC<IconProps> = ({ size = 48, className }) => {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 68 56" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-t`} x1="20" y1="8" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF59E" />
          <stop offset="45%" stopColor="#FFD23F" />
          <stop offset="100%" stopColor="#F59B14" />
        </linearGradient>
      </defs>
      {/* Lavender-white laurel wreath left */}
      <path
        d="M17 41C11 35 10 24 16 17M14 36C10.5 35 8.5 32 9 29M13 29C9.5 28 8 25 9 22M15 22C12 20.5 11.5 17.5 13 15.5M19 42C16.5 44 13.5 43.5 12 41.5"
        stroke="#F6DCFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Lavender-white laurel wreath right */}
      <path
        d="M51 41C57 35 58 24 52 17M54 36C57.5 35 59.5 32 59 29M55 29C58.5 28 60 25 59 22M53 22C56 20.5 56.5 17.5 55 15.5M49 42C51.5 44 54.5 43.5 56 41.5"
        stroke="#F6DCFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Handles */}
      <path d="M23 16H17.5C15.8 16 15 17.5 15.6 19.6C16.5 22.8 19.5 25 23.5 25.5" stroke="#FFD65A" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M45 16H50.5C52.2 16 53 17.5 52.4 19.6C51.5 22.8 48.5 25 44.5 25.5" stroke="#FFD65A" strokeWidth="3.2" strokeLinecap="round" />
      {/* Cup */}
      <path
        d="M22 12H46L44.2 25.5C43.5 31 39 34.5 34 34.5C29 34.5 24.5 31 23.8 25.5L22 12Z"
        fill={`url(#${id}-t)`}
        stroke="#FFF8CC"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Stem & base */}
      <rect x="31" y="34" width="6" height="8" rx="2" fill="#F59B14" />
      <rect x="24" y="41" width="20" height="5.5" rx="2.7" fill={`url(#${id}-t)`} stroke="#FFF8CC" strokeWidth="1.2" />
      {/* Center ruby-pink star */}
      <path
        d="M34 16.5L35.6 19.9L39.3 20.4L36.6 23L37.3 26.6L34 24.8L30.7 26.6L31.4 23L28.7 20.4L32.4 19.9L34 16.5Z"
        fill="#F43F98"
        stroke="#FFE0F2"
        strokeWidth="0.9"
      />
    </svg>
  );
};

export const PodiumCrownIcon: React.FC<IconProps> = ({ size = 48, className }) => {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 68 56" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-c`} x1="22" y1="6" x2="46" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF59E" />
          <stop offset="50%" stopColor="#FFD038" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id={`${id}-p`} x1="16" y1="26" x2="52" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#BEE8FF" />
        </linearGradient>
      </defs>
      {/* Cyan-white laurel branches */}
      <path
        d="M15 41C10 35 9.5 25 14.5 18M12.5 36C9.5 35 8 32 8.5 29M12 29C9 28 7.5 25 8.5 22M14 22C11.5 20.5 11 18 12.5 16"
        stroke="#D8F3FF"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M53 41C58 35 58.5 25 53.5 18M55.5 36C58.5 35 60 32 59.5 29M56 29C59 28 60.5 25 59.5 22M54 22C56.5 20.5 57 18 55.5 16"
        stroke="#D8F3FF"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* 3-step podium */}
      <rect x="16" y="34" width="11" height="14" rx="2.5" fill="#B5D8FF" stroke="#FFFFFF" strokeWidth="1.2" />
      <rect x="41" y="37" width="11" height="11" rx="2.5" fill="#9ECAFF" stroke="#FFFFFF" strokeWidth="1.2" />
      <rect x="27" y="27" width="14" height="21" rx="3" fill={`url(#${id}-p)`} stroke="#FFFFFF" strokeWidth="1.5" />
      {/* Crown above center podium */}
      <path
        d="M24.5 22L22.5 13C22.3 12 23.5 11.4 24.3 12L28.5 15.8L32.8 9.8C33.4 9 34.6 9 35.2 9.8L39.5 15.8L43.7 12C44.5 11.4 45.7 12 45.5 13L43.5 22H24.5Z"
        fill={`url(#${id}-c)`}
        stroke="#FFF8CC"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="34" cy="8.8" r="1.7" fill="#FFF7C2" />
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
