
DROP POLICY IF EXISTS pol_email_tpl_sel ON public.email_templates;

CREATE POLICY pol_email_tpl_sel
ON public.email_templates
FOR SELECT
TO authenticated
USING (
  tenant_id = current_tenant_id()
  AND user_has_grant('manage_email_templates'::text)
);
