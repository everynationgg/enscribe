import React, { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { AvatarBadge } from '../components/Artwork';
import { EnscribeBrandLogo } from '../components/BrandedHeader';

interface SignInScreenProps {
  onSignIn: (username: string, avatarId: string) => Promise<void>;
}

const AVATAR_OPTIONS = [
  { id: 'alex', label: 'Blue' },
  { id: 'novarex', label: 'Neon' },
  { id: 'pixelmochi', label: 'Pixel' },
  { id: 'leafy', label: 'Mint' },
  { id: 'spark', label: 'Amber' },
  { id: 'knight', label: 'Steel' },
];

export const SignInScreen: React.FC<SignInScreenProps> = ({ onSignIn }) => {
  const [nickname, setNickname] = useState('');
  const [avatarId, setAvatarId] = useState('alex');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await onSignIn(clean, avatarId);
    } catch (err: any) {
      setError(err?.message || 'Could not sign in.');
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22 }}>
          <EnscribeBrandLogo centered />
          <p style={{ margin: '10px 0 0', fontSize: 13.5, fontWeight: 700, color: '#D4DCFF', textAlign: 'center' }}>
            Competitive Multiplayer Word Games • Chain Clash
          </p>
        </div>

        <form onSubmit={handleSubmit} className="ens-signin-card">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 21, fontWeight: 900, color: '#ffffff' }}>Choose Your Nickname</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#c8d6ff', marginTop: 4 }}>
              Creates your player ID for lobbies, matches, and templates
            </div>
          </div>

          <div>
            <label
              htmlFor="enscribe-nickname"
              style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#d5e0ff', marginBottom: 6 }}
            >
              Nickname
            </label>
            <input
              id="enscribe-nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 20))}
              placeholder="Enter your nickname..."
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
            <span>{submitting ? 'Entering...' : 'Enter Enscribe'}</span>
            <ArrowRight size={18} />
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 11.5,
              fontWeight: 700,
              color: '#c8d6ff',
              textAlign: 'center',
            }}
          >
            <Sparkles size={13} color="#ffd34e" />
            <span>Using the same nickname later restores your account</span>
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
