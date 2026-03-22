-- Allow authenticated users to insert their own profile (registration flow)
CREATE POLICY pol_profiles_self_ins ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());