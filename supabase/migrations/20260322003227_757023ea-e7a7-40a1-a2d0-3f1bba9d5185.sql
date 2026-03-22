-- Allow supplier to update own status (enabled → in_accreditation only)
CREATE POLICY pol_sup_self_upd ON public.suppliers
  FOR UPDATE TO authenticated
  USING (
    id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid())
    AND status = 'enabled'
  )
  WITH CHECK (
    id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid())
    AND status = 'in_accreditation'
  );

-- Allow authenticated users to insert supplier_status_history for own supplier
CREATE POLICY pol_supstatus_ins ON public.supplier_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    supplier_id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid())
  );