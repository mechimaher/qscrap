/**
 * QScrap System Configuration
 * 
 * Centralized configuration for business rules and thresholds.
 * Premium 2026: All hard-coded values in one place for easy management.
 */

export const SystemConfig = {
    // ============================================
    // DELIVERY FEES
    // ============================================
    DEFAULT_DELIVERY_FEE: 25.00,  // QAR
    FREE_DELIVERY_THRESHOLD: 500.00,  // QAR - orders above this get free delivery

    // ============================================
    // TIME WINDOWS
    // ============================================
    DISPUTE_WINDOW_HOURS: 48,  // Hours customer has to raise dispute after delivery
    REQUEST_EXPIRY_HOURS: 24,  // Hours until part request expires
    COUNTER_OFFER_EXPIRY_HOURS: 24,  // Hours for counter-offer response
    DELIVERY_AUTO_CONFIRM_HOURS: 24,  // Hours until delivered order auto-completes
    PAYOUT_AUTO_CONFIRM_DAYS: 7,  // Days until awaiting_confirmation auto-confirms
    INSPECTION_ABANDON_HOURS: 4,  // Hours until in_progress inspection releases

    // ============================================
    // LIMITS
    // ============================================
    MAX_NEGOTIATION_ROUNDS: 3,  // Maximum back-and-forth in negotiation
    MAX_DISPUTE_PHOTOS: 5,  // Maximum photos per dispute
    MAX_DISPATCH_PHOTO_SIZE_MB: 5,  // MB per photo
    MAX_BID_IMAGES: 5,  // Maximum images per bid

    // ============================================
    // FINANCIAL
    // ============================================
    DEFAULT_COMMISSION_RATE: 0.15,  // 15% platform commission
    DEMO_COMMISSION_RATE: 0.00,  // 0% for demo garages
    CANCELLATION_FEE_PREPARING: 0.10,  // 10% fee if cancelled during preparing
    CANCELLATION_FEE_COLLECTED: 0.25,  // 25% fee if cancelled after collection

    // ============================================
    // SUBSCRIPTIONS
    // ============================================
    DEMO_TRIAL_DAYS: 7,  // Days for demo trial
    SUBSCRIPTION_RENEWAL_WARNING_DAYS: 3,  // Days before expiry to warn
    EARLY_ACCESS_MINUTES: 5,  // Minutes Enterprise garages get exclusive access to new requests

    // ============================================
    // REVIEWS & RATINGS
    // ============================================
    MIN_RATING_FOR_REVIEWS: 1,
    MAX_RATING_FOR_REVIEWS: 5,
    REVIEW_COOLDOWN_HOURS: 24,  // Hours after completion before review allowed

    // ============================================
    // SECURITY
    // ============================================
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION_MINUTES: 30,
    TOKEN_EXPIRY_DAYS: 30,

    // ============================================
    // OPERATIONS
    // ============================================
    AUTO_CONFIRM_THRESHOLD_HOURS: 24,  // Hours until delivered orders auto-complete
    PAYOUT_PROCESSING_DAYS: 7,  // Days until payout is processed
};

// Export for easy access
export default SystemConfig;
