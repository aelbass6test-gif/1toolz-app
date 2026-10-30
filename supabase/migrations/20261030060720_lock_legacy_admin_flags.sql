-- Older clients use camelCase aliases; those are privileged too.
REVOKE INSERT ("isAdmin", "isBanned")
  ON TABLE public.users FROM authenticated;
REVOKE UPDATE ("isAdmin", "isBanned")
  ON TABLE public.users FROM authenticated;