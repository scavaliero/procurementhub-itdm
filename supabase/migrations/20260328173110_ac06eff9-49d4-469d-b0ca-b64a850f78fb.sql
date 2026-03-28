
-- ============================================================
-- FIX 1: Auto-log supplier status changes via trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_supplier_status_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO supplier_status_history (supplier_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_supplier_status_change
  AFTER UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.log_supplier_status_change();

-- Drop the supplier self-insert policy (trigger handles it now)
DROP POLICY IF EXISTS pol_supstatus_ins ON public.supplier_status_history;

-- ============================================================
-- FIX 2: Restrict grants and role_grants SELECT to authenticated
-- ============================================================
DROP POLICY IF EXISTS pol_grants_sel ON public.grants;
CREATE POLICY pol_grants_sel ON public.grants
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS pol_role_grants_sel ON public.role_grants;
CREATE POLICY pol_role_grants_sel ON public.role_grants
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- FIX 3: Restrict supplier_categories SELECT to authenticated + tenant
-- ============================================================
DROP POLICY IF EXISTS pol_supcat_sel ON public.supplier_categories;
CREATE POLICY pol_supcat_sel ON public.supplier_categories
  FOR SELECT TO authenticated
  USING (
    supplier_id IN (
      SELECT s.id FROM suppliers s WHERE s.tenant_id = current_tenant_id()
    )
  );

-- ============================================================
-- FIX 4: Secure audit_logs INSERT via SECURITY DEFINER function
-- ============================================================
DROP POLICY IF EXISTS pol_audit_ins ON public.audit_logs;

CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_tenant_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_event_type text,
  p_old_state jsonb DEFAULT NULL,
  p_new_state jsonb DEFAULT NULL
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_role text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email, user_type INTO v_email, v_role
  FROM profiles WHERE id = v_user_id;

  -- Verify the caller belongs to this tenant
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  INSERT INTO audit_logs (tenant_id, entity_type, entity_id, event_type, user_id, user_email, user_role, old_state, new_state)
  VALUES (p_tenant_id, p_entity_type, p_entity_id::uuid, p_event_type, v_user_id, v_email, v_role, p_old_state, p_new_state);
END;
$$;
