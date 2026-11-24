import {
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
  const slots: SanitizedWordSlot[] = rec.words.map((word, idx) => {
    const isCompleted = idx < rec.currentWordIndex || isFinished;
    const isActive = !isFinished && idx === rec.currentWordIndex;
    const revealed = Math.min(word.length, Math.max(1, rec.revealedCounts[idx] ?? 1));
    let displayText = word;
    if (!isCompleted) {
      const chars: string[] = [];
      for (let i = 0; i < word.length; i++) {
        chars.push(i < revealed ? word[i] : '_');
      }
      displayText = chars.join(' ');
    }
    const clueWord =
      isActive && (revealed >= 2 || rec.wrongAttemptsCurrentWord >= 2)
        ? CHAIN_SYNONYMS[word] ?? OFFLINE_SYNONYMS[word] ?? null
        : null;

    return {
      index: idx,
      length: word.length,
      isCompleted,
      isActive,
      isUpcomingMasked: false,
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
    speedRaceDeadlines: {},
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
    rules: { ...OFFLINE_SOLO_RULES, chainLength: rec.words.length },
    boards: {
      [rec.playerId]: {
        playerId: rec.playerId,
        username: rec.username,
        avatarId: rec.avatarId,
        isWinner: isFinished,
        isOnline: false,
        statusText: isFinished ? 'Winner!' : 'Solo Offline',
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
  };
  offlineMatches.set(matchId, rec);
  return {
    stageId: rec.stageId,
    match: buildOfflineClientState(rec),
  };
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
      if (rec.stageId) {
        markGuestSoloStageCompleted(rec.stageId);
      }
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
  if (rec.wrongAttemptsCurrentWord % 2 === 0) {
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
