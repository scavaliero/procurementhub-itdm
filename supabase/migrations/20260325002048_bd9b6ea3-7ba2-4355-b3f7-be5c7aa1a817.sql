
-- Update RLS policy on bids to allow suppliers to withdraw their submitted bids
-- Current USING: supplier owns + status = 'draft'
-- Current WITH CHECK: supplier owns + status IN ('draft', 'submitted')
-- New: also allow updating from 'submitted' to 'withdrawn'

DROP POLICY IF EXISTS pol_bids_upd_self ON public.bids;

CREATE POLICY pol_bids_upd_self ON public.bids
  FOR UPDATE TO public
  USING (
    (supplier_id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid()))
    AND (status IN ('draft', 'submitted'))
  )
  WITH CHECK (
    (supplier_id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid()))
    AND (status IN ('draft', 'submitted', 'withdrawn'))
  );
