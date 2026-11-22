import React from 'react';
import {
  ArrowRight,
  Bell,
  ChevronRight,
  Crown,
  Mountain,
  Play,
  Plus,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { InAppNotification, OngoingMatchSummary, Profile } from '../../shared/types';
import { AvatarBadge, EnscribeLogo, FantasyBannerArt } from '../components/Artwork';

interface HomeScreenProps {
  profile: Profile;
  ongoingMatches: OngoingMatchSummary[];
  notifications: InAppNotification[];
  onOpenNotifications: () => void;
  onContinueMatch: (matchId: string) => void;
  onViewAllMatches: () => void;
  onQuickPlay: () => void;
  onRankedMatch: () => void;
  onSoloAdventure: () => void;
  onPublicRooms: () => void;
  onCreateRoom: () => void;
  onExploreFantasy: () => void;
  onOpenProfile: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  profile,
  ongoingMatches,
  notifications,
  onOpenNotifications,
  onContinueMatch,
  onViewAllMatches,
  onQuickPlay,
  onRankedMatch,
  onSoloAdventure,
  onPublicRooms,
  onCreateRoom,
  onExploreFantasy,
  onOpenProfile,
}) => {
  const unreadCount = notifications.filter((n) => !n.read).length;
  const primaryMatch =
    ongoingMatches.find((m) => m.isYourTurn) ?? ongoingMatches[0] ?? null;

  const modeLabel = (mode: string) => {
    if (mode === 'speed_race') return 'Speed Race';
    if (mode === 'ranked') return 'Ranked Mode';
    if (mode === 'solo') return 'Solo Adventure';
    return 'Classic Mode';
  };

  return (
    <div className="ens-scroll-body">
      <div className="ens-home-wrap">
        {/* Top Brand Header */}
        <header className="ens-home-header">
          <div className="ens-brand-lockup">
            <EnscribeLogo size={36} />
            <span className="ens-brand-title">Enscribe</span>
          </div>

          <div className="ens-header-actions">
            <button
              type="button"
              className="ens-bell-btn"
              onClick={onOpenNotifications}
              aria-label="Notifications"
            >
              <Bell size={19} />
              {unreadCount > 0 && <span className="ens-unread-dot" />}
            </button>
          </div>
        </header>

        {/* Greeting & Rank Badge */}
        <div className="ens-greeting-row">
          <div
            className="ens-greeting-left"
            onClick={onOpenProfile}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
            title="Switch or edit player profile"
          >
            <AvatarBadge avatarId={profile.avatarId} size={46} />
            <div style={{ minWidth: 0 }}>
              <div className="ens-greeting-name">Hi, {profile.username}! 👋</div>
              <div className="ens-greeting-sub">Ready for a word chain clash?</div>
            </div>
          </div>

          <div className="ens-rank-pill" onClick={onOpenProfile} style={{ cursor: 'pointer' }}>
            <div className="ens-rank-tier">
              <Crown size={14} fill="#ffd34e" color="#ffd34e" />
              <span>{profile.rankTier}</span>
            </div>
            <div className="ens-rank-rp">{profile.rankPoints.toLocaleString()} RP</div>
          </div>
        </div>

        {/* Hero Continue Match Card */}
        {primaryMatch ? (
          <div
            className="ens-hero-turn-card"
            onClick={() => onContinueMatch(primaryMatch.matchId)}
          >
            <div className="ens-hero-watermark">
              <EnscribeLogo size={110} />
            </div>
            <div className="ens-hero-top">
              <div>
                <div className="ens-hero-title-row">
                  <Zap size={20} fill="#ffe45e" color="#ffe45e" />
                  <span>{primaryMatch.isYourTurn ? "It's Your Turn" : 'Active Match'}</span>
                </div>
                <div className="ens-hero-sub">
                  vs. {primaryMatch.opponentPrimaryName} • {modeLabel(primaryMatch.mode)}
                </div>
              </div>
              <ArrowRight size={20} color="#ffffff" />
            </div>

            <button
              type="button"
              className="ens-hero-btn"
              onClick={(e) => {
                e.stopPropagation();
                onContinueMatch(primaryMatch.matchId);
              }}
            >
              <Play size={16} fill="#643bf2" color="#643bf2" />
              <span>Continue Match</span>
            </button>

            {ongoingMatches.length > 1 && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onViewAllMatches();
                }}
                style={{
                  marginTop: 7,
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#fff6d6',
                  textAlign: 'center',
                  textDecoration: 'underline',
                  position: 'relative',
                  zIndex: 2,
                }}
              >
                +{ongoingMatches.length - 1} more ongoing matches — View all
              </div>
            )}
          </div>
        ) : (
          <div className="ens-hero-turn-card" onClick={onQuickPlay}>
            <div className="ens-hero-watermark">
              <EnscribeLogo size={110} />
            </div>
            <div className="ens-hero-top">
              <div>
                <div className="ens-hero-title-row">
                  <Zap size={20} fill="#ffe45e" color="#ffe45e" />
                  <span>Jump Into Chain Clash</span>
                </div>
                <div className="ens-hero-sub">No active turns waiting • Start a new clash</div>
              </div>
              <ArrowRight size={20} color="#ffffff" />
            </div>
            <button type="button" className="ens-hero-btn">
              <Play size={16} fill="#643bf2" color="#643bf2" />
              <span>Find Match Now</span>
            </button>
          </div>
        )}

        {/* 2x2 Main Mode Action Grid */}
        <div className="ens-mode-grid">
          <button type="button" className="ens-mode-card quick-play" onClick={onQuickPlay}>
            <div className="ens-mode-icon">
              <Zap size={20} fill="#ffffff" color="#ffffff" />
            </div>
            <div>
              <div className="ens-mode-title">Quick Play &gt;</div>
              <div className="ens-mode-sub">Find a match now</div>
            </div>
          </button>

          <button type="button" className="ens-mode-card ranked-match" onClick={onRankedMatch}>
            <div className="ens-mode-icon">
              <Trophy size={20} color="#ffd34e" />
            </div>
            <div>
              <div className="ens-mode-title">Ranked Match</div>
              <div className="ens-mode-sub">Compete &amp; climb &gt;</div>
            </div>
          </button>

          <button type="button" className="ens-mode-card solo-adv" onClick={onSoloAdventure}>
            <div className="ens-mode-icon">
              <Mountain size={20} color="#ffffff" />
            </div>
            <div>
              <div className="ens-mode-title">Solo Adventure</div>
              <div className="ens-mode-sub">Play offline &amp; practice &gt;</div>
            </div>
          </button>

          <button type="button" className="ens-mode-card public-rooms" onClick={onPublicRooms}>
            <div className="ens-mode-icon">
              <Users size={20} color="#ffffff" />
            </div>
            <div>
              <div className="ens-mode-title">Public Rooms &gt;</div>
              <div className="ens-mode-sub">Join open rooms</div>
            </div>
          </button>
        </div>

        {/* Create Room Full-Width Card */}
        <button type="button" className="ens-create-room-card" onClick={onCreateRoom}>
          <div className="ens-create-left">
            <div className="ens-create-plus">
              <Plus size={22} strokeWidth={2.8} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#17204d' }}>Create Room</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#58628b' }}>
                Invite friends &amp; play together
              </div>
            </div>
          </div>
          <ChevronRight size={20} color="#4e5985" />
        </button>

        {/* Fantasy Season Promotional Banner */}
        <div className="ens-promo-banner">
          <FantasyBannerArt />
          <div className="ens-promo-content">
            <div className="ens-promo-title">
              <span>✨</span>
              <span>Fantasy Season</span>
            </div>
            <div className="ens-promo-sub">New themed templates, badges, and rewards!</div>
            <button type="button" className="ens-promo-btn" onClick={onExploreFantasy}>
              <span>Explore Now</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        <div className="ens-carousel-dots">
          <span className="ens-dot active" />
          <span className="ens-dot" />
          <span className="ens-dot" />
        </div>
      </div>
    </div>
  );
};
