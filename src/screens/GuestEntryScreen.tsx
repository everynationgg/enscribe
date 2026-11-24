import React, { useState } from 'react';
import { ArrowRight, ShieldCheck, Sparkles, WifiOff } from 'lucide-react';
import { AvatarBadge } from '../components/Artwork';
import { EnscribeBrandLogo } from '../components/BrandedHeader';
import { loadCachedGuestPrefs } from '../services/session';
import { GAME_DISPLAY_NAMES, PendingRoomInvite } from '../services/shareLink';

interface GuestEntryScreenProps {
  isOffline: boolean;
  initialError?: string | null;
  pendingInvite?: PendingRoomInvite | null;
  onEnterGuest: (nickname: string, avatarId: string) => Promise<void>;
}

const AVATAR_OPTIONS = [
  { id: 'alex', label: 'Blue' },
  { id: 'novarex', label: 'Neon' },
  { id: 'pixelmochi', label: 'Pixel' },
  { id: 'leafy', label: 'Mint' },
  { id: 'spark', label: 'Amber' },
  { id: 'knight', label: 'Steel' },
];

export const GuestEntryScreen: React.FC<GuestEntryScreenProps> = ({
  isOffline,
  initialError = null,
  pendingInvite = null,
  onEnterGuest,
}) => {
  const cached = loadCachedGuestPrefs();
  const [nickname, setNickname] = useState(cached.nickname);
  const [avatarId, setAvatarId] = useState(cached.avatarId || 'alex');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nickname.trim();
    if (clean.length < 2) {
      setError('Enter a nickname with at least 2 characters.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onEnterGuest(clean, avatarId);
    } catch (err: any) {
      setError(err?.message || 'Could not start guest session.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ens-fantasy-page ens-signin-page">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <div
        className="ens-scroll-body"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '24px 18px 86px',
          minHeight: '100%',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
          <div className="ens-guest-mascot-badge" aria-hidden="true">
            <img src="/art/hero-mascot.png" alt="" className="ens-guest-mascot-img" />
          </div>
          <EnscribeBrandLogo centered />
          <p style={{ margin: '8px 0 0', fontSize: 13.5, fontWeight: 700, color: '#D4DCFF', textAlign: 'center' }}>
            Multiplayer Word Games Hub • ChainIt &amp; GridIt
          </p>
        </div>

        <form onSubmit={handleSubmit} className="ens-signin-card">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 21, fontWeight: 900, color: '#ffffff' }}>Enter as Guest</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#c8d6ff', marginTop: 4 }}>
              Pick a unique temporary nickname for this session
            </div>
          </div>

          {pendingInvite && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.38) 0%, rgba(56, 189, 248, 0.26) 100%)',
                border: '1.5px solid rgba(196, 181, 253, 0.72)',
                borderRadius: 14,
                padding: '10px 12px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff' }}>
                Invited to {GAME_DISPLAY_NAMES[pendingInvite.game]} &bull; Room {pendingInvite.code}
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#dbeafe', marginTop: 2 }}>
                Enter a nickname to join the room directly
              </div>
            </div>
          )}

          {isOffline && (
            <div className="ens-guest-offline-banner">
              <WifiOff size={14} />
              <span>Offline mode — enter to play Solo locally</span>
            </div>
          )}

          <div>
            <label
              htmlFor="enscribe-nickname"
              style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#d5e0ff', marginBottom: 6 }}
            >
              Guest Nickname
            </label>
            <input
              id="enscribe-nickname"
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value.slice(0, 20));
                if (error) setError(null);
              }}
              placeholder="Enter a unique nickname..."
              autoFocus
              maxLength={20}
              className="ens-fantasy-input"
            />
          </div>

          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#d5e0ff', marginBottom: 8 }}>
              Pick Avatar
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
              {AVATAR_OPTIONS.map((av) => {
                const selected = avatarId === av.id;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setAvatarId(av.id)}
                    aria-label={`Select ${av.label} avatar`}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      transform: selected ? 'scale(1.1)' : 'scale(1)',
                      transition: 'transform 0.14s ease',
                    }}
                  >
                    <AvatarBadge
                      avatarId={av.id}
                      size={42}
                      ringColor={selected ? '#FFD54A' : 'rgba(130, 210, 255, 0.4)'}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                background: 'rgba(225, 45, 79, 0.24)',
                border: '1.5px solid #ff647f',
                color: '#ffd1da',
                borderRadius: 14,
                padding: '9px 12px',
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="ens-grad-btn is-purple is-lg is-full"
          >
            <span>
              {submitting
                ? pendingInvite
                  ? 'Joining Room...'
                  : 'Reserving Nickname...'
                : isOffline
                  ? 'Enter Offline Solo'
                  : pendingInvite
                    ? `Join ${GAME_DISPLAY_NAMES[pendingInvite.game]} Room`
                    : 'Enter Game Hub'}
            </span>
            <ArrowRight size={18} />
          </button>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              fontSize: 11.5,
              fontWeight: 700,
              color: '#c8d6ff',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <ShieldCheck size={13} color="#38bdf8" />
              <span>Temporary guest session • No permanent account or saved rank</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#a5b8f5', fontSize: 11 }}>
              <Sparkles size={12} color="#ffd34e" />
              <span>Nickname cached locally for easy return (ENGG login coming soon)</span>
            </div>
          </div>
        </form>
      </div>

      <div className="ens-home-bottom-art" aria-hidden="true">
        <img
          src="/art/home-bottom-landscape.png"
          alt=""
          className="ens-home-bottom-img"
        />
      </div>
    </div>
  );
};
