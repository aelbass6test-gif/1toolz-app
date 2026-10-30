-- Harden helper functions used by existing triggers/event triggers.
-- This migration preserves all rows and does not alter trigger attachments.

-- set_updated_at is invoked only by table triggers. It uses built-in objects
-- and NEW, so an empty search_path prevents object-shadowing attacks.
alter function public.set_updated_at()
  set search_path = '';

-- The DDL event trigger remains attached and continues to run as its owner.
-- Application roles must not be able to invoke the helper as an RPC.
alter function public.rls_auto_enable()
  set search_path = 'pg_catalog';

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
