-- Replace overly permissive self-insert policy with one restricted to "Fornitore" role only
DROP POLICY IF EXISTS pol_user_roles_self_ins ON public.user_roles;

CREATE POLICY pol_user_roles_self_ins ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role_id IN (SELECT id FROM roles WHERE name = 'Fornitore' AND is_system = true)
  );