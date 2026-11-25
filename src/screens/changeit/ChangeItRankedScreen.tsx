import React, { useState } from 'react';
import {
  ArrowLeft,
  Award,
  Crown,
  Loader2,
  ShieldCheck,
  Swords,
  Target,
  Zap,
} from 'lucide-react';
import { ChangeItLeaderboardEntry, PlayerSession } from '../../../shared/types';

interface ChangeItRankedScreenProps {
  session: PlayerSession;
  playerStats: ChangeItLeaderboardEntry | null;
  queuedFormat: 'classic_sprint' | 'classic_precision' | null;
  isOffline: boolean;
  onBack: () => void;
  onJoinQueue: (format: 'classic_sprint' | 'classic_precision') => Promise<void>;
  onLeaveQueue: () => Promise<void>;
}

export const ChangeItRankedScreen: React.FC<ChangeItRankedScreenProps> = ({
  session,
  playerStats,
  queuedFormat,
  isOffline,
  onBack,
  onJoinQueue,
  onLeaveQueue,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'classic_sprint' | 'classic_precision'>(
    queuedFormat ?? 'classic_sprint'
  );
  const [busy, setBusy] = useState(false);

  const rating = playerStats?.rating ?? 1000;
  const tier = playerStats?.rankTier ?? 'Silver II';

  const handleToggle = async () => {
    if (busy || isOffline) return;
    setBusy(true);
    try {
      if (queuedFormat) {
        await onLeaveQueue();
      } else {
        await onJoinQueue(selectedFormat);
      }
    } finally {
      setBusy(false);
    }
  };

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
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 900 }}>ChangeIt Ranked</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#a5f3fc' }}>
            Classic Skill-Based 1v1 Competition
          </div>
        </div>
        <div style={{ width: 36 }} />
      </header>

      <div className="ci-scroll">
        <div className="ci-wrap">
          {/* Player Rating Card */}
          <div className="ci-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: '#93c5fd' }}>
                {session.nickname} • Current Standing
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3 }}>
                <Crown size={18} color="#fde047" fill="#fde047" />
                <span style={{ fontSize: 18, fontWeight: 900 }}>{tier}</span>
                <span className="ci-pill is-cyan">{rating} RP</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#dbeafe' }}>
              <div>
                {playerStats?.rankedWins ?? 0}W / {playerStats?.rankedLosses ?? 0}L /{' '}
                {playerStats?.rankedDraws ?? 0}D
              </div>
              <div style={{ fontSize: 11, color: '#6ee7b7' }}>
                Best Eff: {playerStats?.bestEfficiency ?? 0}%
              </div>
            </div>
          </div>

          {/* Ranked Format Selector */}
          <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="ci-card-title">
              <span>Select Ranked Format</span>
              <Award size={15} color="#fde047" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                disabled={Boolean(queuedFormat)}
                onClick={() => setSelectedFormat('classic_sprint')}
                style={{
                  textAlign: 'left',
                  padding: 11,
                  borderRadius: 15,
                  border:
                    selectedFormat === 'classic_sprint'
                      ? '2px solid #22d3ee'
                      : '1.5px solid rgba(148, 163, 184, 0.35)',
                  background:
                    selectedFormat === 'classic_sprint'
                      ? 'rgba(8, 145, 178, 0.34)'
                      : 'rgba(15, 23, 84, 0.72)',
                  color: '#ffffff',
                  cursor: queuedFormat ? 'not-allowed' : 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 900, fontSize: 14 }}>
                  <Zap size={15} color="#22d3ee" />
                  <span>Sprint</span>
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#cbd5e1', marginTop: 4 }}>
                  Identical puzzle. First player to reach target wins immediately.
                </div>
              </button>

              <button
                type="button"
                disabled={Boolean(queuedFormat)}
                onClick={() => setSelectedFormat('classic_precision')}
                style={{
                  textAlign: 'left',
                  padding: 11,
                  borderRadius: 15,
                  border:
                    selectedFormat === 'classic_precision'
                      ? '2px solid #a855f7'
                      : '1.5px solid rgba(148, 163, 184, 0.35)',
                  background:
                    selectedFormat === 'classic_precision'
                      ? 'rgba(126, 34, 206, 0.34)'
                      : 'rgba(15, 23, 84, 0.72)',
                  color: '#ffffff',
                  cursor: queuedFormat ? 'not-allowed' : 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 900, fontSize: 14 }}>
                  <Target size={15} color="#c084fc" />
                  <span>Precision</span>
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#cbd5e1', marginTop: 4 }}>
                  Shared clock. Fewest valid transformations wins; time breaks ties.
                </div>
              </button>
            </div>
          </div>

          {/* Competitive Integrity Rules */}
          <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="ci-card-title">
              <span>Competitive Integrity Rules</span>
              <ShieldCheck size={15} color="#4ade80" />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#dbeafe', lineHeight: 1.5 }}>
              • System-verified familiar puzzles only (no custom words).
              <br />
              • Gameplay modifiers &amp; hints are disabled in Ranked.
              <br />
              • Opponent solution chains stay hidden until match end.
              <br />• Server-authoritative timer, validation &amp; Elo RP rating.
            </div>
          </div>

          <button
            type="button"
            className="ci-cta-cyan"
            disabled={isOffline || busy}
            onClick={handleToggle}
          >
            {queuedFormat ? (
              <>
                <Loader2 size={18} className="ens-spin" />
                <span>
                  Searching {queuedFormat === 'classic_sprint' ? 'Sprint' : 'Precision'} Match (Tap
                  to Cancel)
                </span>
              </>
            ) : (
              <>
                <Swords size={18} />
                <span>
                  Find Ranked {selectedFormat === 'classic_sprint' ? 'Sprint' : 'Precision'} Match
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
