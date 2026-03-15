-- Fix RLS policies: wrap auth.uid() in (select auth.uid()) so Postgres
-- evaluates it once per query instead of once per row.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- users
DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users FOR SELECT USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users FOR UPDATE USING ((select auth.uid()) = id);

-- endpoints
DROP POLICY IF EXISTS endpoints_select ON public.endpoints;
CREATE POLICY endpoints_select ON public.endpoints FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS endpoints_insert ON public.endpoints;
CREATE POLICY endpoints_insert ON public.endpoints FOR INSERT WITH CHECK (
  ((user_id IS NULL) AND (is_ephemeral = true) AND (expires_at IS NOT NULL))
  OR user_id = (select auth.uid())
);

DROP POLICY IF EXISTS endpoints_update ON public.endpoints;
CREATE POLICY endpoints_update ON public.endpoints FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS endpoints_delete ON public.endpoints;
CREATE POLICY endpoints_delete ON public.endpoints FOR DELETE USING (user_id = (select auth.uid()));

-- requests
DROP POLICY IF EXISTS requests_select ON public.requests;
CREATE POLICY requests_select ON public.requests FOR SELECT USING (user_id = (select auth.uid()));

-- api_keys
DROP POLICY IF EXISTS api_keys_select ON public.api_keys;
CREATE POLICY api_keys_select ON public.api_keys FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS api_keys_insert ON public.api_keys;
CREATE POLICY api_keys_insert ON public.api_keys FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS api_keys_delete ON public.api_keys;
CREATE POLICY api_keys_delete ON public.api_keys FOR DELETE USING (user_id = (select auth.uid()));

-- Add missing index on device_codes.user_id foreign key
CREATE INDEX IF NOT EXISTS device_codes_user_id ON public.device_codes(user_id) WHERE user_id IS NOT NULL;
