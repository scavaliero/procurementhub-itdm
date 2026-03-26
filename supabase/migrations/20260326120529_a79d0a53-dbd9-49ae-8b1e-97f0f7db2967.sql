ALTER TABLE public.opportunities 
  ADD COLUMN IF NOT EXISTS require_technical_offer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_economic_offer boolean NOT NULL DEFAULT true;