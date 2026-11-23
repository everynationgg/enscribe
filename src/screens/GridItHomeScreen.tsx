import React, { useId } from 'react';
import { ArrowLeft, Play, Sparkles } from 'lucide-react';
import { PlayerSession } from '../../shared/types';
import { AvatarBadge } from '../components/Artwork';
import { PodiumCrownIcon, TrophyLaurelIcon } from '../components/GameIcons';

interface GridItHomeScreenProps {
  session: PlayerSession;
  onExitToHub: () => void;
  onOpenSolo: () => void;
  onOpenRanked: () => void;
  onOpenMultiplayer: () => void;
  onOpenLeaderboard: () => void;
  onOpenBoardBattle: () => void;
  onOpenEditor: () => void;
}

const StarburstFlankSvg: React.FC<{ flip?: boolean }> = ({ flip }) => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 28 28"
    fill="none"
    style={{ transform: flip ? 'scaleX(-1)' : undefined }}
    aria-hidden="true"
  >
    <path
      d="M14 2L16.4 10.6L25 13L16.4 15.4L14 24L11.6 15.4L3 13L11.6 10.6L14 2Z"
      fill="#FEF08A"
    />
    <circle cx="22.5" cy="5.5" r="2" fill="#FFFFFF" fillOpacity="0.9" />
    <circle cx="5.5" cy="21.5" r="1.5" fill="#7DD3FC" />
  </svg>
);

const ShapeSquareSvg: React.FC = () => {
  const id = useId();
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="50%" stopColor="#4f6ef7" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>
      </defs>
      <rect x="6" y="8" width="52" height="52" rx="14" fill="#1e1b4b" fillOpacity="0.55" />
      <rect x="6" y="4" width="52" height="52" rx="14" fill={`url(#${id}-bg)`} stroke="#e0e7ff" strokeWidth="2.5" />
      <path d="M10 10C18 6 46 6 54 10V18C42 15 22 15 10 18V10Z" fill="#ffffff" fillOpacity="0.22" />
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <rect
            key={`${r}-${c}`}
            x={12 + c * 10.5}
            y={10 + r * 10.5}
            width="8.4"
            height="8.4"
            rx="2.3"
            fill="#f5f3ff"
            fillOpacity={r === 0 ? '0.96' : '0.88'}
            stroke="#c7d2fe"
            strokeWidth="0.6"
          />
        ))
      )}
    </svg>
  );
};

const ShapeHeartSvg: React.FC = () => {
  const id = useId();
  return (
    <svg width="66" height="64" viewBox="0 0 66 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-h`} x1="10" y1="6" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fdf2f8" />
          <stop offset="28%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#be185d" />
        </linearGradient>
      </defs>
      <path
        d="M33 58 C33 58 8 43.5 8 25.5 C8 17 14.6 10.5 22.2 10.5 C27 10.5 30.8 12.9 33 16.6 C35.2 12.9 39 10.5 43.8 10.5 C51.4 10.5 58 17 58 25.5 C58 43.5 33 58 33 58 Z"
        fill="#831843"
        fillOpacity="0.55"
      />
      <path
        d="M33 54 C33 54 8 39.5 8 21.5 C8 13 14.6 6.5 22.2 6.5 C27 6.5 30.8 8.9 33 12.6 C35.2 8.9 39 6.5 43.8 6.5 C51.4 6.5 58 13 58 21.5 C58 39.5 33 54 33 54 Z"
        fill={`url(#${id}-h)`}
        stroke="#ffe4f2"
        strokeWidth="2.5"
      />
      {[
        [17, 17], [25, 17], [41, 17], [49, 17],
        [17, 25], [25, 25], [33, 25], [41, 25], [49, 25],
        [21, 33], [29, 33], [37, 33], [45, 33],
        [29, 41], [37, 41],
      ].map(([x, y], i) => (
        <rect
          key={i}
          x={x - 3.2}
          y={y - 3.2}
          width="6.4"
          height="6.4"
          rx="1.8"
          fill="#fff1f7"
          fillOpacity="0.94"
        />
      ))}
    </svg>
  );
};

const ShapeStarSvg: React.FC = () => {
  const id = useId();
  return (
    <svg width="66" height="64" viewBox="0 0 66 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-s`} x1="10" y1="4" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="45%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <path
        d="M33 9 L40.6 24.6 L57.8 27.1 L45.3 39.2 L48.3 56.4 L33 48.2 L17.7 56.4 L20.7 39.2 L8.2 27.1 L25.4 24.6 Z"
        fill="#92400e"
        fillOpacity="0.52"
      />
      <path
        d="M33 5 L40.6 20.6 L57.8 23.1 L45.3 35.2 L48.3 52.4 L33 44.2 L17.7 52.4 L20.7 35.2 L8.2 23.1 L25.4 20.6 Z"
        fill={`url(#${id}-s)`}
        stroke="#fffbeb"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {[
        [33, 19],
        [25, 27], [33, 27], [41, 27],
        [27, 35], [33, 35], [39, 35],
      ].map(([x, y], i) => (
        <rect
          key={i}
          x={x - 3}
          y={y - 3}
          width="6"
          height="6"
          rx="1.6"
          fill="#fffbeb"
          fillOpacity="0.94"
        />
      ))}
    </svg>
  );
};

const ShapeHexSvg: React.FC = () => {
  const id = useId();
  return (
    <svg width="62" height="64" viewBox="0 0 62 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-x`} x1="8" y1="4" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#cffafe" />
          <stop offset="48%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>
      <path
        d="M31 9 L53 21.5 L53 46.5 L31 59 L9 46.5 L9 21.5 Z"
        fill="#0c4a6e"
        fillOpacity="0.52"
      />
      <path
        d="M31 5 L53 17.5 L53 42.5 L31 55 L9 42.5 L9 17.5 Z"
        fill={`url(#${id}-x)`}
        stroke="#ecfeff"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {[
        [25, 18], [37, 18],
        [19, 29], [31, 29], [43, 29],
        [25, 40], [37, 40],
      ].map(([x, y], i) => (
        <polygon
          key={i}
          points={`${x},${y - 4.8} ${x + 4.3},${y - 2.4} ${x + 4.3},${y + 2.4} ${x},${y + 4.8} ${x - 4.3},${y + 2.4} ${x - 4.3},${y - 2.4}`}
          fill="#ecfeff"
          fillOpacity="0.95"
        />
      ))}
    </svg>
  );
};

/* Rich Dimensional 3D Casual-Game Mode Illustrations */
const SoloDimensionalIcon: React.FC = () => {
  const id = useId();
  return (
    <svg width="56" height="48" viewBox="0 0 64 54" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-body`} x1="16" y1="8" x2="48" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="65%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="44" rx="22" ry="6" fill="#0369a1" fillOpacity="0.35" stroke="#bae6fd" strokeWidth="1.4" />
      <circle cx="32" cy="17" r="9.5" fill={`url(#${id}-body)`} stroke="#ffffff" strokeWidth="2" />
      <path
        d="M15 41C15 32.5 22.6 27 32 27C41.4 27 49 32.5 49 41C49 43 47.4 44.5 45.4 44.5H18.6C16.6 44.5 15 43 15 41Z"
        fill={`url(#${id}-body)`}
        stroke="#ffffff"
        strokeWidth="2"
      />
      <path d="M51 9L52.8 14L58 15.8L52.8 17.6L51 22.6L49.2 17.6L44 15.8L49.2 14L51 9Z" fill="#fef08a" stroke="#fffbeb" strokeWidth="0.9" />
    </svg>
  );
};

const MultiplayerGroupIcon: React.FC = () => {
  const id = useId();
  return (
    <svg width="62" height="48" viewBox="0 0 70 54" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-side`} x1="10" y1="12" x2="30" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ede9fe" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id={`${id}-main`} x1="20" y1="8" x2="50" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#ddd6fe" />
        </linearGradient>
      </defs>
      <circle cx="17" cy="21" r="6.2" fill={`url(#${id}-side)`} stroke="#f5f3ff" strokeWidth="1.6" />
      <path d="M6 42C6 35.8 10.9 31.8 17 31.8C20.5 31.8 23.6 33.2 25.5 35.5V43.5H8C6.9 43.5 6 42.8 6 42Z" fill={`url(#${id}-side)`} stroke="#f5f3ff" strokeWidth="1.5" />
      <circle cx="53" cy="21" r="6.2" fill={`url(#${id}-side)`} stroke="#f5f3ff" strokeWidth="1.6" />
      <path d="M44.5 35.5C46.4 33.2 49.5 31.8 53 31.8C59.1 31.8 64 35.8 64 42C64 42.8 63.1 43.5 62 43.5H44.5V35.5Z" fill={`url(#${id}-side)`} stroke="#f5f3ff" strokeWidth="1.5" />
      <circle cx="35" cy="17" r="8.2" fill={`url(#${id}-main)`} stroke="#ffffff" strokeWidth="2" />
      <path d="M21 44.5C21 36.2 27.3 31 35 31C42.7 31 49 36.2 49 44.5C49 46.2 47.6 47.5 46 47.5H24C22.4 47.5 21 46.2 21 44.5Z" fill={`url(#${id}-main)`} stroke="#ffffff" strokeWidth="2" />
      <circle cx="35" cy="5.5" r="2.6" fill="#7dd3fc" />
    </svg>
  );
};

const BattleClashIcon: React.FC = () => {
  const id = useId();
  return (
    <svg width="62" height="48" viewBox="0 0 68 54" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-blade`} x1="12" y1="6" x2="56" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#e0e7ff" />
          <stop offset="100%" stopColor="#a5b4fc" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="14" y1="30" x2="54" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      {/* Left Sword */}
      <path d="M16 42L48 10L53 6L50 13L20 43L16 42Z" fill={`url(#${id}-blade)`} stroke="#ffffff" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 34L22 44" stroke={`url(#${id}-gold)`} strokeWidth="4.2" strokeLinecap="round" />
      <circle cx="12" cy="45" r="3" fill="#fde047" />
      {/* Right Sword */}
      <path d="M52 42L20 10L15 6L18 13L48 43L52 42Z" fill={`url(#${id}-blade)`} stroke="#ffffff" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M56 34L46 44" stroke={`url(#${id}-gold)`} strokeWidth="4.2" strokeLinecap="round" />
      <circle cx="56" cy="45" r="3" fill="#fde047" />
      {/* Center Clash Burst */}
      <path d="M34 15L36.8 22.2L44 25L36.8 27.8L34 35L31.2 27.8L24 25L31.2 22.2L34 15Z" fill="#fde047" stroke="#fffbeb" strokeWidth="1.2" />
    </svg>
  );
};

const EditorMagicPencilIcon: React.FC = () => {
  const id = useId();
  return (
    <svg width="60" height="48" viewBox="0 0 66 54" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-pen`} x1="18" y1="8" x2="50" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="58%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {/* Decorative mini grid tile behind pencil */}
      <rect x="8" y="20" width="16" height="16" rx="4.5" transform="rotate(-12 8 20)" fill="#e0f2fe" fillOpacity="0.35" stroke="#ffffff" strokeWidth="1.4" />
      <rect x="44" y="28" width="14" height="14" rx="4" transform="rotate(14 44 28)" fill="#fde047" fillOpacity="0.35" stroke="#fef08a" strokeWidth="1.4" />
      {/* Pencil body */}
      <path d="M40 7L51 18L26 43L13 46L16 33L40 7Z" fill={`url(#${id}-pen)`} stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
      <path d="M36 11L47 22" stroke="#f59e0b" strokeWidth="3.8" strokeLinecap="round" />
      <path d="M13 46L21 44.2L14.8 38L13 46Z" fill="#fde047" stroke="#fffbeb" strokeWidth="1" />
      <path d="M54 8L55.6 12L59.5 13.6L55.6 15.2L54 19.2L52.4 15.2L48.5 13.6L52.4 12L54 8Z" fill="#fef08a" />
    </svg>
  );
};

export const GridItHomeScreen: React.FC<GridItHomeScreenProps> = ({
  session,
  onExitToHub,
  onOpenSolo,
  onOpenRanked,
  onOpenMultiplayer,
  onOpenLeaderboard,
  onOpenBoardBattle,
  onOpenEditor,
}) => {

  return (
    <div className="ens-fantasy-page ens-gridit-page">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      {/* Decorative Translucent 3D Floating Letter Tiles */}
      <div className="ens-gridit-deco-tile is-left" aria-hidden="true">W</div>
      <div className="ens-gridit-deco-tile is-right" aria-hidden="true">A</div>
      <div className="ens-gridit-deco-tile is-mid-left" aria-hidden="true">G</div>
      <div className="ens-gridit-deco-tile is-mid-right" aria-hidden="true">R</div>

      <div className="ens-scroll-body ens-gridit-scroll">
        <div className="ens-gridit-wrap">
          {/* Top Bar with Mandatory Exit to Game Hub */}
          <header className="ens-gridit-topbar">
            <button
              type="button"
              className="ens-exit-hub-btn"
              onClick={onExitToHub}
            >
              <ArrowLeft size={15} strokeWidth={2.8} />
              <span>Exit to Hub</span>
            </button>

            <div className="ens-gridit-mini-brand" aria-label="Enscribe">
              <div className="ens-gridit-brand-row">
                <Sparkles size={14} color="#FFD54A" />
                <span>Enscribe</span>
              </div>
              <svg className="ens-gridit-brand-swoosh" viewBox="0 0 92 8" fill="none" aria-hidden="true">
                <path d="M4 5.5C28 8 62 7.5 88 2" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </div>

            <div className="ens-gridit-guest-pill" title={`Playing as ${session.nickname}`}>
              <AvatarBadge avatarId={session.avatarId} size={26} ringColor="#7dd3fc" />
              <span className="ens-gridit-guest-name">{session.nickname}</span>
            </div>
          </header>

          {/* Main Illustrated GridIt Hero Card (Screen 1 of Approved GridIt Mockup) */}
          <section className="ens-gridit-hero-card">
            <img
              src="/art/gridit-home-hero-bg.png"
              alt=""
              className="ens-gridit-hero-bg-img"
              aria-hidden="true"
            />
            <div className="ens-gridit-hero-glaze" aria-hidden="true" />
            <span className="ens-home-mode-sheen" aria-hidden="true" />

            <div className="ens-gridit-title-lockup">
              <StarburstFlankSvg />
              <h1 className="ens-gridit-logo-title">GridIt</h1>
              <StarburstFlankSvg flip />
            </div>
            <p className="ens-gridit-logo-sub">Find words on dynamic boards</p>

            <div className="ens-gridit-shape-strip" aria-label="Supported board shapes preview">
              <div className="ens-gridit-shape-float">
                <ShapeSquareSvg />
              </div>
              <div className="ens-gridit-shape-float">
                <ShapeHeartSvg />
              </div>
              <div className="ens-gridit-shape-float">
                <ShapeStarSvg />
              </div>
              <div className="ens-gridit-shape-float">
                <ShapeHexSvg />
              </div>
            </div>

            <button
              type="button"
              className="ens-gridit-play-btn"
              onClick={onOpenSolo}
            >
              <Play size={22} fill="#ffffff" color="#ffffff" />
              <span>Play</span>
            </button>
          </section>

          {/* 2x3 Rich Illustrated Mode Cards matching Mockup Screen 1 */}
          <section className="ens-gridit-modes-grid" aria-label="GridIt modes">
            <button
              type="button"
              className="ens-gridit-mode-btn is-solo"
              onClick={onOpenSolo}
            >
              <span className="ens-gridit-mode-pattern" aria-hidden="true" />
              <span className="ens-home-mode-sheen" aria-hidden="true" />
              <span className="ens-gridit-mode-icon"><SoloDimensionalIcon /></span>
              <span className="ens-gridit-mode-label">Solo</span>
            </button>

            <button
              type="button"
              className="ens-gridit-mode-btn is-ranked"
              onClick={onOpenRanked}
            >
              <span className="ens-gridit-mode-pattern" aria-hidden="true" />
              <span className="ens-home-mode-sheen" aria-hidden="true" />
              <span className="ens-gridit-mode-icon"><TrophyLaurelIcon size={58} /></span>
              <span className="ens-gridit-mode-label">Ranked</span>
            </button>

            <button
              type="button"
              className="ens-gridit-mode-btn is-multiplayer"
              onClick={onOpenMultiplayer}
            >
              <span className="ens-gridit-mode-pattern" aria-hidden="true" />
              <span className="ens-home-mode-sheen" aria-hidden="true" />
              <span className="ens-gridit-mode-icon"><MultiplayerGroupIcon /></span>
              <span className="ens-gridit-mode-label">Multiplayer</span>
            </button>

            <button
              type="button"
              className="ens-gridit-mode-btn is-leaderboard"
              onClick={onOpenLeaderboard}
            >
              <span className="ens-gridit-mode-pattern" aria-hidden="true" />
              <span className="ens-home-mode-sheen" aria-hidden="true" />
              <span className="ens-gridit-mode-icon"><PodiumCrownIcon size={58} /></span>
              <span className="ens-gridit-mode-label">Leaderboard</span>
            </button>

            <button
              type="button"
              className="ens-gridit-mode-btn is-battle"
              onClick={onOpenBoardBattle}
            >
              <span className="ens-gridit-mode-pattern" aria-hidden="true" />
              <span className="ens-home-mode-sheen" aria-hidden="true" />
              <span className="ens-gridit-mode-icon"><BattleClashIcon /></span>
              <span className="ens-gridit-mode-label">Board Battle</span>
            </button>

            <button
              type="button"
              className="ens-gridit-mode-btn is-editor"
              onClick={onOpenEditor}
            >
              <span className="ens-gridit-mode-pattern" aria-hidden="true" />
              <span className="ens-home-mode-sheen" aria-hidden="true" />
              <span className="ens-gridit-mode-icon"><EditorMagicPencilIcon /></span>
              <span className="ens-gridit-mode-label">Board Editor</span>
            </button>
          </section>

          <div className="ens-gridit-status-banner">
            <Sparkles size={14} color="#fde047" />
            <span>Solo, Board Editor, Multiplayer, Board Battle &amp; Mods live!</span>
          </div>
        </div>
      </div>

      {/* Bottom Enchanted GridIt Crystal Horizon */}
      <div className="ens-gridit-horizon-wrap" aria-hidden="true">
        <img
          src="/art/gridit-home-horizon.png"
          alt=""
          className="ens-gridit-horizon-img"
        />
      </div>
    </div>
  );
};
