
-- Allow billing_approvals status transition to 'invoiced' for approvers
-- Update existing RLS policies to include 'invoiced' in WITH CHECK

DROP POLICY IF EXISTS pol_ba_upd ON public.billing_approvals;
CREATE POLICY pol_ba_upd ON public.billing_approvals
  FOR UPDATE TO public
  USING (
    tenant_id = current_tenant_id()
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND status IN ('draft', 'pending_approval', 'approved', 'rejected', 'invoiced', 'closed')
  );

-- Allow orders with rejected status to be replaced by new orders
-- (no change needed - the existsForOpportunity check was client-side)
