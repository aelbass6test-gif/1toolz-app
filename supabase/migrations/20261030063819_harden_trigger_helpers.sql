-- Harden helper functions used by existing triggers/event triggers.
-- This migration preserves all rows and does not alter trigger attachments.
-- set_updated_at is invoked only by table triggers and uses built-ins plus NEW.
ALTER FUNCTION public.set_updated_at() SET search_path = '';
-- The DDL event trigger remains attached and continues to run as its owner.
ALTER FUNCTION public.rls_auto_enable() SET search_path = 'pg_catalog';
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;