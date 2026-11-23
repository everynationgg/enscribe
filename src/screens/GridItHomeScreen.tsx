import React, { useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Crown,
  Grid2x2,
  Pencil,
  Play,
  Sparkles,
  Swords,
  User,
  Users,
} from 'lucide-react';
import { PlayerSession } from '../../shared/types';
import { AvatarBadge } from '../components/Artwork';

interface GridItHomeScreenProps {
  session: PlayerSession;
  onExitToHub: () => void;
}

interface ModePreviewInfo {
  title: string;
  milestone: string;
  description: string;
}

const MODE_PREVIEWS: Record<string, ModePreviewInfo> = {
  play: {
    title: 'GridIt Quick Launch',
    milestone: 'Playable in Milestone 2',
    description:
      'Solo word-finding on Square, Heart, Star, Circle, Hexagon, Rectangle, and Triangle boards with pinch-zoom, drag tracing, and live dictionary definitions arrives in Milestone 2.',
  },
  solo: {
    title: 'GridIt Solo',
    milestone: 'Playable in Milestone 2',
    description:
      'Offline-ready solo word-formation sessions across dynamic shaped boards with dictionary validation and clickable word definitions.',
  },
  ranked: {
    title: 'GridIt Ranked',
    milestone: 'Playable in Milestone 4–5',
    description:
      'Standardized competitive matchmaking using balanced boards and fairness safeguards. Account-backed rankings connect when ENGG auth launches.',
  },
  multiplayer: {
    title: 'GridIt Multiplayer',
    milestone: 'Playable in Milestone 4',
    description:
      'Public and private rooms, join-by-code, host-configurable boards and mods, optional spectators, and live chat/emoji reactions.',
  },
  leaderboard: {
    title: 'GridIt Leaderboard',
    milestone: 'Playable in Milestone 5',
    description:
      'GridIt-specific statistics and rankings (guest sessions remain temporary and do not save permanent leaderboard records).',
  },
  board_battle: {
    title: 'Board Battle',
    milestone: 'Playable in Milestone 4',
    description:
      'Create a custom shaped challenge board for your opponent while solving theirs simultaneously — scored fairly against board potential.',
  },
  board_editor: {
    title: 'Board Editor',
    milestone: 'Playable in Milestone 3',
    description:
      'Pick an approved shape and size, place letters to satisfy word-length quotas, validate with the dictionary, and save templates locally.',
  },
};

const ShapeSquareSvg: React.FC = () => (
  <svg width="46" height="46" viewBox="0 0 46 46" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="40" height="40" rx="10" fill="rgba(99, 102, 241, 0.35)" stroke="#c7d2fe" strokeWidth="2.2" />
    {[0, 1, 2, 3].map((r) =>
      [0, 1, 2, 3].map((c) => (
        <rect
          key={`${r}-${c}`}
          x={8 + c * 8}
          y={8 + r * 8}
          width="6"
          height="6"
          rx="1.6"
          fill="#e0e7ff"
          opacity="0.92"
        />
      ))
    )}
  </svg>
);

const ShapeHeartSvg: React.FC = () => (
  <svg width="48" height="46" viewBox="0 0 48 46" fill="none" aria-hidden="true">
    <path
      d="M24 41 C24 41 5 29.5 5 16.5 C5 10.2 10 5.5 15.8 5.5 C19.5 5.5 22.5 7.4 24 10.2 C25.5 7.4 28.5 5.5 32.2 5.5 C38 5.5 43 10.2 43 16.5 C43 29.5 24 41 24 41 Z"
      fill="rgba(244, 114, 182, 0.42)"
      stroke="#fbcfe8"
      strokeWidth="2.2"
    />
    {[
      [12, 13], [19, 13], [27, 13], [34, 13],
      [12, 20], [19, 20], [27, 20], [34, 20],
      [16, 27], [23, 27], [30, 27],
      [21, 33], [27, 33],
    ].map(([x, y], i) => (
      <rect key={i} x={x - 2.5} y={y - 2.5} width="5" height="5" rx="1.4" fill="#fce7f3" />
    ))}
  </svg>
);

const ShapeStarSvg: React.FC = () => (
  <svg width="48" height="46" viewBox="0 0 48 46" fill="none" aria-hidden="true">
    <path
      d="M24 4 L29.6 15.6 L42.4 17.4 L33 26.4 L35.4 39.2 L24 33 L12.6 39.2 L15 26.4 L5.6 17.4 L18.4 15.6 Z"
      fill="rgba(250, 204, 21, 0.42)"
      stroke="#fef08a"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
    {[
      [24, 15], [18, 21], [24, 21], [30, 21], [21, 27], [27, 27],
    ].map(([x, y], i) => (
      <rect key={i} x={x - 2.5} y={y - 2.5} width="5" height="5" rx="1.4" fill="#fef9c3" />
    ))}
  </svg>
);

const ShapeHexSvg: React.FC = () => (
  <svg width="46" height="46" viewBox="0 0 46 46" fill="none" aria-hidden="true">
    <path
      d="M23 4 L40 13.5 L40 32.5 L23 42 L6 32.5 L6 13.5 Z"
      fill="rgba(56, 189, 248, 0.36)"
      stroke="#bae6fd"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
    {[
      [18, 15], [28, 15],
      [14, 23], [23, 23], [32, 23],
      [18, 31], [28, 31],
    ].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="3" fill="#e0f2fe" />
    ))}
  </svg>
);

export const GridItHomeScreen: React.FC<GridItHomeScreenProps> = ({
  session,
  onExitToHub,
}) => {
  const [selectedPreview, setSelectedPreview] = useState<ModePreviewInfo | null>(null);

  return (
    <div className="ens-fantasy-page ens-gridit-page">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <div className="ens-scroll-body ens-gridit-scroll">
        <div className="ens-gridit-wrap">
          {/* Top Bar with mandatory Exit to Game Hub */}
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
              <Sparkles size={14} color="#FFD54A" />
              <span>Enscribe</span>
            </div>

            <div className="ens-gridit-guest-pill" title={`Playing as ${session.nickname}`}>
              <AvatarBadge avatarId={session.avatarId} size={26} ringColor="#7dd3fc" />
              <span className="ens-gridit-guest-name">{session.nickname}</span>
            </div>
          </header>

          {/* Main GridIt Hero Card (modeled on Screen 1 of approved GridIt mockup) */}
          <section className="ens-gridit-hero-card">
            <div className="ens-gridit-hero-sparkles" aria-hidden="true">✦</div>
            <h1 className="ens-gridit-logo-title">GridIt</h1>
            <p className="ens-gridit-logo-sub">Find words on dynamic boards</p>

            <div className="ens-gridit-shape-strip" aria-label="Supported board shapes preview">
              <div className="ens-gridit-shape-chip">
                <ShapeSquareSvg />
              </div>
              <div className="ens-gridit-shape-chip">
                <ShapeHeartSvg />
              </div>
              <div className="ens-gridit-shape-chip">
                <ShapeStarSvg />
              </div>
              <div className="ens-gridit-shape-chip">
                <ShapeHexSvg />
              </div>
            </div>

            <button
              type="button"
              className="ens-gridit-play-btn"
              onClick={() => setSelectedPreview(MODE_PREVIEWS.play)}
            >
              <Play size={22} fill="#5c2d00" color="#5c2d00" />
              <span>Play</span>
            </button>
          </section>

          {/* 2x3 Mode Button Grid matching Mockup Screen 1 */}
          <section className="ens-gridit-modes-grid" aria-label="GridIt modes">
            <button
              type="button"
              className="ens-gridit-mode-btn is-solo"
              onClick={() => setSelectedPreview(MODE_PREVIEWS.solo)}
            >
              <User size={24} strokeWidth={2.5} />
              <span>Solo</span>
            </button>

            <button
              type="button"
              className="ens-gridit-mode-btn is-ranked"
              onClick={() => setSelectedPreview(MODE_PREVIEWS.ranked)}
            >
              <Crown size={24} strokeWidth={2.5} color="#FFD54A" fill="#FFD54A" />
              <span>Ranked</span>
            </button>

            <button
              type="button"
              className="ens-gridit-mode-btn is-multiplayer"
              onClick={() => setSelectedPreview(MODE_PREVIEWS.multiplayer)}
            >
              <Users size={24} strokeWidth={2.5} />
              <span>Multiplayer</span>
            </button>

            <button
              type="button"
              className="ens-gridit-mode-btn is-leaderboard"
              onClick={() => setSelectedPreview(MODE_PREVIEWS.leaderboard)}
            >
              <BarChart3 size={24} strokeWidth={2.5} />
              <span>Leaderboard</span>
            </button>

            <button
              type="button"
              className="ens-gridit-mode-btn is-battle"
              onClick={() => setSelectedPreview(MODE_PREVIEWS.board_battle)}
            >
              <Swords size={24} strokeWidth={2.5} />
              <span>Board Battle</span>
            </button>

            <button
              type="button"
              className="ens-gridit-mode-btn is-editor"
              onClick={() => setSelectedPreview(MODE_PREVIEWS.board_editor)}
            >
              <Pencil size={24} strokeWidth={2.5} />
              <span>Board Editor</span>
            </button>
          </section>

          {/* Milestone 1 honest status strip */}
          <div className="ens-gridit-status-banner">
            <Grid2x2 size={15} color="#7dd3fc" />
            <span>GridIt shell integrated in Milestone 1 • Core gameplay launches in Milestone 2</span>
          </div>
        </div>
      </div>

      {/* Honest Mode Preview Modal */}
      {selectedPreview && (
        <div className="ens-modal-backdrop" onClick={() => setSelectedPreview(null)}>
          <div className="ens-modal-card ens-fantasy-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span className="ens-hub-tile-badge is-new">{selectedPreview.milestone}</span>
              <button
                type="button"
                className="ens-btn-white"
                style={{ minHeight: 32, padding: '4px 12px', fontSize: 12 }}
                onClick={() => setSelectedPreview(null)}
              >
                Close
              </button>
            </div>
            <h2 style={{ margin: '10px 0 6px', fontSize: 20, fontWeight: 900, color: '#ffffff' }}>
              {selectedPreview.title}
            </h2>
            <p style={{ margin: '0 0 14px', fontSize: 13.5, fontWeight: 600, color: '#d4dcff', lineHeight: 1.45 }}>
              {selectedPreview.description}
            </p>
            <button
              type="button"
              className="ens-grad-btn is-purple is-full"
              onClick={() => setSelectedPreview(null)}
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
