-- Fix infinite recursion on profiles RLS policy by removing self-referencing subquery
DROP POLICY IF EXISTS pol_profiles_sel_int ON public.profiles;

-- Helper to check whether the current authenticated user is internal, without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_internal_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND p.user_type = 'internal'
  );
$$;

REVOKE ALL ON FUNCTION public.is_internal_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_internal_user(uuid) TO authenticated;

-- Recreate tenant-scoped internal-user read policy without querying profiles directly in the policy body
CREATE POLICY pol_profiles_sel_int
ON public.profiles
FOR SELECT
TO authenticated
USING (
  tenant_id = current_tenant_id()
  AND public.is_internal_user(auth.uid())
);