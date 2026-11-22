import React, { useState } from 'react';
import { Award, Check, Coins, Crown, History, Palette, Plus, UserCheck } from 'lucide-react';
import { EquippedCosmetics, MatchHistorySummary, Profile } from '../../shared/types';
import { AvatarBadge } from '../components/Artwork';

interface ProfileScreenProps {
  profile: Profile;
  allProfiles: Profile[];
  matchHistory: MatchHistorySummary[];
  onSwitchProfile: (playerId: string) => void;
  onCreateProfile: (username: string, avatarId: string) => Promise<void>;
  onUpdateCosmetics: (cosmetics: EquippedCosmetics) => Promise<void>;
}

const AVATAR_OPTIONS = ['alex', 'novarex', 'pixelmochi', 'leafy', 'spark', 'knight'];

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  profile,
  allProfiles,
  matchHistory,
  onSwitchProfile,
  onCreateProfile,
  onUpdateCosmetics,
}) => {
  const [newUsername, setNewUsername] = useState('');
  const [newAvatar, setNewAvatar] = useState('spark');

  const winRate =
    profile.wins + profile.losses > 0
      ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
      : 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    await onCreateProfile(newUsername.trim(), newAvatar);
    setNewUsername('');
  };

  return (
    <div className="ens-sheet-screen" style={{ flex: 1, minHeight: 0 }}>
      <header className="ens-royal-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserCheck size={20} color="#7dd3fc" />
          <span style={{ fontSize: 18, fontWeight: 800 }}>Player Profile</span>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#c7d5ff' }}>
          Local Dev Session
        </span>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#ffd34e' }}>
                <Crown size={14} fill="#ffd34e" />
                <span>{profile.rankTier} • {profile.rankPoints} RP</span>
              </div>
              <div style={{ fontSize: 11.5, color: '#c7d5ff', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Coins size={12} color="#fde047" />
                <span>{profile.matchPointsBalance} Match Points (Currency Hook)</span>
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

        {/* Local Dev Multi-User Switcher */}
        <div className="ens-white-card">
          <div className="ens-section-heading">
            <Award size={15} color="#5b3df5" />
            <span>Switch Local Test Account (Per Browser Tab)</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#647096', fontWeight: 600, marginBottom: 8 }}>
            Open a second browser tab and pick another profile (e.g., NovaRex) to test real-time 2-player multiplayer locally!
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {allProfiles.map((p) => {
              const active = p.id === profile.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSwitchProfile(p.id)}
                  style={{
                    border: active ? '2px solid #5b3df5' : '1px solid #d7ddf2',
                    borderRadius: 12,
                    padding: '7px 9px',
                    background: active ? '#eee9ff' : '#f8f9fe',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <AvatarBadge avatarId={p.avatarId} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#17204d' }}>{p.username}</div>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#647096' }}>{p.rankTier}</div>
                  </div>
                  {active && <Check size={15} color="#5b3df5" strokeWidth={3} />}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleCreate} style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="New guest name..."
              className="ens-word-input"
              style={{ flex: 1, textTransform: 'none', fontSize: 12.5 }}
            />
            <select
              value={newAvatar}
              onChange={(e) => setNewAvatar(e.target.value)}
              style={{ borderRadius: 9, border: '1px solid #cbd5e1', padding: '7px 6px', fontSize: 12, fontWeight: 700 }}
            >
              {AVATAR_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <button type="submit" className="ens-btn-purple" style={{ padding: '7px 11px' }}>
              <Plus size={15} />
            </button>
          </form>
        </div>

        {/* Cosmetics Preview */}
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
