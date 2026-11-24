-- Persistent per-IP Coach rate limiting and explicit custom-stage labeling.
create table if not exists public.ai_coach_ip_limits (
  ip_hash text primary key check (length(ip_hash) = 64),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 1),
  updated_at timestamptz not null default now()
);
alter table public.ai_coach_ip_limits enable row level security;
revoke all on public.ai_coach_ip_limits from public, anon, authenticated;

create or replace function public.consume_ai_coach_ip_limit(
  p_ip_hash text,
  p_window_start timestamptz,
  p_request_limit integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  if p_ip_hash is null or length(p_ip_hash) <> 64
     or p_window_start is null
     or p_request_limit < 1 or p_request_limit > 100 then
    raise exception 'invalid rate-limit input';
  end if;
  insert into public.ai_coach_ip_limits(ip_hash, window_started_at, request_count, updated_at)
  values (p_ip_hash, p_window_start, 1, now())
  on conflict (ip_hash) do update
    set window_started_at = excluded.window_started_at,
        request_count = case
          when public.ai_coach_ip_limits.window_started_at = excluded.window_started_at
          then public.ai_coach_ip_limits.request_count + 1 else 1 end,
        updated_at = now()
  returning request_count into current_count;
  return current_count <= p_request_limit;
end;
$$;
revoke all on function public.consume_ai_coach_ip_limit(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_coach_ip_limit(text, timestamptz, integer) to service_role;

alter table private.focus_timer_sessions
  add column if not exists is_custom boolean not null default false;

create or replace function public.nepsis_timer_mark_custom(
  p_session_id uuid,
  p_token_hash text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_session_id is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  update private.focus_timer_sessions
     set is_custom = true,
         updated_at = pg_catalog.clock_timestamp()
   where id = p_session_id
     and token_hash = p_token_hash
     and completed_at is null;
  return found;
end;
$function$;
revoke all on function public.nepsis_timer_mark_custom(uuid, text) from public, anon, authenticated;
grant execute on function public.nepsis_timer_mark_custom(uuid, text) to service_role;

create or replace function private.sync_completed_focus_timer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.completed_at is null or new.user_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.completed_at is not distinct from new.completed_at
     and old.user_id is not distinct from new.user_id then
    return new;
  end if;
  insert into public.focus_sessions
    (user_id, duration_minutes, session_date, stage, completed_at, source_timer_session_id)
  values
    (new.user_id,
     new.stage_minutes,
     (new.completed_at at time zone 'UTC')::date,
     case when new.is_custom then 'custom' else
       case new.stage_minutes
         when 5 then 'start'
         when 10 then 'warmup'
         when 25 then 'rhythm'
         when 45 then 'depth'
         when 60 then 'flow'
         else 'custom'
       end
     end,
     new.completed_at,
     new.id)
  on conflict (source_timer_session_id) do nothing;
  return new;
end;
$function$;

-- Custom sessions may use a standard duration (for example 25 minutes) but still retain stage='custom'.
ALTER TABLE public.focus_sessions
  DROP CONSTRAINT IF EXISTS focus_sessions_stage_duration_check;
ALTER TABLE public.focus_sessions
  ADD CONSTRAINT focus_sessions_stage_duration_check CHECK (
    (stage = 'start' AND duration_minutes = 5) OR
    (stage = 'warmup' AND duration_minutes = 10) OR
    (stage = 'rhythm' AND duration_minutes = 25) OR
    (stage = 'depth' AND duration_minutes = 45) OR
    (stage = 'flow' AND duration_minutes = 60) OR
    (stage = 'custom' AND duration_minutes BETWEEN 5 AND 180)
  );
