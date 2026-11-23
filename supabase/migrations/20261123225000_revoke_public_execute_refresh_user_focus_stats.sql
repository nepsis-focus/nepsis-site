-- refresh_user_focus_stats() is a trigger function on focus_sessions. Triggers run
-- without the caller needing EXECUTE, so the grant is only an exposed RPC surface.
-- Remove it from PUBLIC, anon and authenticated. postgres and service_role keep access.
REVOKE EXECUTE ON FUNCTION public.refresh_user_focus_stats() FROM PUBLIC, anon, authenticated;
