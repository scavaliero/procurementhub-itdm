
-- Table for supplier profile change requests
CREATE TABLE public.supplier_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  requested_by uuid NOT NULL REFERENCES public.profiles(id),
  requested_changes jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_change_requests ENABLE ROW LEVEL SECURITY;

-- Supplier can insert for their own supplier
CREATE POLICY pol_scr_ins ON public.supplier_change_requests FOR INSERT TO authenticated
  WITH CHECK (supplier_id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid()));

-- Supplier can see their own requests
CREATE POLICY pol_scr_self ON public.supplier_change_requests FOR SELECT TO authenticated
  USING (supplier_id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid()));

-- Internal users with manage_users can see all and update
CREATE POLICY pol_scr_int_sel ON public.supplier_change_requests FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND user_has_grant('manage_users'));

CREATE POLICY pol_scr_int_upd ON public.supplier_change_requests FOR UPDATE TO authenticated
  USING (user_has_grant('manage_users'));

-- updated_at trigger
CREATE TRIGGER trg_scr_updated_at BEFORE UPDATE ON public.supplier_change_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
