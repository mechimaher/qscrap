-- Add resolved_by and resolved_at columns to garage_payouts table

DO $$ 
BEGIN 
    -- Add resolved_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'garage_payouts' AND column_name = 'resolved_by') THEN
        ALTER TABLE garage_payouts ADD COLUMN resolved_by UUID REFERENCES users(user_id);
    END IF;

    -- Add resolved_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'garage_payouts' AND column_name = 'resolved_at') THEN
        ALTER TABLE garage_payouts ADD COLUMN resolved_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;
