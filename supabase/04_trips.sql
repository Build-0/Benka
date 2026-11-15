-- 旅遊行程:每個行程一行,內容全部喺 data(JSON),版面固定喺程式
create table if not exists public.trips (
  slug text primary key,
  user_id uuid references auth.users(id) default auth.uid(),
  title text not null,
  data jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.trips enable row level security;
-- 任何人(唔使登入)都睇到已發布嘅行程
drop policy if exists trips_public_read on public.trips;
create policy trips_public_read on public.trips for select to anon, authenticated using (published = true);
-- 只有擁有者可以新增/修改
drop policy if exists trips_owner_all on public.trips;
create policy trips_owner_all on public.trips for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
