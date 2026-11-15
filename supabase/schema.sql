-- Ритм — схема БД (Supabase / Postgres)
-- Выполнить целиком в SQL Editor. Файл идемпотентен: можно запускать повторно.
--
-- Модель:
--   themes       — «экраны» с заглавным фото, переключаются свайпом
--   habits       — привычки темы, отмечаются по датам (habit_logs)
--   goals        — цели месяца (тоггл сделано/нет)
--
-- Все таблицы закрыты RLS: user_id = auth.uid(). Регистрация — по коду-приглашению.

create extension if not exists "pgcrypto";

-- ── Темы ───────────────────────────────────────────────────────
create table if not exists public.themes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null,
  photo_url   text,
  accent      text not null default '#7a5af8',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ── Привычки темы ──────────────────────────────────────────────
create table if not exists public.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  theme_id    uuid not null references public.themes (id) on delete cascade,
  title       text not null,
  color       text not null default '#7a5af8',
  sort_order  integer not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── Отметки: одна привычка — одна дата, не больше ──────────────
create table if not exists public.habit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id    uuid not null references public.habits (id) on delete cascade,
  date        date not null,
  created_at  timestamptz not null default now(),
  unique (habit_id, date)
);

-- ── Цели месяца ────────────────────────────────────────────────
-- month хранится первым числом месяца: '2026-11-01'.
create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  theme_id    uuid not null references public.themes (id) on delete cascade,
  month       date not null,
  title       text not null,
  done        boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ── Индексы ────────────────────────────────────────────────────
create index if not exists themes_user_idx      on public.themes (user_id, sort_order);
create index if not exists habits_theme_idx     on public.habits (user_id, theme_id, sort_order);
create index if not exists habit_logs_user_date_idx on public.habit_logs (user_id, date);
create index if not exists habit_logs_habit_idx on public.habit_logs (habit_id);
create index if not exists goals_lookup_idx     on public.goals (user_id, theme_id, month, sort_order);

-- ── Row Level Security ─────────────────────────────────────────
alter table public.themes     enable row level security;
alter table public.habits     enable row level security;
alter table public.habit_logs enable row level security;
alter table public.goals      enable row level security;

drop policy if exists "themes_own" on public.themes;
create policy "themes_own" on public.themes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "habits_own" on public.habits;
create policy "habits_own" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "habit_logs_own" on public.habit_logs;
create policy "habit_logs_own" on public.habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goals_own" on public.goals;
create policy "goals_own" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Целостность: ссылки только на свои темы/привычки ───────────
-- RLS не мешает подставить чужой theme_id — составной внешний ключ закрывает и это.

alter table public.themes drop constraint if exists themes_id_user_key;
alter table public.themes add constraint themes_id_user_key unique (id, user_id);

alter table public.habits drop constraint if exists habits_id_user_key;
alter table public.habits add constraint habits_id_user_key unique (id, user_id);

alter table public.habits drop constraint if exists habits_theme_id_fkey;
alter table public.habits drop constraint if exists habits_theme_owner_fkey;
alter table public.habits
  add constraint habits_theme_owner_fkey
  foreign key (theme_id, user_id) references public.themes (id, user_id) on delete cascade;

alter table public.habit_logs drop constraint if exists habit_logs_habit_id_fkey;
alter table public.habit_logs drop constraint if exists habit_logs_habit_owner_fkey;
alter table public.habit_logs
  add constraint habit_logs_habit_owner_fkey
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade;

alter table public.goals drop constraint if exists goals_theme_id_fkey;
alter table public.goals drop constraint if exists goals_theme_owner_fkey;
alter table public.goals
  add constraint goals_theme_owner_fkey
  foreign key (theme_id, user_id) references public.themes (id, user_id) on delete cascade;

-- ── Регистрация по коду-приглашению ────────────────────────────
-- Публичной регистрации нет: аккаунт создаётся только с валидным кодом.

create schema if not exists private;

create table if not exists private.signup_invites (
  code       text primary key,
  note       text not null default '',
  created_at timestamptz not null default now()
);

alter table private.signup_invites enable row level security;
-- Политик намеренно нет: читать/писать может только security definer ниже.

insert into private.signup_invites (code, note)
select substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), 'семейный код'
where not exists (select 1 from private.signup_invites);

-- Предварительная проверка кода на клиенте — ради понятной ошибки.
create or replace function public.check_invite_code(code text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from private.signup_invites where signup_invites.code = $1);
$$;

grant execute on function public.check_invite_code(text) to anon, authenticated;

-- Жёсткая проверка в БД: без кода аккаунт не создастся даже в обход приложения.
create or replace function private.check_invite_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from private.signup_invites
    where signup_invites.code = new.raw_user_meta_data ->> 'invite_code'
  ) then
    raise exception 'invalid_invite_code';
  end if;
  return new;
end;
$$;

drop trigger if exists check_invite_on_signup on auth.users;
create trigger check_invite_on_signup
  before insert on auth.users
  for each row execute function private.check_invite_on_signup();

-- ── Supabase Storage: фото тем ─────────────────────────────────
-- Публичное чтение (ссылки на фото открываются без авторизации),
-- запись — только в свою папку <user_id>/….

insert into storage.buckets (id, name, public)
values ('theme-photos', 'theme-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "theme_photos_read" on storage.objects;
create policy "theme_photos_read" on storage.objects
  for select using (bucket_id = 'theme-photos');

drop policy if exists "theme_photos_insert" on storage.objects;
create policy "theme_photos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'theme-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "theme_photos_update" on storage.objects;
create policy "theme_photos_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'theme-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'theme-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "theme_photos_delete" on storage.objects;
create policy "theme_photos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'theme-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Обновить кеш схемы PostgREST, чтобы RPC check_invite_code стал доступен сразу.
notify pgrst, 'reload schema';
