-- Remove anonymous write access to core store records. Public reads remain temporarily
-- for storefront compatibility; a public-safe projection is a separate release gate.
DROP POLICY IF EXISTS "Public Access Stores" ON public.stores_data;
CREATE POLICY "Public read stores compatibility"
  ON public.stores_data FOR SELECT TO anon, authenticated
  USING (true);

REVOKE ALL ON TABLE public.stores_data FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.stores_data TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.stores_data TO authenticated;

DROP POLICY IF EXISTS "Store members insert stores_data" ON public.stores_data;
CREATE POLICY "Store members insert stores_data"
  ON public.stores_data FOR INSERT TO authenticated
  WITH CHECK (public.is_store_member(id));

DROP POLICY IF EXISTS "Store members update stores_data" ON public.stores_data;
CREATE POLICY "Store members update stores_data"
  ON public.stores_data FOR UPDATE TO authenticated
  USING (public.is_store_member(id))
  WITH CHECK (public.is_store_member(id));

DROP POLICY IF EXISTS "Store members delete stores_data" ON public.stores_data;
CREATE POLICY "Store members delete stores_data"
  ON public.stores_data FOR DELETE TO authenticated
  USING (public.is_store_member(id));

CREATE OR REPLACE FUNCTION public.ensure_store_record_for_current_user(
  p_store_id text,
  p_store_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted_store_id text;
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.user_id = caller_id AND p.phone IS NOT NULL AND p.phone <> ''
  ) THEN
    RAISE EXCEPTION 'Authenticated phone profile required';
  END IF;

  INSERT INTO public.stores_data (id, name)
  VALUES (p_store_id, p_store_name)
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO inserted_store_id;

  IF inserted_store_id IS NOT NULL THEN
    INSERT INTO public.store_memberships (user_id, store_id, role)
    VALUES (caller_id, inserted_store_id, 'owner')
    ON CONFLICT (user_id, store_id) DO NOTHING;
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.store_memberships m
    WHERE m.user_id = caller_id AND m.store_id = p_store_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_store_record_for_current_user(text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_store_record_for_current_user(text, text)
  TO authenticated;