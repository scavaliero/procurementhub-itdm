
DROP POLICY IF EXISTS pol_supstatus_sel ON public.supplier_status_history;

CREATE POLICY pol_supstatus_sel ON public.supplier_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.suppliers s
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE s.id = supplier_status_history.supplier_id
        AND (
          (p.user_type = 'internal' AND s.tenant_id = current_tenant_id())
          OR (p.supplier_id = s.id)
        )
    )
  );
