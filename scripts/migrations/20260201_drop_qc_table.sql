-- Migration: Drop quality_inspections table
-- 2026-02-01: QC workflow has been cancelled
-- This table is orphaned and contains 0 rows in production

-- Drop quality_inspections table (QC workflow cancelled)
DROP TABLE IF EXISTS quality_inspections CASCADE;

-- Update drop_orphan_tables migration to mark this as already handled
-- (inspection_criteria was already in the list)
