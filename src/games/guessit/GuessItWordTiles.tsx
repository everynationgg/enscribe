import React, { useMemo } from 'react';
import { GuessItClassicToken, GuessItClassicView } from '../../../shared/guessit/types';

interface GuessItWordTilesProps {
  puzzle: GuessItClassicView;
  justRevealedLetter?: string | null;
}

export const GuessItWordTiles: React.FC<GuessItWordTilesProps> = ({
  puzzle,
  justRevealedLetter,
}) => {
  // Split token sequence into discrete word groups separated by visible space separators
  const wordGroups = useMemo(() => {
    const groups: Array<{ kind: 'word' | 'space'; tokens: GuessItClassicToken[] }> = [];
    let current: GuessItClassicToken[] = [];

    for (const tok of puzzle.tokens) {
      if (tok.kind === 'space') {
        if (current.length > 0) {
          groups.push({ kind: 'word', tokens: current });
          current = [];
        }
        groups.push({ kind: 'space', tokens: [tok] });
      } else {
        current.push(tok);
      }
    }
    if (current.length > 0) {
      groups.push({ kind: 'word', tokens: current });
    }
    return groups;
  }, [puzzle.tokens]);

  const longestWordLen = useMemo(
    () =>
      wordGroups.reduce(
        (mx, g) => (g.kind === 'word' ? Math.max(mx, g.tokens.length) : mx),
        1
      ),
    [wordGroups]
  );

  // Dynamically size tiles cleanly inside 393px iPhone 15 portrait width
  const tileSizePx = useMemo(() => {
    if (longestWordLen >= 12) return 24;
    if (longestWordLen >= 10) return 27;
    if (longestWordLen >= 8) return 30;
    return 33;
  }, [longestWordLen]);

  return (
    <div
      className="ens-guessit-tiles-rack"
      style={{ '--tile-size': `${tileSizePx}px` } as React.CSSProperties}
      aria-label="Hidden word tiles"
    >
      {wordGroups.map((group, gIdx) => {
        if (group.kind === 'space') {
          return (
            <span
              key={`sp_${gIdx}`}
              className="ens-guessit-space-gap"
              aria-label="Word space separator"
            >
              <span className="ens-guessit-space-dot" />
            </span>
          );
        }

        return (
          <div key={`wd_${gIdx}`} className="ens-guessit-word-group">
            {group.tokens.map((tok) => {
              if (tok.kind === 'punct') {
                return (
                  <span key={tok.index} className="ens-guessit-letter-tile is-punct">
                    {tok.char}
                  </span>
                );
              }
              const isJust = Boolean(
                justRevealedLetter && tok.revealed && tok.char === justRevealedLetter
              );
              return (
                <span
                  key={tok.index}
                  className={`ens-guessit-letter-tile ${!tok.revealed ? 'is-blank' : ''} ${
                    isJust ? 'is-just-revealed' : ''
                  }`}
                >
                  {tok.revealed ? tok.char : '_'}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
