-- Migration: Add part_subcategory column to part_requests table
-- This column stores the subcategory for parts (e.g., Engine > Pistons)

ALTER TABLE part_requests 
ADD COLUMN IF NOT EXISTS part_subcategory VARCHAR(100);

-- Create index for faster filtering by category + subcategory
CREATE INDEX IF NOT EXISTS idx_part_requests_subcategory 
ON part_requests(part_category, part_subcategory) 
WHERE part_subcategory IS NOT NULL;

COMMENT ON COLUMN part_requests.part_subcategory IS 'Subcategory of the part (e.g., Pistons under Engine category)';
