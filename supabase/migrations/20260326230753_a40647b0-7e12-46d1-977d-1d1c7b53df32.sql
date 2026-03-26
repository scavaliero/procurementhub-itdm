INSERT INTO role_grants (role_id, grant_id)
SELECT r.id, g.id
FROM roles r, grants g
WHERE r.name = 'Amministratore Piattaforma'
  AND g.name = 'create_purchase_request'
ON CONFLICT DO NOTHING;