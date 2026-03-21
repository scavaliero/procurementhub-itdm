
CREATE POLICY pol_inv_ins ON public.opportunity_invitations
  FOR INSERT TO authenticated
  WITH CHECK (user_has_grant('invite_suppliers'::text));

CREATE POLICY pol_inv_upd ON public.opportunity_invitations
  FOR UPDATE TO authenticated
  USING (user_has_grant('invite_suppliers'::text));

CREATE POLICY pol_audit_ins ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY pol_inv_upd_self ON public.opportunity_invitations
  FOR UPDATE TO authenticated
  USING (
    supplier_id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid())
  );
