-- Fix supplier self-update: allow updating own data while in 'enabled' status
-- The current WITH CHECK only allows status='in_accreditation', blocking data edits
DROP POLICY IF EXISTS pol_sup_self_upd ON suppliers;
CREATE POLICY pol_sup_self_upd ON suppliers
  FOR UPDATE TO authenticated
  USING (
    id = (SELECT supplier_id FROM profiles WHERE id = auth.uid())
    AND status IN ('enabled', 'in_accreditation', 'pending_review')
  )
  WITH CHECK (
    id = (SELECT supplier_id FROM profiles WHERE id = auth.uid())
    AND status IN ('enabled', 'in_accreditation', 'pending_review')
  );

-- Allow suppliers to manage their own categories during onboarding
CREATE POLICY pol_supcat_self_ins ON supplier_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    supplier_id = (SELECT supplier_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY pol_supcat_self_del ON supplier_categories
  FOR DELETE TO authenticated
  USING (
    supplier_id = (SELECT supplier_id FROM profiles WHERE id = auth.uid())
  );