import React, { useEffect, useState } from 'react';
import { ArrowLeft, Award, Crown, History, RefreshCw, Trophy, Zap } from 'lucide-react';
import { ChangeItLeaderboardResponse, PlayerSession } from '../../../shared/types';
import { AvatarBadge } from '../../components/Artwork';
import { api } from '../../services/api';

interface ChangeItLeaderboardScreenProps {
  session: PlayerSession;
  isOffline: boolean;
  onBack: () => void;
}

export const ChangeItLeaderboardScreen: React.FC<ChangeItLeaderboardScreenProps> = ({
  session,
  isOffline,
  onBack,
}) => {
  const [data, setData] = useState<ChangeItLeaderboardResponse | null>(null);
  const [tab, setTab] = useState<'ranked' | 'overall' | 'history'>('ranked');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getChangeItLeaderboard(session.playerId);
      setData(res);
    } catch {
      // keep clean empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOffline) {
      load();
    } else {
      setLoading(false);
    }
  }, [isOffline]);

  const list =
    tab === 'ranked' ? data?.rankedLeaders ?? [] : data?.overallLeaders ?? [];

  return (
    <div className="ci-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />
      <header className="ci-topbar">
        <button
          type="button"
          className="ci-icon-btn"
          onClick={onBack}
          aria-label="Back to ChangeIt"
        >
          <ArrowLeft size={18} strokeWidth={2.8} />
        </button>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <Trophy size={18} color="#fde047" />
          <span style={{ fontSize: 17, fontWeight: 900 }}>ChangeIt Leaderboard</span>
        </div>
        <button
          type="button"
          className="ci-icon-btn"
          onClick={load}
          disabled={isOffline}
          aria-label="Refresh leaderboard"
        >
          <RefreshCw size={15} />
        </button>
      </header>

      <div className="ci-scroll">
        <div className="ci-wrap">
          {data?.guestNotice && (
            <div className="ci-card" style={{ fontSize: 12, fontWeight: 700, color: '#bae6fd' }}>
              {data.guestNotice}
            </div>
          )}

          {/* Switch Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            <button
              type="button"
              onClick={() => setTab('ranked')}
              className={`ci-pill ${tab === 'ranked' ? 'is-cyan' : ''}`}
              style={{ justifyContent: 'center', padding: '8px 6px', cursor: 'pointer' }}
            >
              <Crown size={13} />
              <span>Ranked</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('overall')}
              className={`ci-pill ${tab === 'overall' ? 'is-green' : ''}`}
              style={{ justifyContent: 'center', padding: '8px 6px', cursor: 'pointer' }}
            >
              <Zap size={13} />
              <span>Top Solvers</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              className={`ci-pill ${tab === 'history' ? 'is-violet' : ''}`}
              style={{ justifyContent: 'center', padding: '8px 6px', cursor: 'pointer' }}
            >
              <History size={13} />
              <span>My History</span>
            </button>
          </div>

          {loading ? (
            <div className="ci-card" style={{ textAlign: 'center', fontWeight: 800, color: '#bae6fd' }}>
              Loading ChangeIt standings...
            </div>
          ) : tab === 'history' ? (
            <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="ci-card-title">
                <span>Recent ChangeIt Matches</span>
                <History size={14} />
              </div>
              {(data?.recentHistory.length ?? 0) === 0 ? (
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#cbd5e1' }}>
                  No finished multiplayer ChangeIt matches recorded yet.
                </div>
              ) : (
                data!.recentHistory.map((h) => (
                  <div
                    key={h.matchId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 12,
                      background: 'rgba(10, 20, 76, 0.72)',
                      border: '1px solid rgba(148, 163, 184, 0.25)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 900 }}>
                        vs {h.opponentNames.join(', ') || 'Rivals'}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd' }}>
                        {h.mode.replace('_', ' ').toUpperCase()}
                        {h.isRanked ? ' • RANKED' : ''}
                      </div>
                    </div>
                    <span className={`ci-pill ${h.didWin ? 'is-green' : 'is-amber'}`}>
                      {h.didWin ? 'WIN' : h.winnerIds.length === 0 ? 'DRAW' : 'LOSS'}
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="ci-card-title">
                <span>{tab === 'ranked' ? 'Ranked Rating Leaders' : 'Most Puzzles Solved'}</span>
                <Award size={14} color="#fde047" />
              </div>
              {list.length === 0 ? (
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#cbd5e1' }}>
                  Complete a Ranked or Multiplayer ChangeIt match to claim the #1 spot!
                </div>
              ) : (
                list.map((e, idx) => (
                  <div
                    key={e.playerId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 12,
                      background:
                        e.playerId === session.playerId
                          ? 'rgba(8, 145, 178, 0.28)'
                          : 'rgba(10, 20, 76, 0.72)',
                      border: '1px solid rgba(103, 232, 249, 0.25)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <strong style={{ width: 22, color: '#fde047' }}>#{idx + 1}</strong>
                      <AvatarBadge avatarId={e.avatarId} size={32} />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 900 }}>
                          {e.username} {e.playerId === session.playerId ? '(You)' : ''}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd' }}>
                          {e.rankTier} • {e.rankedWins}W-{e.rankedLosses}L • {e.puzzlesSolved} solved
                        </div>
                      </div>
                    </div>
                    <span className="ci-pill is-cyan">
                      {tab === 'ranked' ? `${e.rating} RP` : `${e.puzzlesSolved} solved`}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
