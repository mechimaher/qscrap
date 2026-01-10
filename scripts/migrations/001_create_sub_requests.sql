
-- Create Enum for request types and status if they don't exist
DO $$ BEGIN
    CREATE TYPE request_type_enum AS ENUM ('upgrade', 'downgrade', 'cancel');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE request_status_enum AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create subscription_change_requests table
CREATE TABLE IF NOT EXISTS subscription_change_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garage_id UUID NOT NULL REFERENCES garages(garage_id) ON DELETE CASCADE,
    from_plan_id UUID REFERENCES subscription_plans(plan_id),
    to_plan_id UUID NOT NULL REFERENCES subscription_plans(plan_id),
    request_type request_type_enum NOT NULL,
    status request_status_enum DEFAULT 'pending',
    request_reason TEXT,
    admin_notes TEXT,
    processed_by UUID REFERENCES users(user_id), -- Admin who processed it
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sub_requests_garage ON subscription_change_requests(garage_id);
CREATE INDEX IF NOT EXISTS idx_sub_requests_status ON subscription_change_requests(status);

-- Add locked_until to garage_subscriptions for contract enforcement
ALTER TABLE garage_subscriptions 
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;
