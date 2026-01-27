// QScrap Theme Context - VVIP 2026 with Dark Mode
// Qatar Premium Edition with System Preference Support
import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme, ThemeColors } from '../constants/theme';

const THEME_STORAGE_KEY = '@qscrap_theme_preference';

// Extended colors with additional computed values for backward compatibility
export interface ExtendedThemeColors extends ThemeColors {
    primaryDark: string;
    primaryLight: string;
    gold: string;
}

export interface ThemeContextType {
    isDarkMode: boolean;
    isDark: boolean;  // Alias for backward compatibility
    toggleTheme: () => void;
    setTheme: (mode: 'light' | 'dark' | 'system') => void;
    themeMode: 'light' | 'dark' | 'system';
    colors: ExtendedThemeColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const systemColorScheme = useColorScheme();
    const [themeMode, setThemeModeState] = useState<'light' | 'dark' | 'system'>('system');
    const [isLoaded, setIsLoaded] = useState(false);

    // Load saved theme preference
    useEffect(() => {
        loadThemePreference();
    }, []);

    const loadThemePreference = async () => {
        try {
            const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
            if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
                setThemeModeState(saved);
            }
        } catch (e) {
            console.log('Failed to load theme preference');
        } finally {
            setIsLoaded(true);
        }
    };

    const setTheme = async (mode: 'light' | 'dark' | 'system') => {
        setThemeModeState(mode);
        try {
            await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
        } catch (e) {
            console.log('Failed to save theme preference');
        }
    };

    const toggleTheme = () => {
        const newMode = isDarkMode ? 'light' : 'dark';
        setTheme(newMode);
    };

    // Determine actual dark mode based on preference
    const isDarkMode = themeMode === 'system'
        ? systemColorScheme === 'dark'
        : themeMode === 'dark';

    const isDark = isDarkMode; // Alias

    // Select theme colors
    const baseColors = isDarkMode ? darkTheme : lightTheme;

    // Extend with computed values for backward compatibility
    const colors: ExtendedThemeColors = {
        ...baseColors,
        primaryDark: '#6B1530',
        primaryLight: '#A82050',
        gold: '#C9A227',
    };

    // Don't render until theme is loaded to prevent flash
    if (!isLoaded) {
        return null;
    }

    return (
        <ThemeContext.Provider value={{
            isDarkMode,
            isDark,
            toggleTheme,
            setTheme,
            themeMode,
            colors
        }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextType {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

// Export colors for static usage
export const lightColors = lightTheme;
export const darkColors = darkTheme;
