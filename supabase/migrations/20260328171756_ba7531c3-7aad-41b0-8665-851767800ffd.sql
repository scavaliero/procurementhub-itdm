
-- ============================================================
-- FIX 1: bid_evaluations - replace public SELECT with scoped policies
-- ============================================================
DROP POLICY IF EXISTS pol_eval_sel ON public.bid_evaluations;

-- Internal users with evaluate_bids grant can see evaluations in their tenant
CREATE POLICY pol_eval_sel_int ON public.bid_evaluations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bids b
      WHERE b.id = bid_evaluations.bid_id
        AND b.tenant_id = current_tenant_id()
    )
    AND user_has_grant('evaluate_bids')
  );

-- Suppliers can see evaluations of their own bids
CREATE POLICY pol_eval_sel_self ON public.bid_evaluations
  FOR SELECT TO authenticated
  USING (
    bid_id IN (
      SELECT b.id FROM bids b
      WHERE b.supplier_id = (SELECT p.supplier_id FROM profiles p WHERE p.id = auth.uid())
    )
  );

-- ============================================================
-- FIX 2: awards - replace public SELECT with scoped policies
-- ============================================================
DROP POLICY IF EXISTS pol_awards_sel ON public.awards;

-- Internal users can see awards in their tenant
CREATE POLICY pol_awards_sel_int ON public.awards
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = awards.opportunity_id
        AND o.tenant_id = current_tenant_id()
    )
    AND (
      (SELECT p.user_type FROM profiles p WHERE p.id = auth.uid()) = 'internal'
    )
  );

-- Suppliers can see awards where they are the supplier
CREATE POLICY pol_awards_sel_self ON public.awards
  FOR SELECT TO authenticated
  USING (
    supplier_id = (SELECT p.supplier_id FROM profiles p WHERE p.id = auth.uid())
  );

-- ============================================================
-- FIX 3: profiles - restrict tenant-wide reads to internal users only
-- ============================================================
DROP POLICY IF EXISTS pol_profiles_sel ON public.profiles;

-- Users can always read their own profile
CREATE POLICY pol_profiles_sel_self ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Internal users can read all profiles in their tenant
CREATE POLICY pol_profiles_sel_int ON public.profiles
  FOR SELECT TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (SELECT p.user_type FROM profiles p WHERE p.id = auth.uid()) = 'internal'
  );

-- ============================================================
-- FIX 4: user_roles - restrict self-insert to only during registration
-- (user must not already have any roles assigned)
-- ============================================================
DROP POLICY IF EXISTS pol_user_roles_self_ins ON public.user_roles;

CREATE POLICY pol_user_roles_self_ins ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role_id IN (
      SELECT r.id FROM roles r WHERE r.name = 'Fornitore' AND r.is_system = true
    )
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()
    )
  );
