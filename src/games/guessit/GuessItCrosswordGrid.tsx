import React, { useMemo } from 'react';
import { GuessItCrosswordCellView, GuessItCrosswordView } from '../../../shared/guessit/types';

interface GuessItCrosswordGridProps {
  puzzle: GuessItCrosswordView;
  justRevealedLetter?: string | null;
}

export const GuessItCrosswordGrid: React.FC<GuessItCrosswordGridProps> = ({
  puzzle,
  justRevealedLetter,
}) => {
  const slots = useMemo(() => {
    const map = new Map<string, GuessItCrosswordCellView>();
    for (const c of puzzle.cells) {
      map.set(`${c.row},${c.col}`, c);
    }
    const items: Array<GuessItCrosswordCellView | null> = [];
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        items.push(map.get(`${r},${c}`) ?? null);
      }
    }
    return items;
  }, [puzzle.cells, puzzle.rows, puzzle.cols]);

  return (
    <div className="ens-guessit-cw-stage">
      <div
        className="ens-guessit-cw-grid"
        style={{ '--cw-cols': puzzle.cols } as React.CSSProperties}
        role="grid"
        aria-label={`Crossword grid ${puzzle.rows} by ${puzzle.cols}`}
      >
        {slots.map((cell, idx) => {
          if (!cell) {
            return <div key={`e_${idx}`} className="ens-guessit-cw-cell is-empty" aria-hidden="true" />;
          }
          if (cell.kind === 'space') {
            return (
              <div
                key={`s_${cell.row}_${cell.col}`}
                className="ens-guessit-cw-cell is-space"
                aria-label="Word space"
                title="Space separator"
              >
                <span className="ens-guessit-space-dot" />
              </div>
            );
          }
          if (cell.kind === 'punct') {
            return (
              <div
                key={`p_${cell.row}_${cell.col}`}
                className="ens-guessit-cw-cell is-punct"
              >
                {cell.char}
              </div>
            );
          }

          const isJust = Boolean(
            justRevealedLetter && cell.revealed && cell.char === justRevealedLetter
          );

          return (
            <div
              key={`l_${cell.row}_${cell.col}`}
              className={`ens-guessit-cw-cell is-letter ${
                cell.revealed ? 'is-revealed' : ''
              } ${cell.isIntersection ? 'is-intersection' : ''} ${
                isJust ? 'is-just-revealed' : ''
              }`}
            >
              {cell.revealed ? cell.char : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
};
