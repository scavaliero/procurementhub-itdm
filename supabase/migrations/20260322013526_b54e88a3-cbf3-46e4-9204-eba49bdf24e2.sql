DROP POLICY IF EXISTS pol_sup_self_upd ON public.suppliers;
CREATE POLICY pol_sup_self_upd ON public.suppliers
  FOR UPDATE TO authenticated
  USING (
    id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid())
    AND status = ANY(ARRAY['pre_registered','enabled','in_accreditation','pending_review'])
  )
  WITH CHECK (
    id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid())
    AND status = ANY(ARRAY['pre_registered','enabled','in_accreditation','pending_review'])
  );