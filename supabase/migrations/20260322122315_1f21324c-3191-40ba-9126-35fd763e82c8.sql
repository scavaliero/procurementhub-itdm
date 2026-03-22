
-- Fix variable name mismatches in email templates

-- billing_pending_approval: supplier_name → company_name
UPDATE email_templates SET
  html_body = '<h2>Nuovo benestare da approvare</h2><p>È stato creato un nuovo benestare <strong>{{billing_code}}</strong> in attesa della tua approvazione.</p><p>Fornitore: <strong>{{company_name}}</strong></p><p>Importo: € {{amount}}</p><p>Accedi alla piattaforma per approvare o rifiutare.</p>'
WHERE event_type = 'billing_pending_approval' AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- bid_submitted: supplier_name → company_name
UPDATE email_templates SET
  html_body = '<h2>Nuova offerta ricevuta</h2><p>È stata presentata una nuova offerta per l''opportunità <strong>{{opportunity_title}}</strong> ({{opportunity_code}}).</p><p>Fornitore: <strong>{{company_name}}</strong></p><p>Importo: € {{amount}}</p><p>Accedi alla piattaforma per visualizzare i dettagli.</p>'
WHERE event_type = 'bid_submitted' AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- order_accepted: supplier_name → company_name
UPDATE email_templates SET
  html_body = '<h2>Ordine accettato dal fornitore</h2><p>Il fornitore <strong>{{company_name}}</strong> ha accettato l''ordine <strong>{{order_code}}</strong>.</p><p>Oggetto: {{subject}}</p><p>L''esecuzione delle attività può procedere come da contratto.</p>',
  subject = 'Ordine accettato — {{order_code}}'
WHERE event_type = 'order_accepted' AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- order_rejected: supplier_name → company_name, add reason
UPDATE email_templates SET
  html_body = '<h2>Ordine rifiutato dal fornitore</h2><p>Il fornitore <strong>{{company_name}}</strong> ha rifiutato l''ordine <strong>{{order_code}}</strong>.</p><p>Oggetto: {{subject}}</p><p>Motivazione: {{reason}}</p><p>Accedi alla piattaforma per gestire la situazione.</p>',
  subject = 'Ordine rifiutato — {{order_code}}'
WHERE event_type = 'order_rejected' AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- opportunity_invited: deadline → bids_deadline, opportunity_url removed
UPDATE email_templates SET
  html_body = '<h2>Invito a partecipare</h2><p>Sei stato invitato a presentare un''offerta per l''opportunità <strong>{{opportunity_title}}</strong> ({{opportunity_code}}).</p><p>Scadenza presentazione offerte: <strong>{{bids_deadline}}</strong></p><p>Accedi alla piattaforma per visualizzare i dettagli e presentare la tua offerta.</p>',
  subject = 'Invito opportunità — {{opportunity_title}}'
WHERE event_type = 'opportunity_invited' AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- order_issued: add subject, amount, company_name placeholders
UPDATE email_templates SET
  html_body = '<h2>Nuovo ordine emesso</h2><p>È stato emesso un nuovo ordine <strong>{{order_code}}</strong> per la tua azienda.</p><p>Oggetto: {{subject}}</p><p>Importo: € {{amount}}</p><p>Accedi alla piattaforma per visualizzare i dettagli e accettare l''ordine.</p>',
  subject = 'Nuovo ordine — {{order_code}}'
WHERE event_type = 'order_issued' AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- billing_approved: add company_name
UPDATE email_templates SET
  html_body = '<h2>Benestare approvato</h2><p>Il benestare <strong>{{billing_code}}</strong> è stato approvato.</p><p>Importo: € {{amount}}</p><p>Accedi alla piattaforma per i dettagli.</p>',
  subject = 'Benestare approvato — {{billing_code}}'
WHERE event_type = 'billing_approved' AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- billing_rejected: add reason placeholder
UPDATE email_templates SET
  html_body = '<h2>Benestare rifiutato</h2><p>Il benestare <strong>{{billing_code}}</strong> è stato rifiutato.</p><p>Importo: € {{amount}}</p><p>Motivazione: {{reason}}</p><p>Accedi alla piattaforma per visualizzare le motivazioni e, se necessario, presentare una nuova richiesta.</p>',
  subject = 'Benestare rifiutato — {{billing_code}}'
WHERE event_type = 'billing_rejected' AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- opportunity_awarded: add is_winner conditional text
UPDATE email_templates SET
  html_body = '<h2>Esito opportunità</h2><p>L''opportunità <strong>{{opportunity_title}}</strong> ({{opportunity_code}}) è stata aggiudicata.</p><p>Accedi alla piattaforma per visualizzare i dettagli dell''esito.</p>',
  subject = 'Esito opportunità — {{opportunity_title}}'
WHERE event_type = 'opportunity_awarded' AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- document_expiring: remove portal_url dependency
UPDATE email_templates SET
  html_body = '<h2>Documento in scadenza</h2><p>Il documento <strong>{{document_name}}</strong> scadrà il <strong>{{expiry_date}}</strong>.</p><p>Carica una nuova versione prima della scadenza per mantenere attivo il tuo accreditamento.</p>'
WHERE event_type = 'document_expiring' AND tenant_id = '00000000-0000-0000-0000-000000000001';
