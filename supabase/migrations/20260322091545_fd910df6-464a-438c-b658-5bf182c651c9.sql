
-- Create supplier_contacts table
CREATE TABLE public.supplier_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  first_name TEXT NOT NULL,
  last_name TEXT,
  role TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;

-- Supplier can read/write their own contacts
CREATE POLICY "pol_supcontacts_self_sel" ON public.supplier_contacts
  FOR SELECT TO authenticated
  USING (supplier_id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "pol_supcontacts_self_ins" ON public.supplier_contacts
  FOR INSERT TO authenticated
  WITH CHECK (supplier_id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "pol_supcontacts_self_upd" ON public.supplier_contacts
  FOR UPDATE TO authenticated
  USING (supplier_id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "pol_supcontacts_self_del" ON public.supplier_contacts
  FOR DELETE TO authenticated
  USING (supplier_id = (SELECT profiles.supplier_id FROM profiles WHERE profiles.id = auth.uid()));

-- Internal users can read contacts
CREATE POLICY "pol_supcontacts_int_sel" ON public.supplier_contacts
  FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT profiles.user_type FROM profiles WHERE profiles.id = auth.uid()) = 'internal');

-- updated_at trigger
CREATE TRIGGER trg_supcontacts_updated_at
  BEFORE UPDATE ON public.supplier_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
