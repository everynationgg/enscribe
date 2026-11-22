import React from 'react';
import { Globe, Lock, Play, Users } from 'lucide-react';
import { Room } from '../../shared/types';
import { GearBadgeIcon, GoldCrownIcon, PuzzleBadgeIcon } from './GameIcons';
import { GradientButton } from './GradientButton';

const ROOM_THUMB_ARTS = [
  '/art/room-arch.png',
  '/art/room-crystals.png',
  '/art/room-castle.png',
  '/art/room-island.png',
] as const;

export function resolveRoomArtSrc(room: Pick<Room, 'id' | 'rules'>): string {
  const theme = room.rules.theme;
  if (theme === 'arch' || theme === 'crystals' || theme === 'castle' || theme === 'island') {
    return `/art/room-${theme}.png`;
  }
  if (room.rules.mode === 'speed_race') return '/art/room-crystals.png';
  if (room.rules.puzzleSource === 'custom_create') return '/art/room-castle.png';
  let hash = 0;
  for (let i = 0; i < room.id.length; i++) {
    hash = (hash * 31 + room.id.charCodeAt(i)) >>> 0;
  }
  return ROOM_THUMB_ARTS[hash % ROOM_THUMB_ARTS.length];
}

interface RoomListCardProps {
  room: Room;
  currentPlayerId: string;
  onJoin: (code: string) => void;
}

export const RoomListCard: React.FC<RoomListCardProps> = ({
  room,
  currentPlayerId,
  onJoin,
}) => {
  const isMember = room.players.some((p) => p.playerId === currentPlayerId);
  const isFull = room.players.length >= room.rules.maxPlayers && !isMember;
  const artSrc = resolveRoomArtSrc(room);

  const isSpeed = room.rules.mode === 'speed_race';
  const isCustom =
    room.rules.puzzleSource === 'custom_create' || room.rules.difficultyPreset === 'custom';
  const categoryLabel = isSpeed ? 'Speed Race' : isCustom ? 'Custom' : 'Classic';

  const renderCategoryBadge = () => {
    if (isSpeed) return <PuzzleBadgeIcon size={15} />;
    if (isCustom) return <GearBadgeIcon size={15} />;
    return <GoldCrownIcon size={15} />;
  };

  return (
    <div className="ens-room-list-card">
      <div className="ens-room-thumb-frame">
        <img src={artSrc} alt="" className="ens-room-thumb-img" />
      </div>

      <div className="ens-room-info">
        <div className="ens-room-tag-row">
          <span className="ens-room-tag-icon">{renderCategoryBadge()}</span>
          <span className="ens-room-tag-pill">{categoryLabel}</span>
          {room.hostId === currentPlayerId && (
            <span className="ens-room-host-pill">Host</span>
          )}
        </div>

        <div className="ens-room-title">{room.name}</div>

        <div className="ens-room-meta">
          <span className="ens-room-meta-item">
            <Users size={13} strokeWidth={2.3} />
            <span>
              {room.players.length} / {room.rules.maxPlayers}
            </span>
          </span>
          <span className="ens-room-meta-item">
            {room.isPublic ? (
              <>
                <Globe size={13} strokeWidth={2.3} />
                <span>Public</span>
              </>
            ) : (
              <>
                <Lock size={13} strokeWidth={2.3} />
                <span>Private</span>
              </>
            )}
          </span>
        </div>
      </div>

      <GradientButton
        variant="lavender"
        size="sm"
        disabled={isFull}
        leftIcon={<Play size={12} fill="#5C28E6" color="#5C28E6" />}
        onClick={() => onJoin(room.code)}
        className="ens-room-join-btn"
      >
        {isFull ? 'Full' : isMember ? 'Enter' : 'Join'}
      </GradientButton>
    </div>
  );
};
