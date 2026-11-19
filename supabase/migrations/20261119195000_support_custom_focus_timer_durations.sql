-- Allow user-selected whole-minute focus sessions without weakening server verification.
-- The existing timer token, idempotency, completion checks, account claim, and stats triggers remain in place.

ALTER TABLE private.focus_timer_sessions
  DROP CONSTRAINT IF EXISTS focus_timer_sessions_stage_minutes_check;
ALTER TABLE private.focus_timer_sessions
  ADD CONSTRAINT focus_timer_sessions_stage_minutes_check
  CHECK (stage_minutes BETWEEN 5 AND 180);

ALTER TABLE public.focus_sessions
  DROP CONSTRAINT IF EXISTS focus_sessions_duration_minutes_check;
ALTER TABLE public.focus_sessions
  DROP CONSTRAINT IF EXISTS focus_sessions_stage_check;
ALTER TABLE public.focus_sessions
  DROP CONSTRAINT IF EXISTS focus_sessions_stage_duration_check;
ALTER TABLE public.focus_sessions
  ADD CONSTRAINT focus_sessions_duration_minutes_check
  CHECK (duration_minutes BETWEEN 5 AND 180);
ALTER TABLE public.focus_sessions
  ADD CONSTRAINT focus_sessions_stage_check
  CHECK (stage IN ('start', 'warmup', 'rhythm', 'depth', 'flow', 'custom'));
ALTER TABLE public.focus_sessions
  ADD CONSTRAINT focus_sessions_stage_duration_check CHECK (
    (stage = 'start' AND duration_minutes = 5) OR
    (stage = 'warmup' AND duration_minutes = 10) OR
    (stage = 'rhythm' AND duration_minutes = 25) OR
    (stage = 'depth' AND duration_minutes = 45) OR
    (stage = 'flow' AND duration_minutes = 60) OR
    (stage = 'custom' AND duration_minutes NOT IN (5, 10, 25, 45, 60))
  );

CREATE OR REPLACE FUNCTION public.nepsis_timer_start(
  p_stage_minutes smallint,
  p_session_id uuid,
  p_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_session private.focus_timer_sessions%rowtype;
  v_elapsed integer;
  v_remaining integer;
BEGIN
  IF p_stage_minutes IS NULL OR p_stage_minutes < 5 OR p_stage_minutes > 180 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_stage');
  END IF;
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  IF p_session_id IS NULL THEN
    SELECT * INTO v_session
    FROM private.focus_timer_sessions
    WHERE token_hash = p_token_hash
    FOR UPDATE;

    IF FOUND THEN
      IF v_session.stage_minutes <> p_stage_minutes
        OR v_session.created_at < pg_catalog.clock_timestamp() - INTERVAL '14 days' THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_session');
      END IF;
      IF v_session.completed_at IS NOT NULL THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', true, 'session_id', v_session.id,
          'stage_minutes', v_session.stage_minutes,
          'remaining_seconds', 0, 'active', false, 'completed', true
        );
      END IF;
      IF v_session.started_at IS NULL THEN
        UPDATE private.focus_timer_sessions
        SET started_at = pg_catalog.clock_timestamp(),
            updated_at = pg_catalog.clock_timestamp()
        WHERE id = v_session.id
        RETURNING * INTO v_session;
      END IF;
    ELSE
      DELETE FROM private.focus_timer_sessions
      WHERE created_at < pg_catalog.clock_timestamp() - INTERVAL '14 days';
      INSERT INTO private.focus_timer_sessions (stage_minutes, token_hash, started_at)
      VALUES (p_stage_minutes, p_token_hash, pg_catalog.clock_timestamp())
      RETURNING * INTO v_session;
    END IF;
  ELSE
    SELECT * INTO v_session
    FROM private.focus_timer_sessions
    WHERE id = p_session_id AND token_hash = p_token_hash
    FOR UPDATE;
    IF NOT FOUND
      OR v_session.created_at < pg_catalog.clock_timestamp() - INTERVAL '14 days'
      OR v_session.stage_minutes <> p_stage_minutes THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_session');
    END IF;
    IF v_session.completed_at IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', true, 'session_id', v_session.id,
        'stage_minutes', v_session.stage_minutes,
        'remaining_seconds', 0, 'active', false, 'completed', true
      );
    END IF;
    IF v_session.started_at IS NULL THEN
      UPDATE private.focus_timer_sessions
      SET started_at = pg_catalog.clock_timestamp(),
          updated_at = pg_catalog.clock_timestamp()
      WHERE id = v_session.id
      RETURNING * INTO v_session;
    END IF;
  END IF;

  v_elapsed := v_session.elapsed_seconds;
  IF v_session.started_at IS NOT NULL THEN
    v_elapsed := LEAST(
      v_session.stage_minutes::integer * 60,
      v_elapsed + GREATEST(
        0,
        pg_catalog.floor(EXTRACT(EPOCH FROM (pg_catalog.clock_timestamp() - v_session.started_at)))::integer
      )
    );
  END IF;
  v_remaining := GREATEST(0, v_session.stage_minutes::integer * 60 - v_elapsed);
  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'session_id', v_session.id,
    'stage_minutes', v_session.stage_minutes,
    'remaining_seconds', v_remaining,
    'active', v_session.started_at IS NOT NULL,
    'completed', false
  );
END;
$function$;

CREATE OR REPLACE FUNCTION private.sync_completed_focus_timer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.completed_at IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.completed_at IS NOT DISTINCT FROM NEW.completed_at
     AND OLD.user_id IS NOT DISTINCT FROM NEW.user_id THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.focus_sessions
    (user_id, duration_minutes, session_date, stage, completed_at, source_timer_session_id)
  VALUES
    (NEW.user_id,
     NEW.stage_minutes,
     (NEW.completed_at AT TIME ZONE 'UTC')::date,
     CASE NEW.stage_minutes
       WHEN 5 THEN 'start'
       WHEN 10 THEN 'warmup'
       WHEN 25 THEN 'rhythm'
       WHEN 45 THEN 'depth'
       WHEN 60 THEN 'flow'
       ELSE 'custom'
     END,
     NEW.completed_at,
     NEW.id)
  ON CONFLICT (source_timer_session_id) DO NOTHING;
  RETURN NEW;
END;
$function$;
