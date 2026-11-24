import React, { useState } from 'react';
import { ArrowLeft, Clock, Lock, Plus, RefreshCw, Search, Users, Zap } from 'lucide-react';
import { PlayerSession, Profile } from '../../../shared/types';
import { TwistItRoomSettings, TwistItRoomView } from '../../../shared/twistit/types';
import { EnscribeTopBar } from '../../components/EnscribeTopBar';

interface TwistItMultiplayerScreenProps {
  session: PlayerSession;
  profile?: Profile | null;
  publicRooms: TwistItRoomView[];
  searchingQuick: boolean;
  isOffline: boolean;
  onBack: () => void;
  onOpenProfile: () => void;
  onRefreshRooms: () => void;
  onQuickMatch: () => Promise<void>;
  onCancelQuickMatch: () => Promise<void>;
  onCreateRoom: (settings: TwistItRoomSettings) => Promise<void>;
  onJoinRoomByCode: (code: string) => Promise<void>;
}

export const TwistItMultiplayerScreen: React.FC<TwistItMultiplayerScreenProps> = ({
  session,
  profile,
  publicRooms,
  searchingQuick,
  isOffline,
  onBack,
  onOpenProfile,
  onRefreshRooms,
  onQuickMatch,
  onCancelQuickMatch,
  onCreateRoom,
  onJoinRoomByCode,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [roundDurationSec, setRoundDurationSec] = useState<120 | 180 | 240>(180);
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (busy || isOffline) return;
    setBusy(true);
    try {
      await onCreateRoom({ isPublic, roundDurationSec });
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = joinCode.trim().toUpperCase();
    if (!clean || busy || isOffline) return;
    setBusy(true);
    try {
      await onJoinRoomByCode(clean);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="twist-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />
      <div className="twist-scroll">
        <div className="twist-inner">
          <EnscribeTopBar
            nickname={session.nickname}
            avatarId={session.avatarId}
            coins={profile?.matchPointsBalance ?? 0}
            isOffline={isOffline}
            onBrandClick={onBack}
            onOpenProfile={onOpenProfile}
          />

          <div className="ens-landing-subbar" style={{ padding: '2px 2px 4px' }}>
            <button type="button" className="ens-back-hub-pill" onClick={onBack}>
              <ArrowLeft size={14} strokeWidth={2.8} />
              <span>TwistIt</span>
            </button>
            <span className="ens-landing-subbar-sep" aria-hidden="true" />
            <div className="ens-landing-game-crumb">
              <span>1v1 Speed Race</span>
            </div>
          </div>

          {/* 1v1 Quick Match */}
          <section className="twist-card is-highlight">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Zap size={20} color="#fff" fill="#fff" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 900 }}>
                  1v1 Quick Speed Race
                </h2>
                <p style={{ margin: 0, fontSize: 12.5, color: '#cbd5ff', fontWeight: 600 }}>
                  Same 6 letters, same answers. First to find all words wins!
                </p>
              </div>
            </div>

            {searchingQuick ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: '#fde047' }}>
                  Searching for a 1v1 rival...
                </span>
                <button type="button" className="twist-btn-ghost" onClick={onCancelQuickMatch}>
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="twist-btn-gold"
                style={{ width: '100%', marginTop: 8 }}
                disabled={isOffline}
                onClick={onQuickMatch}
              >
                <Zap size={17} />
                <span>{isOffline ? 'Online Required for 1v1' : 'Find 1v1 Opponent'}</span>
              </button>
            )}
          </section>

          {/* Create 1v1 Room */}
          <section className="twist-card">
            <h3 style={{ margin: '0 0 10px', fontSize: 15.5, fontWeight: 900 }}>
              Create a 1v1 Room
            </h3>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <button
                type="button"
                className={isPublic ? 'twist-btn-cyan' : 'twist-btn-ghost'}
                onClick={() => setIsPublic(true)}
                style={{ minHeight: 34, fontSize: 12.5 }}
              >
                <Users size={14} />
                <span>Public</span>
              </button>
              <button
                type="button"
                className={!isPublic ? 'twist-btn-cyan' : 'twist-btn-ghost'}
                onClick={() => setIsPublic(false)}
                style={{ minHeight: 34, fontSize: 12.5 }}
              >
                <Lock size={14} />
                <span>Private Invite</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#a5b4fc', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Clock size={13} /> Max Time:
              </span>
              {([120, 180, 240] as const).map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={roundDurationSec === sec ? 'twist-btn-cyan' : 'twist-btn-ghost'}
                  onClick={() => setRoundDurationSec(sec)}
                  style={{ minHeight: 30, padding: '0 10px', fontSize: 12 }}
                >
                  {sec / 60} min
                </button>
              ))}
            </div>

            <button
              type="button"
              className="twist-btn-primary"
              style={{ width: '100%' }}
              disabled={busy || isOffline}
              onClick={handleCreate}
            >
              <Plus size={17} />
              <span>Create 1v1 Room</span>
            </button>
          </section>

          {/* Join by Code & Public Rooms */}
          <section className="twist-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 900 }}>
                Join a 1v1 Room
              </h3>
              <button
                type="button"
                className="twist-btn-ghost"
                style={{ minHeight: 30, padding: '0 10px', fontSize: 12 }}
                onClick={onRefreshRooms}
              >
                <RefreshCw size={13} />
                <span>Refresh</span>
              </button>
            </div>

            <form onSubmit={handleJoin} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter room code (e.g. ABC123)"
                maxLength={8}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 12,
                  border: '1.5px solid rgba(164,200,255,0.4)',
                  background: 'rgba(7, 13, 56, 0.85)',
                  color: '#fff',
                  padding: '0 12px',
                  fontSize: 13.5,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                }}
              />
              <button
                type="submit"
                className="twist-btn-cyan"
                disabled={!joinCode.trim() || busy || isOffline}
              >
                <Search size={15} />
                <span>Join</span>
              </button>
            </form>

            {publicRooms.length === 0 ? (
              <div style={{ fontSize: 13, color: '#93c5fd', fontWeight: 700, textAlign: 'center', padding: '8px 0' }}>
                No public 1v1 rooms waiting right now. Create one or hit Quick Race above!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {publicRooms.map((rm) => (
                  <div
                    key={rm.code}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '9px 11px',
                      borderRadius: 14,
                      background: 'rgba(7, 13, 56, 0.72)',
                      border: '1px solid rgba(148, 194, 255, 0.25)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 900 }}>
                        {rm.players[0]?.displayName || 'Host'}&apos;s Race • #{rm.code}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#93c5fd', fontWeight: 700 }}>
                        {rm.players.length}/2 Players • {rm.settings.roundDurationSec / 60} min cap
                      </div>
                    </div>
                    <button
                      type="button"
                      className="twist-btn-cyan"
                      style={{ minHeight: 34, padding: '0 13px', fontSize: 12.5 }}
                      disabled={rm.players.length >= 2 || busy || isOffline}
                      onClick={() => onJoinRoomByCode(rm.code)}
                    >
                      Join
                    </button>
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
