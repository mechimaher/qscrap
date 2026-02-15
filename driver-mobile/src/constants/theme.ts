// QScrap Driver App - Premium VVIP Theme
// Unified Brand Identity - Qatar Maroon & Gold
// VVIP 2026 - Aligned with Customer App Theme

// ============================================
// LIGHT THEME - Classic Qatar Premium
// ============================================
export const lightTheme = {
    background: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceSecondary: '#F5F5F5',
    surfaceElevated: '#FFFFFF',
    card: '#FFFFFF',
    cardHover: '#F5F5F5',
    border: '#E5E5E5',
    borderLight: '#EEEEEE',

    text: '#1A1A1A',
    textSecondary: '#4A4A4A',
    textMuted: '#6A6A6A',
    textInverse: '#FFFFFF',

    primary: '#8D1B3D',
    secondary: '#C9A227', // Gold accent
    statusBar: 'dark' as const,

    // Additional colors for components
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    error: '#dc2626',
    info: '#C9A227',

    // Input fields
    inputBackground: '#FFFFFF',
    inputBorder: '#E5E5E5',
    inputText: '#1A1A1A',
    placeholder: '#9CA3AF',
};

// Proper type that supports both light and dark themes
export interface ThemeColors {
    background: string;
    surface: string;
    surfaceSecondary: string;
    surfaceElevated: string;
    card: string;
    cardHover: string;
    border: string;
    borderLight: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    textInverse: string;
    primary: string;
    secondary: string;
    statusBar: 'light' | 'dark';
    success: string;
    warning: string;
    danger: string;
    error: string;
    info: string;
    inputBackground: string;
    inputBorder: string;
    inputText: string;
    placeholder: string;
}

// ============================================
// BACKWARD COMPATIBILITY - Use light theme
// ============================================
const themeColors = lightTheme;

export const Colors = {
    // Primary Brand - Qatar Maroon
    primary: '#8D1B3D',
    primaryDark: '#6B1530',
    primaryLight: '#A82050',
    primaryGlow: 'rgba(141, 27, 61, 0.3)',

    // Secondary - Gold accent
    secondary: '#C9A227',
    secondaryLight: '#F5F0E1',

    // Status Colors (Direct access)
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    error: '#dc2626',
    info: '#C9A227',
    textMuted: '#6A6A6A',

    // Assignment Specific
    assigned: '#C9A227',
    pickedUp: '#8D1B3D',
    inTransit: '#8D1B3D',
    delivered: '#059669',
    failed: '#dc2626',

    // Theme reference (light-only)
    theme: themeColors,

    // Gradients (use with LinearGradient) - Qatar theme
    gradients: {
        primary: ['#8D1B3D', '#6B1530'] as const,
        primaryDark: ['#6B1530', '#8D1B3D'] as const,
        card: ['#FFFFFF', '#F8F8F8'] as const,
        cardDark: ['#1C1C1F', '#141416'] as const,
        premium: ['#8D1B3D', '#C9A227'] as const,
        gold: ['#C9A227', '#A68520'] as const,
        champagne: ['#FFFFFF', '#FFF9E6'] as const,     // Warm premium light
        champagneDark: ['#1C1C1F', '#1F1A10'] as const, // Warm premium dark
        pearl: ['#FFFFFF', '#F5F5F7'] as const,         // Cool premium light
        pearlDark: ['#141416', '#1C1C1F'] as const,     // Cool premium dark
    },
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
    // VVIP: Safe bottom padding for floating tab bar
    BOTTOM_NAV_HEIGHT: 120,
};

export const BorderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 48,
    full: 9999,
};

export const FontSize = {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 24,
    xxxl: 32,
    display: 40,
};

// Alias for consistency with customer app
export const FontSizes = FontSize;

export const FontWeights = {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
};

// VVIP 2026 - Inter Font Family
export const FontFamily = {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    heavy: 'Inter_800ExtraBold',
};

export const Shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
    },
    xl: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 12,
    },
    xxl: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
        elevation: 16,
    },
    glow: {
        shadowColor: '#8D1B3D',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
    },
};

// Assignment config
export const AssignmentStatusConfig = {
    assigned: {
        label: 'Assigned',
        color: Colors.assigned,
        icon: 'clipboard-outline',
        actionLabel: 'Start Pickup',
    },
    picked_up: {
        label: 'Picked Up',
        color: Colors.pickedUp,
        icon: 'cube',
        actionLabel: 'Start Delivery',
    },
    in_transit: {
        label: 'In Transit',
        color: Colors.inTransit,
        icon: 'car',
        actionLabel: 'Complete Delivery',
    },
    delivered: {
        label: 'Delivered',
        color: Colors.delivered,
        icon: 'checkmark-circle',
        actionLabel: null,
    },
    failed: {
        label: 'Failed',
        color: Colors.failed,
        icon: 'close-circle',
        actionLabel: null,
    },
    cancelled: {
        label: 'Cancelled',
        color: '#9CA3AF', // Gray for cancelled
        icon: 'ban',
        actionLabel: null,
    },
};

export const AssignmentTypeConfig = {
    collection: {
        label: 'Collection',
        description: 'Pick up from garage',
        icon: 'storefront-outline',
        color: Colors.primary,
    },
    delivery: {
        label: 'Delivery',
        description: 'Deliver to customer',
        icon: 'cube-outline',
        color: Colors.secondary,
    },
    return_to_garage: {
        label: 'Return',
        description: 'Return to garage',
        icon: 'return-down-back',
        color: Colors.warning,
    },
};
