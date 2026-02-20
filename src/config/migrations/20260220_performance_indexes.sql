-- QScrap Performance Optimization Indexes
-- This migration adds critical indexes for production performance.
-- Most indexes are already present in the production schema, so we only add IF NOT EXISTS
-- for safety and future compatibility.

-- Note: payment_transactions table is not present in some environments, 
-- we use payment_intents instead if needed (already indexed).

-- Garages optimization for location-based searches if not already present
-- (approval_status and rating_average are already covered by idx_garages_approved)

-- Bids optimization
CREATE INDEX IF NOT EXISTS idx_bids_request_id_status ON public.bids(request_id, status);

-- Notifications optimization
-- (user_id and is_read are already covered by idx_notifications_user_unread)
