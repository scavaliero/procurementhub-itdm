
-- BLOCCO 4: Contratti

CREATE SEQUENCE order_seq START 1;
CREATE TABLE orders (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id), code TEXT,
  award_id UUID REFERENCES awards(id), opportunity_id UUID REFERENCES opportunities(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','pending_approval','issued','accepted','rejected',
    'active','completed','cancelled','closed')),
  subject TEXT NOT NULL, description TEXT, amount DECIMAL(15,2) NOT NULL,
  start_date DATE, end_date DATE, milestones JSONB DEFAULT '[]',
  contract_conditions TEXT, supplier_accepted_at TIMESTAMPTZ,
  supplier_rejected_at TIMESTAMPTZ,
  issued_by UUID REFERENCES profiles(id), approved_by UUID REFERENCES profiles(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TRIGGER trg_orders_upd BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION generate_order_code() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN IF NEW.code IS NULL OR NEW.code='' THEN
  NEW.code='ORD-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('order_seq')::TEXT,5,'0');
END IF; RETURN NEW; END; $$;
CREATE TRIGGER trg_order_code BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_code();

CREATE TABLE contracts (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  order_id UUID NOT NULL REFERENCES orders(id) UNIQUE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned','active','suspended','completed','closed','cancelled')),
  start_date DATE NOT NULL, end_date DATE NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL, current_amount DECIMAL(15,2),
  progress_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TRIGGER trg_contracts_upd BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE SEQUENCE billing_seq START 1;
CREATE TABLE billing_approvals (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id), code TEXT,
  contract_id UUID NOT NULL REFERENCES contracts(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','pending_approval','approved','rejected','cancelled','invoiced','closed')),
  period_start DATE NOT NULL, period_end DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL, activity_description TEXT,
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id), approved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TRIGGER trg_billing_upd BEFORE UPDATE ON billing_approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION generate_billing_code() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN IF NEW.code IS NULL OR NEW.code='' THEN
  NEW.code='BEN-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('billing_seq')::TEXT,5,'0');
END IF; RETURN NEW; END; $$;
CREATE TRIGGER trg_billing_code BEFORE INSERT ON billing_approvals
  FOR EACH ROW EXECUTE FUNCTION generate_billing_code();
