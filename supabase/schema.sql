-- Optional PostgreSQL schema for Enscribe (mirrored from server/db/sqlite.ts)
-- Note: The live Vercel serverless adapter also supports automatic zero-SQL persistence
-- via private Supabase Storage (`enscribe-store/state.json`) + Supabase Realtime Broadcast.

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar_id TEXT NOT NULL,
  rank_tier TEXT NOT NULL DEFAULT 'Silver II',
  rank_points INTEGER NOT NULL DEFAULT 1000,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  match_points_balance INTEGER NOT NULL DEFAULT 0,
  equipped_cosmetics_json JSONB NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  theme TEXT NOT NULL,
  thumbnail_key TEXT NOT NULL DEFAULT 'custom',
  words_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'saved',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  host_id TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'lobby',
  rules_json JSONB NOT NULL,
  active_match_id TEXT,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS room_players (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  puzzle_status TEXT NOT NULL DEFAULT 'none',
  submitted_template_id TEXT,
  submitted_words_json JSONB,
  joined_at BIGINT NOT NULL,
  PRIMARY KEY (room_id, player_id)
);

CREATE TABLE IF NOT EXISTS room_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at BIGINT NOT NULL
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
  turn_order_json JSONB NOT NULL,
  turn_deadline_ms BIGINT,
  turn_started_at_ms BIGINT,
  turn_awaiting_online BOOLEAN NOT NULL DEFAULT FALSE,
  speed_race_deadlines_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  winner_id TEXT,
  finish_order_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  rules_json JSONB NOT NULL,
  is_demo_seed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS match_boards (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  author_player_id TEXT,
  words_json JSONB NOT NULL,
  current_word_index INTEGER NOT NULL DEFAULT 1,
  revealed_counts_json JSONB NOT NULL,
  wrong_attempts_current_word INTEGER NOT NULL DEFAULT 0,
  passes_current_word INTEGER NOT NULL DEFAULT 0,
  completed_at_ms BIGINT,
  live_input_preview TEXT NOT NULL DEFAULT '',
  earned_match_points INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (match_id, player_id)
);
