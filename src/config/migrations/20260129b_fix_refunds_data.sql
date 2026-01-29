-- 20260129_fix_refunds_data.sql
-- Fix data where refund_amount is 0 but original_amount has correct value

-- Check if refund_amount is 0 or NULL but original_amount has data, copy it
UPDATE refunds 
SET refund_amount = original_amount 
WHERE (refund_amount IS NULL OR refund_amount = 0) 
AND original_amount IS NOT NULL 
AND original_amount > 0;

-- Also check if refund_reason looks like a currency value (data swap issue)
-- If refund_reason contains only numbers and commas, it's likely the amount value
-- First, let's see what we have and handle the case where reason has the amount
UPDATE refunds
SET refund_amount = CAST(REPLACE(REPLACE(refund_reason, ',', ''), ' QAR', '') AS DECIMAL(10,2)),
    refund_reason = 'Customer refund request'
WHERE refund_reason ~ '^[0-9,]+(\s?QAR)?$'
AND (refund_amount IS NULL OR refund_amount = 0);

SELECT 'Refunds data fix completed' as status;
