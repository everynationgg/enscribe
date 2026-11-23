import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Crown,
  Eye,
  Flag,
  Languages,
  Loader2,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { getBoardSnapshotAtTime } from '../../shared/gridit/mods';
import { GridItMatchStateClient } from '../../shared/gridit/multiplayerTypes';
import { getShapeTemplate } from '../../shared/gridit/shapes';
import { PlayerSession } from '../../shared/types';
import { AvatarBadge } from '../components/Artwork';
import { GridItDefinitionModal } from '../components/GridItDefinitionModal';
import { GridItBoardCanvas } from '../games/gridit/GridItBoardCanvas';
import { fetchWordDefinition } from '../games/gridit/dictionary';
import { api } from '../services/api';

interface GridItMultiplayerGameplayScreenProps {
  match: GridItMatchStateClient;
  session: PlayerSession;
  onExitToHub: () => void;
  onReturnToRoom: (roomId: string) => void;
  onSwitchSpectatePlayer: (playerId: string) => void;
  onSubmitWord: (tilePath: string[]) => Promise<{ valid: boolean; message: string }>;
  onSendChat: (text: string, kind: 'chat' | 'emoji') => Promise<void>;
  onFinishEarly: () => Promise<void>;
  onRematch: () => Promise<void>;
  onNotify: (msg: string) => void;
}

const QUICK_EMOJIS = ['🔥', '⚡', '👏', '😮', '🎉'];

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const GridItMultiplayerGameplayScreen: React.FC<GridItMultiplayerGameplayScreenProps> = ({
  match,
  session,
  onExitToHub,
  onReturnToRoom,
  onSwitchSpectatePlayer,
  onSubmitWord,
  onSendChat,
  onFinishEarly,
  onRematch,
  onNotify,
}) => {
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const clockOffsetRef = useRef<number>(match.serverNowMs - Date.now());
  const [feedback, setFeedback] = useState<{ text: string; tone: 'ok' | 'err' | 'info' } | null>(
    null
  );
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [translatedById, setTranslatedById] = useState<Record<string, string>>({});
  const [definitionWord, setDefinitionWord] = useState<string | null>(null);
  const [bestDefPreview, setBestDefPreview] = useState<string | null>(null);

  useEffect(() => {
    clockOffsetRef.current = match.serverNowMs - Date.now();
  }, [match.serverNowMs]);

  useEffect(() => {
    if (match.status === 'finished') return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [match.status]);

  const liveServerNow = nowMs + clockOffsetRef.current;
  const isSpectator = match.viewerRole === 'spectator';
  const focusPlayerId = isSpectator
    ? (match.spectatingPlayerId ?? Object.keys(match.players)[0])
    : session.playerId;
  const myPlayer = match.players[focusPlayerId];
  const opponentPlayers = Object.values(match.players).filter(
    (p) => p.playerId !== focusPlayerId
  );
  const primaryOpp = opponentPlayers[0] ?? null;

  const isShaking =
    match.status === 'shaking' ||
    (match.status !== 'finished' && liveServerNow < match.startedAtMs);
  const isFinished = match.status === 'finished' || liveServerNow >= match.endsAtMs;
  const secondsRemaining = isShaking
    ? match.settings.durationSeconds
    : Math.max(0, Math.ceil((match.endsAtMs - liveServerNow) / 1000));

  const snapshot = useMemo(() => {
    if (!match.board) return null;
    return getBoardSnapshotAtTime(match.board, match.schedule, liveServerNow);
  }, [match.board, match.schedule, liveServerNow]);

  const activeBoard = snapshot?.board ?? match.board;

  const sortedPlayers = useMemo(() => {
    return Object.values(match.players).sort((a, b) => {
      if (match.mode === 'board_battle') {
        if (Math.abs(b.normalizedScorePercent - a.normalizedScorePercent) > 0.05) {
          return b.normalizedScorePercent - a.normalizedScorePercent;
        }
      }
      return b.rawScore - a.rawScore;
    });
  }, [match.mode, match.players]);

  const topWinner = sortedPlayers[0];
  const overallBestWord = useMemo(() => {
    const candidates = Object.values(match.players)
      .map((p) => p.bestWord)
      .filter((w): w is NonNullable<typeof w> => Boolean(w));
    return candidates.sort((a, b) => b.points - a.points || b.word.length - a.word.length)[0] ?? null;
  }, [match.players]);

  useEffect(() => {
    if (!isFinished || !overallBestWord) return;
    let cancelled = false;
    fetchWordDefinition(overallBestWord.word, 'en').then((res) => {
      if (cancelled) return;
      const firstDef = res.meanings[0]?.definitions[0]?.definition;
      if (firstDef) setBestDefPreview(firstDef);
    });
    return () => {
      cancelled = true;
    };
  }, [isFinished, overallBestWord]);

  const showToastFeedback = useCallback((text: string, tone: 'ok' | 'err' | 'info') => {
    setFeedback({ text, tone });
    window.setTimeout(() => setFeedback(null), 1900);
  }, []);

  const handleSubmitPath = async (path: string[]) => {
    if (isSpectator || isShaking || isFinished) return;
    setSelectedPath([]);
    try {
      const res = await onSubmitWord(path);
      showToastFeedback(res.message, res.valid ? 'ok' : 'err');
    } catch (err: any) {
      showToastFeedback(err.message || 'Invalid word', 'err');
    }
  };

  const activeWordPreview = useMemo(() => {
    if (!activeBoard || selectedPath.length === 0) return '';
    return selectedPath
      .map((id) => {
        if (snapshot?.activeRainbowIds.has(id)) return '★';
        return activeBoard.tiles.find((t) => t.id === id)?.letter ?? '';
      })
      .join('');
  }, [activeBoard, selectedPath, snapshot]);

  const shapeMeta = getShapeTemplate(match.settings.shapeId);
  const maxMultiplier = Math.min(5, match.settings.mods.maxMultiplierCap || 5);

  if (!activeBoard) {
    return (
      <div className="ens-fantasy-page ens-gridit-page">
        <div className="ens-sky-sparkles" aria-hidden="true" />
        <div className="ens-gridit-loading-shell">
          <Loader2 size={32} className="ens-spin" color="#fde047" />
          <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            Preparing Synchronized Boards...
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#c7d2fe' }}>
            Completing letters &amp; sealing custom boards until reveal
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ens-fantasy-page ens-gridit-page">
      <div className="ens-sky-sparkles" aria-hidden="true" />
      <img
        src="/art/gridit-home-hero-bg.png"
        alt=""
        className="ens-gridit-play-backdrop"
        aria-hidden="true"
      />

      <div className="ens-gridit-play-shell">
        {/* Top Dual Player HUD matching Approved Mockup Screen 3 */}
        <header className="ens-gridit-hud">
          <div className="ens-gridit-hud-player">
            <AvatarBadge avatarId={myPlayer?.avatarId || session.avatarId} size={30} ringColor="#fde047" />
            <div className="ens-gridit-hud-player-meta">
              <span className="ens-gridit-hud-name">{myPlayer?.username || session.nickname}</span>
              <span className="ens-gridit-hud-score">{myPlayer?.rawScore ?? 0}</span>
            </div>
          </div>

          <div className={`ens-gridit-hud-timer ${secondsRemaining <= 15 && !isShaking ? 'is-low' : ''}`}>
            <Clock size={14} />
            <span>{match.settings.durationSeconds > 0 ? formatTime(secondsRemaining) : '∞'}</span>
          </div>

          {primaryOpp ? (
            <div className="ens-gridit-hud-player" style={{ paddingLeft: 10, paddingRight: 4 }}>
              <div className="ens-gridit-hud-player-meta" style={{ alignItems: 'flex-end' }}>
                <span className="ens-gridit-hud-name">{primaryOpp.username}</span>
                <span className="ens-gridit-hud-score" style={{ color: '#bae6fd' }}>
                  {primaryOpp.rawScore}
                </span>
              </div>
              <AvatarBadge avatarId={primaryOpp.avatarId} size={30} ringColor="#f472b6" />
            </div>
          ) : (
            <button
              type="button"
              className="ens-exit-hub-btn is-compact"
              onClick={onExitToHub}
              aria-label="Exit"
            >
              <ArrowLeft size={14} />
            </button>
          )}
        </header>

        {/* Substrip: Mode / Spectator / Authored Attribution / Live Mods */}
        <div className="ens-gridit-substrip">
          <span>
            {match.mode === 'board_battle'
              ? `Board Battle (${shapeMeta.name})${myPlayer?.authoredByName ? ` • By ${myPlayer.authoredByName}` : ''}`
              : `${match.mode === 'ranked' ? 'Ranked' : 'Multiplayer'} • ${shapeMeta.name}`}
          </span>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {isSpectator && (
              <span className="ens-gridit-live-mod-pill is-spec">
                <Eye size={10} /> Spectator
              </span>
            )}
            {snapshot?.inLightningRound && (
              <span className="ens-gridit-live-mod-pill is-lightning">⚡ 3×</span>
            )}
            {match.settings.mods.comboFever && (myPlayer?.comboCount ?? 0) >= 2 && (
              <span className="ens-gridit-live-mod-pill is-combo">🔥 ×{myPlayer.comboCount}</span>
            )}
          </div>
        </div>

        {isSpectator && Object.keys(match.players).length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.values(match.players).map((p) => (
              <button
                key={p.playerId}
                type="button"
                className={`ens-gridit-mini-pill ${focusPlayerId === p.playerId ? 'is-on' : ''}`}
                onClick={() => onSwitchSpectatePlayer(p.playerId)}
              >
                Watch {p.username} ({p.rawScore})
              </button>
            ))}
          </div>
        )}

        {/* Board Viewport */}
        <div className="ens-gridit-board-stage">
          <GridItBoardCanvas
            board={activeBoard}
            selectedPath={selectedPath}
            isShaking={isShaking}
            readOnly={isSpectator}
            activeRainbowIds={snapshot?.activeRainbowIds}
            activeGoldenIds={snapshot?.activeGoldenIds}
            lightningActive={snapshot?.inLightningRound}
            onPathChange={setSelectedPath}
            onSubmitPath={handleSubmitPath}
          />
        </div>

        {/* Word Preview & Submit (hidden cleanly for read-only spectators) */}
        {!isSpectator ? (
          <div className="ens-gridit-wordbar">
            <div className="ens-gridit-preview-box">
              <span className={`ens-gridit-preview-text ${activeWordPreview ? '' : 'is-empty'}`}>
                {activeWordPreview || 'Trace or tap letters...'}
              </span>
              {selectedPath.length > 0 && (
                <button
                  type="button"
                  className="ens-gridit-clear-btn"
                  onClick={() => setSelectedPath([])}
                  aria-label="Clear selection"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <button
              type="button"
              className="ens-gridit-submit-btn"
              disabled={selectedPath.length === 0 || isShaking || isFinished}
              onClick={() => handleSubmitPath(selectedPath)}
            >
              Submit
            </button>
          </div>
        ) : (
          <div className="ens-gridit-status-banner">
            <Eye size={13} color="#7dd3fc" />
            <span>Read-only Spectator View &bull; Players solving in real time</span>
          </div>
        )}

        {feedback && (
          <div className={`ens-gridit-feedback-pill is-${feedback.tone}`} role="status">
            {feedback.text}
          </div>
        )}

        {/* Non-Obstructive Live Emoji Reactions + Collapsible Chat */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {QUICK_EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                className="ens-gridit-mini-action"
                onClick={() => onSendChat(em, 'emoji')}
              >
                {em}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="ens-gridit-mini-action"
            onClick={() => setShowChatDrawer((v) => !v)}
          >
            <MessageCircle size={12} color="#7dd3fc" />
            <span>Chat ({match.messages.length})</span>
          </button>

          {!isSpectator ? (
            <button
              type="button"
              className="ens-gridit-finish-btn"
              onClick={onFinishEarly}
            >
              <Flag size={11} />
              <span>End</span>
            </button>
          ) : (
            <button
              type="button"
              className="ens-gridit-mini-action"
              onClick={onExitToHub}
            >
              Exit
            </button>
          )}
        </div>

        {showChatDrawer && (
          <div className="ens-gridit-panel" style={{ height: 'auto', maxHeight: 110, gap: 5 }}>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {match.messages.slice(-12).map((m) => (
                <div key={m.id} className="ens-gridit-chat-line">
                  <span>
                    <strong style={{ color: '#fde047' }}>{m.senderName}:</strong>{' '}
                    {translatedById[m.id] || m.text}
                  </span>
                  {m.kind === 'chat' && (
                    <button
                      type="button"
                      className="ens-gridit-translate-btn"
                      onClick={async () => {
                        const res = await api.translateMessage(m.text, 'en').catch(() => null);
                        if (!res?.available) {
                          onNotify(res?.reason || 'Online translation not configured.');
                          return;
                        }
                        if (res.translatedText) {
                          setTranslatedById((prev) => ({ ...prev, [m.id]: res.translatedText! }));
                        }
                      }}
                    >
                      <Languages size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!chatDraft.trim()) return;
                onSendChat(chatDraft, 'chat');
                setChatDraft('');
              }}
              style={{ display: 'flex', gap: 5 }}
            >
              <input
                type="text"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder="Send message..."
                className="ens-gridit-editor-name-input"
                style={{ padding: '5px 8px', fontSize: 12 }}
              />
              <button
                type="submit"
                className="ens-gridit-submit-btn"
                style={{ minHeight: 30, minWidth: 42, padding: '0 8px' }}
              >
                <Send size={13} />
              </button>
            </form>
          </div>
        )}

        {/* Bottom Found Words & Stats Panel matching Mockup Screen 3 */}
        <div className="ens-gridit-bottom-panels" style={{ height: 108 }}>
          <div className="ens-gridit-panel">
            <div className="ens-gridit-panel-title">
              Found Words ({myPlayer?.foundWords.length ?? 0})
            </div>
            <div className="ens-gridit-found-list">
              {!myPlayer || myPlayer.foundWords.length === 0 ? (
                <div className="ens-gridit-empty-hint">Found words appear here cleanly.</div>
              ) : (
                myPlayer.foundWords.map((fw) => (
                  <button
                    key={fw.word}
                    type="button"
                    className="ens-gridit-found-row"
                    onClick={() => setDefinitionWord(fw.word)}
                  >
                    <span>{fw.word.toLowerCase()}</span>
                    <span className="ens-gridit-found-right">
                      <span className="ens-gridit-found-pts">+{fw.points}</span>
                      <BookOpen size={12} color="#bae6fd" />
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="ens-gridit-panel">
            <div className="ens-gridit-panel-title">Stats</div>
            <div className="ens-gridit-stats-rows">
              <div className="ens-gridit-stat-line">
                <span>Score</span>
                <strong>{myPlayer?.rawScore ?? 0}</strong>
              </div>
              <div className="ens-gridit-stat-line">
                <span>Words</span>
                <strong>{myPlayer?.wordsFoundCount ?? 0}</strong>
              </div>
              <div className="ens-gridit-stat-line">
                <span>Best</span>
                <strong>{myPlayer?.bestWord?.word || '—'}</strong>
              </div>
              <div className="ens-gridit-stat-line">
                <span>Mult Cap</span>
                <strong>{maxMultiplier}×</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Synchronized Results & Board Battle Fairness Modal matching Approved Mockup Screen 4 */}
      {isFinished && (
        <div className="ens-modal-backdrop" style={{ alignItems: 'center' }}>
          <div className="ens-modal-card ens-fantasy-modal ens-gridit-results-modal">
            <div className="ens-gridit-results-header">
              <Crown size={34} color="#fde047" fill="#fde047" />
              <h2 className="ens-gridit-results-title">
                {match.mode === 'board_battle' ? 'Board Battle Complete!' : 'Match Complete!'}
              </h2>
              <p className="ens-gridit-results-sub">
                {topWinner
                  ? `${topWinner.username} Wins!`
                  : 'Results synchronized'}
              </p>
            </div>

            {match.mode === 'board_battle' && match.fairnessComparison && (
              <div className="ens-gridit-setup-card" style={{ padding: '9px 11px', marginBottom: 9, gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 900, color: '#ffffff' }}>
                  <span>Board Validation &amp; Fairness</span>
                  <CheckCircle2 size={15} color="#4ade80" />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#dbeafe', lineHeight: 1.35 }}>
                  {match.fairnessComparison.summary} (Ratio{' '}
                  {Math.round(match.fairnessComparison.potentialRatio * 100)}%)
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              {sortedPlayers.slice(0, 2).map((p) => (
                <div
                  key={p.playerId}
                  className="ens-gridit-results-hero"
                  style={{
                    flexDirection: 'column',
                    textAlign: 'center',
                    padding: '10px 8px',
                    borderColor: p.isWinner ? '#fde047' : 'rgba(186,200,255,0.45)',
                  }}
                >
                  <AvatarBadge avatarId={p.avatarId} size={38} ringColor={p.isWinner ? '#fde047' : '#a5b4fc'} />
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>
                    {p.username} {p.isWinner ? '👑' : ''}
                  </div>
                  <div className="ens-gridit-results-score" style={{ fontSize: 26 }}>
                    {p.rawScore}
                  </div>
                  {match.mode === 'board_battle' && (
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: '#bae6fd' }}>
                      Fair Normalized: {p.normalizedScorePercent}%
                    </div>
                  )}
                </div>
              ))}
            </div>

            {overallBestWord && (
              <button
                type="button"
                className="ens-gridit-results-best"
                onClick={() => setDefinitionWord(overallBestWord.word)}
              >
                <div className="ens-gridit-results-best-head">
                  <span>
                    <Sparkles size={13} color="#fde047" /> Best Word:{' '}
                    <strong>{overallBestWord.word}</strong> (+{overallBestWord.points})
                  </span>
                  <span style={{ color: '#7dd3fc', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <BookOpen size={12} /> Definition
                  </span>
                </div>
                {bestDefPreview && (
                  <div className="ens-gridit-results-best-def">
                    {overallBestWord.word.toLowerCase()} — {bestDefPreview}
                  </div>
                )}
              </button>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {!isSpectator && (
                <button
                  type="button"
                  className="ens-gridit-green-cta"
                  onClick={onRematch}
                >
                  <RotateCcw size={16} />
                  <span>Rematch</span>
                </button>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: match.roomId ? '1fr 1fr' : '1fr', gap: 8 }}>
                {match.roomId && (
                  <button
                    type="button"
                    className="ens-btn-white"
                    onClick={() => onReturnToRoom(match.roomId!)}
                  >
                    Room Lobby
                  </button>
                )}
                <button
                  type="button"
                  className="ens-btn-white"
                  onClick={onExitToHub}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Hub</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <GridItDefinitionModal
        word={definitionWord}
        onClose={() => setDefinitionWord(null)}
      />
    </div>
  );
};
