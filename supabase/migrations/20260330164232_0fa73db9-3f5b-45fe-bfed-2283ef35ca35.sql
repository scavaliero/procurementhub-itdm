
CREATE OR REPLACE VIEW public.user_effective_grants
WITH (security_invoker = true) AS
SELECT DISTINCT ur.user_id,
    g.name AS grant_name,
    'role'::text AS source
FROM user_roles ur
JOIN role_grants rg ON rg.role_id = ur.role_id
JOIN grants g ON g.id = rg.grant_id
JOIN roles r ON r.id = ur.role_id
WHERE r.is_active = true
  AND ur.user_id = auth.uid()
UNION
SELECT ug.user_id,
    g.name AS grant_name,
    'direct'::text AS source
FROM user_grants ug
JOIN grants g ON g.id = ug.grant_id
WHERE (ug.expires_at IS NULL OR ug.expires_at > now())
  AND ug.user_id = auth.uid();
