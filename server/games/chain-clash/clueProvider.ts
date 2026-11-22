import { validateSingleChainWord } from './puzzleAssignment.js';

const LOCAL_SYNONYMS: Record<string, string> = {
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
  WATER: 'AQUA',
  FALL: 'DROP',
  RIVER: 'STREAM',
  BANK: 'SHORE',
  VAULT: 'SAFE',
  CHEESE: 'CHEDDAR',
  BURGER: 'PATTY',
  KING: 'MONARCH',
  CRAB: 'SHELLFISH',
  CAKE: 'PASTRY',
  WALK: 'STROLL',
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
  LIGHT: 'GLOW',
  YEAR: 'ANNUAL',
  BOOK: 'NOVEL',
  SUN: 'SOLAR',
  FLOWER: 'BLOSSOM',
  POT: 'KETTLE',
  LUCK: 'FORTUNE',
  MOON: 'LUNAR',
  HOUSE: 'HOME',
  BOAT: 'CRAFT',
  ALPHA: 'FIRST',
  BETA: 'SECOND',
  GAMMA: 'THIRD',
  DELTA: 'FOURTH',
  ICE: 'FROST',
  CREAM: 'DAIRY',
  CONE: 'WAFFLE',
  RAIN: 'DRIZZLE',
  BOW: 'ARCH',
  TIE: 'KNOT',
  BREAKER: 'CRASHER',
  COFFEE: 'ESPRESSO',
  BEAN: 'SEED',
  BAG: 'SACK',
  PIPE: 'TUBE',
  DREAM: 'VISION',
  CATCHER: 'TRAPPER',
  NIGHT: 'DUSK',
  MARE: 'STEED',
  SHADOW: 'SILHOUETTE',
  BOX: 'CRATE',
  OFFICE: 'BUREAU',
  CHAIR: 'SEAT',
  BOARD: 'PLANK',
  GAME: 'MATCH',
  PLAN: 'SCHEME',
  SPACE: 'COSMOS',
  STATION: 'OUTPOST',
  WAGON: 'CART',
  WHEEL: 'RIM',
  BASE: 'FOUNDATION',
  BALL: 'SPHERE',
  PARK: 'GARDEN',
  BENCH: 'PEW',
  GOLD: 'AURIC',
  RUSH: 'HURRY',
  HOUR: 'MINUTE',
  GLASS: 'CRYSTAL',
  FOOT: 'STEP',
  PRINT: 'STAMP',
  PAPER: 'SHEET',
  CLIP: 'CLASP',
  FLASH: 'SPARK',
  BACK: 'REAR',
  PACK: 'BUNDLE',
  ROCK: 'STONE',
  BAND: 'TROUPE',
  AID: 'HELP',
  KEY: 'CIPHER',
  HOLE: 'GAP',
  PUNCH: 'STRIKE',
  LINE: 'QUEUE',
  DANCE: 'WALTZ',
  FLOOR: 'GROUND',
  SNOW: 'SLEET',
  MAN: 'FELLOW',
  KIND: 'GENTLE',
  HEART: 'CORE',
  BEAT: 'PULSE',
  STREET: 'AVENUE',
  CAR: 'AUTO',
  WASH: 'RINSE',
  CYCLE: 'LOOP',
  GREEN: 'EMERALD',
  WOOD: 'TIMBER',
  LAND: 'TERRAIN',
  MARK: 'TRACE',
  OCEAN: 'SEA',
  WAVE: 'SWELL',
  LENGTH: 'SPAN',
  POWER: 'FORCE',
  GRID: 'MATRIX',
  LOCK: 'LATCH',
  SMITH: 'FORGER',
  CROWN: 'TIARA',
  JEWEL: 'GEM',
  TONE: 'PITCH',
  WING: 'PINION',
  SPAN: 'ARCH',
  BASKET: 'HAMPER',
  COURT: 'ARENA',
  SIDE: 'FLANK',
  KICK: 'PUNT',
  OFF: 'AWAY',
  STAGE: 'PLATFORM',
  FRIGHT: 'TERROR',
  MAGIC: 'SORCERY',
  WAND: 'STAFF',
  SPELL: 'CHARM',
  BOUND: 'LEAP',
  BOOKMARK: 'TAB',
  COLD: 'CHILL',
  BREW: 'STEEP',
  CUP: 'MUG',
  CAKEWALK: 'BREEZE',
  APPLE: 'ORCHARD',
  PIE: 'TART',
  PAN: 'SKILLET',
  HOT: 'WARM',
  DOG: 'HOUND',
  CAT: 'FELINE',
  FISH: 'TROUT',
  TANK: 'VAT',
  TOP: 'SUMMIT',
  HAT: 'CAP',
  TRICK: 'STUNT',
  SHOT: 'BLAST',
  GUN: 'RIFLE',
  POWDER: 'DUST',
  ROOM: 'CHAMBER',
  MATE: 'ALLY',
  TEAM: 'SQUAD',
  WORK: 'LABOR',
  OUT: 'EXIT',
  DOOR: 'PORTAL',
  BELL: 'CHIME',
  TOWER: 'SPIRE',
  BRIDGE: 'VIADUCT',
  PORT: 'HARBOR',
  CITY: 'METRO',
  LIMIT: 'CAP',
  SPEED: 'PACE',
  WAY: 'PATH',
  FINDER: 'SCOUT',
  CAMP: 'TENT',
  GROUND: 'EARTH',
  ZERO: 'NONE',
  GRAVITY: 'WEIGHT',
  WARP: 'BEND',
  DRIVE: 'MOTOR',
  IN: 'INSIDE',
  UP: 'ABOVE',
  OVER: 'ACROSS',
  UNDER: 'BENEATH',
  WORLD: 'GLOBE',
  WIDE: 'BROAD',
  WEB: 'NET',
};

const CHAIN_GRAPH: Record<string, string[]> = {
  HIGH: ['SCHOOL', 'WAY', 'LAND', 'TIDE', 'NOON', 'JUMP'],
  SCHOOL: ['BUS', 'YARD', 'BOOK', 'BOARD', 'HOUSE', 'WORK'],
  BUS: ['STOP', 'LINE', 'DRIVER', 'LANE'],
  STOP: ['SIGN', 'WATCH', 'LIGHT', 'GAP'],
  SIGN: ['LANGUAGE', 'POST', 'BOARD', 'OFF'],
  LANGUAGE: ['ARTS', 'BARRIER', 'LAB'],
  ARTS: ['CENTER', 'CRAFT', 'COUNCIL'],
  CENTER: ['STAGE', 'COURT', 'PIECE', 'LINE'],
  DRAGON: ['FIRE', 'FLY', 'SCALE', 'FRUIT', 'KEEP'],
  FIRE: ['STORM', 'PLACE', 'TRUCK', 'WORK', 'BALL', 'SIDE'],
  STORM: ['CLOUD', 'FRONT', 'TROOPER', 'WATCH'],
  CLOUD: ['BURST', 'COVER', 'NINE', 'BANK'],
  CASTLE: ['TOWER', 'GATE', 'WALL', 'ROCK'],
  TOWER: ['BRIDGE', 'CLOCK', 'BLOCK', 'TOP'],
  WATER: ['FALL', 'FRONT', 'MARK', 'MELON', 'PROOF', 'WHEEL'],
  FALL: ['BACK', 'OUT', 'GUY', 'LEAF'],
  RIVER: ['BANK', 'BOAT', 'BED', 'SIDE'],
  BANK: ['VAULT', 'NOTE', 'ACCOUNT', 'ROLL'],
  STAR: ['LIGHT', 'SHIP', 'FISH', 'DUST', 'GAZER'],
  LIGHT: ['YEAR', 'HOUSE', 'BULB', 'SPEED', 'WEIGHT'],
  HOUSE: ['BOAT', 'WORK', 'PARTY', 'GUEST', 'HOLD'],
  BOAT: ['DOCK', 'HOUSE', 'YARD', 'RACE'],
  MOON: ['LIGHT', 'BEAM', 'WALK', 'STONE'],
  SUN: ['FLOWER', 'BURN', 'RISE', 'SHINE', 'GLASS'],
  FLOWER: ['POT', 'BED', 'SHOP', 'POWER'],
  ICE: ['CREAM', 'BERG', 'CUBE', 'BREAKER', 'COLD'],
  CREAM: ['CONE', 'CAKE', 'CHEESE', 'SODA'],
  CHEESE: ['BURGER', 'CAKE', 'BOARD', 'STEAK'],
  BURGER: ['KING', 'JOINT', 'BUN', 'FRIES'],
  KING: ['CRAB', 'CROWN', 'SIZE', 'FISHER'],
  CAKE: ['WALK', 'MIX', 'SHOP', 'PAN'],
  COFFEE: ['BEAN', 'SHOP', 'CUP', 'BREAK'],
  BEAN: ['BAG', 'STALK', 'COUNTER', 'POT'],
  NIGHT: ['MARE', 'FALL', 'OWL', 'CLUB', 'SHIFT'],
  SHADOW: ['BOX', 'LAND', 'PLAY', 'ZONE'],
  BOX: ['OFFICE', 'CAR', 'SEAT', 'TOP'],
  OFFICE: ['CHAIR', 'HOUR', 'SPACE', 'DESK'],
  FOOT: ['BALL', 'PRINT', 'STEP', 'NOTE', 'PATH'],
  BALL: ['PARK', 'ROOM', 'GAME', 'POINT'],
  PARK: ['BENCH', 'WAY', 'LANE', 'RANGER'],
  GOLD: ['RUSH', 'MINE', 'FISH', 'MEDAL', 'COIN'],
  RUSH: ['HOUR', 'ORDER', 'JOB'],
  HOUR: ['GLASS', 'HAND', 'MARK'],
  GLASS: ['HOUSE', 'WARE', 'TOP', 'EYE'],
  PAPER: ['CLIP', 'WORK', 'TRAIL', 'PLANE'],
  BACK: ['PACK', 'YARD', 'STAGE', 'DOOR', 'BONE'],
  ROCK: ['BAND', 'STAR', 'CLIMB', 'WALL'],
  BAND: ['AID', 'STAND', 'WAGON', 'WIDTH'],
  KEY: ['HOLE', 'BOARD', 'STONE', 'NOTE'],
  SNOW: ['BALL', 'MAN', 'STORM', 'DROP', 'FLAKE'],
  STREET: ['CAR', 'LIGHT', 'FOOD', 'WISE'],
  CAR: ['WASH', 'POOL', 'PARK', 'PORT'],
  GREEN: ['HOUSE', 'WOOD', 'LAND', 'ROOM', 'LIGHT'],
  OCEAN: ['WAVE', 'FRONT', 'VIEW', 'FLOOR'],
  WAVE: ['LENGTH', 'BAND', 'POOL', 'RIDER'],
  MAGIC: ['WAND', 'TRICK', 'CARPET', 'MIRROR'],
  GHOST: ['TOWN', 'SHIP', 'WRITER', 'STORY'],
  TOWN: ['HALL', 'SQUARE', 'HOUSE'],
  HALL: ['WAY', 'MARK', 'PASS'],
  MIRROR: ['IMAGE', 'HALL', 'BALL'],
  BOOK: ['MARK', 'SHOP', 'WORM', 'SHELF'],
  DOOR: ['BELL', 'WAY', 'STEP', 'KNOB'],
  GAME: ['PLAN', 'BOARD', 'TIME', 'SHOW'],
  TIME: ['KEEPER', 'LINE', 'ZONE', 'OUT'],
  POWER: ['GRID', 'HOUSE', 'PLANT', 'PLAY'],
  SPACE: ['SHIP', 'STATION', 'SUIT', 'WALK'],
  THUNDER: ['STORM', 'BOLT', 'BIRD', 'CLOUD'],
  RAIN: ['BOW', 'DROP', 'FOREST', 'COAT'],
  APPLE: ['PIE', 'SAUCE', 'TREE', 'CIDER'],
  HOT: ['DOG', 'SPOT', 'CAKE', 'SPRING'],
  DOG: ['HOUSE', 'PARK', 'TAG', 'WOOD'],
  CUP: ['CAKE', 'BOARD', 'HOLDER'],
  WORK: ['OUT', 'SHOP', 'BENCH', 'DAY'],
  STAGE: ['FRIGHT', 'COACH', 'HAND', 'LIGHT'],
  CAMP: ['FIRE', 'GROUND', 'SITE'],
  SPEED: ['BOAT', 'WAY', 'LIMIT', 'TRAP'],
  WORLD: ['WIDE', 'CUP', 'MAP', 'VIEW'],
};

const THEME_SEEDS: Record<string, string[]> = {
  fantasy: ['DRAGON', 'MAGIC', 'CASTLE', 'GOLD', 'MOON'],
  'science fiction': ['SPACE', 'STAR', 'LIGHT', 'TIME', 'POWER'],
  'sci-fi': ['SPACE', 'STAR', 'LIGHT', 'TIME', 'POWER'],
  education: ['HIGH', 'SCHOOL', 'BOOK', 'KEY', 'PAPER'],
  'school life': ['HIGH', 'SCHOOL', 'BOOK', 'BACK', 'CAMP'],
  food: ['CHEESE', 'ICE', 'COFFEE', 'APPLE', 'HOT'],
  nature: ['WATER', 'RIVER', 'SUN', 'RAIN', 'OCEAN'],
  horror: ['GHOST', 'NIGHT', 'SHADOW', 'STAGE', 'MIRROR'],
  mythology: ['THUNDER', 'DRAGON', 'MOON', 'GOLD', 'KING'],
  sports: ['FOOT', 'BALL', 'SNOW', 'SPEED', 'GAME'],
  everyday: ['STREET', 'DOOR', 'KEY', 'WORK', 'HOUSE'],
};

function sanitizeCandidate(raw: string, target: string): string | null {
  const clean = raw.trim().toUpperCase();
  if (!/^[A-Z]{2,14}$/.test(clean)) return null;
  if (clean === target) return null;
  if (clean.includes(target) || target.includes(clean)) return null;
  return clean;
}

/**
 * Instant synchronous 1-word synonym clue from built-in dictionary.
 * Returns null if word is custom and not yet resolved asynchronously.
 */
export function getSyncOneWordClue(word: string): string | null {
  const upper = word.trim().toUpperCase();
  return LOCAL_SYNONYMS[upper] ?? null;
}

/**
 * Zero-key 1-word synonym resolver: checks built-in map first (0ms),
 * then falls back to free Datamuse API for custom player words.
 */
export async function resolveOneWordClue(word: string): Promise<string> {
  const target = word.trim().toUpperCase();
  const local = LOCAL_SYNONYMS[target];
  if (local) return local;

  try {
    const res = await fetch(
      `https://api.datamuse.com/words?ml=${encodeURIComponent(target.toLowerCase())}&max=14`,
      { signal: AbortSignal.timeout(1500) }
    );
    if (res.ok) {
      const rows = (await res.json()) as Array<{ word: string }>;
      for (const row of rows) {
        const candidate = sanitizeCandidate(row.word, target);
        if (candidate) return candidate;
      }
    }
  } catch {
    // offline or timeout fallback below
  }

  return 'HINT';
}

/**
 * Generates a valid multi-word connected chain for a theme using the built-in link graph
 * plus optional free Datamuse bigram follower queries when extending chains.
 */
export async function generateWordChain(
  themeRaw: string,
  desiredLength: number
): Promise<{ name: string; theme: string; words: string[] }> {
  const length = Math.max(3, Math.min(8, Math.round(desiredLength || 5)));
  const cleanTheme = themeRaw.trim() || 'Adventure';
  const themeKey = cleanTheme.toLowerCase();
  const seeds = THEME_SEEDS[themeKey] ?? [
    ...Object.values(THEME_SEEDS).flat(),
  ];

  // Try building from the deterministic/randomized local graph first
  const startPool = [...seeds].sort(() => Math.random() - 0.5);
  for (const startWord of startPool) {
    const chain = [startWord];
    const used = new Set(chain);

    while (chain.length < length) {
      const prev = chain[chain.length - 1];
      let nextCandidates = (CHAIN_GRAPH[prev] || []).filter((w) => !used.has(w));

      if (nextCandidates.length === 0) {
        // Optional free Datamuse follower lookup (`lc=prev`)
        try {
          const res = await fetch(
            `https://api.datamuse.com/words?lc=${encodeURIComponent(prev.toLowerCase())}&max=14`,
            { signal: AbortSignal.timeout(1400) }
          );
          if (res.ok) {
            const rows = (await res.json()) as Array<{ word: string }>;
            nextCandidates = rows
              .map((r) => r.word.trim().toUpperCase())
              .filter((w) => !used.has(w) && validateSingleChainWord(w).valid && w.length >= 3);
          }
        } catch {
          // ignore network error
        }
      }

      if (nextCandidates.length === 0) break;
      const picked = nextCandidates[Math.floor(Math.random() * Math.min(nextCandidates.length, 4))];
      chain.push(picked);
      used.add(picked);
    }

    if (chain.length >= length) {
      return {
        name: `${cleanTheme} Mix`,
        theme: cleanTheme,
        words: chain.slice(0, length),
      };
    }
  }

  // Fallback guaranteed valid chain
  return {
    name: `${cleanTheme} Express`,
    theme: cleanTheme,
    words: ['SUN', 'FLOWER', 'POT', 'LUCK', 'CHARM'].slice(0, length),
  };
}
