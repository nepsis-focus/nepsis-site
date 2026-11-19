-- Nepsis AI Coach request quotas and explicitly saved private study files.
create table if not exists public.ai_coach_daily_limits (
  subject_hash text primary key check (length(subject_hash) = 64),
  quota_day date not null,
  request_count integer not null check (request_count >= 1),
  updated_at timestamptz not null default now()
);
alter table public.ai_coach_daily_limits enable row level security;
revoke all on public.ai_coach_daily_limits from public, anon, authenticated;

create or replace function public.consume_ai_coach_daily_limit(
  p_subject_hash text,
  p_daily_limit integer,
  p_day date
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_count integer;
begin
  if p_subject_hash is null or length(p_subject_hash) <> 64
     or p_daily_limit < 1 or p_daily_limit > 100
     or p_day is null then
    raise exception 'invalid rate-limit input';
  end if;
  insert into public.ai_coach_daily_limits(subject_hash, quota_day, request_count, updated_at)
  values (p_subject_hash, p_day, 1, now())
  on conflict (subject_hash) do update
    set quota_day = excluded.quota_day,
        request_count = case when public.ai_coach_daily_limits.quota_day = excluded.quota_day
          then public.ai_coach_daily_limits.request_count + 1 else 1 end,
        updated_at = now()
  returning request_count into current_count;
  return current_count <= p_daily_limit;
end;
$$;
revoke all on function public.consume_ai_coach_daily_limit(text, integer, date) from public, anon, authenticated;
grant execute on function public.consume_ai_coach_daily_limit(text, integer, date) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nepsis-study-materials', 'nepsis-study-materials', false, 8388608,
  array['application/pdf', 'text/plain', 'text/markdown'])
on conflict (id) do update set public = false, file_size_limit = 8388608,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Nepsis study files: read own" on storage.objects;
drop policy if exists "Nepsis study files: insert own" on storage.objects;
drop policy if exists "Nepsis study files: update own" on storage.objects;
drop policy if exists "Nepsis study files: delete own" on storage.objects;
create policy "Nepsis study files: read own" on storage.objects for select to authenticated
  using (bucket_id = 'nepsis-study-materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Nepsis study files: insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'nepsis-study-materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Nepsis study files: update own" on storage.objects for update to authenticated
  using (bucket_id = 'nepsis-study-materials' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'nepsis-study-materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Nepsis study files: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'nepsis-study-materials' and (storage.foldername(name))[1] = auth.uid()::text);
