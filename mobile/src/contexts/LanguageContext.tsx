/**
 * LanguageContext - Complete i18n solution with RTL support
 * Enhanced for Qatar VVIP market with device locale auto-detection
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { I18nManager, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import {
    translations,
    getTranslation,
    getTranslationWithParams,
    Language,
    isRTLLanguage
} from '../i18n';

const LANGUAGE_KEY = 'qscrap_language';
const LANGUAGE_INITIALIZED_KEY = 'qscrap_language_initialized';

interface LanguageContextType {
    /** Current language code */
    language: Language;
    /** Whether current language is RTL */
    isRTL: boolean;
    /** Change language (will prompt restart for RTL switch) */
    setLanguage: (lang: Language) => Promise<void>;
    /** Get translation by key path */
    t: (key: string, params?: Record<string, string | number>) => string;
    /** Raw translations object for direct access */
    translations: typeof translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Detect the best language based on device locale
 * Prioritizes Arabic for ar-* locales (Qatar, UAE, Saudi, etc.)
 */
function detectDeviceLanguage(): Language {
    try {
        // Get all device locales
        const locales = Localization.getLocales();

        if (locales && locales.length > 0) {
            const primaryLocale = locales[0];
            const languageCode = primaryLocale.languageCode?.toLowerCase();

            // Check if device language is Arabic
            if (languageCode === 'ar') {
                console.log('[i18n] Device locale is Arabic, defaulting to Arabic');
                return 'ar';
            }
        }

        // Fallback to English for all other locales
        return 'en';
    } catch (error) {
        console.log('[i18n] Failed to detect device locale:', error);
        return 'en';
    }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>('en');
    const [isRTL, setIsRTL] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize language on mount
    useEffect(() => {
        initializeLanguage();
    }, []);

    /**
     * Initialize language from storage or device locale
     */
    const initializeLanguage = async () => {
        try {
            // Check if we've already initialized
            const hasInitialized = await AsyncStorage.getItem(LANGUAGE_INITIALIZED_KEY);
            const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);

            if (savedLanguage === 'ar' || savedLanguage === 'en') {
                // Use saved preference
                setLanguageState(savedLanguage);
                setIsRTL(savedLanguage === 'ar');

                // Sync RTL state with React Native
                syncRTLState(savedLanguage === 'ar');
            } else if (!hasInitialized) {
                // First time - detect from device locale
                const detectedLanguage = detectDeviceLanguage();
                setLanguageState(detectedLanguage);
                setIsRTL(detectedLanguage === 'ar');

                // Save the detected language
                await AsyncStorage.setItem(LANGUAGE_KEY, detectedLanguage);
                await AsyncStorage.setItem(LANGUAGE_INITIALIZED_KEY, 'true');

                // If detected Arabic, need to force RTL and restart
                if (detectedLanguage === 'ar' && !I18nManager.isRTL) {
                    I18nManager.allowRTL(true);
                    I18nManager.forceRTL(true);
                    // Note: First launch will show in English, then RTL on restart
                    // This is expected behavior for first-time Arabic detection
                }
            }
        } catch (error) {
            console.log('[i18n] Failed to initialize language:', error);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Sync RTL state with React Native's I18nManager
     */
    const syncRTLState = (shouldBeRTL: boolean) => {
        const currentRTL = I18nManager.isRTL;

        if (currentRTL !== shouldBeRTL) {
            console.log(`[i18n] RTL mismatch: current=${currentRTL}, should=${shouldBeRTL}`);
            // Note: The mismatch will be resolved after app restart
            // We don't force here to avoid unexpected behavior
        }
    };

    /**
     * Change language with RTL handling
     */
    const setLanguage = useCallback(async (lang: Language) => {
        try {
            const previousLanguage = language;
            const shouldBeRTL = isRTLLanguage(lang);
            const currentRTL = I18nManager.isRTL;

            // Save to storage first
            await AsyncStorage.setItem(LANGUAGE_KEY, lang);

            // Update state
            setLanguageState(lang);
            setIsRTL(shouldBeRTL);

            // Handle RTL layout change
            if (currentRTL !== shouldBeRTL) {
                I18nManager.allowRTL(shouldBeRTL);
                I18nManager.forceRTL(shouldBeRTL);

                // Notify user that restart is needed for layout changes
                Alert.alert(
                    lang === 'ar' ? 'تم تغيير اللغة' : 'Language Changed',
                    lang === 'ar'
                        ? 'يرجى إعادة تشغيل التطبيق لتطبيق تغييرات التخطيط'
                        : 'Please restart the app to apply layout changes',
                    [{
                        text: lang === 'ar' ? 'حسناً' : 'OK',
                        style: 'default'
                    }]
                );
            }

            console.log(`[i18n] Language changed: ${previousLanguage} → ${lang}`);
        } catch (error) {
            console.log('[i18n] Failed to save language:', error);
        }
    }, [language]);

    /**
     * Translation function with optional parameter interpolation
     */
    const t = useCallback((key: string, params?: Record<string, string | number>): string => {
        if (params) {
            return getTranslationWithParams(language, key, params);
        }
        return getTranslation(language, key);
    }, [language]);

    // Don't render until language is loaded
    if (isLoading) {
        return null;
    }

    return (
        <LanguageContext.Provider value={{
            language,
            isRTL,
            setLanguage,
            t,
            translations
        }}>
            {children}
        </LanguageContext.Provider>
    );
}

/**
 * Hook to access language context
 * Must be used within a LanguageProvider
 */
export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}

/**
 * Shorthand hook for translation function only
 * Returns t function, language, and isRTL
 */
export function useTranslation() {
    const { t, language, isRTL } = useLanguage();
    return { t, language, isRTL };
}

/**
 * Hook for RTL-aware styling
 * Returns isRTL boolean for conditional styling
 */
export function useRTL(): boolean {
    const { isRTL } = useLanguage();
    return isRTL;
}
