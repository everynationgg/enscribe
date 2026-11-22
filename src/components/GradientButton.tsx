import React from 'react';

export type GradientButtonVariant = 'lavender' | 'purple' | 'radiant';
export type GradientButtonSize = 'sm' | 'md' | 'lg';

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GradientButtonVariant;
  size?: GradientButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
}

/**
 * Glossy pill/capsule CTA button with luminous rim and tactile press depth.
 */
export const GradientButton: React.FC<GradientButtonProps> = ({
  variant = 'lavender',
  size = 'md',
  leftIcon,
  rightIcon,
  fullWidth = false,
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={`ens-grad-btn is-${variant} is-${size} ${fullWidth ? 'is-full' : ''} ${className}`.trim()}
    {...rest}
  >
    {leftIcon && <span className="ens-grad-btn-icon">{leftIcon}</span>}
    <span className="ens-grad-btn-text">{children}</span>
    {rightIcon && <span className="ens-grad-btn-icon">{rightIcon}</span>}
  </button>
);
