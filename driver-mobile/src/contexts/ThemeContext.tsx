// QScrap Driver App - Theme Context
// Unified VVIP Theme - No Dark Mode (Matches Customer App)
import React, { createContext, useContext, ReactNode } from 'react';
import { Colors } from '../constants/theme';

interface ThemeContextType {
    isDarkMode: boolean; // Always false for backward compatibility
    colors: typeof Colors.theme;
    toggleTheme: () => void; // No-op for backward compatibility
    setTheme: (mode: 'light' | 'dark' | 'system') => void; // No-op for backward compatibility
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    // Unified VVIP Theme - Always use light theme colors
    // No dark mode toggle - matches customer app approach
    const colors = Colors.theme;

    // These are no-ops for backward compatibility with existing code
    const toggleTheme = () => {
        console.log('[Theme] Dark mode disabled - using unified VVIP theme');
    };

    const setTheme = (_mode: 'light' | 'dark' | 'system') => {
        console.log('[Theme] Theme switching disabled - using unified VVIP theme');
    };

    return (
        <ThemeContext.Provider value={{
            isDarkMode: false, // Always false
            colors,
            toggleTheme,
            setTheme
        }}>
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

