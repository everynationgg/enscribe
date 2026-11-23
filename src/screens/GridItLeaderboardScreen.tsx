import React, { useEffect, useState } from 'react';
import { ArrowLeft, Award, Info, RefreshCw, Trophy } from 'lucide-react';
import { GridItSessionLeaderboardEntry } from '../../shared/gridit/multiplayerTypes';
import { AvatarBadge } from '../components/Artwork';
import { api } from '../services/api';

interface GridItLeaderboardScreenProps {
  isOffline: boolean;
  onBack: () => void;
}

export const GridItLeaderboardScreen: React.FC<GridItLeaderboardScreenProps> = ({
  isOffline,
  onBack,
}) => {
  const [entries, setEntries] = useState<GridItSessionLeaderboardEntry[]>([]);
  const [notice, setNotice] = useState<string>(
    'Guest sessions do not persist permanent global rankings until ENGG account login launches.'
  );
  const [loading, setLoading] = useState(true);

  const loadBoard = async () => {
    setLoading(true);
    try {
      const res = await api.getGridItLeaderboard();
      setEntries(res.entries);
      setNotice(res.guestNotice);
    } catch {
      // keep clean empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOffline) {
      loadBoard();
    } else {
      setLoading(false);
    }
  }, [isOffline]);

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
                <div className="ens-gridit-setup-title">GridIt Leaderboard</div>
                <div className="ens-gridit-setup-sub">
                  Active arena high scores &amp; Ranked foundations
                </div>
              </div>
            </div>

            <button
              type="button"
              className="ens-gridit-step-btn"
              onClick={loadBoard}
              disabled={isOffline}
              aria-label="Refresh leaderboard"
            >
              <RefreshCw size={15} />
            </button>
          </header>

          <div className="ens-gridit-fairness-badge">
            <Info size={16} color="#7dd3fc" style={{ flexShrink: 0 }} />
            <span>{notice}</span>
          </div>

          <section className="ens-gridit-setup-card">
            <div className="ens-gridit-setup-label">
              <Trophy size={15} color="#fde047" />
              <span>Live Session Leaders</span>
            </div>

            {loading ? (
              <div className="ens-gridit-empty-hint">Loading GridIt leaderboard...</div>
            ) : entries.length === 0 ? (
              <div className="ens-gridit-empty-hint" style={{ fontSize: 12.5, padding: '8px 2px' }}>
                No completed online GridIt matches recorded yet on this server instance. Finish a
                Multiplayer, Board Battle, or Ranked match to appear here!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {entries.map((e, idx) => (
                  <div key={e.playerId} className="ens-player-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <strong style={{ width: 20, color: '#fde047', fontSize: 14 }}>
                        #{idx + 1}
                      </strong>
                      <AvatarBadge avatarId={e.avatarId} size={32} />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 900, color: '#ffffff' }}>
                          {e.username}{' '}
                          {e.isGuest && (
                            <span style={{ fontSize: 10, color: '#bae6fd' }}>(Guest)</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#c7d2fe' }}>
                          {e.wins}W / {e.matchesPlayed}M
                          {e.bestWord ? ` • Best: ${e.bestWord}` : ''}
                        </div>
                      </div>
                    </div>
                    <span className="ens-pill-official">
                      <Award size={12} /> {e.highScore}
                    </span>
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
