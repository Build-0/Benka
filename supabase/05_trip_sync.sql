-- 行程改動 → 通知 Edge Function trip-sync → 觸發 GitHub Actions 重建分享預覽(已套用到線上資料庫)
-- 回復方法見 docs/trip-sync-setup.md
create extension if not exists pg_net;

create table if not exists public.deploy_log (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  action text not null,        -- in_sync | skipped | rate_limited | dispatched | verified | pending | info | error
  reason text not null default '',
  detail text not null default ''
);
create index if not exists deploy_log_created_idx on public.deploy_log (created_at desc);
alter table public.deploy_log enable row level security;
drop policy if exists deploy_log_owner_read on public.deploy_log;
create policy deploy_log_owner_read on public.deploy_log for select to authenticated
  using (exists (select 1 from public.trips t where t.user_id = auth.uid()));
revoke all on public.deploy_log from anon;

create or replace function public.trips_notify_sync() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if (tg_op = 'DELETE' and old.published)
     or (tg_op <> 'DELETE' and (new.published or (tg_op = 'UPDATE' and old.published))) then
    begin
      perform net.http_post(
        url := 'https://fdnflasdjcnqldtyqkha.supabase.co/functions/v1/trip-sync',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := jsonb_build_object('reason', 'trips:' || tg_op || ':' || coalesce(new.slug, old.slug))
      );
    exception when others then
      null;
    end;
  end if;
  return coalesce(new, old);
end $$;
revoke all on function public.trips_notify_sync() from public, anon, authenticated;

drop trigger if exists trips_sync_after on public.trips;
create trigger trips_sync_after after insert or update or delete on public.trips
  for each row execute function public.trips_notify_sync();
