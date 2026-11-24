import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronUp,
  Copy,
  Eye,
  GripVertical,
  Layers,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Profile, Template, TemplateStatus, ThumbnailKey } from '../../shared/types';
import { api } from '../services/api';
import { TemplateThumb } from '../components/Artwork';

interface TemplatesScreenProps {
  profile: Profile;
  templates: Template[];
  onSaveTemplate: (tpl: {
    id?: string;
    ownerId: string;
    name: string;
    theme: string;
    thumbnailKey: ThumbnailKey;
    words: string[];
    status: 'saved' | 'draft';
  }) => Promise<Template>;
  onDuplicateTemplate: (id: string) => Promise<Template>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onPlayWithTemplate: (tpl: Template) => Promise<void>;
  onNotify: (msg: string) => void;
}

export const TemplatesScreen: React.FC<TemplatesScreenProps> = ({
  profile,
  templates,
  onSaveTemplate,
  onDuplicateTemplate,
  onDeleteTemplate,
  onPlayWithTemplate,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<TemplateStatus>('saved');
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const myTemplates = useMemo(
    () =>
      templates.filter((t) => {
        if (activeTab === 'official') return t.status === 'official';
        if (activeTab === 'draft') return t.status === 'draft' && t.ownerId === profile.id;
        return t.status === 'saved' && t.ownerId === profile.id;
      }),
    [templates, activeTab, profile.id]
  );

  const initialSelected = myTemplates[0] ?? templates[0] ?? null;
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(initialSelected?.id);
  const [editName, setEditName] = useState<string>(initialSelected?.name ?? 'School Days');
  const [editTheme, setEditTheme] = useState<string>(initialSelected?.theme ?? 'Education');
  const [editThumb, setEditThumb] = useState<ThumbnailKey>(
    initialSelected?.thumbnailKey ?? 'school'
  );
  const [editWords, setEditWords] = useState<string[]>(
    initialSelected?.words ?? ['HIGH', 'SCHOOL', 'BUS', 'STOP']
  );

  useEffect(() => {
    if (!editingId && !isCreatingNew && myTemplates.length > 0) {
      const first = myTemplates[0];
      setEditingId(first.id);
      setEditName(first.name);
      setEditTheme(first.theme);
      setEditThumb(first.thumbnailKey);
      setEditWords([...first.words]);
    }
  }, [editingId, isCreatingNew, myTemplates]);

  const loadIntoEditor = (tpl: Template) => {
    setIsCreatingNew(tpl.status === 'official');
    setEditingId(tpl.status === 'official' ? undefined : tpl.id);
    setEditName(tpl.status === 'official' ? `${tpl.name} Remix` : tpl.name);
    setEditTheme(tpl.theme);
    setEditThumb(tpl.thumbnailKey);
    setEditWords([...tpl.words]);
    setEditorCollapsed(false);
    setMenuOpenId(null);
  };

  const handleCreateNew = () => {
    setIsCreatingNew(true);
    setEditingId(undefined);
    setEditName('New Word Chain');
    setEditTheme('Custom');
    setEditThumb('custom');
    setEditWords(['WORD', 'CHAIN', 'LINK', 'GAME']);
    setEditorCollapsed(false);
    setActiveTab('saved');
  };

  const handleWordChange = (idx: number, val: string) => {
    const clean = val.replace(/[^a-zA-Z]/g, '').toUpperCase();
    setEditWords((prev) => prev.map((w, i) => (i === idx ? clean : w)));
  };

  const moveWord = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= editWords.length) return;
    const copy = [...editWords];
    const tmp = copy[idx];
    copy[idx] = copy[target];
    copy[target] = tmp;
    setEditWords(copy);
  };

  const handleSave = async (status: 'saved' | 'draft' = 'saved') => {
    try {
      const saved = await onSaveTemplate({
        id: editingId,
        ownerId: profile.id,
        name: editName.trim() || 'Untitled Chain',
        theme: editTheme.trim() || 'Custom',
        thumbnailKey: editThumb,
        words: editWords,
        status,
      });
      setIsCreatingNew(false);
      setEditingId(saved.id);
      setActiveTab(saved.status);
      onNotify(status === 'draft' ? `Saved "${saved.name}" to Drafts` : `Saved "${saved.name}"!`);
    } catch (err: any) {
      onNotify(err.message || 'Check your chain words');
    }
  };

  const handleDuplicate = async () => {
    if (editingId) {
      const dup = await onDuplicateTemplate(editingId);
      loadIntoEditor(dup);
      setActiveTab('saved');
      onNotify(`Duplicated as "${dup.name}"`);
    } else {
      await handleSave('saved');
    }
  };

  const handlePlay = async () => {
    try {
      const saved = await onSaveTemplate({
        id: editingId,
        ownerId: profile.id,
        name: editName.trim() || 'Untitled Chain',
        theme: editTheme.trim() || 'Custom',
        thumbnailKey: editThumb,
        words: editWords,
        status: 'saved',
      });
      setIsCreatingNew(false);
      setEditingId(saved.id);
      await onPlayWithTemplate(saved);
    } catch (err: any) {
      onNotify(err.message || 'Save a valid chain before playing');
    }
  };

  const linkPairs = useMemo(() => {
    const pairs: string[] = [];
    for (let i = 0; i < editWords.length - 1; i++) {
      const a = editWords[i].trim();
      const b = editWords[i + 1].trim();
      if (a && b) pairs.push(`${a} ${b}`);
    }
    return pairs;
  }, [editWords]);

  return (
    <div className="ens-sheet-screen" style={{ flex: 1, minHeight: 0 }}>
      <div className="ens-sky-sparkles" aria-hidden="true" />

      {/* Scenic Fantasy Topbar */}
      <header className="ens-royal-topbar">
        <img src="/art/header-fantasy.png" alt="" className="ens-royal-topbar-art" aria-hidden="true" />
        <div style={{ width: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Layers size={22} color="#a5f3fc" />
        </div>
        <span style={{ fontSize: 21, fontWeight: 900, fontStyle: 'italic', textShadow: '0 2px 8px rgba(8,12,56,0.6)' }}>
          My Templates
        </span>
        <button
          type="button"
          onClick={handleCreateNew}
          aria-label="Create new template"
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            border: '1.8px solid #ffffff',
            background: 'var(--ens-grad-btn-lavender)',
            color: '#24196a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(8,12,56,0.4)',
          }}
        >
          <Plus size={20} strokeWidth={2.8} />
        </button>
      </header>

      {/* Fantasy Scroll Body */}
      <div className="ens-sheet-body">
        {/* Segmented Fantasy Pill Tabs */}
        <div className="ens-segmented-tabs">
          <button
            type="button"
            className={`ens-seg-tab ${activeTab === 'saved' ? 'active' : ''}`}
            onClick={() => setActiveTab('saved')}
          >
            My Templates
          </button>
          <button
            type="button"
            className={`ens-seg-tab ${activeTab === 'draft' ? 'active' : ''}`}
            onClick={() => setActiveTab('draft')}
          >
            Drafts
          </button>
          <button
            type="button"
            className={`ens-seg-tab ${activeTab === 'official' ? 'active' : ''}`}
            onClick={() => setActiveTab('official')}
          >
            Official
          </button>
        </div>

        {/* Template List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {myTemplates.length === 0 ? (
            <div className="ens-coming-soon-card" style={{ padding: '22px 16px' }}>
              <Layers size={28} color="#d8c8ff" />
              <div className="ens-coming-title">
                {activeTab === 'draft' ? 'No Draft Chains Saved' : 'No Templates Here Yet'}
              </div>
              <p className="ens-coming-sub">
                {activeTab === 'draft'
                  ? 'Work-in-progress word chains saved as drafts will appear here.'
                  : 'Craft your own word chain to challenge opponents in Rooms and Matches!'}
              </p>
              <button
                type="button"
                className="ens-grad-btn is-purple is-sm"
                onClick={handleCreateNew}
              >
                <Plus size={15} strokeWidth={2.8} />
                <span>Create Template</span>
              </button>
            </div>
          ) : (
            myTemplates.map((tpl) => {
              const isSelected = editingId === tpl.id;
              return (
                <div
                  key={tpl.id}
                  className={`ens-tpl-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => loadIntoEditor(tpl)}
                  style={{ position: 'relative' }}
                >
                  <div
                    style={{
                      borderRadius: 14,
                      border: '1.8px solid rgba(226, 224, 255, 0.78)',
                      overflow: 'hidden',
                      flexShrink: 0,
                      boxShadow: '0 4px 10px rgba(8, 12, 56, 0.4)',
                    }}
                  >
                    <TemplateThumb thumbnailKey={tpl.thumbnailKey} size={52} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15.5,
                        fontWeight: 900,
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {tpl.name}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#cdd6ff', marginTop: 1 }}>
                      {tpl.words.length} words • {tpl.theme}
                    </div>
                    <div style={{ marginTop: 5 }}>
                      <span
                        className={
                          tpl.status === 'official'
                            ? 'ens-pill-official'
                            : tpl.status === 'draft'
                              ? 'ens-pill-creating'
                              : 'ens-pill-ready'
                        }
                        style={{ padding: '2px 9px', fontSize: 11 }}
                      >
                        {tpl.status === 'official'
                          ? '★ Official'
                          : tpl.status === 'draft'
                            ? 'Draft'
                            : '✓ Saved'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ens-tpl-more-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === tpl.id ? null : tpl.id);
                    }}
                    aria-label="Template options"
                  >
                    <MoreHorizontal size={16} />
                  </button>

                  {menuOpenId === tpl.id && (
                    <div
                      className="ens-tpl-popover"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="ens-tpl-pop-item"
                        onClick={() => loadIntoEditor(tpl)}
                      >
                        Edit Template
                      </button>
                      <button
                        type="button"
                        className="ens-tpl-pop-item"
                        style={{ color: '#c4b5fd' }}
                        onClick={() => {
                          setMenuOpenId(null);
                          onPlayWithTemplate(tpl);
                        }}
                      >
                        Select for Match
                      </button>
                      <button
                        type="button"
                        className="ens-tpl-pop-item"
                        onClick={async () => {
                          setMenuOpenId(null);
                          const dup = await onDuplicateTemplate(tpl.id);
                          loadIntoEditor(dup);
                          onNotify(`Duplicated "${tpl.name}"`);
                        }}
                      >
                        Duplicate
                      </button>
                      {tpl.status !== 'official' && (
                        <button
                          type="button"
                          className="ens-tpl-pop-item"
                          style={{ color: '#fda4af' }}
                          onClick={async () => {
                            setMenuOpenId(null);
                            await onDeleteTemplate(tpl.id);
                            onNotify(`Deleted "${tpl.name}"`);
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Compact Live Template Editor */}
        <div className="ens-editor-card">
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => setEditorCollapsed((c) => !c)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
              <Pencil size={15} color="#f0abfc" />
              <span>Edit Template: {editName || 'Untitled'}</span>
            </div>
            <ChevronUp
              size={18}
              color="#d6dfff"
              style={{ transform: editorCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
            />
          </div>

          {!editorCollapsed && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 7 }}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Template name"
                  className="ens-word-input"
                  style={{ textTransform: 'none', fontSize: 13 }}
                />
                <input
                  type="text"
                  value={editTheme}
                  onChange={(e) => setEditTheme(e.target.value)}
                  placeholder="Theme"
                  className="ens-word-input"
                  style={{ textTransform: 'none', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {editWords.map((word, idx) => (
                  <div key={idx} className="ens-word-input-row">
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: '#cdd6ff' }}>
                      Word {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={word}
                      onChange={(e) => handleWordChange(idx, e.target.value)}
                      placeholder="WORD"
                      className="ens-word-input"
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        type="button"
                        className="ens-reorder-btn"
                        onClick={() => moveWord(idx, -1)}
                        disabled={idx === 0}
                        title="Move up"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        className="ens-reorder-btn"
                        onClick={() => moveWord(idx, 1)}
                        disabled={idx === editWords.length - 1}
                        title="Move down"
                      >
                        <ArrowDown size={13} />
                      </button>
                      {editWords.length > 3 ? (
                        <button
                          type="button"
                          className="ens-delete-word-btn"
                          onClick={() => setEditWords(editWords.filter((_, i) => i !== idx))}
                          title="Remove word"
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <GripVertical size={15} color="#9aa6e8" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 7 }}>
                  <button
                    type="button"
                    className="ens-add-word-btn"
                    onClick={() => setEditWords([...editWords, ''])}
                  >
                    + Add Word
                  </button>
                  <button
                    type="button"
                    className="ens-gen-chain-btn"
                    onClick={async () => {
                      try {
                        const gen = await api.generateChain(
                          editTheme || 'Adventure',
                          Math.max(4, editWords.length),
                          editWords.filter(Boolean)
                        );
                        setIsCreatingNew(true);
                        setEditingId(undefined);
                        setEditName(gen.name);
                        setEditTheme(gen.theme);
                        setEditWords(gen.words);
                        onNotify(`Generated "${gen.name}"!`);
                      } catch (err: any) {
                        onNotify(err.message || 'Could not generate chain');
                      }
                    }}
                  >
                    <Sparkles size={13} />
                    <span>Generate Chain</span>
                  </button>
                </div>
                <button
                  type="button"
                  className="ens-draft-link-btn"
                  onClick={() => handleSave('draft')}
                >
                  Save as Draft
                </button>
              </div>

              {/* Live Phrase Preview */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: '#cdd6ff', marginBottom: 4 }}>
                  <Eye size={14} />
                  <span>Preview (Links)</span>
                </div>
                <div className="ens-link-preview-strip">
                  {linkPairs.length === 0 ? (
                    <span style={{ fontSize: 11.5, color: '#9aa6e8' }}>Enter words above to preview links</span>
                  ) : (
                    linkPairs.map((pair, i) => (
                      <React.Fragment key={i}>
                        <span className="ens-link-pill">{pair}</span>
                        {i < linkPairs.length - 1 && <ArrowRight size={13} color="#a5b4fc" style={{ flexShrink: 0 }} />}
                      </React.Fragment>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom 3 Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr 1fr', gap: 8 }}>
          <button type="button" className="ens-btn-green" onClick={() => handleSave('saved')}>
            <span>Save</span>
            <Check size={15} strokeWidth={3} />
          </button>
          <button type="button" className="ens-btn-white" onClick={handleDuplicate}>
            <Copy size={14} />
            <span>Duplicate</span>
          </button>
          <button type="button" className="ens-btn-purple" onClick={handlePlay}>
            <span>Play</span>
            <Play size={14} fill="#fff" />
          </button>
        </div>
      </div>

      <div className="ens-home-bottom-art" aria-hidden="true">
        <img src="/art/home-bottom-landscape.png" alt="" className="ens-home-bottom-img" />
      </div>
    </div>
  );
};
