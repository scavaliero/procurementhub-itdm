-- Insert 5 new grants
INSERT INTO public.grants (name, module, description) VALUES
  ('manage_categories', 'admin', 'Gestisci categorie merceologiche'),
  ('review_change_requests', 'vendor_register', 'Approva/rifiuta richieste modifica anagrafica fornitore'),
  ('manage_opportunity_attachments', 'procurement', 'Gestisci allegati opportunità (specifiche, condizioni, requisiti)'),
  ('view_opportunities', 'procurement', 'Visualizza lista opportunità'),
  ('view_vendors', 'vendor_register', 'Visualizza albo fornitori');

-- Auto-assign new grants to system roles that already have related grants
-- manage_categories → roles that have manage_document_types
INSERT INTO public.role_grants (role_id, grant_id)
SELECT DISTINCT rg.role_id, g_new.id
FROM role_grants rg
JOIN grants g_old ON g_old.id = rg.grant_id AND g_old.name = 'manage_document_types'
CROSS JOIN grants g_new
WHERE g_new.name = 'manage_categories'
ON CONFLICT DO NOTHING;

-- review_change_requests → roles that have manage_users
INSERT INTO public.role_grants (role_id, grant_id)
SELECT DISTINCT rg.role_id, g_new.id
FROM role_grants rg
JOIN grants g_old ON g_old.id = rg.grant_id AND g_old.name = 'manage_users'
CROSS JOIN grants g_new
WHERE g_new.name = 'review_change_requests'
ON CONFLICT DO NOTHING;

-- manage_opportunity_attachments → roles that have create_opportunity
INSERT INTO public.role_grants (role_id, grant_id)
SELECT DISTINCT rg.role_id, g_new.id
FROM role_grants rg
JOIN grants g_old ON g_old.id = rg.grant_id AND g_old.name = 'create_opportunity'
CROSS JOIN grants g_new
WHERE g_new.name = 'manage_opportunity_attachments'
ON CONFLICT DO NOTHING;

-- view_opportunities → roles that have create_opportunity OR view_bids
INSERT INTO public.role_grants (role_id, grant_id)
SELECT DISTINCT rg.role_id, g_new.id
FROM role_grants rg
JOIN grants g_old ON g_old.id = rg.grant_id AND g_old.name IN ('create_opportunity', 'view_bids')
CROSS JOIN grants g_new
WHERE g_new.name = 'view_opportunities'
ON CONFLICT DO NOTHING;

-- view_vendors → roles that have view_supplier_documents OR approve_accreditation
INSERT INTO public.role_grants (role_id, grant_id)
SELECT DISTINCT rg.role_id, g_new.id
FROM role_grants rg
JOIN grants g_old ON g_old.id = rg.grant_id AND g_old.name IN ('view_supplier_documents', 'approve_accreditation')
CROSS JOIN grants g_new
WHERE g_new.name = 'view_vendors'
ON CONFLICT DO NOTHING;

-- Update RLS policy on categories to use manage_categories instead of manage_document_types
DROP POLICY IF EXISTS pol_cats_adm ON public.categories;
CREATE POLICY pol_cats_adm ON public.categories FOR ALL TO public
  USING (user_has_grant('manage_categories'::text));

-- Update RLS policies on supplier_change_requests to use review_change_requests
DROP POLICY IF EXISTS pol_scr_int_sel ON public.supplier_change_requests;
CREATE POLICY pol_scr_int_sel ON public.supplier_change_requests FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND user_has_grant('review_change_requests'::text));

DROP POLICY IF EXISTS pol_scr_int_upd ON public.supplier_change_requests;
CREATE POLICY pol_scr_int_upd ON public.supplier_change_requests FOR UPDATE TO authenticated
  USING (user_has_grant('review_change_requests'::text));