-- 1. Grants
INSERT INTO grants (name, description, module) VALUES
  ('create_purchase_request','Crea e invia richieste di acquisto','purchasing'),
  ('view_own_purchase_requests','Visualizza le proprie richieste','purchasing'),
  ('validate_purchase_request','Valida richieste entro soglia','purchasing'),
  ('validate_purchase_request_high','Valida richieste sopra soglia','purchasing'),
  ('manage_purchase_operations','Esegue acquisti autorizzati','purchasing'),
  ('view_purchase_panel','Pannello acquisti sola lettura','purchasing')
ON CONFLICT (name) DO NOTHING;

-- 2. Roles
INSERT INTO roles (tenant_id, name, description, is_system) VALUES
  ('00000000-0000-0000-0000-000000000001','purchase_requester','Richiedente Acquisti',true),
  ('00000000-0000-0000-0000-000000000001','purchase_operator','Operatore Ufficio Acquisti',true),
  ('00000000-0000-0000-0000-000000000001','purchase_manager','Responsabile Acquisti',true),
  ('00000000-0000-0000-0000-000000000001','finance_approver','Responsabile Finance',true)
ON CONFLICT DO NOTHING;

-- 3. Role grants
INSERT INTO role_grants (role_id, grant_id) SELECT r.id,g.id FROM roles r,grants g
WHERE r.tenant_id='00000000-0000-0000-0000-000000000001' AND r.name='purchase_requester'
  AND g.name IN('create_purchase_request','view_own_purchase_requests') ON CONFLICT DO NOTHING;
INSERT INTO role_grants (role_id, grant_id) SELECT r.id,g.id FROM roles r,grants g
WHERE r.tenant_id='00000000-0000-0000-0000-000000000001' AND r.name='purchase_operator'
  AND g.name IN('manage_purchase_operations','view_purchase_panel') ON CONFLICT DO NOTHING;
INSERT INTO role_grants (role_id, grant_id) SELECT r.id,g.id FROM roles r,grants g
WHERE r.tenant_id='00000000-0000-0000-0000-000000000001' AND r.name='purchase_manager'
  AND g.name IN('validate_purchase_request','view_purchase_panel') ON CONFLICT DO NOTHING;
INSERT INTO role_grants (role_id, grant_id) SELECT r.id,g.id FROM roles r,grants g
WHERE r.tenant_id='00000000-0000-0000-0000-000000000001' AND r.name='finance_approver'
  AND g.name IN('validate_purchase_request','validate_purchase_request_high','view_purchase_panel')
  ON CONFLICT DO NOTHING;

-- 4. Tenant settings
UPDATE tenants SET settings = settings || '{"purchase_approval_threshold": 5000}'::jsonb
WHERE id='00000000-0000-0000-0000-000000000001'
  AND NOT (settings ? 'purchase_approval_threshold');

-- 5. Functions
CREATE OR REPLACE FUNCTION insert_purchase_request_history(
  p_purchase_request_id UUID, p_from_status TEXT, p_to_status TEXT,
  p_changed_by UUID, p_reason TEXT DEFAULT NULL, p_notes TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  INSERT INTO purchase_request_status_history(
    purchase_request_id,from_status,to_status,changed_by,reason,notes)
  VALUES(p_purchase_request_id,p_from_status,p_to_status,p_changed_by,p_reason,p_notes);
END; $$;

CREATE OR REPLACE FUNCTION is_purchase_operator()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id
    WHERE ur.user_id=auth.uid() AND r.name='purchase_operator'
      AND r.is_active=true AND r.tenant_id=current_tenant_id());
$$;

-- 6. Tables
CREATE TABLE IF NOT EXISTS purchase_requests(
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  code TEXT, requested_by UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN(
    'draft','submitted','pending_validation','approved','approved_finance',
    'rejected','in_purchase','completed','cancelled')),
  subject TEXT NOT NULL, description TEXT, justification TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL CHECK(amount>0),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN('low','normal','high','urgent')),
  needed_by DATE, outcome TEXT CHECK(outcome IN('opportunity','direct_purchase')),
  linked_opportunity_id UUID REFERENCES opportunities(id),
  validated_by UUID REFERENCES profiles(id), validated_at TIMESTAMPTZ,
  validation_notes TEXT, rejected_by UUID REFERENCES profiles(id),
  rejected_at TIMESTAMPTZ, rejection_reason TEXT, deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_pr_tenant_status ON purchase_requests(tenant_id,status);
CREATE INDEX IF NOT EXISTS idx_pr_requested_by ON purchase_requests(requested_by);
CREATE TRIGGER trg_purchase_requests_upd BEFORE UPDATE ON purchase_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE SEQUENCE IF NOT EXISTS purchase_request_seq START 1;
CREATE OR REPLACE FUNCTION generate_purchase_request_code() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN IF NEW.code IS NULL OR NEW.code='' THEN
  NEW.code='RDA-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('purchase_request_seq')::TEXT,5,'0');
END IF; RETURN NEW; END; $$;
CREATE TRIGGER trg_purchase_request_code BEFORE INSERT ON purchase_requests
  FOR EACH ROW EXECUTE FUNCTION generate_purchase_request_code();

CREATE TABLE IF NOT EXISTS purchase_request_status_history(
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  purchase_request_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  from_status TEXT, to_status TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  reason TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_prsh_request
  ON purchase_request_status_history(purchase_request_id);

CREATE TABLE IF NOT EXISTS direct_purchases(
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id), code TEXT,
  purchase_request_id UUID REFERENCES purchase_requests(id),
  supplier_name TEXT NOT NULL, supplier_vat TEXT,
  supplier_email TEXT, supplier_address TEXT,
  purchase_date DATE NOT NULL, amount DECIMAL(15,2) NOT NULL CHECK(amount>0),
  subject TEXT NOT NULL, description TEXT,
  invoice_storage_path TEXT, invoice_filename TEXT,
  invoice_number TEXT, invoice_date DATE,
  registered_by UUID REFERENCES profiles(id),
  notes TEXT, deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_dp_tenant ON direct_purchases(tenant_id,purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_dp_request ON direct_purchases(purchase_request_id)
  WHERE purchase_request_id IS NOT NULL;
CREATE TRIGGER trg_direct_purchases_upd BEFORE UPDATE ON direct_purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE SEQUENCE IF NOT EXISTS direct_purchase_seq START 1;
CREATE OR REPLACE FUNCTION generate_direct_purchase_code() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN IF NEW.code IS NULL OR NEW.code='' THEN
  NEW.code='ACQ-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('direct_purchase_seq')::TEXT,5,'0');
END IF; RETURN NEW; END; $$;
CREATE TRIGGER trg_direct_purchase_code BEFORE INSERT ON direct_purchases
  FOR EACH ROW EXECUTE FUNCTION generate_direct_purchase_code();

-- 7. RLS
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_request_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_pr_sel_self ON purchase_requests FOR SELECT USING(
  requested_by=auth.uid() AND user_has_grant('view_own_purchase_requests'));
CREATE POLICY pol_pr_sel_validator ON purchase_requests FOR SELECT USING(
  tenant_id=current_tenant_id() AND(user_has_grant('validate_purchase_request')
  OR user_has_grant('validate_purchase_request_high')));
CREATE POLICY pol_pr_sel_operator ON purchase_requests FOR SELECT USING(
  tenant_id=current_tenant_id() AND user_has_grant('manage_purchase_operations')
  AND status IN('approved','approved_finance','in_purchase','completed'));
CREATE POLICY pol_pr_sel_panel ON purchase_requests FOR SELECT USING(
  tenant_id=current_tenant_id() AND user_has_grant('view_purchase_panel'));
CREATE POLICY pol_pr_ins ON purchase_requests FOR INSERT
  WITH CHECK(user_has_grant('create_purchase_request') AND tenant_id=current_tenant_id());
CREATE POLICY pol_pr_upd_self ON purchase_requests FOR UPDATE USING(
  requested_by=auth.uid() AND status='draft'
  AND user_has_grant('create_purchase_request'));
CREATE POLICY pol_pr_upd_manager ON purchase_requests FOR UPDATE USING(
  tenant_id=current_tenant_id() AND user_has_grant('validate_purchase_request')
  AND status='submitted');
CREATE POLICY pol_pr_upd_finance ON purchase_requests FOR UPDATE USING(
  tenant_id=current_tenant_id() AND user_has_grant('validate_purchase_request_high')
  AND status='pending_validation');
CREATE POLICY pol_pr_upd_operator ON purchase_requests FOR UPDATE USING(
  tenant_id=current_tenant_id() AND user_has_grant('manage_purchase_operations')
  AND status IN('approved','approved_finance','in_purchase'));

CREATE POLICY pol_prsh_sel ON purchase_request_status_history FOR SELECT USING(
  EXISTS(SELECT 1 FROM purchase_requests pr WHERE pr.id=purchase_request_id
  AND(pr.requested_by=auth.uid() OR(pr.tenant_id=current_tenant_id()
  AND(user_has_grant('validate_purchase_request')
      OR user_has_grant('validate_purchase_request_high')
      OR user_has_grant('manage_purchase_operations'))))));
CREATE POLICY pol_prsh_ins ON purchase_request_status_history FOR INSERT
  WITH CHECK(EXISTS(SELECT 1 FROM purchase_requests pr WHERE pr.id=purchase_request_id
  AND pr.tenant_id=current_tenant_id()));

CREATE POLICY pol_dp_sel ON direct_purchases FOR SELECT USING(
  tenant_id=current_tenant_id() AND(user_has_grant('manage_purchase_operations')
  OR user_has_grant('validate_purchase_request_high')
  OR user_has_grant('view_purchase_panel')));
CREATE POLICY pol_dp_ins ON direct_purchases FOR INSERT
  WITH CHECK(user_has_grant('manage_purchase_operations') AND tenant_id=current_tenant_id());
CREATE POLICY pol_dp_upd ON direct_purchases FOR UPDATE USING(
  user_has_grant('manage_purchase_operations') AND tenant_id=current_tenant_id());

-- 8. Email templates
INSERT INTO email_templates(tenant_id,event_type,subject,html_body) VALUES
  ('00000000-0000-0000-0000-000000000001','purchase_request_submitted',
   'Nuova richiesta - {{code}}','<p>RDA <strong>{{code}}</strong>. <a href="{{url}}">Valida</a></p>'),
  ('00000000-0000-0000-0000-000000000001','purchase_request_needs_finance',
   'Richiesta sopra soglia - {{code}}','<p>RDA <strong>{{code}}</strong> per {{amount}} EUR. <a href="{{url}}">Valida</a></p>'),
  ('00000000-0000-0000-0000-000000000001','purchase_request_approved',
   'Richiesta approvata - {{code}}','<p>La tua RDA <strong>{{code}}</strong> e approvata.</p>'),
  ('00000000-0000-0000-0000-000000000001','purchase_request_ready_for_purchase',
   'Richiesta autorizzata - {{code}}','<p>RDA <strong>{{code}}</strong>. <a href="{{url}}">Prendi in carico</a></p>'),
  ('00000000-0000-0000-0000-000000000001','purchase_request_rejected',
   'Richiesta respinta - {{code}}','<p>RDA <strong>{{code}}</strong> respinta. Motivo: <em>{{reason}}</em></p>')
ON CONFLICT DO NOTHING;