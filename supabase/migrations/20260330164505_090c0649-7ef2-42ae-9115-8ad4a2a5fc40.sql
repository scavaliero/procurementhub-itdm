
-- Restrict grants table to internal users only
DROP POLICY IF EXISTS pol_grants_sel ON public.grants;
CREATE POLICY pol_grants_sel ON public.grants
  FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));

-- Restrict role_grants table to internal users only
DROP POLICY IF EXISTS pol_role_grants_sel ON public.role_grants;
CREATE POLICY pol_role_grants_sel ON public.role_grants
  FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
