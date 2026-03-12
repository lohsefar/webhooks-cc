-- webhooks.cc schema migration: Convex -> Supabase
-- Strategy A: direct INSERT from receiver, no batching, no Redis

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ============================================================================
-- USERS
-- ============================================================================
-- Linked to Supabase Auth via auth.users(id).
-- Usage tracking (requests_used, request_limit) is per-user, not per-endpoint.
-- Free users get lazy 24h periods; pro users get 30-day billing periods.

create table public.users (
  id                     uuid primary key references auth.users(id) on delete cascade,
  email                  text not null,
  name                   text,
  image                  text,

  -- Subscription
  plan                   text not null default 'free'
                           check (plan in ('free', 'pro')),
  polar_customer_id      text,
  polar_subscription_id  text,
  subscription_status    text
                           check (subscription_status in ('active', 'canceled', 'past_due')),

  -- Billing period
  period_start           timestamptz,
  period_end             timestamptz,
  cancel_at_period_end   boolean not null default false,

  -- Usage (per-user, NOT per-endpoint)
  requests_used          integer not null default 0,
  request_limit          integer not null default 50,

  created_at             timestamptz not null default now()
);

create unique index users_email on public.users(email);
create unique index users_polar_customer on public.users(polar_customer_id)
  where polar_customer_id is not null;
create unique index users_polar_subscription on public.users(polar_subscription_id)
  where polar_subscription_id is not null;
create index users_period_end on public.users(period_end)
  where period_end is not null;
create index users_plan on public.users(plan);

-- ============================================================================
-- ENDPOINTS
-- ============================================================================
-- Webhook capture endpoints. Each has a unique slug used in the URL: /w/{slug}
-- Unauth users create ephemeral endpoints (12h TTL, 25 req cap).
-- Auth users create persistent endpoints tied to their account.

create table public.endpoints (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.users(id) on delete cascade,
  slug             text not null,
  name             text,
  mock_response    jsonb,        -- {status: int, body: string, headers: {}}
  is_ephemeral     boolean not null default false,
  expires_at       timestamptz,
  request_count    integer not null default 0,
  created_at       timestamptz not null default now()
);

create unique index endpoints_slug on public.endpoints(slug);
create index endpoints_user on public.endpoints(user_id)
  where user_id is not null;
create index endpoints_expires on public.endpoints(expires_at)
  where expires_at is not null;
create index endpoints_ephemeral_expires on public.endpoints(is_ephemeral, expires_at)
  where is_ephemeral = true and expires_at is not null;

-- ============================================================================
-- REQUESTS
-- ============================================================================
-- Webhook requests captured by the receiver.
-- Single table (no partitioning). Cleanup via scheduled DELETE queries.
-- user_id denormalized from endpoint for RLS and cleanup queries.

create table public.requests (
  id               uuid primary key default gen_random_uuid(),
  endpoint_id      uuid not null,
  user_id          uuid,           -- denormalized from endpoint, null for ephemeral
  method           text not null,
  path             text not null,
  headers          jsonb not null default '{}'::jsonb,
  body             text,
  query_params     jsonb not null default '{}'::jsonb,
  content_type     text,
  ip               text not null,
  size             integer not null default 0,
  received_at      timestamptz not null default now()
);

create index requests_endpoint_time on public.requests(endpoint_id, received_at desc);
create index requests_user_time on public.requests(user_id, received_at desc)
  where user_id is not null;
create index requests_received_at on public.requests(received_at);

-- ============================================================================
-- API KEYS
-- ============================================================================
-- SHA-256 hashed storage. Raw key shown once at creation, never stored.
-- Prefix "whcc_" for identification. Max 10 per user.

create table public.api_keys (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  key_hash         text not null,
  key_prefix       text not null,   -- first 12 chars, e.g. "whcc_Ab3xK..."
  name             text not null,
  last_used_at     timestamptz,
  expires_at       timestamptz,
  created_at       timestamptz not null default now()
);

create unique index api_keys_key_hash on public.api_keys(key_hash);
create index api_keys_user on public.api_keys(user_id);
create index api_keys_expires on public.api_keys(expires_at)
  where expires_at is not null;

-- ============================================================================
-- DEVICE CODES
-- ============================================================================
-- OAuth device flow for CLI auth. 15-minute TTL.
-- Flow: CLI creates code -> user authorizes in browser -> CLI claims API key.

create table public.device_codes (
  id               uuid primary key default gen_random_uuid(),
  device_code      text not null,
  user_code        text not null,
  expires_at       timestamptz not null,
  status           text not null default 'pending'
                     check (status in ('pending', 'authorized')),
  user_id          uuid references public.users(id) on delete cascade,
  created_at       timestamptz not null default now()
);

create unique index device_codes_device_code on public.device_codes(device_code);
create unique index device_codes_user_code on public.device_codes(user_code);
create index device_codes_expires on public.device_codes(expires_at);
create index device_codes_status on public.device_codes(status)
  where status = 'pending';

-- ============================================================================
-- BLOG POSTS
-- ============================================================================

create table public.blog_posts (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null,
  title             text not null,
  description       text not null,
  content           text not null,
  category          text not null,
  read_minutes      integer not null,
  tags              text[] not null default '{}',
  status            text not null default 'draft'
                      check (status in ('draft', 'published')),
  published_at      timestamptz,
  updated_at        timestamptz not null default now(),
  author_name       text not null,
  seo_title         text not null,
  seo_description   text not null,
  canonical_url     text,
  featured          boolean not null default false,
  keywords          text[] not null default '{}',
  schema_type       text not null
                      check (schema_type in ('howto', 'tech-article', 'faq', 'blog-posting')),
  change_frequency  text not null default 'monthly'
                      check (change_frequency in ('weekly', 'monthly', 'yearly')),
  priority          numeric(2,1) not null default 0.5
);

create unique index blog_posts_slug on public.blog_posts(slug);
create index blog_posts_status on public.blog_posts(status);
create index blog_posts_status_featured on public.blog_posts(status, featured)
  where status = 'published';
create index blog_posts_status_published_at on public.blog_posts(status, published_at desc)
  where status = 'published';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.users enable row level security;
alter table public.endpoints enable row level security;
alter table public.requests enable row level security;
alter table public.api_keys enable row level security;
alter table public.device_codes enable row level security;
alter table public.blog_posts enable row level security;

-- Users: can read/update own record only
create policy users_select on public.users
  for select using (auth.uid() = id);

create policy users_update on public.users
  for update using (auth.uid() = id);

-- Endpoints: owner sees own; everyone sees ephemeral
create policy endpoints_select on public.endpoints
  for select using (
    is_ephemeral = true
    or user_id = auth.uid()
  );

create policy endpoints_insert on public.endpoints
  for insert with check (
    user_id is null          -- ephemeral (unauth)
    or user_id = auth.uid()  -- own endpoint
  );

create policy endpoints_update on public.endpoints
  for update using (user_id = auth.uid());

create policy endpoints_delete on public.endpoints
  for delete using (user_id = auth.uid());

-- Requests: visible if user owns endpoint, or endpoint is ephemeral
create policy requests_select on public.requests
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.endpoints e
      where e.id = endpoint_id and e.is_ephemeral = true
    )
  );

-- Insert: receiver uses service role (bypasses RLS), but just in case
create policy requests_insert on public.requests
  for insert with check (true);

-- API Keys: user sees own only
create policy api_keys_select on public.api_keys
  for select using (user_id = auth.uid());

create policy api_keys_insert on public.api_keys
  for insert with check (user_id = auth.uid());

create policy api_keys_delete on public.api_keys
  for delete using (user_id = auth.uid());

-- Device codes: managed via service role (API routes), no direct client access
-- Allow select for polling (deviceCode lookup is unauthenticated)
create policy device_codes_select on public.device_codes
  for select using (true);

create policy device_codes_insert on public.device_codes
  for insert with check (true);

-- Blog posts: published visible to all, drafts to nobody (managed via service role)
create policy blog_posts_select on public.blog_posts
  for select using (status = 'published');

-- ============================================================================
-- FUNCTIONS: auto-create user profile on signup
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, name, image)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do update set
    email = excluded.email,
    name  = coalesce(excluded.name, public.users.name),
    image = coalesce(excluded.image, public.users.image);
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Also handle email/profile updates from OAuth re-login
create or replace trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- FUNCTIONS: cleanup
-- ============================================================================

-- Delete requests older than 7 days for free users
create or replace function public.cleanup_free_user_requests()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  deleted integer;
begin
  delete from public.requests
  where user_id in (select id from public.users where plan = 'free')
    and received_at < now() - interval '7 days';
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

-- Delete all requests older than 31 days
create or replace function public.cleanup_old_requests()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  deleted integer;
begin
  delete from public.requests
  where received_at < now() - interval '31 days';
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

-- ============================================================================
-- FUNCTIONS: usage tracking
-- ============================================================================

-- Atomic quota check + decrement. Returns remaining quota.
-- Used by the receiver on the hot path.
create or replace function public.check_and_decrement_quota(
  p_user_id uuid,
  p_count integer default 1
)
returns table(remaining integer, quota_limit integer, period_end_ts timestamptz)
language plpgsql
security definer set search_path = ''
as $$
begin
  return query
  update public.users
  set requests_used = requests_used + p_count
  where id = p_user_id
    and requests_used + p_count <= request_limit
  returning
    request_limit - (requests_used) as remaining,
    request_limit as quota_limit,
    public.users.period_end as period_end_ts;
end;
$$;

-- Start a new 24h period for a free user (lazy activation).
-- Idempotent: no-ops if period is already active.
create or replace function public.start_free_period(p_user_id uuid)
returns table(remaining integer, quota_limit integer, period_end_ts timestamptz)
language plpgsql
security definer set search_path = ''
as $$
begin
  return query
  update public.users
  set
    period_start = now(),
    period_end = now() + interval '24 hours',
    requests_used = 0
  where id = p_user_id
    and plan = 'free'
    and (period_end is null or period_end < now())
  returning
    request_limit as remaining,
    request_limit as quota_limit,
    public.users.period_end as period_end_ts;
end;
$$;
