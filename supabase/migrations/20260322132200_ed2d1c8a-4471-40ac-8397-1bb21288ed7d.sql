-- Fix billing_approved with empty vars
UPDATE public.notifications SET 
  body = 'Il tuo benestare è stato approvato. Accedi alla piattaforma per i dettagli.'
WHERE event_type = 'billing_approved' AND body LIKE 'Benestare per EUR%';

-- Fix order_issued with generic fallback
UPDATE public.notifications SET 
  body = 'È stato emesso un nuovo ordine per la tua azienda. Accedi alla piattaforma per visualizzare i dettagli e accettare.'
WHERE event_type = 'order_issued' AND body = 'Ordine emesso. Visualizza e accetta';

-- Fix supplier_enabled with HTML in body
UPDATE public.notifications SET 
  body = REGEXP_REPLACE(
    REGEXP_REPLACE(body, '<[^>]+>', '', 'g'),
    'VendorHub!Gentile', 'VendorHub! Gentile', 'g'
  )
WHERE event_type = 'supplier_enabled' AND body LIKE '%<h2>%';

-- Fix "Gentile ," with empty name
UPDATE public.notifications SET 
  body = REGEXP_REPLACE(body, 'Gentile\s*,', 'Gentile utente,', 'g')
WHERE body LIKE '%Gentile ,%' OR body LIKE '%Gentile,%';

-- Fix pre_registration with empty name
UPDATE public.notifications SET 
  body = REGEXP_REPLACE(body, 'Gentile\s+,', 'Gentile utente,', 'g')
WHERE event_type = 'pre_registration' AND body LIKE '%Gentile ,%';