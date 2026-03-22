ALTER TABLE public.suppliers DROP CONSTRAINT suppliers_status_check;
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_status_check CHECK (status = ANY(ARRAY[
  'pre_registered','pending_review','enabled','in_accreditation','in_integration','in_approval','accredited','suspended','rejected','revoked','blacklisted','in_requalification'
]));