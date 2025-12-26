// QScrap Theme Context - App-wide dark mode support
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'qscrap_theme';

interface ThemeContextType {
    isDarkMode: boolean;
    toggleTheme: () => void;
    colors: ThemeColors;
}

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
}

const lightColors: ThemeColors = {
    background: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    card: '#FFFFFF',
    border: '#E8E8E8',
    text: '#1a1a1a',
    textSecondary: '#525252',
    textMuted: '#737373',
    primary: '#8A1538',
    primaryDark: '#6B102C',
    primaryLight: '#A82050',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
};

const darkColors: ThemeColors = {
    background: '#0a0a0a',
    surface: '#1a1a1a',
    surfaceElevated: '#262626',
    card: '#1a1a1a',
    border: '#333333',
    text: '#ffffff',
    textSecondary: '#a3a3a3',
    textMuted: '#737373',
    primary: '#8A1538',
    primaryDark: '#6B102C',
    primaryLight: '#A82050',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem(THEME_KEY);
            if (savedTheme !== null) {
                setIsDarkMode(savedTheme === 'dark');
            }
        } catch (error) {
            console.log('Failed to load theme:', error);
        }
    };

    const toggleTheme = async () => {
        const newTheme = !isDarkMode;
        setIsDarkMode(newTheme);
        try {
            await AsyncStorage.setItem(THEME_KEY, newTheme ? 'dark' : 'light');
        } catch (error) {
            console.log('Failed to save theme:', error);
        }
    };

    const colors = isDarkMode ? darkColors : lightColors;

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleTheme, colors }}>
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

// Export colors for static usage (when context not available)
export { lightColors, darkColors };
