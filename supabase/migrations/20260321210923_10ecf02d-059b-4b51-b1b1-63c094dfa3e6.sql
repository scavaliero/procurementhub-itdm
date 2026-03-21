
-- Fix: RLS su email_templates + policy
CREATE POLICY pol_email_tpl_sel ON email_templates FOR SELECT USING (tenant_id=current_tenant_id());
CREATE POLICY pol_email_tpl_adm ON email_templates FOR ALL USING (user_has_grant('manage_users'));

-- BLOCCO 7: Seed data
INSERT INTO tenants (id,name,slug) VALUES
  ('00000000-0000-0000-0000-000000000001','VendorHub Demo Srl','demo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO grants (name,description,module) VALUES
  ('manage_users','Gestione utenti interni','admin'),
  ('manage_roles','Gestione ruoli e grant','admin'),
  ('view_audit_logs','Accesso audit trail','admin'),
  ('manage_document_types','Config tipi documento','admin'),
  ('view_supplier_documents','Visualizza documenti fornitore','vendor_register'),
  ('review_documents','Approva/respingi documenti','vendor_register'),
  ('approve_accreditation','Approva accreditamento','vendor_register'),
  ('suspend_supplier','Sospendi/revoca fornitore','vendor_register'),
  ('create_opportunity','Crea opportunita','procurement'),
  ('approve_opportunity','Approva opportunita','procurement'),
  ('invite_suppliers','Invita fornitori','procurement'),
  ('view_bids','Visualizza offerte','procurement'),
  ('evaluate_bids','Valuta offerte','procurement'),
  ('approve_award','Aggiudica opportunita','procurement'),
  ('view_orders','Visualizza ordini','contracts'),
  ('manage_orders','Gestisci ordini','contracts'),
  ('create_billing_approval','Crea benestari','contracts'),
  ('approve_billing_approval','Approva benestari','contracts'),
  ('view_budget','Visualizza budget','procurement'),
  ('export_data','Esporta dati CSV','admin')
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (tenant_id,name,description,is_system) VALUES
  ('00000000-0000-0000-0000-000000000001','Amministratore Piattaforma','Accesso completo',true),
  ('00000000-0000-0000-0000-000000000001','Operatore Albo','Gestione accreditamento',true),
  ('00000000-0000-0000-0000-000000000001','Responsabile Qualifica','Approvazione finale',true),
  ('00000000-0000-0000-0000-000000000001','Buyer Procurement','Opportunita e offerte',true),
  ('00000000-0000-0000-0000-000000000001','Responsabile Procurement','Validazione ordini',true),
  ('00000000-0000-0000-0000-000000000001','Amministrazione','Ordini e benestari',true)
ON CONFLICT (tenant_id,name) DO NOTHING;

INSERT INTO categories (tenant_id,code,name) VALUES
  ('00000000-0000-0000-0000-000000000001','IT','Informatica e Software'),
  ('00000000-0000-0000-0000-000000000001','CON','Consulenza Professionale'),
  ('00000000-0000-0000-0000-000000000001','LOG','Logistica e Trasporti'),
  ('00000000-0000-0000-0000-000000000001','MAN','Manutenzione e Facility'),
  ('00000000-0000-0000-0000-000000000001','MKT','Marketing e Comunicazione'),
  ('00000000-0000-0000-0000-000000000001','HSEC','Salute e Sicurezza'),
  ('00000000-0000-0000-0000-000000000001','LEG','Servizi Legali')
ON CONFLICT (tenant_id,code) DO NOTHING;

INSERT INTO document_types (tenant_id,code,name,is_mandatory,is_blocking,
  requires_expiry,validity_days,needs_manual_review,security_level,sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001','VISURA','Visura Camerale',true,true,true,365,true,'L3',1),
  ('00000000-0000-0000-0000-000000000001','DURC','DURC Regolarita Contributiva',true,true,true,120,true,'L3',2),
  ('00000000-0000-0000-0000-000000000001','ANTIMAFIA','Certificato Antimafia',true,true,true,180,true,'L4',3),
  ('00000000-0000-0000-0000-000000000001','ISO9001','Certificazione ISO 9001',false,false,true,1095,true,'L3',4),
  ('00000000-0000-0000-0000-000000000001','ASSICURAZ','Polizza RC',true,false,true,365,true,'L3',5),
  ('00000000-0000-0000-0000-000000000001','PRIVACY','Informativa GDPR',false,false,false,null,false,'L2',6)
ON CONFLICT (tenant_id,code) DO NOTHING;

INSERT INTO email_templates (tenant_id,event_type,subject,html_body) VALUES
  ('00000000-0000-0000-0000-000000000001','pre_registration',
   'Richiesta accesso — {{company_name}}',
   '<p>Gentile {{contact_name}}, richiesta per <strong>{{company_name}}</strong> ricevuta.</p>'),
  ('00000000-0000-0000-0000-000000000001','accreditation_approved',
   'Accreditamento approvato — {{company_name}}',
   '<p>Siete stati accreditati. <a href="{{portal_url}}">Accedi</a></p>'),
  ('00000000-0000-0000-0000-000000000001','opportunity_invited',
   'Invito opportunita — {{opportunity_title}}',
   '<p>Invitati a <strong>{{opportunity_title}}</strong>. Scadenza: {{deadline}}.
    <a href="{{opportunity_url}}">Accedi</a></p>'),
  ('00000000-0000-0000-0000-000000000001','document_expiring',
   'Documento in scadenza — {{document_name}}',
   '<p><strong>{{document_name}}</strong> scade il {{expiry_date}}.
    <a href="{{portal_url}}">Aggiorna</a></p>'),
  ('00000000-0000-0000-0000-000000000001','order_issued',
   'Nuovo ordine — {{order_code}}',
   '<p>Ordine emesso. <a href="{{order_url}}">Visualizza e accetta</a></p>'),
  ('00000000-0000-0000-0000-000000000001','billing_approved',
   'Benestare approvato — {{billing_code}}',
   '<p>Benestare {{billing_code}} per {{amount}} EUR approvato.</p>')
ON CONFLICT (tenant_id,event_type) DO NOTHING;

INSERT INTO tenants (id,name,slug,is_active) VALUES
  ('00000000-0000-0000-0000-000000000fff','__SETUP_VERIFY_SANDBOX__','setup-verify-sandbox',false)
ON CONFLICT (id) DO NOTHING;
