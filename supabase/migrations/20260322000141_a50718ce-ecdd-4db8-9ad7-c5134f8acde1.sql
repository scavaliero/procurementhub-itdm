-- Allow inserting own user_role row (for self-registration)
CREATE POLICY pol_user_roles_self_ins ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());