-- Allow suppliers to update their own orders (accept/reject)
CREATE POLICY pol_ord_upd_self ON public.orders
  FOR UPDATE TO authenticated
  USING (
    supplier_id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid())
    AND status = 'issued'
  )
  WITH CHECK (
    supplier_id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid())
    AND status IN ('accepted', 'rejected')
  );