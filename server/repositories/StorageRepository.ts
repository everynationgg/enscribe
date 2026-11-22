import { DatabaseSync } from 'node:sqlite';
import {
  EquippedCosmetics,
  GameModuleId,
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
  TemplateStatus,
  ThumbnailKey,
} from '../../shared/types.js';
import { withTransaction } from '../db/sqlite.js';
import {
  StorageRepository,
  StoredMatch,
  StoredMatchBoard,
  computeRankTier,
} from './types.js';

export type { StorageRepository, StoredMatch, StoredMatchBoard };
export { computeRankTier };

export class SqliteStorageRepository implements StorageRepository {
  private onlineTracker: (playerId: string) => boolean;

  constructor(
    private db: DatabaseSync,
    onlineTracker: (playerId: string) => boolean = () => false
  ) {
    this.onlineTracker = onlineTracker;
  }

  setOnlineTracker(fn: (playerId: string) => boolean): void {
    this.onlineTracker = fn;
  }

  runInTransaction<T>(fn: () => T): T {
    return withTransaction(this.db, fn);
  }

  private mapProfileRow(row: any): Profile {
    return {
      id: row.id,
      username: row.username,
      avatarId: row.avatar_id,
      rankTier: row.rank_tier,
      rankPoints: row.rank_points,
      wins: row.wins,
      losses: row.losses,
      matchPointsBalance: row.match_points_balance,
      equippedCosmetics: JSON.parse(row.equipped_cosmetics_json),
      createdAt: row.created_at,
    };
  }

  listProfiles(): Profile[] {
    const rows = this.db.prepare('SELECT * FROM profiles ORDER BY created_at ASC').all();
    return rows.map((r) => this.mapProfileRow(r));
  }

  getProfile(id: string): Profile | null {
    const row = this.db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
    return row ? this.mapProfileRow(row) : null;
  }

  upsertProfile(profile: Profile): Profile {
    this.db
      .prepare(
        `INSERT INTO profiles (id, username, avatar_id, rank_tier, rank_points, wins, losses, match_points_balance, equipped_cosmetics_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           username = excluded.username,
           avatar_id = excluded.avatar_id,
           rank_tier = excluded.rank_tier,
           rank_points = excluded.rank_points,
           wins = excluded.wins,
           losses = excluded.losses,
           match_points_balance = excluded.match_points_balance,
           equipped_cosmetics_json = excluded.equipped_cosmetics_json`
      )
      .run(
        profile.id,
        profile.username,
        profile.avatarId,
        profile.rankTier,
        profile.rankPoints,
        profile.wins,
        profile.losses,
        profile.matchPointsBalance,
        JSON.stringify(profile.equippedCosmetics),
        profile.createdAt
      );
    return this.getProfile(profile.id)!;
  }

  updateProfileStats(
    playerId: string,
    delta: { wins?: number; losses?: number; rankPointsDelta?: number; matchPointsDelta?: number }
  ): Profile | null {
    const current = this.getProfile(playerId);
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
    return this.upsertProfile(updated);
  }

  updateCosmetics(playerId: string, cosmetics: EquippedCosmetics): Profile | null {
    const current = this.getProfile(playerId);
    if (!current) return null;
    return this.upsertProfile({ ...current, equippedCosmetics: cosmetics });
  }

  private mapTemplateRow(row: any): Template {
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      theme: row.theme,
      thumbnailKey: row.thumbnail_key as ThumbnailKey,
      words: JSON.parse(row.words_json),
      status: row.status as TemplateStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  listTemplates(ownerId?: string): Template[] {
    const rows = ownerId
      ? this.db
          .prepare(
            `SELECT * FROM templates WHERE owner_id = ? OR status = 'official' ORDER BY updated_at DESC`
          )
          .all(ownerId)
      : this.db.prepare('SELECT * FROM templates ORDER BY updated_at DESC').all();
    return rows.map((r) => this.mapTemplateRow(r));
  }

  getTemplate(id: string): Template | null {
    const row = this.db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    return row ? this.mapTemplateRow(row) : null;
  }

  saveTemplate(tpl: Template): Template {
    this.db
      .prepare(
        `INSERT INTO templates (id, owner_id, name, theme, thumbnail_key, words_json, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           theme = excluded.theme,
           thumbnail_key = excluded.thumbnail_key,
           words_json = excluded.words_json,
           status = excluded.status,
           updated_at = excluded.updated_at`
      )
      .run(
        tpl.id,
        tpl.ownerId,
        tpl.name,
        tpl.theme,
        tpl.thumbnailKey,
        JSON.stringify(tpl.words),
        tpl.status,
        tpl.createdAt,
        tpl.updatedAt
      );
    return this.getTemplate(tpl.id)!;
  }

  deleteTemplate(id: string): boolean {
    const res = this.db.prepare('DELETE FROM templates WHERE id = ?').run(id);
    return Number(res.changes) > 0;
  }

  private hydrateRoom(row: any): Room {
    const hostProfile = this.getProfile(row.host_id);
    const playerRows = this.db
      .prepare(
        `SELECT rp.*, p.username, p.avatar_id, p.rank_tier, t.name as template_name
         FROM room_players rp
         JOIN profiles p ON p.id = rp.player_id
         LEFT JOIN templates t ON t.id = rp.submitted_template_id
         WHERE rp.room_id = ?
         ORDER BY rp.rowid ASC`
      )
      .all(row.id) as any[];

    const players: RoomPlayer[] = playerRows.map((pr) => ({
      playerId: pr.player_id,
      username: pr.username,
      avatarId: pr.avatar_id,
      rankTier: pr.rank_tier,
      isHost: pr.player_id === row.host_id,
      isReady: Boolean(pr.is_ready),
      puzzleStatus: pr.puzzle_status as PuzzlePrepStatus,
      submittedTemplateId: pr.submitted_template_id ?? null,
      submittedTemplateName: pr.template_name ?? (pr.submitted_words_json ? 'Custom Chain' : null),
      hasCustomWords: Boolean(pr.submitted_words_json),
      isOnline: this.onlineTracker(pr.player_id),
    }));

    const messageRows = this.db
      .prepare('SELECT * FROM room_messages WHERE room_id = ? ORDER BY created_at ASC LIMIT 100')
      .all(row.id) as any[];

    const messages: RoomMessage[] = messageRows.map((mr) => ({
      id: mr.id,
      roomId: mr.room_id,
      senderId: mr.sender_id,
      senderName: mr.sender_name,
      senderAvatar: mr.sender_avatar,
      text: mr.text,
      createdAt: mr.created_at,
    }));

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      hostId: row.host_id,
      hostName: hostProfile?.username ?? 'Host',
      hostAvatar: hostProfile?.avatarId ?? 'alex',
      isPublic: Boolean(row.is_public),
      status: row.status,
      rules: JSON.parse(row.rules_json),
      activeMatchId: row.active_match_id ?? null,
      players,
      messages,
      createdAt: row.created_at,
    };
  }

  listPublicRooms(): Room[] {
    const rows = this.db
      .prepare(`SELECT * FROM rooms WHERE is_public = 1 AND status = 'lobby' ORDER BY created_at DESC`)
      .all();
    return rows.map((r) => this.hydrateRoom(r));
  }

  getRoomById(id: string): Room | null {
    const row = this.db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    return row ? this.hydrateRoom(row) : null;
  }

  getRoomByCode(code: string): Room | null {
    const row = this.db.prepare('SELECT * FROM rooms WHERE UPPER(code) = UPPER(?)').get(code.trim());
    return row ? this.hydrateRoom(row) : null;
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
    this.db
      .prepare(
        `INSERT INTO rooms (id, code, name, host_id, is_public, status, rules_json, active_match_id, created_at)
         VALUES (?, ?, ?, ?, ?, 'lobby', ?, NULL, ?)`
      )
      .run(
        room.id,
        room.code,
        room.name,
        room.hostId,
        room.isPublic ? 1 : 0,
        JSON.stringify(room.rules),
        room.createdAt
      );
    this.db
      .prepare(
        `INSERT INTO room_players (room_id, player_id, is_ready, puzzle_status, submitted_template_id, submitted_words_json, joined_at)
         VALUES (?, ?, 0, 'none', NULL, NULL, ?)`
      )
      .run(room.id, room.hostId, room.createdAt);
    return this.getRoomById(room.id)!;
  }

  updateRoomRules(roomId: string, rules: RoomRules): void {
    this.db.prepare('UPDATE rooms SET rules_json = ? WHERE id = ?').run(JSON.stringify(rules), roomId);
  }

  updateRoomStatus(roomId: string, status: 'lobby' | 'in_progress' | 'completed', activeMatchId: string | null): void {
    this.db
      .prepare('UPDATE rooms SET status = ?, active_match_id = ? WHERE id = ?')
      .run(status, activeMatchId, roomId);
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
    const existing = this.db
      .prepare('SELECT * FROM room_players WHERE room_id = ? AND player_id = ?')
      .get(roomId, playerId) as any;
    const now = Date.now();
    if (!existing) {
      this.db
        .prepare(
          `INSERT INTO room_players (room_id, player_id, is_ready, puzzle_status, submitted_template_id, submitted_words_json, joined_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          roomId,
          playerId,
          fields.isReady ? 1 : 0,
          fields.puzzleStatus ?? 'none',
          fields.submittedTemplateId ?? null,
          fields.submittedWords ? JSON.stringify(fields.submittedWords) : null,
          now
        );
      return;
    }

    const isReady = fields.isReady !== undefined ? (fields.isReady ? 1 : 0) : existing.is_ready;
    const puzzleStatus = fields.puzzleStatus ?? existing.puzzle_status;
    const submittedTemplateId =
      fields.submittedTemplateId !== undefined ? fields.submittedTemplateId : existing.submitted_template_id;
    const submittedWordsJson =
      fields.submittedWords !== undefined
        ? fields.submittedWords
          ? JSON.stringify(fields.submittedWords)
          : null
        : existing.submitted_words_json;

    this.db
      .prepare(
        `UPDATE room_players
         SET is_ready = ?, puzzle_status = ?, submitted_template_id = ?, submitted_words_json = ?
         WHERE room_id = ? AND player_id = ?`
      )
      .run(isReady, puzzleStatus, submittedTemplateId, submittedWordsJson, roomId, playerId);
  }

  removeRoomPlayer(roomId: string, playerId: string): void {
    this.db.prepare('DELETE FROM room_players WHERE room_id = ? AND player_id = ?').run(roomId, playerId);
  }

  deleteRoom(roomId: string): void {
    this.db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
  }

  addRoomMessage(msg: RoomMessage): void {
    this.db
      .prepare(
        `INSERT INTO room_messages (id, room_id, sender_id, sender_name, sender_avatar, text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(msg.id, msg.roomId, msg.senderId, msg.senderName, msg.senderAvatar, msg.text, msg.createdAt);
  }

  getRoomPlayerSubmissions(roomId: string): Array<{
    playerId: string;
    submittedTemplateId: string | null;
    submittedWords: string[] | null;
  }> {
    const rows = this.db
      .prepare('SELECT player_id, submitted_template_id, submitted_words_json FROM room_players WHERE room_id = ? ORDER BY joined_at ASC')
      .all(roomId) as any[];
    return rows.map((r) => ({
      playerId: r.player_id,
      submittedTemplateId: r.submitted_template_id ?? null,
      submittedWords: r.submitted_words_json ? JSON.parse(r.submitted_words_json) : null,
    }));
  }

  private hydrateMatch(row: any): StoredMatch {
    const boardRows = this.db
      .prepare('SELECT * FROM match_boards WHERE match_id = ?')
      .all(row.id) as any[];
    const boards: Record<string, StoredMatchBoard> = {};
    for (const br of boardRows) {
      boards[br.player_id] = {
        matchId: br.match_id,
        playerId: br.player_id,
        authorPlayerId: br.author_player_id ?? null,
        words: JSON.parse(br.words_json),
        currentWordIndex: br.current_word_index,
        revealedCounts: JSON.parse(br.revealed_counts_json),
        wrongAttemptsCurrentWord: br.wrong_attempts_current_word,
        passesCurrentWord: br.passes_current_word,
        completedAtMs: br.completed_at_ms ?? null,
        liveInputPreview: br.live_input_preview ?? '',
        earnedMatchPoints: br.earned_match_points ?? 0,
        wordClues: br.word_clues_json ? JSON.parse(br.word_clues_json) : {},
      };
    }

    const msgRows = this.db
      .prepare('SELECT * FROM match_messages WHERE match_id = ? ORDER BY created_at ASC LIMIT 80')
      .all(row.id) as any[];
    const messages: MatchChatMessage[] = msgRows.map((mr) => ({
      id: mr.id,
      matchId: mr.match_id,
      senderId: mr.sender_id,
      senderName: mr.sender_name,
      senderAvatar: mr.sender_avatar,
      text: mr.text,
      createdAt: mr.created_at,
    }));

    return {
      id: row.id,
      roomId: row.room_id ?? null,
      gameType: row.game_type as GameModuleId,
      mode: row.mode,
      title: row.title,
      theme: row.theme ?? undefined,
      status: row.status,
      activeTurnPlayerId: row.active_turn_player_id ?? null,
      turnOrder: JSON.parse(row.turn_order_json),
      turnDeadlineMs: row.turn_deadline_ms ?? null,
      turnStartedAtMs: row.turn_started_at_ms ?? null,
      turnAwaitingOnline: Boolean(row.turn_awaiting_online),
      speedRaceDeadlines: JSON.parse(row.speed_race_deadlines_json || '{}'),
      winnerId: row.winner_id ?? null,
      finishOrder: JSON.parse(row.finish_order_json || '[]'),
      rules: JSON.parse(row.rules_json),
      isDemoSeed: Boolean(row.is_demo_seed),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      boards,
      messages,
    };
  }

  getMatch(id: string): StoredMatch | null {
    const row = this.db.prepare('SELECT * FROM matches WHERE id = ?').get(id);
    return row ? this.hydrateMatch(row) : null;
  }

  listMatchesForPlayer(playerId: string): StoredMatch[] {
    const rows = this.db
      .prepare(
        `SELECT m.* FROM matches m
         JOIN match_boards mb ON mb.match_id = m.id
         WHERE mb.player_id = ?
         ORDER BY m.updated_at DESC`
      )
      .all(playerId);
    return rows.map((r) => this.hydrateMatch(r));
  }

  listActiveTimedMatches(): StoredMatch[] {
    const rows = this.db
      .prepare(`SELECT * FROM matches WHERE status IN ('opening', 'active_turns') OR (status = 'finished' AND room_id IS NOT NULL)`)
      .all();
    return rows.map((r) => this.hydrateMatch(r));
  }

  saveMatch(match: StoredMatch): void {
    this.db
      .prepare(
        `INSERT INTO matches (
           id, room_id, game_type, mode, title, theme, status, active_turn_player_id,
           turn_order_json, turn_deadline_ms, turn_started_at_ms, turn_awaiting_online,
           speed_race_deadlines_json, winner_id, finish_order_json, rules_json,
           is_demo_seed, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           active_turn_player_id = excluded.active_turn_player_id,
           turn_order_json = excluded.turn_order_json,
           turn_deadline_ms = excluded.turn_deadline_ms,
           turn_started_at_ms = excluded.turn_started_at_ms,
           turn_awaiting_online = excluded.turn_awaiting_online,
           speed_race_deadlines_json = excluded.speed_race_deadlines_json,
           winner_id = excluded.winner_id,
           finish_order_json = excluded.finish_order_json,
           rules_json = excluded.rules_json,
           updated_at = excluded.updated_at`
      )
      .run(
        match.id,
        match.roomId,
        match.gameType,
        match.mode,
        match.title,
        match.theme ?? null,
        match.status,
        match.activeTurnPlayerId,
        JSON.stringify(match.turnOrder),
        match.turnDeadlineMs,
        match.turnStartedAtMs,
        match.turnAwaitingOnline ? 1 : 0,
        JSON.stringify(match.speedRaceDeadlines),
        match.winnerId,
        JSON.stringify(match.finishOrder),
        JSON.stringify(match.rules),
        match.isDemoSeed ? 1 : 0,
        match.createdAt,
        match.updatedAt
      );

    for (const board of Object.values(match.boards)) {
      this.updateMatchBoard(board);
    }
  }

  updateMatchBoard(board: StoredMatchBoard): void {
    this.db
      .prepare(
        `INSERT INTO match_boards (
           match_id, player_id, author_player_id, words_json, current_word_index,
           revealed_counts_json, wrong_attempts_current_word, passes_current_word,
           completed_at_ms, live_input_preview, earned_match_points, word_clues_json
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(match_id, player_id) DO UPDATE SET
           current_word_index = excluded.current_word_index,
           revealed_counts_json = excluded.revealed_counts_json,
           wrong_attempts_current_word = excluded.wrong_attempts_current_word,
           passes_current_word = excluded.passes_current_word,
           completed_at_ms = excluded.completed_at_ms,
           live_input_preview = excluded.live_input_preview,
           earned_match_points = excluded.earned_match_points,
           word_clues_json = excluded.word_clues_json`
      )
      .run(
        board.matchId,
        board.playerId,
        board.authorPlayerId,
        JSON.stringify(board.words),
        board.currentWordIndex,
        JSON.stringify(board.revealedCounts),
        board.wrongAttemptsCurrentWord,
        board.passesCurrentWord,
        board.completedAtMs,
        board.liveInputPreview,
        board.earnedMatchPoints,
        JSON.stringify(board.wordClues ?? {})
      );
  }

  addMatchMessage(msg: MatchChatMessage): void {
    this.db
      .prepare(
        `INSERT INTO match_messages (id, match_id, sender_id, sender_name, sender_avatar, text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(msg.id, msg.matchId, msg.senderId, msg.senderName, msg.senderAvatar, msg.text, msg.createdAt);
  }

  recordPointsEvent(evt: PointsEvent): void {
    this.db
      .prepare(
        `INSERT INTO points_events (id, player_id, match_id, game_type, amount, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(evt.id, evt.playerId, evt.matchId, evt.gameType, evt.amount, evt.reason, evt.createdAt);
  }

  listMatchHistory(playerId: string): MatchHistorySummary[] {
    const matches = this.listMatchesForPlayer(playerId).filter((m) => m.status === 'finished');
    return matches.map((m) => {
      const opponentNames = Object.keys(m.boards)
        .filter((pid) => pid !== playerId)
        .map((pid) => this.getProfile(pid)?.username ?? pid);
      return {
        matchId: m.id,
        gameType: m.gameType,
        mode: m.mode,
        opponentNames,
        winnerId: m.winnerId,
        didWin: m.winnerId === playerId,
        finishedAt: m.updatedAt,
      };
    });
  }

  addNotification(notif: InAppNotification): void {
    this.db
      .prepare(
        `INSERT INTO notifications (id, player_id, type, title, body, match_id, room_id, read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        notif.id,
        notif.playerId,
        notif.type,
        notif.title,
        notif.body,
        notif.matchId ?? null,
        notif.roomId ?? null,
        notif.read ? 1 : 0,
        notif.createdAt
      );
  }

  listNotifications(playerId: string): InAppNotification[] {
    const rows = this.db
      .prepare('SELECT * FROM notifications WHERE player_id = ? ORDER BY created_at DESC LIMIT 30')
      .all(playerId) as any[];
    return rows.map((r) => ({
      id: r.id,
      playerId: r.player_id,
      type: r.type,
      title: r.title,
      body: r.body,
      matchId: r.match_id ?? undefined,
      roomId: r.room_id ?? undefined,
      read: Boolean(r.read),
      createdAt: r.created_at,
    }));
  }

  markNotificationsRead(playerId: string): void {
    this.db.prepare('UPDATE notifications SET read = 1 WHERE player_id = ?').run(playerId);
  }

  getCompletedSoloStages(playerId: string): string[] {
    const rows = this.db
      .prepare('SELECT stage_id FROM solo_progress WHERE player_id = ?')
      .all(playerId) as any[];
    return rows.map((r) => r.stage_id);
  }

  markSoloStageCompleted(playerId: string, stageId: string): void {
    this.db
      .prepare(
        `INSERT INTO solo_progress (player_id, stage_id, completed_at) VALUES (?, ?, ?)
         ON CONFLICT(player_id, stage_id) DO NOTHING`
      )
      .run(playerId, stageId, Date.now());
  }
}
