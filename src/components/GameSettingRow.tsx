import React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

export type SettingRowControl =
  | {
      type: 'stepper';
      valueLabel: string;
      canDecrement: boolean;
      canIncrement: boolean;
      onDecrement: () => void;
      onIncrement: () => void;
    }
  | {
      type: 'select';
      value: string;
      options: Array<{ value: string; label: string }>;
      onChange: (value: string) => void;
    }
  | {
      type: 'toggle';
      checked: boolean;
      onChange: (checked: boolean) => void;
    };

interface GameSettingRowProps {
  icon: React.ReactNode;
  label: string;
  control: SettingRowControl;
}

/**
 * Stacked glossy dark-indigo setting row matching the Create Room reference.
 */
export const GameSettingRow: React.FC<GameSettingRowProps> = ({
  icon,
  label,
  control,
}) => (
  <div className="ens-setting-row">
    <div className="ens-setting-left">
      <span className="ens-setting-icon">{icon}</span>
      <span className="ens-setting-label">{label}</span>
    </div>

    <div className="ens-setting-right">
      {control.type === 'stepper' && (
        <div className="ens-stepper-pill">
          <button
            type="button"
            className="ens-stepper-arrow"
            onClick={control.onDecrement}
            disabled={!control.canDecrement}
            aria-label={`Decrease ${label}`}
          >
            <ChevronLeft size={16} strokeWidth={2.7} />
          </button>
          <span className="ens-stepper-val">{control.valueLabel}</span>
          <button
            type="button"
            className="ens-stepper-arrow"
            onClick={control.onIncrement}
            disabled={!control.canIncrement}
            aria-label={`Increase ${label}`}
          >
            <ChevronRight size={16} strokeWidth={2.7} />
          </button>
        </div>
      )}

      {control.type === 'select' && (
        <div className="ens-select-pill-wrap">
          <select
            aria-label={label}
            value={control.value}
            onChange={(e) => control.onChange(e.target.value)}
            className="ens-select-pill"
          >
            {control.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown size={15} strokeWidth={2.6} className="ens-select-chevron" aria-hidden="true" />
        </div>
      )}

      {control.type === 'toggle' && (
        <button
          type="button"
          role="switch"
          aria-checked={control.checked}
          aria-label={label}
          className={`ens-glossy-switch ${control.checked ? 'is-on' : 'is-off'}`}
          onClick={() => control.onChange(!control.checked)}
        >
          <span className="ens-switch-thumb" />
        </button>
      )}
    </div>
  </div>
);
