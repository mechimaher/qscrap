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
        'nav.applyNow': 'Request Access',

        // Logo
        'logo.alt': 'QScrap Logo',

        // Page Metadata (SEO)
        'page.title': 'Become a Partner Garage | QScrap Qatar - Grow Your Parts Business',
        'page.description': 'Join Qatar\'s fastest-growing automotive parts marketplace. Reach thousands of customers, increase sales, and get guaranteed payouts. Apply to become a QScrap Partner Garage today.',

        // Hero Section
        'hero.badge': 'Partner Network',
        'hero.title': 'Your Parts. <span>Wider Reach.</span> Qatar\'s Automotive Network.',
        'hero.subtitle': '50+ garages connected. Zero upfront costs. Payouts guaranteed after delivery.',
        'hero.cta.apply': 'Request Access',
        'hero.cta.benefits': 'How It Works',

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
        'benefits.label': 'What You Get',
        'benefits.title': 'Infrastructure. Logistics. Customers.',
        'benefits.subtitle': 'We handle the platform. You handle the parts.',

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
        'hiw.label': 'The Process',
        'hiw.title': 'From Application to First Order',
        'hiw.subtitle': 'Verification in 24-48 hours. Part requests start immediately after.',

        'step1.title': 'Submit Details',
        'step1.desc': 'Garage info and commercial registration. 5 minutes.',
        'step2.title': 'Verification',
        'step2.desc': 'Our team reviews your business. 24-48 hours.',
        'step3.title': 'Receive Requests',
        'step3.desc': 'Part requests matching your inventory. You set the price.',
        'step4.title': 'Fulfill & Earn',
        'step4.desc': 'Complete orders. Guaranteed payout after 7-day warranty.',

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

        // Starter Tier (NEW)
        'tierStarter.name': 'Starter',
        'tierStarter.commission': '8%',
        'tierStarter.perOrder': 'per order',
        'tierStarter.desc': 'For growing garages',
        'tierStarter.feature1': 'QAR 299/month subscription',
        'tierStarter.feature2': 'Priority listing in search',
        'tierStarter.feature3': 'Basic analytics dashboard',
        'tierStarter.feature4': 'Email & chat support',
        'tierStarter.feature5': 'Standard 7-day payouts',
        'tierStarter.feature6': 'Showcase up to 20 products',
        'tierStarter.cta': 'Start Growing',

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
        'testimonials.subtitle': 'Real results from real partners across Qatar',

        'testimonial1.quote': '"QScrap doubled our monthly sales within 3 months. The dashboard is easy to use, and payouts are always on time. Best business decision we made."',
        'testimonial1.initial': 'R',
        'testimonial1.name': 'Rajesh Krishnan',
        'testimonial1.business': 'Krishnan Auto Parts, Doha',

        'testimonial2.quote': '"We used to struggle finding customers. Now orders come to us daily. The delivery network saves us so much time and hassle."',
        'testimonial2.initial': 'A',
        'testimonial2.name': 'Ahmed Hassan',
        'testimonial2.business': 'Hassan Motors, Industrial Area',

        'testimonial3.quote': '"I was worried customers would only choose cheap options. But my quality parts sell faster than ever—customers see my 4.9 star rating and trust me."',
        'testimonial3.initial': 'M',
        'testimonial3.name': 'Mohammed Al-Sulaiti',
        'testimonial3.business': 'Al-Sulaiti Auto, Salwa Road',

        'testimonial4.quote': '"We made 47,000 QAR extra in our first quarter on QScrap. That\'s customers we never would have reached through walk-ins alone."',
        'testimonial4.initial': 'S',
        'testimonial4.name': 'Sanjay Patel',
        'testimonial4.business': 'Patel Brothers Garage, Industrial Area',

        // Real Partners Gallery
        'gallery.label': 'See the Reality',
        'gallery.title': 'Real Garages. Real Partners.',
        'gallery.subtitle': 'These are actual partner garages and scrap yards across Qatar\'s Industrial Area',
        'gallery.badge.partner': 'Partner',
        'gallery.badge.inventory': 'Inventory',
        'gallery.badge.stock': 'Stock',
        'gallery.badge.yard': 'Yard',
        'gallery.caption1': 'Multi-brand scrap garage, Industrial Area',
        'gallery.caption2': 'Quality engine components',
        'gallery.caption3': 'Fresh inventory from salvage',
        'gallery.caption4': 'Industrial Area scrap yards',

        // FAQ Section
        'faq.label': 'Your Questions Answered',
        'faq.title': 'Common Concerns from Garage Owners',
        'faq.subtitle': 'We understand your hesitations. Here are honest answers.',

        'faq1.question': '"Won\'t customers just pick the cheapest option?"',
        'faq1.answer': '<strong>Actually, 73% of orders go to garages rated 4+ stars—not the cheapest.</strong><br><br>Customers on QScrap value <strong>quality, speed, and reliability</strong>. They see your ratings, your reviews, your response time. They\'re not bargain hunters—they\'re car owners who want their problem solved right.<br><br><span class="highlight-stat">Quality wins. You set prices. We show your value.</span>',

        'faq2.question': '"15% commission seems high. How do I actually make money?"',
        'faq2.answer': '<strong>Consider this: 10 extra sales × 500 QAR = 4,250 QAR net profit.</strong><br><br>That\'s from customers you\'d <em>never</em> have found through walk-ins. No marketing spend. No customer acquisition cost. No WhatsApp chasing.<br><br>And if you\'re making more than 20 sales/month? Upgrade to Gold (5% commission) and keep even more.<br><br><span class="highlight-stat">It\'s not a cost—it\'s a growth investment.</span>',

        'faq3.question': '"Will I lose control of my business?"',
        'faq3.answer': '<strong>You\'re 100% in control. Always.</strong><br><br>✅ <strong>You set your prices</strong> — we never dictate what you charge<br>✅ <strong>You choose which requests to bid on</strong> — skip what doesn\'t fit<br>✅ <strong>You decide your working hours</strong> — no forced availability<br>✅ <strong>You keep your existing customers</strong> — QScrap only brings NEW ones<br><br><span class="highlight-stat">Your garage. Your rules. Our customers.</span>',

        'faq4.question': '"What if a customer leaves an unfair review?"',
        'faq4.answer': '<strong>Our Support team investigates every dispute before it affects your rating.</strong><br><br>We use photo evidence, delivery timestamps, and communication logs. False reviews are removed. And verified issues are resolved fairly—protecting both sides.<br><br><span class="highlight-stat">Partner satisfaction: 98%. Your reputation is safe.</span>',

        'faq5.question': '"Will I actually get paid? How does payment work?"',
        'faq5.answer': '<strong>Guaranteed payouts, 7 days after delivery confirmation.</strong><br><br>Here\'s how it works:<br>1️⃣ Customer pays QScrap upfront (or Cash on Delivery)<br>2️⃣ Driver picks up from you, delivers to customer<br>3️⃣ 7-day warranty period passes (for returns)<br>4️⃣ Your earnings are transferred to your bank account<br><br><span class="highlight-stat">100% of successful orders are paid. Zero exceptions.</span>',

        'faq6.question': '"I\'m not tech-savvy. Is it hard to use?"',
        'faq6.answer': '<strong>If you can use WhatsApp, you can use QScrap.</strong><br><br>Our dashboard is designed for busy garage owners—not tech experts. You\'ll receive a notification on your phone, tap to see the request, type your price, hit submit. That\'s it.<br><br>Plus, our support team is just a phone call away if you ever get stuck.<br><br><span class="highlight-stat">Onboarding takes 5 minutes. Not 5 hours.</span>',

        // Trust Strip
        'trust.encrypted': 'Your data is encrypted',
        'trust.support': 'Questions? +974 5026 7974',
        'trust.cancel': 'Cancel anytime, no penalties',

        // The Inevitable Section
        'inevitable.title': 'The Orders Are Already Moving.<br>Across Qatar. Right Now.',
        'inevitable.subtitle': 'Your inventory. Your prices. More customers than your street will ever bring.',
        'inevitable.cta': 'Join the Network',
        'inevitable.dial.label': 'Your Price',
        'inevitable.dial.hint': 'Move it. It\'s yours to set.',
        'inevitable.bar.without': 'Without',
        'inevitable.bar.with': 'With QScrap',
        'inevitable.bar.withoutValue': '50 sales',
        'inevitable.bar.withValue': '150 sales',
        'inevitable.bar.hint': 'Same garage. Different reach.',
        'inevitable.stat.partners.number': '50+',
        'inevitable.stat.partners.label': 'Partner Garages',
        'inevitable.stat.reach.number': '10,000+',
        'inevitable.stat.reach.label': 'Active Customers',
        'inevitable.stat.satisfaction.number': '98%',
        'inevitable.stat.satisfaction.label': 'Partner Satisfaction',

        // CTA Section
        'cta.title': 'Ready to Connect?',
        'cta.subtitle': 'Free to join. No upfront costs. Payouts guaranteed.',
        'cta.contact': 'Questions? Call',
        'cta.contactLink': '+974 5026 7974',
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
        'form.preferredPlan': 'Preferred Subscription Plan',
        'form.plan.free': 'Pay-Per-Sale (15% commission, QAR 0/month) - Start Free',
        'form.plan.starter': 'Starter (8% commission, QAR 299/month)',
        'form.plan.gold': 'Gold Partner (5% commission, QAR 999/month)',
        'form.plan.platinum': 'Platinum (3% commission, QAR 2,499/month)',
        'form.planHint': 'You start on Pay-Per-Sale (free). Request upgrade anytime from your dashboard.',
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
        'form.error.generic': 'Registration temporarily unavailable. Please call us at +974 5026 7974.',
        'form.error.network': 'Connection issue. Please check your internet or call us at +974 5026 7974 to register.',

        // Success Screen
        'success.title': 'Application Submitted! 🎉',
        'success.message': 'Thank you for registering. Our team will review your application and contact you shortly.',
        'success.garage': 'Garage:',
        'success.phone': 'Phone:',
        'success.plan': 'Selected Plan:',
        'success.submitted': 'Submitted:',
        'success.whatsNext': "What's Next?",
        'success.step1': "✅ We'll review your application",
        'success.step2': "✅ You'll receive a callback within 24-48 hours",
        'success.step3': '✅ Once approved, you can login to your dashboard',
        'success.portalBtn': 'Go to Partner Portal',

        // Footer
        'footer.tagline': 'Qatar\'s premium automotive parts marketplace. Connecting customers with verified garages for quality new, used, and OEM parts.',
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
        'footer.whatsapp': 'WhatsApp Support',
        'footer.legalInfo.en': 'QScrap Services & Trading L.L.C | Doha, Qatar',
        'footer.copyright': '© 2026 QScrap. All rights reserved.'
    },

    ar: {
        // Navigation
        'nav.backHome': 'العودة للرئيسية',
        'nav.applyNow': 'اطلب الانضمام',

        // Logo
        'logo.alt': 'شعار كيوسكراب',

        // Page Metadata (SEO)
        'page.title': 'كن شريك كراج | كيوسكراب قطر - نمِّ أعمالك',
        'page.description': 'انضم لأسرع سوق سيارات نمواً في قطر. الوصول لآلاف العملاء، زيادة المبيعات، ومدفوعات مضمونة. قدم لتصبح شريك كراج كيوسكراب اليوم.',

        // Hero Section
        'hero.badge': 'شبكة الشركاء',
        'hero.title': 'قطعك. <span>وصول أوسع.</span> شبكة سيارات قطر.',
        'hero.subtitle': 'أكثر من 50 كراج متصل. بدون تكاليف مقدمة. مدفوعات مضمونة بعد التسليم.',
        'hero.cta.apply': 'اطلب الانضمام',
        'hero.cta.benefits': 'كيف يعمل',

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
        'benefits.label': 'ماذا تحصل عليه',
        'benefits.title': 'بنية تحتية. لوجستيات. عملاء.',
        'benefits.subtitle': 'نحن نتولى المنصة. أنت تتولى القطع.',

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
        'hiw.label': 'العملية',
        'hiw.title': 'من التقديم إلى أول طلب',
        'hiw.subtitle': 'التحقق خلال 24-48 ساعة. الطلبات تبدأ فوراً.',

        'step1.title': 'أرسل التفاصيل',
        'step1.desc': 'بيانات الكراج والسجل التجاري. 5 دقائق.',
        'step2.title': 'التحقق',
        'step2.desc': 'فريقنا يراجع أعمالك. 24-48 ساعة.',
        'step3.title': 'استقبل الطلبات',
        'step3.desc': 'طلبات قطع مطابقة لمخزونك. أنت تحدد السعر.',
        'step4.title': 'نفّذ واربح',
        'step4.desc': 'أكمل الطلبات. دفعة مضمونة بعد ضمان 7 أيام.',

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

        // Starter Tier (NEW)
        'tierStarter.name': 'المبتدئ',
        'tierStarter.commission': '8%',
        'tierStarter.perOrder': 'لكل طلب',
        'tierStarter.desc': 'للكراجات النامية',
        'tierStarter.feature1': 'اشتراك 299 ريال/شهر',
        'tierStarter.feature2': 'أولوية في نتائج البحث',
        'tierStarter.feature3': 'لوحة تحليلات أساسية',
        'tierStarter.feature4': 'دعم بالبريد والدردشة',
        'tierStarter.feature5': 'مدفوعات قياسية خلال 7 أيام',
        'tierStarter.feature6': 'عرض حتى 20 منتج',
        'tierStarter.cta': 'ابدأ النمو',

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
        'testimonials.subtitle': 'نتائج حقيقية من شركاء حقيقيين في قطر',

        'testimonial1.quote': '"كيوسكراب ضاعف مبيعاتنا الشهرية خلال 3 أشهر. لوحة التحكم سهلة الاستخدام، والمدفوعات دائماً في الوقت. أفضل قرار تجاري اتخذناه."',
        'testimonial1.initial': 'ر',
        'testimonial1.name': 'راجيش كريشنان',
        'testimonial1.business': 'كريشنان لقطع السيارات، الدوحة',

        'testimonial2.quote': '"كنا نكافح لإيجاد عملاء. الآن الطلبات تأتينا يومياً. شبكة التوصيل توفر علينا الكثير من الوقت والجهد."',
        'testimonial2.initial': 'أ',
        'testimonial2.name': 'أحمد حسان',
        'testimonial2.business': 'حسان موتورز، المنطقة الصناعية',

        'testimonial3.quote': '"كنت خايف الزبون يختار الأرخص. لكن قطعي الجودة تتباع أسرع من قبل — الزبون يشوف تقييمي 4.9 ويثق فيني."',
        'testimonial3.initial': 'م',
        'testimonial3.name': 'محمد السليطي',
        'testimonial3.business': 'السليطي للسيارات، طريق السلوى',

        'testimonial4.quote': '"ربحنا 47,000 ريال إضافية في أول ربع سنة على كيوسكراب. هذول زبائن ما كان بنوصلهم بالزيارات العادية."',
        'testimonial4.initial': 'س',
        'testimonial4.name': 'سانجاي باتيل',
        'testimonial4.business': 'كراج باتيل براذرز، المنطقة الصناعية',

        // Real Partners Gallery
        'gallery.label': 'شوف الواقع',
        'gallery.title': 'كراجات حقيقية. شركاء حقيقيين.',
        'gallery.subtitle': 'هذي كراجات ومقالب سكراب حقيقية في المنطقة الصناعية بقطر',
        'gallery.badge.partner': 'شريك',
        'gallery.badge.inventory': 'مخزون',
        'gallery.badge.stock': 'بضاعة',
        'gallery.badge.yard': 'ساحة',
        'gallery.caption1': 'كراج سكراب متعدد العلامات، المنطقة الصناعية',
        'gallery.caption2': 'قطع محركات بجودة عالية',
        'gallery.caption3': 'مخزون جديد من سيارات السلفج',
        'gallery.caption4': 'ساحات سكراب المنطقة الصناعية',

        // FAQ Section
        'faq.label': 'إجابات أسئلتك',
        'faq.title': 'مخاوف شائعة من أصحاب الكراجات',
        'faq.subtitle': 'نفهم ترددك. هنا إجابات صريحة.',

        'faq1.question': '"ما الزبون بيختار الأرخص وبس؟"',
        'faq1.answer': '<strong>في الحقيقة، 73% من الطلبات تروح للكراجات بتقييم 4 نجوم وفوق — مش الأرخص.</strong><br><br>الزبائن في كيوسكراب يقدرون <strong>الجودة والسرعة والموثوقية</strong>. يشوفون تقييماتك ومراجعاتك وسرعة ردك. ما يدورون على الأرخص — يدورون على اللي يحل مشكلتهم صح.<br><br><span class="highlight-stat">الجودة تفوز. أنت تحدد السعر. نحن نبرز قيمتك.</span>',

        'faq2.question': '"15% عمولة كثير. كيف أربح؟"',
        'faq2.answer': '<strong>فكر فيها كذا: 10 بيعات × 500 ريال = 4,250 ريال ربح صافي.</strong><br><br>هذي من زبائن <em>ما كان</em> تلقاهم بالزيارات العادية. بدون صرف على التسويق. بدون تكلفة استقطاب عملاء. بدون ملاحقة واتساب.<br><br>وإذا تسوي أكثر من 20 بيعة/شهر؟ ترقى للذهبي (5% عمولة) وتحتفظ بأكثر.<br><br><span class="highlight-stat">مش تكلفة — استثمار في النمو.</span>',

        'faq3.question': '"بأخسر السيطرة على شغلي؟"',
        'faq3.answer': '<strong>أنت متحكم 100%. دايماً.</strong><br><br>✅ <strong>أنت تحدد سعرك</strong> — ما نفرض عليك شي<br>✅ <strong>أنت تختار أي طلب تعرض عليه</strong> — تخطى اللي ما يناسبك<br>✅ <strong>أنت تحدد ساعات عملك</strong> — بدون إجبار<br>✅ <strong>تحتفظ بزبائنك الحاليين</strong> — كيوسكراب يجيبلك زبائن جدد بس<br><br><span class="highlight-stat">كراجك. قوانينك. زبائننا.</span>',

        'faq4.question': '"إذا زبون حط تقييم ظالم؟"',
        'faq4.answer': '<strong>فريق الدعم يحقق في كل نزاع قبل ما يأثر على تقييمك.</strong><br><br>نستخدم صور الإثبات، أوقات التوصيل، وسجلات المحادثات. التقييمات الكاذبة تنحذف. والمشاكل الحقيقية تنحل بعدل — حماية للطرفين.<br><br><span class="highlight-stat">رضا الشركاء: 98%. سمعتك محمية.</span>',

        'faq5.question': '"بأقبض فعلاً؟ كيف الدفع يشتغل؟"',
        'faq5.answer': '<strong>مدفوعات مضمونة، بعد 7 أيام من تأكيد التوصيل.</strong><br><br>الطريقة:<br>1️⃣ الزبون يدفع لكيوسكراب مقدم (أو الدفع عند الاستلام)<br>2️⃣ السائق يستلم منك ويوصل للزبون<br>3️⃣ تمر فترة الضمان 7 أيام (للإرجاع)<br>4️⃣ أرباحك تتحول لحسابك البنكي<br><br><span class="highlight-stat">100% من الطلبات الناجحة تُدفع. بدون استثناء.</span>',

        'faq6.question': '"أنا مش تقني. صعب الاستخدام؟"',
        'faq6.answer': '<strong>إذا تعرف تستخدم واتساب، تقدر تستخدم كيوسكراب.</strong><br><br>لوحة التحكم مصممة لأصحاب الكراجات المشغولين — مش خبراء التقنية. تجيك إشعار على جوالك، تضغط تشوف الطلب، تكتب سعرك، تضغط أرسل. خلاص.<br><br>وفريق الدعم على اتصال إذا احتجت مساعدة.<br><br><span class="highlight-stat">التسجيل 5 دقائق. مش 5 ساعات.</span>',

        // Trust Strip
        'trust.encrypted': 'بياناتك مشفرة',
        'trust.support': 'أسئلة؟ <span dir="ltr">+974 5026 7974</span>',
        'trust.cancel': 'إلغاء أي وقت، بدون غرامات',

        // The Inevitable Section
        'inevitable.title': 'الطلبات تتحرك.<br>في كل قطر. الآن.',
        'inevitable.subtitle': 'مخزونك. أسعارك. زبائن أبعد من شارعك.',
        'inevitable.cta': 'انضم للشبكة',
        'inevitable.dial.label': 'سعرك',
        'inevitable.dial.hint': 'حركه. السعر سعرك.',
        'inevitable.bar.without': 'بدون',
        'inevitable.bar.with': 'مع كيوسكراب',
        'inevitable.bar.withoutValue': '50 بيعة',
        'inevitable.bar.withValue': '150 بيعة',
        'inevitable.bar.hint': 'نفس الكراج. وصول مختلف.',
        'inevitable.stat.partners.number': '50+',
        'inevitable.stat.partners.label': 'كراج شريك',
        'inevitable.stat.reach.number': '10,000+',
        'inevitable.stat.reach.label': 'زبون نشط',
        'inevitable.stat.satisfaction.number': '98%',
        'inevitable.stat.satisfaction.label': 'رضا الشركاء',

        // CTA Section
        'cta.title': 'جاهز للانضمام؟',
        'cta.subtitle': 'مجاني. بدون تكاليف مقدمة. مدفوعات مضمونة.',
        'cta.contact': 'أسئلة؟ اتصل',
        'cta.contactLink': '<span dir="ltr">+974 5026 7974</span>',
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
        'form.preferredPlan': 'خطة الاشتراك المفضلة',
        'form.plan.free': 'الدفع حسب البيع (15% عمولة، 0 ريال/شهر) - ابدأ مجاناً',
        'form.plan.starter': 'المبتدئ (8% عمولة، 299 ريال/شهر)',
        'form.plan.gold': 'الشريك الذهبي (5% عمولة، 999 ريال/شهر)',
        'form.plan.platinum': 'البلاتيني (3% عمولة، 2,499 ريال/شهر)',
        'form.planHint': 'تبدأ بخطة الدفع حسب البيع (مجانية). يمكنك طلب الترقية في أي وقت من لوحة التحكم.',
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
        'form.error.generic': 'التسجيل غير متاح مؤقتاً. يرجى الاتصال بنا على <span dir="ltr">+974 5026 7974</span>.',
        'form.error.network': 'مشكلة في الاتصال. يرجى التحقق من الإنترنت أو الاتصال بنا على <span dir="ltr">+974 5026 7974</span> للتسجيل.',

        // Success Screen
        'success.title': 'تم إرسال الطلب! 🎉',
        'success.message': 'شكراً لتسجيلك. فريقنا سيراجع طلبك ويتواصل معك قريباً.',
        'success.garage': 'الكراج:',
        'success.phone': 'الهاتف:',
        'success.plan': 'الخطة المحددة:',
        'success.submitted': 'تم الإرسال:',
        'success.whatsNext': 'ما التالي؟',
        'success.step1': '✅ سنراجع طلبك',
        'success.step2': '✅ ستتلقى اتصالاً خلال 24-48 ساعة',
        'success.step3': '✅ بعد الموافقة، يمكنك الدخول للوحة التحكم',
        'success.portalBtn': 'اذهب لبوابة الشركاء',

        // Footer
        'footer.tagline': 'سوق قطع السيارات الفاخر في قطر. نربط العملاء بالكراجات المعتمدة للحصول على قطع جديدة ومستعملة وأصلية بجودة عالية.',
        'footer.company': 'الشركة',
        'footer.aboutUs': 'من نحن',
        'footer.forBusiness': 'للأعمال',
        'footer.contact': 'تواصل معنا',
        'footer.howItWorks': 'كيف يعمل',
        'footer.legal': 'قانوني',
        'footer.privacy': 'سياسة الخصوصية',
        'footer.terms': 'شروط الخدمة',
        'footer.refund': 'سياسة الاسترداد',
        'footer.contactTitle': 'تواصل',
        'footer.whatsapp': 'دعم واتساب',
        'footer.legalInfo.ar': 'كيوسكراب للخدمات والتجارة ذ.م.م | الدوحة، قطر',
        'footer.copyright': 'كيوسكراب © 2026. جميع الحقوق محفوظة.'
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

    // Swap logo based on language (RTL Arabic logo vs LTR English logo)
    const logoSrc = lang === 'ar'
        ? '/assets/images/qscrap-logo-ar.png?v=2026opt'
        : '/assets/images/qscrap-logo.png?v=2026final';
    document.querySelectorAll('.nav-logo img, .footer-brand img').forEach(img => {
        img.src = logoSrc;
    });
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
