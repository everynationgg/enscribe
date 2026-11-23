import React, { useEffect } from 'react';

const KEYBOARD_ROWS = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S'],
  ['T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
];

interface GuessItKeyboardProps {
  correctLetters: string[];
  wrongLetters: string[];
  disabled: boolean;
  onPressLetter: (letter: string) => void;
}

export const GuessItKeyboard: React.FC<GuessItKeyboardProps> = ({
  correctLetters,
  wrongLetters,
  disabled,
  onPressLetter,
}) => {
  const correctSet = new Set(correctLetters);
  const wrongSet = new Set(wrongLetters);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (disabled || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const ch = e.key.toUpperCase();
      if (ch.length === 1 && ch >= 'A' && ch <= 'Z') {
        if (!correctSet.has(ch) && !wrongSet.has(ch)) {
          e.preventDefault();
          onPressLetter(ch);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, correctLetters, wrongLetters, onPressLetter]);

  return (
    <div className="ens-guessit-keyboard" role="group" aria-label="Letter Keyboard">
      {KEYBOARD_ROWS.map((row, rIdx) => (
        <div key={rIdx} className="ens-guessit-kb-row">
          {row.map((letter) => {
            const isCorrect = correctSet.has(letter);
            const isWrong = wrongSet.has(letter);
            const isUsed = isCorrect || isWrong;
            const isBtnDisabled = disabled || isUsed;

            return (
              <button
                key={letter}
                type="button"
                disabled={isBtnDisabled}
                aria-label={`Guess letter ${letter}`}
                className={`ens-guessit-key ${isCorrect ? 'is-correct' : ''} ${
                  isWrong ? 'is-wrong' : ''
                } ${disabled && !isUsed ? 'is-locked-dim' : ''}`}
                onClick={() => onPressLetter(letter)}
              >
                {letter}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};
