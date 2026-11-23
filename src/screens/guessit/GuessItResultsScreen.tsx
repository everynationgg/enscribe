import React from 'react';
import {
  Award,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Crown,
  Percent,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { GuessItMatchStateClient } from '../../../shared/guessit/types';
import { AvatarBadge } from '../../components/Artwork';

interface GuessItResultsScreenProps {
  match: GuessItMatchStateClient;
  onPlayAgain: () => Promise<void>;
  onBackToLobby: () => void;
}

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export const GuessItResultsScreen: React.FC<GuessItResultsScreenProps> = ({
  match,
  onPlayAgain,
  onBackToLobby,
}) => {
  const [rematchBusy, setRematchBusy] = React.useState(false);

  const me = match.participants[match.viewerPlayerId];
  const didWin = match.winnerIds.includes(match.viewerPlayerId);
  const isDraw = match.winnerIds.length === 0;

  const isTeamRelay = match.mode === 'team_relay';
  const bluePlayers = match.participantOrder
    .map((id) => match.participants[id])
    .filter((p) => p?.teamId === 'blue');
  const redPlayers = match.participantOrder
    .map((id) => match.participants[id])
    .filter((p) => p?.teamId === 'red');

  const opp = match.participantOrder
    .map((id) => match.participants[id])
    .find((p) => p && p.playerId !== match.viewerPlayerId);

  const lastSummary = match.roundSummaries[match.roundSummaries.length - 1];
  const roundEndedAtMs = Math.min(
    lastSummary?.endedAtMs ?? match.roundEndsAtMs,
    match.roundEndsAtMs
  );
  const timedOut = roundEndedAtMs >= match.roundEndsAtMs;
  const roundTimeMs = me?.completionTimeMs ?? Math.max(0, roundEndedAtMs - match.roundStartedAtMs);
  const correctCount = me?.correctLetters.length ?? 0;
  const wrongCount = me?.wrongCount ?? 0;
  const accuracy = me?.accuracyPercent ?? 100;

  const winnerTitle = isTeamRelay
    ? match.winningTeamId === 'blue'
      ? 'Team Blue Wins!'
      : match.winningTeamId === 'red'
        ? 'Team Red Wins!'
        : 'Draw Match!'
    : didWin
      ? `${me?.username || 'You'} Wins!`
      : isDraw
        ? timedOut
          ? 'Time Up — Draw!'
          : 'Nobody Solved It — Draw!'
        : `${match.winnerIds.map((id) => match.participants[id]?.username).filter(Boolean).join(', ')} Wins!`;

  return (
    <div className="ens-guessit-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <header className="ens-guessit-topbar">
        <button
          type="button"
          className="ens-guessit-circle-btn"
          onClick={onBackToLobby}
          aria-label="Back to Lobby"
        >
          <ChevronLeft size={22} strokeWidth={2.8} />
        </button>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 900 }}>
          <Award size={18} color="#fde047" />
          <span>Match Results</span>
        </div>

        <div style={{ width: 38 }} />
      </header>

      <div className="ens-guessit-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Victory Crown Header matching Screen 7 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center', marginTop: 4 }}>
          <Crown size={36} color="#fde047" fill="#fde047" />
          <div className="ens-guessit-victory-title">
            {didWin ? 'Victory!' : isDraw ? 'Draw!' : 'Finished!'}
          </div>
          <div className="ens-guessit-winner-banner">{winnerTitle}</div>
        </div>

        {/* Team Blue vs Team Red OR 1v1 Score Cards */}
        {isTeamRelay ? (
          <div className="ens-guessit-score-cards">
            <div className="ens-guessit-result-card is-blue">
              <div style={{ fontSize: 14, fontWeight: 900, color: '#bae6fd' }}>Team Blue</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {bluePlayers.map((p) => (
                  <AvatarBadge key={p.playerId} avatarId={p.avatarId} size={34} ringColor="#38bdf8" />
                ))}
              </div>
              <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1 }}>
                {match.teamScores.blue}
              </div>
            </div>

            <div className="ens-guessit-vs-badge">vs</div>

            <div className="ens-guessit-result-card is-pink">
              <div style={{ fontSize: 14, fontWeight: 900, color: '#fbcfe8' }}>Team Red</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {redPlayers.map((p) => (
                  <AvatarBadge key={p.playerId} avatarId={p.avatarId} size={34} ringColor="#f472b6" />
                ))}
              </div>
              <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1 }}>
                {match.teamScores.red}
              </div>
            </div>
          </div>
        ) : match.mode === 'survival_royale' ? (
          <div className="ens-guessit-glass-card">
            <div style={{ fontSize: 13, fontWeight: 900, color: '#fde047', marginBottom: 6 }}>
              Survival Standings
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {match.participantOrder
                .map((id) => match.participants[id])
                .sort((a, b) => Number(b.isWinner) - Number(a.isWinner) || b.score - a.score)
                .map((p, idx) => (
                  <div
                    key={p.playerId}
                    className="ens-guessit-member-pill"
                    style={{ justifyContent: 'space-between', padding: '7px 10px' }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <strong>#{idx + 1}</strong>
                      <AvatarBadge avatarId={p.avatarId} size={26} />
                      <span>{p.username}</span>
                    </span>
                    <span style={{ color: p.isWinner ? '#fde047' : '#dbeafe' }}>
                      {p.isWinner ? '👑 Survivor' : `${p.score} pts`}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <div className="ens-guessit-score-cards">
            <div className="ens-guessit-result-card is-blue">
              <div style={{ fontSize: 13, fontWeight: 900, color: '#bae6fd' }}>
                {me?.username || 'You'}
              </div>
              <AvatarBadge avatarId={me?.avatarId || 'alex'} size={38} ringColor="#38bdf8" />
              <div style={{ fontSize: 28, fontWeight: 900 }}>{me?.score ?? 0}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#bae6fd' }}>
                Rounds: {me?.roundsWon ?? 0}
              </div>
            </div>

            <div className="ens-guessit-vs-badge">vs</div>

            <div className="ens-guessit-result-card is-pink">
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fbcfe8' }}>
                {opp?.username || 'Solo'}
              </div>
              <AvatarBadge avatarId={opp?.avatarId || 'novarex'} size={38} ringColor="#f472b6" />
              <div style={{ fontSize: 28, fontWeight: 900 }}>{opp?.score ?? 0}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#fbcfe8' }}>
                Rounds: {opp?.roundsWon ?? 0}
              </div>
            </div>
          </div>
        )}

        {/* Revealed Answer Summary (shown only once round/match is over) */}
        {lastSummary && lastSummary.revealedAnswers.length > 0 && (
          <div className="ens-guessit-glass-card" style={{ textAlign: 'center', padding: '9px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#a5b4fc' }}>Revealed Answer(s)</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fef08a', letterSpacing: '0.06em', marginTop: 2 }}>
              {lastSummary.revealedAnswers.join('  •  ')}
            </div>
          </div>
        )}

        {/* Stats Breakdown Card matching Screen 7 */}
        <div className="ens-guessit-glass-card">
          <div className="ens-guessit-setting-row">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#dbeafe' }}>
              <Clock size={15} color="#7dd3fc" /> Round Time
            </span>
            <span>{formatDuration(roundTimeMs)}</span>
          </div>
          <div className="ens-guessit-setting-row">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#dbeafe' }}>
              <CheckCircle2 size={15} color="#4ade80" /> Correct Guesses
            </span>
            <span>{correctCount}</span>
          </div>
          <div className="ens-guessit-setting-row">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#dbeafe' }}>
              <XCircle size={15} color="#fb7185" /> Wrong Guesses
            </span>
            <span>{wrongCount}</span>
          </div>
          <div className="ens-guessit-setting-row">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#dbeafe' }}>
              <Percent size={15} color="#c084fc" /> Accuracy
            </span>
            <span>{accuracy}%</span>
          </div>
        </div>

        <button
          type="button"
          className="ens-guessit-gold-btn"
          disabled={rematchBusy}
          onClick={async () => {
            setRematchBusy(true);
            try {
              await onPlayAgain();
            } finally {
              setRematchBusy(false);
            }
          }}
        >
          <RotateCcw size={18} />
          <span>{rematchBusy ? 'Starting...' : 'Play Again'}</span>
        </button>

        <button
          type="button"
          onClick={onBackToLobby}
          style={{
            width: '100%',
            minHeight: 46,
            borderRadius: 16,
            border: '1.5px solid rgba(196, 184, 255, 0.7)',
            background: 'linear-gradient(180deg, #8b5cf6 0%, #5b21b6 100%)',
            color: '#ffffff',
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          {match.roomId ? 'Back to Lobby' : 'Back to Modes'}
        </button>
      </div>
    </div>
  );
};
