-- ============================================
-- QScrap Migration: Add Review Moderation Columns
-- Run this migration to fix the review submission error
-- ============================================

-- Add moderation columns to order_reviews table
ALTER TABLE order_reviews 
ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'pending' 
    CHECK (moderation_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE order_reviews 
ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES users(user_id);

ALTER TABLE order_reviews 
ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP;

ALTER TABLE order_reviews 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Set existing reviews to approved (since they were submitted before moderation was added)
UPDATE order_reviews 
SET moderation_status = 'approved', is_visible = true 
WHERE moderation_status IS NULL OR moderation_status = 'pending';

-- Done!
SELECT 'Migration completed: order_reviews moderation columns added' as status;
