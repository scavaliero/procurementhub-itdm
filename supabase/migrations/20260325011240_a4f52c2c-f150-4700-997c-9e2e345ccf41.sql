
-- Drop the existing unique constraint that prevents re-submission after withdrawal
ALTER TABLE public.bids DROP CONSTRAINT IF EXISTS bids_opportunity_id_supplier_id_key;

-- Create a partial unique index: only one active (non-withdrawn, non-deleted) bid per supplier per opportunity
CREATE UNIQUE INDEX bids_active_opportunity_supplier_key 
ON public.bids (opportunity_id, supplier_id) 
WHERE status NOT IN ('withdrawn') AND deleted_at IS NULL;
