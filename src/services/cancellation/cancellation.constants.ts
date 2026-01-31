/**
 * Cancellation & Refund Constants
 * Source: Cancellation-Refund-BRAIN.md (v3.0 FINAL - Jan 28, 2026)
 * 
 * IMPORTANT: These values are Qatar Law compliant per:
 * - Law No. 8/2008 (Consumer Protection)
 * - Law No. 19/2022 (E-Commerce)
 * - MOCI Decision 25/2024 (Marketplace Standards)
 * - QCB Circular 32/2023 (Payment Refunds)
 * 
 * DO NOT MODIFY without legal review.
 */

/**
 * Cancellation fee percentages by order stage
 * 
 * Fee Breakdown:
 * - AFTER_PAYMENT (5%): 2% QPAY tx + 1% refund processing + 2% admin
 * - DURING_PREPARATION (10%): 5% platform + 5% garage compensation
 * - IN_DELIVERY (10%): 5% platform + 5% garage (+ 100% delivery retained)
 * - AFTER_DELIVERY (20%): 5% platform + 5% restocking + 5% return logistics + 5% inspection
 */
export const CANCELLATION_FEES = {
    BEFORE_PAYMENT: 0,           // 0% - Free cancellation before payment
    AFTER_PAYMENT: 0.05,         // 5% - After payment, before prep
    DURING_PREPARATION: 0.10,    // 10% - During preparation
    IN_DELIVERY: 0.10,           // 10% + full delivery fee
    AFTER_DELIVERY: 0.20,        // 20% + full delivery fee (7-day return)
} as const;

/**
 * Customer-Friendly Fee Policy (Qatar Market Competitive)
 * Added Jan 31, 2026 - BRAIN v3.1
 */
export const FEE_POLICY = {
    MAX_FEE_QAR: 100,                // Maximum cancellation fee cap
    FIRST_CANCELLATION_FREE: true,   // First order cancellation per customer = FREE
} as const;

/**
 * Fee Split Between Platform and Garage
 * 
 * PHILOSOPHY: "Platform NEVER loses, garages get compensated for their time"
 * 
 * The cancellation fee is charged to the CUSTOMER and split between:
 * - Platform: Covers transaction costs, refund processing, admin overhead
 * - Garage: Compensates for work/time already invested
 * 
 * Customer pays the fee, both parties benefit.
 */
export const FEE_SPLIT = {
    BEFORE_PAYMENT: { platform: 0, garage: 0 },
    AFTER_PAYMENT: { platform: 0.05, garage: 0 },           // 5% to platform only (no work done yet)
    DURING_PREPARATION: { platform: 0.05, garage: 0.05 },   // 5% each (garage started work)
    IN_DELIVERY: { platform: 0.05, garage: 0.05 },          // 5% each (part ready, in transit)
    AFTER_DELIVERY: { platform: 0.10, garage: 0.10 },       // 10% each (return processing)
} as const;

/**
 * 7-Day Return Policy (Qatar Law No. 8/2008 Article 26 - MANDATORY)
 * 
 * WARNING: Reducing window below 7 days risks MOCI fines up to 1,000,000 QAR
 */
export const RETURN_POLICY = {
    WINDOW_DAYS: 7,              // Qatar Law mandated minimum
    WINDOW_HOURS: 168,           // 7 * 24 hours
    REQUIRED_PHOTOS: 3,          // Minimum photos for return request
    FEE_PERCENTAGE: 0.20,        // 20% restocking fee
} as const;

/**
 * Garage Penalties (B2B Contract - Commercial Transactions Law)
 * 
 * Must be included in signed Garage Terms of Service
 */
export const GARAGE_PENALTIES = {
    CANCELLATION_FEE_QAR: 30,         // Standard cancellation
    REPEAT_OFFENDER_FEE_QAR: 50,      // 2+ cancellations in 30 days
    WRONG_PART_PENALTY_QAR: 100,      // Verified wrong part claim
    DAMAGED_PART_PENALTY_QAR: 50,     // Verified damaged part
} as const;

/**
 * Customer Abuse Limits (Law No. 8/2008 Article 28 - Bad Faith Clause)
 * 
 * These limits must be disclosed in customer T&C
 */
export const CUSTOMER_LIMITS = {
    MAX_RETURNS_PER_MONTH: 3,
    MAX_DEFECTIVE_CLAIMS_PER_MONTH: 3,
    MAX_FREE_DELIVERY_VOUCHERS_PER_YEAR: 3,
    CANCELLATION_REVIEW_THRESHOLD: 5,  // Flagged for review at 5+
} as const;

/**
 * Garage Accountability Ladder
 */
export const GARAGE_THRESHOLDS = {
    WARNING_CANCELLATIONS: 1,        // 1st = warning only
    PENALTY_CANCELLATIONS: 2,        // 2nd = 50 QAR
    REVIEW_CANCELLATIONS: 3,         // 3rd = 48-hour hold
    SUSPEND_CANCELLATIONS: 4,        // 4th = 7-day suspension
    PERMANENT_REVIEW_CANCELLATIONS: 5, // 5th = board decision
} as const;

/**
 * Refund Processing SLA (QCB Circular 32/2023)
 */
export const REFUND_PROCESSING = {
    MAX_HOURS: 48,               // QSCRAP target (law allows 14 business days)
    TARGET_HOURS: 24,            // Internal target
    MAX_BUSINESS_DAYS: 14,       // QCB legal maximum
} as const;

/**
 * Delivery Voucher Config (Garage Cancellation Compensation)
 */
export const VOUCHER_CONFIG = {
    VALIDITY_DAYS: 30,
    MAX_VALUE_QAR: 50,
    DEFAULT_VALUE_QAR: 30,       // Standard compensation amount
} as const;

/**
 * Customer Fraud Flag Levels
 */
export const FRAUD_FLAG_LEVELS = {
    NONE: 'none',
    YELLOW: 'yellow',    // 4+ returns in 30 days - manual review
    ORANGE: 'orange',    // 4+ defective claims - investigation required
    RED: 'red',          // Evidence of misuse - reject + warning
    BLACK: 'black',      // Pattern of claim-and-keep - permanent ban
} as const;

/**
 * Cancellation Reason Codes
 */
export const CANCELLATION_REASON_CODES = {
    // Customer reasons
    CHANGED_MIND: 'changed_mind',
    FOUND_ELSEWHERE: 'found_elsewhere',
    TOO_EXPENSIVE: 'too_expensive',
    TAKING_TOO_LONG: 'taking_too_long',

    // Garage reasons
    STOCK_OUT: 'stock_out',
    WRONG_PART_IDENTIFIED: 'wrong_part_identified',
    CUSTOMER_UNREACHABLE: 'customer_unreachable',

    // Driver reasons
    CANT_FIND_GARAGE: 'cant_find_garage',
    PART_DAMAGED_AT_PICKUP: 'part_damaged_at_pickup',
    CUSTOMER_UNREACHABLE_DRIVER: 'customer_unreachable_driver',
    VEHICLE_ISSUE: 'vehicle_issue',

    // Defect/issue reasons
    WRONG_PART: 'wrong_part',
    PART_DEFECTIVE: 'part_defective',

    // Generic
    OTHER: 'other',
} as const;

/**
 * Order Status to Cancellation Stage Mapping
 */
export const STATUS_TO_STAGE = {
    // Stage 1-3: Pre-payment (0% fee)
    'request_active': 'BEFORE_PAYMENT',
    'bids_pending': 'BEFORE_PAYMENT',
    'bid_accepted': 'BEFORE_PAYMENT',
    'order_pending': 'BEFORE_PAYMENT',
    'pending_payment': 'BEFORE_PAYMENT',

    // Stage 4: After payment (5% fee)
    'payment_complete': 'AFTER_PAYMENT',
    'order_confirmed': 'AFTER_PAYMENT',
    'confirmed': 'AFTER_PAYMENT',

    // Stage 5: During preparation (10% fee)
    'preparing': 'DURING_PREPARATION',
    'ready_for_pickup': 'DURING_PREPARATION',

    // Stage 6: In delivery (10% + 100% delivery)
    'assigned': 'IN_DELIVERY',
    'picked_up': 'IN_DELIVERY',
    'in_transit': 'IN_DELIVERY',
    'collected': 'IN_DELIVERY',

    // Stage 7: After delivery (20% + 100% delivery via return flow)
    'delivered': 'AFTER_DELIVERY',
    'completed': 'AFTER_DELIVERY',
} as const;

export type CancellationStage = keyof typeof CANCELLATION_FEES;
export type FraudFlagLevel = typeof FRAUD_FLAG_LEVELS[keyof typeof FRAUD_FLAG_LEVELS];
export type CancellationReasonCode = typeof CANCELLATION_REASON_CODES[keyof typeof CANCELLATION_REASON_CODES];
