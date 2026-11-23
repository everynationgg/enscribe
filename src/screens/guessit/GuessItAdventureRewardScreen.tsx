import React from 'react';
import {
  ChevronLeft,
  Clapperboard,
  Coins,
  Gem,
  Star,
} from 'lucide-react';
import { GuessItAdventureClaimResult } from '../../../shared/guessit/types';
import { GuessItChestHeroArt } from '../../games/guessit/GuessItMascot';

interface GuessItAdventureRewardScreenProps {
  claimResult: GuessItAdventureClaimResult;
  chapterTitle: string;
  onContinue: () => void;
}

export const GuessItAdventureRewardScreen: React.FC<GuessItAdventureRewardScreenProps> = ({
  claimResult,
  chapterTitle,
  onContinue,
}) => {
  const pct =
    claimResult.chapterTotalStages > 0
      ? Math.round(
          (claimResult.chapterCompletedCount / claimResult.chapterTotalStages) * 100
        )
      : 0;

  return (
    <div className="ens-guessit-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <header className="ens-guessit-topbar">
        <button
          type="button"
          className="ens-guessit-circle-btn"
          onClick={onContinue}
          aria-label="Back to Adventure Map"
        >
          <ChevronLeft size={22} strokeWidth={2.8} />
        </button>

        <div className="ens-guessit-screen-title-wordmark" style={{ fontSize: 22 }}>
          Adventure Reward
        </div>

        <div style={{ width: 38 }} />
      </header>

      <div className="ens-guessit-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <GuessItChestHeroArt />

        {claimResult.alreadyClaimed && (
          <div
            style={{
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 800,
              color: '#bae6fd',
              background: 'rgba(18, 28, 96, 0.78)',
              padding: '5px 10px',
              borderRadius: 10,
              border: '1px solid rgba(125, 211, 252, 0.4)',
            }}
          >
            Stage reward already claimed earlier — replay stars updated cleanly!
          </div>
        )}

        {/* Three Reward Cards matching Screen 8 */}
        <div className="ens-guessit-reward-grid">
          <div className="ens-guessit-reward-tile">
            <Star size={32} color="#fde047" fill="#fde047" />
            <div className="ens-guessit-reward-val">+{claimResult.expAwarded}</div>
            <div className="ens-guessit-reward-label">EXP</div>
          </div>

          <div className="ens-guessit-reward-tile">
            <Coins size={32} color="#fbbf24" />
            <div className="ens-guessit-reward-val">+{claimResult.coinsAwarded}</div>
            <div className="ens-guessit-reward-label">Coins</div>
          </div>

          <div className="ens-guessit-reward-tile">
            <Gem size={32} color="#c084fc" fill="rgba(192, 132, 252, 0.35)" />
            <div className="ens-guessit-reward-val">+{claimResult.shardsAwarded}</div>
            <div className="ens-guessit-reward-label">Shards</div>
          </div>
        </div>

        {/* Adventure Progress Card matching Screen 8 */}
        <div className="ens-guessit-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 900, textAlign: 'center', color: '#ffffff' }}>
            Adventure Progress
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'rgba(139, 92, 246, 0.35)',
                border: '1.5px solid rgba(196, 184, 255, 0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Clapperboard size={20} color="#e9d5ff" />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 900, color: '#ffffff', marginBottom: 5 }}>
                {chapterTitle}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="ens-guessit-progress-bar-track" role="progressbar" aria-valuenow={pct}>
                  <div
                    className="ens-guessit-progress-bar-fill"
                    style={{ width: `${Math.max(8, pct)}%` }}
                  />
                </div>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#dbeafe' }}>
                  {claimResult.chapterCompletedCount}/{claimResult.chapterTotalStages}
                </span>
              </div>
            </div>
          </div>
        </div>

        <button type="button" className="ens-guessit-gold-btn" onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
};
