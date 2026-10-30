-- Secure the new Supabase Auth -> profile -> user directory path.
-- Legacy rows remain in place but are no longer anonymously readable or writable.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_phone_unique
  ON public.user_profiles (phone)
  WHERE phone IS NOT NULL AND phone <> '';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS default_store_id text,
  ADD COLUMN IF NOT EXISTS auto_launch_default_store boolean NOT NULL DEFAULT false;

-- The legacy password column is deliberately not granted to API roles.
REVOKE ALL ON TABLE public.users FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  phone, full_name, email, is_admin, is_banned, join_date, stores, sites,
  created_at, "fullName", "isAdmin", "isBanned", "joinDate",
  default_store_id, auto_launch_default_store
) ON TABLE public.users TO authenticated;
GRANT INSERT (
  phone, full_name, email, is_admin, is_banned, join_date, stores, sites,
  "fullName", "isAdmin", "isBanned", "joinDate",
  default_store_id, auto_launch_default_store
) ON TABLE public.users TO authenticated;
GRANT UPDATE (
  phone, full_name, email, is_admin, is_banned, join_date, stores, sites,
  "fullName", "isAdmin", "isBanned", "joinDate",
  default_store_id, auto_launch_default_store
) ON TABLE public.users TO authenticated;

DROP POLICY IF EXISTS "Public Access Users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users read own user profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated users create own user profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated users update own user profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated admins manage user directory" ON public.users;

CREATE POLICY "Authenticated users read own user profile"
  ON public.users FOR SELECT TO authenticated
  USING (
    phone = (SELECT p.phone FROM public.user_profiles p WHERE p.user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Authenticated users create own user profile"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (
    phone = (SELECT p.phone FROM public.user_profiles p WHERE p.user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Authenticated users update own user profile"
  ON public.users FOR UPDATE TO authenticated
  USING (
    phone = (SELECT p.phone FROM public.user_profiles p WHERE p.user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.is_admin = true
    )
  )
  WITH CHECK (
    phone = (SELECT p.phone FROM public.user_profiles p WHERE p.user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Authenticated admins manage user directory"
  ON public.users FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.is_admin = true
    )
  );

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name, phone, is_admin)
  VALUES (
    NEW.id,
    NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'phone', ''),
    COALESCE((NEW.raw_app_meta_data ->> 'is_admin')::boolean, false)
  )
  ON CONFLICT (user_id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      phone = COALESCE(EXCLUDED.phone, public.user_profiles.phone);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;