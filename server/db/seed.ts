import crypto from 'node:crypto';
import { RoomRules, SoloStage, ThumbnailKey } from '../../shared/types.js';
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
  autoRevealAfterAttempts: 0,
  autoRevealAfterPasses: 0,
  autoRevealAfterFailedTurns: 2,
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

const OFFICIAL_CHAIN_CATALOG: Array<{
  id: string;
  name: string;
  theme: string;
  thumbnailKey: ThumbnailKey;
  words: string[];
}> = [
  {
    id: 'tpl_official_school_ext',
    name: 'Campus Express',
    theme: 'School Life',
    thumbnailKey: 'school',
    words: ['HIGH', 'SCHOOL', 'BUS', 'STOP', 'SIGN', 'LANGUAGE', 'ARTS', 'CENTER'],
  },
  {
    id: 'tpl_official_fantasy_1',
    name: 'Dragon Keep',
    theme: 'Fantasy',
    thumbnailKey: 'castle',
    words: ['DRAGON', 'FIRE', 'STORM', 'CLOUD', 'CASTLE'],
  },
  {
    id: 'tpl_official_scifi_1',
    name: 'Starlight Orbit',
    theme: 'Science Fiction',
    thumbnailKey: 'scifi',
    words: ['STAR', 'SHIP', 'WRECK', 'DIVER', 'DOWN'],
  },
  {
    id: 'tpl_official_myth_1',
    name: 'Thunder Olympus',
    theme: 'Mythology',
    thumbnailKey: 'myth',
    words: ['THUNDER', 'GOD', 'FATHER', 'TIME', 'KEEPER'],
  },
  {
    id: 'tpl_official_horror_1',
    name: 'Midnight Manor',
    theme: 'Horror',
    thumbnailKey: 'horror',
    words: ['GHOST', 'TOWN', 'HALL', 'MIRROR', 'IMAGE'],
  },
  {
    id: 'tpl_official_nature_1',
    name: 'Wild River',
    theme: 'Nature',
    thumbnailKey: 'nature',
    words: ['WATER', 'FALL', 'RIVER', 'BANK', 'VAULT'],
  },
  {
    id: 'tpl_official_food_1',
    name: 'Ice Cream Social',
    theme: 'Food',
    thumbnailKey: 'burger',
    words: ['ICE', 'CREAM', 'CONE', 'CAKE', 'WALK'],
  },
  {
    id: 'tpl_official_food_2',
    name: 'Morning Cafe',
    theme: 'Food',
    thumbnailKey: 'burger',
    words: ['COFFEE', 'BEAN', 'BAG', 'PIPE', 'DREAM'],
  },
  {
    id: 'tpl_official_food_3',
    name: 'Diner Classic',
    theme: 'Food',
    thumbnailKey: 'burger',
    words: ['HOT', 'DOG', 'HOUSE', 'BOAT', 'RACE'],
  },
  {
    id: 'tpl_official_food_4',
    name: 'Bakery Treat',
    theme: 'Food',
    thumbnailKey: 'burger',
    words: ['APPLE', 'PIE', 'PAN', 'CAKE', 'SHOP'],
  },
  {
    id: 'tpl_official_sports_1',
    name: 'Stadium Dash',
    theme: 'Sports',
    thumbnailKey: 'custom',
    words: ['FOOT', 'BALL', 'PARK', 'BENCH', 'MARK'],
  },
  {
    id: 'tpl_official_sports_2',
    name: 'Winter Slopes',
    theme: 'Sports',
    thumbnailKey: 'nature',
    words: ['SNOW', 'BALL', 'GAME', 'PLAN', 'OUT'],
  },
  {
    id: 'tpl_official_sports_3',
    name: 'Speed Track',
    theme: 'Sports',
    thumbnailKey: 'custom',
    words: ['SPEED', 'BOAT', 'YARD', 'STICK', 'SHIFT'],
  },
  {
    id: 'tpl_official_nature_2',
    name: 'Sunshine Meadow',
    theme: 'Nature',
    thumbnailKey: 'nature',
    words: ['SUN', 'FLOWER', 'POT', 'LUCK', 'CHARM'],
  },
  {
    id: 'tpl_official_nature_3',
    name: 'Deep Tide',
    theme: 'Nature',
    thumbnailKey: 'nature',
    words: ['OCEAN', 'WAVE', 'LENGTH', 'SPAN', 'BRIDGE'],
  },
  {
    id: 'tpl_official_nature_4',
    name: 'Forest Trail',
    theme: 'Nature',
    thumbnailKey: 'nature',
    words: ['RAIN', 'BOW', 'TIE', 'BREAKER', 'WALL'],
  },
  {
    id: 'tpl_official_scifi_2',
    name: 'Moonbase Alpha',
    theme: 'Science Fiction',
    thumbnailKey: 'scifi',
    words: ['MOON', 'LIGHT', 'YEAR', 'BOOK', 'MARK'],
  },
  {
    id: 'tpl_official_scifi_3',
    name: 'Orbital Power',
    theme: 'Science Fiction',
    thumbnailKey: 'scifi',
    words: ['SPACE', 'STATION', 'WAGON', 'WHEEL', 'HOUSE'],
  },
  {
    id: 'tpl_official_scifi_4',
    name: 'Neon Grid',
    theme: 'Science Fiction',
    thumbnailKey: 'scifi',
    words: ['POWER', 'GRID', 'LOCK', 'SMITH', 'SHOP'],
  },
  {
    id: 'tpl_official_fantasy_2',
    name: 'Royal Crown',
    theme: 'Fantasy',
    thumbnailKey: 'castle',
    words: ['GOLD', 'RUSH', 'HOUR', 'GLASS', 'HOUSE'],
  },
  {
    id: 'tpl_official_fantasy_3',
    name: 'Sorcerer Tower',
    theme: 'Fantasy',
    thumbnailKey: 'castle',
    words: ['MAGIC', 'WAND', 'TRICK', 'SHOT', 'GUN'],
  },
  {
    id: 'tpl_official_horror_2',
    name: 'Dusk Watch',
    theme: 'Horror',
    thumbnailKey: 'horror',
    words: ['NIGHT', 'MARE', 'SHADOW', 'BOX', 'OFFICE'],
  },
  {
    id: 'tpl_official_everyday_1',
    name: 'Desk & Office',
    theme: 'Everyday',
    thumbnailKey: 'school',
    words: ['PAPER', 'CLIP', 'BOARD', 'GAME', 'TIME'],
  },
  {
    id: 'tpl_official_everyday_2',
    name: 'Backyard Jam',
    theme: 'Everyday',
    thumbnailKey: 'custom',
    words: ['ROCK', 'BAND', 'AID', 'KEY', 'HOLE'],
  },
  {
    id: 'tpl_official_everyday_3',
    name: 'City Commute',
    theme: 'Everyday',
    thumbnailKey: 'custom',
    words: ['STREET', 'CAR', 'WASH', 'CYCLE', 'LANE'],
  },
  {
    id: 'tpl_official_everyday_4',
    name: 'Backstage Pass',
    theme: 'Everyday',
    thumbnailKey: 'custom',
    words: ['BACK', 'PACK', 'STAGE', 'FRIGHT', 'NIGHT'],
  },
  {
    id: 'tpl_official_everyday_5',
    name: 'Greenhouse Walk',
    theme: 'Everyday',
    thumbnailKey: 'nature',
    words: ['GREEN', 'HOUSE', 'WORK', 'BENCH', 'PRESS'],
  },
];

export function seedInitialData(repo: StorageRepository): void {
  const now = Date.now();
  const missing = OFFICIAL_CHAIN_CATALOG.filter((t) => !repo.getTemplate(t.id));
  if (missing.length === 0) {
    return;
  }

  repo.runInTransaction(() => {
    missing.forEach((t, idx) => {
      repo.saveTemplate({
        id: t.id,
        ownerId: 'system',
        name: t.name,
        theme: t.theme,
        thumbnailKey: t.thumbnailKey,
        words: t.words,
        status: 'official',
        createdAt: now - 450000 + idx * 1000,
        updatedAt: now - 100000 + idx * 1000,
      });
    });
  });
}
