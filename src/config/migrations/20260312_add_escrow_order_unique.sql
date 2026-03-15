-- Add uniqueness on escrow per order to prevent duplicates from webhook retries
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'escrow_transactions_order_unique') THEN
        ALTER TABLE escrow_transactions ADD CONSTRAINT escrow_transactions_order_unique UNIQUE (order_id);
    END IF;
END;
$$;
