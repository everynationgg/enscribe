import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Profile } from '../../shared/types';
import { api } from '../services/api';
import { AvatarBadge } from '../components/Artwork';
import { FantasyPageHeader } from '../components/FantasyPageHeader';
import { GoldCrownIcon, PodiumCrownIcon } from '../components/GameIcons';

interface LeaderboardScreenProps {
  currentProfile: Profile;
  onBack: () => void;
}

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  currentProfile,
  onBack,
}) => {
  const [players, setPlayers] = useState<Profile[]>([currentProfile]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlayers = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listProfiles();
      const sorted = [...list].sort(
        (a, b) => b.rankPoints - a.rankPoints || b.wins - a.wins
      );
      setPlayers(sorted);
    } catch (err: any) {
      setError(err?.message || 'Could not load leaderboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlayers();
  }, []);

  const topThree = players.slice(0, 3);

  return (
    <div className="ens-fantasy-page ens-subpage-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <FantasyPageHeader
        title="Leaderboard"
        subtitle="Top players ranked by competitive RP and match wins."
        icon={<PodiumCrownIcon size={36} />}
        backdropSrc="/art/header-fantasy.png"
        onBack={onBack}
      />

      <div className="ens-subpage-scroll">
        <div className="ens-subpage-inner">
          {/* Top 3 Podium */}
          {topThree.length > 0 && (
            <div className="ens-lb-podium-card">
              <div className="ens-lb-podium-grid">
                {[topThree[1], topThree[0], topThree[2]].map((p, slotIdx) => {
                  if (!p) return <div key={slotIdx} className="ens-lb-podium-empty" />;
                  const rank = slotIdx === 1 ? 1 : slotIdx === 0 ? 2 : 3;
                  return (
                    <div
                      key={p.id}
                      className={`ens-lb-podium-slot is-rank-${rank}`}
                    >
                      {rank === 1 && (
                        <div className="ens-lb-first-crown">
                          <GoldCrownIcon size={22} />
                        </div>
                      )}
                      <AvatarBadge
                        avatarId={p.avatarId}
                        size={rank === 1 ? 54 : 44}
                        ringColor={rank === 1 ? '#FFD54A' : '#B7C8FF'}
                      />
                      <div className="ens-lb-podium-name">{p.username}</div>
                      <div className="ens-lb-podium-rp">
                        {p.rankPoints.toLocaleString()} RP
                      </div>
                      <div className="ens-lb-pedestal">#{rank}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Header Strip */}
          <div className="ens-lb-list-head">
            <span>All Ranked Players ({players.length})</span>
            <button
              type="button"
              className="ens-filter-refresh-btn"
              onClick={loadPlayers}
              aria-label="Refresh leaderboard"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          {error && (
            <div className="ens-coming-soon-card" style={{ padding: 14 }}>
              <div className="ens-coming-sub">{error}</div>
            </div>
          )}

          {loading && players.length <= 1 ? (
            <div className="ens-coming-soon-card" style={{ padding: 18 }}>
              <div className="ens-coming-sub">Loading rankings...</div>
            </div>
          ) : (
            <div className="ens-lb-rows">
              {players.map((p, idx) => {
                const isSelf = p.id === currentProfile.id;
                return (
                  <div
                    key={p.id}
                    className={`ens-lb-row ${isSelf ? 'is-self' : ''}`}
                  >
                    <div className="ens-lb-rank-num">#{idx + 1}</div>
                    <AvatarBadge avatarId={p.avatarId} size={38} />
                    <div className="ens-lb-player-meta">
                      <div className="ens-lb-player-name">
                        <span>{p.username}</span>
                        {isSelf && <span className="ens-lb-you-pill">You</span>}
                      </div>
                      <div className="ens-lb-player-tier">
                        {p.rankTier} • {p.wins}W – {p.losses}L
                      </div>
                    </div>
                    <div className="ens-lb-rp-pill">
                      <GoldCrownIcon size={14} />
                      <span>{p.rankPoints.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
