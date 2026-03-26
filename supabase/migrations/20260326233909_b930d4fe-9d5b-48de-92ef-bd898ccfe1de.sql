
DROP POLICY pol_pr_upd_operator ON purchase_requests;
CREATE POLICY pol_pr_upd_operator ON purchase_requests
  FOR UPDATE TO public
  USING (
    tenant_id = current_tenant_id()
    AND user_has_grant('manage_purchase_operations')
    AND status = ANY(ARRAY['approved','approved_finance','in_purchase'])
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND user_has_grant('manage_purchase_operations')
    AND status = ANY(ARRAY['approved','approved_finance','in_purchase','completed'])
  );
