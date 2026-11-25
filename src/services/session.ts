import {
  GuestSession,
  PlayerSession,
  Profile,
  Template,
  ThumbnailKey,
} from '../../shared/types';

const CACHED_NICKNAME_KEY = 'enscribe_guest_cached_nickname';
const CACHED_AVATAR_KEY = 'enscribe_guest_cached_avatar';
const ACTIVE_SESSION_KEY = 'enscribe_guest_active_session_v1';
const LOCAL_TEMPLATES_KEY = 'enscribe_guest_local_templates_v1';
const LOCAL_SOLO_COMPLETED_KEY = 'enscribe_guest_solo_completed_v1';

export interface CachedGuestPrefs {
  nickname: string;
  avatarId: string;
}

export function loadCachedGuestPrefs(): CachedGuestPrefs {
  try {
    return {
      nickname: localStorage.getItem(CACHED_NICKNAME_KEY) || '',
      avatarId: localStorage.getItem(CACHED_AVATAR_KEY) || 'alex',
    };
  } catch {
    return { nickname: '', avatarId: 'alex' };
  }
}

export function saveCachedGuestPrefs(nickname: string, avatarId: string): void {
  try {
    localStorage.setItem(CACHED_NICKNAME_KEY, nickname.trim().slice(0, 20));
    localStorage.setItem(CACHED_AVATAR_KEY, avatarId || 'alex');
  } catch {
    // ignore storage errors
  }
}

export function loadActivePlayerSession(): PlayerSession | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerSession;
    if (!parsed?.playerId || !parsed?.nickname) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveActivePlayerSession(session: PlayerSession | null): void {
  try {
    if (!session) {
      sessionStorage.removeItem(ACTIVE_SESSION_KEY);
      return;
    }
    sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function guestSessionToPlayerSession(
  session: GuestSession,
  isOffline = false
): PlayerSession {
  return {
    authType: 'guest',
    playerId: session.sessionId,
    nickname: session.nickname,
    avatarId: session.avatarId || 'alex',
    sessionToken: session.sessionToken || null,
    isOffline,
    expiresAtMs: session.expiresAtMs ?? null,
  };
}

export function createOfflineGuestSession(nickname: string, avatarId: string): PlayerSession {
  const clean = nickname.trim().slice(0, 20) || 'Guest';
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    authType: 'guest',
    playerId: `guest_offline_${suffix}`,
    nickname: clean,
    avatarId: avatarId || 'alex',
    sessionToken: null,
    isOffline: true,
    expiresAtMs: null,
  };
}

export function sessionToGuestProfile(
  session: PlayerSession,
  existingCosmetics?: Profile['equippedCosmetics']
): Profile {
  return {
    id: session.playerId,
    username: session.nickname,
    avatarId: session.avatarId || 'alex',
    rankTier: 'Guest',
    rankPoints: 0,
    wins: 0,
    losses: 0,
    matchPointsBalance: 0,
    equippedCosmetics: existingCosmetics ?? {
      tileSkin: 'classic_cream',
      boardSkin: 'royal_cosmos',
      backgroundTheme: 'deep_blue',
      chatBubbleStyle: 'frost_pill',
    },
    createdAt: Date.now(),
    isGuest: session.authType === 'guest',
  };
}

function buildStarterGuestTemplates(ownerId: string): Template[] {
  const now = Date.now();
  return [
    {
      id: 'tpl_guest_starter_school',
      ownerId,
      name: 'School Days',
      theme: 'Education',
      thumbnailKey: 'school',
      words: ['HIGH', 'SCHOOL', 'BUS', 'STOP'],
      status: 'saved',
      createdAt: now - 3000,
      updatedAt: now - 3000,
    },
    {
      id: 'tpl_guest_starter_fantasy',
      ownerId,
      name: 'Fantasy Path',
      theme: 'Fantasy',
      thumbnailKey: 'castle',
      words: ['DRAGON', 'FIRE', 'STORM', 'CLOUD', 'CASTLE'],
      status: 'saved',
      createdAt: now - 2000,
      updatedAt: now - 2000,
    },
    {
      id: 'tpl_guest_starter_food',
      ownerId,
      name: 'Food Frenzy',
      theme: 'Food',
      thumbnailKey: 'burger',
      words: ['CHEESE', 'BURGER', 'KING', 'CRAB', 'CAKE', 'WALK'],
      status: 'saved',
      createdAt: now - 1000,
      updatedAt: now - 1000,
    },
  ];
}

export function loadGuestLocalTemplates(ownerId: string): Template[] {
  try {
    const raw = localStorage.getItem(LOCAL_TEMPLATES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Template[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((t) => ({ ...t, ownerId }));
      }
    }
  } catch {
    // ignore parse failure
  }
  const starters = buildStarterGuestTemplates(ownerId);
  try {
    localStorage.setItem(LOCAL_TEMPLATES_KEY, JSON.stringify(starters));
  } catch {
    // ignore
  }
  return starters;
}

function persistGuestLocalTemplates(list: Template[]): void {
  try {
    localStorage.setItem(LOCAL_TEMPLATES_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function saveGuestLocalTemplate(
  ownerId: string,
  tplData: {
    id?: string;
    name: string;
    theme: string;
    thumbnailKey: ThumbnailKey;
    words: string[];
    status: 'saved' | 'draft';
  }
): Template {
  const normalizedWords = tplData.words
    .map((w) => String(w || '').trim().toUpperCase())
    .filter(Boolean);

  if (tplData.status === 'saved') {
    const isChangeItPuzzle =
      String(tplData.theme || '').trim().toLowerCase() === 'changeit' &&
      normalizedWords.length === 2 &&
      normalizedWords[0].length >= 3 &&
      normalizedWords[0].length <= 6 &&
      normalizedWords[0].length === normalizedWords[1].length;

    if (!isChangeItPuzzle && (normalizedWords.length < 3 || normalizedWords.length > 10)) {
      throw new Error('A ChainIt puzzle must contain between 3 and 10 single words.');
    }
    for (const w of normalizedWords) {
      if (!/^[A-Z]{2,20}$/.test(w)) {
        throw new Error(`Invalid chain word "${w}": use 2-20 letters (A-Z) with no spaces.`);
      }
    }
  }

  const list = loadGuestLocalTemplates(ownerId);
  const existing = tplData.id ? list.find((t) => t.id === tplData.id) : null;
  const now = Date.now();
  const saved: Template = {
    id: existing ? existing.id : `tpl_guest_${Math.random().toString(36).slice(2, 10)}`,
    ownerId,
    name: String(tplData.name || 'Untitled Chain').trim().slice(0, 40) || 'Untitled Chain',
    theme: String(tplData.theme || 'Custom').trim().slice(0, 30) || 'Custom',
    thumbnailKey: tplData.thumbnailKey || 'custom',
    words: normalizedWords,
    status: tplData.status,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };
  const updated = [saved, ...list.filter((t) => t.id !== saved.id)];
  persistGuestLocalTemplates(updated);
  return saved;
}

export function duplicateGuestLocalTemplate(ownerId: string, source: Template): Template {
  const list = loadGuestLocalTemplates(ownerId);
  const now = Date.now();
  const dup: Template = {
    ...source,
    id: `tpl_guest_${Math.random().toString(36).slice(2, 10)}`,
    ownerId,
    name: `${source.name} Copy`.slice(0, 40),
    status: 'saved',
    createdAt: now,
    updatedAt: now,
  };
  persistGuestLocalTemplates([dup, ...list]);
  return dup;
}

export function deleteGuestLocalTemplate(ownerId: string, id: string): void {
  const list = loadGuestLocalTemplates(ownerId).filter((t) => t.id !== id);
  persistGuestLocalTemplates(list);
}

export function loadGuestCompletedSoloStages(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_SOLO_COMPLETED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function markGuestSoloStageCompleted(stageId: string): string[] {
  const current = new Set(loadGuestCompletedSoloStages());
  current.add(stageId);
  const next = Array.from(current);
  try {
    localStorage.setItem(LOCAL_SOLO_COMPLETED_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
