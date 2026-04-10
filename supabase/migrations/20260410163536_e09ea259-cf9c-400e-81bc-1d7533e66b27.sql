
-- =====================================================
-- SEED DATA SCRIPT - VendorHub Demo
-- =====================================================
-- Idempotent: uses ON CONFLICT or conditional inserts
-- Tenant: 00000000-0000-0000-0000-000000000001

DO $$ BEGIN RAISE NOTICE 'Starting seed data generation...'; END $$;

-- ─────────────────────────────────────────────────────
-- 1. CATEGORIE MERCEOLOGICHE
-- ─────────────────────────────────────────────────────
INSERT INTO public.categories (id, tenant_id, code, name, description, is_active) VALUES
  ('40d9761c-ad33-430e-b6dc-ab861d3cbdb9', '00000000-0000-0000-0000-000000000001', 'IT',    'Informatica e Software',      'Servizi IT, sviluppo software, infrastruttura cloud, cybersecurity', true),
  ('f932017e-3f0a-4683-bf12-75be48c992e5', '00000000-0000-0000-0000-000000000001', 'CON',   'Consulenza Professionale',    'Consulenza strategica, direzionale, organizzativa e tecnica', true),
  ('3fbbc624-c41b-4ee7-bf1d-03bc2c63d47f', '00000000-0000-0000-0000-000000000001', 'LOG',   'Logistica e Trasporti',       'Servizi di logistica, trasporto merci, magazzinaggio e spedizioni', true),
  ('1ad80f71-8459-409f-9168-879fc9823457', '00000000-0000-0000-0000-000000000001', 'MKT',   'Marketing e Comunicazione',   'Servizi di marketing, comunicazione digitale, eventi e grafica', true),
  ('bc39d11b-d28b-4288-b31f-5f00c83a607f', '00000000-0000-0000-0000-000000000001', 'MAN',   'Manutenzione e Facility',     'Manutenzione impianti, facility management, pulizie e verde', true),
  ('531e8d36-3072-459c-9a0b-00087772582e', '00000000-0000-0000-0000-000000000001', 'LEG',   'Servizi Legali',              'Assistenza legale, contrattualistica e consulenza normativa', true),
  ('e20e6785-0e44-414f-917f-f78277469bfb', '00000000-0000-0000-0000-000000000001', 'HSEC',  'Salute e Sicurezza',          'Servizi di sicurezza sul lavoro, formazione RSPP, medicina del lavoro', true)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────
-- 2. RUOLI DI SISTEMA
-- ─────────────────────────────────────────────────────
INSERT INTO public.roles (id, tenant_id, name, description, is_system, is_active) VALUES
  ('be097ce0-7cf0-4e5d-be80-fd69a20ed6e6', '00000000-0000-0000-0000-000000000001', 'Amministratore Piattaforma', 'Accesso completo a tutte le funzionalità della piattaforma', true, true),
  ('6c4ddb4c-f4d2-4312-9363-ec5a6cb938bb', '00000000-0000-0000-0000-000000000001', 'Amministrazione',            'Gestione amministrativa e approvazione benestare',            true, true),
  ('b2da4be7-303a-4264-a711-12870fb4fd1c', '00000000-0000-0000-0000-000000000001', 'Buyer Procurement',          'Gestione gare, valutazione offerte e aggiudicazione',         true, true),
  ('0513eedd-c25f-4183-9e3d-577a23c4c986', '00000000-0000-0000-0000-000000000001', 'Operatore Albo',             'Gestione albo fornitori, documenti e opportunità',            true, true),
  ('cc5ee725-7836-4cd9-91fb-031a3bce3323', '00000000-0000-0000-0000-000000000001', 'Responsabile Procurement',   'Supervisione qualifica fornitori e approvazione accreditamento', true, true),
  ('ce7bad9e-5822-4652-8b68-a760e0c48c2d', '00000000-0000-0000-0000-000000000001', 'Responsabile Qualifica',     'Revisione e approvazione qualifiche fornitori',               true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Fornitore',                  'Ruolo base per utenti fornitore',                              true, true),
  ('e75a1c5e-0601-4b6f-8a26-bf58db171f2a', '00000000-0000-0000-0000-000000000001', 'purchase_manager',           'Validazione richieste di acquisto sotto soglia',              true, true),
  ('2c11c89b-24f8-47a0-b431-b90b69520c57', '00000000-0000-0000-0000-000000000001', 'purchase_operator',          'Gestione operativa acquisti diretti',                          true, true),
  ('86f81632-1b16-470b-a19d-9d0c539218e3', '00000000-0000-0000-0000-000000000001', 'purchase_requester',         'Creazione richieste di acquisto',                              true, true),
  ('01795991-f7b2-407e-86f4-188f421f84fd', '00000000-0000-0000-0000-000000000001', 'finance_approver',           'Approvazione richieste di acquisto sopra soglia',             true, true)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────
-- 3. ASSOCIAZIONI RUOLO → GRANTS
-- ─────────────────────────────────────────────────────

-- Amministratore Piattaforma: tutti i 33 grant
INSERT INTO public.role_grants (role_id, grant_id)
SELECT 'be097ce0-7cf0-4e5d-be80-fd69a20ed6e6', id FROM public.grants
ON CONFLICT DO NOTHING;

-- Amministrazione: approve_billing_approval
INSERT INTO public.role_grants (role_id, grant_id) VALUES
  ('6c4ddb4c-f4d2-4312-9363-ec5a6cb938bb', '902ffb1e-8059-490e-bde6-0988d779b412')
ON CONFLICT DO NOTHING;

-- Buyer Procurement
INSERT INTO public.role_grants (role_id, grant_id) VALUES
  ('b2da4be7-303a-4264-a711-12870fb4fd1c', '78f61feb-3ee7-4126-9d01-de0feb169013'), -- approve_award
  ('b2da4be7-303a-4264-a711-12870fb4fd1c', 'faecc60b-f45f-4b61-86d8-409c037442a5'), -- create_opportunity
  ('b2da4be7-303a-4264-a711-12870fb4fd1c', '9a0a814d-4466-4566-ad51-3ab05f8f9d7b'), -- evaluate_bids
  ('b2da4be7-303a-4264-a711-12870fb4fd1c', '7f7ed2de-1ee7-4f5c-a4eb-98b46af27ef0'), -- invite_suppliers
  ('b2da4be7-303a-4264-a711-12870fb4fd1c', '1dbb63a2-551e-44c6-96ec-aaf042b58415'), -- manage_opportunity_attachments
  ('b2da4be7-303a-4264-a711-12870fb4fd1c', 'fd9f95b5-cf45-4d27-9002-5e9745926eac'), -- view_bids
  ('b2da4be7-303a-4264-a711-12870fb4fd1c', 'b1abc221-683f-4d6d-a4d6-898c6c420e98'), -- view_budget
  ('b2da4be7-303a-4264-a711-12870fb4fd1c', '47a60bb8-021a-4cfc-a2ba-8bd11432d1c1'), -- view_opportunities
  ('b2da4be7-303a-4264-a711-12870fb4fd1c', '8f0de50c-1e19-4bbb-8691-0fe18ef21c17'), -- view_supplier_documents
  ('b2da4be7-303a-4264-a711-12870fb4fd1c', '4c2b5a13-1872-4d09-a4bb-e01223d55275')  -- view_vendors
ON CONFLICT DO NOTHING;

-- Operatore Albo
INSERT INTO public.role_grants (role_id, grant_id) VALUES
  ('0513eedd-c25f-4183-9e3d-577a23c4c986', 'faecc60b-f45f-4b61-86d8-409c037442a5'), -- create_opportunity
  ('0513eedd-c25f-4183-9e3d-577a23c4c986', '9a0a814d-4466-4566-ad51-3ab05f8f9d7b'), -- evaluate_bids
  ('0513eedd-c25f-4183-9e3d-577a23c4c986', '7f7ed2de-1ee7-4f5c-a4eb-98b46af27ef0'), -- invite_suppliers
  ('0513eedd-c25f-4183-9e3d-577a23c4c986', '1dbb63a2-551e-44c6-96ec-aaf042b58415'), -- manage_opportunity_attachments
  ('0513eedd-c25f-4183-9e3d-577a23c4c986', 'dda148c7-3edc-48f3-bba4-97e100fd7a86'), -- review_documents
  ('0513eedd-c25f-4183-9e3d-577a23c4c986', 'fd9f95b5-cf45-4d27-9002-5e9745926eac'), -- view_bids
  ('0513eedd-c25f-4183-9e3d-577a23c4c986', 'b1abc221-683f-4d6d-a4d6-898c6c420e98'), -- view_budget
  ('0513eedd-c25f-4183-9e3d-577a23c4c986', '47a60bb8-021a-4cfc-a2ba-8bd11432d1c1'), -- view_opportunities
  ('0513eedd-c25f-4183-9e3d-577a23c4c986', '8f0de50c-1e19-4bbb-8691-0fe18ef21c17'), -- view_supplier_documents
  ('0513eedd-c25f-4183-9e3d-577a23c4c986', '4c2b5a13-1872-4d09-a4bb-e01223d55275')  -- view_vendors
ON CONFLICT DO NOTHING;

-- Responsabile Procurement
INSERT INTO public.role_grants (role_id, grant_id) VALUES
  ('cc5ee725-7836-4cd9-91fb-031a3bce3323', '7bf3ee4d-93df-46d4-9241-ad07e2e2a45b'), -- approve_accreditation
  ('cc5ee725-7836-4cd9-91fb-031a3bce3323', 'dda148c7-3edc-48f3-bba4-97e100fd7a86'), -- review_documents
  ('cc5ee725-7836-4cd9-91fb-031a3bce3323', '8bed4049-ba8f-44be-b51f-140cada348ca'), -- suspend_supplier
  ('cc5ee725-7836-4cd9-91fb-031a3bce3323', '8f0de50c-1e19-4bbb-8691-0fe18ef21c17'), -- view_supplier_documents
  ('cc5ee725-7836-4cd9-91fb-031a3bce3323', '4c2b5a13-1872-4d09-a4bb-e01223d55275')  -- view_vendors
ON CONFLICT DO NOTHING;

-- purchase_manager
INSERT INTO public.role_grants (role_id, grant_id) VALUES
  ('e75a1c5e-0601-4b6f-8a26-bf58db171f2a', '2e917241-fb9b-43e9-adee-419bf9eea572'), -- validate_purchase_request
  ('e75a1c5e-0601-4b6f-8a26-bf58db171f2a', 'eee1f9a3-31b5-40f4-889e-819431c937b6')  -- view_purchase_panel
ON CONFLICT DO NOTHING;

-- purchase_operator
INSERT INTO public.role_grants (role_id, grant_id) VALUES
  ('2c11c89b-24f8-47a0-b431-b90b69520c57', 'faecc60b-f45f-4b61-86d8-409c037442a5'), -- create_opportunity
  ('2c11c89b-24f8-47a0-b431-b90b69520c57', '3bbbd328-ead4-40ed-a0ed-ebe4068fe01e'), -- manage_purchase_operations
  ('2c11c89b-24f8-47a0-b431-b90b69520c57', '47a60bb8-021a-4cfc-a2ba-8bd11432d1c1'), -- view_opportunities
  ('2c11c89b-24f8-47a0-b431-b90b69520c57', 'eee1f9a3-31b5-40f4-889e-819431c937b6')  -- view_purchase_panel
ON CONFLICT DO NOTHING;

-- purchase_requester
INSERT INTO public.role_grants (role_id, grant_id) VALUES
  ('86f81632-1b16-470b-a19d-9d0c539218e3', '5b41740b-fcd7-47c5-b06c-abb796efcb17'), -- create_purchase_request
  ('86f81632-1b16-470b-a19d-9d0c539218e3', 'b490164b-a9cb-4619-9001-97979fa289c9')  -- view_own_purchase_requests
ON CONFLICT DO NOTHING;

-- finance_approver
INSERT INTO public.role_grants (role_id, grant_id) VALUES
  ('01795991-f7b2-407e-86f4-188f421f84fd', '2e917241-fb9b-43e9-adee-419bf9eea572'), -- validate_purchase_request
  ('01795991-f7b2-407e-86f4-188f421f84fd', '5e16aefc-5f50-4dc4-95e8-4d998695ae9b'), -- validate_purchase_request_high
  ('01795991-f7b2-407e-86f4-188f421f84fd', 'eee1f9a3-31b5-40f4-889e-819431c937b6')  -- view_purchase_panel
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────
-- 4. ASSEGNAZIONE RUOLI UTENTI
-- ─────────────────────────────────────────────────────
-- admin@vendorhub.it → Amministratore Piattaforma
INSERT INTO public.user_roles (user_id, role_id, assigned_by) VALUES
  ('34e4d644-e7be-4354-934d-0b8484bfe7da', 'be097ce0-7cf0-4e5d-be80-fd69a20ed6e6', '34e4d644-e7be-4354-934d-0b8484bfe7da'),
  -- g.maiolo@itdm.it → Amministratore Piattaforma
  ('70e9743f-4e83-4726-845a-bf55c839c143', 'be097ce0-7cf0-4e5d-be80-fd69a20ed6e6', '34e4d644-e7be-4354-934d-0b8484bfe7da'),
  -- m.boccardi@itdm.it → Amministratore Piattaforma
  ('2704ec0a-4472-4e6d-b38d-9b5331d5f668', 'be097ce0-7cf0-4e5d-be80-fd69a20ed6e6', '34e4d644-e7be-4354-934d-0b8484bfe7da'),
  -- t.furiosi@itdm.it → Amministratore Piattaforma
  ('87deffe8-2be8-4471-8726-85e3ad2fde77', 'be097ce0-7cf0-4e5d-be80-fd69a20ed6e6', '34e4d644-e7be-4354-934d-0b8484bfe7da'),
  -- s.cavaliero@itdm.it → Operatore Albo
  ('b7d5217b-4bef-4b65-a623-6e0ca8bdee14', '0513eedd-c25f-4183-9e3d-577a23c4c986', '34e4d644-e7be-4354-934d-0b8484bfe7da'),
  -- w.cucinella@itdm.it → Buyer Procurement
  ('b947502c-1b11-4ced-b2fc-4460e540a525', 'b2da4be7-303a-4264-a711-12870fb4fd1c', '34e4d644-e7be-4354-934d-0b8484bfe7da')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────
-- 5. TIPI DOCUMENTO
-- ─────────────────────────────────────────────────────
INSERT INTO public.document_types (id, tenant_id, code, name, description, is_mandatory, is_blocking, requires_expiry, validity_days, allowed_formats, max_size_mb, needs_manual_review, security_level, sort_order, is_active) VALUES
  ('333aa043-af41-4361-958a-d6e8e4df2e02', '00000000-0000-0000-0000-000000000001', 'VISURA',         'Visura Camerale',                      'Visura camerale aggiornata della società',                              true,  true,  true,  180, '{pdf}',                        10, true, 'L3', 1, true),
  ('a11271d7-62e3-45c9-914b-4aec0400ae2a', '00000000-0000-0000-0000-000000000001', 'DURC',           'DURC Regolarita Contributiva',         'Documento Unico di Regolarità Contributiva',                            true,  true,  true,  120, '{pdf}',                        10, true, 'L3', 2, true),
  ('13f1c717-0dd6-45c1-9dad-f2d5acbc7aa5', '00000000-0000-0000-0000-000000000001', 'ANTIMAFIA',      'Autocertificazione Antimafia',         'Autocertificazione antimafia ai sensi del D.Lgs. 159/2011',             true,  true,  true,  365, '{pdf}',                        10, true, 'L3', 3, true),
  ('c0e80a38-1713-47bc-b5cf-f86ef88b47ef', '00000000-0000-0000-0000-000000000001', 'ISO9001',        'Certificazione ISO 9001',              'Certificazione sistema di gestione qualità ISO 9001',                    false, false, true,  1095,'{pdf}',                        10, true, 'L2', 4, true),
  ('4deadd40-4423-455a-a7b5-9228213b8a3d', '00000000-0000-0000-0000-000000000001', 'ASSICURAZ',      'Polizza RC',                           'Polizza di responsabilità civile professionale',                         true,  true,  true,  365, '{pdf}',                        10, true, 'L3', 5, true),
  ('f9c9fb23-b695-423a-94e3-03d45eabe735', '00000000-0000-0000-0000-000000000001', 'PRIVACY',        'Informativa GDPR',                     'Informativa privacy e consenso al trattamento dati personali (GDPR)',    true,  true,  false, NULL,'{pdf}',                        10, false,'L2', 6, true),
  ('a952e48d-d03b-4677-93c4-015446bf8f05', '00000000-0000-0000-0000-000000000001', 'CI_ADMIN',       'Carta Identità Amministratore',        'Documento di identità del legale rappresentante',                        true,  true,  true,  1825,'{pdf,jpg,png}',                10, true, 'L3', 7, true),
  ('c72c53ee-08cd-4c73-9fda-3f1e41f5f722', '00000000-0000-0000-0000-000000000001', 'CERT_AZIENDALI', 'Certificazioni Aziendali in possesso', 'Eventuali certificazioni aziendali aggiuntive (ISO 14001, SA8000, ecc.)', false, false, true,  1095,'{pdf}',                        10, true, 'L2', 8, true)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────
-- 6. LIMITI DI ACQUISTO
-- ─────────────────────────────────────────────────────
INSERT INTO public.purchase_limits (id, tenant_id, role_id, max_approval_amount, max_annual_spend, description, is_active) VALUES
  ('225f6402-8ad1-4180-8f4d-65a183fd34e4', '00000000-0000-0000-0000-000000000001', 'be097ce0-7cf0-4e5d-be80-fd69a20ed6e6', 999999999, NULL,   'Nessun limite — accesso completo',                              true),
  ('35685ad1-8e9c-49f1-9225-7ccd7b2616f6', '00000000-0000-0000-0000-000000000001', 'cc5ee725-7836-4cd9-91fb-031a3bce3323', 50000,     200000, 'Soglia approvazione responsabile procurement',                  true),
  ('e6900ab8-1b8a-4ddb-9401-63f791eb1adc', '00000000-0000-0000-0000-000000000001', 'e75a1c5e-0601-4b6f-8a26-bf58db171f2a', 1000,      5000,   'Può approvare autonomamente richieste fino a 5.000 €',          true),
  ('04145d00-b64f-4e31-9dbd-fdea58cb9f36', '00000000-0000-0000-0000-000000000001', '01795991-f7b2-407e-86f4-188f421f84fd', 5000,      50000,  'Approva richieste sopra soglia. Limite annuale 500.000 €',       true),
  ('5461c38d-b9fa-4947-97b3-985e73ae9571', '00000000-0000-0000-0000-000000000001', '2c11c89b-24f8-47a0-b431-b90b69520c57', 100,       2000,   'Limite operativo per acquisti diretti',                          true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN RAISE NOTICE 'Seed data generation completed successfully.'; END $$;
