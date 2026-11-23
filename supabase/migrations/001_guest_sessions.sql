-- Migration 001: Atomic Temporary Guest Nickname Reservations & Ephemeral Presence
-- Applied to Supabase project `enscribe` (llqiguxvkgkfdbsbzsbo).

CREATE TABLE IF NOT EXISTS public.guest_sessions (
  session_id TEXT PRIMARY KEY,
  session_token TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  nickname_normalized TEXT NOT NULL UNIQUE,
  avatar_id TEXT NOT NULL DEFAULT 'alex',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_expires_at
  ON public.guest_sessions (expires_at);

ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.guest_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.guest_sessions TO service_role;

-- Atomic nickname reservation / refresh / rename with TTL cleanup
CREATE OR REPLACE FUNCTION public.claim_guest_nickname(
  p_nickname TEXT,
  p_avatar_id TEXT DEFAULT 'alex',
  p_existing_token TEXT DEFAULT NULL,
  p_ttl_seconds INTEGER DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_clean TEXT;
  v_norm TEXT;
  v_avatar TEXT;
  v_ttl INTEGER;
  v_expires TIMESTAMPTZ;
  v_row public.guest_sessions%ROWTYPE;
  v_sid TEXT;
  v_tok TEXT;
BEGIN
  v_clean := left(regexp_replace(trim(coalesce(p_nickname, '')), '[\x00-\x1F\x7F]', '', 'g'), 20);
  IF char_length(v_clean) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_nickname');
  END IF;

  v_norm := lower(v_clean);
  v_avatar := coalesce(nullif(trim(p_avatar_id), ''), 'alex');
  v_ttl := GREATEST(10, LEAST(coalesce(p_ttl_seconds, 90), 600));
  v_expires := NOW() + make_interval(secs => v_ttl);

  -- Purge expired guest reservations first so inactive nicknames become available again
  DELETE FROM public.guest_sessions WHERE expires_at <= NOW();

  -- If renewing/renaming an existing active session token, update in place atomically
  IF p_existing_token IS NOT NULL AND length(trim(p_existing_token)) > 0 THEN
    BEGIN
      UPDATE public.guest_sessions
      SET
        nickname = v_clean,
        nickname_normalized = v_norm,
        avatar_id = v_avatar,
        last_seen_at = NOW(),
        expires_at = v_expires
      WHERE session_token = p_existing_token
        AND expires_at > NOW()
      RETURNING * INTO v_row;

      IF FOUND THEN
        RETURN jsonb_build_object(
          'ok', true,
          'session', jsonb_build_object(
            'sessionId', v_row.session_id,
            'sessionToken', v_row.session_token,
            'nickname', v_row.nickname,
            'avatarId', v_row.avatar_id,
            'expiresAtMs', floor(extract(epoch FROM v_row.expires_at) * 1000)::BIGINT
          )
        );
      END IF;
    EXCEPTION
      WHEN unique_violation THEN
        RETURN jsonb_build_object('ok', false, 'error', 'nickname_taken');
    END;
  END IF;

  -- New reservation: rely on UNIQUE (nickname_normalized) for race-safe atomicity
  v_sid := 'guest_' || substr(replace(pg_catalog.gen_random_uuid()::TEXT, '-', ''), 1, 10);
  v_tok := 'gtok_' || replace(pg_catalog.gen_random_uuid()::TEXT, '-', '');

  BEGIN
    INSERT INTO public.guest_sessions (
      session_id,
      session_token,
      nickname,
      nickname_normalized,
      avatar_id,
      created_at,
      last_seen_at,
      expires_at
    ) VALUES (
      v_sid,
      v_tok,
      v_clean,
      v_norm,
      v_avatar,
      NOW(),
      NOW(),
      v_expires
    )
    RETURNING * INTO v_row;

    RETURN jsonb_build_object(
      'ok', true,
      'session', jsonb_build_object(
        'sessionId', v_row.session_id,
        'sessionToken', v_row.session_token,
        'nickname', v_row.nickname,
        'avatarId', v_row.avatar_id,
        'expiresAtMs', floor(extract(epoch FROM v_row.expires_at) * 1000)::BIGINT
      )
    );
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', false, 'error', 'nickname_taken');
  END;
END;
$$;

-- Atomic heartbeat extension
CREATE OR REPLACE FUNCTION public.heartbeat_guest_session(
  p_session_token TEXT,
  p_ttl_seconds INTEGER DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_ttl INTEGER;
  v_row public.guest_sessions%ROWTYPE;
BEGIN
  IF p_session_token IS NULL OR length(trim(p_session_token)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_expired');
  END IF;

  v_ttl := GREATEST(10, LEAST(coalesce(p_ttl_seconds, 90), 600));
  DELETE FROM public.guest_sessions WHERE expires_at <= NOW();

  UPDATE public.guest_sessions
  SET
    last_seen_at = NOW(),
    expires_at = NOW() + make_interval(secs => v_ttl)
  WHERE session_token = p_session_token
    AND expires_at > NOW()
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_expired');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'session', jsonb_build_object(
      'sessionId', v_row.session_id,
      'sessionToken', v_row.session_token,
      'nickname', v_row.nickname,
      'avatarId', v_row.avatar_id,
      'expiresAtMs', floor(extract(epoch FROM v_row.expires_at) * 1000)::BIGINT
    )
  );
END;
$$;

-- Lookup active guest session by token
CREATE OR REPLACE FUNCTION public.get_guest_session(
  p_session_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_row public.guest_sessions%ROWTYPE;
BEGIN
  IF p_session_token IS NULL OR length(trim(p_session_token)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_expired');
  END IF;

  DELETE FROM public.guest_sessions WHERE expires_at <= NOW();

  SELECT * INTO v_row
  FROM public.guest_sessions
  WHERE session_token = p_session_token
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_expired');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'session', jsonb_build_object(
      'sessionId', v_row.session_id,
      'sessionToken', v_row.session_token,
      'nickname', v_row.nickname,
      'avatarId', v_row.avatar_id,
      'expiresAtMs', floor(extract(epoch FROM v_row.expires_at) * 1000)::BIGINT
    )
  );
END;
$$;

-- Lookup active guest public identity by session_id (no secret token returned)
CREATE OR REPLACE FUNCTION public.get_guest_session_by_id(
  p_session_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_row public.guest_sessions%ROWTYPE;
BEGIN
  IF p_session_id IS NULL OR length(trim(p_session_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  DELETE FROM public.guest_sessions WHERE expires_at <= NOW();

  SELECT * INTO v_row
  FROM public.guest_sessions
  WHERE session_id = p_session_id
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'session', jsonb_build_object(
      'sessionId', v_row.session_id,
      'sessionToken', '',
      'nickname', v_row.nickname,
      'avatarId', v_row.avatar_id,
      'expiresAtMs', floor(extract(epoch FROM v_row.expires_at) * 1000)::BIGINT
    )
  );
END;
$$;

-- Release active guest session immediately so nickname becomes available
CREATE OR REPLACE FUNCTION public.release_guest_session(
  p_session_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF p_session_token IS NOT NULL AND length(trim(p_session_token)) > 0 THEN
    DELETE FROM public.guest_sessions WHERE session_token = p_session_token;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_guest_nickname(TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_guest_nickname(TEXT, TEXT, TEXT, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.heartbeat_guest_session(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_guest_session(TEXT, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.get_guest_session(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_session(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.get_guest_session_by_id(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_session_by_id(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.release_guest_session(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_guest_session(TEXT) TO service_role;
