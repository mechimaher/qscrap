/**
 * QSCRAP System Configuration
 * From Expert Review: "Make pricing database-driven so you can change without deployments"
 * 
 * This file centralizes all "magic numbers" that were scattered in the codebase.
 * Values can be overridden via environment variables or database config table.
 */

export interface PricingConfig {
    // Platform Commission
    PLATFORM_COMMISSION_RATE: number;        // 0.10 = 10%

    // Delivery Fee Tiers (by zone)
    DELIVERY_FEE_ZONE_1: number;             // Doha Central
    DELIVERY_FEE_ZONE_2: number;             // Greater Doha  
    DELIVERY_FEE_ZONE_3: number;             // Industrial/Airport
    DELIVERY_FEE_ZONE_4: number;             // Outer Areas

    // Loyalty Program
    LOYALTY_POINTS_PER_QAR: number;          // Points earned per QAR spent
    LOYALTY_TIER_SILVER_THRESHOLD: number;   // Points for Silver
    LOYALTY_TIER_GOLD_THRESHOLD: number;     // Points for Gold
    LOYALTY_TIER_PLATINUM_THRESHOLD: number; // Points for Platinum

    // Payout Settings
    PAYOUT_AUTO_CONFIRM_DAYS: number;        // Auto-confirm after N days
    PAYOUT_REMINDER_DAYS: number;            // Send reminder after N days

    // Request Settings
    REQUEST_EXPIRY_HOURS: number;            // Request expires after N hours
    BID_WINDOW_HOURS: number;                // Bidding window duration

    // Driver Settings
    DRIVER_COMMISSION_RATE: number;          // Driver's share of delivery fee
    DRIVER_MIN_PAYOUT: number;               // Minimum wallet withdrawal
}

// Default configuration - can be overridden by database or env vars
const defaultConfig: PricingConfig = {
    // Platform Commission: 10%
    PLATFORM_COMMISSION_RATE: parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.10'),

    // Delivery Fees (QAR)
    DELIVERY_FEE_ZONE_1: parseFloat(process.env.DELIVERY_FEE_ZONE_1 || '25'),
    DELIVERY_FEE_ZONE_2: parseFloat(process.env.DELIVERY_FEE_ZONE_2 || '35'),
    DELIVERY_FEE_ZONE_3: parseFloat(process.env.DELIVERY_FEE_ZONE_3 || '45'),
    DELIVERY_FEE_ZONE_4: parseFloat(process.env.DELIVERY_FEE_ZONE_4 || '55'),

    // Loyalty Program
    LOYALTY_POINTS_PER_QAR: parseFloat(process.env.LOYALTY_POINTS_PER_QAR || '1'),
    LOYALTY_TIER_SILVER_THRESHOLD: parseInt(process.env.LOYALTY_TIER_SILVER || '500'),
    LOYALTY_TIER_GOLD_THRESHOLD: parseInt(process.env.LOYALTY_TIER_GOLD || '2000'),
    LOYALTY_TIER_PLATINUM_THRESHOLD: parseInt(process.env.LOYALTY_TIER_PLATINUM || '5000'),

    // Payout Automation
    PAYOUT_AUTO_CONFIRM_DAYS: parseInt(process.env.PAYOUT_AUTO_CONFIRM_DAYS || '7'),
    PAYOUT_REMINDER_DAYS: parseInt(process.env.PAYOUT_REMINDER_DAYS || '3'),

    // Request Lifecycle
    REQUEST_EXPIRY_HOURS: parseInt(process.env.REQUEST_EXPIRY_HOURS || '48'),
    BID_WINDOW_HOURS: parseInt(process.env.BID_WINDOW_HOURS || '24'),

    // Driver Economics
    DRIVER_COMMISSION_RATE: parseFloat(process.env.DRIVER_COMMISSION_RATE || '0.75'), // 75% to driver
    DRIVER_MIN_PAYOUT: parseFloat(process.env.DRIVER_MIN_PAYOUT || '50'), // 50 QAR minimum
};

// Export frozen config to prevent accidental mutation
export const PRICING_CONFIG: Readonly<PricingConfig> = Object.freeze(defaultConfig);

// Helper function to get current config (can be extended to fetch from DB)
export async function getPricingConfig(): Promise<PricingConfig> {
    // TODO: Fetch overrides from system_config table
    // const dbConfig = await pool.query('SELECT key, value FROM system_config WHERE category = $1', ['pricing']);
    // Merge with defaults
    return PRICING_CONFIG;
}

// Log config on startup
console.log('[Config] Pricing configuration loaded:', {
    commission: `${PRICING_CONFIG.PLATFORM_COMMISSION_RATE * 100}%`,
    deliveryFees: `${PRICING_CONFIG.DELIVERY_FEE_ZONE_1}-${PRICING_CONFIG.DELIVERY_FEE_ZONE_4} QAR`,
    autoConfirmDays: PRICING_CONFIG.PAYOUT_AUTO_CONFIRM_DAYS
});
