-- Helper: check if opportunity belongs to current tenant (bypasses RLS)
CREATE OR REPLACE FUNCTION public.opportunity_tenant_id(_opp_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.opportunities WHERE id = _opp_id LIMIT 1;
$$;

-- Helper: check if current user (supplier) is invited to an opportunity (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_invited_supplier(_opp_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.opportunity_invitations oi
    JOIN public.profiles p ON p.supplier_id = oi.supplier_id
    WHERE oi.opportunity_id = _opp_id AND p.id = _user_id
  );
$$;

-- Fix opportunities: replace inline profiles subquery with is_internal_user()
-- and replace invitation join with helper function
DROP POLICY IF EXISTS pol_opp_int ON public.opportunities;
CREATE POLICY pol_opp_int ON public.opportunities
FOR SELECT TO authenticated
USING (tenant_id = current_tenant_id() AND is_internal_user(auth.uid()));

DROP POLICY IF EXISTS pol_opp_sup ON public.opportunities;
CREATE POLICY pol_opp_sup ON public.opportunities
FOR SELECT TO authenticated
USING (
  status IN ('open','collecting_bids','evaluating','awarded','closed')
  AND is_invited_supplier(id, auth.uid())
);

-- Fix opportunity_invitations: replace opportunities join with helper function
-- and replace profiles subquery with is_internal_user()
DROP POLICY IF EXISTS pol_inv_sel_int ON public.opportunity_invitations;
CREATE POLICY pol_inv_sel_int ON public.opportunity_invitations
FOR SELECT TO authenticated
USING (
  opportunity_tenant_id(opportunity_id) = current_tenant_id()
  AND is_internal_user(auth.uid())
);

DROP POLICY IF EXISTS pol_inv_sel_self ON public.opportunity_invitations;
CREATE POLICY pol_inv_sel_self ON public.opportunity_invitations
FOR SELECT TO authenticated
USING (supplier_id = (SELECT p.supplier_id FROM public.profiles p WHERE p.id = auth.uid()));