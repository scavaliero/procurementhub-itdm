
-- Fix: opportunity_invitations publicly readable
DROP POLICY IF EXISTS pol_inv_sel ON public.opportunity_invitations;

-- Internal users can see invitations in their tenant
CREATE POLICY pol_inv_sel_int ON public.opportunity_invitations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_invitations.opportunity_id
        AND o.tenant_id = current_tenant_id()
    )
    AND (SELECT p.user_type FROM profiles p WHERE p.id = auth.uid()) = 'internal'
  );

-- Suppliers can see only their own invitations
CREATE POLICY pol_inv_sel_self ON public.opportunity_invitations
  FOR SELECT TO authenticated
  USING (
    supplier_id = (SELECT p.supplier_id FROM profiles p WHERE p.id = auth.uid())
  );
