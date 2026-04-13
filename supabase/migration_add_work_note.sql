-- 已有项目：在 Supabase SQL Editor 中执行一次，为会话表增加「下工备注」列
alter table public.studio_sessions
  add column if not exists work_note text;
