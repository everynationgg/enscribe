import React from 'react';
import { Crown, Flame, Grid, Sparkles, Zap } from 'lucide-react';
import { GridItModConfig, MAX_GRIDIT_MULTIPLIER } from '../../shared/gridit/mods';

interface GridItModTogglesProps {
  mods: GridItModConfig;
  onChange: (next: GridItModConfig) => void;
  disabled?: boolean;
}

interface ModDescriptor {
  key: keyof Pick<
    GridItModConfig,
    'rainbowWildcard' | 'goldenLetter' | 'lightningRound' | 'comboFever' | 'growingGrid'
  >;
  title: string;
  description: string;
  accentClass: string;
  icon: React.ReactNode;
}

const MOD_LIST: ModDescriptor[] = [
  {
    key: 'rainbowWildcard',
    title: 'Rainbow Wildcard',
    description: 'A glowing wildcard (~5s) that can represent any letter A–Z',
    accentClass: 'is-rainbow',
    icon: <Sparkles size={16} color="#ffffff" />,
  },
  {
    key: 'goldenLetter',
    title: 'Golden Letter',
    description: 'High-value golden die worth 2× word points while active',
    accentClass: 'is-golden',
    icon: <Crown size={16} color="#fffbeb" fill="#fde047" />,
  },
  {
    key: 'lightningRound',
    title: 'Lightning Round',
    description: 'Electrifying 10s surge granting 3× global word points',
    accentClass: 'is-lightning',
    icon: <Zap size={16} color="#f5f3ff" fill="#e9d5ff" />,
  },
  {
    key: 'comboFever',
    title: 'Combo Fever',
    description: 'Chain words rapidly for escalating streak multipliers',
    accentClass: 'is-combo',
    icon: <Flame size={16} color="#fff7ed" fill="#fed7aa" />,
  },
  {
    key: 'growingGrid',
    title: 'Growing Grid',
    description: 'Board expands outward with new shape-matched rings mid-match',
    accentClass: 'is-growing',
    icon: <Grid size={16} color="#e0f2fe" />,
  },
];

export const GridItModToggles: React.FC<GridItModTogglesProps> = ({
  mods,
  onChange,
  disabled = false,
}) => {
  const toggleMod = (key: ModDescriptor['key']) => {
    if (disabled) return;
    onChange({
      ...mods,
      [key]: !mods[key],
      maxMultiplierCap: MAX_GRIDIT_MULTIPLIER,
    });
  };

  return (
    <div className="ens-gridit-mods-box">
      {MOD_LIST.map((mod) => {
        const enabled = Boolean(mods[mod.key]);
        return (
          <div key={mod.key} className="ens-gridit-mod-row">
            <div className={`ens-gridit-mod-icon ${mod.accentClass}`}>{mod.icon}</div>
            <div className="ens-gridit-mod-copy">
              <div className="ens-gridit-mod-name">{mod.title}</div>
              <div className="ens-gridit-mod-desc">{mod.description}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={`Toggle ${mod.title}`}
              disabled={disabled}
              className={`ens-gridit-switch ${enabled ? 'is-on' : ''}`}
              onClick={() => toggleMod(mod.key)}
            >
              <span className="ens-gridit-switch-thumb" />
            </button>
          </div>
        );
      })}

      <div className="ens-gridit-cap-banner">
        <Crown size={14} color="#fde047" fill="#fde047" />
        <span>
          Multiplier Cap: <strong>{MAX_GRIDIT_MULTIPLIER}× (max)</strong>
        </span>
      </div>
    </div>
  );
};
