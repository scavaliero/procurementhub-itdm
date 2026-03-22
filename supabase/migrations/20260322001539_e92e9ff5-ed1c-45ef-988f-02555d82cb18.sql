CREATE POLICY pol_tenants_anon_sel ON public.tenants
  FOR SELECT
  TO anon
  USING (is_active = true);