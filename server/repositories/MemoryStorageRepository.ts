import {
  EquippedCosmetics,
  InAppNotification,
  MatchChatMessage,
  MatchHistorySummary,
  PointsEvent,
  Profile,
  PuzzlePrepStatus,
  Room,
  RoomMessage,
  RoomPlayer,
  RoomRules,
  Template,
} from '../../shared/types.js';
import {
  StorageRepository,
  StoredMatch,
  StoredMatchBoard,
  computeRankTier,
} from './types.js';

interface StoredRoomPlayerRow {
  playerId: string;
  isReady: boolean;
  puzzleStatus: PuzzlePrepStatus;
  submittedTemplateId: string | null;
  submittedWords: string[] | null;
  joinedAt: number;
}

interface StoredRoomRecord {
  id: string;
  code: string;
  name: string;
  hostId: string;
  isPublic: boolean;
  status: 'lobby' | 'in_progress' | 'completed';
  rules: RoomRules;
  activeMatchId: string | null;
  createdAt: number;
  players: StoredRoomPlayerRow[];
  messages: RoomMessage[];
}

export interface MemorySnapshot {
  version: number;
  updatedAt: number;
  profiles: Record<string, Profile>;
  templates: Record<string, Template>;
  rooms: Record<string, StoredRoomRecord>;
  matches: Record<string, StoredMatch>;
  pointsEvents: PointsEvent[];
  notifications: InAppNotification[];
  soloProgress: Record<string, string[]>;
  rankedQueue?: string[];
}

export class MemoryStorageRepository implements StorageRepository {
  private profiles = new Map<string, Profile>();
  private templates = new Map<string, Template>();
  private rooms = new Map<string, StoredRoomRecord>();
  private matches = new Map<string, StoredMatch>();
  private pointsEvents: PointsEvent[] = [];
  private notifications: InAppNotification[] = [];
  private soloProgress = new Map<string, Set<string>>();
  private rankedQueue = new Set<string>();
  private onlineTracker: (playerId: string) => boolean;
  private version = 1;

  constructor(onlineTracker: (playerId: string) => boolean = () => false) {
    this.onlineTracker = onlineTracker;
  }

  setOnlineTracker(fn: (playerId: string) => boolean): void {
    this.onlineTracker = fn;
  }

  runInTransaction<T>(fn: () => T): T {
    return fn();
  }

  clearAll(): void {
    this.profiles.clear();
    this.templates.clear();
    this.rooms.clear();
    this.matches.clear();
    this.pointsEvents = [];
    this.notifications = [];
    this.soloProgress.clear();
    this.rankedQueue.clear();
    this.version += 1;
  }

  getRankedQueue(): string[] {
    return Array.from(this.rankedQueue);
  }

  addToRankedQueue(playerId: string): void {
    this.rankedQueue.add(playerId);
  }

  removeFromRankedQueue(playerId: string): void {
    this.rankedQueue.delete(playerId);
  }

  toSnapshot(): MemorySnapshot {
    const soloObj: Record<string, string[]> = {};
    for (const [pid, set] of this.soloProgress.entries()) {
      soloObj[pid] = Array.from(set);
    }
    return {
      version: this.version,
      updatedAt: Date.now(),
      profiles: Object.fromEntries(this.profiles.entries()),
      templates: Object.fromEntries(this.templates.entries()),
      rooms: Object.fromEntries(this.rooms.entries()),
      matches: Object.fromEntries(this.matches.entries()),
      pointsEvents: [...this.pointsEvents],
      notifications: [...this.notifications],
      soloProgress: soloObj,
      rankedQueue: Array.from(this.rankedQueue),
    };
  }

  fromSnapshot(snapshot: MemorySnapshot): void {
    this.profiles = new Map(Object.entries(snapshot.profiles || {}));
    this.templates = new Map(Object.entries(snapshot.templates || {}));
    this.rooms = new Map(Object.entries(snapshot.rooms || {}));
    this.matches = new Map(Object.entries(snapshot.matches || {}));
    this.pointsEvents = Array.isArray(snapshot.pointsEvents) ? [...snapshot.pointsEvents] : [];
    this.notifications = Array.isArray(snapshot.notifications) ? [...snapshot.notifications] : [];
    this.soloProgress = new Map();
    for (const [pid, stages] of Object.entries(snapshot.soloProgress || {})) {
      this.soloProgress.set(pid, new Set(stages));
    }
    this.rankedQueue = new Set(Array.isArray(snapshot.rankedQueue) ? snapshot.rankedQueue : []);
    this.version = snapshot.version || 1;
  }

  listProfiles(): Profile[] {
    return Array.from(this.profiles.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  getProfile(id: string): Profile | null {
    const p = this.profiles.get(id);
    return p ? structuredClone(p) : null;
  }

  upsertProfile(profile: Profile): Profile {
    const copy = structuredClone(profile);
    this.profiles.set(copy.id, copy);
    return structuredClone(copy);
  }

  updateProfileStats(
    playerId: string,
    delta: { wins?: number; losses?: number; rankPointsDelta?: number; matchPointsDelta?: number }
  ): Profile | null {
    const current = this.profiles.get(playerId);
    if (!current) return null;
    const newRp = Math.max(100, current.rankPoints + (delta.rankPointsDelta ?? 0));
    const updated: Profile = {
      ...current,
      wins: current.wins + (delta.wins ?? 0),
      losses: current.losses + (delta.losses ?? 0),
      rankPoints: newRp,
      rankTier: computeRankTier(newRp),
      matchPointsBalance: Math.max(0, current.matchPointsBalance + (delta.matchPointsDelta ?? 0)),
    };
    this.profiles.set(playerId, updated);
    return structuredClone(updated);
  }

  updateCosmetics(playerId: string, cosmetics: EquippedCosmetics): Profile | null {
    const current = this.profiles.get(playerId);
    if (!current) return null;
    const updated = { ...current, equippedCosmetics: structuredClone(cosmetics) };
    this.profiles.set(playerId, updated);
    return structuredClone(updated);
  }

  listTemplates(ownerId?: string): Template[] {
    const list = Array.from(this.templates.values()).filter(
      (t) => !ownerId || t.ownerId === ownerId || t.status === 'official'
    );
    return list.sort((a, b) => b.updatedAt - a.updatedAt).map((t) => structuredClone(t));
  }

  getTemplate(id: string): Template | null {
    const t = this.templates.get(id);
    return t ? structuredClone(t) : null;
  }

  saveTemplate(tpl: Template): Template {
    const copy = structuredClone(tpl);
    this.templates.set(copy.id, copy);
    return structuredClone(copy);
  }

  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  private hydrateRoom(rec: StoredRoomRecord): Room {
    const hostProfile = this.profiles.get(rec.hostId);
    const players: RoomPlayer[] = rec.players.map((pr) => {
      const profile = this.profiles.get(pr.playerId);
      const tpl = pr.submittedTemplateId ? this.templates.get(pr.submittedTemplateId) : null;
      return {
        playerId: pr.playerId,
        username: profile?.username ?? pr.playerId,
        avatarId: profile?.avatarId ?? 'alex',
        rankTier: profile?.rankTier ?? 'Silver II',
        isHost: pr.playerId === rec.hostId,
        isReady: pr.isReady,
        puzzleStatus: pr.puzzleStatus,
        submittedTemplateId: pr.submittedTemplateId,
        submittedTemplateName: tpl?.name ?? (pr.submittedWords ? 'Custom Chain' : null),
        hasCustomWords: Boolean(pr.submittedWords && pr.submittedWords.length > 0),
        isOnline: this.onlineTracker(pr.playerId),
      };
    });

    return {
      id: rec.id,
      code: rec.code,
      name: rec.name,
      hostId: rec.hostId,
      hostName: hostProfile?.username ?? 'Host',
      hostAvatar: hostProfile?.avatarId ?? 'alex',
      isPublic: rec.isPublic,
      status: rec.status,
      rules: structuredClone(rec.rules),
      activeMatchId: rec.activeMatchId,
      players,
      messages: rec.messages.slice(-100).map((m) => structuredClone(m)),
      createdAt: rec.createdAt,
    };
  }

  listPublicRooms(): Room[] {
    return Array.from(this.rooms.values())
      .filter((r) => r.isPublic && r.status === 'lobby')
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => this.hydrateRoom(r));
  }

  getRoomById(id: string): Room | null {
    const r = this.rooms.get(id);
    return r ? this.hydrateRoom(r) : null;
  }

  getRoomByCode(code: string): Room | null {
    const upper = code.trim().toUpperCase();
    for (const r of this.rooms.values()) {
      if (r.code.toUpperCase() === upper) {
        return this.hydrateRoom(r);
      }
    }
    return null;
  }

  createRoom(room: {
    id: string;
    code: string;
    name: string;
    hostId: string;
    isPublic: boolean;
    rules: RoomRules;
    createdAt: number;
  }): Room {
    const record: StoredRoomRecord = {
      id: room.id,
      code: room.code,
      name: room.name,
      hostId: room.hostId,
      isPublic: room.isPublic,
      status: 'lobby',
      rules: structuredClone(room.rules),
      activeMatchId: null,
      createdAt: room.createdAt,
      players: [
        {
          playerId: room.hostId,
          isReady: false,
          puzzleStatus: 'none',
          submittedTemplateId: null,
          submittedWords: null,
          joinedAt: room.createdAt,
        },
      ],
      messages: [],
    };
    this.rooms.set(record.id, record);
    return this.hydrateRoom(record);
  }

  updateRoomRules(roomId: string, rules: RoomRules): void {
    const r = this.rooms.get(roomId);
    if (r) r.rules = structuredClone(rules);
  }

  updateRoomStatus(
    roomId: string,
    status: 'lobby' | 'in_progress' | 'completed',
    activeMatchId: string | null
  ): void {
    const r = this.rooms.get(roomId);
    if (r) {
      r.status = status;
      r.activeMatchId = activeMatchId;
    }
  }

  upsertRoomPlayer(
    roomId: string,
    playerId: string,
    fields: Partial<{
      isReady: boolean;
      puzzleStatus: PuzzlePrepStatus;
      submittedTemplateId: string | null;
      submittedWords: string[] | null;
    }>
  ): void {
    const r = this.rooms.get(roomId);
    if (!r) return;
    const existing = r.players.find((p) => p.playerId === playerId);
    if (!existing) {
      r.players.push({
        playerId,
        isReady: Boolean(fields.isReady),
        puzzleStatus: fields.puzzleStatus ?? 'none',
        submittedTemplateId: fields.submittedTemplateId ?? null,
        submittedWords: fields.submittedWords ? [...fields.submittedWords] : null,
        joinedAt: Date.now(),
      });
      return;
    }
    if (fields.isReady !== undefined) existing.isReady = fields.isReady;
    if (fields.puzzleStatus !== undefined) existing.puzzleStatus = fields.puzzleStatus;
    if (fields.submittedTemplateId !== undefined) {
      existing.submittedTemplateId = fields.submittedTemplateId;
    }
    if (fields.submittedWords !== undefined) {
      existing.submittedWords = fields.submittedWords ? [...fields.submittedWords] : null;
    }
  }

  removeRoomPlayer(roomId: string, playerId: string): void {
    const r = this.rooms.get(roomId);
    if (!r) return;
    r.players = r.players.filter((p) => p.playerId !== playerId);
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }

  addRoomMessage(msg: RoomMessage): void {
    const r = this.rooms.get(msg.roomId);
    if (!r) return;
    r.messages.push(structuredClone(msg));
    if (r.messages.length > 100) {
      r.messages = r.messages.slice(-100);
    }
  }

  getRoomPlayerSubmissions(roomId: string): Array<{
    playerId: string;
    submittedTemplateId: string | null;
    submittedWords: string[] | null;
  }> {
    const r = this.rooms.get(roomId);
    if (!r) return [];
    return r.players.map((p) => ({
      playerId: p.playerId,
      submittedTemplateId: p.submittedTemplateId,
      submittedWords: p.submittedWords ? [...p.submittedWords] : null,
    }));
  }

  getMatch(id: string): StoredMatch | null {
    const m = this.matches.get(id);
    return m ? structuredClone(m) : null;
  }

  listMatchesForPlayer(playerId: string): StoredMatch[] {
    return Array.from(this.matches.values())
      .filter((m) => Boolean(m.boards[playerId]))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((m) => structuredClone(m));
  }

  listActiveTimedMatches(): StoredMatch[] {
    return Array.from(this.matches.values())
      .filter((m) => m.status === 'opening' || m.status === 'active_turns' || (m.status === 'finished' && m.roomId !== null))
      .map((m) => structuredClone(m));
  }

  saveMatch(match: StoredMatch): void {
    const existing = this.matches.get(match.id);
    const copy = structuredClone(match);
    if (existing && copy.messages.length === 0 && existing.messages.length > 0) {
      copy.messages = structuredClone(existing.messages);
    }
    this.matches.set(copy.id, copy);
  }

  updateMatchBoard(board: StoredMatchBoard): void {
    const m = this.matches.get(board.matchId);
    if (!m) return;
    m.boards[board.playerId] = structuredClone(board);
  }

  addMatchMessage(msg: MatchChatMessage): void {
    const m = this.matches.get(msg.matchId);
    if (!m) return;
    m.messages.push(structuredClone(msg));
    if (m.messages.length > 80) {
      m.messages = m.messages.slice(-80);
    }
  }

  recordPointsEvent(evt: PointsEvent): void {
    this.pointsEvents.push(structuredClone(evt));
  }

  listMatchHistory(playerId: string): MatchHistorySummary[] {
    return this.listMatchesForPlayer(playerId)
      .filter((m) => m.status === 'finished')
      .map((m) => ({
        matchId: m.id,
        gameType: m.gameType,
        mode: m.mode,
        opponentNames: Object.keys(m.boards)
          .filter((pid) => pid !== playerId)
          .map((pid) => this.profiles.get(pid)?.username ?? pid),
        winnerId: m.winnerId,
        didWin: m.winnerId === playerId,
        finishedAt: m.updatedAt,
      }));
  }

  addNotification(notif: InAppNotification): void {
    this.notifications.unshift(structuredClone(notif));
    if (this.notifications.length > 200) {
      this.notifications = this.notifications.slice(0, 200);
    }
  }

  listNotifications(playerId: string): InAppNotification[] {
    return this.notifications
      .filter((n) => n.playerId === playerId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30)
      .map((n) => structuredClone(n));
  }

  markNotificationsRead(playerId: string): void {
    for (const n of this.notifications) {
      if (n.playerId === playerId) n.read = true;
    }
  }

  getCompletedSoloStages(playerId: string): string[] {
    return Array.from(this.soloProgress.get(playerId) ?? []);
  }

  markSoloStageCompleted(playerId: string, stageId: string): void {
    if (!this.soloProgress.has(playerId)) {
      this.soloProgress.set(playerId, new Set());
    }
    this.soloProgress.get(playerId)!.add(stageId);
  }
}
