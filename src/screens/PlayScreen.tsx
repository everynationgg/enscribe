import React, { useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Gamepad2,
  Hash,
  Plus,
  Target,
  Users,
} from 'lucide-react';
import {
  OngoingMatchSummary,
  Profile,
  Room,
  SoloStage,
} from '../../shared/types';
import {
  MountainFlagIcon,
  PodiumCrownIcon,
  RoomsUsersIcon,
  TrophyLaurelIcon,
} from '../components/GameIcons';
import { GradientButton } from '../components/GradientButton';

interface PlayScreenProps {
  profile: Profile;
  ongoingMatches: OngoingMatchSummary[];
  publicRooms: Room[];
  soloStages: SoloStage[];
  rankedQueued: boolean;
  onOpenMatch: (matchId: string) => void;
  onJoinRoomByCode: (code: string) => Promise<void>;
  onOpenSolo: () => void;
  onOpenPractice?: () => void;
  onOpenRooms: () => void;
  onOpenCreateRoom: () => void;
  onOpenLeaderboard: () => void;
  onToggleRankedQueue: () => Promise<void>;
  onExitToHub?: () => void;
}

export const PlayScreen: React.FC<PlayScreenProps> = ({
  ongoingMatches,
  publicRooms,
  soloStages,
  rankedQueued,
  onOpenMatch,
  onJoinRoomByCode,
  onOpenSolo,
  onOpenPractice,
  onOpenRooms,
  onOpenCreateRoom,
  onOpenLeaderboard,
  onToggleRankedQueue,
  onExitToHub,
}) => {
  const [roomCode, setRoomCode] = useState('');
  const [joining, setJoining] = useState(false);

  const completedStages = soloStages.filter((s) => s.completed).length;

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = roomCode.trim().toUpperCase();
    if (!cleaned || joining) return;
    setJoining(true);
    try {
      await onJoinRoomByCode(cleaned);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="ens-fantasy-page ens-play-page">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <div className="ens-scroll-body">
        <div className="ens-home-wrap">
          <header className="ens-play-topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              {onExitToHub && (
                <button
                  type="button"
                  className="ens-exit-hub-btn is-compact"
                  onClick={onExitToHub}
                  aria-label="Exit to Game Hub"
                  title="Exit to Game Hub"
                >
                  <ArrowLeft size={14} strokeWidth={2.8} />
                  <span>Hub</span>
                </button>
              )}
              <Gamepad2 size={22} color="#8CE6FF" />
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, fontStyle: 'italic' }}>
                ChainIt Play
              </h1>
            </div>
            <button
              type="button"
              className="ens-play-lb-chip"
              onClick={onOpenLeaderboard}
            >
              <PodiumCrownIcon size={20} />
              <span>Leaderboard</span>
            </button>
          </header>

          {/* Join by Room Code Glass Card */}
          <form className="ens-play-code-card" onSubmit={handleJoinSubmit}>
            <div className="ens-play-section-label">
              <Hash size={15} color="#7DD3FC" />
              <span>Join by Room Code</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter room code"
                maxLength={8}
                className="ens-fantasy-input"
                style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '0.08em' }}
              />
              <GradientButton
                type="submit"
                variant="lavender"
                size="md"
                loading={joining}
                disabled={!roomCode.trim()}
              >
                Join
              </GradientButton>
            </div>
          </form>

          {/* Primary Fantasy Mode Shortcuts (No Quick Match) */}
          <div className="ens-play-mode-grid">
            <button
              type="button"
              className="ens-play-tile is-solo"
              onClick={onOpenSolo}
            >
              <MountainFlagIcon size={38} />
              <div className="ens-play-tile-title">Solo</div>
              <div className="ens-play-tile-sub">
                {completedStages}/{soloStages.length} cleared
              </div>
            </button>

            <button
              type="button"
              className="ens-play-tile is-ranked"
              onClick={onToggleRankedQueue}
            >
              <TrophyLaurelIcon size={38} />
              <div className="ens-play-tile-title">
                {rankedQueued ? 'In Queue...' : 'Ranked'}
              </div>
              <div className="ens-play-tile-sub">
                {rankedQueued ? 'Tap to cancel' : 'RP Matchmaking'}
              </div>
            </button>

            <button
              type="button"
              className="ens-play-tile is-rooms"
              onClick={onOpenRooms}
            >
              <RoomsUsersIcon size={32} color="#FFFFFF" />
              <div className="ens-play-tile-title">Rooms</div>
              <div className="ens-play-tile-sub">
                {publicRooms.length} open public
              </div>
            </button>

            <button
              type="button"
              className="ens-play-tile is-create"
              onClick={onOpenCreateRoom}
            >
              <span className="ens-play-plus-badge">
                <Plus size={22} strokeWidth={2.8} />
              </span>
              <div className="ens-play-tile-title">Create Room</div>
              <div className="ens-play-tile-sub">Host &amp; invite</div>
            </button>
          </div>

          {onOpenPractice && (
            <div
              className="ens-room-list-card"
              onClick={onOpenPractice}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenPractice();
                }
              }}
              style={{
                cursor: 'pointer',
                borderColor: 'rgba(134, 239, 172, 0.55)',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.24) 0%, rgba(30, 58, 138, 0.78) 100%)',
              }}
            >
              <div className="ens-room-info">
                <div className="ens-room-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Target size={16} color="#86efac" />
                  <span>Practice Mode</span>
                </div>
                <div className="ens-room-meta">
                  <span>Custom themes, chain lengths, hints &amp; timers</span>
                </div>
              </div>
              <GradientButton
                variant="lavender"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPractice();
                }}
              >
                Practice
              </GradientButton>
            </div>
          )}

          {/* Ongoing Matches */}
          <section className="ens-play-ongoing">
            <div className="ens-play-section-label">
              <Clock size={15} color="#FFD54A" />
              <span>Ongoing Matches ({ongoingMatches.length})</span>
            </div>

            {ongoingMatches.length === 0 ? (
              <div className="ens-coming-soon-card" style={{ padding: 16 }}>
                <Users size={22} color="#C9D2FF" />
                <div className="ens-coming-sub" style={{ margin: 0 }}>
                  No ongoing matches right now. Start a Solo stage or join a Room!
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {ongoingMatches.map((m) => (
                  <div
                    key={m.matchId}
                    className="ens-room-list-card"
                    onClick={() => onOpenMatch(m.matchId)}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="ens-room-info">
                      <div className="ens-room-title">
                        {m.title}
                        {m.mode !== 'solo' ? ` • vs ${m.opponentPrimaryName}` : ''}
                      </div>
                      <div className="ens-room-meta">
                        <span>{m.progressLabel}</span>
                        <span>•</span>
                        <span>{m.mode.replace('_', ' ').toUpperCase()}</span>
                      </div>
                    </div>
                    <GradientButton
                      variant={m.isYourTurn ? 'lavender' : 'purple'}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenMatch(m.matchId);
                      }}
                    >
                      {m.isYourTurn ? 'Your Turn' : 'Waiting'}
                    </GradientButton>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
