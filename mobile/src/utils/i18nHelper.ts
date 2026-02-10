import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTranslation, getTranslationWithParams, Language } from '../i18n';

const LANGUAGE_KEY = 'qscrap_language';

// Cache to avoid repeated async reads within the same session
let cachedLanguage: Language = 'en';
let isInitialized = false;

/**
 * Initialize the language cache from AsyncStorage.
 * Call this once at app startup (e.g., in App.tsx after LanguageProvider mounts).
 */
export async function initI18nHelper(): Promise<void> {
    try {
        const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (saved === 'ar' || saved === 'en') {
            cachedLanguage = saved;
        }
        isInitialized = true;
    } catch {
        // Fallback to English
        cachedLanguage = 'en';
        isInitialized = true;
    }
}

/**
 * Update the cached language (called by LanguageContext when language changes).
 */
export function setI18nLanguage(lang: Language): void {
    cachedLanguage = lang;
}

/**
 * Get the current language synchronously from cache.
 */
export function getCurrentLanguage(): Language {
    return cachedLanguage;
}

/**
 * Standalone translation function for non-component code.
 * Uses the cached language — no async, no hooks required.
 * 
 * @example
 * import { t } from '../utils/i18nHelper';
 * const title = t('notifications.newBidReceived');
 * const body = t('notifications.warrantyDays', { days: 30 });
 */
export function t(key: string, params?: Record<string, string | number>): string {
    if (params) {
        return getTranslationWithParams(cachedLanguage, key, params);
    }
    return getTranslation(cachedLanguage, key);
}
