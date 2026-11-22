import React from 'react';

export type GlossyCardVariant = 'hero' | 'season' | 'chapter' | 'glass' | 'row';

interface GlossyGameCardProps {
  variant?: GlossyCardVariant;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Rounded, luminous-bordered fantasy card container matching the locked visual spec.
 */
export const GlossyGameCard: React.FC<GlossyGameCardProps> = ({
  variant = 'glass',
  selected = false,
  onClick,
  className = '',
  children,
  style,
}) => {
  const interactiveProps = onClick
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick,
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};

  return (
    <div
      className={`ens-glossy-card is-${variant} ${selected ? 'is-selected' : ''} ${onClick ? 'is-clickable' : ''} ${className}`.trim()}
      style={style}
      {...interactiveProps}
    >
      {children}
    </div>
  );
};
