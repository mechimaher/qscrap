// Hero Background Slideshow
const slides = document.querySelectorAll('.hero-bg-slide');
let currentSlide = 0;
function nextSlide() {
    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add('active');
}
setInterval(nextSlide, 5000);

// Navigation scroll effect
const nav = document.getElementById('mainNav');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
});

// Reveal on scroll animations
const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
const revealOnScroll = () => {
    reveals.forEach(el => {
        const rect = el.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        if (rect.top < windowHeight - 100) {
            el.classList.add('active');
        }
    });
};
window.addEventListener('scroll', revealOnScroll);
window.addEventListener('load', revealOnScroll);

// ===== 2026 BILINGUAL I18N SYSTEM =====
// Professional Arabic translations for Qatari market
const translations = {
    en: {
        // Navigation
        'nav.howItWorks': 'How It Works',
        'nav.gallery': 'Gallery',
        'nav.forBusiness': 'For Businesses',
        'nav.about': 'About',
        'nav.download': 'Download App',

        // Hero Section
        'hero.badge': "Qatar's #1 Auto Parts Platform",
        'hero.title1': "Qatar's Premium",
        'hero.title2': 'Automotive Parts',
        'hero.title3': 'Marketplace',
        'hero.subtitle': 'New • Used • Genuine OEM — Delivered Same Day to Your Door',
        'hero.cta1': 'Download App - It\'s Free',
        'hero.cta2': 'For Businesses',
        'hero.stat1.value': '5,000+',
        'hero.stat1.label': 'Parts Delivered',
        'hero.stat2.value': '50+',
        'hero.stat2.label': 'Verified Garages',
        'hero.stat3.value': '4.8★',
        'hero.stat3.label': 'Customer Rating',

        // How It Works
        'steps.badge': 'How It Works',
        'steps.title': 'Get Your Part in 4 Simple Steps',
        'steps.subtitle': 'From request to delivery in as little as 2 hours',
        'step1.title': 'Request',
        'step1.desc': 'Describe the part you need. Add photos and your car details for accuracy.',
        'step2.title': 'Compare Bids',
        'step2.desc': 'Receive competitive quotes from verified garages. Choose the best offer.',
        'step3.title': 'Pay Securely',
        'step3.desc': 'Pay with card or cash on delivery. Your payment is held in escrow.',
        'step4.title': 'Get It Delivered',
        'step4.desc': 'Same-day delivery across Qatar. 7-day return guarantee included.',

        // Value Props
        'value.badge': 'Why QScrap',
        'value.title': 'The Smart Way to Buy Auto Parts',
        'value.subtitle': 'Trust, quality, and convenience in every order',
        'value1.title': 'Quality Guaranteed',
        'value1.desc': 'Every part is verified for quality. 7-day return policy if anything doesn\'t match your expectations.',
        'value2.title': 'Same-Day Delivery',
        'value2.desc': 'Get parts delivered to your door across Doha within hours. Real-time tracking included.',
        'value3.title': 'Best Prices',
        'value3.desc': 'Compare quotes from multiple garages. Find the best deal without calling around.',
        'value4.title': 'Secure Payments',
        'value4.desc': 'Pay by card or COD. Escrow protection ensures your money is safe until you\'re satisfied.',
        'value5.title': 'Verified Garages',
        'value5.desc': 'All garages are vetted and verified. Buy with confidence from trusted sellers.',
        'value6.title': 'Easy Mobile App',
        'value6.desc': 'Request parts, track orders, and manage everything from our intuitive mobile app.',

        // Gallery
        'gallery.badge': 'Our Quality',
        'gallery.title': 'Premium Parts Gallery',
        'gallery.subtitle': 'Genuine OEM and quality-verified parts from trusted suppliers',
        'gallery.item1': 'Complete Vehicle Components',
        'gallery.item2': 'Engine Internals',
        'gallery.item3': 'Expert Selection',
        'gallery.item4': 'Premium BMW Components',
        'gallery.item5': 'Luxury Parts Available',
        'gallery.item6': 'Industrial Workshop',

        // Showcase
        'showcase.label': 'Parts Showcase',
        'showcase.title': 'Thousands of Quality Parts',

        // Carousel
        'carousel.item1.title': 'Engine Components',
        'carousel.item1.desc': 'Premium quality internals',
        'carousel.item2.title': 'BMW Premium Parts',
        'carousel.item2.desc': 'OEM & Aftermarket',
        'carousel.item3.title': 'Full Catalog',
        'carousel.item3.desc': 'Every part you need',
        'carousel.item4.title': 'Performance Engines',
        'carousel.item4.desc': 'High-performance parts',
        'carousel.item5.title': 'Expert Service',
        'carousel.item5.desc': 'Professional guidance',
        'carousel.item6.title': 'Industrial Scale',
        'carousel.item6.desc': 'Massive inventory',

        // CTA
        'cta.title': 'Ready to Find Your Part?',
        'cta.subtitle': 'Download the QScrap app and get started in minutes. It\'s free!',
        'cta.ios': 'Download for iOS',
        'cta.android': 'Download for Android',

        // Footer
        'footer.tagline': 'Qatar\'s premium automotive parts marketplace. Connecting customers with verified garages for quality new, used, and OEM parts.',
        'footer.company': 'Company',
        'footer.legal': 'Legal',
        'footer.contactTitle': 'Contact',
        'footer.aboutUs': 'About Us',
        'footer.forBusiness': 'For Businesses',
        'footer.contact': 'Contact',
        'footer.howItWorks': 'How It Works',
        'footer.privacy': 'Privacy Policy',
        'footer.terms': 'Terms of Service',
        'footer.refund': 'Refund Policy',
        'footer.email': '📧 support@qscrap.qa',
        'footer.phone': '📞 +974 5026 7974',
        'footer.whatsapp': '💬 WhatsApp Support',
        'footer.legalInfo': 'QScrap Services & Trading L.L.C | CR: 155892 | P.O. Box 32544, Doha, Qatar',
        'footer.copyright': '© 2026 QScrap. All rights reserved.',

        // Floating Action Widget
        'fab.text': 'Request Parts Now'
    },
    ar: {
        // Navigation
        'nav.howItWorks': 'كيف يعمل',
        'nav.gallery': 'المعرض',
        'nav.forBusiness': 'للشركات',
        'nav.about': 'من نحن',
        'nav.download': 'تحميل التطبيق',

        // Hero Section
        'hero.badge': 'المنصة الأولى لقطع غيار السيارات في قطر',
        'hero.title1': 'سوق قطع غيار',
        'hero.title2': 'السيارات المتميز',
        'hero.title3': 'في قطر',
        'hero.subtitle': 'جديد • مستعمل • قطع أصلية — توصيل في نفس اليوم إلى باب منزلك',
        'hero.cta1': 'حمّل التطبيق مجاناً',
        'hero.cta2': 'للشركات',
        'hero.stat1.value': '+٥,٠٠٠',
        'hero.stat1.label': 'قطعة تم توصيلها',
        'hero.stat2.value': '+٥٠',
        'hero.stat2.label': 'كراج معتمد',
        'hero.stat3.value': '★٤.٨',
        'hero.stat3.label': 'تقييم العملاء',

        // How It Works
        'steps.badge': 'كيف يعمل',
        'steps.title': 'احصل على قطعتك في ٤ خطوات بسيطة',
        'steps.subtitle': 'من الطلب إلى التوصيل في أقل من ساعتين',
        'step1.title': 'اطلب',
        'step1.desc': 'صِف القطعة التي تحتاجها. أضف صوراً وتفاصيل سيارتك للدقة.',
        'step2.title': 'قارن العروض',
        'step2.desc': 'استلم عروض أسعار تنافسية من كراجات معتمدة. اختر أفضل عرض.',
        'step3.title': 'ادفع بأمان',
        'step3.desc': 'ادفع بالبطاقة أو نقداً عند الاستلام. مبلغك محفوظ في ضمان آمن.',
        'step4.title': 'استلم طلبك',
        'step4.desc': 'توصيل في نفس اليوم في جميع أنحاء قطر. ضمان إرجاع ٧ أيام.',

        // Value Props
        'value.badge': 'لماذا كيوسكراب',
        'value.title': 'الطريقة الذكية لشراء قطع الغيار',
        'value.subtitle': 'ثقة وجودة وراحة في كل طلب',
        'value1.title': 'جودة مضمونة',
        'value1.desc': 'كل قطعة يتم فحصها للتأكد من جودتها. سياسة إرجاع ٧ أيام إذا لم تطابق توقعاتك.',
        'value2.title': 'توصيل في نفس اليوم',
        'value2.desc': 'احصل على قطع الغيار إلى بابك في الدوحة خلال ساعات. تتبع لحظة بلحظة.',
        'value3.title': 'أفضل الأسعار',
        'value3.desc': 'قارن عروض الأسعار من كراجات متعددة. احصل على أفضل سعر بدون الاتصال بالجميع.',
        'value4.title': 'دفع آمن',
        'value4.desc': 'ادفع بالبطاقة أو نقداً عند الاستلام. حماية الضمان تضمن أمان أموالك.',
        'value5.title': 'كراجات معتمدة',
        'value5.desc': 'جميع الكراجات موثقة ومعتمدة. اشترِ بثقة من بائعين موثوقين.',
        'value6.title': 'تطبيق سهل',
        'value6.desc': 'اطلب قطع الغيار، تتبع طلباتك، وأدر كل شيء من تطبيقنا السهل.',

        // Gallery
        'gallery.badge': 'جودتنا',
        'gallery.title': 'معرض القطع المتميزة',
        'gallery.subtitle': 'قطع أصلية من المصنّع وقطع معتمدة الجودة من موردين موثوقين',
        'gallery.item1': 'مكونات السيارة الكاملة',
        'gallery.item2': 'أجزاء المحرك الداخلية',
        'gallery.item3': 'اختيار الخبراء',
        'gallery.item4': 'قطع BMW المتميزة',
        'gallery.item5': 'قطع فاخرة متوفرة',
        'gallery.item6': 'ورشة صناعية',

        // Showcase
        'showcase.label': 'معرض القطع',
        'showcase.title': 'آلاف القطع عالية الجودة',

        // Carousel
        'carousel.item1.title': 'مكونات المحرك',
        'carousel.item1.desc': 'قطع داخلية متميزة',
        'carousel.item2.title': 'قطع BMW المتميزة',
        'carousel.item2.desc': 'أصلية وبديلة',
        'carousel.item3.title': 'كتالوج شامل',
        'carousel.item3.desc': 'كل قطعة تحتاجها',
        'carousel.item4.title': 'محركات عالية الأداء',
        'carousel.item4.desc': 'قطع أداء متميزة',
        'carousel.item5.title': 'خدمة الخبراء',
        'carousel.item5.desc': 'إرشاد متخصص',
        'carousel.item6.title': 'حجم صناعي',
        'carousel.item6.desc': 'مخزون ضخم',

        // CTA
        'cta.title': 'مستعد للعثور على قطعتك؟',
        'cta.subtitle': 'حمّل تطبيق كيوسكراب وابدأ في دقائق. مجاناً!',
        'cta.ios': 'تحميل لـ iOS',
        'cta.android': 'تحميل لـ Android',

        // Footer
        'footer.tagline': 'سوق قطع غيار السيارات المتميز في قطر. نربط العملاء بكراجات معتمدة للحصول على قطع جديدة ومستعملة وأصلية.',
        'footer.company': 'الشركة',
        'footer.legal': 'قانوني',
        'footer.contactTitle': 'تواصل معنا',
        'footer.aboutUs': 'من نحن',
        'footer.forBusiness': 'للشركات',
        'footer.contact': 'تواصل',
        'footer.howItWorks': 'كيف يعمل',
        'footer.privacy': 'سياسة الخصوصية',
        'footer.terms': 'شروط الخدمة',
        'footer.refund': 'سياسة الاسترداد',
        'footer.email': '📧 support@qscrap.qa',
        'footer.phone': '📞 +974 5026 7974',
        'footer.whatsapp': '💬 دعم واتساب',
        'footer.legalInfo': 'كيوسكراب للخدمات والتجارة ذ.م.م | سجل تجاري: ١٥٥٨٩٢ | ص.ب: ٣٢٥٤٤، الدوحة، قطر',
        'footer.copyright': 'كيوسكراب © ٢٠٢٦. جميع الحقوق محفوظة.',

        // Floating Action Widget
        'fab.text': 'اطلب قطع الغيار الآن'
    }
};

// i18n System
const i18n = {
    currentLang: localStorage.getItem('qscrap-lang') || 'en',

    init() {
        // Set initial language
        this.setLanguage(this.currentLang, false);

        // Setup language button listeners
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

        // Update HTML attributes for RTL
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

        // Update active button state
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        // Translate all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            const translation = translations[lang][key];
            if (translation) {
                if (animate) {
                    el.style.opacity = '0';
                    setTimeout(() => {
                        el.textContent = translation;
                        el.style.opacity = '1';
                    }, 150);
                } else {
                    el.textContent = translation;
                }
            }
        });

        // Update placeholders and aria-labels
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            const translation = translations[lang][key];
            if (translation) el.placeholder = translation;
        });

        document.querySelectorAll('[data-i18n-aria]').forEach(el => {
            const key = el.dataset.i18nAria;
            const translation = translations[lang][key];
            if (translation) el.setAttribute('aria-label', translation);
        });
    },

    t(key) {
        return translations[this.currentLang][key] || key;
    }
};

// Initialize i18n on DOM ready
document.addEventListener('DOMContentLoaded', () => i18n.init());
