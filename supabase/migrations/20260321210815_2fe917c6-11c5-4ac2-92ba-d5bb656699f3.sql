
-- BLOCCO 6: Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('vendor-documents', 'vendor-documents', false),
  ('opportunity-attachments', 'opportunity-attachments', false),
  ('bid-attachments', 'bid-attachments', false),
  ('order-attachments', 'order-attachments', false),
  ('billing-attachments', 'billing-attachments', false),
  ('public-assets', 'public-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS su tutte le tabelle
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY pol_profiles_sel ON profiles FOR SELECT USING (
  id=auth.uid() OR (tenant_id=current_tenant_id()
  AND (SELECT user_type FROM profiles WHERE id=auth.uid())='internal'));
CREATE POLICY pol_profiles_upd ON profiles FOR UPDATE USING (id=auth.uid());
CREATE POLICY pol_profiles_adm ON profiles FOR ALL USING (user_has_grant('manage_users'));
CREATE POLICY pol_roles_sel ON roles FOR SELECT USING (tenant_id=current_tenant_id());
CREATE POLICY pol_roles_adm ON roles FOR ALL USING (user_has_grant('manage_roles'));
CREATE POLICY pol_grants_sel ON grants FOR SELECT USING (true);
CREATE POLICY pol_role_grants_sel ON role_grants FOR SELECT USING (true);
CREATE POLICY pol_user_roles_sel ON user_roles FOR SELECT
  USING (user_id=auth.uid() OR user_has_grant('manage_roles'));
CREATE POLICY pol_user_roles_adm ON user_roles FOR ALL USING (user_has_grant('manage_roles'));
CREATE POLICY pol_cats_sel ON categories FOR SELECT USING (tenant_id=current_tenant_id());
CREATE POLICY pol_cats_adm ON categories FOR ALL USING (user_has_grant('manage_document_types'));
CREATE POLICY pol_doctypes_sel ON document_types FOR SELECT USING (tenant_id=current_tenant_id());
CREATE POLICY pol_doctypes_adm ON document_types FOR ALL USING (user_has_grant('manage_document_types'));
CREATE POLICY pol_sup_self ON suppliers FOR SELECT USING (
  (SELECT supplier_id FROM profiles WHERE id=auth.uid())=id);
CREATE POLICY pol_sup_int ON suppliers FOR SELECT USING (
  tenant_id=current_tenant_id()
  AND (SELECT user_type FROM profiles WHERE id=auth.uid())='internal');
CREATE POLICY pol_sup_ins ON suppliers FOR INSERT WITH CHECK (tenant_id=current_tenant_id());
CREATE POLICY pol_sup_upd ON suppliers FOR UPDATE USING (
  tenant_id=current_tenant_id()
  AND (SELECT user_type FROM profiles WHERE id=auth.uid())='internal');
CREATE POLICY pol_supcat_sel ON supplier_categories FOR SELECT USING (true);
CREATE POLICY pol_supstatus_sel ON supplier_status_history FOR SELECT USING (true);
CREATE POLICY pol_docs_self ON uploaded_documents FOR SELECT USING (
  supplier_id=(SELECT supplier_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY pol_docs_int ON uploaded_documents FOR SELECT USING (
  tenant_id=current_tenant_id() AND user_has_grant('view_supplier_documents'));
CREATE POLICY pol_docs_ins ON uploaded_documents FOR INSERT WITH CHECK (
  supplier_id=(SELECT supplier_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY pol_docs_rev ON uploaded_documents FOR UPDATE
  USING (user_has_grant('review_documents'));
CREATE POLICY pol_opp_int ON opportunities FOR SELECT USING (
  tenant_id=current_tenant_id()
  AND (SELECT user_type FROM profiles WHERE id=auth.uid())='internal');
CREATE POLICY pol_opp_sup ON opportunities FOR SELECT USING (
  status IN ('open','collecting_bids','evaluating','awarded','closed')
  AND EXISTS (SELECT 1 FROM opportunity_invitations oi
    JOIN profiles p ON p.supplier_id=oi.supplier_id
    WHERE oi.opportunity_id=opportunities.id AND p.id=auth.uid()));
CREATE POLICY pol_opp_ins ON opportunities FOR INSERT
  WITH CHECK (user_has_grant('create_opportunity'));
CREATE POLICY pol_opp_upd ON opportunities FOR UPDATE
  USING (user_has_grant('create_opportunity') OR user_has_grant('approve_opportunity'));
CREATE POLICY pol_inv_sel ON opportunity_invitations FOR SELECT USING (true);
CREATE POLICY pol_bids_self ON bids FOR SELECT USING (
  supplier_id=(SELECT supplier_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY pol_bids_int ON bids FOR SELECT USING (
  tenant_id=current_tenant_id() AND user_has_grant('view_bids'));
CREATE POLICY pol_bids_ins ON bids FOR INSERT WITH CHECK (
  supplier_id=(SELECT supplier_id FROM profiles WHERE id=auth.uid())
  AND EXISTS (SELECT 1 FROM opportunity_invitations
    WHERE opportunity_id=bids.opportunity_id AND supplier_id=bids.supplier_id));
CREATE POLICY pol_bids_upd_self ON bids FOR UPDATE USING (
  supplier_id=(SELECT supplier_id FROM profiles WHERE id=auth.uid()) AND status IN ('draft'));
CREATE POLICY pol_bids_upd_int ON bids FOR UPDATE USING (user_has_grant('evaluate_bids'));
CREATE POLICY pol_eval_sel ON bid_evaluations FOR SELECT USING (true);
CREATE POLICY pol_awards_sel ON awards FOR SELECT USING (true);
CREATE POLICY pol_ord_self ON orders FOR SELECT USING (
  supplier_id=(SELECT supplier_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY pol_ord_int ON orders FOR SELECT USING (
  tenant_id=current_tenant_id()
  AND (user_has_grant('view_orders') OR user_has_grant('manage_orders')));
CREATE POLICY pol_ord_wrt ON orders FOR ALL USING (user_has_grant('manage_orders'));
CREATE POLICY pol_con_self ON contracts FOR SELECT USING (
  supplier_id=(SELECT supplier_id FROM profiles WHERE id=auth.uid()));
CREATE POLICY pol_con_int ON contracts FOR SELECT USING (
  tenant_id=current_tenant_id()
  AND (user_has_grant('view_orders') OR user_has_grant('manage_orders')));
CREATE POLICY pol_con_wrt ON contracts FOR ALL USING (user_has_grant('manage_orders'));
CREATE POLICY pol_bill_self ON billing_approvals FOR SELECT USING (
  supplier_id=(SELECT supplier_id FROM profiles WHERE id=auth.uid())
  AND status IN ('approved','invoiced','closed'));
CREATE POLICY pol_bill_int ON billing_approvals FOR SELECT USING (
  tenant_id=current_tenant_id()
  AND (user_has_grant('create_billing_approval') OR user_has_grant('approve_billing_approval')));
CREATE POLICY pol_bill_wrt ON billing_approvals FOR ALL USING (
  user_has_grant('create_billing_approval') OR user_has_grant('approve_billing_approval'));
CREATE POLICY pol_notif_own ON notifications FOR SELECT USING (recipient_id=auth.uid());
CREATE POLICY pol_notif_upd ON notifications FOR UPDATE USING (recipient_id=auth.uid());
CREATE POLICY pol_audit_adm ON audit_logs FOR SELECT
  USING (user_has_grant('view_audit_logs'));

-- Storage policies
CREATE POLICY stor_vendor_ins ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='vendor-documents'
    AND (storage.foldername(name))[1]=(SELECT supplier_id::TEXT FROM profiles WHERE id=auth.uid()));
CREATE POLICY stor_vendor_sel_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='vendor-documents'
    AND (storage.foldername(name))[1]=(SELECT supplier_id::TEXT FROM profiles WHERE id=auth.uid()));
CREATE POLICY stor_vendor_sel_int ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='vendor-documents' AND user_has_grant('view_supplier_documents'));
CREATE POLICY stor_vendor_upd ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='vendor-documents'
    AND (storage.foldername(name))[1]=(SELECT supplier_id::TEXT FROM profiles WHERE id=auth.uid()));
CREATE POLICY stor_bid_ins ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='bid-attachments'
    AND (storage.foldername(name))[2]=(SELECT supplier_id::TEXT FROM profiles WHERE id=auth.uid()));
CREATE POLICY stor_bid_sel_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='bid-attachments'
    AND (storage.foldername(name))[2]=(SELECT supplier_id::TEXT FROM profiles WHERE id=auth.uid()));
CREATE POLICY stor_bid_sel_int ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='bid-attachments' AND user_has_grant('view_bids'));
CREATE POLICY stor_opp_ins ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='opportunity-attachments' AND user_has_grant('create_opportunity'));
CREATE POLICY stor_opp_sel ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='opportunity-attachments'
    AND (user_has_grant('view_bids') OR EXISTS (
      SELECT 1 FROM opportunity_invitations oi JOIN profiles p ON p.supplier_id=oi.supplier_id
      WHERE p.id=auth.uid()
        AND oi.opportunity_id::TEXT=(storage.foldername(name))[1])));
CREATE POLICY stor_ord_ins ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='order-attachments' AND user_has_grant('manage_orders'));
CREATE POLICY stor_ord_sel ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='order-attachments' AND user_has_grant('view_orders'));
CREATE POLICY stor_bill_ins ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='billing-attachments' AND user_has_grant('create_billing_approval'));
CREATE POLICY stor_bill_sel ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='billing-attachments'
    AND (user_has_grant('approve_billing_approval') OR user_has_grant('create_billing_approval')));
CREATE POLICY stor_pub_sel ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id='public-assets');
CREATE POLICY stor_pub_ins ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='public-assets' AND user_has_grant('manage_users'));
