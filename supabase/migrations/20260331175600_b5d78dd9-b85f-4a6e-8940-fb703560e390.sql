-- Allow unauthenticated (registration) users to read active categories
CREATE POLICY pol_cats_sel_anon ON public.categories
  FOR SELECT TO anon
  USING (is_active = true);