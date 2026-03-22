-- Cleanup malformed notifications
UPDATE public.notifications SET 
  title = 'Ordine accettato',
  body = 'Il fornitore ha accettato l''ordine.'
WHERE event_type = 'order_accepted' AND (title = 'Order Accepted' OR body = 'order_accepted');

UPDATE public.notifications SET 
  body = REPLACE(body, 'approvareÈ', 'approvare. È')
WHERE body LIKE '%approvareÈ%';

-- Clean notifications with unresolved empty variables
UPDATE public.notifications SET 
  body = REGEXP_REPLACE(
    REGEXP_REPLACE(body, 'Fornitore:\s*\n', '', 'g'),
    'Importo:\s*€\s*\n', '', 'g'
  )
WHERE body LIKE '%Fornitore: %' AND body LIKE '%Importo: €%' AND event_type = 'billing_pending_approval';

-- Clean opportunity invited with empty vars
UPDATE public.notifications SET 
  body = 'Sei stato invitato a partecipare a un''opportunità. Accedi alla piattaforma per i dettagli.'
WHERE event_type = 'opportunity_invited' AND body LIKE 'Invitati a .%';

UPDATE public.notifications SET
  title = 'Invito opportunità'
WHERE event_type = 'opportunity_invited' AND title = 'Invito opportunita';