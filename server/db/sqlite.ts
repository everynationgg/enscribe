import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

let dbInstance: DatabaseSync | null = null;

export function getDatabase(dbPath?: string): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }
  const resolvedPath = dbPath ?? path.resolve(process.cwd(), 'data', 'enscribe.sqlite');
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new DatabaseSync(resolvedPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  initSchema(db);
  dbInstance = db;
  return db;
}

export function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      avatar_id TEXT NOT NULL,
      rank_tier TEXT NOT NULL DEFAULT 'Silver II',
      rank_points INTEGER NOT NULL DEFAULT 1000,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      match_points_balance INTEGER NOT NULL DEFAULT 0,
      equipped_cosmetics_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      theme TEXT NOT NULL,
      thumbnail_key TEXT NOT NULL DEFAULT 'custom',
      words_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'saved',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      host_id TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'lobby',
      rules_json TEXT NOT NULL,
      active_match_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS room_players (
      room_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      is_ready INTEGER NOT NULL DEFAULT 0,
      puzzle_status TEXT NOT NULL DEFAULT 'none',
      submitted_template_id TEXT,
      submitted_words_json TEXT,
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (room_id, player_id),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS room_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_avatar TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      room_id TEXT,
      game_type TEXT NOT NULL DEFAULT 'chain_clash',
      mode TEXT NOT NULL,
      title TEXT NOT NULL,
      theme TEXT,
      status TEXT NOT NULL,
      active_turn_player_id TEXT,
      turn_order_json TEXT NOT NULL,
      turn_deadline_ms INTEGER,
      turn_started_at_ms INTEGER,
      turn_awaiting_online INTEGER NOT NULL DEFAULT 0,
      speed_race_deadlines_json TEXT NOT NULL DEFAULT '{}',
      winner_id TEXT,
      finish_order_json TEXT NOT NULL DEFAULT '[]',
      rules_json TEXT NOT NULL,
      is_demo_seed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS match_boards (
      match_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      author_player_id TEXT,
      words_json TEXT NOT NULL,
      current_word_index INTEGER NOT NULL DEFAULT 1,
      revealed_counts_json TEXT NOT NULL,
      wrong_attempts_current_word INTEGER NOT NULL DEFAULT 0,
      passes_current_word INTEGER NOT NULL DEFAULT 0,
      completed_at_ms INTEGER,
      live_input_preview TEXT NOT NULL DEFAULT '',
      earned_match_points INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (match_id, player_id),
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS match_messages (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_avatar TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS points_events (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      match_id TEXT NOT NULL,
      game_type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      match_id TEXT,
      room_id TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS solo_progress (
      player_id TEXT NOT NULL,
      stage_id TEXT NOT NULL,
      completed_at INTEGER NOT NULL,
      PRIMARY KEY (player_id, stage_id)
    );
  `);
}

export function withTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // ignore rollback failure if already aborted
    }
    throw err;
  }
}
