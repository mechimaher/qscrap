// ===== 2026 BILINGUAL I18N SYSTEM FOR LEGAL PAGES =====
// Minimal translations for navigation and UI elements
// Legal content remains in English for legal validity

const legalTranslations = {
    en: {
        // Navigation
        'nav.backHome': 'Back to Home',

        // Common UI
        'hero.protected': 'Your Data is Protected',
        'hero.regulated': 'Regulated by Qatar Law',
        'hero.dispute': 'Fair & Transparent',

        // Footer
        'footer.copyright': '© 2026 QScrap Services & Trading L.L.C. All rights reserved.',
        'footer.privacy': 'Privacy Policy',
        'footer.terms': 'Terms of Service',
        'footer.refund': 'Refund Policy'
    },
    ar: {
        // Navigation
        'nav.backHome': 'العودة للرئيسية',

        // Common UI
        'hero.protected': 'بياناتك محمية',
        'hero.regulated': 'منظم بموجب قانون قطر',
        'hero.dispute': 'عادل وشفاف',

        // Footer
        'footer.copyright': '© ٢٠٢٦ كيوسكراب للخدمات والتجارة ذ.م.م. جميع الحقوق محفوظة.',
        'footer.privacy': 'سياسة الخصوصية',
        'footer.terms': 'شروط الخدمة',
        'footer.refund': 'سياسة الاسترداد'
    }
};

// i18n System for Legal Pages
const legalI18n = {
    currentLang: localStorage.getItem('qscrap-lang') || 'en',

    init() {
        this.setLanguage(this.currentLang, false);

        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                this.setLanguage(lang, true);
            });
        });
    },

    setLanguage(lang, animate = true) {
        this.currentLang = lang;
        localStorage.setItem('qscrap-lang', lang);

        const html = document.documentElement;
        if (lang === 'ar') {
            html.setAttribute('dir', 'rtl');
            html.setAttribute('lang', 'ar');
            document.body.style.fontFamily = "'Inter', 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif";
        } else {
            html.setAttribute('dir', 'ltr');
            html.setAttribute('lang', 'en');
            document.body.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        }

        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            const translation = legalTranslations[lang][key];
            if (translation) {
                if (animate) {
                    el.style.opacity = '0';
                    el.style.transition = 'opacity 0.15s ease';
                    setTimeout(() => {
                        el.textContent = translation;
                        el.style.opacity = '1';
                    }, 150);
                } else {
                    el.textContent = translation;
                }
            }
        });
    },

    t(key) {
        return legalTranslations[this.currentLang][key] || key;
    }
};

// Initialize i18n on DOM ready
document.addEventListener('DOMContentLoaded', () => legalI18n.init());
