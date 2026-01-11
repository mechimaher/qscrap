-- Add part_category column to part_requests table
ALTER TABLE part_requests ADD COLUMN IF NOT EXISTS part_category VARCHAR(50);
