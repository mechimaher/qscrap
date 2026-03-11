-- Add uniqueness on escrow per order to prevent duplicates from webhook retries
ALTER TABLE escrow_transactions
    ADD CONSTRAINT IF NOT EXISTS escrow_transactions_order_unique UNIQUE (order_id);
