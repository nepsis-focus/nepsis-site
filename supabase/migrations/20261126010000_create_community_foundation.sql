-- Nepsis community foundation (phase 1): handles, friends, invite-only teams, team chat.
-- Clients never write these tables directly. All writes go through security definer functions,
-- and clients can only read rows they are allowed to see (RLS).
-- NOT APPLIED. Review, then apply through the normal migration flow.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.community_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}#[0-9]{4}$'),
  display_name text not null default '' check (char_length(display_name) <= 40),
  created_at timestamptz not null default now()
);

create table if not exists public.community_friendships (
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high),
  check (requested_by in (user_low, user_high))
);

create table if not exists public.community_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.community_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  owner_id uuid not null references auth.users(id) on delete cascade,
  max_members int not null default 34 check (max_members between 2 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.community_team_members (
  team_id uuid not null references public.community_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.community_invites (
  token text primary key check (char_length(token) = 64),
  team_id uuid not null references public.community_teams(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  max_uses int not null default 10 check (max_uses between 1 and 100),
  uses int not null default 0 check (uses >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.community_messages (
  id bigint generated always as identity primary key,
  team_id uuid not null references public.community_teams(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists community_messages_team_created_idx
  on public.community_messages (team_id, created_at desc);

create table if not exists public.community_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  message_id bigint not null references public.community_messages(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (reporter_id, message_id)
);

-- ---------------------------------------------------------------------------
-- RLS: enable everywhere. Clients get select only, and only on their own rows.
-- ---------------------------------------------------------------------------

alter table public.community_profiles enable row level security;
alter table public.community_friendships enable row level security;
alter table public.community_blocks enable row level security;
alter table public.community_teams enable row level security;
alter table public.community_team_members enable row level security;
alter table public.community_invites enable row level security;
alter table public.community_messages enable row level security;
alter table public.community_reports enable row level security;

-- Membership helper. Used by policies, so it bypasses RLS to avoid recursion.
create or replace function public.community_is_member(p_team uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.community_team_members m
    where m.team_id = p_team
      and m.user_id = p_user
  );
$$;

revoke all on function public.community_is_member(uuid, uuid) from public, anon;
grant execute on function public.community_is_member(uuid, uuid) to authenticated;

drop policy if exists "community profile: own row" on public.community_profiles;
create policy "community profile: own row"
  on public.community_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "community friendships: own rows" on public.community_friendships;
create policy "community friendships: own rows"
  on public.community_friendships for select to authenticated
  using ((select auth.uid()) in (user_low, user_high));

drop policy if exists "community blocks: own rows" on public.community_blocks;
create policy "community blocks: own rows"
  on public.community_blocks for select to authenticated
  using ((select auth.uid()) = blocker_id);

drop policy if exists "community teams: members read" on public.community_teams;
create policy "community teams: members read"
  on public.community_teams for select to authenticated
  using (public.community_is_member(id, (select auth.uid())));

drop policy if exists "community team members: members read" on public.community_team_members;
create policy "community team members: members read"
  on public.community_team_members for select to authenticated
  using (public.community_is_member(team_id, (select auth.uid())));

-- community_invites: no client policy. Tokens are never readable by clients.

drop policy if exists "community messages: members read, hide blocked senders" on public.community_messages;
create policy "community messages: members read, hide blocked senders"
  on public.community_messages for select to authenticated
  using (
    public.community_is_member(team_id, (select auth.uid()))
    and not exists (
      select 1
      from public.community_blocks b
      where b.blocker_id = (select auth.uid())
        and b.blocked_id = community_messages.sender_id
    )
  );

-- community_reports: no client policy. Reports are read by the team only, later, via a moderation path.

-- Grants: authenticated can select (RLS limits rows). No insert, update or delete for clients.
revoke all on public.community_profiles, public.community_friendships, public.community_blocks,
  public.community_teams, public.community_team_members, public.community_invites,
  public.community_messages, public.community_reports from anon, authenticated;

grant select on public.community_profiles, public.community_friendships, public.community_blocks,
  public.community_teams, public.community_team_members, public.community_messages to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: handle
-- ---------------------------------------------------------------------------

create or replace function public.community_claim_handle(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_base text;
  v_handle text;
  v_tries int := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.community_profiles where user_id = v_uid) then
    return (select handle from public.community_profiles where user_id = v_uid);
  end if;

  v_base := regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9_]', '', 'g');
  if char_length(v_base) < 3 then
    v_base := 'nepsis';
  end if;
  v_base := left(v_base, 20);

  loop
    v_handle := v_base || '#' || lpad((floor(random() * 10000))::int::text, 4, '0');
    begin
      insert into public.community_profiles (user_id, handle, display_name)
      values (v_uid, v_handle, left(btrim(coalesce(p_name, '')), 40));
      return v_handle;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 20 then
        raise exception 'handle_unavailable';
      end if;
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: friends
-- ---------------------------------------------------------------------------

create or replace function public.community_send_friend_request(p_handle text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_low uuid;
  v_high uuid;
  v_existing public.community_friendships%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select p.user_id into v_target
  from public.community_profiles p
  where p.handle = lower(btrim(coalesce(p_handle, '')));

  if v_target is null then
    raise exception 'handle_not_found' using errcode = 'P0002';
  end if;

  if v_target = v_uid then
    raise exception 'cannot_add_self';
  end if;

  -- If either side blocked the other, do nothing and say nothing (no leak of the block).
  if exists (
    select 1 from public.community_blocks b
    where (b.blocker_id = v_uid and b.blocked_id = v_target)
       or (b.blocker_id = v_target and b.blocked_id = v_uid)
  ) then
    return;
  end if;

  v_low := least(v_uid, v_target);
  v_high := greatest(v_uid, v_target);

  select * into v_existing
  from public.community_friendships f
  where f.user_low = v_low and f.user_high = v_high;

  if found then
    -- Both sides asked each other: that counts as accepting.
    if v_existing.status = 'pending' and v_existing.requested_by = v_target then
      update public.community_friendships
      set status = 'accepted'
      where user_low = v_low and user_high = v_high;
    end if;
    return;
  end if;

  insert into public.community_friendships (user_low, user_high, requested_by, status)
  values (v_low, v_high, v_uid, 'pending');
end;
$$;

create or replace function public.community_respond_friend_request(p_user uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_low uuid := least(v_uid, p_user);
  v_high uuid := greatest(v_uid, p_user);
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Only the person who received the request can answer it.
  if p_accept then
    update public.community_friendships
    set status = 'accepted'
    where user_low = v_low and user_high = v_high
      and status = 'pending'
      and requested_by = p_user;
  else
    delete from public.community_friendships
    where user_low = v_low and user_high = v_high
      and status = 'pending'
      and requested_by = p_user;
  end if;
end;
$$;

create or replace function public.community_block_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_user = v_uid then
    raise exception 'cannot_block_self';
  end if;

  insert into public.community_blocks (blocker_id, blocked_id)
  values (v_uid, p_user)
  on conflict do nothing;

  delete from public.community_friendships
  where user_low = least(v_uid, p_user) and user_high = greatest(v_uid, p_user);
end;
$$;

create or replace function public.community_list_friends()
returns table (
  friend_id uuid,
  friend_handle text,
  friend_name text,
  friend_status text,
  requested_by_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when f.user_low = auth.uid() then f.user_high else f.user_low end,
    p.handle,
    p.display_name,
    f.status,
    f.requested_by
  from public.community_friendships f
  join public.community_profiles p
    on p.user_id = case when f.user_low = auth.uid() then f.user_high else f.user_low end
  where auth.uid() in (f.user_low, f.user_high)
  order by p.handle;
$$;

-- ---------------------------------------------------------------------------
-- RPC: teams
-- ---------------------------------------------------------------------------

create or replace function public.community_create_team(p_name text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_team uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_max int := 34;
  v_member uuid;
  v_count int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 40 then
    raise exception 'invalid_team_name';
  end if;

  insert into public.community_teams (name, owner_id, max_members)
  values (v_name, v_uid, v_max)
  returning id into v_team;

  insert into public.community_team_members (team_id, user_id, role)
  values (v_team, v_uid, 'owner');

  foreach v_member in array coalesce(p_member_ids, '{}') loop
    continue when v_member = v_uid;

    -- Only accepted friends can be added at creation time.
    if not exists (
      select 1 from public.community_friendships f
      where f.status = 'accepted'
        and f.user_low = least(v_uid, v_member)
        and f.user_high = greatest(v_uid, v_member)
    ) then
      raise exception 'not_a_friend' using errcode = '42501';
    end if;

    select count(*) into v_count from public.community_team_members where team_id = v_team;
    if v_count >= v_max then
      raise exception 'team_full';
    end if;

    insert into public.community_team_members (team_id, user_id, role)
    values (v_team, v_member, 'member')
    on conflict do nothing;
  end loop;

  return v_team;
end;
$$;

create or replace function public.community_create_invite(p_team uuid, p_hours int, p_max_uses int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.community_is_member(p_team, v_uid) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if p_hours is null or p_hours < 1 or p_hours > 168 then
    raise exception 'invalid_expiry';
  end if;

  -- 64 hex chars from two random v4 UUIDs (gen_random_uuid uses a CSPRNG).
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.community_invites (token, team_id, created_by, expires_at, max_uses)
  values (v_token, p_team, v_uid, now() + make_interval(hours => p_hours), coalesce(p_max_uses, 10));

  return v_token;
end;
$$;

create or replace function public.community_join_with_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.community_invites%rowtype;
  v_count int;
  v_rows int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_invite
  from public.community_invites
  where token = p_token
  for update;

  if not found or v_invite.expires_at <= now() or v_invite.uses >= v_invite.max_uses then
    raise exception 'invite_invalid';
  end if;

  if public.community_is_member(v_invite.team_id, v_uid) then
    return v_invite.team_id;
  end if;

  select count(*) into v_count from public.community_team_members where team_id = v_invite.team_id;
  if v_count >= (select max_members from public.community_teams where id = v_invite.team_id) then
    raise exception 'team_full';
  end if;

  insert into public.community_team_members (team_id, user_id, role)
  values (v_invite.team_id, v_uid, 'member')
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    update public.community_invites set uses = uses + 1 where token = p_token;
  end if;

  return v_invite.team_id;
end;
$$;

create or replace function public.community_list_team_members(p_team uuid)
returns table (
  member_id uuid,
  member_handle text,
  member_name text,
  member_role text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.community_is_member(p_team, auth.uid()) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  return query
    select m.user_id, p.handle, p.display_name, m.role
    from public.community_team_members m
    join public.community_profiles p on p.user_id = m.user_id
    where m.team_id = p_team
    order by m.joined_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: messages and reports
-- ---------------------------------------------------------------------------

create or replace function public.community_send_message(p_team uuid, p_body text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_recent int;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.community_is_member(p_team, v_uid) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception 'invalid_message_length';
  end if;

  -- Simple rate limit: at most 5 messages per 10 seconds per user.
  select count(*) into v_recent
  from public.community_messages
  where sender_id = v_uid and created_at > now() - interval '10 seconds';
  if v_recent >= 5 then
    raise exception 'rate_limited';
  end if;

  insert into public.community_messages (team_id, sender_id, body)
  values (p_team, v_uid, v_body)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.community_report_message(p_message bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_team uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select team_id into v_team from public.community_messages where id = p_message;
  if v_team is null or not public.community_is_member(v_team, v_uid) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  insert into public.community_reports (reporter_id, message_id, reason)
  values (v_uid, p_message, btrim(coalesce(p_reason, '')))
  on conflict (reporter_id, message_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: only signed-in users can call these. Anon cannot.
-- ---------------------------------------------------------------------------

revoke all on function
  public.community_claim_handle(text),
  public.community_send_friend_request(text),
  public.community_respond_friend_request(uuid, boolean),
  public.community_block_user(uuid),
  public.community_list_friends(),
  public.community_create_team(text, uuid[]),
  public.community_create_invite(uuid, int, int),
  public.community_join_with_invite(text),
  public.community_list_team_members(uuid),
  public.community_send_message(uuid, text),
  public.community_report_message(bigint, text)
from public, anon;

grant execute on function
  public.community_claim_handle(text),
  public.community_send_friend_request(text),
  public.community_respond_friend_request(uuid, boolean),
  public.community_block_user(uuid),
  public.community_list_friends(),
  public.community_create_team(text, uuid[]),
  public.community_create_invite(uuid, int, int),
  public.community_join_with_invite(text),
  public.community_list_team_members(uuid),
  public.community_send_message(uuid, text),
  public.community_report_message(bigint, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: team chat. Subscribers only receive rows their RLS select policy allows.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'community_messages'
     ) then
    alter publication supabase_realtime add table public.community_messages;
  end if;
end $$;
