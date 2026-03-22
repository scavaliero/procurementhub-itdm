
DROP POLICY IF EXISTS pol_bids_upd_self ON public.bids;

CREATE POLICY pol_bids_upd_self ON public.bids
  FOR UPDATE TO public
  USING (
    (supplier_id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid()))
    AND (status = 'draft')
  )
  WITH CHECK (
    (supplier_id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid()))
    AND (status IN ('draft', 'submitted'))
  );
