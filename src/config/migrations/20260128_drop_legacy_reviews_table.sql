-- Migration: Drop legacy 'reviews' table
-- Date: 2026-01-28
-- Reason: Legacy table with 0 rows. All reviews are in 'order_reviews' table (59 rows).
-- Safe to drop as no code references 'reviews' table.

-- First verify it's empty (safety check)
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM reviews) > 0 THEN
        RAISE EXCEPTION 'reviews table is not empty - aborting drop';
    END IF;
END $$;

-- Drop the legacy table
DROP TABLE IF EXISTS reviews CASCADE;

-- Log the change
INSERT INTO applied_migrations (migration_name) 
VALUES ('20260128_drop_legacy_reviews_table.sql')
ON CONFLICT (migration_name) DO NOTHING;
