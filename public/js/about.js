// ===== 2026 BILINGUAL I18N SYSTEM FOR ABOUT PAGE =====
// Professional Arabic translations for Qatari market

const translations = {
    en: {
        // Navigation
        'nav.home': 'Home',
        'nav.forBusiness': 'For Businesses',
        'nav.contact': 'Contact Us',

        // Hero Section
        'hero.badge': 'About Us',
        'hero.title1': 'Transforming',
        'hero.title2': "Qatar's Automotive",
        'hero.title3': 'Parts Industry',
        'hero.subtitle': "QScrap is Qatar's premium B2B+B2C marketplace connecting verified garages with customers seeking quality new, used, and OEM automotive parts.",

        // Mission Section
        'mission.title': 'Our Mission',
        'mission.p1': "We're on a mission to revolutionize how Qatar sources automotive parts. By connecting customers directly with verified garages, we eliminate the middlemen, reduce costs, and ensure quality parts reach you faster.",
        'mission.p2': "Our platform handles everything from discovery to delivery, providing a seamless experience backed by Qatar's strongest consumer protections including a <strong>7-day return guarantee</strong> and secure escrow payments.",
        'mission.p3': 'Whether you need a rare OEM part or a standard replacement, QScrap connects you with the right garage in minutes, not days.',
        'mission.visual.title': 'Connecting Parts to People',
        'mission.visual.subtitle': 'Technology-powered marketplace for the modern automotive industry',

        // Values Section
        'values.badge': 'Our Values',
        'values.title': 'What Drives Us Forward',
        'values.subtitle': 'Built on principles that put customers and partners first',
        'value1.title': 'Trust & Transparency',
        'value1.desc': 'Every garage is verified. Every transaction is protected. We believe in complete transparency with no hidden fees.',
        'value2.title': 'Speed & Efficiency',
        'value2.desc': 'From request to delivery, our platform is optimized for speed. Same-day delivery across Doha with real-time tracking.',
        'value3.title': 'Partner Success',
        'value3.desc': 'We grow when our partners grow. Our tiers help garages of all sizes succeed in the digital marketplace.',

        // Stats Section
        'stat1.value': '50+',
        'stat1.label': 'Verified Garages',
        'stat2.value': '5,000+',
        'stat2.label': 'Parts Delivered',
        'stat3.value': '98%',
        'stat3.label': 'Customer Satisfaction',
        'stat4.value': '7-Day',
        'stat4.label': 'Return Guarantee',

        // Company Info Section Header
        'company.badge': 'Company Information',
        'company.title': 'Legal & Contact Details',
        'company.subtitle': 'Registered and operating in the State of Qatar',

        // Info Cards - Legal Identity
        'info.legal.title': 'Legal Identity',
        'info.legal.company': '<strong>Company Name:</strong><br>QScrap Services & Trading L.L.C<br>كيوسكراب للخدمات والتجارة ذ.م.م',
        'info.legal.location': '<strong>Location:</strong><br>Doha, Qatar',

        // Info Cards - Contact Us
        'info.contact.title': 'Contact Us',
        'info.contact.support': '<strong>Customer Support:</strong><br><a href="mailto:support@qscrap.qa">support@qscrap.qa</a>',
        'info.contact.mobile': '<strong>WhatsApp Support:</strong><br><a href="tel:+97450267974">+974 5026 7974</a>',
        'info.contact.hours': '<strong>Business Hours:</strong><br>Sunday - Thursday: 8:00 AM - 5:00 PM<br>Saturday: 8:00 AM - 3:00 PM<br>Friday: Closed',

        // Info Cards - Consumer Protection
        'info.protection.title': 'Consumer Protection',
        'info.protection.intro': "QScrap operates in full compliance with Qatar's consumer protection laws:",
        'info.protection.laws': '<strong>Law No. 8 of 2008</strong> - Consumer Protection<br><strong>Law No. 13 of 2016</strong> - Personal Data Protection<br><strong>MOCI Decision 25/2024</strong> - E-Commerce Regulations',

        // Info Cards - Download App
        'info.app.title': 'Download Our App',
        'info.app.intro': 'Get the QScrap mobile app for the best experience:',
        'info.app.customers': '<strong>For Customers:</strong><br>Find parts, track orders, and enjoy same-day delivery.',
        'info.app.drivers': '<strong>For Drivers:</strong><br>Join our delivery network and earn more.',
        'info.app.available': '<em>Available on iOS and Android</em>',

        // CTA Section
        'cta.title': 'Ready to Get Started?',
        'cta.subtitle': 'Download the QScrap app and find your part today. Fast, easy, and guaranteed.',
        'cta.download': 'Download App',
        'cta.partner': 'Become a Partner',

        // Footer
        'footer.tagline': "Qatar's premium automotive parts marketplace. Connecting customers with verified garages for quality new, used, and OEM parts.",
        'footer.company': 'Company',
        'footer.aboutUs': 'About Us',
        'footer.forBusiness': 'For Businesses',
        'footer.contact': 'Contact',
        'footer.howItWorks': 'How It Works',
        'footer.legal': 'Legal',
        'footer.privacy': 'Privacy Policy',
        'footer.terms': 'Terms of Service',
        'footer.refund': 'Refund Policy',
        'footer.contactTitle': 'Contact',
        'footer.email': '<svg class="footer-contact-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> support@qscrap.qa',
        'footer.phone': '<svg class="footer-contact-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> +974 5026 7974',
        'footer.whatsapp': '<svg class="footer-contact-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> WhatsApp Support',
        'footer.legalInfo': 'QScrap Services & Trading L.L.C | Doha, Qatar',
        'footer.copyright': '© 2026 QScrap. All rights reserved.'
    },
    ar: {
        // Navigation
        'nav.home': 'الرئيسية',
        'nav.forBusiness': 'للشركات',
        'nav.contact': 'تواصل معنا',

        // Hero Section
        'hero.badge': 'من نحن',
        'hero.title1': 'نحوّل',
        'hero.title2': 'قطاع قطع غيار',
        'hero.title3': 'السيارات في قطر',
        'hero.subtitle': 'كيوسكراب هو سوق قطر المتميز للأعمال التجارية والمستهلكين، يربط الكراجات المعتمدة بالعملاء الباحثين عن قطع غيار سيارات جديدة ومستعملة وأصلية.',

        // Mission Section
        'mission.title': 'مهمتنا',
        'mission.p1': 'نحن في مهمة لإحداث ثورة في كيفية الحصول على قطع غيار السيارات في قطر. من خلال ربط العملاء مباشرة بالكراجات المعتمدة، نتخلص من الوسطاء ونخفض التكاليف ونضمن وصول القطع عالية الجودة إليك بشكل أسرع.',
        'mission.p2': 'منصتنا تتولى كل شيء من البحث إلى التوصيل، مع تجربة سلسة مدعومة بأقوى حماية للمستهلك في قطر بما في ذلك <strong>ضمان إرجاع 7 أيام</strong> ومدفوعات ضمان آمنة.',
        'mission.p3': 'سواء كنت بحاجة إلى قطعة أصلية نادرة أو بديل قياسي، كيوسكراب يربطك بالكراج المناسب في دقائق وليس أيام.',
        'mission.visual.title': 'نربط القطع بالناس',
        'mission.visual.subtitle': 'سوق مدعوم بالتكنولوجيا لصناعة السيارات الحديثة',

        // Values Section
        'values.badge': 'قيمنا',
        'values.title': 'ما يدفعنا للأمام',
        'values.subtitle': 'مبنية على مبادئ تضع العملاء والشركاء أولاً',
        'value1.title': 'الثقة والشفافية',
        'value1.desc': 'كل كراج موثق. كل معاملة محمية. نؤمن بالشفافية الكاملة بدون رسوم خفية.',
        'value2.title': 'السرعة والكفاءة',
        'value2.desc': 'من الطلب إلى التوصيل، منصتنا محسّنة للسرعة. توصيل في نفس اليوم في الدوحة مع تتبع لحظة بلحظة.',
        'value3.title': 'نجاح الشركاء',
        'value3.desc': 'ننمو عندما ينمو شركاؤنا. مستوياتنا تساعد الكراجات من جميع الأحجام على النجاح في السوق الرقمي.',

        // Stats Section
        'stat1.value': '+50',
        'stat1.label': 'كراج معتمد',
        'stat2.value': '+5,000',
        'stat2.label': 'قطعة تم توصيلها',
        'stat3.value': '98%',
        'stat3.label': 'رضا العملاء',
        'stat4.value': '7 أيام',
        'stat4.label': 'ضمان الإرجاع',

        // Company Info Section Header
        'company.badge': 'معلومات الشركة',
        'company.title': 'التفاصيل القانونية والتواصل',
        'company.subtitle': 'مسجلة وتعمل في دولة قطر',

        // Info Cards - Legal Identity
        'info.legal.title': 'الهوية القانونية',
        'info.legal.company': '<strong>اسم الشركة:</strong><br>QScrap Services & Trading L.L.C<br>كيوسكراب للخدمات والتجارة ذ.م.م',
        'info.legal.location': '<strong>الموقع:</strong><br>الدوحة، قطر',

        // Info Cards - Contact Us
        'info.contact.title': 'تواصل معنا',
        'info.contact.support': '<strong>دعم العملاء:</strong><br><a href="mailto:support@qscrap.qa">support@qscrap.qa</a>',
        'info.contact.mobile': '<strong>دعم واتساب:</strong><br><a href="tel:+97450267974" dir="ltr">+974 5026 7974</a>',
        'info.contact.hours': '<strong>ساعات العمل:</strong><br>الأحد - الخميس: 8:00 صباحاً - 5:00 مساءً<br>السبت: 8:00 صباحاً - 3:00 مساءً<br>الجمعة: مغلق',

        // Info Cards - Consumer Protection
        'info.protection.title': 'حماية المستهلك',
        'info.protection.intro': 'كيوسكراب تعمل بالامتثال الكامل لقوانين حماية المستهلك في قطر:',
        'info.protection.laws': '<strong>القانون رقم 8 لسنة 2008</strong> - حماية المستهلك<br><strong>القانون رقم 13 لسنة 2016</strong> - حماية البيانات الشخصية<br><strong>قرار وزارة التجارة 25/2024</strong> - لوائح التجارة الإلكترونية',

        // Info Cards - Download App
        'info.app.title': 'حمّل تطبيقنا',
        'info.app.intro': 'احصل على تطبيق كيوسكراب للحصول على أفضل تجربة:',
        'info.app.customers': '<strong>للعملاء:</strong><br>ابحث عن القطع، تتبع الطلبات، واستمتع بالتوصيل في نفس اليوم.',
        'info.app.drivers': '<strong>للسائقين:</strong><br>انضم إلى شبكة التوصيل لدينا واكسب المزيد.',
        'info.app.available': '<em>متوفر على iOS و Android</em>',

        // CTA Section
        'cta.title': 'مستعد للبدء؟',
        'cta.subtitle': 'حمّل تطبيق كيوسكراب واعثر على قطعتك اليوم. سريع وسهل ومضمون.',
        'cta.download': 'حمّل التطبيق',
        'cta.partner': 'كن شريكاً',

        // Footer
        'footer.tagline': 'سوق قطع غيار السيارات المتميز في قطر. نربط العملاء بكراجات معتمدة للحصول على قطع جديدة ومستعملة وأصلية.',
        'footer.company': 'الشركة',
        'footer.aboutUs': 'من نحن',
        'footer.forBusiness': 'للشركات',
        'footer.contact': 'تواصل',
        'footer.howItWorks': 'كيف يعمل',
        'footer.legal': 'قانوني',
        'footer.privacy': 'سياسة الخصوصية',
        'footer.terms': 'شروط الخدمة',
        'footer.refund': 'سياسة الاسترداد',
        'footer.contactTitle': 'تواصل معنا',
        'footer.email': '<svg class="footer-contact-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> support@qscrap.qa',
        'footer.phone': '<svg class="footer-contact-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> <span dir="ltr">+974 5026 7974</span>',
        'footer.whatsapp': '<svg class="footer-contact-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> دعم واتساب',
        'footer.legalInfo': 'كيوسكراب للخدمات والتجارة ذ.م.م | الدوحة، قطر',
        'footer.copyright': 'كيوسكراب © 2026. جميع الحقوق محفوظة.'
    }
};

// i18n System
const i18n = {
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

        // Swap logo based on language (RTL Arabic logo vs LTR English logo)
        const logoSrc = lang === 'ar'
            ? '/assets/images/qscrap-logo-ar.png?v=2026opt'
            : '/assets/images/qscrap-logo.png?v=2026final';
        document.querySelectorAll('.nav-logo img, .footer-brand img').forEach(img => {
            img.src = logoSrc;
        });

        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            const translation = translations[lang][key];
            if (translation) {
                if (animate) {
                    el.style.opacity = '0';
                    setTimeout(() => {
                        el.innerHTML = translation; // Use innerHTML to support <strong> tags
                        el.style.opacity = '1';
                    }, 150);
                } else {
                    el.innerHTML = translation;
                }
            }
        });
    },

    t(key) {
        return translations[this.currentLang][key] || key;
    }
};

// Initialize i18n on DOM ready
document.addEventListener('DOMContentLoaded', () => i18n.init());
