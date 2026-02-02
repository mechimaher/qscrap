/**
 * QScrap Partners Page - Internationalization (i18n) System
 * Enterprise Bilingual Support: English + Arabic
 * Version: 1.0
 */

// ==============================================
// TRANSLATION DICTIONARY
// ==============================================
const translations = {
    en: {
        // Navigation
        'nav.backHome': 'Back to Home',
        'nav.applyNow': 'Apply Now',

        // Logo
        'logo.alt': 'QScrap Logo',

        // Page Metadata (SEO)
        'page.title': 'Become a Partner Garage | QScrap Qatar - Grow Your Parts Business',
        'page.description': 'Join Qatar\'s fastest-growing automotive parts marketplace. Reach thousands of customers, increase sales, and get guaranteed payouts. Apply to become a QScrap Partner Garage today.',

        // Hero Section
        'hero.badge': '🚀 Partner Program',
        'hero.title': 'Grow Your <span>Parts Business</span> With Qatar\'s #1 Marketplace',
        'hero.subtitle': 'Join 50+ verified garages already earning more through QScrap. Zero upfront costs, guaranteed payouts, and thousands of customers waiting for your parts.',
        'hero.cta.apply': 'Apply to Join',
        'hero.cta.benefits': 'See Benefits',

        // Stats Bar
        'stats.partners.number': '50+',
        'stats.partners.label': 'Partner Garages',
        'stats.orders.number': '5,000+',
        'stats.orders.label': 'Monthly Orders',
        'stats.satisfaction.number': '98%',
        'stats.satisfaction.label': 'Partner Satisfaction',
        'stats.warranty.number': '7-Day',
        'stats.warranty.label': 'Warranty Protected',

        // Benefits Section
        'benefits.label': 'Why Partner With Us',
        'benefits.title': 'Everything You Need to Scale Your Business',
        'benefits.subtitle': 'QScrap handles the technology, logistics, and customers — you focus on providing quality parts.',

        'benefit1.title': 'Guaranteed Payouts',
        'benefit1.desc': 'Get paid reliably after the 7-day warranty period. Secure, transparent process. Direct bank transfer to your account.',
        'benefit2.title': 'Easy Dashboard',
        'benefit2.desc': 'Manage bids, track orders, and view earnings from our intuitive garage dashboard. Works on any device.',
        'benefit3.title': 'We Handle Delivery',
        'benefit3.desc': 'Our verified driver network picks up and delivers to customers. You never leave your garage.',
        'benefit4.title': 'More Customers',
        'benefit4.desc': 'Access thousands of active buyers in Qatar looking for parts. Expand your reach without marketing spend.',
        'benefit5.title': 'Verified Badge',
        'benefit5.desc': 'Build trust with customers through our verification system. Higher visibility, more bids accepted.',
        'benefit6.title': 'Dispute Protection',
        'benefit6.desc': 'Our support team handles customer issues. Fair resolution process protects your business.',

        // How It Works Section
        'hiw.label': 'How It Works',
        'hiw.title': 'Start Earning in 4 Simple Steps',
        'hiw.subtitle': 'From application to your first sale — we make it seamless.',

        'step1.title': 'Apply Online',
        'step1.desc': 'Submit your garage details and commercial registration. Takes just 5 minutes.',
        'step2.title': 'Get Verified',
        'step2.desc': 'Our team reviews and verifies your business within 24-48 hours.',
        'step3.title': 'Receive Requests',
        'step3.desc': 'Start receiving part requests matching your inventory. Bid competitively.',
        'step4.title': 'Earn & Grow',
        'step4.desc': 'Fulfill orders, receive guaranteed payouts, and grow your customer base.',

        // Pricing Tiers Section
        'tiers.label': 'Flexible Pricing',
        'tiers.title': 'Choose What Works for You',
        'tiers.subtitle': 'No upfront fees. Only pay when you make sales.',

        // Pay-Per-Sale Tier
        'tier1.name': 'Pay-Per-Sale',
        'tier1.commission': '15%',
        'tier1.perOrder': 'per order',
        'tier1.desc': 'Perfect for new garages',
        'tier1.feature1': 'Zero monthly fees',
        'tier1.feature2': 'Access to all customers',
        'tier1.feature3': 'Standard dashboard',
        'tier1.feature4': 'Email support',
        'tier1.feature5': 'Guaranteed 7-day payouts',
        'tier1.cta': 'Get Started Free',

        // Gold Partner Tier
        'tier2.badge': 'Most Popular',
        'tier2.name': 'Gold Partner',
        'tier2.commission': '5%',
        'tier2.perOrder': 'per order',
        'tier2.desc': 'Best value for active garages',
        'tier2.feature1': 'QAR 999/month subscription',
        'tier2.feature2': 'Priority listing in search',
        'tier2.feature3': 'Advanced analytics',
        'tier2.feature4': 'Priority phone support',
        'tier2.feature5': 'Priority 7-day payouts',
        'tier2.feature6': 'Promotional features',
        'tier2.cta': 'Apply for Gold',

        // Platinum Partner Tier
        'tier3.name': 'Platinum Partner',
        'tier3.commission': '3%',
        'tier3.perOrder': 'per order',
        'tier3.desc': 'For high-volume sellers',
        'tier3.feature1': 'QAR 2,499/month subscription',
        'tier3.feature2': 'Featured placement',
        'tier3.feature3': 'Dedicated account manager',
        'tier3.feature4': 'Custom analytics reports',
        'tier3.feature5': 'Express 7-day payouts',
        'tier3.feature6': 'Marketing co-investment',
        'tier3.cta': 'Contact Sales',

        // Testimonials Section
        'testimonials.label': 'Partner Stories',
        'testimonials.title': 'What Our Garages Say',

        'testimonial1.quote': '"QScrap doubled our monthly sales within 3 months. The dashboard is easy to use, and payouts are always on time. Best business decision we made."',
        'testimonial1.initial': 'R',
        'testimonial1.name': 'Rajesh Krishnan',
        'testimonial1.business': 'Krishnan Auto Parts, Doha',

        'testimonial2.quote': '"We used to struggle finding customers. Now orders come to us daily. The delivery network saves us so much time and hassle."',
        'testimonial2.initial': 'A',
        'testimonial2.name': 'Ahmed Hassan',
        'testimonial2.business': 'Hassan Motors, Industrial Area',

        // CTA Section
        'cta.title': 'Start Selling on QScrap Today',
        'cta.subtitle': 'Join Qatar\'s fastest-growing automotive marketplace. Free to join, no upfront costs.',
        'cta.contact': 'Questions? Call',
        'cta.contactLink': '+974 4455 4444',
        'cta.contactSuffix': 'to speak with our partner team',

        // Registration Form
        'form.title': 'Partner Registration',
        'form.subtitle': 'Fill in your details below to get started',

        'form.garageName': 'Garage Name',
        'form.garageName.placeholder': 'e.g. Al Rayyan Auto Parts',
        'form.ownerName': 'Owner Name',
        'form.ownerName.placeholder': 'Full name',
        'form.phone': 'Phone Number',
        'form.phone.placeholder': '+974 XXXX XXXX',
        'form.email': 'Email Address',
        'form.email.placeholder': 'garage@example.com',
        'form.address': 'Garage Address',
        'form.address.placeholder': 'Full address with area',
        'form.crNumber': 'Commercial Registration (CR) Number',
        'form.crNumber.placeholder': 'e.g. 123456',
        'form.tradeLicense': 'Trade License Number',
        'form.tradeLicense.placeholder': 'e.g. TL-12345',
        'form.partsType': 'What type of parts do you supply?',
        'form.partsType.select': 'Select...',
        'form.partsType.used': 'Used Parts (Scrapyard/Salvage)',
        'form.partsType.new': 'New Parts (OEM/Commercial)',
        'form.partsType.both': 'Both Used & New Parts',
        'form.brandSection': '🚗 Brand Specialization',
        'form.brandSection.help': 'Helps us match you with relevant customer requests',
        'form.allBrands': 'All Brands',
        'form.password': 'Create Password',
        'form.password.placeholder': 'Min 6 characters',
        'form.confirmPassword': 'Confirm Password',
        'form.confirmPassword.placeholder': 'Re-enter password',
        'form.submit': 'Submit Application',
        'form.terms': 'By registering, you agree to our',
        'form.termsLink': 'Terms of Service',

        // Form Validation Messages
        'form.error.required': 'Please fill in all required fields.',
        'form.error.email': 'Please enter a valid email address.',
        'form.error.passwordMatch': 'Passwords do not match.',
        'form.error.passwordLength': 'Password must be at least 6 characters.',
        'form.error.phone': 'Please enter a valid Qatar phone number.',
        'form.error.duplicate': 'This phone number is already registered. Please login or use a different number.',
        'form.error.duplicateEmail': 'This email is already in use. Please use a different email address.',
        'form.error.generic': 'Registration temporarily unavailable. Please call us at +974 4455 4444.',
        'form.error.network': 'Connection issue. Please check your internet or call us at +974 4455 4444 to register.',

        // Success Screen
        'success.title': 'Application Submitted! 🎉',
        'success.message': 'Thank you for registering. Our team will review your application and contact you shortly.',
        'success.garage': 'Garage:',
        'success.phone': 'Phone:',
        'success.submitted': 'Submitted:',
        'success.whatsNext': "What's Next?",
        'success.step1': "✅ We'll review your application",
        'success.step2': "✅ You'll receive a callback within 24-48 hours",
        'success.step3': '✅ Once approved, you can login to your dashboard',
        'success.portalBtn': 'Go to Partner Portal',

        // Footer
        'footer.description': 'Qatar\'s premium automotive parts marketplace. Connecting customers with verified garages for quality new, used, and OEM parts.',
        'footer.company': 'Company',
        'footer.aboutUs': 'About Us',
        'footer.forBusinesses': 'For Businesses',
        'footer.contact': 'Contact',
        'footer.howItWorks': 'How It Works',
        'footer.legal': 'Legal',
        'footer.privacy': 'Privacy Policy',
        'footer.terms': 'Terms of Service',
        'footer.refund': 'Refund Policy',
        'footer.contactTitle': 'Contact',
        'footer.whatsapp': 'WhatsApp Support',
        'footer.copyright': '© 2026 QScrap. All rights reserved.'
    },

    ar: {
        // Navigation
        'nav.backHome': 'العودة للرئيسية',
        'nav.applyNow': 'قدم الآن',

        // Logo
        'logo.alt': 'شعار كيوسكراب',

        // Page Metadata (SEO)
        'page.title': 'كن شريك كراج | كيوسكراب قطر - نمِّ أعمالك',
        'page.description': 'انضم لأسرع سوق سيارات نمواً في قطر. الوصول لآلاف العملاء، زيادة المبيعات، ومدفوعات مضمونة. قدم لتصبح شريك كراج كيوسكراب اليوم.',

        // Hero Section
        'hero.badge': '🚀 برنامج الشراكة',
        'hero.title': 'نمِّ أعمالك في <span>قطع الغيار</span> مع السوق الأول في قطر',
        'hero.subtitle': 'انضم إلى أكثر من 50 كراجاً معتمداً يحققون أرباحاً أكثر عبر كيوسكراب. بدون تكاليف مقدمة، مدفوعات مضمونة، وآلاف العملاء ينتظرون قطعك.',
        'hero.cta.apply': 'قدم للانضمام',
        'hero.cta.benefits': 'اعرف المزايا',

        // Stats Bar
        'stats.partners.number': '+50',
        'stats.partners.label': 'كراج شريك',
        'stats.orders.number': '+5,000',
        'stats.orders.label': 'طلب شهرياً',
        'stats.satisfaction.number': '98%',
        'stats.satisfaction.label': 'رضا الشركاء',
        'stats.warranty.number': '7 أيام',
        'stats.warranty.label': 'ضمان محمي',

        // Benefits Section
        'benefits.label': 'لماذا تشترك معنا',
        'benefits.title': 'كل ما تحتاجه لتوسيع أعمالك',
        'benefits.subtitle': 'كيوسكراب يتولى التكنولوجيا والخدمات اللوجستية والعملاء — أنت ركز على توفير قطع الجودة.',

        'benefit1.title': 'مدفوعات مضمونة',
        'benefit1.desc': 'احصل على أموالك بشكل موثوق بعد فترة الضمان 7 أيام. عملية آمنة وشفافة. تحويل مباشر لحسابك البنكي.',
        'benefit2.title': 'لوحة تحكم سهلة',
        'benefit2.desc': 'أدر العروض، تتبع الطلبات، واعرض أرباحك من لوحة تحكم الكراج البديهية. تعمل على أي جهاز.',
        'benefit3.title': 'نتولى التوصيل',
        'benefit3.desc': 'شبكة سائقينا المعتمدين تستلم وتوصل للعملاء. لن تغادر كراجك أبداً.',
        'benefit4.title': 'عملاء أكثر',
        'benefit4.desc': 'وصول لآلاف المشترين النشطين في قطر الباحثين عن قطع. وسّع نطاقك بدون تكاليف تسويق.',
        'benefit5.title': 'شارة التحقق',
        'benefit5.desc': 'ابنِ ثقة العملاء من خلال نظام التحقق. رؤية أعلى، قبول عروض أكثر.',
        'benefit6.title': 'حماية النزاعات',
        'benefit6.desc': 'فريق الدعم يتولى مشاكل العملاء. عملية حل عادلة تحمي أعمالك.',

        // How It Works Section
        'hiw.label': 'كيف يعمل',
        'hiw.title': 'ابدأ الربح في 4 خطوات بسيطة',
        'hiw.subtitle': 'من التقديم إلى أول بيعة — نجعلها سلسة.',

        'step1.title': 'قدم أونلاين',
        'step1.desc': 'أرسل تفاصيل كراجك والسجل التجاري. يستغرق 5 دقائق فقط.',
        'step2.title': 'احصل على التحقق',
        'step2.desc': 'فريقنا يراجع ويتحقق من أعمالك خلال 24-48 ساعة.',
        'step3.title': 'استقبل الطلبات',
        'step3.desc': 'ابدأ استقبال طلبات القطع المطابقة لمخزونك. قدم عروض تنافسية.',
        'step4.title': 'اربح وانمُ',
        'step4.desc': 'نفذ الطلبات، استلم مدفوعات مضمونة، ووسّع قاعدة عملائك.',

        // Pricing Tiers Section
        'tiers.label': 'أسعار مرنة',
        'tiers.title': 'اختر ما يناسبك',
        'tiers.subtitle': 'بدون رسوم مقدمة. ادفع فقط عند البيع.',

        // Pay-Per-Sale Tier
        'tier1.name': 'الدفع لكل بيعة',
        'tier1.commission': '15%',
        'tier1.perOrder': 'لكل طلب',
        'tier1.desc': 'مثالي للكراجات الجديدة',
        'tier1.feature1': 'بدون رسوم شهرية',
        'tier1.feature2': 'وصول لجميع العملاء',
        'tier1.feature3': 'لوحة تحكم قياسية',
        'tier1.feature4': 'دعم بالبريد الإلكتروني',
        'tier1.feature5': 'مدفوعات مضمونة خلال 7 أيام',
        'tier1.cta': 'ابدأ مجاناً',

        // Gold Partner Tier
        'tier2.badge': 'الأكثر شعبية',
        'tier2.name': 'الشريك الذهبي',
        'tier2.commission': '5%',
        'tier2.perOrder': 'لكل طلب',
        'tier2.desc': 'أفضل قيمة للكراجات النشطة',
        'tier2.feature1': 'اشتراك 999 ريال/شهر',
        'tier2.feature2': 'أولوية في نتائج البحث',
        'tier2.feature3': 'تحليلات متقدمة',
        'tier2.feature4': 'دعم هاتفي بأولوية',
        'tier2.feature5': 'مدفوعات بأولوية خلال 7 أيام',
        'tier2.feature6': 'مزايا ترويجية',
        'tier2.cta': 'قدم للذهبية',

        // Platinum Partner Tier
        'tier3.name': 'الشريك البلاتيني',
        'tier3.commission': '3%',
        'tier3.perOrder': 'لكل طلب',
        'tier3.desc': 'للبائعين ذوي الحجم الكبير',
        'tier3.feature1': 'اشتراك 2,499 ريال/شهر',
        'tier3.feature2': 'موقع مميز',
        'tier3.feature3': 'مدير حساب مخصص',
        'tier3.feature4': 'تقارير تحليلات مخصصة',
        'tier3.feature5': 'مدفوعات سريعة خلال 7 أيام',
        'tier3.feature6': 'استثمار تسويقي مشترك',
        'tier3.cta': 'تواصل مع المبيعات',

        // Testimonials Section
        'testimonials.label': 'قصص الشركاء',
        'testimonials.title': 'ماذا يقول شركاؤنا',

        'testimonial1.quote': '"كيوسكراب ضاعف مبيعاتنا الشهرية خلال 3 أشهر. لوحة التحكم سهلة الاستخدام، والمدفوعات دائماً في الوقت. أفضل قرار تجاري اتخذناه."',
        'testimonial1.initial': 'ر',
        'testimonial1.name': 'راجيش كريشنان',
        'testimonial1.business': 'كريشنان لقطع السيارات، الدوحة',

        'testimonial2.quote': '"كنا نكافح لإيجاد عملاء. الآن الطلبات تأتينا يومياً. شبكة التوصيل توفر علينا الكثير من الوقت والجهد."',
        'testimonial2.initial': 'أ',
        'testimonial2.name': 'أحمد حسان',
        'testimonial2.business': 'حسان موتورز، المنطقة الصناعية',

        // CTA Section
        'cta.title': 'ابدأ البيع على كيوسكراب اليوم',
        'cta.subtitle': 'انضم لأسرع سوق سيارات نمواً في قطر. الانضمام مجاني، بدون تكاليف مقدمة.',
        'cta.contact': 'أسئلة؟ اتصل',
        'cta.contactLink': '+974 4455 4444',
        'cta.contactSuffix': 'للتحدث مع فريق الشراكة',

        // Registration Form
        'form.title': 'تسجيل الشراكة',
        'form.subtitle': 'أدخل بياناتك أدناه للبدء',

        'form.garageName': 'اسم الكراج',
        'form.garageName.placeholder': 'مثال: الريان لقطع السيارات',
        'form.ownerName': 'اسم المالك',
        'form.ownerName.placeholder': 'الاسم الكامل',
        'form.phone': 'رقم الهاتف',
        'form.phone.placeholder': '+974 XXXX XXXX',
        'form.email': 'البريد الإلكتروني',
        'form.email.placeholder': 'garage@example.com',
        'form.address': 'عنوان الكراج',
        'form.address.placeholder': 'العنوان الكامل مع المنطقة',
        'form.crNumber': 'رقم السجل التجاري (CR)',
        'form.crNumber.placeholder': 'مثال: 123456',
        'form.tradeLicense': 'رقم الرخصة التجارية',
        'form.tradeLicense.placeholder': 'مثال: TL-12345',
        'form.partsType': 'ما نوع القطع التي توفرها؟',
        'form.partsType.select': 'اختر...',
        'form.partsType.used': 'قطع مستعملة (سكراب/إنقاذ)',
        'form.partsType.new': 'قطع جديدة (OEM/تجارية)',
        'form.partsType.both': 'قطع مستعملة وجديدة',
        'form.brandSection': '🚗 تخصص العلامات التجارية',
        'form.brandSection.help': 'يساعدنا في مطابقتك مع طلبات العملاء المناسبة',
        'form.allBrands': 'جميع العلامات',
        'form.password': 'إنشاء كلمة المرور',
        'form.password.placeholder': 'الحد الأدنى 6 أحرف',
        'form.confirmPassword': 'تأكيد كلمة المرور',
        'form.confirmPassword.placeholder': 'أعد إدخال كلمة المرور',
        'form.submit': 'إرسال الطلب',
        'form.terms': 'بالتسجيل، أنت توافق على',
        'form.termsLink': 'شروط الخدمة',

        // Form Validation Messages
        'form.error.required': 'يرجى ملء جميع الحقول المطلوبة.',
        'form.error.email': 'يرجى إدخال بريد إلكتروني صالح.',
        'form.error.passwordMatch': 'كلمات المرور غير متطابقة.',
        'form.error.passwordLength': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.',
        'form.error.phone': 'يرجى إدخال رقم هاتف قطري صالح.',
        'form.error.duplicate': 'رقم الهاتف مسجل مسبقاً. يرجى تسجيل الدخول أو استخدام رقم آخر.',
        'form.error.duplicateEmail': 'البريد الإلكتروني مستخدم. يرجى استخدام بريد إلكتروني آخر.',
        'form.error.generic': 'التسجيل غير متاح مؤقتاً. يرجى الاتصال بنا على +974 4455 4444.',
        'form.error.network': 'مشكلة في الاتصال. يرجى التحقق من الإنترنت أو الاتصال بنا على +974 4455 4444 للتسجيل.',

        // Success Screen
        'success.title': 'تم إرسال الطلب! 🎉',
        'success.message': 'شكراً لتسجيلك. فريقنا سيراجع طلبك ويتواصل معك قريباً.',
        'success.garage': 'الكراج:',
        'success.phone': 'الهاتف:',
        'success.submitted': 'تم الإرسال:',
        'success.whatsNext': 'ما التالي؟',
        'success.step1': '✅ سنراجع طلبك',
        'success.step2': '✅ ستتلقى اتصالاً خلال 24-48 ساعة',
        'success.step3': '✅ بعد الموافقة، يمكنك الدخول للوحة التحكم',
        'success.portalBtn': 'اذهب لبوابة الشركاء',

        // Footer
        'footer.description': 'سوق قطع السيارات الفاخر في قطر. نربط العملاء بالكراجات المعتمدة للحصول على قطع جديدة ومستعملة وأصلية بجودة عالية.',
        'footer.company': 'الشركة',
        'footer.aboutUs': 'من نحن',
        'footer.forBusinesses': 'للأعمال',
        'footer.contact': 'تواصل معنا',
        'footer.howItWorks': 'كيف يعمل',
        'footer.legal': 'قانوني',
        'footer.privacy': 'سياسة الخصوصية',
        'footer.terms': 'شروط الخدمة',
        'footer.refund': 'سياسة الاسترداد',
        'footer.contactTitle': 'تواصل',
        'footer.whatsapp': 'دعم واتساب',
        'footer.copyright': '© 2026 كيوسكراب. جميع الحقوق محفوظة.'
    }
};

// ==============================================
// I18N SYSTEM FUNCTIONS
// ==============================================

let currentLanguage = localStorage.getItem('qscrap-lang') || 'en';

/**
 * Get translation for a key
 */
function t(key) {
    return translations[currentLanguage]?.[key] || translations['en']?.[key] || key;
}

/**
 * Set language and update page
 */
function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('qscrap-lang', lang);
    updatePageDirection(lang);
    translatePage();
    updateLanguageSwitcher(lang);
}

/**
 * Update page direction (LTR/RTL)
 */
function updatePageDirection(lang) {
    const html = document.documentElement;
    if (lang === 'ar') {
        html.setAttribute('dir', 'rtl');
        html.setAttribute('lang', 'ar');
        document.body.style.fontFamily = "'Cairo', 'Inter', sans-serif";
    } else {
        html.setAttribute('dir', 'ltr');
        html.setAttribute('lang', 'en');
        document.body.style.fontFamily = "'Inter', sans-serif";
    }
}

/**
 * Translate all elements with data-i18n attribute
 */
function translatePage() {
    // Translate text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translation = t(key);
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            // Don't translate input values, only placeholders
        } else {
            el.innerHTML = translation;
        }
    });

    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });

    // Translate select options
    document.querySelectorAll('[data-i18n-options]').forEach(select => {
        const optionsKey = select.getAttribute('data-i18n-options');
        if (optionsKey) {
            const options = select.querySelectorAll('option');
            options.forEach(opt => {
                if (opt.hasAttribute('data-i18n')) {
                    opt.textContent = t(opt.getAttribute('data-i18n'));
                }
            });
        }
    });

    // Translate alt attributes
    document.querySelectorAll('[data-i18n-alt]').forEach(el => {
        const key = el.getAttribute('data-i18n-alt');
        el.alt = t(key);
    });

    // Translate page metadata (SEO critical)
    document.title = t('page.title');

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', t('page.description'));

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', t('page.title'));

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', t('page.description'));
}

/**
 * Update language switcher button states
 */
function updateLanguageSwitcher(lang) {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
}

/**
 * Get translated error message
 */
function getErrorMessage(errorKey) {
    return t('form.error.' + errorKey) || t('form.error.generic');
}

/**
 * Initialize i18n system
 */
function initI18n() {
    // Add Cairo font for Arabic
    if (!document.querySelector('link[href*="Cairo"]')) {
        const cairoFont = document.createElement('link');
        cairoFont.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap';
        cairoFont.rel = 'stylesheet';
        document.head.appendChild(cairoFont);
    }

    // Set up language switcher listeners
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setLanguage(btn.getAttribute('data-lang'));
        });
    });

    // Apply stored language preference
    setLanguage(currentLanguage);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initI18n);

// ==============================================
// EXPORT FOR GLOBAL ACCESS
// ==============================================
window.translations = translations;
window.t = t;
window.setLanguage = setLanguage;
window.getErrorMessage = getErrorMessage;
