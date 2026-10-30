-- 看板:自訂任務名稱(例如將「家務」改名),跨手機/電腦同步
create table if not exists public.board_task_names (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task text not null,
  name text not null,
  primary key (user_id, task)
);
alter table public.board_task_names enable row level security;
drop policy if exists board_names_owner on public.board_task_names;
create policy board_names_owner on public.board_task_names for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
