-- Receiver support functions for the Supabase-backed control plane.

create or replace function public.increment_endpoint_request_count(
  p_endpoint_id uuid,
  p_count integer default 1
)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  updated_count integer;
begin
  update public.endpoints
  set request_count = request_count + greatest(1, p_count)
  where id = p_endpoint_id
  returning public.endpoints.request_count into updated_count;

  return coalesce(updated_count, 0);
end;
$$;

create or replace function public.increment_user_requests_used(
  p_user_id uuid,
  p_count integer default 1
)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  updated_used integer;
begin
  update public.users
  set requests_used = requests_used + greatest(1, p_count)
  where id = p_user_id
  returning public.users.requests_used into updated_used;

  return coalesce(updated_used, 0);
end;
$$;
