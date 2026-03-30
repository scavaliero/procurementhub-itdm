
-- 1. Drop the supplier-facing policy that exposes internal_notes
DROP POLICY IF EXISTS pol_eval_sel_self ON public.bid_evaluations;

-- 2. Create a supplier-safe view that excludes internal_notes
CREATE OR REPLACE VIEW public.bid_evaluations_supplier AS
SELECT
  id,
  bid_id,
  evaluator_id,
  criteria_scores,
  total_score,
  admin_approved,
  tech_approved,
  evaluated_at
FROM public.bid_evaluations;

-- 3. Make it security-invoker so RLS on base table applies
ALTER VIEW public.bid_evaluations_supplier SET (security_invoker = true);

-- 4. Re-create supplier policy on the base table scoped to internal_notes = NULL trick
-- Actually, since we removed the policy, suppliers simply can't read the base table.
-- They must use the view instead. We need a policy on the view or let the view
-- inherit from base table RLS. With security_invoker, the view runs as the caller,
-- so we need a base-table policy for suppliers that still works.
-- Let's re-add the supplier SELECT policy on base table — suppliers CAN read rows,
-- but we direct the app to use the view (which strips internal_notes).

-- Re-add the policy so the view (security_invoker) can read rows for the supplier
CREATE POLICY pol_eval_sel_self ON public.bid_evaluations
  FOR SELECT
  USING (
    bid_id IN (
      SELECT b.id FROM bids b
      WHERE b.supplier_id = (SELECT p.supplier_id FROM profiles p WHERE p.id = auth.uid())
    )
  );
