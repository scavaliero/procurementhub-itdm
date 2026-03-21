
-- BLOCCO 2: Albo Fornitori

CREATE TABLE categories (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  parent_id UUID REFERENCES categories(id),
  code TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, code));

CREATE TABLE document_types (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
  is_mandatory BOOLEAN DEFAULT false, is_blocking BOOLEAN DEFAULT false,
  requires_expiry BOOLEAN DEFAULT false, validity_days INTEGER,
  allowed_formats TEXT[] DEFAULT '{pdf,jpg,png,docx}', max_size_mb INTEGER DEFAULT 10,
  needs_manual_review BOOLEAN DEFAULT true, applies_to_categories UUID[],
  security_level TEXT DEFAULT 'L3' CHECK (security_level IN ('L2','L3','L4')),
  is_active BOOLEAN DEFAULT true, valid_from DATE, valid_until DATE,
  sort_order INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, code));

CREATE TABLE suppliers (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  company_name TEXT NOT NULL, company_type TEXT, legal_address JSONB,
  website TEXT, pec TEXT, vat_number_hash TEXT, iban_masked TEXT,
  status TEXT NOT NULL DEFAULT 'pre_registered' CHECK (status IN (
    'pre_registered','enabled','in_accreditation','in_integration',
    'in_approval','accredited','suspended','revoked','in_requalification')),
  accredited_at TIMESTAMPTZ, suspended_at TIMESTAMPTZ, suspension_reason TEXT,
  rating_score DECIMAL(3,2), rating_count INTEGER DEFAULT 0,
  notes TEXT, deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX idx_suppliers_tenant_status ON suppliers(tenant_id, status);
CREATE INDEX idx_suppliers_vat_hash ON suppliers(vat_number_hash);
CREATE TRIGGER trg_suppliers_upd BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE profiles ADD CONSTRAINT fk_profiles_supplier
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id);

CREATE TABLE supplier_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  qualified_at TIMESTAMPTZ, valid_until DATE,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','qualified','expired','revoked')),
  UNIQUE(supplier_id, category_id));

CREATE TABLE supplier_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  from_status TEXT, to_status TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  reason TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW());

CREATE TABLE uploaded_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  document_type_id UUID NOT NULL REFERENCES document_types(id),
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN (
    'not_uploaded','uploaded','in_review','approved',
    'rejected','expired','replaced','not_applicable')),
  storage_path TEXT, original_filename TEXT, file_size_bytes INTEGER,
  mime_type TEXT, expiry_date DATE, review_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id), reviewed_at TIMESTAMPTZ,
  virus_scan_status TEXT DEFAULT 'pending'
    CHECK (virus_scan_status IN ('pending','clean','infected','error')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX idx_docs_supplier ON uploaded_documents(supplier_id, status);

CREATE OR REPLACE FUNCTION check_mandatory_docs(
  p_supplier_id UUID, p_category_id UUID DEFAULT NULL)
RETURNS TABLE(document_type_id UUID, document_name TEXT, reason TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
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
