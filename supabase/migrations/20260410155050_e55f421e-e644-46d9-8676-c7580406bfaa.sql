
CREATE OR REPLACE FUNCTION public.validate_document_expiry_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'La data di scadenza non può essere precedente alla data odierna';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_document_expiry
BEFORE INSERT OR UPDATE ON public.uploaded_documents
FOR EACH ROW
EXECUTE FUNCTION public.validate_document_expiry_date();
