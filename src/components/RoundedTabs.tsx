import React from 'react';

export interface RoundedTabOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  dot?: boolean;
}

interface RoundedTabsProps<T extends string> {
  options: Array<RoundedTabOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}

export function RoundedTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = 'Section tabs',
}: RoundedTabsProps<T>) {
  return (
    <div
      className="ens-rounded-tabs"
      role="tablist"
      aria-label={ariaLabel}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`ens-rounded-tab ${active ? 'is-active' : ''}`}
            onClick={() => onChange(opt.id)}
          >
            {opt.icon && <span className="ens-rounded-tab-icon">{opt.icon}</span>}
            <span className="ens-rounded-tab-label">{opt.label}</span>
            {opt.dot && <span className="ens-rounded-tab-dot" aria-label="New items" />}
          </button>
        );
      })}
    </div>
  );
}
