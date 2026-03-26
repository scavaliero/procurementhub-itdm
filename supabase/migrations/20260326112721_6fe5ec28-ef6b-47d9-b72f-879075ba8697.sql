ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status = ANY (ARRAY['draft','pending_approval','issued','accepted','rejected','active','in_progress','completed','cancelled','closed']));

-- Migrate existing orders that have billing approvals to in_progress
UPDATE orders SET status = 'in_progress', updated_at = NOW()
WHERE deleted_at IS NULL
  AND status IN ('issued','accepted')
  AND id IN (
    SELECT DISTINCT order_id FROM billing_approvals
    WHERE deleted_at IS NULL
      AND status IN ('pending_approval','approved','invoiced','closed')
  );