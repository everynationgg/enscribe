-- Migration 002: Server-authoritative GridIt Multiplayer Rooms, Matches, Matchmaking Queues & Session Stats
-- Keeps GridIt isolated from ChainIt's legacy JSON blob store and enforces RLS (service_role only).

CREATE TABLE IF NOT EXISTS public.gridit_rooms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'waiting',
  is_public BOOLEAN NOT NULL DEFAULT true,
  version BIGINT NOT NULL DEFAULT 1,
  room_data JSONB NOT NULL,
  battle_templates JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '6 hours')
);

CREATE INDEX IF NOT EXISTS idx_gridit_rooms_public
  ON public.gridit_rooms (is_public, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_gridit_rooms_expires_at
  ON public.gridit_rooms (expires_at);

ALTER TABLE public.gridit_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gridit_rooms FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.gridit_rooms TO service_role;

CREATE TABLE IF NOT EXISTS public.gridit_matches (
  id TEXT PRIMARY KEY,
  room_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'shaking',
  version BIGINT NOT NULL DEFAULT 1,
  match_data JSONB NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '6 hours')
);

CREATE INDEX IF NOT EXISTS idx_gridit_matches_active
  ON public.gridit_matches (status, ends_at);

CREATE INDEX IF NOT EXISTS idx_gridit_matches_expires_at
  ON public.gridit_matches (expires_at);

ALTER TABLE public.gridit_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gridit_matches FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.gridit_matches TO service_role;

CREATE TABLE IF NOT EXISTS public.gridit_matchmaking_queue (
  queue_type TEXT NOT NULL,
  player_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  PRIMARY KEY (queue_type, player_id)
);

CREATE INDEX IF NOT EXISTS idx_gridit_queue_lookup
  ON public.gridit_matchmaking_queue (queue_type, joined_at ASC);

ALTER TABLE public.gridit_matchmaking_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gridit_matchmaking_queue FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.gridit_matchmaking_queue TO service_role;

CREATE TABLE IF NOT EXISTS public.gridit_session_stats (
  player_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar_id TEXT NOT NULL DEFAULT 'alex',
  matches_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  high_score INTEGER NOT NULL DEFAULT 0,
  best_word TEXT NULL,
  is_guest BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gridit_stats_high_score
  ON public.gridit_session_stats (high_score DESC, wins DESC);

ALTER TABLE public.gridit_session_stats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gridit_session_stats FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.gridit_session_stats TO service_role;

-- Atomic race-safe matchmaking dequeue using SKIP LOCKED
CREATE OR REPLACE FUNCTION public.dequeue_gridit_pair(
  p_queue_type TEXT,
  p_player_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_opponent_id TEXT;
BEGIN
  IF p_queue_type IS NULL OR p_player_id IS NULL OR length(trim(p_player_id)) = 0 THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  DELETE FROM public.gridit_matchmaking_queue WHERE expires_at <= NOW();

  SELECT q.player_id INTO v_opponent_id
  FROM public.gridit_matchmaking_queue q
  WHERE q.queue_type = p_queue_type
    AND q.player_id <> p_player_id
    AND q.expires_at > NOW()
  ORDER BY q.joined_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_opponent_id IS NOT NULL THEN
    DELETE FROM public.gridit_matchmaking_queue
    WHERE queue_type = p_queue_type
      AND player_id IN (v_opponent_id, p_player_id);

    RETURN jsonb_build_object('matched', true, 'opponentId', v_opponent_id);
  END IF;

  INSERT INTO public.gridit_matchmaking_queue (queue_type, player_id, joined_at, expires_at)
  VALUES (p_queue_type, p_player_id, NOW(), NOW() + INTERVAL '10 minutes')
  ON CONFLICT (queue_type, player_id) DO UPDATE
  SET joined_at = NOW(), expires_at = NOW() + INTERVAL '10 minutes';

  RETURN jsonb_build_object('matched', false);
END;
$$;

-- Atomic session leaderboard stat upsert
CREATE OR REPLACE FUNCTION public.upsert_gridit_session_stat(
  p_player_id TEXT,
  p_username TEXT,
  p_avatar_id TEXT,
  p_score INTEGER,
  p_won BOOLEAN,
  p_best_word TEXT,
  p_is_guest BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.gridit_session_stats (
    player_id, username, avatar_id, matches_played, wins, high_score, best_word, is_guest, updated_at
  ) VALUES (
    p_player_id,
    p_username,
    coalesce(nullif(p_avatar_id, ''), 'alex'),
    1,
    CASE WHEN p_won THEN 1 ELSE 0 END,
    GREATEST(0, coalesce(p_score, 0)),
    p_best_word,
    coalesce(p_is_guest, true),
    NOW()
  )
  ON CONFLICT (player_id) DO UPDATE SET
    username = EXCLUDED.username,
    avatar_id = EXCLUDED.avatar_id,
    matches_played = public.gridit_session_stats.matches_played + 1,
    wins = public.gridit_session_stats.wins + (CASE WHEN p_won THEN 1 ELSE 0 END),
    high_score = GREATEST(public.gridit_session_stats.high_score, GREATEST(0, coalesce(p_score, 0))),
    best_word = CASE
      WHEN EXCLUDED.best_word IS NOT NULL
        AND (public.gridit_session_stats.best_word IS NULL
          OR char_length(EXCLUDED.best_word) >= char_length(public.gridit_session_stats.best_word))
      THEN EXCLUDED.best_word
      ELSE public.gridit_session_stats.best_word
    END,
    is_guest = EXCLUDED.is_guest,
    updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.dequeue_gridit_pair(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dequeue_gridit_pair(TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.upsert_gridit_session_stat(TEXT, TEXT, TEXT, INTEGER, BOOLEAN, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_gridit_session_stat(TEXT, TEXT, TEXT, INTEGER, BOOLEAN, TEXT, BOOLEAN) TO service_role;
