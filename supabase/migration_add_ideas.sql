-- 在 Supabase SQL Editor 中执行一次，新增灵感表与权限策略
create table if not exists public.studio_ideas (
  id text primary key,
  employee text not null check (employee in ('H', 'W')),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.studio_ideas enable row level security;

drop policy if exists "studio_ideas_anon_all" on public.studio_ideas;

create policy "studio_ideas_anon_all"
  on public.studio_ideas for all
  to anon, authenticated
  using (true) with check (true);
