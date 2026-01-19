// QScrap Feature Flags Configuration
// Controls which features are visible in the app
// Used to focus MVP on used parts marketplace only

export const FeatureFlags = {
    // ========================================
    // MVP CORE (Always Enabled)
    // ========================================
    USED_PARTS_MARKETPLACE: true,  // Core business
    VIN_SCANNER: true,             // Just implemented
    PAYMENT_SYSTEM: true,          // Enterprise-ready
    DELIVERY_TRACKING: true,       // Essential for trust
    CHAT: true,                    // Customer support
    NOTIFICATIONS: true,           // Engagement

    // ========================================
    // HIDDEN FOR MVP (Enable Post-Launch)
    // ========================================
    QUICK_SERVICES: false,         // 8 service types - Phase 2
    INSURANCE_PORTAL: false,       // Insurance integration - Phase 3
    NEW_PARTS: false,              // New parts marketplace - Phase 3
    REPAIR_MARKETPLACE: false,     // Repair services - Phase 3

    // ========================================
    // ESCROW & TRUST (MVP Priority)
    // ========================================
    ESCROW_PAYMENTS: true,         // Hold funds until confirmation
    BUYER_PROTECTION: true,        // 48-hour inspection window
    SELLER_VERIFICATION: true,     // Verified seller badges
    PROOF_OF_CONDITION: true,      // Photo/video at pickup/delivery

    // ========================================
    // DELIVERY OPTIONS
    // ========================================
    PICKUP_FROM_GARAGE: true,      // Buyer collects
    PLATFORM_DELIVERY: true,       // Platform arranges delivery
    WHITE_GLOVE_DELIVERY: false,   // Premium inspection - Phase 2

    // ========================================
    // B2B FEATURES (Enable for Fleet Accounts)
    // ========================================
    B2B_INVOICING: false,          // Invoice toggle in checkout
    B2B_PO_MANAGEMENT: false,      // Purchase order upload
    FLEET_MANAGEMENT: false,       // Multi-vehicle management

    // ========================================
    // ADVANCED FEATURES (Phase 3+)
    // ========================================
    THREE_D_VIEWER: false,         // 3D part visualization
    AR_PREVIEW: false,             // Augmented reality
    ADVANCED_ANALYTICS: false,     // Business intelligence
};

// Helper function to check feature availability
export const isFeatureEnabled = (feature: keyof typeof FeatureFlags): boolean => {
    return FeatureFlags[feature] === true;
};

// User role-based feature overrides
export const getFeatureFlagsForRole = (userRole: string, isB2B: boolean = false) => {
    const flags = { ...FeatureFlags };

    // Enable B2B features for corporate accounts
    if (isB2B) {
        flags.B2B_INVOICING = true;
        flags.B2B_PO_MANAGEMENT = true;
    }

    // Garage/seller role gets additional features
    if (userRole === 'garage') {
        flags.SELLER_VERIFICATION = true;
    }

    return flags;
};

// Feature flag descriptions for admin dashboard
export const FeatureFlagDescriptions: Record<keyof typeof FeatureFlags, string> = {
    USED_PARTS_MARKETPLACE: 'Core marketplace for verified used auto parts',
    VIN_SCANNER: 'Camera-based VIN scanning with OCR',
    PAYMENT_SYSTEM: 'Enterprise payment processing with escrow',
    DELIVERY_TRACKING: 'Real-time delivery and order tracking',
    CHAT: 'In-app messaging between buyers and sellers',
    NOTIFICATIONS: 'Push notifications and in-app alerts',
    QUICK_SERVICES: 'On-demand services (battery, oil, etc.)',
    INSURANCE_PORTAL: 'Insurance claims and coverage integration',
    NEW_PARTS: 'New parts from authorized dealers',
    REPAIR_MARKETPLACE: 'Repair service booking and tracking',
    ESCROW_PAYMENTS: 'Hold payments until buyer confirmation',
    BUYER_PROTECTION: '48-hour inspection window for returns',
    SELLER_VERIFICATION: 'Verified seller badges and trust scores',
    PROOF_OF_CONDITION: 'Photo/video capture at pickup and delivery',
    PICKUP_FROM_GARAGE: 'Buyer pickup option from garage location',
    PLATFORM_DELIVERY: 'Platform-arranged delivery to customer',
    WHITE_GLOVE_DELIVERY: 'Premium delivery with technician inspection',
    B2B_INVOICING: 'Corporate invoice generation at checkout',
    B2B_PO_MANAGEMENT: 'Purchase order upload and tracking',
    FLEET_MANAGEMENT: 'Multi-vehicle management for fleet accounts',
    THREE_D_VIEWER: '3D visualization of parts',
    AR_PREVIEW: 'Augmented reality part preview',
    ADVANCED_ANALYTICS: 'Business intelligence and reporting',
};

export default FeatureFlags;
