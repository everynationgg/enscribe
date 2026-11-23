import React, { useState } from 'react';
import { ChevronDown, History, LogOut, Palette, Save, UserCheck } from 'lucide-react';
import { EquippedCosmetics, MatchHistorySummary, Profile } from '../../shared/types';
import { AvatarBadge } from '../components/Artwork';
import { GoldCrownIcon } from '../components/GameIcons';

interface ProfileScreenProps {
  profile: Profile;
  matchHistory: MatchHistorySummary[];
  onUpdateProfile: (data: { username: string; avatarId: string }) => Promise<void>;
  onUpdateCosmetics: (cosmetics: EquippedCosmetics) => Promise<void>;
  onSignOut: () => void;
}

const AVATAR_OPTIONS = ['alex', 'novarex', 'pixelmochi', 'leafy', 'spark', 'knight'];

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  profile,
  matchHistory,
  onUpdateProfile,
  onUpdateCosmetics,
  onSignOut,
}) => {
  const [editUsername, setEditUsername] = useState(profile.username);
  const [editAvatar, setEditAvatar] = useState(profile.avatarId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const winRate =
    profile.wins + profile.losses > 0
      ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
      : 0;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editUsername.trim().length < 2) {
      setSaveError('Nickname must be at least 2 characters.');
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      await onUpdateProfile({ username: editUsername.trim(), avatarId: editAvatar });
    } catch (err: any) {
      setSaveError(err?.message || 'Could not update nickname.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ens-sheet-screen" style={{ flex: 1, minHeight: 0 }}>
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <header className="ens-royal-topbar">
        <img src="/art/header-fantasy.png" alt="" className="ens-royal-topbar-art" aria-hidden="true" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserCheck size={20} color="#7dd3fc" />
          <span style={{ fontSize: 20, fontWeight: 900, fontStyle: 'italic', textShadow: '0 2px 8px rgba(8,12,56,0.6)' }}>
            Player Profile
          </span>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          style={{
            border: '1.5px solid rgba(206, 200, 255, 0.58)',
            borderRadius: 999,
            padding: '6px 13px',
            background: 'linear-gradient(180deg, rgba(78, 66, 178, 0.85) 0%, rgba(42, 38, 126, 0.92) 100%)',
            color: '#ffffff',
            fontFamily: 'var(--font-ui)',
            fontSize: 12.5,
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(8,12,56,0.35)',
          }}
        >
          <LogOut size={13} />
          <span>{profile.isGuest ? 'Switch Guest' : 'Sign Out'}</span>
        </button>
      </header>

      <div className="ens-sheet-body">
        {/* Active Profile Hero Card */}
        <div className="ens-profile-hero">
          <div className="ens-avatar-ring-wrap">
            <AvatarBadge avatarId={profile.avatarId} size={58} ringColor="#a5f3fc" />
          </div>
          <div style={{ minWidth: 0, position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 21, fontWeight: 900, color: '#ffffff', lineHeight: 1.15 }}>
              {profile.username}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 13.5,
                fontWeight: 800,
                color: '#ffd54a',
                marginTop: 3,
              }}
            >
              <GoldCrownIcon size={16} />
              <span>
                {profile.isGuest
                  ? 'Temporary Guest Session'
                  : `${profile.rankTier} • ${profile.rankPoints.toLocaleString()} RP`}
              </span>
            </div>
            <div className="ens-profile-id-chip">
              {profile.isGuest ? 'Session ID: ' : 'Player ID: '}
              <span style={{ fontFamily: 'monospace' }}>{profile.id}</span>
            </div>
          </div>
        </div>

        {/* Colorful Glossy Stats Grid */}
        {profile.isGuest ? (
          <div className="ens-white-card" style={{ fontSize: 12.5, fontWeight: 700, color: '#d4dcff', lineHeight: 1.45 }}>
            Temporary guest sessions do not save permanent XP, rank points, or match stats. Full progression arrives with ENGG sign-in.
          </div>
        ) : (
          <div className="ens-stats-grid">
            <div className="ens-stat-card is-wins">
              <div className="ens-stat-val">{profile.wins}</div>
              <div className="ens-stat-label">Wins</div>
            </div>
            <div className="ens-stat-card is-losses">
              <div className="ens-stat-val">{profile.losses}</div>
              <div className="ens-stat-label">Losses</div>
            </div>
            <div className="ens-stat-card is-winrate">
              <div className="ens-stat-val">{winRate}%</div>
              <div className="ens-stat-label">Win Rate</div>
            </div>
          </div>
        )}

        {/* Edit Nickname & Avatar */}
        <form onSubmit={handleSaveProfile} className="ens-white-card" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div className="ens-section-heading" style={{ marginBottom: 0 }}>
            <UserCheck size={16} color="#a5f3fc" />
            <span>Nickname &amp; Avatar</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 7 }}>
            {AVATAR_OPTIONS.map((a) => {
              const selected = editAvatar === a;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setEditAvatar(a)}
                  aria-label={`Select ${a} avatar`}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'center',
                    transform: selected ? 'scale(1.08)' : 'scale(1)',
                    transition: 'transform 0.14s ease',
                    filter: selected ? 'drop-shadow(0 0 8px rgba(255, 213, 74, 0.72))' : 'none',
                  }}
                >
                  <AvatarBadge
                    avatarId={a}
                    size={40}
                    ringColor={selected ? '#FFD54A' : 'rgba(182, 194, 255, 0.5)'}
                  />
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={editUsername}
              onChange={(e) => {
                setEditUsername(e.target.value.slice(0, 20));
                if (saveError) setSaveError(null);
              }}
              maxLength={20}
              className="ens-fantasy-input"
              style={{ flex: 1, fontSize: 14, minHeight: 42 }}
            />
            <button type="submit" disabled={saving} className="ens-btn-purple" style={{ padding: '0 16px' }}>
              <Save size={15} />
              <span>Save</span>
            </button>
          </div>
          {saveError && (
            <div style={{ fontSize: 12, fontWeight: 700, color: '#ffb4c2' }} role="alert">
              {saveError}
            </div>
          )}
        </form>

        {/* Equipped Cosmetics */}
        <div className="ens-white-card">
          <div className="ens-section-heading">
            <Palette size={16} color="#f0abfc" />
            <span>Equipped Cosmetics</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            <label className="ens-cosmetic-label">
              <span>Tile Skin</span>
              <div className="ens-select-pill-wrap" style={{ width: '100%' }}>
                <select
                  value={profile.equippedCosmetics.tileSkin}
                  onChange={(e) =>
                    onUpdateCosmetics({ ...profile.equippedCosmetics, tileSkin: e.target.value })
                  }
                  className="ens-select-pill"
                  style={{ width: '100%', height: 38 }}
                >
                  <option value="classic_cream">Classic Frost</option>
                  <option value="royal_gold">Royal Gold</option>
                  <option value="mint_glow">Mint Glow</option>
                </select>
                <ChevronDown size={15} className="ens-select-chevron" aria-hidden="true" />
              </div>
            </label>
            <label className="ens-cosmetic-label">
              <span>Board Skin</span>
              <div className="ens-select-pill-wrap" style={{ width: '100%' }}>
                <select
                  value={profile.equippedCosmetics.boardSkin}
                  onChange={(e) =>
                    onUpdateCosmetics({ ...profile.equippedCosmetics, boardSkin: e.target.value })
                  }
                  className="ens-select-pill"
                  style={{ width: '100%', height: 38 }}
                >
                  <option value="royal_cosmos">Royal Cosmos</option>
                  <option value="fantasy_twilight">Fantasy Twilight</option>
                </select>
                <ChevronDown size={15} className="ens-select-chevron" aria-hidden="true" />
              </div>
            </label>
          </div>
        </div>

        {/* Match History */}
        <div className="ens-white-card">
          <div className="ens-section-heading">
            <History size={16} color="#a5f3fc" />
            <span>Match History ({matchHistory.length})</span>
          </div>
          {matchHistory.length === 0 ? (
            <div style={{ fontSize: 12.5, color: '#cdd6ff', fontWeight: 600 }}>
              Complete a match to see your history.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {matchHistory.slice(0, 8).map((h) => {
                const isLoss = !h.didWin && h.winnerId !== null && h.mode !== 'solo';
                return (
                  <div key={h.matchId} className="ens-history-row">
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: '#ffffff' }}>
                        vs {h.opponentNames.join(', ') || 'Solo'}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#c4ceff', marginTop: 1 }}>
                        {h.mode.replace('_', ' ').toUpperCase()}
                      </div>
                    </div>
                    <span
                      className={
                        h.didWin
                          ? 'ens-pill-ready'
                          : isLoss
                            ? 'ens-pill-loss'
                            : 'ens-pill-not-ready'
                      }
                    >
                      {h.didWin ? 'Won' : isLoss ? 'Loss' : 'Finished'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="ens-home-bottom-art" aria-hidden="true">
        <img src="/art/home-bottom-landscape.png" alt="" className="ens-home-bottom-img" />
      </div>
    </div>
  );
};
