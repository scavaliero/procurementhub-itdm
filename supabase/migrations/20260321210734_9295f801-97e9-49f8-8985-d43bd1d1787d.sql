
-- BLOCCO 5: View economica + tabelle trasversali

CREATE VIEW contract_economic_summary AS
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

CREATE TABLE notifications (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  recipient_id UUID NOT NULL REFERENCES profiles(id),
  event_type TEXT NOT NULL, title TEXT NOT NULL, body TEXT, link_url TEXT,
  related_entity_type TEXT, related_entity_id UUID,
  is_read BOOLEAN DEFAULT false, read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX idx_notif_recipient ON notifications(recipient_id, is_read);

CREATE TABLE email_templates (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  event_type TEXT NOT NULL, subject TEXT NOT NULL,
  html_body TEXT NOT NULL, text_body TEXT,
  variables JSONB DEFAULT '[]', is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(tenant_id, event_type));

CREATE TABLE audit_logs (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL, user_id UUID, user_email TEXT, user_role TEXT,
  event_type TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id UUID,
  old_state JSONB, new_state JSONB, ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW());
CREATE RULE no_update_audit_logs AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit_logs AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
CREATE INDEX idx_audit_entity ON audit_logs(tenant_id, entity_type, entity_id);
