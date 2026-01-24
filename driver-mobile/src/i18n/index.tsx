import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { I18nManager, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
                // Try SecureStore first, then AsyncStorage
                let savedLang = await SecureStore.getItemAsync(LANGUAGE_KEY);
                if (!savedLang) {
                    savedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
                }
                if (savedLang && (savedLang === 'en' || savedLang === 'ar')) {
                    setLanguageState(savedLang);
                    // Sync RTL state
                    const shouldBeRTL = savedLang === 'ar';
                    if (I18nManager.isRTL !== shouldBeRTL) {
                        I18nManager.allowRTL(shouldBeRTL);
                        I18nManager.forceRTL(shouldBeRTL);
                    }
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
            const previousLang = language;
            const previousRTL = I18nManager.isRTL;
            const shouldBeRTL = lang === 'ar';

            // Save to storage
            await SecureStore.setItemAsync(LANGUAGE_KEY, lang);
            await AsyncStorage.setItem(LANGUAGE_KEY, lang);
            setLanguageState(lang);

            // Handle RTL layout change
            if (previousRTL !== shouldBeRTL) {
                I18nManager.allowRTL(shouldBeRTL);
                I18nManager.forceRTL(shouldBeRTL);

                // Alert user about restart requirement
                Alert.alert(
                    lang === 'ar' ? 'تم تغيير اللغة' : 'Language Changed',
                    lang === 'ar'
                        ? 'يرجى إعادة تشغيل التطبيق لتطبيق تغييرات التخطيط'
                        : 'Please restart the app to apply layout changes',
                    [{ text: lang === 'ar' ? 'حسناً' : 'OK', style: 'default' }]
                );
            }

            console.log(`[i18n] Language changed: ${previousLang} → ${lang}`);
        } catch (e) {
            console.error('Failed to save language:', e);
        }
    }, [language]);

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
