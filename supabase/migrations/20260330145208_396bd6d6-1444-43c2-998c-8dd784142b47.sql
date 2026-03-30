-- Table: purchase limits per role
CREATE TABLE public.purchase_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  max_approval_amount NUMERIC NOT NULL DEFAULT 0,
  max_annual_spend NUMERIC,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, role_id)
);

ALTER TABLE public.purchase_limits ENABLE ROW LEVEL SECURITY;

-- Only admins with manage_tenant_settings can manage purchase limits
CREATE POLICY "pol_plimits_sel"
  ON public.purchase_limits FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id() AND user_has_grant('manage_tenant_settings'));

CREATE POLICY "pol_plimits_ins"
  ON public.purchase_limits FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND user_has_grant('manage_tenant_settings'));

CREATE POLICY "pol_plimits_upd"
  ON public.purchase_limits FOR UPDATE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND user_has_grant('manage_tenant_settings'));

CREATE POLICY "pol_plimits_del"
  ON public.purchase_limits FOR DELETE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND user_has_grant('manage_tenant_settings'));

-- Also allow read access for validators/operators who need to check limits
CREATE POLICY "pol_plimits_sel_purchasing"
  ON public.purchase_limits FOR SELECT
  TO authenticated
  USING (
    tenant_id = current_tenant_id() 
    AND (
      user_has_grant('validate_purchase_request') 
      OR user_has_grant('validate_purchase_request_high') 
      OR user_has_grant('manage_purchase_operations')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_purchase_limits_updated_at
  BEFORE UPDATE ON public.purchase_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
