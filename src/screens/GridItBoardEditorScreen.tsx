import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  FolderOpen,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Wand2,
} from 'lucide-react';
import {
  GridItAuthoredWord,
  GridItCustomTemplate,
  buildEditorPreviewBoard,
  canPlaceWordOnTemplate,
  completeBoardFromTemplate,
  validateCustomTemplate,
} from '../../shared/gridit/editor';
import { analyzeBoardFairness } from '../../shared/gridit/fairness';
import { GRIDIT_SHAPES, getShapeTemplate } from '../../shared/gridit/shapes';
import { GridItBoardSize, GridItShapeId } from '../../shared/gridit/types';
import { GridItShapeMiniPreview } from '../components/GridItShapePreview';
import { LoadedDictionary, loadGridItDictionary } from '../games/gridit/dictionary';
import { GridItBoardCanvas } from '../games/gridit/GridItBoardCanvas';
import {
  buildSampleValidTemplate,
  createBlankTemplate,
  localGridItTemplateStore,
} from '../games/gridit/templateStorage';

interface GridItBoardEditorScreenProps {
  onBack: () => void;
  onPlayWithTemplate: (template: GridItCustomTemplate) => void;
  onSelectForBattle?: (template: GridItCustomTemplate) => void;
  selectModeLabel?: string;
}

const SIZE_ORDER: GridItBoardSize[] = ['small', 'medium', 'large'];

function rebuildTilesFromWords(words: GridItAuthoredWord[]): Record<string, string> {
  const next: Record<string, string> = {};
  for (const w of words) {
    const clean = w.word.toUpperCase();
    w.tilePath.forEach((tid, idx) => {
      if (clean[idx]) next[tid] = clean[idx];
    });
  }
  return next;
}

export const GridItBoardEditorScreen: React.FC<GridItBoardEditorScreenProps> = ({
  onBack,
  onPlayWithTemplate,
  onSelectForBattle,
  selectModeLabel,
}) => {
  const [dict, setDict] = useState<LoadedDictionary | null>(null);
  const [template, setTemplate] = useState<GridItCustomTemplate>(() =>
    createBlankTemplate('heart', 'medium', 'My Heart Board')
  );
  const [savedTemplates, setSavedTemplates] = useState<GridItCustomTemplate[]>([]);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [wordDraft, setWordDraft] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; tone: 'ok' | 'err' | 'info' } | null>(
    null
  );
  const [showLibrary, setShowLibrary] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const refreshSaved = useCallback(async () => {
    const list = await localGridItTemplateStore.list();
    setSavedTemplates(list);
  }, []);

  useEffect(() => {
    loadGridItDictionary('en').then(setDict);
    refreshSaved();
  }, [refreshSaved]);

  const shapeMeta = useMemo(() => getShapeTemplate(template.shapeId), [template.shapeId]);

  const previewBoard = useMemo(() => buildEditorPreviewBoard(template), [template]);

  const authoredTileIds = useMemo(
    () => new Set(Object.keys(template.authoredTiles)),
    [template.authoredTiles]
  );

  const validation = useMemo(() => {
    if (!dict) {
      return null;
    }
    return validateCustomTemplate(template, dict.words);
  }, [dict, template]);

  const fairnessPreview = useMemo(() => {
    if (!dict || !validation?.valid) return null;
    const completed = completeBoardFromTemplate(template, {
      seed: 1337,
      dictionary: dict.words,
      prefixSet: dict.prefixes,
    });
    return analyzeBoardFairness(completed.board, dict.words, dict.prefixes);
  }, [dict, template, validation?.valid]);

  const showStatus = (text: string, tone: 'ok' | 'err' | 'info') => {
    setStatusMsg({ text, tone });
  };

  const handleShapeChange = (nextShape: GridItShapeId) => {
    if (nextShape === template.shapeId) return;
    setTemplate((prev) => ({
      ...prev,
      shapeId: nextShape,
      authoredTiles: {},
      authoredWords: [],
      updatedAt: Date.now(),
    }));
    setSelectedPath([]);
    showStatus(`Switched shape to ${getShapeTemplate(nextShape).name}. Empty board ready!`, 'info');
  };

  const cycleSize = (delta: number) => {
    const idx = SIZE_ORDER.indexOf(template.sizeId);
    const nextSize = SIZE_ORDER[(idx + delta + SIZE_ORDER.length) % SIZE_ORDER.length];
    if (nextSize === template.sizeId) return;
    setTemplate((prev) => ({
      ...prev,
      sizeId: nextSize,
      authoredTiles: {},
      authoredWords: [],
      updatedAt: Date.now(),
    }));
    setSelectedPath([]);
    showStatus(
      `Board size set to ${shapeMeta.sizes[nextSize].label}.`,
      'info'
    );
  };

  const handlePlaceWord = () => {
    if (!dict) return;
    const clean = wordDraft.trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (selectedPath.length < 3) {
      showStatus('Trace or tap at least 3 neighboring empty/compatible tiles on the board first.', 'err');
      return;
    }
    const check = canPlaceWordOnTemplate(
      template.shapeId,
      template.sizeId,
      template.authoredTiles,
      template.authoredWords,
      clean,
      selectedPath,
      dict.words
    );
    if (!check.ok) {
      showStatus(check.reason || 'Cannot place word along selected path.', 'err');
      return;
    }

    const newWord: GridItAuthoredWord = {
      id: `aw_${Date.now()}_${template.authoredWords.length}`,
      word: check.normalizedWord,
      tilePath: [...selectedPath],
    };
    const nextWords = [...template.authoredWords, newWord];
    setTemplate((prev) => ({
      ...prev,
      authoredWords: nextWords,
      authoredTiles: rebuildTilesFromWords(nextWords),
      updatedAt: Date.now(),
    }));
    setSelectedPath([]);
    setWordDraft('');
    showStatus(`Placed "${check.normalizedWord}" on ${newWord.tilePath.length} tiles!`, 'ok');
  };

  const handleRemoveWord = (wordId: string) => {
    const nextWords = template.authoredWords.filter((w) => w.id !== wordId);
    setTemplate((prev) => ({
      ...prev,
      authoredWords: nextWords,
      authoredTiles: rebuildTilesFromWords(nextWords),
      updatedAt: Date.now(),
    }));
  };

  const handleUndoWord = () => {
    if (template.authoredWords.length === 0) return;
    const nextWords = template.authoredWords.slice(0, -1);
    setTemplate((prev) => ({
      ...prev,
      authoredWords: nextWords,
      authoredTiles: rebuildTilesFromWords(nextWords),
      updatedAt: Date.now(),
    }));
    showStatus('Removed last placed word.', 'info');
  };

  const handleFillSample = () => {
    if (!dict) return;
    const sample = buildSampleValidTemplate(
      template.shapeId,
      template.sizeId,
      dict.words,
      template.name || `${shapeMeta.name} Custom`
    );
    setTemplate((prev) => ({
      ...sample,
      id: prev.id,
      name: prev.name,
      createdAt: prev.createdAt,
    }));
    setSelectedPath([]);
    showStatus(
      `Starter words placed (${sample.authoredWords.length} words). Unfilled sockets remain blank until runtime!`,
      'ok'
    );
  };

  const handleSaveTemplate = async (): Promise<GridItCustomTemplate | null> => {
    if (!template.name.trim()) {
      showStatus('Give your board template a name first.', 'err');
      return null;
    }
    const saved = await localGridItTemplateStore.save(template);
    setTemplate(saved);
    await refreshSaved();
    if (validation?.valid) {
      showStatus(`Saved "${saved.name}" — meets all quotas!`, 'ok');
    } else {
      showStatus(
        `Saved draft "${saved.name}" locally (complete remaining quotas before Battle).`,
        'info'
      );
    }
    return saved;
  };

  const selectedLettersPreview = useMemo(() => {
    return selectedPath
      .map((id) => template.authoredTiles[id] || '·')
      .join('');
  }, [selectedPath, template.authoredTiles]);

  const remainingEmptyCount =
    previewBoard.tiles.length - Object.keys(template.authoredTiles).length;

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
          {/* Top Header */}
          <header className="ens-gridit-setup-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <button
                type="button"
                className="ens-exit-hub-btn is-compact"
                onClick={onBack}
                aria-label="Back"
              >
                <ArrowLeft size={15} strokeWidth={2.8} />
              </button>
              <div className="ens-gridit-setup-title-wrap">
                <div className="ens-gridit-setup-title">Board Editor</div>
                <div className="ens-gridit-setup-sub">
                  Place words &bull; Blank cells auto-fill before reveal
                </div>
              </div>
            </div>

            <button
              type="button"
              className="ens-gridit-tool-btn"
              style={{ padding: '0 11px', minHeight: 34 }}
              onClick={() => setShowLibrary((v) => !v)}
            >
              <FolderOpen size={14} color="#fde047" />
              <span>Library ({savedTemplates.length})</span>
            </button>
          </header>

          {/* Name + Shape + Size Controls */}
          <section className="ens-gridit-setup-card">
            <input
              type="text"
              maxLength={32}
              value={template.name}
              onChange={(e) =>
                setTemplate((prev) => ({ ...prev, name: e.target.value, updatedAt: Date.now() }))
              }
              placeholder="Board template name..."
              className="ens-gridit-editor-name-input"
              aria-label="Template name"
            />

            <div className="ens-gridit-shape-picker-grid">
              {GRIDIT_SHAPES.map((s) => {
                const active = s.id === template.shapeId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`ens-gridit-shape-option ${active ? 'is-selected' : ''}`}
                    onClick={() => handleShapeChange(s.id)}
                  >
                    <GridItShapeMiniPreview shapeId={s.id} />
                    <span className="ens-gridit-shape-option-name">{s.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="ens-gridit-size-stepper">
              <button
                type="button"
                className="ens-gridit-step-btn"
                onClick={() => cycleSize(-1)}
                aria-label="Smaller board size"
              >
                <ChevronLeft size={18} strokeWidth={2.8} />
              </button>
              <div className="ens-gridit-size-value">
                {shapeMeta.sizes[template.sizeId].label} &bull; {remainingEmptyCount} blank sockets
              </div>
              <button
                type="button"
                className="ens-gridit-step-btn"
                onClick={() => cycleSize(1)}
                aria-label="Larger board size"
              >
                <ChevronRight size={18} strokeWidth={2.8} />
              </button>
            </div>
          </section>

          {/* Interactive Editor Canvas */}
          <div className="ens-gridit-board-stage" style={{ height: 270, flex: 'none' }}>
            <GridItBoardCanvas
              board={previewBoard}
              selectedPath={selectedPath}
              editorMode
              authoredTileIds={authoredTileIds}
              onPathChange={setSelectedPath}
              onSubmitPath={() => undefined}
            />
          </div>

          {/* Word Placement Bar */}
          <section className="ens-gridit-setup-card" style={{ gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#dbeafe' }}>
                Selected path: <strong>{selectedPath.length}</strong> tiles{' '}
                {selectedPath.length > 0 && `(${selectedLettersPreview})`}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="ens-gridit-mini-action"
                  onClick={() => setSelectedPath([])}
                  disabled={selectedPath.length === 0}
                >
                  Clear Path
                </button>
                <button
                  type="button"
                  className="ens-gridit-mini-action"
                  onClick={handleUndoWord}
                  disabled={template.authoredWords.length === 0}
                >
                  <Undo2 size={12} /> Undo
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={wordDraft}
                maxLength={15}
                onChange={(e) =>
                  setWordDraft(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())
                }
                placeholder={
                  selectedPath.length >= 3
                    ? `Type ${selectedPath.length}-letter word...`
                    : 'Trace >= 3 tiles first...'
                }
                className="ens-gridit-editor-name-input"
                style={{ flex: 1, letterSpacing: '0.1em', textTransform: 'uppercase' }}
              />
              <button
                type="button"
                className="ens-gridit-submit-btn"
                style={{ minHeight: 38 }}
                onClick={handlePlaceWord}
                disabled={selectedPath.length < 3 || wordDraft.trim().length < 3}
              >
                Place Word
              </button>
            </div>

            {statusMsg && (
              <div className={`ens-gridit-feedback-pill is-${statusMsg.tone}`} style={{ alignSelf: 'stretch', textAlign: 'center' }}>
                {statusMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <button type="button" className="ens-gridit-mini-action" onClick={handleFillSample}>
                <Wand2 size={12} /> Fill Starter Words
              </button>
              <button
                type="button"
                className="ens-gridit-mini-action"
                onClick={() => {
                  setTemplate((prev) => ({
                    ...prev,
                    authoredTiles: {},
                    authoredWords: [],
                    updatedAt: Date.now(),
                  }));
                  setSelectedPath([]);
                }}
              >
                <RotateCcw size={12} /> Clear All
              </button>
            </div>
          </section>

          {/* Word-Length Quotas Checklist + Placed Words */}
          {validation && (
            <section className="ens-gridit-setup-card" style={{ gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="ens-gridit-setup-label">
                  <Sparkles size={14} color="#fde047" />
                  <span>Board Validation</span>
                </div>
                <span className={validation.valid ? 'ens-pill-ready' : 'ens-pill-not-ready'}>
                  {validation.valid ? 'All Quotas Met ✓' : 'In Progress'}
                </span>
              </div>

              <div className="ens-gridit-quota-list">
                {validation.quotaProgress.items.map((item) => (
                  <div
                    key={item.id}
                    className={`ens-gridit-quota-row ${item.met ? 'is-met' : ''}`}
                  >
                    <span>{item.label}:</span>
                    <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      {item.found} / {item.required}
                      {item.met && <CheckCircle2 size={14} color="#4ade80" />}
                    </strong>
                  </div>
                ))}
              </div>

              {fairnessPreview && (
                <div className="ens-gridit-fairness-badge">
                  <span>Fairness Preview: <strong>{fairnessPreview.grade}</strong></span>
                  <span>
                    {fairnessPreview.wordCount}
                    {fairnessPreview.isBoundedEstimate ? '+' : ''} playable words • Max{' '}
                    {fairnessPreview.maxScorePotential} pts
                  </span>
                </div>
              )}

              {template.authoredWords.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                  {template.authoredWords.map((aw) => (
                    <span key={aw.id} className="ens-gridit-results-word-chip">
                      <span>{aw.word}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveWord(aw.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#fda4af',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'inline-flex',
                        }}
                        aria-label={`Remove ${aw.word}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Primary Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                className="ens-btn-purple"
                onClick={() => handleSaveTemplate()}
              >
                <Save size={15} />
                <span>Save Template</span>
              </button>

              <button
                type="button"
                className="ens-gridit-green-cta"
                style={{ minHeight: 44, fontSize: 14.5 }}
                disabled={!validation?.valid}
                onClick={async () => {
                  const saved = await handleSaveTemplate();
                  if (!saved) return;
                  if (onSelectForBattle) {
                    onSelectForBattle(saved);
                  } else {
                    onPlayWithTemplate(saved);
                  }
                }}
              >
                <Play size={15} fill="#ffffff" />
                <span>{selectModeLabel || 'Test Play Solo'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Browser-Local Template Library Modal */}
      {showLibrary && (
        <div className="ens-modal-backdrop" onClick={() => setShowLibrary(false)}>
          <div className="ens-modal-card ens-fantasy-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#ffffff' }}>
                Saved Custom Boards
              </h2>
              <button
                type="button"
                className="ens-btn-white"
                style={{ minHeight: 32, padding: '4px 12px', fontSize: 12 }}
                onClick={() => setShowLibrary(false)}
              >
                Close
              </button>
            </div>

            <button
              type="button"
              className="ens-btn-purple"
              style={{ width: '100%', marginBottom: 10, minHeight: 38 }}
              onClick={() => {
                setTemplate(createBlankTemplate('heart', 'medium', 'New Custom Board'));
                setSelectedPath([]);
                setShowLibrary(false);
              }}
            >
              <Plus size={15} />
              <span>Create New Blank Board</span>
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '48dvh', overflowY: 'auto' }}>
              {savedTemplates.length === 0 ? (
                <div style={{ fontSize: 13, color: '#c7d2fe', fontWeight: 700, padding: 10 }}>
                  No saved custom GridIt boards yet in this browser.
                </div>
              ) : (
                savedTemplates.map((item) => {
                  const isValid = dict ? validateCustomTemplate(item, dict.words).valid : false;
                  return (
                    <div key={item.id} className="ens-player-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 7 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        {renameTargetId === item.id ? (
                          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                            <input
                              type="text"
                              value={renameDraft}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              className="ens-gridit-editor-name-input"
                              style={{ flex: 1, padding: '4px 8px' }}
                            />
                            <button
                              type="button"
                              className="ens-gridit-mini-action"
                              onClick={async () => {
                                const updated = await localGridItTemplateStore.rename(item.id, renameDraft);
                                if (updated && template.id === item.id) setTemplate(updated);
                                setRenameTargetId(null);
                                await refreshSaved();
                              }}
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 900, color: '#ffffff' }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#c7d2fe' }}>
                              {getShapeTemplate(item.shapeId).name} &bull; {item.sizeId} &bull;{' '}
                              {item.authoredWords.length} words &bull; {isValid ? 'Battle-Ready ✓' : 'Draft'}
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="ens-gridit-mini-action"
                          onClick={() => {
                            setTemplate(item);
                            setSelectedPath([]);
                            setShowLibrary(false);
                          }}
                        >
                          <Pencil size={11} /> Edit
                        </button>
                        <button
                          type="button"
                          className="ens-gridit-mini-action"
                          onClick={() => {
                            setRenameTargetId(item.id);
                            setRenameDraft(item.name);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="ens-gridit-mini-action"
                          onClick={async () => {
                            await localGridItTemplateStore.duplicate(item.id);
                            await refreshSaved();
                          }}
                        >
                          <Copy size={11} /> Duplicate
                        </button>
                        <button
                          type="button"
                          className="ens-gridit-mini-action"
                          onClick={async () => {
                            await localGridItTemplateStore.remove(item.id);
                            await refreshSaved();
                          }}
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                        {isValid && (
                          <button
                            type="button"
                            className="ens-gridit-mini-action"
                            style={{ background: '#16a34a', color: '#fff', borderColor: '#bbf7d0' }}
                            onClick={() => {
                              setShowLibrary(false);
                              if (onSelectForBattle) {
                                onSelectForBattle(item);
                              } else {
                                onPlayWithTemplate(item);
                              }
                            }}
                          >
                            <Play size={11} fill="#fff" /> {onSelectForBattle ? 'Use' : 'Play'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
