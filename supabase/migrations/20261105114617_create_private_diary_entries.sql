create table public.private_diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null default current_date,
  title text not null default '' check (char_length(title) <= 120),
  content text not null default '' check (char_length(content) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index private_diary_entries_user_date_idx
  on public.private_diary_entries (user_id, entry_date desc, updated_at desc);

alter table public.private_diary_entries enable row level security;

create policy "Users can read their own diary entries"
  on public.private_diary_entries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own diary entries"
  on public.private_diary_entries
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own diary entries"
  on public.private_diary_entries
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own diary entries"
  on public.private_diary_entries
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.private_diary_entries from anon, public;
grant select, insert, update, delete on table public.private_diary_entries to authenticated;

comment on table public.private_diary_entries is
  'Private personal journal entries. Only the owning authenticated user can access them; this table is not connected to any AI feature.';