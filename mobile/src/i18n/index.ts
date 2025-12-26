// i18n index - exports translation helper
import { en } from './translations/en';
import { ar } from './translations/ar';

export const translations = {
    en,
    ar,
};

export type Language = 'en' | 'ar';
export type TranslationKeys = typeof en;

// Helper to get nested translation value
export function getTranslation(lang: Language, path: string): string {
    const keys = path.split('.');
    let value: any = translations[lang];

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
                    return path; // Return path if not found
                }
            }
            break;
        }
    }

    return typeof value === 'string' ? value : path;
}
