/**
 * QScrap Enterprise Contact Constants
 * 
 * VVIP Premium App - Qatar's Largest Auto Parts Marketplace
 * Production-grade contact information for customer support
 */

// Enterprise Support Contacts
export const CONTACT = {
    // Primary enterprise support line (WhatsApp Business verified)
    SUPPORT_PHONE: '+97450267974',
    SUPPORT_PHONE_RAW: '97450267974',

    // Email support
    SUPPORT_EMAIL: 'support@qscrap.qa',
    SALES_EMAIL: 'sales@qscrap.qa',
    PARTNERSHIPS_EMAIL: 'partnerships@qscrap.qa',

    // WhatsApp Business
    WHATSAPP_URL: 'https://wa.me/97450267974',
    WHATSAPP_GREETING: 'Hello QScrap Support',

    // Social Media (Production)
    INSTAGRAM: 'https://instagram.com/qscrap.qa',
    FACEBOOK: 'https://facebook.com/qscrap.qa',
    TWITTER: 'https://twitter.com/qscrap.qa',
    LINKEDIN: 'https://linkedin.com/company/qscrap',

    // Corporate Info
    COMPANY_NAME: 'QScrap Services & Trading L.L.C',
    COMPANY_NAME_AR: 'كيوسكراب للخدمات والتجارة ذ.م.م',
    COMPANY_BRAND: 'QScrap',
    LANDLINE: '+97455906912',
    TAGLINE: 'Qatar\'s Premium Auto Parts Marketplace',
    TAGLINE_AR: 'أفضل سوق لقطع غيار السيارات في قطر',
} as const;

// Business Hours
export const BUSINESS_HOURS = {
    WEEKDAY_OPEN: '08:00',
    WEEKDAY_CLOSE: '17:00',
    SATURDAY_OPEN: '08:00',
    SATURDAY_CLOSE: '17:00',
    FRIDAY: 'closed',
    TIMEZONE: 'Asia/Qatar',
} as const;

// Emergency/Priority Support
export const PRIORITY_SUPPORT = {
    ENABLED: true,
    PHONE: '+97450267974',
    EMAIL: 'urgent@qscrap.qa',
    RESPONSE_TIME_MINUTES: 15,
} as const;

// Legal URLs
export const LEGAL = {
    PRIVACY_POLICY: 'https://qscrap.qa/privacy.html',
    TERMS_OF_SERVICE: 'https://qscrap.qa/terms.html',
    COOKIE_POLICY: 'https://qscrap.qa/terms.html',
    REFUND_POLICY: 'https://qscrap.qa/refund.html',
} as const;

// App Store Links
export const APP_LINKS = {
    GOOGLE_PLAY: 'https://play.google.com/store/apps/details?id=qa.qscrap.app',
    APP_STORE: 'https://apps.apple.com/qa/app/qscrap/id6740043847',
    WEBSITE: 'https://qscrap.qa',
} as const;

// Quality Badges (for premium branding)
export const CERTIFICATIONS = {
    ISO_CERTIFIED: true,
    QATAR_CHAMBER: true,
    VERIFIED_BUSINESS: true,
} as const;
