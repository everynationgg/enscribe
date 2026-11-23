import React from 'react';
import { ArrowLeft, Crown, Globe, Loader2, ShieldCheck, Swords } from 'lucide-react';
import { PlayerSession } from '../../shared/types';

interface GridItRankedScreenProps {
  session: PlayerSession;
  rankedQueued: boolean;
  isOffline: boolean;
  onBack: () => void;
  onToggleQueue: () => void;
}

export const GridItRankedScreen: React.FC<GridItRankedScreenProps> = ({
  session,
  rankedQueued,
  isOffline,
  onBack,
  onToggleQueue,
}) => {
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
          <header className="ens-gridit-setup-header">
            <button
              type="button"
              className="ens-exit-hub-btn is-compact"
              onClick={onBack}
              aria-label="Back to GridIt Home"
            >
              <ArrowLeft size={15} strokeWidth={2.8} />
            </button>
            <div>
              <div className="ens-gridit-setup-title">GridIt — Ranked</div>
              <div className="ens-gridit-setup-sub">
                Standardized 1v1 competitive rules &amp; server anti-cheat
              </div>
            </div>
          </header>

          <section className="ens-gridit-setup-card">
            <div className="ens-gridit-setup-label">
              <Crown size={15} color="#fde047" fill="#fde047" />
              <span>Standardized Ranked Ruleset</span>
            </div>

            <div className="ens-gridit-quota-list">
              <div className="ens-gridit-quota-row is-met">
                <span>Board &amp; Duration</span>
                <strong>5×5 Square • 2:00</strong>
              </div>
              <div className="ens-gridit-quota-row is-met">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Globe size={13} /> Dictionary Language
                </span>
                <strong>English (Standardized)</strong>
              </div>
              <div className="ens-gridit-quota-row is-met">
                <span>Custom Boards &amp; Mods</span>
                <strong>Disabled for Fairness</strong>
              </div>
            </div>
          </section>

          <section className="ens-gridit-setup-card" style={{ gap: 7 }}>
            <div className="ens-gridit-setup-label">
              <ShieldCheck size={15} color="#4ade80" />
              <span>Account &amp; Rank Integrity</span>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#dbeafe', lineHeight: 1.45 }}>
              Signed in as <strong>{session.nickname}</strong> (Temporary Guest Session). You can
              queue live Ranked 1v1 matches immediately — permanent Ranked MMR &amp; season medals stay
              safely unrecorded until ENGG account login connects.
            </p>
          </section>

          <button
            type="button"
            className="ens-gridit-green-cta"
            disabled={isOffline}
            onClick={onToggleQueue}
          >
            {rankedQueued ? (
              <>
                <Loader2 size={18} className="ens-spin" />
                <span>Searching Ranked Opponent (Tap to Cancel)</span>
              </>
            ) : (
              <>
                <Swords size={18} />
                <span>Find Ranked 1v1 Match</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
