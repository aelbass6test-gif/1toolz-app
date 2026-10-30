-- Clients may edit their own profile data but must never set admin/ban flags.
REVOKE INSERT (is_admin, is_banned)
  ON TABLE public.users FROM authenticated;
REVOKE UPDATE (is_admin, is_banned)
  ON TABLE public.users FROM authenticated;