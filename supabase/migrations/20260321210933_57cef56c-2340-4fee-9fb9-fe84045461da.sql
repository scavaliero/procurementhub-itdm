
-- email_templates: RLS era già abilitato nel blocco 6? No, mancava. Abilitiamo.
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
