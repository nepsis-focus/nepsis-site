-- Account-owned focus sessions, server-verified completion, and encrypted cloud journal payloads.
ALTER TABLE private.focus_timer_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS focus_timer_sessions_user_id_idx
  ON private.focus_timer_sessions (user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duration_minutes smallint NOT NULL CHECK (duration_minutes IN (5, 10, 25, 45, 60)),
  session_date date NOT NULL,
  stage text NOT NULL CHECK (stage IN ('start', 'warmup', 'rhythm', 'depth', 'flow')),
  completed_at timestamptz NOT NULL,
  source_timer_session_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT focus_sessions_stage_duration_check CHECK (
    (stage = 'start' AND duration_minutes = 5) OR
    (stage = 'warmup' AND duration_minutes = 10) OR
    (stage = 'rhythm' AND duration_minutes = 25) OR
    (stage = 'depth' AND duration_minutes = 45) OR
    (stage = 'flow' AND duration_minutes = 60)
  )
);
CREATE INDEX IF NOT EXISTS focus_sessions_user_date_idx
  ON public.focus_sessions (user_id, session_date DESC, completed_at DESC);
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own focus sessions" ON public.focus_sessions;
DROP POLICY IF EXISTS "Users can create their own focus sessions" ON public.focus_sessions;
DROP POLICY IF EXISTS "Users can update their own focus sessions" ON public.focus_sessions;
DROP POLICY IF EXISTS "Users can delete their own focus sessions" ON public.focus_sessions;
CREATE POLICY "Users can read their own focus sessions"
  ON public.focus_sessions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can create their own focus sessions"
  ON public.focus_sessions FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update their own focus sessions"
  ON public.focus_sessions FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete their own focus sessions"
  ON public.focus_sessions FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
REVOKE ALL ON TABLE public.focus_sessions FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.focus_sessions TO authenticated;

CREATE TABLE IF NOT EXISTS public.user_focus_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  total_sessions bigint NOT NULL DEFAULT 0 CHECK (total_sessions >= 0),
  total_minutes bigint NOT NULL DEFAULT 0 CHECK (total_minutes >= 0),
  badges jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
ALTER TABLE public.user_focus_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own focus stats" ON public.user_focus_stats;
CREATE POLICY "Users can read their own focus stats"
  ON public.user_focus_stats FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
REVOKE ALL ON TABLE public.user_focus_stats FROM public, anon, authenticated;
GRANT SELECT ON TABLE public.user_focus_stats TO authenticated;

CREATE OR REPLACE FUNCTION public.nepsis_timer_claim(p_session_id uuid, p_token_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_claimed_user_id uuid;
BEGIN
  IF v_user_id IS NULL OR p_session_id IS NULL OR p_token_hash IS NULL
     OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;
  UPDATE private.focus_timer_sessions
     SET user_id = v_user_id,
         updated_at = pg_catalog.clock_timestamp()
   WHERE id = p_session_id
     AND token_hash = p_token_hash
     AND (user_id IS NULL OR user_id = v_user_id)
   RETURNING user_id INTO v_claimed_user_id;
  RETURN COALESCE(v_claimed_user_id = v_user_id, false);
END;
$function$;
REVOKE ALL ON FUNCTION public.nepsis_timer_claim(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.nepsis_timer_claim(uuid, text) TO authenticated;

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
       ELSE 'flow'
     END,
     NEW.completed_at,
     NEW.id)
  ON CONFLICT (source_timer_session_id) DO NOTHING;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS sync_completed_focus_timer ON private.focus_timer_sessions;
CREATE TRIGGER sync_completed_focus_timer
  AFTER UPDATE OF completed_at, user_id ON private.focus_timer_sessions
  FOR EACH ROW EXECUTE FUNCTION private.sync_completed_focus_timer();

CREATE OR REPLACE FUNCTION public.refresh_user_focus_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_total_sessions bigint;
  v_total_minutes bigint;
  v_current_streak integer := 0;
  v_cursor date;
  v_comeback boolean := false;
  v_badges jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.progress AS p (user_id, data, updated_at)
    VALUES (
      NEW.user_id,
      pg_catalog.jsonb_build_object(
        'days', pg_catalog.jsonb_build_object(
          pg_catalog.to_char(NEW.session_date, 'YYYY-MM-DD'),
          pg_catalog.jsonb_build_array(NEW.duration_minutes)
        ),
        'distractions', '{}'::jsonb
      ),
      pg_catalog.clock_timestamp()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      data = pg_catalog.jsonb_set(
        pg_catalog.jsonb_set(
          COALESCE(p.data, '{}'::jsonb),
          '{days}',
          COALESCE(p.data -> 'days', '{}'::jsonb),
          true
        ),
        ARRAY['days', pg_catalog.to_char(NEW.session_date, 'YYYY-MM-DD')],
        COALESCE(
          p.data -> 'days' -> pg_catalog.to_char(NEW.session_date, 'YYYY-MM-DD'),
          '[]'::jsonb
        ) || pg_catalog.jsonb_build_array(NEW.duration_minutes),
        true
      ),
      updated_at = pg_catalog.clock_timestamp();
  END IF;
  SELECT count(*), COALESCE(sum(duration_minutes), 0)
    INTO v_total_sessions, v_total_minutes
    FROM public.focus_sessions
   WHERE user_id = v_user_id;
  IF EXISTS (SELECT 1 FROM public.focus_sessions WHERE user_id = v_user_id AND session_date = CURRENT_DATE) THEN
    v_cursor := CURRENT_DATE;
  ELSIF EXISTS (SELECT 1 FROM public.focus_sessions WHERE user_id = v_user_id AND session_date = CURRENT_DATE - 1) THEN
    v_cursor := CURRENT_DATE - 1;
  ELSE
    v_cursor := NULL;
  END IF;
  WHILE v_cursor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.focus_sessions
     WHERE user_id = v_user_id AND session_date = v_cursor
  ) LOOP
    v_current_streak := v_current_streak + 1;
    v_cursor := v_cursor - 1;
  END LOOP;
  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT d.session_date,
             pg_catalog.lag(d.session_date) OVER (ORDER BY d.session_date) AS previous_date
        FROM (SELECT DISTINCT session_date FROM public.focus_sessions WHERE user_id = v_user_id) AS d
    ) AS days
    WHERE previous_date IS NOT NULL AND session_date - previous_date >= 7
  ) INTO v_comeback;
  v_badges := pg_catalog.jsonb_build_object(
    'first_step', v_total_sessions >= 1,
    'comeback', v_comeback,
    'steady_rhythm', v_current_streak >= 3,
    'five_sessions', v_total_sessions >= 5,
    'sixty_minutes', v_total_minutes >= 60
  );
  INSERT INTO public.user_focus_stats
    (user_id, current_streak, total_sessions, total_minutes, badges, updated_at)
  VALUES
    (v_user_id, v_current_streak, v_total_sessions, v_total_minutes, v_badges, pg_catalog.clock_timestamp())
  ON CONFLICT (user_id) DO UPDATE SET
    current_streak = EXCLUDED.current_streak,
    total_sessions = EXCLUDED.total_sessions,
    total_minutes = EXCLUDED.total_minutes,
    badges = EXCLUDED.badges,
    updated_at = EXCLUDED.updated_at;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS refresh_user_focus_stats ON public.focus_sessions;
CREATE TRIGGER refresh_user_focus_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.focus_sessions
  FOR EACH ROW EXECUTE FUNCTION public.refresh_user_focus_stats();

ALTER TABLE public.private_diary_entries
  ADD COLUMN IF NOT EXISTS encrypted_payload jsonb;
ALTER TABLE public.private_diary_entries
  ALTER COLUMN encrypted_payload SET NOT NULL;
ALTER TABLE public.private_diary_entries
  DROP CONSTRAINT IF EXISTS private_diary_entries_encrypted_payload_check;
ALTER TABLE public.private_diary_entries
  ADD CONSTRAINT private_diary_entries_encrypted_payload_check CHECK (
    title = '' AND content = '' AND
    pg_catalog.jsonb_typeof(encrypted_payload) = 'object' AND
    encrypted_payload ->> 'version' = '1' AND
    pg_catalog.jsonb_typeof(encrypted_payload -> 'salt') = 'string' AND
    pg_catalog.jsonb_typeof(encrypted_payload -> 'iv') = 'string' AND
    pg_catalog.jsonb_typeof(encrypted_payload -> 'ciphertext') = 'string'
  );
COMMENT ON TABLE public.private_diary_entries IS
  'Per-user end-to-end encrypted journal entries. The app encrypts content in the browser; plaintext title and content columns must remain empty.';
