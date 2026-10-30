-- Event trigger functions are invoked by PostgreSQL event triggers, not by API clients.
-- Keep execution limited to trusted database roles.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;