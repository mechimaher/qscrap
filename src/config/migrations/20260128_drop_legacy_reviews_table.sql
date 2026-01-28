-- Migration: Drop legacy 'reviews' table
-- Date: 2026-01-28
-- Reason: Legacy table with 0 rows. All reviews are in 'order_reviews' table (59 rows).
-- Safe to drop as no code references 'reviews' table.

-- Drop the legacy table (safe if already dropped)
DROP TABLE IF EXISTS reviews CASCADE;
