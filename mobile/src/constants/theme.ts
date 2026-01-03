// QScrap Premium Theme - Qatar National Colors Edition
// Single unified theme - No dark mode

export const Colors = {
    // Primary Brand - Qatar Maroon
    primary: '#8D1B3D',
    primaryDark: '#6B1530',
    primaryLight: '#A82050',
    primaryGlow: 'rgba(141, 27, 61, 0.3)',

    // Secondary - Gold accent
    secondary: '#C9A227',
    secondaryLight: '#F5F0E1',

    // Theme - Single light theme (no dark mode)
    theme: {
        background: '#FAFAFA',
        surface: '#FFFFFF',
        surfaceElevated: '#FFFFFF',
        card: '#FFFFFF',
        cardHover: '#F5F5F5',
        border: '#E5E5E5',
        borderLight: '#EEEEEE',

        text: '#1A1A1A',
        textSecondary: '#4A4A4A',
        textMuted: '#6A6A6A',

        primary: '#8D1B3D',
        statusBar: 'dark',
    },

    // Status Colors
    success: '#059669',
    warning: '#d97706',
    error: '#dc2626',
    info: '#C9A227',  // Gold for info

    // Gradients (use with LinearGradient) - Qatar theme
    gradients: {
        primary: ['#8D1B3D', '#6B1530'] as const,
        primaryDark: ['#6B1530', '#8D1B3D'] as const,
        card: ['#FFFFFF', '#F8F8F8'] as const,
        premium: ['#8D1B3D', '#C9A227'] as const,
        gold: ['#C9A227', '#A68520'] as const,
    }
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

export const BorderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
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
    glow: {
        shadowColor: '#8D1B3D',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
    },
};
