CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  resolved_is_admin boolean := COALESCE((NEW.raw_app_meta_data ->> 'is_admin')::boolean, false);
BEGIN
  -- Preserve an existing trusted platform-admin flag only after the person
  -- has completed Supabase Auth enrollment for the exact phone number.
  IF NOT resolved_is_admin THEN
    SELECT COALESCE(u.is_admin, false)
      INTO resolved_is_admin
      FROM public.users u
      WHERE u.phone = NULLIF(NEW.raw_user_meta_data ->> 'phone', '')
      LIMIT 1;
  END IF;

  INSERT INTO public.user_profiles (user_id, display_name, phone, is_admin)
  VALUES (
    NEW.id,
    NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'phone', ''),
    COALESCE(resolved_is_admin, false)
  )
  ON CONFLICT (user_id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      phone = COALESCE(EXCLUDED.phone, public.user_profiles.phone),
      is_admin = public.user_profiles.is_admin OR EXCLUDED.is_admin;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;