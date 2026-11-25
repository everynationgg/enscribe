import {
  ChainItPracticeConfig,
  GuessResult,
  MatchStateClient,
  Profile,
  RoomRules,
  SanitizedWordSlot,
  SoloStage,
  Template,
} from '../../../shared/types';
import {
  CHAIN_SYNONYMS,
  ChainHistoryTracker,
  generateUniqueGraphChain,
} from '../../../shared/chainit/wordGraph';
import { loadGuestCompletedSoloStages, markGuestSoloStageCompleted } from '../../services/session';

const offlineChainHistory = new ChainHistoryTracker();

const OFFLINE_SOLO_CATALOG: Array<Omit<SoloStage, 'completed'> & { words: string[] }> = [
  {
    id: 'solo_fantasy_1',
    theme: 'Fantasy',
    stageNumber: 1,
    title: 'Dragon Keep',
    subtitle: 'Realm of fire, storms, and ancient castles',
    thumbnailKey: 'castle',
    templateId: 'tpl_official_fantasy_1',
    wordCount: 5,
    words: ['DRAGON', 'FIRE', 'STORM', 'CLOUD', 'CASTLE'],
  },
  {
    id: 'solo_scifi_1',
    theme: 'Science Fiction',
    stageNumber: 2,
    title: 'Starlight Orbit',
    subtitle: 'Deep space wrecks and stellar voyages',
    thumbnailKey: 'scifi',
    templateId: 'tpl_official_scifi_1',
    wordCount: 5,
    words: ['STAR', 'SHIP', 'WRECK', 'DIVER', 'DOWN'],
  },
  {
    id: 'solo_myth_1',
    theme: 'Mythology',
    stageNumber: 3,
    title: 'Thunder Olympus',
    subtitle: 'Gods, titans, and timeless legends',
    thumbnailKey: 'myth',
    templateId: 'tpl_official_myth_1',
    wordCount: 5,
    words: ['THUNDER', 'GOD', 'FATHER', 'TIME', 'KEEPER'],
  },
  {
    id: 'solo_horror_1',
    theme: 'Horror',
    stageNumber: 4,
    title: 'Midnight Manor',
    subtitle: 'Ghostly halls and haunted mirrors',
    thumbnailKey: 'horror',
    templateId: 'tpl_official_horror_1',
    wordCount: 5,
    words: ['GHOST', 'TOWN', 'HALL', 'MIRROR', 'IMAGE'],
  },
  {
    id: 'solo_nature_1',
    theme: 'Nature',
    stageNumber: 5,
    title: 'Wild River',
    subtitle: 'Waterfalls, forests, and untamed trails',
    thumbnailKey: 'nature',
    templateId: 'tpl_official_nature_1',
    wordCount: 5,
    words: ['WATER', 'FALL', 'RIVER', 'BANK', 'VAULT'],
  },
  {
    id: 'solo_school_1',
    theme: 'School Life',
    stageNumber: 6,
    title: 'Campus Express',
    subtitle: 'Classic morning commute to the arts center',
    thumbnailKey: 'school',
    templateId: 'tpl_official_school_ext',
    wordCount: 8,
    words: ['HIGH', 'SCHOOL', 'BUS', 'STOP', 'SIGN', 'LANGUAGE', 'ARTS', 'CENTER'],
  },
];

const OFFLINE_SYNONYMS: Record<string, string> = {
  HIGH: 'TALL',
  SCHOOL: 'ACADEMY',
  BUS: 'SHUTTLE',
  STOP: 'HALT',
  SIGN: 'SYMBOL',
  LANGUAGE: 'TONGUE',
  ARTS: 'CRAFTS',
  CENTER: 'HUB',
  DRAGON: 'WYVERN',
  FIRE: 'FLAME',
  STORM: 'TEMPEST',
  CLOUD: 'MIST',
  CASTLE: 'FORTRESS',
  STAR: 'CELESTIAL',
  SHIP: 'VESSEL',
  WRECK: 'RUIN',
  DIVER: 'SWIMMER',
  DOWN: 'BELOW',
  THUNDER: 'ROAR',
  GOD: 'DEITY',
  FATHER: 'SIRE',
  TIME: 'CLOCK',
  KEEPER: 'GUARDIAN',
  GHOST: 'PHANTOM',
  TOWN: 'VILLAGE',
  HALL: 'CORRIDOR',
  MIRROR: 'GLASS',
  IMAGE: 'PICTURE',
  WATER: 'AQUA',
  FALL: 'DROP',
  RIVER: 'STREAM',
  BANK: 'SHORE',
  VAULT: 'SAFE',
};

const OFFLINE_SOLO_RULES: RoomRules = {
  gameType: 'chain_clash',
  mode: 'classic',
  maxPlayers: 1,
  chainLength: 5,
  timePerWordSeconds: 0,
  timerEnabled: false,
  puzzleSource: 'curated_db',
  chainVisibility: 'full_chain',
  wordLengthVisible: true,
  autoRevealAfterAttempts: 2,
  autoRevealAfterPasses: 0,
  autoRevealAfterFailedTurns: 2,
  opponentVisibility: 'minimal',
  difficultyPreset: 'casual',
};

const PRACTICE_THEMES = [
  'Everyday',
  'Fantasy',
  'Science Fiction',
  'Nature',
  'Food',
  'Sports',
  'Music',
  'Mystery',
  'Animals',
  'Travel',
  'Ocean',
  'Adventure',
];

export interface ChainItPracticeStats {
  chainsCompleted: number;
  wordsSolved: number;
  currentStreak: number;
  bestStreak: number;
}

const DEFAULT_PRACTICE_STATS: ChainItPracticeStats = {
  chainsCompleted: 0,
  wordsSolved: 0,
  currentStreak: 0,
  bestStreak: 0,
};

export function loadChainItPracticeStats(playerId: string): ChainItPracticeStats {
  if (typeof window === 'undefined' || !playerId) return { ...DEFAULT_PRACTICE_STATS };
  try {
    const raw = window.localStorage.getItem(`enscribe_chainit_practice_stats_v1_${playerId}`);
    if (!raw) return { ...DEFAULT_PRACTICE_STATS };
    const parsed = JSON.parse(raw) as Partial<ChainItPracticeStats>;
    return {
      chainsCompleted: Number(parsed.chainsCompleted) || 0,
      wordsSolved: Number(parsed.wordsSolved) || 0,
      currentStreak: Number(parsed.currentStreak) || 0,
      bestStreak: Number(parsed.bestStreak) || 0,
    };
  } catch {
    return { ...DEFAULT_PRACTICE_STATS };
  }
}

export function recordChainItPracticeChainComplete(
  playerId: string,
  wordsSolvedDelta: number,
  skippedAny: boolean
): ChainItPracticeStats {
  const prev = loadChainItPracticeStats(playerId);
  const nextStreak = skippedAny ? 0 : prev.currentStreak + 1;
  const next: ChainItPracticeStats = {
    chainsCompleted: prev.chainsCompleted + 1,
    wordsSolved: prev.wordsSolved + Math.max(0, wordsSolvedDelta),
    currentStreak: nextStreak,
    bestStreak: Math.max(prev.bestStreak, nextStreak),
  };
  if (typeof window !== 'undefined' && playerId) {
    try {
      window.localStorage.setItem(
        `enscribe_chainit_practice_stats_v1_${playerId}`,
        JSON.stringify(next)
      );
    } catch {
      // ignore storage quota errors
    }
  }
  return next;
}

interface OfflineMatchRecord {
  matchId: string;
  stageId: string | null;
  playerId: string;
  username: string;
  avatarId: string;
  title: string;
  theme: string;
  words: string[];
  currentWordIndex: number;
  revealedCounts: number[];
  wrongAttemptsCurrentWord: number;
  earnedMatchPoints: number;
  completedAtMs: number | null;
  createdAt: number;
  updatedAt: number;
  rules: RoomRules;
  practiceConfig?: ChainItPracticeConfig;
  explicitClues: Record<number, string>;
  wordDeadlineMs: number | null;
}

const offlineMatches = new Map<string, OfflineMatchRecord>();

export function getOfflineSoloStages(): SoloStage[] {
  const completed = new Set(loadGuestCompletedSoloStages());
  return OFFLINE_SOLO_CATALOG.map(({ words: _words, ...rest }) => ({
    ...rest,
    completed: completed.has(rest.id),
  }));
}

export function getOfflineOfficialTemplates(): Template[] {
  const now = Date.now();
  return OFFLINE_SOLO_CATALOG.map((s, idx) => ({
    id: s.templateId,
    ownerId: 'system',
    name: s.title,
    theme: s.theme,
    thumbnailKey: s.thumbnailKey,
    words: [...s.words],
    status: 'official',
    createdAt: now - 100000 + idx * 1000,
    updatedAt: now - 100000 + idx * 1000,
  }));
}

function buildOfflineClientState(rec: OfflineMatchRecord): MatchStateClient {
  const isFinished = rec.completedAtMs !== null;
  const threshold =
    rec.rules.autoRevealAfterAttempts > 0 ? rec.rules.autoRevealAfterAttempts : 2;
  const slots: SanitizedWordSlot[] = rec.words.map((word, idx) => {
    const isCompleted = idx < rec.currentWordIndex || isFinished;
    const isActive = !isFinished && idx === rec.currentWordIndex;
    const revealed = Math.min(word.length, Math.max(1, rec.revealedCounts[idx] ?? 1));
    let displayText = word;
    let isUpcomingMasked = false;
    if (!isCompleted) {
      if (!isActive && rec.rules.chainVisibility === 'progressive') {
        isUpcomingMasked = true;
        displayText = Array.from({ length: word.length }, () => '_').join(' ');
      } else {
        const chars: string[] = [];
        for (let i = 0; i < word.length; i++) {
          chars.push(i < revealed ? word[i] : '_');
        }
        displayText = chars.join(' ');
      }
    }
    const explicitClue = rec.explicitClues[idx];
    const clueWord =
      isActive &&
      (Boolean(explicitClue) || revealed >= 2 || rec.wrongAttemptsCurrentWord >= threshold)
        ? explicitClue ?? CHAIN_SYNONYMS[word] ?? OFFLINE_SYNONYMS[word] ?? 'LINK'
        : null;

    return {
      index: idx,
      length: word.length,
      isCompleted,
      isActive,
      isUpcomingMasked,
      displayText,
      revealedLetters: isCompleted ? word.length : revealed,
      clueWord,
    };
  });

  return {
    id: rec.matchId,
    roomId: null,
    gameType: 'chain_clash',
    mode: 'solo',
    title: rec.title,
    theme: rec.theme,
    status: isFinished ? 'finished' : 'active_turns',
    activeTurnPlayerId: null,
    turnOrder: [rec.playerId],
    turnDeadlineMs: null,
    turnStartedAtMs: null,
    turnAwaitingOnline: false,
    speedRaceDeadlines:
      rec.rules.timerEnabled && rec.wordDeadlineMs !== null
        ? { [rec.playerId]: rec.wordDeadlineMs }
        : {},
    winnerId: isFinished ? rec.playerId : null,
    finishOrder: isFinished
      ? [
          {
            playerId: rec.playerId,
            username: rec.username,
            avatarId: rec.avatarId,
            completedAtMs: rec.completedAtMs!,
            rank: 1,
          },
        ]
      : [],
    rules: { ...rec.rules, chainLength: rec.words.length },
    boards: {
      [rec.playerId]: {
        playerId: rec.playerId,
        username: rec.username,
        avatarId: rec.avatarId,
        isWinner: isFinished,
        isOnline: false,
        statusText: isFinished ? 'Winner!' : rec.rules.isPractice ? 'Practice Mode' : 'Solo Offline',
        currentWordIndex: rec.currentWordIndex,
        totalWords: rec.words.length,
        words: slots,
        liveInputPreview: '',
        completedAtMs: rec.completedAtMs,
        wrongAttemptsCurrentWord: rec.wrongAttemptsCurrentWord,
        passesCurrentWord: 0,
        earnedMatchPoints: rec.earnedMatchPoints,
      },
    },
    messages: [],
    serverNowMs: Date.now(),
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
}

export function isOfflineSoloMatchId(matchId: string): boolean {
  return matchId.startsWith('match_offline_');
}

export function getOfflineSoloMatch(matchId: string): MatchStateClient | null {
  const rec = offlineMatches.get(matchId);
  return rec ? buildOfflineClientState(rec) : null;
}

export function startOfflineSoloMatch(
  profile: Profile,
  stageId?: string,
  customTemplate?: Template
): { stageId: string | null; match: MatchStateClient } {
  const completed = new Set(loadGuestCompletedSoloStages());
  const stage = stageId
    ? OFFLINE_SOLO_CATALOG.find((s) => s.id === stageId) ?? OFFLINE_SOLO_CATALOG[0]
    : null;
  const words = customTemplate?.words?.length
    ? customTemplate.words.map((w) => w.toUpperCase())
    : stage
      ? completed.has(stage.id)
        ? generateUniqueGraphChain({
            theme: stage.theme,
            length: stage.wordCount,
            excludeWords: stage.words,
            recentHistory: offlineChainHistory,
          }).words
        : [...stage.words]
      : generateUniqueGraphChain({
          theme: 'Adventure',
          length: 5,
          recentHistory: offlineChainHistory,
        }).words;
  const now = Date.now();
  const matchId = `match_offline_${Math.random().toString(36).slice(2, 10)}`;
  const rec: OfflineMatchRecord = {
    matchId,
    stageId: stage?.id ?? null,
    playerId: profile.id,
    username: profile.username,
    avatarId: profile.avatarId,
    title: stage ? `${stage.theme}: ${stage.title}` : `Solo: ${customTemplate?.name ?? 'ChainIt'}`,
    theme: stage?.theme ?? customTemplate?.theme ?? 'Solo',
    words,
    currentWordIndex: 1,
    revealedCounts: words.map((w, idx) => (idx === 0 ? w.length : 1)),
    wrongAttemptsCurrentWord: 0,
    earnedMatchPoints: 0,
    completedAtMs: null,
    createdAt: now,
    updatedAt: now,
    rules: { ...OFFLINE_SOLO_RULES, chainLength: words.length },
    explicitClues: {},
    wordDeadlineMs: null,
  };
  offlineMatches.set(matchId, rec);
  return {
    stageId: rec.stageId,
    match: buildOfflineClientState(rec),
  };
}

export function startOfflinePracticeMatch(
  profile: Profile,
  config: ChainItPracticeConfig,
  customTemplate?: Template,
  excludeWords?: string[]
): { match: MatchStateClient } {
  const rawTheme = String(config.theme || '').trim();
  const resolvedTheme =
    !rawTheme || rawTheme.toLowerCase() === 'mix' || rawTheme.toLowerCase() === 'random'
      ? PRACTICE_THEMES[Math.floor(Math.random() * PRACTICE_THEMES.length)]
      : rawTheme;
  const length = Math.max(3, Math.min(8, Math.round(config.chainLength || 5)));
  const generated = customTemplate?.words?.length
    ? {
        name: customTemplate.name,
        theme: customTemplate.theme,
        words: customTemplate.words.map((w) => w.toUpperCase()),
      }
    : generateUniqueGraphChain({
        theme: resolvedTheme,
        length,
        excludeWords,
        recentHistory: offlineChainHistory,
      });

  const autoReveal =
    config.difficulty === 'relaxed' ? 1 : config.difficulty === 'challenge' ? 3 : 2;
  const timerEnabled = config.timePerWordSeconds > 0;
  const timeSec = timerEnabled ? Math.max(10, Math.min(120, Math.round(config.timePerWordSeconds))) : 0;
  const now = Date.now();
  const matchId = `match_offline_${Math.random().toString(36).slice(2, 10)}`;

  const rules: RoomRules = {
    ...OFFLINE_SOLO_RULES,
    chainLength: generated.words.length,
    timePerWordSeconds: timeSec,
    timerEnabled,
    puzzleSource: customTemplate ? 'saved_templates' : 'curated_db',
    chainVisibility: config.difficulty === 'challenge' ? 'progressive' : 'full_chain',
    autoRevealAfterAttempts: autoReveal,
    autoRevealAfterFailedTurns: autoReveal,
    difficultyPreset: config.difficulty === 'challenge' ? 'competitive' : 'casual',
    theme: generated.theme,
    isPractice: true,
  };

  const rec: OfflineMatchRecord = {
    matchId,
    stageId: null,
    playerId: profile.id,
    username: profile.username,
    avatarId: profile.avatarId,
    title: `Practice • ${generated.name}`,
    theme: generated.theme,
    words: generated.words,
    currentWordIndex: 1,
    revealedCounts: generated.words.map((w, idx) => (idx === 0 ? w.length : 1)),
    wrongAttemptsCurrentWord: 0,
    earnedMatchPoints: 0,
    completedAtMs: null,
    createdAt: now,
    updatedAt: now,
    rules,
    practiceConfig: { ...config, templateId: undefined },
    explicitClues: {},
    wordDeadlineMs: timerEnabled ? now + timeSec * 1000 : null,
  };
  offlineMatches.set(matchId, rec);
  return { match: buildOfflineClientState(rec) };
}

export function rematchOfflineSoloOrPractice(
  profile: Profile,
  prevMatchId: string,
  fallbackStageId?: string
): { stageId: string | null; match: MatchStateClient } {
  const prev = offlineMatches.get(prevMatchId);
  if (prev?.rules.isPractice && prev.practiceConfig) {
    return {
      stageId: null,
      ...startOfflinePracticeMatch(profile, prev.practiceConfig, undefined, prev.words),
    };
  }
  return startOfflineSoloMatch(profile, prev?.stageId ?? fallbackStageId);
}

export function useOfflinePracticeHint(matchId: string): {
  revealedLetterAdded: boolean;
  clueWord: string | null;
  message: string;
  match: MatchStateClient;
} {
  const rec = offlineMatches.get(matchId);
  if (!rec) throw new Error('Offline practice match not found.');
  if (!rec.rules.isPractice) throw new Error('Hints are only available in Practice Mode.');
  if (rec.completedAtMs !== null) throw new Error('Practice chain already complete.');

  const idx = rec.currentWordIndex;
  const word = rec.words[idx];
  let revealedLetterAdded = false;
  const curRev = rec.revealedCounts[idx] ?? 1;
  if (curRev < word.length - 1) {
    rec.revealedCounts[idx] = curRev + 1;
    revealedLetterAdded = true;
  }
  const clue = rec.explicitClues[idx] ?? CHAIN_SYNONYMS[word] ?? OFFLINE_SYNONYMS[word] ?? 'LINK';
  rec.explicitClues[idx] = clue;
  rec.updatedAt = Date.now();
  return {
    revealedLetterAdded,
    clueWord: clue,
    message: revealedLetterAdded
      ? 'Practice Hint: next letter & clue revealed!'
      : 'Practice Hint: 1-word clue active (final letter left for you!).',
    match: buildOfflineClientState(rec),
  };
}

export function skipOfflinePracticeWord(matchId: string): {
  revealedWord: string;
  matchWon: boolean;
  message: string;
  match: MatchStateClient;
} {
  const rec = offlineMatches.get(matchId);
  if (!rec) throw new Error('Offline practice match not found.');
  if (!rec.rules.isPractice) throw new Error('Skip Word is only available in Practice Mode.');
  if (rec.completedAtMs !== null) throw new Error('Practice chain already complete.');

  const idx = rec.currentWordIndex;
  const target = rec.words[idx];
  const now = Date.now();
  rec.revealedCounts[idx] = target.length;
  rec.currentWordIndex += 1;
  rec.wrongAttemptsCurrentWord = 0;
  rec.updatedAt = now;
  const matchWon = rec.currentWordIndex >= rec.words.length;
  if (matchWon) {
    rec.completedAtMs = now;
    rec.wordDeadlineMs = null;
  } else if (rec.rules.timerEnabled && rec.rules.timePerWordSeconds > 0) {
    rec.wordDeadlineMs = now + rec.rules.timePerWordSeconds * 1000;
  }
  return {
    revealedWord: target,
    matchWon,
    message: matchWon
      ? `Revealed "${target}" — Practice chain complete!`
      : `Revealed "${target}" — try the next link!`,
    match: buildOfflineClientState(rec),
  };
}

export function tickOfflinePracticeMatch(matchId: string): MatchStateClient | null {
  const rec = offlineMatches.get(matchId);
  if (!rec || rec.completedAtMs !== null || !rec.rules.timerEnabled || !rec.wordDeadlineMs) {
    return rec ? buildOfflineClientState(rec) : null;
  }
  const now = Date.now();
  if (now >= rec.wordDeadlineMs) {
    const idx = rec.currentWordIndex;
    const target = rec.words[idx];
    rec.wrongAttemptsCurrentWord += 1;
    const threshold = Math.max(1, rec.rules.autoRevealAfterAttempts || 2);
    if (rec.wrongAttemptsCurrentWord % threshold === 0 && target) {
      const curRev = rec.revealedCounts[idx] ?? 1;
      if (curRev < target.length - 1) {
        rec.revealedCounts[idx] = curRev + 1;
      }
    }
    rec.wordDeadlineMs = now + rec.rules.timePerWordSeconds * 1000;
    rec.updatedAt = now;
  }
  return buildOfflineClientState(rec);
}

export function submitOfflineSoloGuess(matchId: string, guess: string): GuessResult {
  const rec = offlineMatches.get(matchId);
  if (!rec) {
    throw new Error('Offline solo match not found');
  }
  const clean = String(guess || '').trim().toUpperCase();
  if (!clean) {
    throw new Error('Enter a word guess.');
  }
  const target = rec.words[rec.currentWordIndex];
  const now = Date.now();
  if (clean === target) {
    rec.earnedMatchPoints += 10;
    rec.wrongAttemptsCurrentWord = 0;
    rec.currentWordIndex += 1;
    rec.updatedAt = now;
    const matchWon = rec.currentWordIndex >= rec.words.length;
    if (matchWon) {
      rec.completedAtMs = now;
      rec.wordDeadlineMs = null;
      if (rec.stageId) {
        markGuestSoloStageCompleted(rec.stageId);
      }
    } else if (rec.rules.timerEnabled && rec.rules.timePerWordSeconds > 0) {
      rec.wordDeadlineMs = now + rec.rules.timePerWordSeconds * 1000;
    }
    return {
      correct: true,
      wordCompleted: true,
      matchWon,
      revealedLetterAdded: false,
      message: matchWon ? 'Chain complete! Victory!' : 'Correct! Next word unlocked.',
      match: buildOfflineClientState(rec),
    };
  }

  rec.wrongAttemptsCurrentWord += 1;
  rec.updatedAt = now;
  let revealedLetterAdded = false;
  const threshold = Math.max(1, rec.rules.autoRevealAfterAttempts || 2);
  if (rec.wrongAttemptsCurrentWord % threshold === 0) {
    const curRev = rec.revealedCounts[rec.currentWordIndex] ?? 1;
    if (curRev < target.length - 1) {
      rec.revealedCounts[rec.currentWordIndex] = curRev + 1;
      revealedLetterAdded = true;
    }
  }
  return {
    correct: false,
    wordCompleted: false,
    matchWon: false,
    revealedLetterAdded,
    message: revealedLetterAdded
      ? 'Not quite — next letter revealed!'
      : 'Not quite — try another link!',
    match: buildOfflineClientState(rec),
  };
}
