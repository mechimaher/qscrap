import { log, warn, error as logError } from '../utils/logger';
/**
 * QScrap i18n - Internationalization Module
 * Consolidated translation system with RTL support
 * Supports English and Arabic for Qatar VVIP market
 */

import { en } from './en';
import { ar } from './ar';

// Supported languages
export type Language = 'en' | 'ar';

// All translations grouped by language
export const translations = {
    en,
    ar,
} as const;

// Type-safe translation keys derived from English (base) translations
export type TranslationKeys = typeof en;

/**
 * Get translation value by dot-notation path
 * Supports nested keys like 'auth.login' or 'home.supplierBadges.used'
 * Falls back to English if key not found in target language
 * 
 * @param lang - Target language ('en' | 'ar')
 * @param path - Dot-notation key path
 * @returns Translated string or the path if not found
 */
export function getTranslation(lang: Language, path: string): string {
    const keys = path.split('.');
    let value: any = translations[lang];

    // Try to find in target language
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            // Fallback to English if key not found
            value = translations.en;
            for (const k of keys) {
                if (value && typeof value === 'object' && k in value) {
                    value = value[k];
                } else {
                    // Return path as-is if not found in either language
                    warn(`[i18n] Missing translation key: ${path}`);
                    return path;
                }
            }
            break;
        }
    }

    return typeof value === 'string' ? value : path;
}

/**
 * Get translation with interpolation support
 * Replaces {{variable}} placeholders with provided values
 * 
 * @param lang - Target language
 * @param path - Dot-notation key path
 * @param params - Object with key-value pairs for interpolation
 * @returns Interpolated translated string
 * 
 * @example
 * getTranslationWithParams('en', 'requests.count', { count: 5 })
 * // Returns: "5 requests"
 */
export function getTranslationWithParams(
    lang: Language,
    path: string,
    params: Record<string, string | number>
): string {
    let text = getTranslation(lang, path);

    // Replace all {{key}} placeholders (escape curly braces for regex)
    Object.entries(params).forEach(([key, value]) => {
        text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    });

    return text;
}

/**
 * Check if a language is RTL
 */
export function isRTLLanguage(lang: Language): boolean {
    return lang === 'ar';
}

/**
 * Get the text direction for a language
 */
export function getTextDirection(lang: Language): 'ltr' | 'rtl' {
    return isRTLLanguage(lang) ? 'rtl' : 'ltr';
}

// Re-export translations for direct access
export { en, ar };
