-- Expired ephemeral endpoint cleanup for the Supabase migration.
-- Replaces the old Convex cron that deleted expired guest demo endpoints.

create extension if not exists pg_cron;

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
    delete from public.endpoints
    where is_ephemeral = true
      and expires_at is not null
      and expires_at <= now()
    returning id
  ),
  expired_requests as (
    delete from public.requests
    where endpoint_id in (select id from expired_endpoints)
    returning id
  ),
  orphaned_requests as (
    delete from public.requests r
    where not exists (
      select 1
      from public.endpoints e
      where e.id = r.endpoint_id
    )
    returning r.id
  )
  select
    (select count(*)::integer from expired_endpoints),
    (select count(*)::integer from expired_requests),
    (select count(*)::integer from orphaned_requests);
end;
$$;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'cleanup-expired-ephemeral-endpoints-every-5-minutes';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select cron.schedule(
  'cleanup-expired-ephemeral-endpoints-every-5-minutes',
  '*/5 * * * *',
  'select public.cleanup_expired_ephemeral_endpoints();'
);
