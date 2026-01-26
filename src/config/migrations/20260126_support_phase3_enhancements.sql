-- Phase 3: Multi-Party Support & Enhanced Ticketing System
-- Based on expert review recommendations

-- 1. Make tickets multi-party (not just customer)
DO $$
BEGIN
    -- Add requester columns
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'support_tickets' AND column_name = 'requester_id') THEN
        ALTER TABLE support_tickets ADD COLUMN requester_id UUID;
        ALTER TABLE support_tickets ADD COLUMN requester_type TEXT DEFAULT 'customer' 
            CHECK (requester_type IN ('customer', 'garage', 'driver', 'admin'));
        
        -- Backfill existing tickets
        UPDATE support_tickets SET 
            requester_id = customer_id,
            requester_type = 'customer'
        WHERE requester_id IS NULL;
        
        -- Now make NOT NULL
        ALTER TABLE support_tickets ALTER COLUMN requester_id SET NOT NULL;
        ALTER TABLE support_tickets ALTER COLUMN requester_type SET NOT NULL;
    END IF;
    
    -- Add categories
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'support_tickets' AND column_name = 'category') THEN
        ALTER TABLE support_tickets ADD COLUMN category TEXT DEFAULT 'general'
            CHECK (category IN ('delivery', 'part_quality', 'billing', 'bid_dispute', 'payout', 'account', 'other', 'general'));
        ALTER TABLE support_tickets ADD COLUMN subcategory TEXT;
    END IF;
    
    -- Add assigned_to for routing
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'support_tickets' AND column_name = 'assigned_to') THEN
        ALTER TABLE support_tickets ADD COLUMN assigned_to UUID; -- agent who's handling
    END IF;
END $$;

-- 2. Add internal notes flag to chat messages
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'chat_messages' AND column_name = 'is_internal') THEN
        ALTER TABLE chat_messages ADD COLUMN is_internal BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_support_tickets_requester ON support_tickets(requester_id, requester_type);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category) WHERE status IN ('open', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to) WHERE status IN ('open', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_chat_messages_internal ON chat_messages(ticket_id, is_internal);

-- 3. Canned Responses Table
CREATE TABLE IF NOT EXISTS canned_responses (
    response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message_text TEXT NOT NULL,
    category TEXT, -- matches ticket categories
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_canned_responses_category ON canned_responses(category) WHERE is_active = TRUE;

COMMENT ON TABLE canned_responses IS 'Pre-written responses for common support scenarios';

-- 4. Customer Credits Table (for goodwill credits)
CREATE TABLE IF NOT EXISTS customer_credits (
    credit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT NOT NULL,
    granted_by UUID, -- support agent
    ticket_id UUID,
    order_id UUID,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
    used_amount DECIMAL(10,2) DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_credits_customer ON customer_credits(customer_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_customer_credits_ticket ON customer_credits(ticket_id);

COMMENT ON TABLE customer_credits IS 'Goodwill credits granted to customers for service recovery';
