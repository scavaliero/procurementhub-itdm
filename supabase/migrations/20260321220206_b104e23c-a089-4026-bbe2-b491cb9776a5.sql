
-- Allow evaluators to insert bid evaluations
CREATE POLICY pol_eval_ins ON public.bid_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (user_has_grant('evaluate_bids'::text));

-- Allow evaluators to update bid evaluations
CREATE POLICY pol_eval_upd ON public.bid_evaluations
  FOR UPDATE TO authenticated
  USING (user_has_grant('evaluate_bids'::text));

-- Allow evaluators to insert awards
CREATE POLICY pol_awards_ins ON public.awards
  FOR INSERT TO authenticated
  WITH CHECK (user_has_grant('evaluate_bids'::text));

-- Allow evaluators to update awards
CREATE POLICY pol_awards_upd ON public.awards
  FOR UPDATE TO authenticated
  USING (user_has_grant('evaluate_bids'::text));
