import React, { useId } from 'react';

interface ProgressStarsProps {
  earned: number;
  total?: number;
  size?: number;
}

export const ProgressStars: React.FC<ProgressStarsProps> = ({
  earned,
  total = 3,
  size = 19,
}) => {
  const id = useId();
  return (
    <div className="ens-progress-stars" aria-label={`${earned} of ${total} stars`}>
      {Array.from({ length: total }).map((_, idx) => {
        const filled = idx < earned;
        return (
          <svg
            key={idx}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className={filled ? 'ens-star is-filled' : 'ens-star is-empty'}
          >
            <defs>
              <linearGradient id={`${id}-st-${idx}`} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFF59D" />
                <stop offset="50%" stopColor="#FFD338" />
                <stop offset="100%" stopColor="#F59B14" />
              </linearGradient>
            </defs>
            <path
              d="M12 2.4L14.7 8.1L21 8.9C21.6 9 21.9 9.7 21.4 10.2L16.8 14.5L18 20.8C18.1 21.4 17.4 21.9 16.9 21.6L12 18.9L7.1 21.6C6.6 21.9 5.9 21.4 6 20.8L7.2 14.5L2.6 10.2C2.1 9.7 2.4 9 3 8.9L9.3 8.1L12 2.4Z"
              fill={filled ? `url(#${id}-st-${idx})` : 'rgba(130, 146, 212, 0.35)'}
              stroke={filled ? '#FFF7BF' : 'rgba(182, 194, 248, 0.3)'}
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
    </div>
  );
};
