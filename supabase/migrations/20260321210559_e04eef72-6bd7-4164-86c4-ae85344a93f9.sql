
-- BLOCCO 1 (riordinato): tabelle prima, funzioni dopo

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TABLE tenants (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}', is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

CREATE TABLE profiles (id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_type TEXT NOT NULL CHECK (user_type IN ('internal','supplier')),
  supplier_id UUID,
  full_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT,
  is_active BOOLEAN DEFAULT true, last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TRIGGER trg_profiles_upd BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE roles (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL, description TEXT,
  is_system BOOLEAN DEFAULT false, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(tenant_id, name));

CREATE TABLE grants (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL, description TEXT,
  module TEXT NOT NULL CHECK (module IN ('vendor_register','procurement','contracts','admin')),
  created_at TIMESTAMPTZ DEFAULT NOW());

CREATE TABLE role_grants (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  grant_id UUID REFERENCES grants(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, grant_id));

CREATE TABLE user_roles (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES profiles(id),
  PRIMARY KEY (user_id, role_id));

CREATE TABLE user_grants (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  grant_id UUID REFERENCES grants(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES profiles(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(), expires_at TIMESTAMPTZ, reason TEXT);

-- Funzioni che dipendono dalle tabelle
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1; $$;

CREATE OR REPLACE FUNCTION user_has_grant(grant_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
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

CREATE OR REPLACE VIEW user_effective_grants AS
  SELECT DISTINCT ur.user_id, g.name AS grant_name, 'role'::text AS source
  FROM user_roles ur JOIN role_grants rg ON rg.role_id = ur.role_id
  JOIN grants g ON g.id = rg.grant_id JOIN roles r ON r.id = ur.role_id
  WHERE r.is_active = true
  UNION
  SELECT ug.user_id, g.name, 'direct'::text FROM user_grants ug
  JOIN grants g ON g.id = ug.grant_id
  WHERE (ug.expires_at IS NULL OR ug.expires_at > NOW());
