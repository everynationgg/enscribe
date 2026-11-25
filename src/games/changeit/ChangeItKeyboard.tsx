import React from 'react';
import { CornerDownLeft, Delete } from 'lucide-react';

interface ChangeItKeyboardProps {
  disabled?: boolean;
  forbiddenLetters?: string[];
  canSubmit?: boolean;
  onLetter: (letter: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
}

const KEY_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
];

export const ChangeItKeyboard: React.FC<ChangeItKeyboardProps> = ({
  disabled = false,
  forbiddenLetters = [],
  canSubmit = false,
  onLetter,
  onBackspace,
  onSubmit,
}) => {
  const forbiddenSet = new Set(forbiddenLetters.map((c) => c.toUpperCase()));

  return (
    <div className="ci-keyboard" role="group" aria-label="ChangeIt letter keyboard">
      {KEY_ROWS.map((row, rIdx) => (
        <div key={rIdx} className="ci-key-row">
          {row.map((key) => {
            if (key === 'ENTER') {
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled || !canSubmit}
                  className={`ci-key is-action is-submit ${canSubmit && !disabled ? 'is-ready' : ''}`}
                  onClick={onSubmit}
                  aria-label="Submit transformation"
                >
                  <CornerDownLeft size={16} strokeWidth={2.8} />
                  <span>GO</span>
                </button>
              );
            }
            if (key === 'BACK') {
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  className="ci-key is-action"
                  onClick={onBackspace}
                  aria-label="Clear selected letter"
                >
                  <Delete size={17} strokeWidth={2.5} />
                </button>
              );
            }

            const isForbidden = forbiddenSet.has(key);
            return (
              <button
                key={key}
                type="button"
                disabled={disabled || isForbidden}
                className={`ci-key ${isForbidden ? 'is-forbidden' : ''}`}
                onClick={() => onLetter(key)}
                aria-label={isForbidden ? `${key} forbidden` : `Letter ${key}`}
              >
                {key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};
