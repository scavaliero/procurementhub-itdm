-- Insert 2 new grants
INSERT INTO public.grants (name, module, description) VALUES
  ('manage_email_templates', 'admin', 'Gestisci template email'),
  ('manage_tenant_settings', 'admin', 'Gestisci configurazione tenant');

-- Auto-assign to roles that have manage_users (admin roles)
INSERT INTO public.role_grants (role_id, grant_id)
SELECT DISTINCT rg.role_id, g_new.id
FROM role_grants rg
JOIN grants g_old ON g_old.id = rg.grant_id AND g_old.name = 'manage_users'
CROSS JOIN grants g_new
WHERE g_new.name IN ('manage_email_templates', 'manage_tenant_settings')
ON CONFLICT DO NOTHING;

-- Update RLS on email_templates to use manage_email_templates
DROP POLICY IF EXISTS pol_email_tpl_adm ON public.email_templates;
CREATE POLICY pol_email_tpl_adm ON public.email_templates FOR ALL TO public
  USING (user_has_grant('manage_email_templates'::text));

-- Update RLS on tenants to use manage_tenant_settings
DROP POLICY IF EXISTS pol_tenants_adm ON public.tenants;
CREATE POLICY pol_tenants_adm ON public.tenants FOR ALL TO public
  USING (user_has_grant('manage_tenant_settings'::text));