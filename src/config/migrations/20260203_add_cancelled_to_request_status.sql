-- Add 'cancelled' value to request_status_enum for subscription change requests
-- This allows garages to cancel their pending upgrade requests before admin approval

DO $$ 
BEGIN
    -- Add 'cancelled' to request_status_enum if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'request_status_enum'::regtype 
        AND enumlabel = 'cancelled'
    ) THEN
        ALTER TYPE request_status_enum ADD VALUE 'cancelled';
    END IF;
END $$;

COMMENT ON TYPE request_status_enum IS 'Status of subscription change requests: pending, approved, rejected, cancelled';
