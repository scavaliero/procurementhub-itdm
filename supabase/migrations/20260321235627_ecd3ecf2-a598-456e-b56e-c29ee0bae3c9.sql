-- Fix current_tenant_id to be SECURITY DEFINER to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Fix profiles SELECT policy to avoid recursive subquery
DROP POLICY IF EXISTS pol_profiles_sel ON public.profiles;
CREATE POLICY pol_profiles_sel ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR tenant_id = current_tenant_id()
  );