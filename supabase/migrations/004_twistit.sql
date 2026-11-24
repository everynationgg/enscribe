-- Migration 004: Authoritative TwistIt (Solo + 1v1 Speed Race) tables & quick-match RPC
-- Additive only; enforces strict RLS (service_role only) and SECURITY INVOKER RPCs.

CREATE TABLE IF NOT EXISTS public.twistit_rooms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'lobby',
  is_public BOOLEAN NOT NULL DEFAULT true,
  version BIGINT NOT NULL DEFAULT 1,
  room_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '6 hours')
);

CREATE INDEX IF NOT EXISTS idx_twistit_rooms_public
  ON public.twistit_rooms (is_public, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_twistit_rooms_expires_at
  ON public.twistit_rooms (expires_at);

ALTER TABLE public.twistit_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.twistit_rooms FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.twistit_rooms TO service_role;

CREATE TABLE IF NOT EXISTS public.twistit_matches (
  id TEXT PRIMARY KEY,
  room_code TEXT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'countdown',
  version BIGINT NOT NULL DEFAULT 1,
  match_data JSONB NOT NULL,
  ends_at_ms BIGINT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '6 hours')
);

CREATE INDEX IF NOT EXISTS idx_twistit_matches_active
  ON public.twistit_matches (status, ends_at_ms);

CREATE INDEX IF NOT EXISTS idx_twistit_matches_expires_at
  ON public.twistit_matches (expires_at);

ALTER TABLE public.twistit_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.twistit_matches FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.twistit_matches TO service_role;

CREATE TABLE IF NOT EXISTS public.twistit_matchmaking_queue (
  player_id TEXT PRIMARY KEY,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_twistit_queue_lookup
  ON public.twistit_matchmaking_queue (joined_at ASC);

ALTER TABLE public.twistit_matchmaking_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.twistit_matchmaking_queue FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.twistit_matchmaking_queue TO service_role;

CREATE TABLE IF NOT EXISTS public.twistit_solo_records (
  user_id TEXT PRIMARY KEY,
  completed_count INTEGER NOT NULL DEFAULT 0,
  best_duration_ms INTEGER NULL,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.twistit_solo_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.twistit_solo_records FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.twistit_solo_records TO service_role;

CREATE OR REPLACE FUNCTION public.dequeue_twistit_quick_pair(p_stale_before TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_p1 TEXT;
  v_p2 TEXT;
BEGIN
  DELETE FROM public.twistit_matchmaking_queue
  WHERE joined_at < p_stale_before OR expires_at < NOW();

  SELECT q1.player_id INTO v_p1
  FROM public.twistit_matchmaking_queue q1
  ORDER BY q1.joined_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_p1 IS NULL THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  SELECT q2.player_id INTO v_p2
  FROM public.twistit_matchmaking_queue q2
  WHERE q2.player_id <> v_p1
  ORDER BY q2.joined_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_p2 IS NULL THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  DELETE FROM public.twistit_matchmaking_queue
  WHERE player_id IN (v_p1, v_p2);

  RETURN jsonb_build_object('matched', true, 'players', jsonb_build_array(v_p1, v_p2));
END;
$$;

REVOKE ALL ON FUNCTION public.dequeue_twistit_quick_pair(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dequeue_twistit_quick_pair(TIMESTAMPTZ) TO service_role;
