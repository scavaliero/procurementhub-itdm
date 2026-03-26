CREATE OR REPLACE FUNCTION public.check_mandatory_docs(p_supplier_id uuid, p_category_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(document_type_id uuid, document_name text, reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN RETURN QUERY
  SELECT dt.id, dt.name,
    CASE WHEN ud.id IS NULL THEN 'non_caricato'
         WHEN ud.status = 'rejected' THEN 'respinto'
         WHEN ud.status = 'not_uploaded' THEN 'non_caricato'
         WHEN ud.expiry_date IS NOT NULL AND ud.expiry_date < CURRENT_DATE THEN 'scaduto'
         ELSE 'non_approvato' END AS reason
  FROM document_types dt
  LEFT JOIN LATERAL (
    SELECT ud2.* FROM uploaded_documents ud2
    WHERE ud2.supplier_id = p_supplier_id AND ud2.document_type_id = dt.id
      AND ud2.deleted_at IS NULL ORDER BY ud2.created_at DESC LIMIT 1) ud ON true
  WHERE dt.is_mandatory=true AND dt.is_active=true
    AND (dt.valid_until IS NULL OR dt.valid_until >= CURRENT_DATE)
    AND (dt.applies_to_categories IS NULL OR p_category_id IS NULL
         OR p_category_id = ANY(dt.applies_to_categories))
    AND (ud.id IS NULL OR ud.status NOT IN ('approved')
         OR (ud.expiry_date IS NOT NULL AND ud.expiry_date < CURRENT_DATE));
END; $function$;