-- Bucket purchase-invoices (Private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('purchase-invoices', 'purchase-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: solo l'operatore acquisti può caricare fatture
DROP POLICY IF EXISTS stor_invoices_ins ON storage.objects;
CREATE POLICY stor_invoices_ins ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'purchase-invoices'
    AND public.user_has_grant('manage_purchase_operations'));

-- Policy: operatore e finance possono scaricare le fatture
DROP POLICY IF EXISTS stor_invoices_sel ON storage.objects;
CREATE POLICY stor_invoices_sel ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'purchase-invoices'
    AND (public.user_has_grant('manage_purchase_operations')
         OR public.user_has_grant('validate_purchase_request_high')));