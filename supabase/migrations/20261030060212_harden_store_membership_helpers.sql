-- Membership predicates used by RLS must only evaluate the current signed-in user.
-- SECURITY DEFINER is retained to avoid recursive RLS evaluation on store_memberships;
-- search_path is empty and every object reference is schema-qualified.
CREATE OR REPLACE FUNCTION public.is_store_member(
  p_store_id text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    auth.uid() IS NOT NULL
    AND p_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.store_memberships AS m
      WHERE m.store_id = p_store_id
        AND m.user_id = auth.uid()
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_store_owner(p_store_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.store_memberships AS m
      WHERE m.store_id = p_store_id
        AND m.user_id = auth.uid()
        AND m.role = 'owner'
    );
$function$;

REVOKE ALL ON FUNCTION public.is_store_member(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_store_member(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_store_member(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_store_owner(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_store_owner(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_store_owner(text) TO authenticated;