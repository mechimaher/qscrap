import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { I18nManager } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { en } from './en';
import { ar } from './ar';

type Language = 'en' | 'ar';
type TranslationKey = keyof typeof en;

interface I18nContextType {
    language: Language;
    t: (key: TranslationKey, params?: Record<string, string | number>) => string;
    setLanguage: (lang: Language) => Promise<void>;
    isRTL: boolean;
}

const translations = { en, ar };

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const LANGUAGE_KEY = 'qscrap_driver_language';

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>('en');
    const [isReady, setIsReady] = useState(false);

    // Load saved language on mount
    useEffect(() => {
        const loadLanguage = async () => {
            try {
                const savedLang = await SecureStore.getItemAsync(LANGUAGE_KEY);
                if (savedLang && (savedLang === 'en' || savedLang === 'ar')) {
                    setLanguageState(savedLang);
                    I18nManager.forceRTL(savedLang === 'ar');
                }
            } catch (e) {
                console.log('Failed to load language:', e);
            } finally {
                setIsReady(true);
            }
        };
        loadLanguage();
    }, []);

    const setLanguage = useCallback(async (lang: Language) => {
        try {
            await SecureStore.setItemAsync(LANGUAGE_KEY, lang);
            setLanguageState(lang);
            I18nManager.forceRTL(lang === 'ar');
            // Note: App restart may be required for full RTL support
        } catch (e) {
            console.error('Failed to save language:', e);
        }
    }, []);

    const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
        let text = translations[language][key] || translations.en[key] || key;

        // Replace parameters like {{count}}
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
            });
        }

        return text;
    }, [language]);

    const isRTL = language === 'ar';

    if (!isReady) {
        return null;
    }

    return (
        <I18nContext.Provider value={{ language, t, setLanguage, isRTL }}>
            {children}
        </I18nContext.Provider>
    );
};

export const useI18n = (): I18nContextType => {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useI18n must be used within an I18nProvider');
    }
    return context;
};

// Standalone translate function for use outside of React components
export const translate = (key: TranslationKey, language: Language = 'en'): string => {
    return translations[language][key] || translations.en[key] || key;
};

export { en, ar };
export default I18nProvider;
