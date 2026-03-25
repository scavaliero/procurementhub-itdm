
-- Table to track typed bid attachments (technical offer, economic offer)
CREATE TABLE public.bid_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bid_id UUID REFERENCES public.bids(id) ON DELETE CASCADE NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  attachment_type TEXT NOT NULL CHECK (attachment_type IN ('technical_offer', 'economic_offer')),
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS
ALTER TABLE public.bid_attachments ENABLE ROW LEVEL SECURITY;

-- Suppliers can insert their own
CREATE POLICY pol_bidatt_ins ON public.bid_attachments
  FOR INSERT TO authenticated
  WITH CHECK (supplier_id = (SELECT p.supplier_id FROM profiles p WHERE p.id = auth.uid()));

-- Suppliers can see their own
CREATE POLICY pol_bidatt_self ON public.bid_attachments
  FOR SELECT TO authenticated
  USING (supplier_id = (SELECT p.supplier_id FROM profiles p WHERE p.id = auth.uid()));

-- Internal users with view_bids can see all
CREATE POLICY pol_bidatt_int ON public.bid_attachments
  FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND user_has_grant('view_bids'));

-- Suppliers can delete their own (only draft bids)
CREATE POLICY pol_bidatt_del ON public.bid_attachments
  FOR DELETE TO authenticated
  USING (
    supplier_id = (SELECT p.supplier_id FROM profiles p WHERE p.id = auth.uid())
    AND bid_id IN (SELECT b.id FROM bids b WHERE b.status = 'draft')
  );
