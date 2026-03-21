
-- Fix linter: search_path su tutte le funzioni + security invoker sulle view + RLS su tenants

-- Fix search_path
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1; $$;

CREATE OR REPLACE FUNCTION user_has_grant(grant_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_grants rg ON rg.role_id = ur.role_id
    JOIN grants g ON g.id = rg.grant_id
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND g.name = grant_name AND r.is_active = true
    UNION ALL
    SELECT 1 FROM user_grants ug JOIN grants g ON g.id = ug.grant_id
    WHERE ug.user_id = auth.uid() AND g.name = grant_name
      AND (ug.expires_at IS NULL OR ug.expires_at > NOW())
  ); $$;

CREATE OR REPLACE FUNCTION check_mandatory_docs(
  p_supplier_id UUID, p_category_id UUID DEFAULT NULL)
RETURNS TABLE(document_type_id UUID, document_name TEXT, reason TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN RETURN QUERY
  SELECT dt.id, dt.name,
    CASE WHEN ud.id IS NULL THEN 'non_caricato'
         WHEN ud.status = 'rejected' THEN 'respinto'
         WHEN ud.status = 'not_uploaded' THEN 'non_caricato'
         WHEN ud.expiry_date IS NOT NULL AND ud.expiry_date < CURRENT_DATE THEN 'scaduto'
         ELSE 'non_approvato' END AS reason
  FROM document_types dt
  LEFT JOIN LATERAL (
    SELECT ud2.* FROM uploaded_documents ud2
    WHERE ud2.supplier_id = p_supplier_id AND ud2.document_type_id = dt.id
      AND ud2.deleted_at IS NULL ORDER BY ud2.version DESC LIMIT 1) ud ON true
  WHERE dt.is_mandatory=true AND dt.is_active=true
    AND (dt.valid_until IS NULL OR dt.valid_until >= CURRENT_DATE)
    AND (dt.applies_to_categories IS NULL OR p_category_id IS NULL
         OR p_category_id = ANY(dt.applies_to_categories))
    AND (ud.id IS NULL OR ud.status NOT IN ('approved')
         OR (ud.expiry_date IS NOT NULL AND ud.expiry_date < CURRENT_DATE));
END; $$;

CREATE OR REPLACE FUNCTION generate_opportunity_code() RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN IF NEW.code IS NULL OR NEW.code='' THEN
  NEW.code='OPP-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('opportunity_seq')::TEXT,4,'0');
END IF; RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION generate_order_code() RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN IF NEW.code IS NULL OR NEW.code='' THEN
  NEW.code='ORD-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('order_seq')::TEXT,5,'0');
END IF; RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION generate_billing_code() RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN IF NEW.code IS NULL OR NEW.code='' THEN
  NEW.code='BEN-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('billing_seq')::TEXT,5,'0');
END IF; RETURN NEW; END; $$;

-- Fix security definer views: ricreare con SECURITY INVOKER
DROP VIEW IF EXISTS user_effective_grants;
CREATE VIEW user_effective_grants WITH (security_invoker = true) AS
  SELECT DISTINCT ur.user_id, g.name AS grant_name, 'role'::text AS source
  FROM user_roles ur JOIN role_grants rg ON rg.role_id = ur.role_id
  JOIN grants g ON g.id = rg.grant_id JOIN roles r ON r.id = ur.role_id
  WHERE r.is_active = true
  UNION
  SELECT ug.user_id, g.name, 'direct'::text FROM user_grants ug
  JOIN grants g ON g.id = ug.grant_id
  WHERE (ug.expires_at IS NULL OR ug.expires_at > NOW());

DROP VIEW IF EXISTS contract_economic_summary;
CREATE VIEW contract_economic_summary WITH (security_invoker = true) AS
SELECT c.id AS contract_id, c.order_id, c.supplier_id, c.tenant_id,
  c.total_amount AS original_order_amount,
  COALESCE(c.current_amount,c.total_amount) AS current_authorized_amount,
  COALESCE(SUM(ba.amount) FILTER (
    WHERE ba.status IN ('approved','invoiced','closed') AND ba.deleted_at IS NULL),0)
  AS approved_billing_total,
  COALESCE(c.current_amount,c.total_amount) -
  COALESCE(SUM(ba.amount) FILTER (
    WHERE ba.status IN ('approved','invoiced','closed') AND ba.deleted_at IS NULL),0)
  AS residual_amount,
  COUNT(ba.id) FILTER (WHERE ba.status='pending_approval' AND ba.deleted_at IS NULL)
  AS pending_approval_count,
  COALESCE(SUM(ba.amount) FILTER (WHERE ba.status='pending_approval' AND ba.deleted_at IS NULL),0)
  AS pending_approval_amount,
  CASE WHEN COALESCE(c.current_amount,c.total_amount)>0 THEN
    ROUND((COALESCE(c.current_amount,c.total_amount)-
      COALESCE(SUM(ba.amount) FILTER (
        WHERE ba.status IN ('approved','invoiced','closed') AND ba.deleted_at IS NULL),0)
    )*100.0/COALESCE(c.current_amount,c.total_amount),1)
  ELSE 0 END AS residual_pct
FROM contracts c LEFT JOIN billing_approvals ba ON ba.contract_id=c.id
GROUP BY c.id,c.order_id,c.supplier_id,c.tenant_id,c.total_amount,c.current_amount;

-- RLS policy per tenants (mancava)
CREATE POLICY pol_tenants_sel ON tenants FOR SELECT USING (id=current_tenant_id());
CREATE POLICY pol_tenants_adm ON tenants FOR ALL USING (user_has_grant('manage_users'));
