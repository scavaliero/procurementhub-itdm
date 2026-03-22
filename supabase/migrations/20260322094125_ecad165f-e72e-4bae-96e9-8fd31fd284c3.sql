-- Allow suppliers to update their own contracts (activate when accepting order)
CREATE POLICY pol_con_upd_self ON public.contracts
  FOR UPDATE TO authenticated
  USING (
    supplier_id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid())
  )
  WITH CHECK (
    supplier_id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid())
    AND status IN ('active', 'planned')
  );