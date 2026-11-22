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
  Trash2,
} from 'lucide-react';
import { Profile, Template, TemplateStatus, ThumbnailKey } from '../../shared/types';
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
      {/* Top Royal Header */}
      <header className="ens-royal-topbar">
        <div style={{ width: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Layers size={20} color="#a5b4fc" />
        </div>
        <span style={{ fontSize: 19, fontWeight: 800 }}>My Templates</span>
        <button
          type="button"
          onClick={handleCreateNew}
          aria-label="Create new template"
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            border: 'none',
            background: '#ffffff',
            color: '#17204d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          <Plus size={20} strokeWidth={2.8} />
        </button>
      </header>

      {/* Body Sheet */}
      <div className="ens-sheet-body">
        {/* Segmented Tabs */}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myTemplates.length === 0 ? (
            <div className="ens-white-card" style={{ textAlign: 'center', padding: 16, fontSize: 13, color: '#647096' }}>
              No templates here yet. Tap <strong>+</strong> to craft your own chain!
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
                  <TemplateThumb thumbnailKey={tpl.thumbnailKey} size={52} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#17204d' }}>{tpl.name}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#647096', marginTop: 1 }}>
                      {tpl.words.length} words • {tpl.theme}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span className={tpl.status === 'draft' ? 'ens-pill-creating' : 'ens-pill-ready'} style={{ padding: '2px 8px', fontSize: 11 }}>
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === tpl.id ? null : tpl.id);
                    }}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      border: '1px solid #e2e6f5',
                      background: '#f5f6fc',
                      color: '#5a6385',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    aria-label="Template options"
                  >
                    <MoreHorizontal size={16} />
                  </button>

                  {menuOpenId === tpl.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: 48,
                        background: '#ffffff',
                        borderRadius: 12,
                        border: '1px solid #d9dff4',
                        boxShadow: '0 8px 24px rgba(15, 23, 66, 0.18)',
                        zIndex: 25,
                        padding: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: 145,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => loadIntoEditor(tpl)}
                        style={{ border: 'none', background: 'transparent', textAlign: 'left', padding: '7px 10px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
                      >
                        Edit Template
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpenId(null);
                          onPlayWithTemplate(tpl);
                        }}
                        style={{ border: 'none', background: 'transparent', textAlign: 'left', padding: '7px 10px', fontWeight: 700, fontSize: 12.5, color: '#5b3df5', cursor: 'pointer' }}
                      >
                        Select for Match
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setMenuOpenId(null);
                          const dup = await onDuplicateTemplate(tpl.id);
                          loadIntoEditor(dup);
                          onNotify(`Duplicated "${tpl.name}"`);
                        }}
                        style={{ border: 'none', background: 'transparent', textAlign: 'left', padding: '7px 10px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
                      >
                        Duplicate
                      </button>
                      {tpl.status !== 'official' && (
                        <button
                          type="button"
                          onClick={async () => {
                            setMenuOpenId(null);
                            await onDeleteTemplate(tpl.id);
                            onNotify(`Deleted "${tpl.name}"`);
                          }}
                          style={{ border: 'none', background: 'transparent', textAlign: 'left', padding: '7px 10px', fontWeight: 700, fontSize: 12.5, color: '#dc2626', cursor: 'pointer' }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14.5, fontWeight: 800 }}>
              <Pencil size={15} color="#5b3df5" />
              <span>Edit Template: {editName || 'Untitled'}</span>
            </div>
            <ChevronUp
              size={18}
              style={{ transform: editorCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
            />
          </div>

          {!editorCollapsed && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 6 }}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Template name"
                  className="ens-word-input"
                  style={{ textTransform: 'none', fontSize: 12.5 }}
                />
                <input
                  type="text"
                  value={editTheme}
                  onChange={(e) => setEditTheme(e.target.value)}
                  placeholder="Theme"
                  className="ens-word-input"
                  style={{ textTransform: 'none', fontSize: 12.5 }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {editWords.map((word, idx) => (
                  <div key={idx} className="ens-word-input-row">
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#4d5780' }}>
                      Word {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={word}
                      onChange={(e) => handleWordChange(idx, e.target.value)}
                      placeholder="WORD"
                      className="ens-word-input"
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <button
                        type="button"
                        onClick={() => moveWord(idx, -1)}
                        disabled={idx === 0}
                        style={{ border: 'none', background: '#f0f2fb', borderRadius: 6, padding: 4, cursor: 'pointer' }}
                        title="Move up"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveWord(idx, 1)}
                        disabled={idx === editWords.length - 1}
                        style={{ border: 'none', background: '#f0f2fb', borderRadius: 6, padding: 4, cursor: 'pointer' }}
                        title="Move down"
                      >
                        <ArrowDown size={13} />
                      </button>
                      {editWords.length > 3 ? (
                        <button
                          type="button"
                          onClick={() => setEditWords(editWords.filter((_, i) => i !== idx))}
                          style={{ border: 'none', background: '#fee2e2', color: '#dc2626', borderRadius: 6, padding: 4, cursor: 'pointer' }}
                          title="Remove word"
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <GripVertical size={15} color="#94a3b8" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setEditWords([...editWords, ''])}
                  style={{
                    border: '1px dashed #8b5cf6',
                    background: '#f5f2ff',
                    color: '#5b3df5',
                    borderRadius: 9,
                    padding: '5px 10px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  + Add Word
                </button>
                <button
                  type="button"
                  onClick={() => handleSave('draft')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#5b3df5',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Save as Draft
                </button>
              </div>

              {/* Live Phrase Preview */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#5d678c', marginBottom: 4 }}>
                  <Eye size={14} />
                  <span>Preview (Links)</span>
                </div>
                <div className="ens-link-preview-strip">
                  {linkPairs.length === 0 ? (
                    <span style={{ fontSize: 11.5, color: '#94a3b8' }}>Enter words above to preview links</span>
                  ) : (
                    linkPairs.map((pair, i) => (
                      <React.Fragment key={i}>
                        <span className="ens-link-pill">{pair}</span>
                        {i < linkPairs.length - 1 && <ArrowRight size={13} color="#7c87b0" style={{ flexShrink: 0 }} />}
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
    </div>
  );
};
