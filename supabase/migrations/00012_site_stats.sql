-- ============================================================================
-- Migration 00012: Site stats for landing page social proof
--
-- Single-row table with aggregate counts, refreshed by cron 4x/day.
-- deleted_webhooks accumulates request_count from deleted endpoints so
-- the total survives ephemeral cleanup.
-- ============================================================================

create table public.site_stats (
  id                 integer primary key default 1 check (id = 1),
  total_webhooks     bigint not null default 0,
  total_endpoints    bigint not null default 0,
  total_users        bigint not null default 0,
  deleted_webhooks   bigint not null default 0,
  updated_at         timestamptz not null default now()
);

-- Seed the single row
insert into public.site_stats (id) values (1);

-- RLS: public read, no write
alter table public.site_stats enable row level security;

create policy "site_stats_select" on public.site_stats
  for select to anon, authenticated using (true);

-- ============================================================================
-- Refresh function: snapshot current counts from source tables
-- ============================================================================

create or replace function public.refresh_site_stats()
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_live_webhooks bigint;
  v_deleted       bigint;
  v_endpoints     bigint;
  v_users         bigint;
begin
  select coalesce(sum(request_count), 0) into v_live_webhooks
    from public.endpoints;

  select deleted_webhooks into v_deleted
    from public.site_stats
   where id = 1;

  select count(*) into v_endpoints from public.endpoints;
  select count(*) into v_users from public.users;

  update public.site_stats
  set total_webhooks  = v_live_webhooks + v_deleted,
      total_endpoints = v_endpoints,
      total_users     = v_users,
      updated_at      = now()
  where id = 1;
end;
$$;

revoke all on function public.refresh_site_stats() from public;
revoke all on function public.refresh_site_stats() from anon;
revoke all on function public.refresh_site_stats() from authenticated;
grant execute on function public.refresh_site_stats() to service_role;

-- ============================================================================
-- Accumulate request_count before ephemeral endpoint deletion
-- ============================================================================

create or replace function public.cleanup_expired_ephemeral_endpoints()
returns table(
  deleted_endpoints integer,
  deleted_expired_requests integer,
  deleted_orphaned_requests integer
)
language plpgsql
security definer set search_path = ''
as $$
begin
  return query
  with expired_endpoints as (
    select id, request_count
    from public.endpoints
    where is_ephemeral = true
      and expires_at is not null
      and expires_at <= now()
  ),
  accumulate_counts as (
    update public.site_stats
    set deleted_webhooks = deleted_webhooks + (
      select coalesce(sum(request_count), 0) from expired_endpoints
    )
    where id = 1
  ),
  expired_requests as (
    delete from public.requests
    where endpoint_id in (select id from expired_endpoints)
    returning id
  ),
  deleted_endpoints_cte as (
    delete from public.endpoints
    where id in (select id from expired_endpoints)
    returning id
  )
  select
    (select count(*)::integer from deleted_endpoints_cte),
    (select count(*)::integer from expired_requests),
    0::integer;
end;
$$;

-- ============================================================================
-- Schedule refresh 4x/day (00:00, 06:00, 12:00, 18:00 UTC)
-- ============================================================================

select cron.schedule(
  'refresh-site-stats-4x-daily',
  '0 0,6,12,18 * * *',
  'select public.refresh_site_stats();'
);

-- Run once now to seed initial values
select public.refresh_site_stats();
