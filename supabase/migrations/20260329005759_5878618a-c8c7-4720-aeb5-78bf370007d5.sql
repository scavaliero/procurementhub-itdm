
ALTER TABLE public.user_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_user_grants_sel
ON public.user_grants
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR user_has_grant('manage_roles'::text));

CREATE POLICY pol_user_grants_ins
ON public.user_grants
FOR INSERT
TO authenticated
WITH CHECK (user_has_grant('manage_roles'::text));

CREATE POLICY pol_user_grants_upd
ON public.user_grants
FOR UPDATE
TO authenticated
USING (user_has_grant('manage_roles'::text));

CREATE POLICY pol_user_grants_del
ON public.user_grants
FOR DELETE
TO authenticated
USING (user_has_grant('manage_roles'::text));
