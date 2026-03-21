
-- BLOCCO 3: Procurement

CREATE SEQUENCE opportunity_seq START 1;
CREATE TABLE opportunities (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id), code TEXT,
  title TEXT NOT NULL, description TEXT,
  category_id UUID REFERENCES categories(id),
  subcategory_id UUID REFERENCES categories(id),
  requesting_unit TEXT, internal_ref_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','pending_approval','published','open','collecting_bids',
    'evaluating','awarded','not_awarded','cancelled','closed')),
  opens_at TIMESTAMPTZ, bids_deadline TIMESTAMPTZ,
  start_date DATE, end_date DATE, estimated_duration_days INTEGER,
  budget_estimated DECIMAL(15,2), budget_max DECIMAL(15,2),
  evaluation_criteria JSONB DEFAULT '[]',
  geographic_area TEXT, participation_conditions TEXT,
  operational_notes TEXT, version INTEGER DEFAULT 1,
  deleted_at TIMESTAMPTZ, created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX idx_opp_tenant_status ON opportunities(tenant_id, status);
CREATE TRIGGER trg_opp_upd BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION generate_opportunity_code() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN IF NEW.code IS NULL OR NEW.code='' THEN
  NEW.code='OPP-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('opportunity_seq')::TEXT,4,'0');
END IF; RETURN NEW; END; $$;
CREATE TRIGGER trg_opp_code BEFORE INSERT ON opportunities
  FOR EACH ROW EXECUTE FUNCTION generate_opportunity_code();

CREATE TABLE opportunity_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN (
    'sent','viewed','preparing','draft_bid','submitted','expired','not_awarded','awarded')),
  invited_by UUID REFERENCES profiles(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(), viewed_at TIMESTAMPTZ,
  UNIQUE(opportunity_id, supplier_id));

CREATE TABLE bids (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  invitation_id UUID REFERENCES opportunity_invitations(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','submitted','admin_review','tech_review','admitted',
    'admitted_with_reserve','excluded','winning','not_awarded','withdrawn')),
  total_amount DECIMAL(15,2), economic_detail JSONB,
  technical_description TEXT, execution_days INTEGER,
  bid_validity_date DATE, proposed_conditions TEXT, notes TEXT,
  submitted_at TIMESTAMPTZ, version INTEGER DEFAULT 1, deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(opportunity_id, supplier_id));

CREATE TABLE bid_evaluations (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES profiles(id),
  criteria_scores JSONB NOT NULL, total_score DECIMAL(6,2),
  admin_approved BOOLEAN, tech_approved BOOLEAN,
  internal_notes TEXT, evaluated_at TIMESTAMPTZ DEFAULT NOW());

CREATE TABLE awards (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) UNIQUE,
  winning_bid_id UUID REFERENCES bids(id), supplier_id UUID REFERENCES suppliers(id),
  awarded_by UUID REFERENCES profiles(id),
  awarded_at TIMESTAMPTZ DEFAULT NOW(), justification TEXT, notes TEXT);
