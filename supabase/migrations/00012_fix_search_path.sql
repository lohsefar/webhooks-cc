-- Migration 00012: Pin search_path on SECURITY DEFINER functions
-- Fixes "Function Search Path Mutable" advisory warning.

ALTER FUNCTION public.cleanup_old_requests() SET search_path = public;
