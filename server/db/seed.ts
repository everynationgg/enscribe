import crypto from 'node:crypto';
import { RoomRules, SoloStage } from '../../shared/types.js';
import { StorageRepository } from '../repositories/types.js';

export const DEFAULT_ROOM_RULES: RoomRules = {
  gameType: 'chain_clash',
  mode: 'classic',
  maxPlayers: 4,
  chainLength: 4,
  timePerWordSeconds: 20,
  timerEnabled: true,
  puzzleSource: 'saved_templates',
  chainVisibility: 'full_chain',
  wordLengthVisible: true,
  autoRevealAfterAttempts: 3,
  autoRevealAfterPasses: 1,
  opponentVisibility: 'full_live',
  difficultyPreset: 'casual',
};

export const SOLO_STAGES_CATALOG: Array<Omit<SoloStage, 'completed'>> = [
  {
    id: 'solo_fantasy_1',
    theme: 'Fantasy',
    stageNumber: 1,
    title: 'Dragon Keep',
    subtitle: 'Realm of fire, storms, and ancient castles',
    thumbnailKey: 'castle',
    templateId: 'tpl_official_fantasy_1',
    wordCount: 5,
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
  },
];

export function seedStarterTemplatesForPlayer(repo: StorageRepository, playerId: string): void {
  const existing = repo.listTemplates(playerId).filter((t) => t.ownerId === playerId);
  if (existing.length > 0) return;

  const now = Date.now();
  const starters = [
    {
      name: 'School Days',
      theme: 'Education',
      thumbnailKey: 'school' as const,
      words: ['HIGH', 'SCHOOL', 'BUS', 'STOP'],
      status: 'saved' as const,
      offset: 1000,
    },
    {
      name: 'Fantasy Path',
      theme: 'Fantasy',
      thumbnailKey: 'castle' as const,
      words: ['DRAGON', 'FIRE', 'STORM', 'CLOUD', 'CASTLE'],
      status: 'saved' as const,
      offset: 2000,
    },
    {
      name: 'Food Frenzy',
      theme: 'Food',
      thumbnailKey: 'burger' as const,
      words: ['CHEESE', 'BURGER', 'KING', 'CRAB', 'CAKE', 'WALK'],
      status: 'saved' as const,
      offset: 3000,
    },
  ];

  for (const s of starters) {
    repo.saveTemplate({
      id: `tpl_${crypto.randomUUID().slice(0, 10)}`,
      ownerId: playerId,
      name: s.name,
      theme: s.theme,
      thumbnailKey: s.thumbnailKey,
      words: s.words,
      status: s.status,
      createdAt: now - s.offset,
      updatedAt: now - s.offset,
    });
  }
}

export function seedInitialData(repo: StorageRepository): void {
  const existingOfficials = repo.listTemplates().filter((t) => t.status === 'official');
  if (existingOfficials.length > 0) {
    return;
  }

  const now = Date.now();

  repo.runInTransaction(() => {
    const officialTemplates = [
      {
        id: 'tpl_official_school_ext',
        ownerId: 'system',
        name: 'Campus Express',
        theme: 'School Life',
        thumbnailKey: 'school' as const,
        words: ['HIGH', 'SCHOOL', 'BUS', 'STOP', 'SIGN', 'LANGUAGE', 'ARTS', 'CENTER'],
        status: 'official' as const,
        createdAt: now - 450000,
        updatedAt: now - 6000,
      },
      {
        id: 'tpl_official_fantasy_1',
        ownerId: 'system',
        name: 'Dragon Keep',
        theme: 'Fantasy',
        thumbnailKey: 'castle' as const,
        words: ['DRAGON', 'FIRE', 'STORM', 'CLOUD', 'CASTLE'],
        status: 'official' as const,
        createdAt: now - 440000,
        updatedAt: now - 7000,
      },
      {
        id: 'tpl_official_scifi_1',
        ownerId: 'system',
        name: 'Starlight Orbit',
        theme: 'Science Fiction',
        thumbnailKey: 'scifi' as const,
        words: ['STAR', 'SHIP', 'WRECK', 'DIVER', 'DOWN'],
        status: 'official' as const,
        createdAt: now - 430000,
        updatedAt: now - 8000,
      },
      {
        id: 'tpl_official_myth_1',
        ownerId: 'system',
        name: 'Thunder Olympus',
        theme: 'Mythology',
        thumbnailKey: 'myth' as const,
        words: ['THUNDER', 'GOD', 'FATHER', 'TIME', 'KEEPER'],
        status: 'official' as const,
        createdAt: now - 420000,
        updatedAt: now - 9000,
      },
      {
        id: 'tpl_official_horror_1',
        ownerId: 'system',
        name: 'Midnight Manor',
        theme: 'Horror',
        thumbnailKey: 'horror' as const,
        words: ['GHOST', 'TOWN', 'HALL', 'MIRROR', 'IMAGE'],
        status: 'official' as const,
        createdAt: now - 410000,
        updatedAt: now - 10000,
      },
      {
        id: 'tpl_official_nature_1',
        ownerId: 'system',
        name: 'Wild River',
        theme: 'Nature',
        thumbnailKey: 'nature' as const,
        words: ['WATER', 'FALL', 'RIVER', 'BANK', 'VAULT'],
        status: 'official' as const,
        createdAt: now - 400000,
        updatedAt: now - 11000,
      },
    ];

    for (const t of officialTemplates) {
      repo.saveTemplate(t);
    }
  });
}
