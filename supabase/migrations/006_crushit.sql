-- Migration 006: CrushIt Single-Player Progression (Stages 1-50)
-- Strictly additive; enforces RLS (service_role only) and atomic SECURITY INVOKER RPC with fixed search_path.

CREATE TABLE IF NOT EXISTS public.crushit_player_summary (
  player_id TEXT PRIMARY KEY,
  highest_unlocked_stage INTEGER NOT NULL DEFAULT 1,
  total_score BIGINT NOT NULL DEFAULT 0,
  total_words_formed INTEGER NOT NULL DEFAULT 0,
  total_powerups_used INTEGER NOT NULL DEFAULT 0,
  completed_stages_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crushit_player_summary ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crushit_player_summary FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.crushit_player_summary TO service_role;
DROP POLICY IF EXISTS "service_role_all_crushit_player_summary" ON public.crushit_player_summary;
CREATE POLICY "service_role_all_crushit_player_summary"
  ON public.crushit_player_summary
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.crushit_stage_progress (
  player_id TEXT NOT NULL,
  stage_number INTEGER NOT NULL CHECK (stage_number >= 1 AND stage_number <= 50),
  completed BOOLEAN NOT NULL DEFAULT false,
  best_score INTEGER NOT NULL DEFAULT 0,
  best_stars INTEGER NOT NULL DEFAULT 0 CHECK (best_stars >= 0 AND best_stars <= 3),
  best_moves_remaining INTEGER NOT NULL DEFAULT 0,
  best_longest_word INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, stage_number)
);

CREATE INDEX IF NOT EXISTS idx_crushit_stage_progress_player
  ON public.crushit_stage_progress (player_id, stage_number ASC);

ALTER TABLE public.crushit_stage_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crushit_stage_progress FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.crushit_stage_progress TO service_role;
DROP POLICY IF EXISTS "service_role_all_crushit_stage_progress" ON public.crushit_stage_progress;
CREATE POLICY "service_role_all_crushit_stage_progress"
  ON public.crushit_stage_progress
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Atomic stage result upsert + player summary recalculation (safe under concurrent requests)
CREATE OR REPLACE FUNCTION public.record_crushit_stage_result(
  p_player_id TEXT,
  p_stage_number INTEGER,
  p_completed BOOLEAN,
  p_score INTEGER,
  p_stars INTEGER,
  p_moves_remaining INTEGER,
  p_words_formed INTEGER,
  p_longest_word INTEGER,
  p_powerups_used INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_stage INTEGER := GREATEST(1, LEAST(50, coalesce(p_stage_number, 1)));
  v_score INTEGER := GREATEST(0, coalesce(p_score, 0));
  v_stars INTEGER := CASE WHEN coalesce(p_completed, false) THEN GREATEST(1, LEAST(3, coalesce(p_stars, 1))) ELSE 0 END;
  v_moves INTEGER := GREATEST(0, coalesce(p_moves_remaining, 0));
  v_words INTEGER := GREATEST(0, coalesce(p_words_formed, 0));
  v_longest INTEGER := GREATEST(0, coalesce(p_longest_word, 0));
  v_powerups INTEGER := GREATEST(0, coalesce(p_powerups_used, 0));
  v_completed_count INTEGER := 0;
  v_highest_completed INTEGER := 0;
  v_next_unlocked INTEGER := 1;
  v_total_best_score BIGINT := 0;
BEGIN
  IF p_player_id IS NULL OR length(trim(p_player_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_player_id');
  END IF;

  INSERT INTO public.crushit_stage_progress (
    player_id,
    stage_number,
    completed,
    best_score,
    best_stars,
    best_moves_remaining,
    best_longest_word,
    attempts,
    completed_at,
    updated_at
  ) VALUES (
    p_player_id,
    v_stage,
    coalesce(p_completed, false),
    v_score,
    v_stars,
    v_moves,
    v_longest,
    1,
    CASE WHEN coalesce(p_completed, false) THEN NOW() ELSE NULL END,
    NOW()
  )
  ON CONFLICT (player_id, stage_number) DO UPDATE SET
    completed = public.crushit_stage_progress.completed OR EXCLUDED.completed,
    best_score = GREATEST(public.crushit_stage_progress.best_score, EXCLUDED.best_score),
    best_stars = GREATEST(public.crushit_stage_progress.best_stars, EXCLUDED.best_stars),
    best_moves_remaining = CASE
      WHEN EXCLUDED.completed THEN GREATEST(public.crushit_stage_progress.best_moves_remaining, EXCLUDED.best_moves_remaining)
      ELSE public.crushit_stage_progress.best_moves_remaining
    END,
    best_longest_word = GREATEST(public.crushit_stage_progress.best_longest_word, EXCLUDED.best_longest_word),
    attempts = public.crushit_stage_progress.attempts + 1,
    completed_at = COALESCE(public.crushit_stage_progress.completed_at, EXCLUDED.completed_at),
    updated_at = NOW();

  SELECT
    COUNT(*) FILTER (WHERE completed)::INTEGER,
    COALESCE(MAX(stage_number) FILTER (WHERE completed), 0)::INTEGER,
    COALESCE(SUM(best_score), 0)::BIGINT
  INTO v_completed_count, v_highest_completed, v_total_best_score
  FROM public.crushit_stage_progress
  WHERE player_id = p_player_id;

  v_next_unlocked := LEAST(50, GREATEST(1, v_highest_completed + 1));

  INSERT INTO public.crushit_player_summary (
    player_id,
    highest_unlocked_stage,
    total_score,
    total_words_formed,
    total_powerups_used,
    completed_stages_count,
    updated_at
  ) VALUES (
    p_player_id,
    v_next_unlocked,
    v_total_best_score,
    v_words,
    v_powerups,
    v_completed_count,
    NOW()
  )
  ON CONFLICT (player_id) DO UPDATE SET
    highest_unlocked_stage = GREATEST(public.crushit_player_summary.highest_unlocked_stage, EXCLUDED.highest_unlocked_stage),
    total_score = GREATEST(public.crushit_player_summary.total_score, EXCLUDED.total_score),
    total_words_formed = public.crushit_player_summary.total_words_formed + v_words,
    total_powerups_used = public.crushit_player_summary.total_powerups_used + v_powerups,
    completed_stages_count = v_completed_count,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'ok', true,
    'highestUnlockedStage', v_next_unlocked,
    'completedStagesCount', v_completed_count,
    'totalScore', v_total_best_score
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_crushit_stage_result(TEXT, INTEGER, BOOLEAN, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_crushit_stage_result(TEXT, INTEGER, BOOLEAN, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO service_role;
