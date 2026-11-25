import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Layers,
  Play,
  Plus,
  Repeat,
  RotateCw,
  Save,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  ChangeItCustomPuzzleValidation,
  Profile,
  Template,
  ThumbnailKey,
} from '../../shared/types';
import { GuessItCategory, GuessItDifficulty } from '../../shared/guessit/types';
import { canFormFromLetters, TWISTIT_PUZZLE_CATALOG } from '../../shared/twistit/catalog';
import { api } from '../services/api';

export type ScopedTemplateGame = 'guessit' | 'changeit' | 'twistit';

export interface GuessItCustomPack {
  id: string;
  name: string;
  category: GuessItCategory;
  difficulty: GuessItDifficulty;
  answer: string;
  clue: string;
  createdAt: number;
}

export interface TwistItCustomPuzzle {
  id: string;
  name: string;
  baseWord: string;
  answers: string[];
  createdAt: number;
}

const GUESSIT_CATEGORIES: GuessItCategory[] = [
  'Movies',
  'Animals',
  'Food',
  'Science',
  'Geography',
  'Gaming',
  'History',
  'General Knowledge',
];

const OFFICIAL_CHANGEIT_LADDERS = [
  { id: 'ci_off_1', name: 'Classic Frost', startWord: 'COLD', targetWord: 'WARM', minMoves: 4 },
  { id: 'ci_off_2', name: 'End to End', startWord: 'HEAD', targetWord: 'TAIL', minMoves: 5 },
  { id: 'ci_off_3', name: 'Dawn Spark', startWord: 'DARK', targetWord: 'GLOW', minMoves: 5 },
  { id: 'ci_off_4', name: 'Elemental Shift', startWord: 'FIRE', targetWord: 'COLD', minMoves: 5 },
  { id: 'ci_off_5', name: 'Inner Light', startWord: 'MIND', targetWord: 'SOUL', minMoves: 5 },
  { id: 'ci_off_6', name: 'Royal Forge', startWord: 'STONE', targetWord: 'CROWN', minMoves: 7 },
];

const OFFICIAL_GUESSIT_PACKS: GuessItCustomPack[] = [
  { id: 'gi_off_1', name: 'Sci-Fi Classic', category: 'Movies', difficulty: 'easy', answer: 'STAR WARS', clue: 'Galactic saga', createdAt: 1 },
  { id: 'gi_off_2', name: 'Ocean Giant', category: 'Animals', difficulty: 'easy', answer: 'BLUE WHALE', clue: 'Largest mammal on Earth', createdAt: 2 },
  { id: 'gi_off_3', name: 'Solar Power', category: 'Science', difficulty: 'medium', answer: 'GRAVITY', clue: 'Keeps planets in orbit', createdAt: 3 },
  { id: 'gi_off_4', name: 'World Wonder', category: 'Geography', difficulty: 'hard', answer: 'MACHU PICCHU', clue: 'Incan citadel in Peru', createdAt: 4 },
];

const OFFICIAL_TWISTIT_PUZZLES: TwistItCustomPuzzle[] = TWISTIT_PUZZLE_CATALOG.slice(0, 6).map(
  (p, idx) => ({
    id: `tw_off_${idx}`,
    name: `${p.baseWord} Set`,
    baseWord: p.baseWord,
    answers: p.answers,
    createdAt: idx + 1,
  })
);

function loadLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveLocalJson<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore storage errors
  }
}

interface GameTemplatesScreenProps {
  game: ScopedTemplateGame;
  profile: Profile;
  templates: Template[];
  onBack: () => void;
  onSaveChainItStyleTemplate: (tpl: {
    id?: string;
    ownerId: string;
    name: string;
    theme: string;
    thumbnailKey: ThumbnailKey;
    words: string[];
    status: 'saved' | 'draft';
  }) => Promise<Template>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onPlayChangeItCustom: (startWord: string, targetWord: string) => Promise<void>;
  onPlayGuessItCustom: (pack: GuessItCustomPack) => Promise<void>;
  onPlayTwistItCustom: (baseWord: string, answers: string[]) => Promise<void>;
  onNotify: (msg: string) => void;
}

export const GameTemplatesScreen: React.FC<GameTemplatesScreenProps> = ({
  game,
  profile,
  templates,
  onBack,
  onSaveChainItStyleTemplate,
  onDeleteTemplate,
  onPlayChangeItCustom,
  onPlayGuessItCustom,
  onPlayTwistItCustom,
  onNotify,
}) => {
  const [tab, setTab] = useState<'mine' | 'official'>('mine');
  const [busy, setBusy] = useState(false);

  // ChangeIt state
  const [ciStart, setCiStart] = useState('');
  const [ciTarget, setCiTarget] = useState('');
  const [ciValidation, setCiValidation] = useState<ChangeItCustomPuzzleValidation | null>(null);
  const [ciValidating, setCiValidating] = useState(false);

  // GuessIt state
  const guessKey = `enscribe_guessit_custom_packs_v1_${profile.id}`;
  const [guessPacks, setGuessPacks] = useState<GuessItCustomPack[]>(() =>
    loadLocalJson<GuessItCustomPack[]>(guessKey, [])
  );
  const [giName, setGiName] = useState('');
  const [giCategory, setGiCategory] = useState<GuessItCategory>('Movies');
  const [giDifficulty, setGiDifficulty] = useState<GuessItDifficulty>('medium');
  const [giAnswer, setGiAnswer] = useState('');
  const [giClue, setGiClue] = useState('');

  // TwistIt state
  const twistKey = `enscribe_twistit_custom_puzzles_v1_${profile.id}`;
  const [twistPuzzles, setTwistPuzzles] = useState<TwistItCustomPuzzle[]>(() =>
    loadLocalJson<TwistItCustomPuzzle[]>(twistKey, [])
  );
  const [twName, setTwName] = useState('');
  const [twBase, setTwBase] = useState('');
  const [twWordsRaw, setTwWordsRaw] = useState('');

  const myChangeItTemplates = useMemo(
    () =>
      templates.filter(
        (t) =>
          t.ownerId === profile.id &&
          t.theme.toLowerCase() === 'changeit' &&
          t.words.length === 2
      ),
    [templates, profile.id]
  );

  const meta =
    game === 'changeit'
      ? {
          title: 'ChangeIt Templates',
          subtitle: 'Custom word-ladder pairs & starter ladders',
          icon: <Repeat size={18} color="#22d3ee" />,
        }
      : game === 'guessit'
        ? {
            title: 'GuessIt Word Packs',
            subtitle: 'Custom words, phrases & clues for GuessIt',
            icon: <Sparkles size={18} color="#fde047" />,
          }
        : {
            title: 'TwistIt Puzzles',
            subtitle: 'Custom 6-letter anagram sets for TwistIt',
            icon: <RotateCw size={18} color="#c084fc" />,
          };

  const handleValidateChangeIt = async () => {
    setCiValidating(true);
    try {
      const res = await api.validateChangeItPuzzle(ciStart, ciTarget);
      setCiValidation(res);
    } catch (err: any) {
      setCiValidation({
        valid: false,
        startWord: ciStart.toUpperCase(),
        targetWord: ciTarget.toUpperCase(),
        wordLength: ciStart.length,
        minMoves: null,
        familiarPathAvailable: false,
        error: err?.message || 'Validation failed',
      });
    } finally {
      setCiValidating(false);
    }
  };

  const handleSaveChangeIt = async () => {
    if (!ciValidation?.valid) return;
    setBusy(true);
    try {
      await onSaveChainItStyleTemplate({
        ownerId: profile.id,
        name: `${ciValidation.startWord} → ${ciValidation.targetWord}`,
        theme: 'ChangeIt',
        thumbnailKey: 'custom',
        words: [ciValidation.startWord, ciValidation.targetWord],
        status: 'saved',
      });
      setCiStart('');
      setCiTarget('');
      setCiValidation(null);
      setTab('mine');
      onNotify(`Saved ChangeIt puzzle ${ciValidation.startWord} → ${ciValidation.targetWord}!`);
    } catch (err: any) {
      onNotify(err?.message || 'Could not save puzzle');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveGuessPack = () => {
    const cleanAnswer = giAnswer.trim().toUpperCase().replace(/\s+/g, ' ');
    if (cleanAnswer.replace(/[^A-Z]/g, '').length < 3) {
      onNotify('Enter an English word or phrase with at least 3 letters.');
      return;
    }
    const nextPack: GuessItCustomPack = {
      id: `gi_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: giName.trim() || `${giCategory} Pack`,
      category: giCategory,
      difficulty: giDifficulty,
      answer: cleanAnswer,
      clue: giClue.trim().slice(0, 120),
      createdAt: Date.now(),
    };
    const next = [nextPack, ...guessPacks];
    setGuessPacks(next);
    saveLocalJson(guessKey, next);
    setGiName('');
    setGiAnswer('');
    setGiClue('');
    setTab('mine');
    onNotify(`Saved GuessIt pack "${nextPack.name}"!`);
  };

  const handleSaveTwistPuzzle = () => {
    const cleanBase = twBase.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (cleanBase.length !== 6) {
      onNotify('Base word must be exactly 6 English letters.');
      return;
    }
    const letters = cleanBase.split('');
    const parsed = Array.from(
      new Set(
        twWordsRaw
          .split(/[\s,;\n]+/)
          .map((w) => w.replace(/[^a-zA-Z]/g, '').toUpperCase())
          .filter((w) => w.length >= 3 && w.length <= 6 && canFormFromLetters(w, letters))
      )
    );
    if (!parsed.includes(cleanBase)) parsed.push(cleanBase);
    if (parsed.length < 3) {
      onNotify('Add at least 3 valid words (3–6 letters) formed from the 6 base letters.');
      return;
    }
    const nextPuzzle: TwistItCustomPuzzle = {
      id: `tw_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: twName.trim() || `${cleanBase} Custom`,
      baseWord: cleanBase,
      answers: parsed.sort((a, b) => a.length - b.length || a.localeCompare(b)),
      createdAt: Date.now(),
    };
    const next = [nextPuzzle, ...twistPuzzles];
    setTwistPuzzles(next);
    saveLocalJson(twistKey, next);
    setTwName('');
    setTwBase('');
    setTwWordsRaw('');
    setTab('mine');
    onNotify(`Saved TwistIt puzzle "${nextPuzzle.name}" (${nextPuzzle.answers.length} words)!`);
  };

  return (
    <div className="ci-shell">
      <div className="ens-sky-sparkles" aria-hidden="true" />
      <header className="ci-topbar">
        <button type="button" className="ci-icon-btn" onClick={onBack} aria-label={`Back to ${game}`}>
          <ArrowLeft size={18} strokeWidth={2.8} />
        </button>
        <div style={{ textAlign: 'center', minWidth: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 16.5, fontWeight: 900 }}>
            {meta.icon}
            <span>{meta.title}</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a5f3fc' }}>{meta.subtitle}</div>
        </div>
        <div style={{ width: 36 }} />
      </header>

      <div className="ci-scroll">
        <div className="ci-wrap">
          {/* Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              onClick={() => setTab('mine')}
              className={tab === 'mine' ? 'ci-cta-cyan' : 'ci-pill'}
              style={{ minHeight: 38, justifyContent: 'center', cursor: 'pointer' }}
            >
              <Layers size={14} />
              <span>My {meta.title}</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('official')}
              className={tab === 'official' ? 'ci-cta-cyan' : 'ci-pill'}
              style={{ minHeight: 38, justifyContent: 'center', cursor: 'pointer' }}
            >
              <Sparkles size={14} />
              <span>Official Presets</span>
            </button>
          </div>

          {/* CHANGEIT TEMPLATES */}
          {game === 'changeit' && (
            <>
              <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="ci-card-title">
                  <span>Create ChangeIt Word Ladder</span>
                  <Plus size={15} color="#67e8f9" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input
                    type="text"
                    value={ciStart}
                    onChange={(e) => {
                      setCiStart(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6));
                      setCiValidation(null);
                    }}
                    placeholder="Start (e.g. COLD)"
                    className="ens-fantasy-input"
                    style={{ minHeight: 40, fontWeight: 900, letterSpacing: '0.08em' }}
                  />
                  <input
                    type="text"
                    value={ciTarget}
                    onChange={(e) => {
                      setCiTarget(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6));
                      setCiValidation(null);
                    }}
                    placeholder="Target (e.g. WARM)"
                    className="ens-fantasy-input"
                    style={{ minHeight: 40, fontWeight: 900, letterSpacing: '0.08em' }}
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  <button
                    type="button"
                    disabled={ciValidating || ciStart.length < 3 || ciTarget.length < 3}
                    onClick={handleValidateChangeIt}
                    className="ci-pill is-cyan"
                    style={{ cursor: 'pointer', padding: '7px 12px' }}
                  >
                    {ciValidating ? 'Checking...' : 'Validate Ladder'}
                  </button>
                  {ciValidation?.valid && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleSaveChangeIt}
                        className="ci-pill is-green"
                        style={{ cursor: 'pointer', padding: '7px 12px' }}
                      >
                        <Save size={13} />
                        <span>Save ({ciValidation.minMoves} min moves)</span>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onPlayChangeItCustom(ciValidation.startWord, ciValidation.targetWord)}
                        className="ci-pill is-violet"
                        style={{ cursor: 'pointer', padding: '7px 12px' }}
                      >
                        <Play size={13} fill="currentColor" />
                        <span>Play Solo</span>
                      </button>
                    </>
                  )}
                </div>
                {ciValidation && !ciValidation.valid && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#fda4af' }}>
                    <XCircle size={14} />
                    <span>{ciValidation.error}</span>
                  </div>
                )}
                {ciValidation?.valid && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#6ee7b7' }}>
                    <CheckCircle2 size={14} />
                    <span>
                      Verified! {ciValidation.startWord} → {ciValidation.targetWord} ({ciValidation.minMoves} minimum moves)
                    </span>
                  </div>
                )}
              </div>

              {tab === 'mine' ? (
                myChangeItTemplates.length === 0 ? (
                  <div className="ci-card" style={{ textAlign: 'center', color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>
                    No saved ChangeIt ladders yet. Validate &amp; save any 3–6 letter pair above!
                  </div>
                ) : (
                  myChangeItTemplates.map((tpl) => (
                    <div key={tpl.id} className="ci-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '0.06em' }}>
                          {tpl.words[0]} → {tpl.words[1]}
                        </div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#93c5fd' }}>
                          {tpl.words[0].length} letters • ChangeIt Custom
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => onPlayChangeItCustom(tpl.words[0], tpl.words[1])}
                          className="ci-pill is-green"
                          style={{ cursor: 'pointer', padding: '6px 11px' }}
                        >
                          <Play size={13} fill="currentColor" />
                          <span>Play</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTemplate(tpl.id)}
                          className="ci-icon-btn"
                          aria-label="Delete template"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )
              ) : (
                OFFICIAL_CHANGEIT_LADDERS.map((p) => (
                  <div key={p.id} className="ci-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '0.06em' }}>
                        {p.startWord} → {p.targetWord}
                      </div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#93c5fd' }}>
                        {p.name} • Min {p.minMoves} moves
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPlayChangeItCustom(p.startWord, p.targetWord)}
                      className="ci-pill is-cyan"
                      style={{ cursor: 'pointer', padding: '6px 12px' }}
                    >
                      <Play size={13} fill="currentColor" />
                      <span>Play</span>
                    </button>
                  </div>
                ))
              )}
            </>
          )}

          {/* GUESSIT TEMPLATES */}
          {game === 'guessit' && (
            <>
              <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="ci-card-title">
                  <span>Create GuessIt Word Pack</span>
                  <Plus size={15} color="#fde047" />
                </div>
                <input
                  type="text"
                  value={giName}
                  onChange={(e) => setGiName(e.target.value.slice(0, 36))}
                  placeholder="Pack Name (e.g. Movie Night)"
                  className="ens-fantasy-input"
                  style={{ minHeight: 38 }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <select
                    value={giCategory}
                    onChange={(e) => setGiCategory(e.target.value as GuessItCategory)}
                    className="ens-select-pill"
                    style={{ height: 38, width: '100%' }}
                  >
                    {GUESSIT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <select
                    value={giDifficulty}
                    onChange={(e) => setGiDifficulty(e.target.value as GuessItDifficulty)}
                    className="ens-select-pill"
                    style={{ height: 38, width: '100%' }}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={giAnswer}
                  onChange={(e) => setGiAnswer(e.target.value.toUpperCase().slice(0, 42))}
                  placeholder="Secret Word or Phrase (e.g. JURASSIC PARK)"
                  className="ens-fantasy-input"
                  style={{ minHeight: 38, fontWeight: 800 }}
                />
                <input
                  type="text"
                  value={giClue}
                  onChange={(e) => setGiClue(e.target.value.slice(0, 120))}
                  placeholder="Optional Clue (e.g. Dinosaur theme park)"
                  className="ens-fantasy-input"
                  style={{ minHeight: 38 }}
                />
                <button
                  type="button"
                  onClick={handleSaveGuessPack}
                  className="ci-cta-green"
                  style={{ minHeight: 40 }}
                >
                  <Save size={15} />
                  <span>Save GuessIt Word Pack</span>
                </button>
              </div>

              {(tab === 'mine' ? guessPacks : OFFICIAL_GUESSIT_PACKS).length === 0 ? (
                <div className="ci-card" style={{ textAlign: 'center', color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>
                  No saved GuessIt word packs yet. Create one above!
                </div>
              ) : (
                (tab === 'mine' ? guessPacks : OFFICIAL_GUESSIT_PACKS).map((pack) => (
                  <div key={pack.id} className="ci-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 900 }}>{pack.name}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#93c5fd' }}>
                        {pack.category} • {pack.difficulty.toUpperCase()} • {pack.answer.length} chars
                      </div>
                      {pack.clue && (
                        <div style={{ fontSize: 11, color: '#fde68a', marginTop: 2 }}>
                          Clue: {pack.clue}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => onPlayGuessItCustom(pack)}
                        className="ci-pill is-green"
                        style={{ cursor: 'pointer', padding: '6px 11px' }}
                      >
                        <Play size={13} fill="currentColor" />
                        <span>Play</span>
                      </button>
                      {tab === 'mine' && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = guessPacks.filter((p) => p.id !== pack.id);
                            setGuessPacks(next);
                            saveLocalJson(guessKey, next);
                          }}
                          className="ci-icon-btn"
                          aria-label="Delete word pack"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* TWISTIT TEMPLATES */}
          {game === 'twistit' && (
            <>
              <div className="ci-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="ci-card-title">
                  <span>Create TwistIt 6-Letter Puzzle</span>
                  <Plus size={15} color="#c084fc" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input
                    type="text"
                    value={twName}
                    onChange={(e) => setTwName(e.target.value.slice(0, 32))}
                    placeholder="Puzzle Name"
                    className="ens-fantasy-input"
                    style={{ minHeight: 38 }}
                  />
                  <input
                    type="text"
                    value={twBase}
                    onChange={(e) =>
                      setTwBase(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6))
                    }
                    placeholder="6-Letter Base (PLANET)"
                    className="ens-fantasy-input"
                    style={{ minHeight: 38, fontWeight: 900, letterSpacing: '0.08em' }}
                  />
                </div>
                <textarea
                  value={twWordsRaw}
                  onChange={(e) => setTwWordsRaw(e.target.value.toUpperCase())}
                  placeholder="Valid 3–6 letter answers separated by commas (e.g. ANT, APE, EAT, LAP, LATE, LANE, LEAP, PALE, PLAN, PLANT, PLATE, PLANET)"
                  rows={3}
                  className="ens-fantasy-input"
                  style={{ fontSize: 12.5, padding: 10 }}
                />
                <button
                  type="button"
                  onClick={handleSaveTwistPuzzle}
                  className="ci-cta-green"
                  style={{ minHeight: 40 }}
                >
                  <Save size={15} />
                  <span>Save TwistIt Puzzle</span>
                </button>
              </div>

              {(tab === 'mine' ? twistPuzzles : OFFICIAL_TWISTIT_PUZZLES).length === 0 ? (
                <div className="ci-card" style={{ textAlign: 'center', color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>
                  No saved TwistIt puzzles yet. Create a 6-letter set above or play an Official Preset!
                </div>
              ) : (
                (tab === 'mine' ? twistPuzzles : OFFICIAL_TWISTIT_PUZZLES).map((pz) => (
                  <div key={pz.id} className="ci-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 900 }}>{pz.name}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#93c5fd' }}>
                        6 Letters • {pz.answers.length} hidden words
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => onPlayTwistItCustom(pz.baseWord, pz.answers)}
                        className="ci-pill is-green"
                        style={{ cursor: 'pointer', padding: '6px 11px' }}
                      >
                        <Play size={13} fill="currentColor" />
                        <span>Play</span>
                      </button>
                      {tab === 'mine' && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = twistPuzzles.filter((p) => p.id !== pz.id);
                            setTwistPuzzles(next);
                            saveLocalJson(twistKey, next);
                          }}
                          className="ci-icon-btn"
                          aria-label="Delete TwistIt puzzle"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
