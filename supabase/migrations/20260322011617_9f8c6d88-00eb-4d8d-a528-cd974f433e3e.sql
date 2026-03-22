INSERT INTO email_templates (tenant_id, event_type, subject, html_body, text_body, variables)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'supplier_enabled',
  'Account abilitato — {{company_name}}',
  '<h2>Benvenuto su VendorHub!</h2><p>Gentile {{contact_name}},</p><p>La registrazione della vostra azienda <strong>{{company_name}}</strong> è stata approvata dall''amministratore.</p><p>Potete ora accedere al portale con le credenziali utilizzate in fase di registrazione e procedere con il processo di accreditamento.</p><p><a href="{{login_url}}">Accedi al portale</a></p><p>Cordiali saluti,<br/>Il team VendorHub</p>',
  'La registrazione della vostra azienda {{company_name}} è stata approvata. Accedete al portale per procedere con l''accreditamento.',
  '[{"key": "company_name", "label": "Ragione sociale"}, {"key": "contact_name", "label": "Nome referente"}, {"key": "login_url", "label": "URL login"}]'
);