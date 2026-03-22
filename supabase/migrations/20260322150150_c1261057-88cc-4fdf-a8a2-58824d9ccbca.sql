-- Allow users with manage_roles grant to insert role_grants
CREATE POLICY pol_role_grants_ins ON public.role_grants
FOR INSERT TO authenticated
WITH CHECK (user_has_grant('manage_roles'));

-- Allow users with manage_roles grant to delete role_grants
CREATE POLICY pol_role_grants_del ON public.role_grants
FOR DELETE TO authenticated
USING (user_has_grant('manage_roles'));

-- Allow users with manage_roles grant to update role_grants
CREATE POLICY pol_role_grants_upd ON public.role_grants
FOR UPDATE TO authenticated
USING (user_has_grant('manage_roles'));