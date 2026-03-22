-- Clean all supplier-related data (correct order for FK constraints)
DELETE FROM supplier_status_history;
DELETE FROM supplier_categories;
DELETE FROM uploaded_documents;
DELETE FROM bids;
DELETE FROM opportunity_invitations WHERE supplier_id IN (SELECT id FROM suppliers);
DELETE FROM billing_approvals;
DELETE FROM contracts;
DELETE FROM orders;
DELETE FROM awards;

-- Delete notifications for supplier users
DELETE FROM notifications WHERE recipient_id IN (SELECT id FROM profiles WHERE supplier_id IS NOT NULL);

-- Delete audit logs referencing suppliers
DELETE FROM audit_logs WHERE entity_type = 'suppliers';

-- Delete user_grants for supplier users
DELETE FROM user_grants WHERE user_id IN (SELECT id FROM profiles WHERE supplier_id IS NOT NULL);

-- Delete supplier user roles
DELETE FROM user_roles WHERE user_id IN (SELECT id FROM profiles WHERE supplier_id IS NOT NULL);

-- Delete supplier profiles
DELETE FROM profiles WHERE supplier_id IS NOT NULL;

-- Delete suppliers
DELETE FROM suppliers;