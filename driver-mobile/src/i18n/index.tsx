import React, { createContext, useContext, useCallback } from 'react';
import { en } from './en';

type TranslationKey = keyof typeof en;

interface I18nContextType {
    language: 'en';
    t: (key: TranslationKey, params?: Record<string, string | number>) => string;
    setLanguage: (lang: 'en') => void;
    isRTL: false;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
        let text = en[key] || key;

        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
            });
        }

        return text;
    }, []);

    const value: I18nContextType = {
        language: 'en',
        t,
        setLanguage: () => { },
        isRTL: false,
    };

    return (
        <I18nContext.Provider value={value}>
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
export const translate = (key: TranslationKey): string => {
    return en[key] || key;
};

export { en };
export default I18nProvider;
