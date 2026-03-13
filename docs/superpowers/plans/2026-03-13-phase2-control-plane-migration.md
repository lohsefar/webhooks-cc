# Phase 2: Control Plane Migration

**Goal:** move the first Convex-backed product APIs to Supabase so the CLI, SDK, and web app can start using Supabase for auth-adjacent operations without touching the receiver yet.

**Why this phase comes next:** Phase 1 proved Supabase Auth works. The fastest way to keep momentum is to migrate the control plane first: API key validation, device auth, endpoint CRUD, and usage reads. These are lower risk than the request ingestion path and unlock the next dashboard and CLI slices.

**Non-negotiables:**

- Final architecture removes Redis.
- Do not add new Redis-based migration work.
- Preserve current CLI and SDK API shapes.
- Keep this phase narrow. No request ingestion rewrite, billing rewrite, or broad Convex cleanup here.

## In Scope

- Create `supabase/migrations/00002_additional_functions.sql`
  - Add `check_and_increment_ephemeral(p_endpoint_id uuid)`
  - Add composite index on `users(plan, period_end)`
- Add shared server-side Supabase helpers for:
  - API key hashing and validation
  - Device code creation, authorization, polling, and claiming
  - Endpoint CRUD by user
- Replace Convex-backed Next.js routes:
  - `/api/auth/device-code`
  - `/api/auth/device-poll`
  - `/api/auth/device-claim`
  - `/api/endpoints`
  - `/api/endpoints/[slug]`
- Replace the browser-side `/cli/verify` flow so it authorizes device codes through Supabase-backed server code instead of Convex mutations.
- Add focused tests for the new Supabase-backed helpers and route behavior.

## Explicitly Out of Scope

- Receiver rewrite
- Request list/detail/search migration
- Dashboard realtime migration
- Billing migration
- Blog/feed/sitemap migration
- Convex directory removal
- Redis removal in the running receiver

## Work Order

1. **Schema support**
   - Add `00002_additional_functions.sql`
   - Verify the new SQL runs cleanly in dev Supabase

2. **Shared helpers**
   - Add a small server-side module for API key hashing, device auth, and endpoint CRUD
   - Keep helpers close to current API route shapes to avoid extra abstraction

3. **Device auth**
   - Migrate route handlers first
   - Then migrate `/cli/verify`
   - Verify CLI login still works against the same HTTP endpoints

4. **Endpoint CRUD**
   - Migrate `/api/endpoints`
   - Migrate `/api/endpoints/[slug]`
   - Preserve response shapes used by the CLI and SDK

5. **Verification**
   - Run targeted integration tests against Supabase dev
   - Run relevant web and CLI smoke tests for device auth and endpoint CRUD

## Definition of Done

- Device auth no longer depends on Convex
- Endpoint CRUD API routes no longer depend on Convex
- `apps/web/lib/api-auth.ts` validates API keys against Supabase
- Existing CLI and SDK endpoint flows keep the same external API shapes
- The next phase can focus on request data and dashboard reads instead of auth/control-plane cleanup

## Next Phase After This One

Once this phase lands, the next phase is **dashboard and request data migration**:

- request list/detail reads
- request search
- usage reads in the dashboard
- public read-only blog/feed/sitemap queries

The receiver rewrite stays after that phase so we do not mix ingestion risk with basic API migration.
