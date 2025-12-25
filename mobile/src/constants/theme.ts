// QScrap Premium Theme - Qatar National Colors Edition
// Al Adam (Pantone 1955 C) and White

export const Colors = {
    // Primary Brand - Qatar Al Adam (Pantone 1955 C)
    primary: '#8A1538',
    primaryDark: '#6B102C',
    primaryLight: '#A82050',
    primaryGlow: 'rgba(138, 21, 56, 0.3)',

    // Secondary - Gold accent (complements Al Adam)
    secondary: '#C9A227',

    // Dark Theme (Default) - Now using LIGHT colors for Qatar White theme
    dark: {
        background: '#ffffff',
        surface: '#f8f9fa',
        surfaceElevated: '#ffffff',
        card: '#ffffff',
        cardHover: '#f0f0f0',
        border: '#e5e5e5',
        borderLight: '#d4d4d4',

        text: '#1a1a1a',
        textSecondary: '#525252',
        textMuted: '#737373',

        statusBar: 'dark',
    },

    // Light Theme
    light: {
        background: '#f5f5f5',
        surface: '#ffffff',
        surfaceElevated: '#ffffff',
        card: '#ffffff',
        cardHover: '#f0f0f0',
        border: '#e5e5e5',
        borderLight: '#d4d4d4',

        text: '#0a0a0a',
        textSecondary: '#525252',
        textMuted: '#737373',

        statusBar: 'dark',
    },

    // Status Colors
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',

    // Gradients (use with LinearGradient) - Qatar Al Adam theme
    gradients: {
        primary: ['#8A1538', '#6B102C'] as const,
        primaryDark: ['#4A0D1F', '#8A1538'] as const,
        card: ['#1f1f1f', '#2a2a2a'] as const,
        premium: ['#8A1538', '#C9A227'] as const,
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
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    glow: {
        shadowColor: '#8A1538',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 10,
    },
};
