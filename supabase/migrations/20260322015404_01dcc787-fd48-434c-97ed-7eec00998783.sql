-- Allow internal users to insert supplier_status_history (needed for admin status changes)
CREATE POLICY pol_supstatus_ins_internal ON public.supplier_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT profiles.user_type FROM profiles WHERE profiles.id = auth.uid()) = 'internal'
  );

-- Allow internal users to update supplier_categories (needed for admin approval of categories)  
CREATE POLICY pol_supcat_upd_internal ON public.supplier_categories
  FOR UPDATE TO authenticated
  USING (
    (SELECT profiles.user_type FROM profiles WHERE profiles.id = auth.uid()) = 'internal'
  );