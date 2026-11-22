import React, { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { AvatarBadge, EnscribeLogo } from '../components/Artwork';

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
    <div
      className="ens-scroll-body"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '24px 18px',
        minHeight: '100%',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <EnscribeLogo size={46} />
          <span className="ens-brand-title" style={{ fontSize: 34 }}>
            Enscribe
          </span>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 13.5, fontWeight: 600, color: '#b7c8ff', textAlign: 'center' }}>
          Competitive Multiplayer Word Games • Chain Clash
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          borderRadius: 24,
          padding: 20,
          background: 'linear-gradient(160deg, rgba(46, 54, 146, 0.88) 0%, rgba(24, 32, 98, 0.96) 100%)',
          border: '1.5px solid rgba(132, 162, 255, 0.45)',
          boxShadow: '0 14px 36px rgba(5, 10, 40, 0.55)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff' }}>Choose Your Nickname</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#c5d4ff', marginTop: 4 }}>
            Creates your player ID for lobbies, matches, and templates
          </div>
        </div>

        <div>
          <label
            htmlFor="enscribe-nickname"
            style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#c5d4ff', marginBottom: 6 }}
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
            style={{
              width: '100%',
              borderRadius: 14,
              border: '1.5px solid rgba(147, 178, 255, 0.5)',
              background: 'rgba(11, 19, 64, 0.78)',
              color: '#ffffff',
              padding: '12px 14px',
              fontSize: 16,
              fontWeight: 800,
              outline: 'none',
            }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#c5d4ff', marginBottom: 8 }}>
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
                    transform: selected ? 'scale(1.08)' : 'scale(1)',
                    transition: 'transform 0.14s ease',
                  }}
                >
                  <AvatarBadge
                    avatarId={av.id}
                    size={42}
                    ringColor={selected ? '#ffd34e' : 'rgba(130, 210, 255, 0.35)'}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(225, 45, 79, 0.2)',
              border: '1px solid #ff647f',
              color: '#ffd1da',
              borderRadius: 12,
              padding: '8px 12px',
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
          className="ens-submit-btn"
          style={{ width: '100%', padding: '13px 16px', fontSize: 16 }}
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
            fontWeight: 600,
            color: '#b7c8ff',
            textAlign: 'center',
          }}
        >
          <Sparkles size={13} color="#ffd34e" />
          <span>Using the same nickname later restores your account</span>
        </div>
      </form>
    </div>
  );
};
