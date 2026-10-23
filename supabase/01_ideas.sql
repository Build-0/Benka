-- 想法百寶箱:ideas 表。在 Supabase SQL Editor 執行一次即可(可重複執行)。
-- 只有本人(user_id = auth.uid())讀寫得到,未登入者一律讀寫唔到。

create table if not exists public.ideas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  content     text,
  tags        text[] not null default '{}',
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ideas_user_created_idx on public.ideas (user_id, created_at desc);

alter table public.ideas enable row level security;

drop policy if exists "ideas_owner" on public.ideas;
create policy "ideas_owner" on public.ideas
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
