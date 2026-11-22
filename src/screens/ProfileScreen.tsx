import React, { useState } from 'react';
import { Crown, History, LogOut, Palette, Save, UserCheck } from 'lucide-react';
import { EquippedCosmetics, MatchHistorySummary, Profile } from '../../shared/types';
import { AvatarBadge } from '../components/Artwork';

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

  const winRate =
    profile.wins + profile.losses > 0
      ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
      : 0;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editUsername.trim().length < 2) return;
    setSaving(true);
    try {
      await onUpdateProfile({ username: editUsername.trim(), avatarId: editAvatar });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ens-sheet-screen" style={{ flex: 1, minHeight: 0 }}>
      <header className="ens-royal-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserCheck size={20} color="#7dd3fc" />
          <span style={{ fontSize: 18, fontWeight: 800 }}>Player Profile</span>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          style={{
            border: 'none',
            borderRadius: 999,
            padding: '5px 12px',
            background: 'rgba(255, 255, 255, 0.14)',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            cursor: 'pointer',
          }}
        >
          <LogOut size={13} />
          <span>Sign Out</span>
        </button>
      </header>

      <div className="ens-sheet-body">
        {/* Active Profile Hero Card */}
        <div
          className="ens-white-card"
          style={{
            background: 'linear-gradient(135deg, #1b2d86 0%, #432b9b 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AvatarBadge avatarId={profile.avatarId} size={56} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 800 }}>{profile.username}</div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#ffd34e',
                }}
              >
                <Crown size={14} fill="#ffd34e" />
                <span>
                  {profile.rankTier} • {profile.rankPoints} RP
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#c7d5ff', marginTop: 3, fontWeight: 600 }}>
                Player ID: <span style={{ fontFamily: 'monospace' }}>{profile.id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <div className="ens-white-card" style={{ textAlign: 'center', padding: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0ea359' }}>{profile.wins}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#5d678c' }}>Wins</div>
          </div>
          <div className="ens-white-card" style={{ textAlign: 'center', padding: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#e12d4f' }}>{profile.losses}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#5d678c' }}>Losses</div>
          </div>
          <div className="ens-white-card" style={{ textAlign: 'center', padding: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#5b3df5' }}>{winRate}%</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#5d678c' }}>Win Rate</div>
          </div>
        </div>

        {/* Edit Nickname & Avatar */}
        <form onSubmit={handleSaveProfile} className="ens-white-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="ens-section-heading" style={{ marginBottom: 0 }}>
            <UserCheck size={15} color="#5b3df5" />
            <span>Nickname &amp; Avatar</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
            {AVATAR_OPTIONS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setEditAvatar(a)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <AvatarBadge
                  avatarId={a}
                  size={38}
                  ringColor={editAvatar === a ? '#5b3df5' : 'rgba(200, 210, 240, 0.7)'}
                />
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value.slice(0, 20))}
              maxLength={20}
              className="ens-word-input"
              style={{ flex: 1, textTransform: 'none', fontSize: 13 }}
            />
            <button type="submit" disabled={saving} className="ens-btn-purple" style={{ padding: '0 14px' }}>
              <Save size={14} />
              <span>Save</span>
            </button>
          </div>
        </form>

        {/* Cosmetics */}
        <div className="ens-white-card">
          <div className="ens-section-heading">
            <Palette size={15} color="#5b3df5" />
            <span>Equipped Cosmetics</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, fontSize: 12, fontWeight: 700 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              Tile Skin
              <select
                value={profile.equippedCosmetics.tileSkin}
                onChange={(e) =>
                  onUpdateCosmetics({ ...profile.equippedCosmetics, tileSkin: e.target.value })
                }
                style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #cbd5e1', fontWeight: 700 }}
              >
                <option value="classic_cream">Classic Frost</option>
                <option value="royal_gold">Royal Gold</option>
                <option value="mint_glow">Mint Glow</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              Board Skin
              <select
                value={profile.equippedCosmetics.boardSkin}
                onChange={(e) =>
                  onUpdateCosmetics({ ...profile.equippedCosmetics, boardSkin: e.target.value })
                }
                style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #cbd5e1', fontWeight: 700 }}
              >
                <option value="royal_cosmos">Royal Cosmos</option>
                <option value="fantasy_twilight">Fantasy Twilight</option>
              </select>
            </label>
          </div>
        </div>

        {/* Match History */}
        <div className="ens-white-card">
          <div className="ens-section-heading">
            <History size={15} color="#5b3df5" />
            <span>Match History ({matchHistory.length})</span>
          </div>
          {matchHistory.length === 0 ? (
            <div style={{ fontSize: 12, color: '#647096' }}>Complete a match to see your history.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {matchHistory.slice(0, 8).map((h) => (
                <div
                  key={h.matchId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    borderRadius: 10,
                    background: '#f5f6fc',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <div>
                    <div>vs {h.opponentNames.join(', ') || 'Solo'}</div>
                    <div style={{ fontSize: 10.5, color: '#647096' }}>{h.mode.toUpperCase()}</div>
                  </div>
                  <span className={h.didWin ? 'ens-pill-ready' : 'ens-pill-not-ready'}>
                    {h.didWin ? 'Won' : 'Finished'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
