-- 在 Supabase 控制台 → SQL Editor → New query 中粘贴并执行本文件全部内容。
-- 表名使用 studio_ 前缀，便于与其它项目区分。

-- 上工会话（上工/下工）
create table if not exists public.studio_sessions (
  id text primary key,
  employee text not null check (employee in ('H', 'W')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  work_note text
);

-- 日常任务
create table if not exists public.studio_tasks (
  id text primary key,
  employee text not null check (employee in ('H', 'W')),
  owner text not null default 'U' check (owner in ('H', 'W', 'U')),
  content text not null,
  priority text not null default 'low' check (priority in ('high', 'medium', 'low', 'routine')),
  ddl_date date,
  scope text not null default 'studio' check (scope in ('studio', 'personal')),
  repeat_days jsonb not null default '[false,false,false,false,false,false,false]'::jsonb,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

-- 每周固定工作日（week_key 如 2026-W15；days 为长度 7 的 JSON 数组，周一=索引 0）
create table if not exists public.studio_week_fixed (
  week_key text primary key,
  days jsonb not null
);

-- 灵感记录（按成员）
create table if not exists public.studio_ideas (
  id text primary key,
  employee text not null check (employee in ('H', 'W')),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 行级安全：开启后需策略；以下为「小团队内部站」简化策略：允许匿名密钥读写（依赖站点入口密码保护）。
-- 若需更高安全性，可改为 Supabase Auth 并收紧策略。

alter table public.studio_sessions enable row level security;
alter table public.studio_tasks enable row level security;
alter table public.studio_week_fixed enable row level security;
alter table public.studio_ideas enable row level security;

drop policy if exists "studio_sessions_anon_all" on public.studio_sessions;
drop policy if exists "studio_tasks_anon_all" on public.studio_tasks;
drop policy if exists "studio_week_fixed_anon_all" on public.studio_week_fixed;
drop policy if exists "studio_ideas_anon_all" on public.studio_ideas;

create policy "studio_sessions_anon_all"
  on public.studio_sessions for all
  to anon, authenticated
  using (true) with check (true);

create policy "studio_tasks_anon_all"
  on public.studio_tasks for all
  to anon, authenticated
  using (true) with check (true);

create policy "studio_week_fixed_anon_all"
  on public.studio_week_fixed for all
  to anon, authenticated
  using (true) with check (true);

create policy "studio_ideas_anon_all"
  on public.studio_ideas for all
  to anon, authenticated
  using (true) with check (true);
