-- Ad Marketplace & Monetization System
-- Purpose: Enable garages to promote listings via sponsored placements

-- 1. Create ad_campaigns table
CREATE TABLE IF NOT EXISTS ad_campaigns (
    campaign_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garage_id UUID REFERENCES garages(garage_id) ON DELETE CASCADE,
    campaign_name VARCHAR(100) NOT NULL,
    campaign_type VARCHAR(20) NOT NULL CHECK (campaign_type IN ('sponsored_listing', 'banner', 'featured', 'priority')),
    
    -- Budget & Scheduling
    budget_qar DECIMAL(10,2) NOT NULL CHECK (budget_qar > 0),
    daily_limit_qar DECIMAL(10,2),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Status & Performance
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'completed', 'rejected')),
    spent_amount DECIMAL(10,2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0, -- Number of resulting bids/orders
    
    -- Targeting
    target_categories TEXT[], -- Array of part categories
    target_brands TEXT[], -- Array of car brands
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(user_id),
    
    CONSTRAINT valid_date_range CHECK (end_date >= start_date),
    CONSTRAINT valid_budget CHECK (daily_limit_qar IS NULL OR daily_limit_qar <= budget_qar)
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_garage ON ad_campaigns(garage_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON ad_campaigns(status, start_date);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_active ON ad_campaigns(status, start_date, end_date) 
    WHERE status = 'active';

-- 2. Create ad_placements table (specific ad slots)
CREATE TABLE IF NOT EXISTS ad_placements (
    placement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES ad_campaigns(campaign_id) ON DELETE CASCADE,
    
    placement_type VARCHAR(50) NOT NULL CHECK (placement_type IN (
        'search_top', 'search_sidebar', 'category_banner', 
        'homepage_featured', 'request_detail_banner'
    )),
    
    -- Display settings
    position INTEGER DEFAULT 1, -- Position within the placement type
    priority INTEGER DEFAULT 0, -- Higher priority = shown first
    active BOOLEAN DEFAULT true,
    
    -- Content
    banner_image_url TEXT, -- For banner ads
    banner_title VARCHAR(100),
    banner_description TEXT,
    cta_text VARCHAR(30), -- Call to action text
    cta_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_placements_campaign ON ad_placements(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_placements_type ON ad_placements(placement_type, active);

-- 3. Create ad_impressions table (tracking)
CREATE TABLE IF NOT EXISTS ad_impressions (
    impression_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES ad_campaigns(campaign_id) ON DELETE CASCADE,
    placement_id UUID REFERENCES ad_placements(placement_id) ON DELETE SET NULL,
    
    -- User context
    customer_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    
    -- Interaction
    impression_type VARCHAR(20) DEFAULT 'view' CHECK (impression_type IN ('view', 'click', 'conversion')),
    
    -- Metadata
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    session_id UUID -- For tracking user sessions
);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_campaign ON ad_impressions(campaign_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_type ON ad_impressions(impression_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_date ON ad_impressions(DATE(timestamp));

-- 4. Create ad_pricing table (reference data for cost per action)
CREATE TABLE IF NOT EXISTS ad_pricing (
    pricing_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_type VARCHAR(20) UNIQUE NOT NULL,
    cost_per_impression DECIMAL(6,4) DEFAULT 0.50, -- QAR per 1000 impressions
    cost_per_click DECIMAL(6,2) DEFAULT 2.00, -- QAR per click
    cost_per_conversion DECIMAL(6,2) DEFAULT 10.00, -- QAR per conversion
    min_daily_budget DECIMAL(8,2) DEFAULT 50.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default pricing
INSERT INTO ad_pricing (campaign_type, cost_per_impression, cost_per_click, cost_per_conversion, min_daily_budget) VALUES
('sponsored_listing', 0.50, 2.00, 10.00, 50.00),
('banner', 0.75, 3.00, 15.00, 100.00),
('featured', 1.00, 5.00, 20.00, 150.00),
('priority', 0.30, 1.50, 8.00, 30.00)
ON CONFLICT (campaign_type) DO NOTHING;

-- 5. Create function to record impression/click
CREATE OR REPLACE FUNCTION record_ad_interaction(
    p_campaign_id UUID,
    p_placement_id UUID,
    p_customer_id UUID,
    p_ip_address INET,
    p_interaction_type VARCHAR(20),
    p_session_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_impression_id UUID;
    v_cost DECIMAL(6,2);
    v_campaign_type VARCHAR(20);
BEGIN
    -- Record impression
    INSERT INTO ad_impressions (
        campaign_id, placement_id, customer_id, 
        ip_address, impression_type, session_id
    ) VALUES (
        p_campaign_id, p_placement_id, p_customer_id,
        p_ip_address, p_interaction_type, p_session_id
    ) RETURNING impression_id INTO v_impression_id;
    
    -- Update campaign counters and spend
    SELECT campaign_type INTO v_campaign_type
    FROM ad_campaigns WHERE campaign_id = p_campaign_id;
    
    -- Calculate cost based on interaction type
    IF p_interaction_type = 'view' THEN
        SELECT cost_per_impression / 1000 INTO v_cost
        FROM ad_pricing WHERE campaign_type = v_campaign_type;
    ELSIF p_interaction_type = 'click' THEN
        SELECT cost_per_click INTO v_cost
        FROM ad_pricing WHERE campaign_type = v_campaign_type;
        
        UPDATE ad_campaigns
        SET clicks = clicks + 1,
            spent_amount = spent_amount + v_cost,
            impressions = impressions + 1
        WHERE campaign_id = p_campaign_id;
    ELSIF p_interaction_type = 'conversion' THEN
        SELECT cost_per_conversion INTO v_cost
        FROM ad_pricing WHERE campaign_type = v_campaign_type;
        
        UPDATE ad_campaigns
        SET conversions = conversions + 1,
            spent_amount = spent_amount + v_cost
        WHERE campaign_id = p_campaign_id;
    ELSE
        -- Just view impression
        UPDATE ad_campaigns
        SET impressions = impressions + 1,
            spent_amount = spent_amount + COALESCE(v_cost, 0)
        WHERE campaign_id = p_campaign_id;
    END IF;
    
    RETURN v_impression_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Create function to get active ads for placement
CREATE OR REPLACE FUNCTION get_active_ads_for_placement(
    p_placement_type VARCHAR(50),
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    campaign_id UUID,
    placement_id UUID,
    garage_id UUID,
    garage_name VARCHAR,
    placement_type VARCHAR,
    banner_image_url TEXT,
    banner_title VARCHAR,
    banner_description TEXT,
    cta_text VARCHAR,
    priority INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.campaign_id,
        p.placement_id,
        c.garage_id,
        g.garage_name,
        p.placement_type,
        p.banner_image_url,
        p.banner_title,
        p.banner_description,
        p.cta_text,
        p.priority
    FROM ad_campaigns c
    JOIN ad_placements p ON c.campaign_id = p.campaign_id
    JOIN garages g ON c.garage_id = g.garage_id
    WHERE c.status = 'active'
      AND p.placement_type = p_placement_type
      AND p.active = true
      AND CURRENT_DATE BETWEEN c.start_date AND c.end_date
      AND (c.daily_limit_qar IS NULL OR c.spent_amount < c.budget_qar)
    ORDER BY p.priority DESC, RANDOM()
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to check daily budget limit
CREATE OR REPLACE FUNCTION check_daily_budget_exceeded(p_campaign_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_daily_limit DECIMAL(10,2);
    v_today_spend DECIMAL(10,2);
BEGIN
    SELECT daily_limit_qar INTO v_daily_limit
    FROM ad_campaigns
    WHERE campaign_id = p_campaign_id;
    
    IF v_daily_limit IS NULL THEN
        RETURN false;
    END IF;
    
    SELECT COALESCE(SUM(
        CASE 
            WHEN i.impression_type = 'view' THEN ap.cost_per_impression / 1000
            WHEN i.impression_type = 'click' THEN ap.cost_per_click
            WHEN i.impression_type = 'conversion' THEN ap.cost_per_conversion
            ELSE 0
        END
    ), 0) INTO v_today_spend
    FROM ad_impressions i
    JOIN ad_campaigns c ON i.campaign_id = c.campaign_id
    JOIN ad_pricing ap ON c.campaign_type = ap.campaign_type
    WHERE i.campaign_id = p_campaign_id
      AND DATE(i.timestamp) = CURRENT_DATE;
    
    RETURN v_today_spend >= v_daily_limit;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger to pause campaign when budget exhausted
CREATE OR REPLACE FUNCTION pause_campaign_if_budget_exhausted()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.spent_amount >= NEW.budget_qar THEN
        NEW.status := 'completed';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pause_on_budget ON ad_campaigns;
CREATE TRIGGER trigger_pause_on_budget
    BEFORE UPDATE ON ad_campaigns
    FOR EACH ROW
    WHEN (OLD.spent_amount IS DISTINCT FROM NEW.spent_amount)
    EXECUTE FUNCTION pause_campaign_if_budget_exhausted();

-- 9. Create materialized view for campaign analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS ad_campaign_analytics AS
SELECT 
    c.campaign_id,
    c.garage_id,
    c.campaign_name,
    c.campaign_type,
    c.status,
    c.budget_qar,
    c.spent_amount,
    c.impressions,
    c.clicks,
    c.conversions,
    CASE 
        WHEN c.impressions > 0 THEN ROUND((c.clicks::NUMERIC / c.impressions * 100), 2)
        ELSE 0 
    END as ctr_percentage,
    CASE 
        WHEN c.clicks > 0 THEN ROUND((c.conversions::NUMERIC / c.clicks * 100), 2)
        ELSE 0 
    END as conversion_rate,
    CASE 
        WHEN c.conversions > 0 THEN ROUND(c.spent_amount / c.conversions, 2)
        ELSE 0 
    END as cost_per_conversion,
    DATE_TRUNC('day', c.start_date) as start_date,
    DATE_TRUNC('day', c.end_date) as end_date
FROM ad_campaigns c;

CREATE INDEX IF NOT EXISTS idx_ad_campaign_analytics_garage ON ad_campaign_analytics(garage_id);

COMMENT ON TABLE ad_campaigns IS 'Advertising campaigns created by garages for promotion';
COMMENT ON TABLE ad_placements IS 'Specific ad placement configurations for campaigns';
COMMENT ON TABLE ad_impressions IS 'Tracking table for ad views, clicks, and conversions';
COMMENT ON TABLE ad_pricing IS 'Pricing model for different campaign types';
