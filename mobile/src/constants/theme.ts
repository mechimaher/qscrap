// QScrap Premium Theme - Qatar National Colors Edition
// Single unified theme - No dark mode

// Theme colors object (used by both light and dark for compatibility)
const themeColors = {
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

    primary: '#8D1B3D',
    secondary: '#C9A227', // Gold accent
    statusBar: 'dark' as const,

    // Additional colors for components
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    error: '#dc2626',
    info: '#C9A227',
};

export const Colors = {
    // Primary Brand - Qatar Maroon
    primary: '#8D1B3D',
    primaryDark: '#6B1530',
    primaryLight: '#A82050',
    primaryGlow: 'rgba(141, 27, 61, 0.3)',

    // Secondary - Gold accent
    secondary: '#C9A227',
    secondaryLight: '#F5F0E1',

    // Status Colors
    success: '#059669',
    warning: '#d97706',
    error: '#dc2626',
    info: '#C9A227',

    // BACKWARD COMPATIBILITY: Both light and dark point to same theme
    light: themeColors,
    dark: themeColors,

    // New unified theme reference
    theme: themeColors,

    // Gradients (use with LinearGradient) - Qatar theme
    gradients: {
        primary: ['#8D1B3D', '#6B1530'] as const,
        primaryDark: ['#6B1530', '#8D1B3D'] as const,
        card: ['#FFFFFF', '#F8F8F8'] as const,
        premium: ['#8D1B3D', '#C9A227'] as const,
        gold: ['#C9A227', '#A68520'] as const,
        champagne: ['#FFFFFF', '#FFF9E6'] as const, // Warm premium light
        pearl: ['#FFFFFF', '#F5F5F7'] as const, // Cool premium light
    }
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64, // Added for components that need extra large spacing
};

export const BorderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 48,
    full: 9999,
};

export const FontSizes = {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 24,
    xxxl: 32,
    display: 40,
};

// Alias for backward compatibility (some components use singular form)
export const FontSize = FontSizes;

export const FontWeights = {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
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
