-- Migration 003: Server-authoritative GuessIt Word Catalog, Multiplayer Rooms, Matches, Ranked Queues & Adventure Progression
-- Isolated from ChainIt and GridIt tables; enforces strict RLS (service_role only) and atomic Postgres RPCs.

CREATE TABLE IF NOT EXISTS public.guessit_words (
  id TEXT PRIMARY KEY,
  answer TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  word_count INTEGER NOT NULL DEFAULT 1,
  letter_count INTEGER NOT NULL DEFAULT 1,
  clue TEXT NULL,
  content_source TEXT NOT NULL DEFAULT 'ai_validated',
  validation_status TEXT NOT NULL DEFAULT 'approved',
  ranked_eligible BOOLEAN NOT NULL DEFAULT true,
  adventure_eligible BOOLEAN NOT NULL DEFAULT false,
  chapter_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guessit_words_lookup
  ON public.guessit_words (category, difficulty, validation_status, ranked_eligible);

ALTER TABLE public.guessit_words ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.guessit_words FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.guessit_words TO service_role;

CREATE TABLE IF NOT EXISTS public.guessit_rooms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'lobby',
  is_public BOOLEAN NOT NULL DEFAULT true,
  version BIGINT NOT NULL DEFAULT 1,
  room_data JSONB NOT NULL,
  duel_submissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '6 hours')
);

CREATE INDEX IF NOT EXISTS idx_guessit_rooms_public
  ON public.guessit_rooms (is_public, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_guessit_rooms_expires_at
  ON public.guessit_rooms (expires_at);

ALTER TABLE public.guessit_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.guessit_rooms FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.guessit_rooms TO service_role;

CREATE TABLE IF NOT EXISTS public.guessit_matches (
  id TEXT PRIMARY KEY,
  room_id TEXT NULL,
  mode TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'classic',
  status TEXT NOT NULL DEFAULT 'playing',
  version BIGINT NOT NULL DEFAULT 1,
  match_data JSONB NOT NULL,
  round_ends_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '6 hours')
);

CREATE INDEX IF NOT EXISTS idx_guessit_matches_active
  ON public.guessit_matches (status, round_ends_at);

CREATE INDEX IF NOT EXISTS idx_guessit_matches_expires_at
  ON public.guessit_matches (expires_at);

ALTER TABLE public.guessit_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.guessit_matches FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.guessit_matches TO service_role;

CREATE TABLE IF NOT EXISTS public.guessit_matchmaking_queue (
  queue_key TEXT NOT NULL,
  player_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  PRIMARY KEY (queue_key, player_id)
);

CREATE INDEX IF NOT EXISTS idx_guessit_queue_lookup
  ON public.guessit_matchmaking_queue (queue_key, joined_at ASC);

ALTER TABLE public.guessit_matchmaking_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.guessit_matchmaking_queue FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.guessit_matchmaking_queue TO service_role;

CREATE TABLE IF NOT EXISTS public.guessit_adventure_progress (
  player_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  best_stars INTEGER NOT NULL DEFAULT 0,
  best_accuracy INTEGER NOT NULL DEFAULT 0,
  best_time_ms INTEGER NULL,
  reward_claimed BOOLEAN NOT NULL DEFAULT false,
  claimed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, stage_id)
);

CREATE INDEX IF NOT EXISTS idx_guessit_adventure_player
  ON public.guessit_adventure_progress (player_id, chapter_id);

ALTER TABLE public.guessit_adventure_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.guessit_adventure_progress FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.guessit_adventure_progress TO service_role;

CREATE TABLE IF NOT EXISTS public.guessit_adventure_chapter_claims (
  player_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, chapter_id)
);

ALTER TABLE public.guessit_adventure_chapter_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.guessit_adventure_chapter_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.guessit_adventure_chapter_claims TO service_role;

-- Atomic race-safe Ranked queue dequeue using SKIP LOCKED
CREATE OR REPLACE FUNCTION public.dequeue_guessit_ranked_pair(
  p_queue_key TEXT,
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
  IF p_queue_key IS NULL OR p_player_id IS NULL OR length(trim(p_player_id)) = 0 THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  DELETE FROM public.guessit_matchmaking_queue WHERE expires_at <= NOW();

  SELECT q.player_id INTO v_opponent_id
  FROM public.guessit_matchmaking_queue q
  WHERE q.queue_key = p_queue_key
    AND q.player_id <> p_player_id
    AND q.expires_at > NOW()
  ORDER BY q.joined_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_opponent_id IS NOT NULL THEN
    DELETE FROM public.guessit_matchmaking_queue
    WHERE queue_key = p_queue_key
      AND player_id IN (v_opponent_id, p_player_id);

    RETURN jsonb_build_object('matched', true, 'opponentId', v_opponent_id);
  END IF;

  INSERT INTO public.guessit_matchmaking_queue (queue_key, player_id, joined_at, expires_at)
  VALUES (p_queue_key, p_player_id, NOW(), NOW() + INTERVAL '10 minutes')
  ON CONFLICT (queue_key, player_id) DO UPDATE
  SET joined_at = NOW(), expires_at = NOW() + INTERVAL '10 minutes';

  RETURN jsonb_build_object('matched', false);
END;
$$;

-- Atomic idempotent Adventure stage completion + one-time reward claim
CREATE OR REPLACE FUNCTION public.claim_guessit_adventure_reward(
  p_player_id TEXT,
  p_stage_id TEXT,
  p_chapter_id TEXT,
  p_stars INTEGER,
  p_accuracy INTEGER,
  p_time_ms INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_existing RECORD;
  v_newly_claimed BOOLEAN := false;
  v_stars INTEGER := GREATEST(1, LEAST(3, coalesce(p_stars, 1)));
  v_acc INTEGER := GREATEST(0, LEAST(100, coalesce(p_accuracy, 0)));
BEGIN
  IF p_player_id IS NULL OR p_stage_id IS NULL OR p_chapter_id IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'alreadyClaimed', false, 'error', 'invalid_params');
  END IF;

  INSERT INTO public.guessit_adventure_progress (
    player_id, stage_id, chapter_id, completed, best_stars, best_accuracy, best_time_ms, reward_claimed, updated_at
  ) VALUES (
    p_player_id, p_stage_id, p_chapter_id, true, v_stars, v_acc, p_time_ms, false, NOW()
  )
  ON CONFLICT (player_id, stage_id) DO NOTHING;

  SELECT * INTO v_existing
  FROM public.guessit_adventure_progress
  WHERE player_id = p_player_id AND stage_id = p_stage_id
  FOR UPDATE;

  IF NOT v_existing.reward_claimed THEN
    v_newly_claimed := true;
    UPDATE public.guessit_adventure_progress
    SET
      completed = true,
      best_stars = GREATEST(best_stars, v_stars),
      best_accuracy = GREATEST(best_accuracy, v_acc),
      best_time_ms = CASE
        WHEN p_time_ms IS NOT NULL AND (best_time_ms IS NULL OR p_time_ms < best_time_ms)
        THEN p_time_ms
        ELSE best_time_ms
      END,
      reward_claimed = true,
      claimed_at = NOW(),
      updated_at = NOW()
    WHERE player_id = p_player_id AND stage_id = p_stage_id;
  ELSE
    UPDATE public.guessit_adventure_progress
    SET
      completed = true,
      best_stars = GREATEST(best_stars, v_stars),
      best_accuracy = GREATEST(best_accuracy, v_acc),
      best_time_ms = CASE
        WHEN p_time_ms IS NOT NULL AND (best_time_ms IS NULL OR p_time_ms < best_time_ms)
        THEN p_time_ms
        ELSE best_time_ms
      END,
      updated_at = NOW()
    WHERE player_id = p_player_id AND stage_id = p_stage_id;
  END IF;

  RETURN jsonb_build_object(
    'claimed', v_newly_claimed,
    'alreadyClaimed', NOT v_newly_claimed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dequeue_guessit_ranked_pair(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dequeue_guessit_ranked_pair(TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.claim_guessit_adventure_reward(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_guessit_adventure_reward(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO service_role;
