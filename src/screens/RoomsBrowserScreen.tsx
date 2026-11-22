import React, { useMemo, useState } from 'react';
import { Globe, Home, Mail, Plus, RefreshCw } from 'lucide-react';
import { Profile, Room } from '../../shared/types';
import { FantasyPageHeader } from '../components/FantasyPageHeader';
import { QrCodeIcon, RoomsUsersIcon } from '../components/GameIcons';
import { GradientButton } from '../components/GradientButton';
import { RoomListCard } from '../components/RoomListCard';
import { RoundedTabs } from '../components/RoundedTabs';

interface RoomsBrowserScreenProps {
  profile: Profile;
  publicRooms: Room[];
  onBack: () => void;
  onRefreshPublicRooms: () => void;
  onJoinRoomByCode: (code: string) => Promise<void>;
  onOpenCreateRoom: () => void;
}

type RoomsTab = 'public' | 'mine' | 'invites';
type RoomFilter = 'all' | 'classic' | 'speed_race' | 'custom';

export const RoomsBrowserScreen: React.FC<RoomsBrowserScreenProps> = ({
  profile,
  publicRooms,
  onBack,
  onRefreshPublicRooms,
  onJoinRoomByCode,
  onOpenCreateRoom,
}) => {
  const [activeTab, setActiveTab] = useState<RoomsTab>('public');
  const [filter, setFilter] = useState<RoomFilter>('all');
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [joining, setJoining] = useState(false);

  const tabRooms = useMemo(() => {
    if (activeTab === 'mine') {
      return publicRooms.filter(
        (r) => r.hostId === profile.id || r.players.some((p) => p.playerId === profile.id)
      );
    }
    if (activeTab === 'invites') {
      return [];
    }
    return publicRooms;
  }, [activeTab, publicRooms, profile.id]);

  const counts = useMemo(() => {
    const all = tabRooms.length;
    const classic = tabRooms.filter((r) => r.rules.mode === 'classic').length;
    const speed = tabRooms.filter((r) => r.rules.mode === 'speed_race').length;
    const custom = tabRooms.filter(
      (r) => r.rules.puzzleSource === 'custom_create' || r.rules.difficultyPreset === 'custom'
    ).length;
    return { all, classic, speed, custom };
  }, [tabRooms]);

  const filteredRooms = useMemo(() => {
    if (filter === 'classic') return tabRooms.filter((r) => r.rules.mode === 'classic');
    if (filter === 'speed_race') return tabRooms.filter((r) => r.rules.mode === 'speed_race');
    if (filter === 'custom') {
      return tabRooms.filter(
        (r) => r.rules.puzzleSource === 'custom_create' || r.rules.difficultyPreset === 'custom'
      );
    }
    return tabRooms;
  }, [tabRooms, filter]);

  const handleJoinCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = roomCode.trim().toUpperCase();
    if (!cleaned || joining) return;
    setJoining(true);
    try {
      await onJoinRoomByCode(cleaned);
      setShowCodeModal(false);
      setRoomCode('');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="ens-fantasy-page ens-subpage-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <FantasyPageHeader
        title="Rooms"
        subtitle="Find a room, create your own, or join with a room code."
        icon={<RoomsUsersIcon size={32} color="#FFFFFF" />}
        backdropSrc="/art/header-fantasy.png"
        onBack={onBack}
        onHelp={() => setShowHelp(true)}
      />

      <div className="ens-subpage-scroll">
        <div className="ens-subpage-inner">
          <RoundedTabs<RoomsTab>
            ariaLabel="Room lists"
            value={activeTab}
            onChange={(tab) => {
              setActiveTab(tab);
              setFilter('all');
            }}
            options={[
              {
                id: 'public',
                label: 'Public Rooms',
                icon: <Globe size={15} />,
              },
              {
                id: 'mine',
                label: 'My Rooms',
                icon: <Home size={15} />,
              },
              {
                id: 'invites',
                label: 'Invites',
                icon: <Mail size={15} />,
              },
            ]}
          />

          {/* Filter Chips Row */}
          {activeTab !== 'invites' && (
            <div className="ens-filter-row">
              <button
                type="button"
                className={`ens-filter-chip ${filter === 'all' ? 'is-active' : ''}`}
                onClick={() => setFilter('all')}
              >
                <span>All</span>
                <span>({counts.all})</span>
              </button>
              <button
                type="button"
                className={`ens-filter-chip ${filter === 'classic' ? 'is-active' : ''}`}
                onClick={() => setFilter('classic')}
              >
                <span>Classic</span>
                <span>({counts.classic})</span>
              </button>
              <button
                type="button"
                className={`ens-filter-chip ${filter === 'speed_race' ? 'is-active' : ''}`}
                onClick={() => setFilter('speed_race')}
              >
                <span>Speed</span>
                <span>({counts.speed})</span>
              </button>
              <button
                type="button"
                className={`ens-filter-chip ${filter === 'custom' ? 'is-active' : ''}`}
                onClick={() => setFilter('custom')}
              >
                <span>Custom</span>
                <span>({counts.custom})</span>
              </button>

              <button
                type="button"
                className="ens-filter-refresh-btn"
                onClick={onRefreshPublicRooms}
                aria-label="Refresh public rooms"
                title="Refresh public rooms"
              >
                <RefreshCw size={17} strokeWidth={2.4} />
              </button>
            </div>
          )}

          {/* Room Cards or Honest Empty State */}
          {activeTab === 'invites' ? (
            <div className="ens-coming-soon-card">
              <Mail size={28} color="#D8C8FF" />
              <div className="ens-coming-title">No Direct Invites Yet</div>
              <p className="ens-coming-sub">
                Direct friend invites are not active yet. Have a friend share their 5-character room code and tap Join by Code below!
              </p>
              <GradientButton
                variant="purple"
                size="md"
                leftIcon={<QrCodeIcon size={18} />}
                onClick={() => setShowCodeModal(true)}
              >
                Join by Code
              </GradientButton>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="ens-coming-soon-card">
              <RoomsUsersIcon size={34} color="#D8C8FF" />
              <div className="ens-coming-title">
                {activeTab === 'mine'
                  ? 'No Active Public Rooms Hosted or Joined'
                  : 'No Open Public Rooms Right Now'}
              </div>
              <p className="ens-coming-sub">
                Create a new public or private room to invite players, or join a friend&apos;s room using its code.
              </p>
            </div>
          ) : (
            <div className="ens-rooms-list">
              {filteredRooms.map((room) => (
                <RoomListCard
                  key={room.id}
                  room={room}
                  currentPlayerId={profile.id}
                  onJoin={(code) => onJoinRoomByCode(code)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sticky Two-Capsule Action Bar */}
      <div className="ens-sticky-cta-bar is-dual">
        <GradientButton
          variant="lavender"
          size="lg"
          leftIcon={<Plus size={20} strokeWidth={2.8} />}
          onClick={onOpenCreateRoom}
        >
          Create Room
        </GradientButton>

        <GradientButton
          variant="purple"
          size="lg"
          leftIcon={<QrCodeIcon size={20} />}
          onClick={() => setShowCodeModal(true)}
        >
          Join by Code
        </GradientButton>
      </div>

      {/* Join by Code Modal */}
      {showCodeModal && (
        <div className="ens-modal-backdrop" onClick={() => setShowCodeModal(false)}>
          <form
            className="ens-modal-card ens-fantasy-modal"
            onSubmit={handleJoinCodeSubmit}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 900, color: '#FFFFFF' }}>
              Join Room by Code
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#D0D8FF' }}>
              Enter the 5-character room code shared by your host.
            </p>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Enter room code"
              maxLength={8}
              autoFocus
              className="ens-fantasy-input"
              style={{ textTransform: 'uppercase', letterSpacing: '0.12em', textAlign: 'center', marginBottom: 14 }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 10 }}>
              <GradientButton variant="lavender" size="md" onClick={() => setShowCodeModal(false)}>
                Cancel
              </GradientButton>
              <GradientButton
                type="submit"
                variant="purple"
                size="md"
                loading={joining}
                disabled={!roomCode.trim()}
              >
                {joining ? 'Joining...' : 'Join'}
              </GradientButton>
            </div>
          </form>
        </div>
      )}

      {showHelp && (
        <div className="ens-modal-backdrop" onClick={() => setShowHelp(false)}>
          <div className="ens-modal-card ens-fantasy-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: '#FFFFFF' }}>
              About Enscribe Rooms
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: 13.5, color: '#D4DCFF', lineHeight: 1.5 }}>
              Public rooms appear in this live browser for anyone to join. Private rooms are hidden and accessible via their 5-character share code.
            </p>
            <GradientButton variant="lavender" size="md" fullWidth onClick={() => setShowHelp(false)}>
              Got It
            </GradientButton>
          </div>
        </div>
      )}
    </div>
  );
};
