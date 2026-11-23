import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  Languages,
  LogOut,
  Play,
  Send,
  ShieldCheck,
  Swords,
  Users,
  Wand2,
} from 'lucide-react';
import { GridItCustomTemplate, validateCustomTemplate } from '../../shared/gridit/editor';
import { GridItRoom } from '../../shared/gridit/multiplayerTypes';
import { PlayerSession } from '../../shared/types';
import { AvatarBadge } from '../components/Artwork';
import { loadGridItDictionary, LoadedDictionary } from '../games/gridit/dictionary';
import { buildSampleValidTemplate, localGridItTemplateStore } from '../games/gridit/templateStorage';
import { api } from '../services/api';

interface GridItLobbyScreenProps {
  room: GridItRoom;
  session: PlayerSession;
  onBack: () => void;
  onLeave: () => void;
  onToggleReady: (isReady: boolean) => Promise<void>;
  onSubmitBattleTemplate: (tpl: GridItCustomTemplate) => Promise<void>;
  onOpenBoardEditor: () => void;
  onSendChat: (text: string, kind: 'chat' | 'emoji') => Promise<void>;
  onStartMatch: () => Promise<void>;
  onNotify: (msg: string) => void;
}

const QUICK_EMOJIS = ['🔥', '👏', '⚡', '👑', '😎'];

export const GridItLobbyScreen: React.FC<GridItLobbyScreenProps> = ({
  room,
  session,
  onBack,
  onLeave,
  onToggleReady,
  onSubmitBattleTemplate,
  onOpenBoardEditor,
  onSendChat,
  onStartMatch,
  onNotify,
}) => {
  const [dict, setDict] = useState<LoadedDictionary | null>(null);
  const [localTemplates, setLocalTemplates] = useState<GridItCustomTemplate[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [translatedById, setTranslatedById] = useState<Record<string, string>>({});
  const [submittingTpl, setSubmittingTpl] = useState(false);

  const meParticipant = room.players.find((p) => p.playerId === session.playerId);
  const isSpectator = !meParticipant;
  const isHost = room.hostId === session.playerId;

  useEffect(() => {
    loadGridItDictionary(room.settings.language).then(setDict);
    localGridItTemplateStore.list().then(setLocalTemplates);
  }, [room.settings.language]);

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(room.code).catch(() => undefined);
    onNotify(`Copied Room Code: ${room.code}`);
  };

  const handleQuickCreateBattleBoard = async () => {
    if (!dict) return;
    setSubmittingTpl(true);
    try {
      const generated = buildSampleValidTemplate(
        room.settings.shapeId,
        room.settings.sizeId,
        dict.words,
        `${session.nickname}'s ${room.settings.shapeId} Battle`
      );
      await localGridItTemplateStore.save(generated);
      await onSubmitBattleTemplate(generated);
      onNotify('Secret Battle Board validated & locked in!');
    } catch (err: any) {
      onNotify(err.message || 'Could not submit board');
    } finally {
      setSubmittingTpl(false);
    }
  };

  const handleTranslate = async (msgId: string, text: string) => {
    try {
      const res = await api.translateMessage(text, 'en');
      if (!res.available) {
        onNotify(res.reason || 'Translation unavailable');
        return;
      }
      if (res.translatedText) {
        setTranslatedById((prev) => ({ ...prev, [msgId]: res.translatedText! }));
      }
    } catch (err: any) {
      onNotify(err.message || 'Translation failed');
    }
  };

  const battleMissingCount =
    room.settings.mode === 'board_battle'
      ? room.players.filter((p) => !p.battleTemplateReady).length
      : 0;
  const canStart =
    isHost &&
    room.players.length >= 2 &&
    (room.settings.mode !== 'board_battle' || battleMissingCount === 0);

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <button
                type="button"
                className="ens-exit-hub-btn is-compact"
                onClick={onBack}
                aria-label="Back to Rooms"
              >
                <ArrowLeft size={15} strokeWidth={2.8} />
              </button>
              <div>
                <div className="ens-gridit-setup-title">{room.name}</div>
                <div className="ens-gridit-setup-sub">
                  {room.settings.mode === 'board_battle' ? 'Board Battle' : 'Classic Multiplayer'} &bull;{' '}
                  {room.settings.shapeId} ({room.settings.sizeId})
                </div>
              </div>
            </div>

            <button
              type="button"
              className="ens-share-pill"
              onClick={handleCopyCode}
              title="Copy Room Code"
            >
              <span>{room.code}</span>
              <Copy size={13} />
            </button>
          </header>

          {isSpectator && (
            <div className="ens-gridit-status-banner" style={{ borderColor: '#7dd3fc' }}>
              <Eye size={14} color="#7dd3fc" />
              <span>Spectator Mode (Read-Only) &bull; Live view unlocks when match starts</span>
            </div>
          )}

          {/* Participants */}
          <section className="ens-gridit-setup-card">
            <div className="ens-gridit-setup-label" style={{ justifyContent: 'space-between' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Users size={14} color="#7dd3fc" /> Players ({room.players.length}/{room.settings.capacity})
              </span>
              {room.spectators.length > 0 && (
                <span style={{ fontSize: 11, color: '#bae6fd' }}>
                  <Eye size={11} /> {room.spectators.length} watching
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {room.players.map((p) => (
                <div key={p.playerId} className="ens-player-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <AvatarBadge avatarId={p.avatarId} size={34} />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 900, color: '#ffffff' }}>
                        {p.username} {p.isHost ? '👑' : ''}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#c7d2fe' }}>
                        {room.settings.mode === 'board_battle'
                          ? p.battleTemplateReady
                            ? `Secret Board Ready (${p.battleTemplateSummary?.fairnessGrade || 'Valid'})`
                            : 'Preparing secret Battle Board...'
                          : p.isOnline
                            ? 'Connected'
                            : 'Reconnecting'}
                      </div>
                    </div>
                  </div>
                  <span className={p.isReady ? 'ens-pill-ready' : 'ens-pill-not-ready'}>
                    {p.isReady ? 'Ready ✓' : 'Waiting'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Board Battle Secret Template Selection */}
          {!isSpectator && room.settings.mode === 'board_battle' && (
            <section className="ens-gridit-setup-card" style={{ gap: 8 }}>
              <div className="ens-gridit-setup-label">
                <Swords size={14} color="#f472b6" />
                <span>Secret Custom Board (Hidden From Opponents)</span>
              </div>

              {meParticipant?.battleTemplateReady && meParticipant.battleTemplateSummary && (
                <div className="ens-gridit-fairness-badge">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <ShieldCheck size={14} color="#4ade80" />
                    Locked: <strong>{meParticipant.battleTemplateSummary.name}</strong>
                  </span>
                  <span>
                    {meParticipant.battleTemplateSummary.wordCount} words &bull;{' '}
                    {meParticipant.battleTemplateSummary.fairnessGrade}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="ens-gridit-mini-action"
                  disabled={!dict || submittingTpl}
                  onClick={handleQuickCreateBattleBoard}
                >
                  <Wand2 size={12} />{' '}
                  {submittingTpl ? 'Validating...' : 'Auto-Build & Lock Secret Board'}
                </button>
                <button
                  type="button"
                  className="ens-gridit-mini-action"
                  onClick={onOpenBoardEditor}
                >
                  Open Board Editor
                </button>
              </div>

              {localTemplates.length > 0 && dict && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {localTemplates
                    .filter((t) => validateCustomTemplate(t, dict.words).valid)
                    .slice(0, 4)
                    .map((tpl) => (
                      <div key={tpl.id} className="ens-gridit-quota-row">
                        <span>
                          {tpl.name} ({tpl.shapeId}/{tpl.sizeId})
                        </span>
                        <button
                          type="button"
                          className="ens-gridit-mini-action"
                          style={{ background: '#7c3aed', color: '#fff' }}
                          onClick={() => onSubmitBattleTemplate(tpl)}
                        >
                          Lock In
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </section>
          )}

          {/* Lobby Chat + Emojis + Optional Translation */}
          <section className="ens-gridit-setup-card" style={{ gap: 8 }}>
            <div className="ens-gridit-setup-label">
              <span>Lobby Chat &amp; Reactions</span>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              {QUICK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  className="ens-gridit-mini-action"
                  style={{ fontSize: 15, padding: '4px 8px' }}
                  onClick={() => onSendChat(em, 'emoji')}
                >
                  {em}
                </button>
              ))}
            </div>

            <div style={{ maxHeight: 130, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {room.messages.length === 0 ? (
                <div className="ens-gridit-empty-hint">No messages yet. Say hi or send a reaction!</div>
              ) : (
                room.messages.map((m) => (
                  <div key={m.id} className="ens-gridit-chat-line">
                    <div>
                      <strong style={{ color: '#fde047' }}>{m.senderName}:</strong>{' '}
                      <span>{translatedById[m.id] || m.text}</span>
                    </div>
                    {m.kind === 'chat' && (
                      <button
                        type="button"
                        className="ens-gridit-translate-btn"
                        onClick={() => handleTranslate(m.id, m.text)}
                        title="Translate message (online)"
                      >
                        <Languages size={12} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!chatDraft.trim()) return;
                onSendChat(chatDraft, 'chat');
                setChatDraft('');
              }}
              style={{ display: 'flex', gap: 7 }}
            >
              <input
                type="text"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder="Message arena..."
                className="ens-gridit-editor-name-input"
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                className="ens-gridit-submit-btn"
                style={{ minHeight: 38, minWidth: 50, padding: '0 12px' }}
                aria-label="Send message"
              >
                <Send size={15} />
              </button>
            </form>
          </section>

          {/* Bottom Lobby Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="ens-leave-btn"
              style={{ minHeight: 44 }}
              onClick={onLeave}
            >
              <LogOut size={14} />
              <span>Leave</span>
            </button>

            {!isSpectator && (
              <button
                type="button"
                className="ens-btn-white"
                style={{ flex: 1 }}
                onClick={() => onToggleReady(!meParticipant?.isReady)}
              >
                <Check size={15} />
                <span>{meParticipant?.isReady ? 'Ready ✓' : 'Mark Ready'}</span>
              </button>
            )}

            {isHost && (
              <button
                type="button"
                className="ens-gridit-green-cta"
                style={{ flex: 1.4, minHeight: 44, fontSize: 15 }}
                disabled={!canStart}
                onClick={onStartMatch}
              >
                <Play size={16} fill="#ffffff" />
                <span>Start Match</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
