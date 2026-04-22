-- 在 Supabase SQL Editor 中执行一次，为任务扩展字段（负责人/优先级/DDL/历史时间）
alter table public.studio_tasks
  add column if not exists owner text not null default 'U';

alter table public.studio_tasks
  add column if not exists priority text not null default 'low';

alter table public.studio_tasks
  add column if not exists ddl_date date;

alter table public.studio_tasks
  add column if not exists scope text not null default 'studio';

alter table public.studio_tasks
  add column if not exists repeat_days jsonb not null default '[false,false,false,false,false,false,false]'::jsonb;

alter table public.studio_tasks
  add column if not exists created_at timestamptz not null default now();

alter table public.studio_tasks
  add column if not exists done_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'studio_tasks_owner_check'
  ) then
    alter table public.studio_tasks
      add constraint studio_tasks_owner_check check (owner in ('H', 'W', 'U'));
  end if;
end $$;

alter table public.studio_tasks
  drop constraint if exists studio_tasks_priority_check;

alter table public.studio_tasks
  add constraint studio_tasks_priority_check check (priority in ('high', 'medium', 'low', 'routine'));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'studio_tasks_scope_check'
  ) then
    alter table public.studio_tasks
      add constraint studio_tasks_scope_check check (scope in ('studio', 'personal'));
  end if;
end $$;
