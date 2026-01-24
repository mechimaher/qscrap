import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

type NavApp = 'google' | 'waze' | 'apple' | 'in_app';
type Language = 'en' | 'ar';
type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsContextType {
    navApp: NavApp;
    setNavApp: (app: NavApp) => Promise<void>;
    language: Language;
    setLanguage: (lang: Language) => Promise<void>;
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => Promise<void>;
    notificationsEnabled: boolean;
    setNotificationsEnabled: (enabled: boolean) => Promise<void>;
    isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [navApp, setNavAppState] = useState<NavApp>('in_app');
    const [language, setLanguageState] = useState<Language>('en');
    const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
    const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const [storedNav, storedLang, storedTheme, storedNotif] = await Promise.all([
                AsyncStorage.getItem('settings_nav_app'),
                AsyncStorage.getItem('settings_language'),
                AsyncStorage.getItem('settings_theme'),
                AsyncStorage.getItem('settings_notifications'),
            ]);

            if (storedNav) setNavAppState(storedNav as NavApp);
            if (storedLang) setLanguageState(storedLang as Language);
            if (storedTheme) setThemeModeState(storedTheme as ThemeMode);
            if (storedNotif) setNotificationsEnabledState(storedNotif === 'true');
        } catch (error) {
            console.error('Failed to load settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const setNavApp = async (app: NavApp) => {
        setNavAppState(app);
        await AsyncStorage.setItem('settings_nav_app', app);
    };

    const setLanguage = async (lang: Language) => {
        setLanguageState(lang);
        await AsyncStorage.setItem('settings_language', lang);
        // Also save to I18n storage key for I18nProvider compatibility
        await AsyncStorage.setItem('qscrap_driver_language', lang);
        // RTL is handled by I18nManager in the I18nProvider on next app load
    };

    const setThemeMode = async (mode: ThemeMode) => {
        setThemeModeState(mode);
        await AsyncStorage.setItem('settings_theme', mode);
    };

    const setNotificationsEnabled = async (enabled: boolean) => {
        setNotificationsEnabledState(enabled);
        await AsyncStorage.setItem('settings_notifications', String(enabled));
    };

    return (
        <SettingsContext.Provider
            value={{
                navApp,
                setNavApp,
                language,
                setLanguage,
                themeMode,
                setThemeMode,
                notificationsEnabled,
                setNotificationsEnabled,
                isLoading,
            }}
        >
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
