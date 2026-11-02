-- =====================================================================
-- Woolly Run : initial schema, security (RLS) and RPC functions
-- Run in the Supabase SQL editor, or with the CLI: `supabase db push`
-- =====================================================================

-- ---------- tables ----------
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text,
  name           text not null default 'Player' check (char_length(name) between 1 and 24),
  country        char(2) check (country is null or country ~ '^[A-Z]{2}$'),
  avatar_url     text,
  role           text not null default 'user' check (role in ('user','admin')),
  banned         boolean not null default false,
  best_score     integer not null default 0 check (best_score >= 0),
  best_distance  integer not null default 0 check (best_distance >= 0),
  best_at        timestamptz,
  cleared        smallint[] not null default '{}',
  created_at     timestamptz not null default now(),
  last_seen      timestamptz not null default now()
);
create index if not exists profiles_country_idx on public.profiles (country);
create index if not exists profiles_best_idx    on public.profiles (best_score desc, best_at asc) where not banned;
create index if not exists profiles_created_idx on public.profiles (created_at desc);

create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  mode        text not null default 'infinite' check (mode in ('infinite')),
  score       integer not null check (score between 0 and 2000000),
  distance    integer not null check (distance between 0 and 200000),
  clovers     integer not null default 0 check (clovers >= 0),
  duration    integer not null check (duration >= 1),
  country     char(2),
  created_at  timestamptz not null default now()
);
create index if not exists scores_user_idx  on public.scores (user_id, score desc);
create index if not exists scores_score_idx on public.scores (score desc);

create table if not exists public.ad_daily (
  day        date not null,
  placement  text not null check (placement in ('banner','interstitial')),
  event      text not null check (event in ('impression','click')),
  n          bigint not null default 0,
  primary key (day, placement, event)
);

create table if not exists public.ad_revenue (
  id           uuid primary key default gen_random_uuid(),
  day          date not null,
  network      text not null default 'meta',
  placement    text not null default 'all',
  amount       numeric(12,4) not null check (amount >= 0),
  impressions  bigint not null default 0,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists ad_revenue_day_idx on public.ad_revenue (day desc);

create table if not exists public.app_config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
insert into public.app_config (key, value) values
  ('ads', '{"enabled":true,"banner":{"enabled":true,"placementId":""},"interstitial":{"enabled":true,"placementId":"","minGapSec":0},"ecpm":{"banner":0.4,"interstitial":5}}'::jsonb)
on conflict (key) do nothing;

-- ---------- lock everything down (RLS) ----------
alter table public.profiles   enable row level security;
alter table public.scores     enable row level security;
alter table public.ad_daily   enable row level security;
alter table public.ad_revenue enable row level security;
alter table public.app_config enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- a signed-in player may read ONLY their own profile row; every write goes through RPCs below
grant select on public.profiles to authenticated;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());

-- ---------- new auth user -> profile ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text; v_country text;
begin
  v_name := left(regexp_replace(coalesce(
              nullif(trim(new.raw_user_meta_data->>'name'), ''),
              nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
              split_part(coalesce(new.email, 'player'), '@', 1), 'Player'), '[<>]', '', 'g'), 24);
  if v_name is null or v_name = '' then v_name := 'Player'; end if;
  v_country := upper(nullif(new.raw_user_meta_data->>'country', ''));
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then v_country := null; end if;
  insert into public.profiles (id, email, name, country, avatar_url)
  values (new.id, new.email, v_name, v_country,
          coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- player RPCs (called from the browser with the player's JWT) ----------
create or replace function public.my_profile() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is null then return null; end if;
  update public.profiles set last_seen = now() where id = auth.uid();
  select jsonb_build_object('id', id, 'name', name, 'country', country, 'avatar_url', avatar_url, 'role', role,
                            'best_score', best_score, 'best_distance', best_distance, 'cleared', cleared, 'created_at', created_at)
    into r from public.profiles where id = auth.uid();
  return r;
end $$;

create or replace function public.update_profile(p_name text default null, p_country text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_name text := nullif(left(regexp_replace(trim(coalesce(p_name, '')), '[<>]', '', 'g'), 24), '');
        v_c text := upper(nullif(trim(coalesce(p_country, '')), ''));
begin
  if auth.uid() is null then raise exception 'login_required' using errcode = '28000'; end if;
  if v_c is not null and v_c !~ '^[A-Z]{2}$' then raise exception 'invalid_country' using errcode = '22023'; end if;
  update public.profiles set name = coalesce(v_name, name), country = coalesce(v_c, country)
   where id = auth.uid() and not banned;
  return public.my_profile();
end $$;

create or replace function public.mark_level_cleared(p_level int) returns smallint[]
language plpgsql security definer set search_path = public as $$
declare r smallint[];
begin
  if auth.uid() is null then raise exception 'login_required' using errcode = '28000'; end if;
  if p_level is null or p_level < 1 or p_level > 10 then raise exception 'invalid_level' using errcode = '22023'; end if;
  update public.profiles
     set cleared = (select coalesce(array_agg(distinct x order by x), '{}') from unnest(cleared || p_level::smallint) as x)
   where id = auth.uid() and not banned
  returning cleared into r;
  return r;
end $$;

create or replace function public.submit_score(p_score int, p_distance int, p_clovers int, p_duration int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_p public.profiles; v_last timestamptz; v_w bigint; v_c bigint; v_tw bigint; v_tc bigint; v_res jsonb;
begin
  if v_uid is null then raise exception 'login_required' using errcode = '28000'; end if;
  select * into v_p from public.profiles where id = v_uid;
  if not found or v_p.banned then raise exception 'account_suspended' using errcode = '42501'; end if;
  if v_p.country is null then raise exception 'country_required' using errcode = '22023'; end if;
  if p_score is null or p_distance is null or p_clovers is null or p_duration is null
     or p_score < 0 or p_distance < 0 or p_clovers < 0 or p_duration < 1 then
    raise exception 'invalid_score' using errcode = '22023';
  end if;
  if p_score > 2000000 or p_distance > 200000 or p_distance::numeric / p_duration > 35
     or p_score > p_distance + p_clovers * 10 + 5 or p_clovers > p_distance then
    raise exception 'implausible_run' using errcode = '22023';
  end if;
  select max(created_at) into v_last from public.scores where user_id = v_uid;
  if v_last is not null and v_last > now() - interval '5 seconds' then raise exception 'rate_limited' using errcode = '54000'; end if;

  insert into public.scores (user_id, score, distance, clovers, duration, country)
  values (v_uid, p_score, p_distance, p_clovers, p_duration, v_p.country);
  delete from public.scores where user_id = v_uid and id not in
    (select id from public.scores where user_id = v_uid order by score desc, created_at asc limit 20);
  update public.profiles
     set best_distance = case when p_score > best_score then p_distance else best_distance end,
         best_at       = case when p_score > best_score then now() else best_at end,
         best_score    = greatest(best_score, p_score),
         last_seen     = now()
   where id = v_uid;

  select count(*) + 1, (select count(*) from public.profiles where not banned and best_score > 0)
    into v_w, v_tw from public.profiles x, public.profiles me
   where me.id = v_uid and not x.banned and (x.best_score > me.best_score or (x.best_score = me.best_score and x.best_at < me.best_at));
  select count(*) + 1, (select count(*) from public.profiles where not banned and best_score > 0 and country = v_p.country)
    into v_c, v_tc from public.profiles x, public.profiles me
   where me.id = v_uid and not x.banned and x.country = me.country and (x.best_score > me.best_score or (x.best_score = me.best_score and x.best_at < me.best_at));
  select jsonb_build_object('ok', true, 'best', (select best_score from public.profiles where id = v_uid),
                            'worldRank', v_w, 'worldTotal', v_tw, 'countryRank', v_c, 'countryTotal', v_tc, 'country', v_p.country) into v_res;
  return v_res;
end $$;

create or replace function public.leaderboard(p_scope text default 'world', p_country text default null, p_limit int default 20)
returns table (rnk bigint, name text, country char(2), score int, distance int, achieved_at timestamptz, is_me boolean)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by p.best_score desc, p.best_at asc) as rnk, p.name, p.country, p.best_score, p.best_distance, p.best_at, (p.id = auth.uid())
    from public.profiles p
   where not p.banned and p.best_score > 0 and (coalesce(p_scope, 'world') <> 'country' or p.country = upper(p_country))
   order by p.best_score desc, p.best_at asc
   limit least(greatest(coalesce(p_limit, 20), 1), 100)
$$;

create or replace function public.my_rank(p_scope text default 'world') returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'score', me.best_score,
    'rank',  (select count(*) + 1 from public.profiles x where not x.banned and (coalesce(p_scope, 'world') <> 'country' or x.country = me.country)
                 and (x.best_score > me.best_score or (x.best_score = me.best_score and x.best_at < me.best_at))),
    'total', (select count(*) from public.profiles x where not x.banned and x.best_score > 0 and (coalesce(p_scope, 'world') <> 'country' or x.country = me.country)))
  from public.profiles me where me.id = auth.uid() and me.best_score > 0
$$;

create or replace function public.country_ranking(p_limit int default 50)
returns table (rnk bigint, country char(2), players bigint, best int, total bigint)
language sql stable security definer set search_path = public as $$
  with ranked as (
    select p.country, p.best_score, row_number() over (partition by p.country order by p.best_score desc) as rn
      from public.profiles p where not p.banned and p.best_score > 0 and p.country is not null),
  agg as (
    select r.country, count(*) as players, max(r.best_score) as best, sum(r.best_score) filter (where r.rn <= 10) as total
      from ranked r group by r.country)
  select row_number() over (order by a.total desc, a.country), a.country, a.players, a.best, a.total
    from agg a order by a.total desc, a.country limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;

grant execute on function public.leaderboard(text, text, int), public.country_ranking(int) to anon, authenticated;
grant execute on function public.my_profile(), public.update_profile(text, text), public.mark_level_cleared(int),
                          public.submit_score(int, int, int, int), public.my_rank(text) to authenticated;

-- ---------- server-only RPCs (the Node server calls these with the service_role key) ----------
create or replace function public.srv_sync_profile(p_id uuid, p_email text, p_make_admin boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  update public.profiles set email = coalesce(p_email, email), last_seen = now(),
         role = case when p_make_admin then 'admin' else role end
   where id = p_id;
  select to_jsonb(p) into r from public.profiles p where p.id = p_id;
  return r;
end $$;

create or replace function public.srv_get_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from public.app_config
$$;

create or replace function public.srv_set_config(p_key text, p_value jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.app_config (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now()
$$;

create or replace function public.srv_track_ad(p_placement text, p_event text) returns void
language sql security definer set search_path = public as $$
  insert into public.ad_daily (day, placement, event, n) values ((now() at time zone 'utc')::date, p_placement, p_event, 1)
  on conflict (day, placement, event) do update set n = public.ad_daily.n + 1
$$;

create or replace function public.srv_ad_series(p_days int default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  with days as (select d::date as day from generate_series((current_date - (greatest(p_days, 1) - 1))::timestamp, current_date::timestamp, interval '1 day') as d),
  a as (select day,
          coalesce(sum(n) filter (where placement = 'banner'       and event = 'impression'), 0) as bi,
          coalesce(sum(n) filter (where placement = 'banner'       and event = 'click'), 0)      as bc,
          coalesce(sum(n) filter (where placement = 'interstitial' and event = 'impression'), 0) as ii,
          coalesce(sum(n) filter (where placement = 'interstitial' and event = 'click'), 0)      as ic
        from public.ad_daily group by day),
  r as (select day, sum(amount) as rep from public.ad_revenue group by day)
  select coalesce(jsonb_agg(jsonb_build_object('date', to_char(days.day, 'YYYY-MM-DD'), 'bannerImp', coalesce(a.bi, 0), 'bannerClk', coalesce(a.bc, 0),
                                               'intImp', coalesce(a.ii, 0), 'intClk', coalesce(a.ic, 0), 'reported', coalesce(r.rep, 0)) order by days.day), '[]'::jsonb)
    from days left join a on a.day = days.day left join r on r.day = days.day
$$;

create or replace function public.srv_admin_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'users', jsonb_build_object(
      'total',    (select count(*) from public.profiles),
      'new7',     (select count(*) from public.profiles where created_at > now() - interval '7 days'),
      'active24', (select count(*) from public.profiles where last_seen > now() - interval '24 hours'),
      'banned',   (select count(*) from public.profiles where banned),
      'byCountry',(select coalesce(jsonb_agg(jsonb_build_array(t.c, t.n) order by t.n desc), '[]'::jsonb)
                     from (select coalesce(country::text, '??') as c, count(*) as n from public.profiles group by 1 order by 2 desc limit 10) t)),
    'scores', (select count(*) from public.scores),
    'top',    (select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'country', t.country, 'score', t.best_score, 'distance', t.best_distance) order by t.best_score desc), '[]'::jsonb)
                 from (select name, country, best_score, best_distance from public.profiles where not banned and best_score > 0 order by best_score desc limit 5) t))
$$;

create or replace function public.srv_admin_users(p_q text default '', p_page int default 1, p_per int default 25) returns jsonb
language sql stable security definer set search_path = public as $$
  with f as (select * from public.profiles
              where coalesce(p_q, '') = '' or name ilike '%' || p_q || '%' or email ilike '%' || p_q || '%' or country = upper(p_q))
  select jsonb_build_object('total', (select count(*) from f), 'page', greatest(p_page, 1),
    'users', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
                from (select id, name, email, country, role, banned, best_score, created_at, last_seen from f order by created_at desc
                       limit least(greatest(p_per, 1), 100) offset (greatest(p_page, 1) - 1) * least(greatest(p_per, 1), 100)) t))
$$;

create or replace function public.srv_admin_update_user(p_id uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  update public.profiles set
    name    = coalesce(nullif(left(regexp_replace(trim(p_patch->>'name'), '[<>]', '', 'g'), 24), ''), name),
    country = case when p_patch ? 'country' then nullif(upper(p_patch->>'country'), '') else country end,
    role    = case when p_patch->>'role' in ('user', 'admin') then p_patch->>'role' else role end,
    banned  = case when p_patch ? 'banned' then (p_patch->>'banned')::boolean else banned end
  where id = p_id;
  select to_jsonb(p) - 'cleared' into r from public.profiles p where p.id = p_id;
  return r;
end $$;

create or replace function public.srv_admin_scores(p_limit int default 100) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    from (select s.id, s.score, s.distance, s.clovers, s.duration, s.country, s.created_at, p.name, p.email
            from public.scores s join public.profiles p on p.id = s.user_id
           order by s.score desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) t
$$;

create or replace function public.srv_admin_delete_score(p_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  delete from public.scores where id = p_id returning user_id into v_uid;
  if v_uid is null then return false; end if;
  update public.profiles set best_score = 0, best_distance = 0, best_at = null where id = v_uid;
  update public.profiles p set best_score = m.score, best_distance = m.distance, best_at = m.created_at
    from (select score, distance, created_at from public.scores where user_id = v_uid order by score desc, created_at asc limit 1) m
   where p.id = v_uid;
  return true;
end $$;

create or replace function public.srv_revenue_list(p_limit int default 200) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    from (select id, to_char(day, 'YYYY-MM-DD') as date, network, placement, amount, impressions, note
            from public.ad_revenue order by day desc, created_at desc limit least(greatest(coalesce(p_limit, 200), 1), 1000)) t
$$;

create or replace function public.srv_revenue_add(p_day date, p_network text, p_placement text, p_amount numeric, p_impressions bigint, p_note text) returns jsonb
language sql security definer set search_path = public as $$
  insert into public.ad_revenue (day, network, placement, amount, impressions, note)
  values (p_day, left(coalesce(p_network, 'meta'), 20), left(coalesce(p_placement, 'all'), 20), p_amount, coalesce(p_impressions, 0), left(p_note, 80))
  returning to_jsonb(ad_revenue)
$$;

create or replace function public.srv_revenue_delete(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from public.ad_revenue where id = p_id;
  return found;
end $$;

do $$ declare f text; begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'srv\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
