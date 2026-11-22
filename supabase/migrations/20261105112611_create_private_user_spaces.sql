create table if not exists public.user_spaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null default '{"display_name":"","bio":""}'::jsonb,
  goals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_spaces enable row level security;

grant select, insert, update, delete on public.user_spaces to authenticated;

drop policy if exists "Users can read their own private space" on public.user_spaces;
create policy "Users can read their own private space"
  on public.user_spaces for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own private space" on public.user_spaces;
create policy "Users can create their own private space"
  on public.user_spaces for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own private space" on public.user_spaces;
create policy "Users can update their own private space"
  on public.user_spaces for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own private space" on public.user_spaces;
create policy "Users can delete their own private space"
  on public.user_spaces for delete to authenticated
  using ((select auth.uid()) = user_id);
