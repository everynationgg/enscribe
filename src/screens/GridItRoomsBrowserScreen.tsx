import React, { useState } from 'react';
import {
  ArrowLeft,
  Eye,
  Plus,
  RefreshCw,
  Shuffle,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react';
import { GridItRoom } from '../../shared/gridit/multiplayerTypes';

interface GridItRoomsBrowserScreenProps {
  publicRooms: GridItRoom[];
  quickQueued: boolean;
  isOffline: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onQuickMatch: () => Promise<void> | void;
  onJoinRoom: (codeOrId: string, asSpectator?: boolean) => Promise<void> | void;
  onOpenCreateRoom: (mode: 'classic' | 'board_battle') => void;
}

export const GridItRoomsBrowserScreen: React.FC<GridItRoomsBrowserScreenProps> = ({
  publicRooms,
  quickQueued,
  isOffline,
  onBack,
  onRefresh,
  onQuickMatch,
  onJoinRoom,
  onOpenCreateRoom,
}) => {
  const [codeDraft, setCodeDraft] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const runAction = async (key: string, fn: () => Promise<void> | void) => {
    if (pendingAction) return;
    setPendingAction(key);
    try {
      await fn();
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="ens-fantasy-page ens-gridit-page">
      <div className="ens-sky-sparkles" aria-hidden="true" />
      <img
        src="/art/gridit-home-hero-bg.png"
        alt=""
        className="ens-gridit-play-backdrop"
        aria-hidden="true"
      />

      <div className="ens-scroll-body ens-gridit-scroll">
        <div className="ens-gridit-wrap" style={{ paddingBottom: 24 }}>
          <header className="ens-gridit-setup-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="ens-exit-hub-btn is-compact"
                onClick={onBack}
                aria-label="Back to GridIt Home"
              >
                <ArrowLeft size={15} strokeWidth={2.8} />
              </button>
              <div>
                <div className="ens-gridit-setup-title">GridIt Multiplayer</div>
                <div className="ens-gridit-setup-sub">
                  Rooms, Quick Match, Spectators &amp; Board Battle
                </div>
              </div>
            </div>

            <button
              type="button"
              className="ens-gridit-step-btn"
              onClick={onRefresh}
              aria-label="Refresh public rooms"
            >
              <RefreshCw size={15} />
            </button>
          </header>

          {/* Primary Matchmaking / Creation CTAs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            <button
              type="button"
              className="ens-gridit-green-cta"
              style={{ minHeight: 46, fontSize: 14 }}
              disabled={isOffline}
              onClick={() => onOpenCreateRoom('classic')}
            >
              <Plus size={16} />
              <span>Create Room</span>
            </button>
            <button
              type="button"
              className="ens-btn-purple"
              style={{ minHeight: 46, fontSize: 13.5 }}
              disabled={isOffline}
              onClick={() => onOpenCreateRoom('board_battle')}
            >
              <Swords size={16} />
              <span>Board Battle</span>
            </button>
          </div>

          <button
            type="button"
            className="ens-grad-btn is-purple is-full"
            disabled={isOffline || pendingAction !== null}
            onClick={() => runAction('quick', onQuickMatch)}
          >
            <Shuffle size={16} />
            <span>
              {pendingAction === 'quick'
                ? 'Connecting...'
                : quickQueued
                  ? 'Searching Random Opponent...'
                  : 'Quick Random Match (1v1)'}
            </span>
          </button>

          {/* Join by Code (Player or Spectator) */}
          <section className="ens-gridit-setup-card" style={{ gap: 8 }}>
            <div className="ens-gridit-setup-label">
              <Sparkles size={14} color="#fde047" />
              <span>Join by Room Code</span>
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              <input
                type="text"
                maxLength={10}
                value={codeDraft}
                onChange={(e) => setCodeDraft(e.target.value.toUpperCase())}
                placeholder="e.g. GD8F3K"
                className="ens-gridit-editor-name-input"
                style={{ flex: 1, letterSpacing: '0.1em' }}
              />
              <button
                type="button"
                className="ens-gridit-submit-btn"
                style={{ minHeight: 38, minWidth: 70 }}
                disabled={!codeDraft.trim() || isOffline || pendingAction !== null}
                onClick={() => runAction('code_join', () => onJoinRoom(codeDraft.trim(), false))}
              >
                {pendingAction === 'code_join' ? 'Joining...' : 'Join'}
              </button>
              <button
                type="button"
                className="ens-gridit-tool-btn"
                style={{ padding: '0 10px' }}
                disabled={!codeDraft.trim() || isOffline || pendingAction !== null}
                onClick={() => runAction('code_watch', () => onJoinRoom(codeDraft.trim(), true))}
                title="Watch room as read-only spectator"
              >
                <Eye size={14} color="#7dd3fc" />
                <span>{pendingAction === 'code_watch' ? 'Opening...' : 'Watch'}</span>
              </button>
            </div>
          </section>

          {/* Public Rooms Browser */}
          <section className="ens-gridit-setup-card">
            <div className="ens-gridit-setup-label">
              <Users size={14} color="#7dd3fc" />
              <span>Public Rooms ({publicRooms.length})</span>
            </div>

            {publicRooms.length === 0 ? (
              <div className="ens-gridit-empty-hint" style={{ padding: '10px 4px', fontSize: 12.5 }}>
                No open public GridIt rooms right now. Create one or queue Quick Match!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {publicRooms.map((room) => {
                  const modCount = [
                    room.settings.mods.rainbowWildcard,
                    room.settings.mods.goldenLetter,
                    room.settings.mods.lightningRound,
                    room.settings.mods.comboFever,
                    room.settings.mods.growingGrid,
                  ].filter(Boolean).length;

                  return (
                    <div key={room.id} className="ens-player-row" style={{ gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 900, color: '#ffffff' }}>
                          {room.name}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#c7d2fe' }}>
                          {room.code} &bull;{' '}
                          {room.settings.mode === 'board_battle' ? 'Board Battle' : 'Classic'} &bull;{' '}
                          {room.settings.shapeId} ({room.settings.sizeId}) &bull; {modCount} mods &bull;{' '}
                          {room.players.length}/{room.settings.capacity}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        {room.settings.allowSpectators && (
                          <button
                            type="button"
                            className="ens-gridit-mini-action"
                            disabled={pendingAction !== null}
                            onClick={() => runAction(`watch_${room.id}`, () => onJoinRoom(room.id, true))}
                            title="Join as Spectator"
                          >
                            <Eye size={12} /> {pendingAction === `watch_${room.id}` ? 'Opening...' : 'Watch'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="ens-gridit-submit-btn"
                          style={{ minHeight: 32, minWidth: 58, padding: '0 11px', fontSize: 12 }}
                          disabled={pendingAction !== null}
                          onClick={() => runAction(`join_${room.id}`, () => onJoinRoom(room.id, false))}
                        >
                          {pendingAction === `join_${room.id}` ? 'Joining...' : 'Join'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
