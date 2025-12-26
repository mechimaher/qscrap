// LanguageContext - Complete i18n solution with RTL support
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { I18nManager, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, getTranslation, Language } from '../i18n';

const LANGUAGE_KEY = 'qscrap_language';

interface LanguageContextType {
    language: Language;
    isRTL: boolean;
    setLanguage: (lang: Language) => Promise<void>;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>('en');
    const [isRTL, setIsRTL] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Load saved language on mount
    useEffect(() => {
        loadSavedLanguage();
    }, []);

    const loadSavedLanguage = async () => {
        try {
            const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
            if (saved === 'ar' || saved === 'en') {
                setLanguageState(saved);
                setIsRTL(saved === 'ar');
            }
        } catch (error) {
            console.log('Failed to load language:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const setLanguage = useCallback(async (lang: Language) => {
        try {
            // Save to storage
            await AsyncStorage.setItem(LANGUAGE_KEY, lang);

            // Update state
            setLanguageState(lang);

            const shouldBeRTL = lang === 'ar';
            setIsRTL(shouldBeRTL);

            // Handle RTL layout change
            if (I18nManager.isRTL !== shouldBeRTL) {
                I18nManager.allowRTL(shouldBeRTL);
                I18nManager.forceRTL(shouldBeRTL);

                // Notify user to restart for RTL changes to take effect
                Alert.alert(
                    lang === 'ar' ? 'تم تغيير اللغة' : 'Language Changed',
                    lang === 'ar' ? 'يرجى إعادة تشغيل التطبيق لتطبيق التغييرات' : 'Please restart the app to apply layout changes',
                    [{ text: lang === 'ar' ? 'حسناً' : 'OK' }]
                );
            }
        } catch (error) {
            console.log('Failed to save language:', error);
        }
    }, []);

    // Translation function
    const t = useCallback((key: string): string => {
        return getTranslation(language, key);
    }, [language]);

    // Don't render until language is loaded
    if (isLoading) {
        return null;
    }

    return (
        <LanguageContext.Provider value={{ language, isRTL, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

// Custom hook to use language context
export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}

// Shorthand hook for just translation function
export function useTranslation() {
    const { t, language, isRTL } = useLanguage();
    return { t, language, isRTL };
}
