-- Restrict browser roles to consented INSERT-only telemetry.
-- Anonymous inserts cannot assign an account; authenticated inserts may only use auth.uid().
BEGIN;

REVOKE ALL PRIVILEGES ON TABLE public.site_telemetry FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.site_telemetry FROM anon, authenticated;
GRANT INSERT ON TABLE public.site_telemetry TO anon, authenticated;
REVOKE SELECT ON TABLE public.site_telemetry FROM PUBLIC, anon, authenticated;

ALTER TABLE public.site_telemetry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_insert_anon_authenticated ON public.site_telemetry;
DROP POLICY IF EXISTS site_telemetry_insert_anon ON public.site_telemetry;
DROP POLICY IF EXISTS site_telemetry_insert_authenticated ON public.site_telemetry;

CREATE POLICY site_telemetry_insert_anon
  ON public.site_telemetry
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY site_telemetry_insert_authenticated
  ON public.site_telemetry
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

COMMIT;
