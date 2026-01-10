-- Add next_plan_id column if it doesn't exist
ALTER TABLE garage_subscriptions 
ADD COLUMN IF NOT EXISTS next_plan_id UUID REFERENCES subscription_plans(plan_id);

-- Add index just in case
CREATE INDEX IF NOT EXISTS idx_garage_subs_next_plan ON garage_subscriptions(next_plan_id);
