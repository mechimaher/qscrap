// QScrap Driver App - Theme Context
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/theme';

interface ThemeContextType {
    isDarkMode: boolean;
    colors: typeof Colors.dark;
    toggleTheme: () => void;
    setTheme: (mode: 'light' | 'dark' | 'system') => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = 'qscrap_driver_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
    // Default to dark mode for drivers (easier on eyes during night driving)
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'system'>('dark');

    useEffect(() => {
        loadThemePreference();

        const subscription = Appearance.addChangeListener(({ colorScheme }) => {
            if (themePreference === 'system') {
                setIsDarkMode(colorScheme === 'dark');
            }
        });

        return () => subscription.remove();
    }, [themePreference]);

    const loadThemePreference = async () => {
        try {
            const saved = await AsyncStorage.getItem(THEME_KEY);
            if (saved) {
                const pref = saved as 'light' | 'dark' | 'system';
                setThemePreference(pref);
                if (pref === 'system') {
                    setIsDarkMode(Appearance.getColorScheme() === 'dark');
                } else {
                    setIsDarkMode(pref === 'dark');
                }
            }
        } catch (error) {
            console.log('[Theme] Load preference failed:', error);
        }
    };

    const toggleTheme = () => {
        const newMode = isDarkMode ? 'light' : 'dark';
        setTheme(newMode);
    };

    const setTheme = async (mode: 'light' | 'dark' | 'system') => {
        setThemePreference(mode);
        await AsyncStorage.setItem(THEME_KEY, mode);

        if (mode === 'system') {
            setIsDarkMode(Appearance.getColorScheme() === 'dark');
        } else {
            setIsDarkMode(mode === 'dark');
        }
    };

    const colors = isDarkMode ? Colors.dark : Colors.light;

    return (
        <ThemeContext.Provider value={{ isDarkMode, colors, toggleTheme, setTheme }}>
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
