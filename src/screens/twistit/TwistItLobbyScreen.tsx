import React, { useState } from 'react';
import { ArrowLeft, Check, Clock, Copy, Play, Send, Share2 } from 'lucide-react';
import { PlayerSession, Profile } from '../../../shared/types';
import { TwistItRoomSettings, TwistItRoomView } from '../../../shared/twistit/types';
import { buildRoomShareUrl, copyTextToClipboard } from '../../services/shareLink';
import { EnscribeTopBar } from '../../components/EnscribeTopBar';

interface TwistItLobbyScreenProps {
  room: TwistItRoomView;
  session: PlayerSession;
  profile?: Profile | null;
  onLeave: () => void;
  onOpenProfile: () => void;
  onToggleReady: (ready: boolean) => Promise<void>;
  onUpdateSettings: (patch: Partial<TwistItRoomSettings>) => Promise<void>;
  onSendChat: (message: string) => Promise<void>;
  onStartRace: () => Promise<void>;
  onNotify: (msg: string) => void;
}

export const TwistItLobbyScreen: React.FC<TwistItLobbyScreenProps> = ({
  room,
  session,
  profile,
  onLeave,
  onOpenProfile,
  onToggleReady,
  onUpdateSettings,
  onSendChat,
  onStartRace,
  onNotify,
}) => {
  const [chatText, setChatText] = useState('');
  const [starting, setStarting] = useState(false);

  const isHost = room.hostUserId === session.playerId;
  const selfPlayer = room.players.find((p) => p.userId === session.playerId);
  const canStart = isHost && room.players.length === 2;

  const handleCopyInvite = async () => {
    const url = buildRoomShareUrl('twistit', room.code);
    const copied = await copyTextToClipboard(url);
    onNotify(copied ? `Invite link copied! Code: ${room.code}` : `Room code: ${room.code}`);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = chatText.trim();
    if (!clean) return;
    setChatText('');
    await onSendChat(clean);
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
            onBrandClick={onLeave}
            onOpenProfile={onOpenProfile}
          />

          <div className="ens-landing-subbar" style={{ padding: '2px 2px 4px' }}>
            <button type="button" className="ens-back-hub-pill" onClick={onLeave}>
              <ArrowLeft size={14} strokeWidth={2.8} />
              <span>Leave Room</span>
            </button>
            <span className="ens-landing-subbar-sep" aria-hidden="true" />
            <div className="ens-landing-game-crumb">
              <span>Room #{room.code}</span>
            </div>
          </div>

          <section className="twist-card is-highlight">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#a5b4fc' }}>1v1 SPEED RACE LOBBY</div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.06em', color: '#fde047' }}>
                  {room.code}
                </div>
              </div>
              <button type="button" className="twist-btn-cyan" onClick={handleCopyInvite}>
                <Share2 size={15} />
                <Copy size={13} />
                <span>Invite Friend</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#cbd5ff', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Clock size={13} /> Max Race Time:
              </span>
              {([120, 180, 240] as const).map((sec) => (
                <button
                  key={sec}
                  type="button"
                  disabled={!isHost}
                  className={room.settings.roundDurationSec === sec ? 'twist-btn-cyan' : 'twist-btn-ghost'}
                  style={{ minHeight: 28, padding: '0 10px', fontSize: 12 }}
                  onClick={() => onUpdateSettings({ roundDurationSec: sec })}
                >
                  {sec / 60} min
                </button>
              ))}
            </div>
          </section>

          {/* 2 Player Seats */}
          <section className="twist-card">
            <h3 style={{ margin: '0 0 10px', fontSize: 14.5, fontWeight: 900 }}>
              Racers ({room.players.length} / 2)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[0, 1].map((idx) => {
                const p = room.players[idx];
                if (!p) {
                  return (
                    <div
                      key={idx}
                      style={{
                        borderRadius: 16,
                        border: '1.5px dashed rgba(148,194,255,0.35)',
                        padding: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        minHeight: 84,
                        color: '#93c5fd',
                        fontSize: 12.5,
                        fontWeight: 800,
                      }}
                    >
                      <span>Waiting for Player 2...</span>
                    </div>
                  );
                }
                return (
                  <div
                    key={p.userId}
                    style={{
                      borderRadius: 16,
                      background: 'rgba(7, 13, 56, 0.72)',
                      border: `1.5px solid ${p.isReady ? 'rgba(74,222,128,0.65)' : 'rgba(148,194,255,0.3)'}`,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 999,
                          background: p.avatarColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          fontSize: 14,
                          border: '1.5px solid #fff',
                        }}
                      >
                        {p.displayName.slice(0, 1).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.displayName}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: p.isHost ? '#fde047' : '#93c5fd' }}>
                          {p.isHost ? 'Host' : p.isReady ? 'Ready' : 'Joined'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {!isHost && selfPlayer && (
                <button
                  type="button"
                  className={selfPlayer.isReady ? 'twist-btn-ghost' : 'twist-btn-cyan'}
                  style={{ flex: 1 }}
                  onClick={() => onToggleReady(!selfPlayer.isReady)}
                >
                  <Check size={16} />
                  <span>{selfPlayer.isReady ? 'Ready!' : 'Mark Ready'}</span>
                </button>
              )}

              {isHost && (
                <button
                  type="button"
                  className="twist-btn-gold"
                  style={{ flex: 1 }}
                  disabled={!canStart || starting}
                  onClick={async () => {
                    setStarting(true);
                    try {
                      await onStartRace();
                    } finally {
                      setStarting(false);
                    }
                  }}
                >
                  <Play size={17} fill="currentColor" />
                  <span>
                    {room.players.length < 2 ? 'Waiting for 2nd Player' : 'Start 1v1 Speed Race'}
                  </span>
                </button>
              )}
            </div>
          </section>

          {/* Compact Chat */}
          <section className="twist-card">
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>Room Chat</div>
            <div
              style={{
                maxHeight: 110,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                marginBottom: 8,
              }}
            >
              {room.chat.length === 0 ? (
                <div style={{ fontSize: 12, color: '#93c5fd', fontWeight: 600 }}>Say hi before the race begins!</div>
              ) : (
                room.chat.map((c) => (
                  <div key={c.id} style={{ fontSize: 12.5, fontWeight: 700 }}>
                    <span style={{ color: '#fde047' }}>{c.displayName}: </span>
                    <span style={{ color: '#eff6ff' }}>{c.message}</span>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Type a message..."
                maxLength={180}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 11,
                  border: '1px solid rgba(164,200,255,0.35)',
                  background: 'rgba(7, 13, 56, 0.85)',
                  color: '#fff',
                  padding: '0 10px',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              />
              <button type="submit" className="twist-btn-cyan" style={{ minHeight: 36, padding: '0 12px' }}>
                <Send size={14} />
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};
