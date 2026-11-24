import React, { useEffect, useRef } from 'react';

interface GameEntryAnimationProps {
  gameId: 'chain_clash' | 'gridit' | 'guessit' | 'twistit';
  onComplete: () => void;
}

const GRIDIT_TILES = [
  { letter: 'G', bg: 'linear-gradient(180deg, #fef9c3 0%, #fde047 100%)', ink: '#422006', delay: '0.08s' },
  { letter: 'R', bg: 'linear-gradient(180deg, #e0f2fe 0%, #7dd3fc 100%)', ink: '#0c4a6e', delay: '0.18s' },
  { letter: 'I', bg: 'linear-gradient(180deg, #fce7f3 0%, #f472b6 100%)', ink: '#500724', delay: '0.28s' },
  { letter: 'D', bg: 'linear-gradient(180deg, #ede9fe 0%, #c084fc 100%)', ink: '#3b0764', delay: '0.38s' },
  { letter: 'I', bg: 'linear-gradient(180deg, #d1fae5 0%, #34d399 100%)', ink: '#064e3b', delay: '0.48s' },
  { letter: 'T', bg: 'linear-gradient(180deg, #fef08a 0%, #f59e0b 100%)', ink: '#451a03', delay: '0.58s' },
];

export const GameEntryAnimation: React.FC<GameEntryAnimationProps> = ({
  gameId,
  onComplete,
}) => {
  const doneRef = useRef(onComplete);
  doneRef.current = onComplete;

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const durationMs = prefersReduced ? 300 : 620;
    const timer = window.setTimeout(() => {
      doneRef.current();
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [gameId]);

  const isGridIt = gameId === 'gridit';
  const isGuessIt = gameId === 'guessit';
  const isTwistIt = gameId === 'twistit';

  return (
    <div
      className={`ens-intro-overlay ${isGridIt || isGuessIt || isTwistIt ? 'is-gridit' : 'is-chainit'}`}
      role="status"
      aria-live="polite"
      aria-label={
        isGridIt
          ? 'Entering GridIt'
          : isGuessIt
            ? 'Entering GuessIt'
            : isTwistIt
              ? 'Entering TwistIt'
              : 'Entering ChainIt'
      }
    >
      <div className="ens-sky-sparkles" aria-hidden="true" />
      <div className="ens-intro-ambient-ring" aria-hidden="true" />

      <div className="ens-intro-stage">
        {isTwistIt ? (
          <>
            <img
              src="/art/hub-hero-mascot.png"
              alt=""
              style={{ width: 120, height: 120, objectFit: 'contain' }}
            />
            <div className="ens-intro-wordmark-wrap">
              <div className="ens-intro-gridit-logo">TwistIt</div>
              <div className="ens-intro-tagline">Twist six letters into words!</div>
            </div>
          </>
        ) : isGuessIt ? (
          <>
            <img
              src="/art/hero-mascot.png"
              alt=""
              style={{ width: 120, height: 120, objectFit: 'contain' }}
            />
            <div className="ens-intro-wordmark-wrap">
              <div className="ens-intro-gridit-logo">GuessIt</div>
              <div className="ens-intro-tagline">Decode phrases, crosswords &amp; relays!</div>
            </div>
          </>
        ) : isGridIt ? (
          <>
            {/* Floating Shape Silhouettes */}
            <div className="ens-intro-shapes-row" aria-hidden="true">
              <span className="ens-intro-shape s1">■</span>
              <span className="ens-intro-shape s2">♥</span>
              <span className="ens-intro-shape s3">★</span>
              <span className="ens-intro-shape s4">⬡</span>
            </div>

            {/* Connecting SVG Trace Beam + Tiles */}
            <div className="ens-intro-gridit-cluster">
              <svg
                className="ens-intro-gridit-trace"
                viewBox="0 0 300 84"
                fill="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="griditEntryPathGrad" x1="0" y1="42" x2="300" y2="42" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="50%" stopColor="#f472b6" />
                    <stop offset="100%" stopColor="#fde047" />
                  </linearGradient>
                </defs>
                <path
                  d="M28 42 Q80 18 126 42 T224 42 T274 42"
                  stroke="url(#griditEntryPathGrad)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  className="ens-intro-trace-line"
                />
              </svg>

              <div className="ens-intro-gridit-tiles">
                {GRIDIT_TILES.map((t, i) => (
                  <div
                    key={i}
                    className="ens-intro-gridit-tile"
                    style={{
                      background: t.bg,
                      color: t.ink,
                      animationDelay: t.delay,
                    }}
                  >
                    {t.letter}
                  </div>
                ))}
              </div>
            </div>

            <div className="ens-intro-wordmark-wrap">
              <div className="ens-intro-gridit-logo">GridIt</div>
              <div className="ens-intro-tagline">Shape words. Build boards. Battle smarter.</div>
            </div>
          </>
        ) : (
          <>
            {/* ChainIt Linking Word Blocks */}
            <div className="ens-intro-chain-cluster">
              <div className="ens-intro-chain-block is-left">
                <span>CHAIN</span>
              </div>

              <svg
                className="ens-intro-chain-connector"
                width="64"
                height="44"
                viewBox="0 0 64 44"
                fill="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="chainitEntryGrad" x1="0" y1="22" x2="64" y2="22" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="50%" stopColor="#ffd54a" />
                    <stop offset="100%" stopColor="#f472b6" />
                  </linearGradient>
                </defs>
                <rect
                  x="6"
                  y="13"
                  width="28"
                  height="18"
                  rx="9"
                  stroke="url(#chainitEntryGrad)"
                  strokeWidth="4.5"
                  className="ens-intro-link-ring"
                />
                <rect
                  x="30"
                  y="13"
                  width="28"
                  height="18"
                  rx="9"
                  stroke="url(#chainitEntryGrad)"
                  strokeWidth="4.5"
                  className="ens-intro-link-ring is-second"
                />
              </svg>

              <div className="ens-intro-chain-block is-right">
                <span>IT</span>
              </div>
            </div>

            <div className="ens-intro-wordmark-wrap">
              <div className="ens-intro-chainit-logo">
                <span className="is-chain">Chain</span>
                <span className="is-it">It</span>
              </div>
              <div className="ens-intro-tagline">Link words. Outpace rivals.</div>
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        className="ens-intro-skip-btn"
        onClick={onComplete}
      >
        Skip
      </button>
    </div>
  );
};
