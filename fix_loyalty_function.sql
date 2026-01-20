CREATE OR REPLACE FUNCTION get_customer_rewards_summary(p_customer_id UUID)
RETURNS TABLE (
    points_balance INTEGER,
    lifetime_points INTEGER,
    current_tier VARCHAR,
    discount_percentage NUMERIC,
    priority_support BOOLEAN,
    tier_badge_color VARCHAR,
    next_tier VARCHAR,
    points_to_next_tier INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cr.points_balance,
        cr.lifetime_points,
        cr.current_tier,
        rt.discount_percentage,
        rt.priority_support,
        rt.tier_badge_color,
        (CASE 
            WHEN cr.current_tier = 'bronze' THEN 'silver'
            WHEN cr.current_tier = 'silver' THEN 'gold'
            WHEN cr.current_tier = 'gold' THEN 'platinum'
            ELSE 'platinum'
        END)::VARCHAR as next_tier,
        CASE 
            WHEN cr.current_tier = 'bronze' THEN GREATEST(0, 1000 - cr.lifetime_points)
            WHEN cr.current_tier = 'silver' THEN GREATEST(0, 3000 - cr.lifetime_points)
            WHEN cr.current_tier = 'gold' THEN GREATEST(0, 10000 - cr.lifetime_points)
            ELSE 0
        END as points_to_next_tier
    FROM customer_rewards cr
    JOIN reward_tiers rt ON cr.current_tier = rt.tier_name
    WHERE cr.customer_id = p_customer_id;
END;
$$ LANGUAGE plpgsql;
