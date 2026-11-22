import { RoomRules, SoloStage } from '../../shared/types.js';
import { StorageRepository, StoredMatch } from '../repositories/types.js';

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

export function seedInitialData(repo: StorageRepository): void {
  const existingProfiles = repo.listProfiles();
  if (existingProfiles.length > 0) {
    return;
  }

  const now = Date.now();
  const baseCosmetics = {
    tileSkin: 'classic_cream',
    boardSkin: 'royal_cosmos',
    backgroundTheme: 'deep_blue',
    chatBubbleStyle: 'frost_pill',
  };

  repo.runInTransaction(() => {
    // 1. Development Profiles
    repo.upsertProfile({
      id: 'player_alex',
      username: 'Alex',
      avatarId: 'alex',
      rankTier: 'Gold II',
      rankPoints: 1248,
      wins: 18,
      losses: 9,
      matchPointsBalance: 420,
      equippedCosmetics: baseCosmetics,
      createdAt: now - 1000000,
    });
    repo.upsertProfile({
      id: 'player_novarex',
      username: 'NovaRex',
      avatarId: 'novarex',
      rankTier: 'Gold I',
      rankPoints: 1410,
      wins: 24,
      losses: 11,
      matchPointsBalance: 510,
      equippedCosmetics: baseCosmetics,
      createdAt: now - 900000,
    });
    repo.upsertProfile({
      id: 'player_pixelmochi',
      username: 'PixelMochi',
      avatarId: 'pixelmochi',
      rankTier: 'Silver I',
      rankPoints: 980,
      wins: 11,
      losses: 10,
      matchPointsBalance: 260,
      equippedCosmetics: baseCosmetics,
      createdAt: now - 800000,
    });
    repo.upsertProfile({
      id: 'player_leafy',
      username: 'Leafy',
      avatarId: 'leafy',
      rankTier: 'Gold III',
      rankPoints: 1120,
      wins: 14,
      losses: 12,
      matchPointsBalance: 310,
      equippedCosmetics: baseCosmetics,
      createdAt: now - 700000,
    });

    // 2. Saved & Official Templates
    const templates = [
      {
        id: 'tpl_school_days',
        ownerId: 'player_alex',
        name: 'School Days',
        theme: 'Education',
        thumbnailKey: 'school' as const,
        words: ['HIGH', 'SCHOOL', 'BUS', 'STOP'],
        status: 'saved' as const,
        createdAt: now - 500000,
        updatedAt: now - 1000,
      },
      {
        id: 'tpl_fantasy_path',
        ownerId: 'player_alex',
        name: 'Fantasy Path',
        theme: 'Fantasy',
        thumbnailKey: 'castle' as const,
        words: ['DRAGON', 'FIRE', 'STORM', 'CLOUD', 'CASTLE'],
        status: 'saved' as const,
        createdAt: now - 490000,
        updatedAt: now - 2000,
      },
      {
        id: 'tpl_food_frenzy',
        ownerId: 'player_alex',
        name: 'Food Frenzy',
        theme: 'Food',
        thumbnailKey: 'burger' as const,
        words: ['CHEESE', 'BURGER', 'KING', 'CRAB', 'CAKE', 'WALK'],
        status: 'saved' as const,
        createdAt: now - 480000,
        updatedAt: now - 3000,
      },
      {
        id: 'tpl_draft_space',
        ownerId: 'player_alex',
        name: 'Orbit Run',
        theme: 'Science Fiction',
        thumbnailKey: 'scifi' as const,
        words: ['STAR', 'LIGHT', 'YEAR', 'BOOK'],
        status: 'draft' as const,
        createdAt: now - 470000,
        updatedAt: now - 4000,
      },
      {
        id: 'tpl_novarex_nature',
        ownerId: 'player_novarex',
        name: 'River Rush',
        theme: 'Nature',
        thumbnailKey: 'nature' as const,
        words: ['WATER', 'FALL', 'RIVER', 'BANK'],
        status: 'saved' as const,
        createdAt: now - 460000,
        updatedAt: now - 5000,
      },
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

    for (const t of templates) {
      repo.saveTemplate(t);
    }

    // 3. Seeded Private Room (Code 7F3K9) matching Screen 2
    repo.createRoom({
      id: 'room_demo_7f3k9',
      code: '7F3K9',
      name: 'Private Room',
      hostId: 'player_alex',
      isPublic: false,
      rules: { ...DEFAULT_ROOM_RULES },
      createdAt: now - 120000,
    });
    repo.upsertRoomPlayer('room_demo_7f3k9', 'player_alex', {
      isReady: true,
      puzzleStatus: 'ready',
      submittedTemplateId: 'tpl_school_days',
    });
    repo.upsertRoomPlayer('room_demo_7f3k9', 'player_novarex', {
      isReady: false,
      puzzleStatus: 'creating',
    });
    repo.upsertRoomPlayer('room_demo_7f3k9', 'player_pixelmochi', {
      isReady: true,
      puzzleStatus: 'ready',
      submittedTemplateId: 'tpl_fantasy_path',
    });
    repo.upsertRoomPlayer('room_demo_7f3k9', 'player_leafy', {
      isReady: false,
      puzzleStatus: 'none',
    });

    repo.addRoomMessage({
      id: 'rmsg_1',
      roomId: 'room_demo_7f3k9',
      senderId: 'player_novarex',
      senderName: 'NovaRex',
      senderAvatar: 'novarex',
      text: 'Can we make it 20s per word instead of 15s?',
      createdAt: now - 90000,
    });
    repo.addRoomMessage({
      id: 'rmsg_2',
      roomId: 'room_demo_7f3k9',
      senderId: 'player_pixelmochi',
      senderName: 'PixelMochi',
      senderAvatar: 'pixelmochi',
      text: "Sounds good! And let's keep Classic Mode.",
      createdAt: now - 60000,
    });
    repo.addRoomMessage({
      id: 'rmsg_3',
      roomId: 'room_demo_7f3k9',
      senderId: 'player_leafy',
      senderName: 'Leafy',
      senderAvatar: 'leafy',
      text: "Yep, that's perfect! 👍",
      createdAt: now - 30000,
    });

    // 4. Seeded Public Room for Public Rooms browser
    repo.createRoom({
      id: 'room_public_1',
      code: 'OPEN4',
      name: 'Friday Word Clash',
      hostId: 'player_pixelmochi',
      isPublic: true,
      rules: {
        ...DEFAULT_ROOM_RULES,
        maxPlayers: 2,
        puzzleSource: 'curated_db',
      },
      createdAt: now - 100000,
    });
    repo.upsertRoomPlayer('room_public_1', 'player_pixelmochi', {
      isReady: true,
      puzzleStatus: 'ready',
      submittedTemplateId: 'tpl_official_fantasy_1',
    });

    // 5. Seeded Persistent Demo Ongoing Match (Home "It's Your Turn" vs. NovaRex • Classic Mode)
    // Uses turnAwaitingOnline = true so countdown does not silently expire before user opens it!
    const demoMatch: StoredMatch = {
      id: 'match_demo_active',
      roomId: null,
      gameType: 'chain_clash',
      mode: 'classic',
      title: 'Classic Match',
      theme: 'Education & Nature',
      status: 'active_turns',
      activeTurnPlayerId: 'player_alex',
      turnOrder: ['player_alex', 'player_novarex'],
      turnDeadlineMs: null,
      turnStartedAtMs: null,
      turnAwaitingOnline: true,
      speedRaceDeadlines: {},
      winnerId: null,
      finishOrder: [],
      rules: {
        ...DEFAULT_ROOM_RULES,
        maxPlayers: 2,
      },
      isDemoSeed: true,
      createdAt: now - 300000,
      updatedAt: now - 5000,
      boards: {
        player_alex: {
          matchId: 'match_demo_active',
          playerId: 'player_alex',
          authorPlayerId: 'player_novarex',
          words: ['HIGH', 'SCHOOL', 'BUS', 'STOP'],
          currentWordIndex: 3,
          revealedCounts: [4, 6, 3, 2],
          wrongAttemptsCurrentWord: 0,
          passesCurrentWord: 0,
          completedAtMs: null,
          liveInputPreview: 'ST',
          earnedMatchPoints: 20,
        },
        player_novarex: {
          matchId: 'match_demo_active',
          playerId: 'player_novarex',
          authorPlayerId: 'player_alex',
          words: ['WATER', 'FALL', 'RIVER', 'BANK'],
          currentWordIndex: 2,
          revealedCounts: [5, 4, 1, 1],
          wrongAttemptsCurrentWord: 0,
          passesCurrentWord: 0,
          completedAtMs: null,
          liveInputPreview: 'R',
          earnedMatchPoints: 10,
        },
      },
      messages: [],
    };
    repo.saveMatch(demoMatch);
    repo.addMatchMessage({
      id: 'mmsg_demo_1',
      matchId: 'match_demo_active',
      senderId: 'player_novarex',
      senderName: 'NovaRex',
      senderAvatar: 'novarex',
      text: 'hurry up 😅',
      createdAt: now - 15000,
    });

    // 6. Seeded In-App Notification
    repo.addNotification({
      id: 'notif_demo_1',
      playerId: 'player_alex',
      type: 'your_turn',
      title: "It's Your Turn vs. NovaRex",
      body: 'Classic Mode • Word 4 is waiting for your move!',
      matchId: 'match_demo_active',
      read: false,
      createdAt: now - 5000,
    });
  });
}
