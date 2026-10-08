create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Gracz' check (char_length(display_name) between 1 and 32),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  stats jsonb not null default '{}'::jsonb,
  imported boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.duels (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  host uuid not null references auth.users (id) on delete cascade,
  guest uuid references auth.users (id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished', 'cancelled')),
  n_questions integer not null default 10,
  time_limit_s integer not null default 180,
  started_at timestamptz,
  winner uuid,
  host_score integer,
  guest_score integer,
  created_at timestamptz not null default now()
);
create unique index duels_open_code on public.duels (code) where status in ('waiting', 'active');
create index duels_host on public.duels (host);
create index duels_guest on public.duels (guest);

create table public.duel_questions (
  duel_id uuid not null references public.duels (id) on delete cascade,
  idx integer not null,
  prompt text not null,
  primary key (duel_id, idx)
);

create table public.duel_keys (
  duel_id uuid not null references public.duels (id) on delete cascade,
  idx integer not null,
  answer text not null,
  primary key (duel_id, idx)
);

create table public.duel_answers (
  duel_id uuid not null references public.duels (id) on delete cascade,
  idx integer not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  correct boolean not null,
  ms integer not null,
  created_at timestamptz not null default now(),
  primary key (duel_id, user_id, idx)
);

create table public.duel_given (
  duel_id uuid not null references public.duels (id) on delete cascade,
  idx integer not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  given text not null,
  primary key (duel_id, user_id, idx)
);

alter table public.profiles enable row level security;
alter table public.progress enable row level security;
alter table public.duels enable row level security;
alter table public.duel_questions enable row level security;
alter table public.duel_keys enable row level security;
alter table public.duel_answers enable row level security;
alter table public.duel_given enable row level security;

revoke all on public.profiles, public.progress, public.duels, public.duel_questions,
  public.duel_keys, public.duel_answers, public.duel_given from anon, authenticated;

grant select on public.profiles, public.progress, public.duels, public.duel_questions, public.duel_answers to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy progress_read_own on public.progress for select to authenticated using (user_id = auth.uid());

create policy duels_read_participant on public.duels for select to authenticated
  using (auth.uid() in (host, guest));

create policy duel_questions_read_started on public.duel_questions for select to authenticated
  using (exists (
    select 1 from public.duels d
    where d.id = duel_id
      and auth.uid() in (d.host, d.guest)
      and d.status in ('active', 'finished')
      and d.started_at <= now()
  ));

create policy duel_answers_read_participant on public.duel_answers for select to authenticated
  using (exists (
    select 1 from public.duels d
    where d.id = duel_id and auth.uid() in (d.host, d.guest)
  ));

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name text;
begin
  name := left(coalesce(
    nullif(meta ->> 'full_name', ''),
    nullif(meta ->> 'name', ''),
    nullif(meta ->> 'user_name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Gracz'
  ), 32);
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, name, meta ->> 'avatar_url');
  insert into public.progress (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.server_time()
returns timestamptz
language sql
stable
as $$ select now() $$;

create function public.sync_progress(p_xp integer, p_stats jsonb)
returns public.progress
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur public.progress;
  budget integer;
  target integer;
  cur_n integer;
  new_n integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_stats is null or jsonb_typeof(p_stats) <> 'object' or pg_column_size(p_stats) > 4096 then
    raise exception 'invalid stats';
  end if;

  select * into cur from public.progress where user_id = uid for update;
  if not found then
    insert into public.progress (user_id) values (uid) returning * into cur;
  end if;

  if cur.imported then
    budget := ceil(6 * extract(epoch from now() - cur.updated_at))::integer;
  else
    budget := 20000;
  end if;
  target := greatest(cur.xp, least(coalesce(p_xp, 0), cur.xp + budget));

  cur_n := coalesce((cur.stats #>> '{tr,n}')::integer, 0) + coalesce((cur.stats #>> '{fl,n}')::integer, 0);
  new_n := coalesce((p_stats #>> '{tr,n}')::integer, 0) + coalesce((p_stats #>> '{fl,n}')::integer, 0);

  update public.progress
  set xp = target,
      stats = case when new_n >= cur_n then p_stats else stats end,
      imported = true,
      updated_at = case when target > cur.xp or not cur.imported then now() else updated_at end
  where user_id = uid
  returning * into cur;

  return cur;
end;
$$;

create function public._random_ip()
returns text
language sql
volatile
as $$
  select concat_ws('.', 1 + floor(random() * 223)::int, floor(random() * 256)::int,
                        floor(random() * 256)::int, floor(random() * 256)::int)
$$;

create function public._gen_question(out prompt text, out answer text)
language plpgsql
volatile
as $$
declare
  kind integer := floor(random() * 6)::integer;
  p integer := 17 + floor(random() * 13)::integer;
  ip text := public._random_ip();
  net inet;
  n integer;
  b integer := 1;
begin
  if p % 8 = 0 then
    p := p + 1;
  end if;
  net := (ip || '/' || p)::inet;

  case kind
    when 0 then
      prompt := format('Adres sieci dla %s/%s?', ip, p);
      answer := host(network(net));
    when 1 then
      prompt := format('Broadcast dla %s/%s?', ip, p);
      answer := host(broadcast(net));
    when 2 then
      prompt := format('Ile hostów w /%s?', p);
      answer := ((2::bigint ^ (32 - p))::bigint - 2)::text;
    when 3 then
      n := 2 + floor(random() * 2000)::integer;
      while (2 ^ b) < n + 2 loop
        b := b + 1;
      end loop;
      prompt := format('Najmniejszy prefiks dla %s hostów?', n);
      answer := (32 - b)::text;
    when 4 then
      prompt := format('Maska dla /%s?', p);
      answer := host(netmask(net));
    else
      prompt := format('Ostatni host w %s/%s?', ip, p);
      answer := host(broadcast(net) - 1);
  end case;
end;
$$;

create function public._check_answer(expected text, given text)
returns boolean
language plpgsql
immutable
as $$
declare
  g text := regexp_replace(lower(btrim(coalesce(given, ''))), '^/', '');
begin
  if g = '' then
    return false;
  end if;
  if expected ~ '^\d+\.\d+\.\d+\.\d+$' then
    if g !~ '^\d{1,3}(\.\d{1,3}){3}$' then
      return false;
    end if;
    begin
      return host(g::inet) = expected;
    exception when others then
      return false;
    end;
  end if;
  return g = expected;
end;
$$;

create function public.create_duel()
returns public.duels
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d public.duels;
  new_code text;
  q record;
  i integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.duels set status = 'cancelled' where host = uid and status = 'waiting';

  loop
    select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::integer, 1), '')
      into new_code from generate_series(1, 6);
    exit when not exists (select 1 from public.duels where code = new_code and status in ('waiting', 'active'));
  end loop;

  insert into public.duels (code, host) values (new_code, uid) returning * into d;

  for i in 0 .. d.n_questions - 1 loop
    loop
      select * into q from public._gen_question();
      exit when not exists (select 1 from public.duel_questions where duel_id = d.id and prompt = q.prompt);
    end loop;
    insert into public.duel_questions (duel_id, idx, prompt) values (d.id, i, q.prompt);
    insert into public.duel_keys (duel_id, idx, answer) values (d.id, i, q.answer);
  end loop;

  return d;
end;
$$;

create function public.join_duel(p_code text)
returns public.duels
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d public.duels;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into d from public.duels
  where code = upper(btrim(p_code)) and status = 'waiting'
  for update;

  if not found then
    raise exception 'Nie ma otwartego pojedynku z tym kodem';
  end if;
  if d.host = uid then
    raise exception 'Nie możesz dołączyć do własnego pojedynku';
  end if;

  update public.duels
  set guest = uid, status = 'active', started_at = now() + interval '4 seconds'
  where id = d.id
  returning * into d;

  return d;
end;
$$;

create function public.cancel_duel(p_duel uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.duels set status = 'cancelled'
  where id = p_duel and host = auth.uid() and status = 'waiting'
$$;

create function public._finalize_duel(p_duel uuid)
returns public.duels
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.duels;
  hs integer;
  gs integer;
  hn integer;
  gn integer;
  hms integer;
  gms integer;
  w uuid;
begin
  select * into d from public.duels where id = p_duel for update;
  if d.status <> 'active' then
    return d;
  end if;

  select count(*) filter (where correct), count(*), coalesce(max(ms), 0)
    into hs, hn, hms from public.duel_answers where duel_id = d.id and user_id = d.host;
  select count(*) filter (where correct), count(*), coalesce(max(ms), 0)
    into gs, gn, gms from public.duel_answers where duel_id = d.id and user_id = d.guest;

  if hs > gs then w := d.host;
  elsif gs > hs then w := d.guest;
  elsif hn > gn then w := d.host;
  elsif gn > hn then w := d.guest;
  elsif hms < gms then w := d.host;
  elsif gms < hms then w := d.guest;
  end if;

  update public.duels
  set status = 'finished', winner = w, host_score = hs, guest_score = gs
  where id = d.id
  returning * into d;

  update public.progress set xp = xp + hs * 3 + case when w = d.host then 20 else 0 end
  where user_id = d.host;
  update public.progress set xp = xp + gs * 3 + case when w = d.guest then 20 else 0 end
  where user_id = d.guest;

  return d;
end;
$$;

create function public.submit_answer(p_duel uuid, p_idx integer, p_answer text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d public.duels;
  done integer;
  expected text;
  ok boolean;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into d from public.duels where id = p_duel for update;
  if not found or uid not in (d.host, d.guest) then
    raise exception 'Nie bierzesz udziału w tym pojedynku';
  end if;
  if d.status <> 'active' or now() < d.started_at then
    raise exception 'Pojedynek nie trwa';
  end if;
  if now() > d.started_at + make_interval(secs => d.time_limit_s) then
    perform public._finalize_duel(d.id);
    return null;
  end if;

  select count(*) into done from public.duel_answers where duel_id = d.id and user_id = uid;
  if p_idx <> done or p_idx >= d.n_questions then
    raise exception 'Nieprawidłowy numer pytania';
  end if;

  select answer into expected from public.duel_keys where duel_id = d.id and idx = p_idx;
  ok := public._check_answer(expected, left(p_answer, 64));

  insert into public.duel_answers (duel_id, idx, user_id, correct, ms)
  values (d.id, p_idx, uid, ok, (extract(epoch from now() - d.started_at) * 1000)::integer);
  insert into public.duel_given (duel_id, idx, user_id, given)
  values (d.id, p_idx, uid, left(coalesce(p_answer, ''), 64));

  if (select count(*) from public.duel_answers where duel_id = d.id) >= 2 * d.n_questions then
    perform public._finalize_duel(d.id);
  end if;

  return ok;
end;
$$;

create function public.finish_duel(p_duel uuid)
returns public.duels
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.duels;
begin
  select * into d from public.duels where id = p_duel;
  if not found or auth.uid() not in (d.host, d.guest) then
    raise exception 'Nie bierzesz udziału w tym pojedynku';
  end if;
  if d.status = 'active' and now() > d.started_at + make_interval(secs => d.time_limit_s) then
    d := public._finalize_duel(d.id);
  end if;
  return d;
end;
$$;

create function public.duel_review(p_duel uuid)
returns table (idx integer, prompt text, answer text, mine text, mine_ok boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d public.duels;
begin
  select * into d from public.duels where id = p_duel;
  if not found or uid not in (d.host, d.guest) then
    raise exception 'Nie bierzesz udziału w tym pojedynku';
  end if;
  if d.status <> 'finished' then
    raise exception 'Pojedynek jeszcze trwa';
  end if;
  return query
    select q.idx, q.prompt, k.answer, g.given, a.correct
    from public.duel_questions q
    join public.duel_keys k on k.duel_id = q.duel_id and k.idx = q.idx
    left join public.duel_answers a on a.duel_id = q.duel_id and a.idx = q.idx and a.user_id = uid
    left join public.duel_given g on g.duel_id = q.duel_id and g.idx = q.idx and g.user_id = uid
    where q.duel_id = d.id
    order by q.idx;
end;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.server_time(),
  public.sync_progress(integer, jsonb),
  public.create_duel(),
  public.join_duel(text),
  public.cancel_duel(uuid),
  public.submit_answer(uuid, integer, text),
  public.finish_duel(uuid),
  public.duel_review(uuid)
to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.duels, public.duel_answers;
  end if;
end;
$$;
