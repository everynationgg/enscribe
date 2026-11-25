-- Migration 005: ChangeIt Word Transformation Game (Rooms, Matches, Ranked Queue, Anti-Repetition History, Solo Adventure, Leaderboard & Idempotent Results)
-- Strictly additive; enforces RLS (service_role only) and SECURITY INVOKER + fixed search_path RPCs.

CREATE TABLE IF NOT EXISTS public.changeit_rooms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'lobby',
  is_public BOOLEAN NOT NULL DEFAULT true,
  version BIGINT NOT NULL DEFAULT 1,
  room_data JSONB NOT NULL,
  custom_puzzle JSONB NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '6 hours')
);

CREATE INDEX IF NOT EXISTS idx_changeit_rooms_public
  ON public.changeit_rooms (is_public, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_changeit_rooms_expires_at
  ON public.changeit_rooms (expires_at);

ALTER TABLE public.changeit_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.changeit_rooms FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.changeit_rooms TO service_role;
DROP POLICY IF EXISTS "service_role_all_changeit_rooms" ON public.changeit_rooms;
CREATE POLICY "service_role_all_changeit_rooms"
  ON public.changeit_rooms
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.changeit_matches (
  id TEXT PRIMARY KEY,
  room_id TEXT NULL,
  mode TEXT NOT NULL,
  is_ranked BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'playing',
  version BIGINT NOT NULL DEFAULT 1,
  match_data JSONB NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '6 hours')
);

CREATE INDEX IF NOT EXISTS idx_changeit_matches_active
  ON public.changeit_matches (status, ends_at);

CREATE INDEX IF NOT EXISTS idx_changeit_matches_expires_at
  ON public.changeit_matches (expires_at);

ALTER TABLE public.changeit_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.changeit_matches FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.changeit_matches TO service_role;
DROP POLICY IF EXISTS "service_role_all_changeit_matches" ON public.changeit_matches;
CREATE POLICY "service_role_all_changeit_matches"
  ON public.changeit_matches
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.changeit_matchmaking_queue (
  queue_key TEXT NOT NULL,
  player_id TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 1000,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  PRIMARY KEY (queue_key, player_id)
);

CREATE INDEX IF NOT EXISTS idx_changeit_queue_lookup
  ON public.changeit_matchmaking_queue (queue_key, joined_at ASC);

ALTER TABLE public.changeit_matchmaking_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.changeit_matchmaking_queue FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.changeit_matchmaking_queue TO service_role;
DROP POLICY IF EXISTS "service_role_all_changeit_matchmaking_queue" ON public.changeit_matchmaking_queue;
CREATE POLICY "service_role_all_changeit_matchmaking_queue"
  ON public.changeit_matchmaking_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.changeit_player_stats (
  player_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar_id TEXT NOT NULL DEFAULT 'alex',
  is_guest BOOLEAN NOT NULL DEFAULT true,
  rating INTEGER NOT NULL DEFAULT 1000,
  rank_tier TEXT NOT NULL DEFAULT 'Silver II',
  ranked_wins INTEGER NOT NULL DEFAULT 0,
  ranked_losses INTEGER NOT NULL DEFAULT 0,
  ranked_draws INTEGER NOT NULL DEFAULT 0,
  matches_played INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  puzzles_solved INTEGER NOT NULL DEFAULT 0,
  best_efficiency INTEGER NOT NULL DEFAULT 0,
  fastest_solve_ms INTEGER NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_changeit_stats_leaderboard
  ON public.changeit_player_stats (rating DESC, ranked_wins DESC, total_wins DESC);

ALTER TABLE public.changeit_player_stats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.changeit_player_stats FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.changeit_player_stats TO service_role;
DROP POLICY IF EXISTS "service_role_all_changeit_player_stats" ON public.changeit_player_stats;
CREATE POLICY "service_role_all_changeit_player_stats"
  ON public.changeit_player_stats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.changeit_player_history (
  player_id TEXT PRIMARY KEY,
  completed_puzzles JSONB NOT NULL DEFAULT '[]'::jsonb,
  recent_words JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.changeit_player_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.changeit_player_history FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.changeit_player_history TO service_role;
DROP POLICY IF EXISTS "service_role_all_changeit_player_history" ON public.changeit_player_history;
CREATE POLICY "service_role_all_changeit_player_history"
  ON public.changeit_player_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.changeit_adventure_progress (
  player_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  best_stars INTEGER NOT NULL DEFAULT 0,
  fewest_moves INTEGER NULL,
  best_time_ms INTEGER NULL,
  reward_claimed BOOLEAN NOT NULL DEFAULT false,
  claimed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, stage_id)
);

CREATE INDEX IF NOT EXISTS idx_changeit_adventure_player
  ON public.changeit_adventure_progress (player_id, chapter_id);

ALTER TABLE public.changeit_adventure_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.changeit_adventure_progress FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.changeit_adventure_progress TO service_role;
DROP POLICY IF EXISTS "service_role_all_changeit_adventure_progress" ON public.changeit_adventure_progress;
CREATE POLICY "service_role_all_changeit_adventure_progress"
  ON public.changeit_adventure_progress
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.changeit_match_results (
  match_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  is_ranked BOOLEAN NOT NULL DEFAULT false,
  winner_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_changeit_match_results_recent
  ON public.changeit_match_results (created_at DESC);

ALTER TABLE public.changeit_match_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.changeit_match_results FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.changeit_match_results TO service_role;
DROP POLICY IF EXISTS "service_role_all_changeit_match_results" ON public.changeit_match_results;
CREATE POLICY "service_role_all_changeit_match_results"
  ON public.changeit_match_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Atomic skill-aware Ranked queue dequeue using SKIP LOCKED
CREATE OR REPLACE FUNCTION public.dequeue_changeit_ranked_pair(
  p_queue_key TEXT,
  p_player_id TEXT,
  p_rating INTEGER DEFAULT 1000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_opponent_id TEXT;
  v_opponent_rating INTEGER;
BEGIN
  IF p_queue_key IS NULL OR p_player_id IS NULL OR length(trim(p_player_id)) = 0 THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  DELETE FROM public.changeit_matchmaking_queue WHERE expires_at <= NOW();

  SELECT q.player_id, q.rating INTO v_opponent_id, v_opponent_rating
  FROM public.changeit_matchmaking_queue q
  WHERE q.queue_key = p_queue_key
    AND q.player_id <> p_player_id
    AND q.expires_at > NOW()
  ORDER BY ABS(q.rating - coalesce(p_rating, 1000)) ASC, q.joined_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_opponent_id IS NOT NULL THEN
    DELETE FROM public.changeit_matchmaking_queue
    WHERE queue_key = p_queue_key
      AND player_id IN (v_opponent_id, p_player_id);

    RETURN jsonb_build_object(
      'matched', true,
      'opponentId', v_opponent_id,
      'opponentRating', coalesce(v_opponent_rating, 1000)
    );
  END IF;

  INSERT INTO public.changeit_matchmaking_queue (queue_key, player_id, rating, joined_at, expires_at)
  VALUES (p_queue_key, p_player_id, coalesce(p_rating, 1000), NOW(), NOW() + INTERVAL '10 minutes')
  ON CONFLICT (queue_key, player_id) DO UPDATE
  SET rating = EXCLUDED.rating, joined_at = NOW(), expires_at = NOW() + INTERVAL '10 minutes';

  RETURN jsonb_build_object('matched', false);
END;
$$;

-- Atomic idempotent Adventure stage completion + one-time reward claim
CREATE OR REPLACE FUNCTION public.claim_changeit_adventure_reward(
  p_player_id TEXT,
  p_stage_id TEXT,
  p_chapter_id TEXT,
  p_stars INTEGER,
  p_moves INTEGER,
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
  v_moves INTEGER := GREATEST(1, coalesce(p_moves, 1));
BEGIN
  IF p_player_id IS NULL OR p_stage_id IS NULL OR p_chapter_id IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'alreadyClaimed', false, 'error', 'invalid_params');
  END IF;

  INSERT INTO public.changeit_adventure_progress (
    player_id, stage_id, chapter_id, completed, best_stars, fewest_moves, best_time_ms, reward_claimed, updated_at
  ) VALUES (
    p_player_id, p_stage_id, p_chapter_id, true, v_stars, v_moves, p_time_ms, false, NOW()
  )
  ON CONFLICT (player_id, stage_id) DO NOTHING;

  SELECT * INTO v_existing
  FROM public.changeit_adventure_progress
  WHERE player_id = p_player_id AND stage_id = p_stage_id
  FOR UPDATE;

  IF NOT v_existing.reward_claimed THEN
    v_newly_claimed := true;
    UPDATE public.changeit_adventure_progress
    SET
      completed = true,
      best_stars = GREATEST(best_stars, v_stars),
      fewest_moves = CASE
        WHEN fewest_moves IS NULL OR v_moves < fewest_moves THEN v_moves
        ELSE fewest_moves
      END,
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
    UPDATE public.changeit_adventure_progress
    SET
      completed = true,
      best_stars = GREATEST(best_stars, v_stars),
      fewest_moves = CASE
        WHEN fewest_moves IS NULL OR v_moves < fewest_moves THEN v_moves
        ELSE fewest_moves
      END,
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

-- Atomic CAS match mutation to prevent concurrent overwrite races
CREATE OR REPLACE FUNCTION public.mutate_changeit_match_cas(
  p_match_id TEXT,
  p_expected_version BIGINT,
  p_status TEXT,
  p_match_data JSONB,
  p_ends_at TIMESTAMPTZ
)
RETURNS TABLE(new_version BIGINT)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.changeit_matches
  SET
    status = p_status,
    version = version + 1,
    match_data = p_match_data,
    ends_at = p_ends_at,
    updated_at = NOW(),
    expires_at = NOW() + INTERVAL '6 hours'
  WHERE id = p_match_id
    AND version = p_expected_version
  RETURNING version;
END;
$$;

-- Atomic idempotent match result finalization + player stats update
CREATE OR REPLACE FUNCTION public.finalize_changeit_match_result(
  p_match_id TEXT,
  p_mode TEXT,
  p_is_ranked BOOLEAN,
  p_winner_ids JSONB,
  p_participants JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_inserted_id TEXT;
  v_entry JSONB;
  v_pid TEXT;
  v_username TEXT;
  v_avatar TEXT;
  v_is_guest BOOLEAN;
  v_rating INTEGER;
  v_tier TEXT;
  v_won BOOLEAN;
  v_draw BOOLEAN;
  v_solved INTEGER;
  v_eff INTEGER;
  v_solve_ms INTEGER;
BEGIN
  IF p_match_id IS NULL OR length(trim(p_match_id)) = 0 THEN
    RETURN jsonb_build_object('finalized', false, 'alreadyFinalized', false, 'error', 'invalid_match_id');
  END IF;

  INSERT INTO public.changeit_match_results (match_id, mode, is_ranked, winner_ids, participants)
  VALUES (p_match_id, p_mode, coalesce(p_is_ranked, false), coalesce(p_winner_ids, '[]'::jsonb), coalesce(p_participants, '[]'::jsonb))
  ON CONFLICT (match_id) DO NOTHING
  RETURNING match_id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RETURN jsonb_build_object('finalized', false, 'alreadyFinalized', true);
  END IF;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(coalesce(p_participants, '[]'::jsonb))
  LOOP
    v_pid := v_entry->>'playerId';
    IF v_pid IS NULL OR length(trim(v_pid)) = 0 THEN
      CONTINUE;
    END IF;
    v_username := coalesce(nullif(v_entry->>'username', ''), v_pid);
    v_avatar := coalesce(nullif(v_entry->>'avatarId', ''), 'alex');
    v_is_guest := coalesce((v_entry->>'isGuest')::boolean, true);
    v_rating := GREATEST(100, coalesce((v_entry->>'newRating')::integer, 1000));
    v_tier := coalesce(nullif(v_entry->>'rankTier', ''), 'Silver II');
    v_won := coalesce((v_entry->>'won')::boolean, false);
    v_draw := coalesce((v_entry->>'draw')::boolean, false);
    v_solved := GREATEST(0, coalesce((v_entry->>'puzzlesSolved')::integer, 0));
    v_eff := GREATEST(0, LEAST(100, coalesce((v_entry->>'efficiencyPercent')::integer, 0)));
    v_solve_ms := CASE
      WHEN v_entry ? 'solveTimeMs' AND v_entry->>'solveTimeMs' IS NOT NULL
      THEN GREATEST(1, (v_entry->>'solveTimeMs')::integer)
      ELSE NULL
    END;

    INSERT INTO public.changeit_player_stats (
      player_id, username, avatar_id, is_guest, rating, rank_tier,
      ranked_wins, ranked_losses, ranked_draws,
      matches_played, total_wins, puzzles_solved,
      best_efficiency, fastest_solve_ms, updated_at
    ) VALUES (
      v_pid, v_username, v_avatar, v_is_guest, v_rating, v_tier,
      CASE WHEN coalesce(p_is_ranked, false) AND v_won THEN 1 ELSE 0 END,
      CASE WHEN coalesce(p_is_ranked, false) AND NOT v_won AND NOT v_draw THEN 1 ELSE 0 END,
      CASE WHEN coalesce(p_is_ranked, false) AND v_draw THEN 1 ELSE 0 END,
      1,
      CASE WHEN v_won THEN 1 ELSE 0 END,
      v_solved,
      v_eff,
      v_solve_ms,
      NOW()
    )
    ON CONFLICT (player_id) DO UPDATE SET
      username = EXCLUDED.username,
      avatar_id = EXCLUDED.avatar_id,
      is_guest = EXCLUDED.is_guest,
      rating = CASE WHEN coalesce(p_is_ranked, false) THEN EXCLUDED.rating ELSE public.changeit_player_stats.rating END,
      rank_tier = CASE WHEN coalesce(p_is_ranked, false) THEN EXCLUDED.rank_tier ELSE public.changeit_player_stats.rank_tier END,
      ranked_wins = public.changeit_player_stats.ranked_wins + (CASE WHEN coalesce(p_is_ranked, false) AND v_won THEN 1 ELSE 0 END),
      ranked_losses = public.changeit_player_stats.ranked_losses + (CASE WHEN coalesce(p_is_ranked, false) AND NOT v_won AND NOT v_draw THEN 1 ELSE 0 END),
      ranked_draws = public.changeit_player_stats.ranked_draws + (CASE WHEN coalesce(p_is_ranked, false) AND v_draw THEN 1 ELSE 0 END),
      matches_played = public.changeit_player_stats.matches_played + 1,
      total_wins = public.changeit_player_stats.total_wins + (CASE WHEN v_won THEN 1 ELSE 0 END),
      puzzles_solved = public.changeit_player_stats.puzzles_solved + v_solved,
      best_efficiency = GREATEST(public.changeit_player_stats.best_efficiency, v_eff),
      fastest_solve_ms = CASE
        WHEN v_solve_ms IS NOT NULL AND (public.changeit_player_stats.fastest_solve_ms IS NULL OR v_solve_ms < public.changeit_player_stats.fastest_solve_ms)
        THEN v_solve_ms
        ELSE public.changeit_player_stats.fastest_solve_ms
      END,
      updated_at = NOW();
  END LOOP;

  RETURN jsonb_build_object('finalized', true, 'alreadyFinalized', false);
END;
$$;

REVOKE ALL ON FUNCTION public.dequeue_changeit_ranked_pair(TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dequeue_changeit_ranked_pair(TEXT, TEXT, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.claim_changeit_adventure_reward(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_changeit_adventure_reward(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.mutate_changeit_match_cas(TEXT, BIGINT, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_changeit_match_cas(TEXT, BIGINT, TEXT, JSONB, TIMESTAMPTZ) TO service_role;

REVOKE ALL ON FUNCTION public.finalize_changeit_match_result(TEXT, TEXT, BOOLEAN, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_changeit_match_result(TEXT, TEXT, BOOLEAN, JSONB, JSONB) TO service_role;
