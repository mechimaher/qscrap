// QScrap Theme Context - Single unified premium theme
// No dark mode - Qatar Premium Edition
import React, { createContext, useContext, ReactNode } from 'react';

export interface ThemeColors {
    background: string;
    surface: string;
    surfaceElevated: string;
    card: string;
    border: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    primary: string;
    primaryDark: string;
    primaryLight: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    gold: string;
}

// Qatar Premium Theme - Single unified theme
const qatarPremiumColors: ThemeColors = {
    background: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    card: '#FFFFFF',
    border: '#E5E5E5',
    text: '#1A1A1A',
    textSecondary: '#4A4A4A',
    textMuted: '#6A6A6A',
    primary: '#8D1B3D',
    primaryDark: '#6B1530',
    primaryLight: '#A82050',
    success: '#059669',
    warning: '#d97706',
    error: '#dc2626',
    info: '#C9A227',
    gold: '#C9A227',
};

interface ThemeContextType {
    isDarkMode: boolean;
    toggleTheme: () => void;
    colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    // Fixed to light mode - no dark mode toggle
    const isDarkMode = false;
    const toggleTheme = () => {
        // No-op - single theme only
        console.log('Theme toggle disabled - Qatar Premium single theme');
    };

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleTheme, colors: qatarPremiumColors }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

// Export colors for static usage
export { qatarPremiumColors as lightColors, qatarPremiumColors as darkColors };
