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

// ===== SCROLL REVEAL SYSTEM (IntersectionObserver) =====
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!prefersReducedMotion) {
    // Staggered card reveal — each card delays 100ms more
    const staggerContainers = document.querySelectorAll('.steps-grid, .value-grid');
    staggerContainers.forEach(container => {
        const cards = container.children;
        Array.from(cards).forEach((card, i) => {
            card.style.transitionDelay = `${i * 100}ms`;
        });
    });

    // IntersectionObserver for all reveal elements
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                revealObserver.unobserve(entry.target); // only trigger once
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .step-card, .value-card').forEach(el => {
        revealObserver.observe(el);
    });

    // ===== TRUST COUNTER ANIMATION =====
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounters();
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    const heroStats = document.querySelector('.hero-stats');
    if (heroStats) counterObserver.observe(heroStats);

    function animateCounters() {
        const statValues = document.querySelectorAll('.hero-stat-value');
        statValues.forEach(el => {
            const text = el.textContent.trim();
            // Parse target: "5,000+" → 5000, "50+" → 50, "4.8★" → 4.8
            const numStr = text.replace(/[^\d.]/g, '');
            const target = parseFloat(numStr);
            const suffix = text.replace(/[\d.,]/g, ''); // "+", "★"
            const hasComma = text.includes(',');
            const isDecimal = text.includes('.');
            const duration = 2000;
            const startTime = performance.now();

            function update(now) {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Ease-out cubic
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = eased * target;

                let formatted;
                if (isDecimal) {
                    formatted = current.toFixed(1);
                } else {
                    const rounded = Math.floor(current);
                    formatted = hasComma ? rounded.toLocaleString() : String(rounded);
                }
                el.textContent = formatted + suffix;

                if (progress < 1) requestAnimationFrame(update);
            }
            requestAnimationFrame(update);
        });
    }
} else {
    // Reduced motion: show everything immediately
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .step-card, .value-card').forEach(el => {
        el.classList.add('active');
    });
}

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
        'hero.cta1': 'Download the App',
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
        'step4.desc': 'Track your order in real-time and receive it at your doorstep. Same-day delivery with a 7-day return guarantee.',

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
        'gallery.item4': 'Industrial Workshop',
        'gallery.item5': 'Luxury Parts Available',

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
        'cta.orScan': 'Or scan to download',
        'cta.appStore': 'App Store',
        'cta.googlePlay': 'Google Play',

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
        'footer.email': '<svg class="footer-contact-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> support@qscrap.qa',
        'footer.phone': '<svg class="footer-contact-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> +974 5026 7974',
        'footer.whatsapp': '<svg class="footer-contact-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> WhatsApp Support',
        'footer.legalInfo': 'QScrap Services & Trading L.L.C | Doha, Qatar',
        'footer.copyright': '© 2026 QScrap. All rights reserved.',

        // Floating Action Widget Sequence - VVIP 2090 Galaxy
        'vvip.radar': 'Wherever you are in Qatar, the parts find you.',
        'vvip.radar.cta': 'Start Request',
        'vvip.maglev': 'Don\'t leave your seat. Lightning-speed delivery.',
        'vvip.maglev.cta': 'Order Now',
        'vvip.orb': 'Spare parts teleported to your door. No traffic, no stress.',
        'vvip.orb.cta': 'Get Started'
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
        'hero.cta1': 'حمّل التطبيق',
        'hero.cta2': 'للشركات',
        'hero.stat1.value': '+5,000',
        'hero.stat1.label': 'قطعة تم توصيلها',
        'hero.stat2.value': '+50',
        'hero.stat2.label': 'كراج معتمد',
        'hero.stat3.value': '★4.8',
        'hero.stat3.label': 'تقييم العملاء',

        // How It Works
        'steps.badge': 'كيف يعمل',
        'steps.title': 'احصل على قطعتك في 4 خطوات بسيطة',
        'steps.subtitle': 'من الطلب إلى التوصيل في أقل من ساعتين',
        'step1.title': 'اطلب',
        'step1.desc': 'صِف القطعة التي تحتاجها. أضف صوراً وتفاصيل سيارتك للدقة.',
        'step2.title': 'قارن العروض',
        'step2.desc': 'استلم عروض أسعار تنافسية من كراجات معتمدة. اختر أفضل عرض.',
        'step3.title': 'ادفع بأمان',
        'step3.desc': 'ادفع بالبطاقة أو نقداً عند الاستلام. مبلغك محفوظ في ضمان آمن.',
        'step4.title': 'استلم طلبك',
        'step4.desc': 'تتبع طلبك بالوقت الفعلي واستلمه على بابك. توصيل في نفس اليوم مع ضمان إرجاع 7 أيام.',

        // Value Props
        'value.badge': 'لماذا كيوسكراب',
        'value.title': 'الطريقة الذكية لشراء قطع الغيار',
        'value.subtitle': 'ثقة وجودة وراحة في كل طلب',
        'value1.title': 'جودة مضمونة',
        'value1.desc': 'كل قطعة يتم فحصها للتأكد من جودتها. سياسة إرجاع 7 أيام إذا لم تطابق توقعاتك.',
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
        'gallery.item4': 'ورشة صناعية',
        'gallery.item5': 'قطع فاخرة متوفرة',

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
        'cta.orScan': 'أو امسح للتحميل',
        'cta.appStore': 'آب ستور',
        'cta.googlePlay': 'جوجل بلاي',

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
        'footer.email': '<svg class="footer-contact-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> support@qscrap.qa',
        'footer.phone': '<svg class="footer-contact-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> <span dir="ltr">+974 5026 7974</span>',
        'footer.whatsapp': '<svg class="footer-contact-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> دعم واتساب',
        'footer.legalInfo': 'كيوسكراب للخدمات والتجارة ذ.م.م | الدوحة، قطر',
        'footer.copyright': 'كيوسكراب © 2026. جميع الحقوق محفوظة.',

        // Floating Action Widget Sequence - VVIP 2090 Galaxy (Premium Arabic Translations)
        'vvip.radar': 'أينما كنت في قطر، قطع الغيار تصلك.',
        'vvip.radar.cta': 'ابدأ الطلب',
        'vvip.maglev': 'من دون مغادرة مقعدك. توصيل بسرعة البرق.',
        'vvip.maglev.cta': 'اطلب الآن',
        'vvip.orb': 'قطع الغيار تُحضَر إلى بابك. من دون زحام، من دون توتر.',
        'vvip.orb.cta': 'ابدأ الآن'
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

        // Swap logo based on language (RTL Arabic logo vs LTR English logo)
        const logoSrc = lang === 'ar'
            ? '/assets/images/qscrap-logo-ar.png?v=2026opt'
            : '/assets/images/qscrap-logo.png?v=2026final';
        document.querySelectorAll('.nav-logo img, .footer-brand img').forEach(img => {
            img.src = logoSrc;
        });

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
                        el.innerHTML = translation;
                        el.style.opacity = '1';
                    }, 150);
                } else {
                    el.innerHTML = translation;
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

        // Dispatch custom event for VVIP widget and other listeners
        document.dispatchEvent(new CustomEvent('qscrap:langchange', {
            detail: { lang }
        }));
    },

    t(key) {
        return translations[this.currentLang][key] || key;
    }
};

// ===== 2026 MOBILE MENU SYSTEM - iOS Safari Safe =====
// Enterprise-grade mobile navigation with iOS touch event fixes

const mobileMenu = {
    isOpen: false,
    touchHandled: false,

    init() {
        const menuBtn = document.getElementById('mobileMenuBtn');
        const closeBtn = document.getElementById('mobileMenuClose');
        const backdrop = document.getElementById('mobileMenuBackdrop');
        const overlay = document.getElementById('mobileMenuOverlay');
        const panel = document.getElementById('mobileMenuPanel');
        const downloadBtn = document.getElementById('mobileDownloadBtn');

        if (!menuBtn || !overlay) return;

        // iOS Safari touch event fix: Use both touchstart and click
        // touchstart fires immediately on iOS, but we need click for other devices
        const handleToggle = (e) => {
            // Prevent double-firing on touch devices
            if (e.type === 'touchstart') {
                this.touchHandled = true;
                e.preventDefault(); // Prevent ghost click
            } else if (e.type === 'click' && this.touchHandled) {
                this.touchHandled = false;
                return;
            }

            this.toggle();
        };

        // Attach both touchstart and click for iOS compatibility
        menuBtn.addEventListener('touchstart', handleToggle, { passive: false });
        menuBtn.addEventListener('click', handleToggle);

        closeBtn?.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.close();
        }, { passive: false });
        closeBtn?.addEventListener('click', () => this.close());

        backdrop?.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.close();
        }, { passive: false });
        backdrop?.addEventListener('click', () => this.close());

        // Close on menu link click
        document.querySelectorAll('.mobile-menu-link').forEach(link => {
            link.addEventListener('click', () => {
                this.close();
            });
        });

        // Download button close
        downloadBtn?.addEventListener('click', () => {
            this.close();
        });

        // Mobile language switcher
        document.querySelectorAll('.mobile-lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                i18n.setLanguage(lang, true);
                // Update mobile button active state
                document.querySelectorAll('.mobile-lang-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.lang === lang);
                });
                this.close();
            });
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Sync mobile lang buttons with current language
        this.syncLangButtons();
    },

    syncLangButtons() {
        const currentLang = localStorage.getItem('qscrap-lang') || 'en';
        document.querySelectorAll('.mobile-lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === currentLang);
        });
    },

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },

    open() {
        const overlay = document.getElementById('mobileMenuOverlay');
        const menuBtn = document.getElementById('mobileMenuBtn');

        if (!overlay) return;

        this.isOpen = true;
        overlay.classList.add('active');
        document.body.classList.add('mobile-menu-open');
        overlay.setAttribute('aria-hidden', 'false');
        menuBtn?.classList.add('active');

        // Lock body scroll - iOS Safari safe
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.top = `-${window.scrollY}px`;

        // Focus trap - move focus to close button
        setTimeout(() => {
            document.getElementById('mobileMenuClose')?.focus();
        }, 100);

        // Sync language buttons
        this.syncLangButtons();
    },

    close() {
        const overlay = document.getElementById('mobileMenuOverlay');
        const menuBtn = document.getElementById('mobileMenuBtn');

        if (!overlay) return;

        this.isOpen = false;
        overlay.classList.remove('active');
        document.body.classList.remove('mobile-menu-open');
        overlay.setAttribute('aria-hidden', 'true');
        menuBtn?.classList.remove('active');

        // Restore body scroll - iOS Safari safe
        const scrollY = document.body.style.top;
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.top = '';
        window.scrollTo(0, parseInt(scrollY || '0') * -1);

        // Return focus to menu button
        menuBtn?.focus();
    }
};

// Initialize i18n on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    i18n.init();
    mobileMenu.init();
    vvipWidget.init();
});

// ===== VVIP "2090" WIDGET - INTELLIGENT FUNNEL SEQUENCE =====
// Premium scroll-based widget sequencing for ultimate user experience

const vvipWidget = {
    currentWidget: 'radar',
    isTransitioning: false,
    lastScrollPosition: 0,
    transitionTimeout: null,
    cooldownTimeout: null,

    // Scroll thresholds for widget transitions
    thresholds: {
        radar: { min: 0, max: 30 },      // 0-30% scroll
        maglev: { min: 30, max: 70 },    // 30-70% scroll
        orb: { min: 70, max: 100 }       // 70-100% scroll
    },

    init() {
        this.container = document.getElementById('vvipWidgetContainer');
        if (!this.container) {
            console.warn('[VVIP Widget] Container not found - widget disabled');
            return;
        }

        // Check for saved widget state from session
        const savedWidget = sessionStorage.getItem('vvip-last-widget');
        const startWidget = savedWidget || 'radar';

        // Cache widget elements with validation
        this.widgets = {
            radar: document.getElementById('vvipRadar'),
            maglev: document.getElementById('vvipMaglev'),
            orb: document.getElementById('vvipOrb')
        };

        // Validate all widgets exist
        const missingWidgets = Object.entries(this.widgets)
            .filter(([_, el]) => !el)
            .map(([name, _]) => name);

        if (missingWidgets.length > 0) {
            console.error('[VVIP Widget] Missing widgets:', missingWidgets);
            return;
        }

        // Cache text elements
        this.textElements = {
            radar: document.getElementById('vvipRadarText'),
            maglev: document.getElementById('vvipMaglevText'),
            orb: document.getElementById('vvipOrbText')
        };

        // Cache CTA buttons
        this.ctaElements = {
            radar: document.getElementById('vvipRadarCta'),
            maglev: document.getElementById('vvipMaglevCta'),
            orb: document.getElementById('vvipOrbCta')
        };

        // Initialize with saved or default widget
        this.currentWidget = startWidget;
        
        // Update ALL widget texts on initialization (for current language)
        this.updateAllWidgetTexts();
        
        this.showWidget(startWidget);

        // Setup scroll listener with throttling
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    this.handleScroll();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        // Setup CTA button clicks and touch interactions
        this.setupCTAListeners();

        // Update text on language change
        document.addEventListener('qscrap:langchange', (e) => {
            this.updateWidgetText(e.detail.lang);
        });

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.destroy();
        });

        console.log('[VVIP Widget] Initialized with intelligent sequencing');
    },

    handleScroll() {
        if (this.isTransitioning) return;

        const scrollPercent = this.getScrollPercentage();
        const targetWidget = this.getWidgetForScrollPosition(scrollPercent);

        if (targetWidget !== this.currentWidget) {
            this.transitionToWidget(targetWidget);
        }

        this.lastScrollPosition = scrollPercent;
    },

    getScrollPercentage() {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        return docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    },

    getWidgetForScrollPosition(scrollPercent) {
        for (const [widget, range] of Object.entries(this.thresholds)) {
            if (scrollPercent >= range.min && scrollPercent < range.max) {
                return widget;
            }
        }
        return 'orb'; // Default to orb at 100%
    },

    transitionToWidget(targetWidget) {
        // Cancel any pending transition to prevent race condition
        if (this.transitionTimeout) {
            clearTimeout(this.transitionTimeout);
        }

        this.isTransitioning = true;

        // Hide current widget
        this.hideWidget(this.currentWidget);

        this.transitionTimeout = setTimeout(() => {
            this.showWidget(targetWidget);
            this.currentWidget = targetWidget;

            // Save to session storage for page reload persistence
            sessionStorage.setItem('vvip-last-widget', targetWidget);

            this.transitionTimeout = null;

            this.cooldownTimeout = setTimeout(() => {
                this.isTransitioning = false;
            }, 800);
        }, 400);
    },

    showWidget(widgetName) {
        const widget = this.widgets[widgetName];
        if (!widget) return;

        widget.classList.remove('vvip-widget-hidden');
        widget.classList.add('vvip-widget-visible');
        
        // Update i18n text
        this.updateWidgetText(i18n.currentLang);
    },

    hideWidget(widgetName) {
        const widget = this.widgets[widgetName];
        if (!widget) return;

        widget.classList.remove('vvip-widget-visible');
        widget.classList.add('vvip-widget-hidden');
    },

    updateWidgetText(lang) {
        // Update ALL widget texts when language changes
        this.updateAllWidgetTexts();
    },

    // Update text for all widgets (called on init and language change)
    updateAllWidgetTexts() {
        // Update radar text
        if (this.textElements.radar) {
            this.textElements.radar.textContent = i18n.t(`vvip.radar`);
        }
        if (this.ctaElements.radar) {
            this.ctaElements.radar.textContent = i18n.t(`vvip.radar.cta`);
        }

        // Update maglev text
        if (this.textElements.maglev) {
            this.textElements.maglev.textContent = i18n.t(`vvip.maglev`);
        }
        if (this.ctaElements.maglev) {
            this.ctaElements.maglev.textContent = i18n.t(`vvip.maglev.cta`);
        }

        // Update orb text
        if (this.textElements.orb) {
            this.textElements.orb.textContent = i18n.t(`vvip.orb`);
        }
        if (this.ctaElements.orb) {
            this.ctaElements.orb.textContent = i18n.t(`vvip.orb.cta`);
        }
    },

    setupCTAListeners() {
        // All CTAs scroll to download section
        Object.values(this.ctaElements).forEach(cta => {
            if (cta) {
                cta.addEventListener('click', (e) => {
                    e.preventDefault();
                    const downloadSection = document.getElementById('download');
                    if (downloadSection) {
                        downloadSection.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                });
            }
        });

        // Also make the entire widget clickable
        Object.values(this.widgets).forEach(widget => {
            if (widget) {
                widget.addEventListener('click', (e) => {
                    // Don't trigger if clicking on CTA button (already handled)
                    if (e.target.closest('.vvip-cta-btn')) return;

                    const downloadSection = document.getElementById('download');
                    if (downloadSection) {
                        downloadSection.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                });

                // Touch interaction for mobile (iOS Safari)
                widget.addEventListener('touchstart', (e) => {
                    widget.classList.toggle('vvip-widget-active');
                }, { passive: true });
            }
        });
    },

    // Cleanup timeouts on page unload
    destroy() {
        if (this.transitionTimeout) {
            clearTimeout(this.transitionTimeout);
            this.transitionTimeout = null;
        }
        if (this.cooldownTimeout) {
            clearTimeout(this.cooldownTimeout);
            this.cooldownTimeout = null;
        }
    }
};
