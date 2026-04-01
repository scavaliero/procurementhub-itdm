-- Fix RLS policies for purchase_requests: allow reject transition
-- The manager policy (submitted) and finance policy (pending_validation) 
-- need WITH CHECK that allows setting status to 'rejected'

DROP POLICY IF EXISTS pol_pr_upd_manager ON public.purchase_requests;
CREATE POLICY pol_pr_upd_manager ON public.purchase_requests
  FOR UPDATE TO public
  USING (
    tenant_id = current_tenant_id()
    AND user_has_grant('validate_purchase_request')
    AND status = 'submitted'
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND user_has_grant('validate_purchase_request')
    AND status IN ('submitted', 'approved', 'pending_validation', 'rejected')
  );

DROP POLICY IF EXISTS pol_pr_upd_finance ON public.purchase_requests;
CREATE POLICY pol_pr_upd_finance ON public.purchase_requests
  FOR UPDATE TO public
  USING (
    tenant_id = current_tenant_id()
    AND user_has_grant('validate_purchase_request_high')
    AND status = 'pending_validation'
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND user_has_grant('validate_purchase_request_high')
    AND status IN ('pending_validation', 'approved_finance', 'rejected')
  );