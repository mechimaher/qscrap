/**
 * QScrap Customer Web Request — JavaScript
 * v2.0 — Searchable dropdowns for vehicle + Request detail modal + i18n
 *
 * API contract 100% aligned with backend.
 */

'use strict';

(function () {

    // ─── Config ────────────────────────────────────────────────────────────────
    const API = '/api';

    // ─── i18n Translations ─────────────────────────────────────────────────────
    const I18N = {
        en: {
            // Nav
            'nav.requestPart': 'Request a Part',
            'nav.howItWorks': 'How It Works',
            'nav.gallery': 'Gallery',
            'nav.forBusiness': 'For Businesses',
            'nav.about': 'About',
            'nav.backHome': 'Back to Home',

            // Auth
            'auth.title': 'Request a Car Part',
            'auth.subtitle': 'Sign in or create a free account to get started',
            'auth.tabLogin': 'Sign In',
            'auth.tabRegister': 'Create Account',
            'auth.labelPhone': 'Phone Number',
            'auth.labelPassword': 'Password',
            'auth.loginPlaceholder': 'Your password',
            'auth.loginBtn': 'Sign In →',
            'auth.labelName': 'Full Name',
            'auth.namePlaceholder': 'Your full name',
            'auth.labelEmail': 'Email Address',
            'auth.emailPlaceholder': 'you@email.com',
            'auth.emailHint': 'We\'ll send a verification code to this email.',
            'auth.phonePlaceholder': '+974 XXXX XXXX or 8-digit number',
            'auth.pwdPlaceholder': 'Minimum 6 characters',
            'auth.registerBtn': 'Create Account →',
            'auth.otpTitle': 'Verification Code',
            'auth.otpSent': '📧 Verification code sent to',
            'auth.otpPlaceholder': 'Enter 6-digit code',
            'auth.resend': 'Resend',
            'auth.verifyBtn': 'Verify & Create Account →',
            'auth.back': '← Back',

            // App
            'app.breadcrumbHome': 'Home',
            'app.breadcrumbRequest': 'Request a Part',
            'app.nudgeTitle': 'Get more on the QScrap app',
            'app.nudgeText': 'Push notifications for bids, live delivery tracking, and camera photo uploads.',
            'app.nudgeBtn': 'Download App',
            'app.portalTitle': 'Auto Parts Portal',
            'app.portalSubtitle': 'Request a part or track your existing requests',
            'app.userLabel': 'Customer',
            'app.signOut': 'Sign out',

            // Tabs
            'app.tabNewRequest': 'New Request',
            'app.tabMyRequests': 'My Requests',

            // Form Steps
            'app.step1': 'Your Vehicle',
            'app.step1Desc': 'Tell us about the car that needs the part',
            'app.step2': 'Part Details',
            'app.step2Desc': 'Describe the part you need — be specific for better bids',
            'app.step3': 'Delivery Address',
            'app.step3Desc': 'Where should we deliver? Helps garages provide accurate delivery quotes',
            'app.step4': 'Photos',
            'app.step4Desc': 'Upload up to 5 photos of the damaged part or area — helps garages match exactly',

            // Vehicle Form
            'app.labelMake': 'Make',
            'app.labelModel': 'Model',
            'app.labelYear': 'Year',
            'app.labelVin': 'VIN Number',
            'app.vinPlaceholder': '17-character VIN',
            'app.searchMake': 'Search make…',
            'app.searchModel': 'Select make first…',
            'app.searchYear': 'Search year…',

            // Part Details
            'app.labelCategory': 'Category',
            'app.selectCategory': '— Select a category —',
            'app.labelSubcategory': 'Subcategory',
            'app.selectSubcategory': '— Select subcategory —',
            'app.labelDesc': 'Description',
            'app.descPlaceholder': 'Describe the part in detail. E.g.: Right front shock absorber for 2020 Toyota Camry 2.5L. Need genuine OEM or equivalent quality.',
            'app.labelPartNum': 'Part Number',
            'app.partNumPlaceholder': 'OEM or aftermarket part #',
            'app.labelQuantity': 'Quantity',
            'app.labelCondition': 'Part Condition Preference',
            'app.condAny': 'Any Condition',
            'app.condNew': 'New Only',
            'app.condUsed': 'Used Only',

            // Delivery
            'app.labelZone': 'Area / Zone in Qatar',
            'app.zonePlaceholder': 'Search area… e.g. West Bay, Lusail, Al Wakra',
            'app.labelStreet': 'Building / Street / Zone #',
            'app.streetPlaceholder': 'e.g. Building 42, Street 900, Zone 56',

            // Photos
            'app.photoClick': 'Click to upload or drag & drop',
            'app.photoHint': 'JPG, PNG, WebP — up to 5 photos',
            'app.photoCount': '{n}/5 photos',

            // Submit
            'app.submitHint': 'Free to request. Garages compete for your business.',
            'app.submitBtn': 'Submit Request',

            // Success
            'app.successTitle': 'Request Submitted!',
            'app.successText': 'Your request is live. Verified garages are reviewing it now and will submit bids within hours.',
            'app.successNew': 'Request Another Part',
            'app.successView': 'View My Requests →',

            // Requests List
            'app.noRequests': 'No requests yet. Start by creating your first request!',
            'app.loading': 'Loading...',
            'app.requestTitle': 'Request #{id}',
            'app.viewDetails': 'View Details',

            // Modal
            'app.modalTitle': 'Request Details',
            'app.closeModal': 'Close modal',

            // Footer
            'app.footerRights': '© 2026 QScrap Services & Trading L.L.C. — Doha, Qatar',
            'app.footerTerms': 'Terms of Service',
            'app.footerPrivacy': 'Privacy Policy',
            'app.footerRefund': 'Refund Policy',
            'app.footerPartners': 'For Businesses',

            // Toasts & Alerts
            'toast.error': 'Error',
            'toast.success': 'Success',
            'toast.loginRequired': 'Please sign in to continue',
            'toast.invalidPhone': 'Please enter a valid phone number',
            'toast.invalidEmail': 'Please enter a valid email address',
            'toast.invalidPassword': 'Password must be at least 6 characters',
            'toast.loginSuccess': 'Welcome back!',
            'toast.loginFailed': 'Login failed. Please check your credentials.',
            'toast.otpSent': 'Verification code sent to your email',
            'toast.otpInvalid': 'Invalid verification code',
            'toast.accountCreated': 'Account created successfully!',
            'toast.accountCreateFailed': 'Failed to create account',
            'toast.requestSuccess': 'Request submitted successfully!',
            'toast.requestFailed': 'Failed to submit request',
            'toast.photoLimit': 'Maximum 5 photos allowed',

            // Status labels
            'status.active': 'Active',
            'status.pending': 'Pending',
            'status.completed': 'Completed',
            'status.cancelled': 'Cancelled',
            'status.expired': 'Expired',
            'status.accepted': 'Accepted'
        },
        ar: {
            // Nav
            'nav.requestPart': 'طلب قطعة',
            'nav.howItWorks': 'كيف يعمل',
            'nav.gallery': 'المعرض',
            'nav.forBusiness': 'للأعمال',
            'nav.about': 'حول',
            'nav.backHome': 'العودة للرئيسية',

            // Auth
            'auth.title': 'طلب قطعة غيار سيارة',
            'auth.subtitle': 'سجل الدخول أو أنشئ حساباً مجانياً للبدء',
            'auth.tabLogin': 'تسجيل الدخول',
            'auth.tabRegister': 'إنشاء حساب',
            'auth.labelPhone': 'رقم الهاتف',
            'auth.labelPassword': 'كلمة المرور',
            'auth.loginPlaceholder': 'كلمة المرور الخاصة بك',
            'auth.loginBtn': 'تسجيل الدخول ←',
            'auth.labelName': 'الاسم الكامل',
            'auth.namePlaceholder': 'اسمك الكامل',
            'auth.labelEmail': 'البريد الإلكتروني',
            'auth.emailPlaceholder': 'you@email.com',
            'auth.emailHint': 'سنرسل رمز التحقق إلى هذا البريد.',
            'auth.phonePlaceholder': '+974 XXXX XXXX أو رقم من 8 خانات',
            'auth.pwdPlaceholder': '6 أحرف على الأقل',
            'auth.registerBtn': 'إنشاء حساب ←',
            'auth.otpTitle': 'رمز التحقق',
            'auth.otpSent': '📧 تم إرسال رمز التحقق إلى',
            'auth.otpPlaceholder': 'أدخل الرمز المكون من 6 خانات',
            'auth.resend': 'إعادة الإرسال',
            'auth.verifyBtn': 'تحقق وأنشئ الحساب ←',
            'auth.back': '← عودة',

            // App
            'app.breadcrumbHome': 'الرئيسية',
            'app.breadcrumbRequest': 'طلب قطعة',
            'app.nudgeTitle': 'احصل على المزيد في تطبيق كيوسكراب',
            'app.nudgeText': 'إشعارات فورية للعروض، تتبع مباشر للتسليم، ورفع صور بالكاميرا.',
            'app.nudgeBtn': 'تحميل التطبيق',
            'app.portalTitle': 'بوابة قطع غيار السيارات',
            'app.portalSubtitle': 'اطلب قطعة أو تتبع طلباتك الحالية',
            'app.userLabel': 'عميل',
            'app.signOut': 'تسجيل الخروج',

            // Tabs
            'app.tabNewRequest': 'طلب جديد',
            'app.tabMyRequests': 'طلباتي',

            // Form Steps
            'app.step1': 'مركبتك',
            'app.step1Desc': 'أخبرنا عن السيارة التي تحتاج القطعة',
            'app.step2': 'تفاصيل القطعة',
            'app.step2Desc': 'صِف القطعة التي تحتاجها - كن محدداً للحصول على عروض أفضل',
            'app.step3': 'عنوان التسليم',
            'app.step3Desc': 'أين يجب أن نسلم؟ يساعد الكراجات في تقديم عروض تسليم دقيقة',
            'app.step4': 'الصور',
            'app.step4Desc': 'ارفع حتى 5 صور للقطعة التالفة أو المنطقة - يساعد الكراجات في المطابقة الدقيقة',

            // Vehicle Form
            'app.labelMake': 'الصانع',
            'app.labelModel': 'الموديل',
            'app.labelYear': 'السنة',
            'app.labelVin': 'رقم الهيكل (VIN)',
            'app.vinPlaceholder': '17 حرف/رقم',
            'app.searchMake': 'ابحث عن الصانع…',
            'app.searchModel': 'اختر الصانع أولاً…',
            'app.searchYear': 'ابحث عن السنة…',

            // Part Details
            'app.labelCategory': 'الفئة',
            'app.selectCategory': '— اختر فئة —',
            'app.labelSubcategory': 'الفئة الفرعية',
            'app.selectSubcategory': '— اختر فئة فرعية —',
            'app.labelDesc': 'الوصف',
            'app.descPlaceholder': 'صِف القطعة بالتفصيل. مثال: ممتص صدمات أمامي أيمن لتويوتا كامري 2020 2.5 لتر. أحتاج أصلي أو ما يعادله.',
            'app.labelPartNum': 'رقم القطعة',
            'app.partNumPlaceholder': 'رقم القطعة الأصلي أو البديل',
            'app.labelQuantity': 'الكمية',
            'app.labelCondition': 'تفضيل حالة القطعة',
            'app.condAny': 'أي حالة',
            'app.condNew': 'جديد فقط',
            'app.condUsed': 'مستعمل فقط',

            // Delivery
            'app.labelZone': 'المنطقة / الحي في قطر',
            'app.zonePlaceholder': 'ابحث عن المنطقة… مثال: الدفنة، لوسيل، الوكرة',
            'app.labelStreet': 'رقم المبنى / الشارع / المنطقة',
            'app.streetPlaceholder': 'مثال: مبنى 42، شارع 900، منطقة 56',

            // Photos
            'app.photoClick': 'انقر للرفع أو اسحب وأفلت',
            'app.photoHint': 'JPG, PNG, WebP — حتى 5 صور',
            'app.photoCount': '{n}/5 صور',

            // Submit
            'app.submitHint': 'الطلب مجاني. الكراجات تتنافس على عملك.',
            'app.submitBtn': 'إرسال الطلب',

            // Success
            'app.successTitle': 'تم إرسال الطلب!',
            'app.successText': 'طلبك نشط. الكراجات المعتمدة تراجعه الآن وستقدم عروضاً خلال ساعات.',
            'app.successNew': 'طلب قطعة أخرى',
            'app.successView': 'عرض طلباتي ←',

            // Requests List
            'app.noRequests': 'لا توجد طلبات بعد. ابدأ بإنشاء طلبك الأول!',
            'app.loading': 'جاري التحميل...',
            'app.requestTitle': 'طلب #{id}',
            'app.viewDetails': 'عرض التفاصيل',

            // Modal
            'app.modalTitle': 'تفاصيل الطلب',
            'app.closeModal': 'إغلاق',

            // Footer
            'app.footerRights': '© 2026 كيوسكراب للخدمات والتجارة ذ.م.م — الدوحة، قطر',
            'app.footerTerms': 'شروط الخدمة',
            'app.footerPrivacy': 'سياسة الخصوصية',
            'app.footerRefund': 'سياسة الاسترداد',
            'app.footerPartners': 'للأعمال',

            // Toasts & Alerts
            'toast.error': 'خطأ',
            'toast.success': 'نجاح',
            'toast.loginRequired': 'يرجى تسجيل الدخول للمتابعة',
            'toast.invalidPhone': 'يرجى إدخال رقم هاتف صالح',
            'toast.invalidEmail': 'يرجى إدخال بريد إلكتروني صالح',
            'toast.invalidPassword': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
            'toast.loginSuccess': 'مرحباً بعودتك!',
            'toast.loginFailed': 'فشل تسجيل الدخول. يرجى التحقق من بياناتك.',
            'toast.otpSent': 'تم إرسال رمز التحقق إلى بريدك',
            'toast.otpInvalid': 'رمز التحقق غير صالح',
            'toast.accountCreated': 'تم إنشاء الحساب بنجاح!',
            'toast.accountCreateFailed': 'فشل إنشاء الحساب',
            'toast.requestSuccess': 'تم إرسال الطلب بنجاح!',
            'toast.requestFailed': 'فشل إرسال الطلب',
            'toast.photoLimit': 'الحد الأقصى 5 صور',

            // Status labels
            'status.active': 'نشط',
            'status.pending': 'قيد المعالجة',
            'status.completed': 'مكتمل',
            'status.cancelled': 'ملغى',
            'status.expired': 'منتهي',
            'status.accepted': 'مقبول'
        }
    };

    // ─── i18n System ───────────────────────────────────────────────────────────
    const i18n = {
        currentLang: localStorage.getItem('qscrap-lang') || 'en',

        init() {
            this.setLanguage(this.currentLang, false);
            document.querySelectorAll('.lang-btn, .mobile-lang-btn').forEach(btn => {
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
            } else {
                html.setAttribute('dir', 'ltr');
                html.setAttribute('lang', 'en');
            }

            // Swap logo
            const logoSrc = lang === 'ar'
                ? '/assets/images/qscrap-logo-ar.png?v=2026opt'
                : '/assets/images/qscrap-logo.png?v=2026';
            document.querySelectorAll('.nav-logo img, .mobile-menu-logo img').forEach(img => {
                img.src = logoSrc;
            });

            // Update button states
            document.querySelectorAll('.lang-btn, .mobile-lang-btn').forEach(btn => {
                if (btn.dataset.lang === lang) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            // Translate elements
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.dataset.i18n;
                const translation = I18N[lang][key];
                if (translation) {
                    if (animate) {
                        el.style.opacity = '0';
                        el.style.transition = 'opacity 0.15s ease';
                        setTimeout(() => {
                            el.innerHTML = translation;
                            el.style.opacity = '1';
                        }, 150);
                    } else {
                        el.innerHTML = translation;
                    }
                }
            });

            // Translate placeholders
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.dataset.i18nPlaceholder;
                const translation = I18N[lang][key];
                if (translation) {
                    el.placeholder = translation;
                }
            });
        },

        t(key, params = {}) {
            let text = I18N[this.currentLang][key] || I18N.en[key] || key;
            Object.keys(params).forEach(k => {
                text = text.replace(`{${k}}`, params[k]);
            });
            return text;
        }
    };

    // ─── Qatar-Market Car Makes & Models (2026 Edition) ───────────────────────
    const CAR_DATA = {
        'Toyota': ['Camry', 'Land Cruiser', 'Land Cruiser 300', 'Corolla', 'Hilux', 'RAV4', 'Prado', 'Yaris', 'Fortuner', 'C-HR', 'Rush', 'Avalon', 'Supra', 'GR86', 'bZ4X', 'Sequoia', 'Tundra', '4Runner', 'Highlander', 'Crown'],
        'Lexus': ['ES', 'IS', 'LS', 'LX', 'GX', 'NX', 'RX', 'UX', 'RC', 'LC', 'LM', 'TX', 'RZ'],
        'Nissan': ['Patrol', 'Patrol Nismo', 'X-Trail', 'Altima', 'Maxima', 'Kicks', 'Sunny', 'Pathfinder', 'Navara', 'GT-R', 'Z', 'Qashqai', 'Juke', 'Ariya', 'Sentra', 'Rogue'],
        'Infiniti': ['QX80', 'QX60', 'QX55', 'QX50', 'Q50', 'Q60'],
        'Honda': ['Accord', 'Civic', 'CR-V', 'HR-V', 'Pilot', 'Odyssey', 'City', 'ZR-V', 'Prologue', 'Passport'],
        'Acura': ['MDX', 'RDX', 'TLX', 'Integra', 'ZDX'],
        'Hyundai': ['Tucson', 'Santa Fe', 'Elantra', 'Sonata', 'Kona', 'Creta', 'Palisade', 'Ioniq 5', 'Ioniq 6', 'Staria', 'Venue', 'Accent', 'i10', 'i20', 'Stargazer'],
        'Kia': ['Sportage', 'Seltos', 'K5', 'Sorento', 'Carnival', 'Telluride', 'EV6', 'EV9', 'Forte', 'Rio', 'Stinger', 'Niro', 'Soul', 'Picanto'],
        'BMW': ['3 Series', '5 Series', '7 Series', 'X1', 'X3', 'X5', 'X6', 'X7', 'iX', 'i4', 'i5', 'i7', 'M3', 'M4', 'M5', 'Z4', '2 Series', '4 Series', '8 Series', 'XM'],
        'Mercedes-Benz': ['C-Class', 'E-Class', 'S-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'G-Class', 'A-Class', 'CLA', 'AMG GT', 'EQS', 'EQE', 'EQA', 'EQB', 'Maybach', 'V-Class'],
        'Audi': ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron', 'e-tron GT', 'RS3', 'RS5', 'RS6', 'RS7', 'TT', 'R8', 'Q4 e-tron', 'Q8 e-tron'],
        'Volkswagen': ['Golf', 'Tiguan', 'Touareg', 'T-Roc', 'ID.4', 'ID.Buzz', 'Arteon', 'Passat', 'Polo', 'Jetta', 'Atlas', 'Taos', 'ID.7'],
        'Porsche': ['Cayenne', 'Macan', 'Panamera', '911', '718 Boxster', '718 Cayman', 'Taycan'],
        'Bentley': ['Continental GT', 'Flying Spur', 'Bentayga'],
        'Rolls-Royce': ['Phantom', 'Ghost', 'Cullinan', 'Spectre', 'Dawn', 'Wraith'],
        'Lamborghini': ['Urus', 'Huracán', 'Revuelto'],
        'Ferrari': ['Roma', '296 GTB', 'SF90 Stradale', 'F8 Tributo', '812 Superfast', 'Purosangue', 'Daytona SP3'],
        'Maserati': ['Ghibli', 'Levante', 'Quattroporte', 'MC20', 'Grecale', 'GranTurismo'],
        'Aston Martin': ['DB12', 'Vantage', 'DBX', 'DBS'],
        'McLaren': ['720S', '750S', 'Artura', 'GT'],
        'GMC': ['Sierra', 'Yukon', 'Yukon XL', 'Terrain', 'Acadia', 'Canyon', 'Hummer EV'],
        'Chevrolet': ['Tahoe', 'Suburban', 'Silverado', 'Traverse', 'Equinox', 'Blazer', 'Camaro', 'Corvette', 'Trax', 'Colorado', 'Malibu', 'Trailblazer'],
        'Ford': ['Explorer', 'Expedition', 'F-150', 'Ranger', 'Bronco', 'Mustang', 'Escape', 'Edge', 'Maverick', 'Bronco Sport', 'Mustang Mach-E', 'F-150 Lightning', 'Everest'],
        'Dodge': ['Charger', 'Challenger', 'Durango', 'Hornet'],
        'Chrysler': ['300', 'Pacifica'],
        'Jeep': ['Wrangler', 'Grand Cherokee', 'Grand Cherokee L', 'Gladiator', 'Compass', 'Renegade', 'Avenger', 'Wagoneer', 'Grand Wagoneer'],
        'Cadillac': ['Escalade', 'CT5', 'CT4', 'XT4', 'XT5', 'XT6', 'Lyriq', 'Celestiq'],
        'Lincoln': ['Navigator', 'Aviator', 'Corsair', 'Nautilus'],
        'Genesis': ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80', 'Electrified G80', 'Electrified GV70'],
        'Volvo': ['XC40', 'XC60', 'XC90', 'S60', 'S90', 'V60', 'V90', 'EX30', 'EX90', 'C40 Recharge'],
        'Land Rover': ['Range Rover', 'Range Rover Sport', 'Range Rover Velar', 'Range Rover Evoque', 'Defender', 'Discovery', 'Discovery Sport'],
        'Jaguar': ['F-Pace', 'E-Pace', 'I-Pace', 'F-Type', 'XF', 'XE'],
        'Mini': ['Cooper', 'Countryman', 'Clubman', 'Convertible', 'Paceman'],
        'Peugeot': ['3008', '5008', '2008', '208', '308', '408', '508', 'Landtrek'],
        'Renault': ['Duster', 'Koleos', 'Megane', 'Clio', 'Captur', 'Arkana', 'Austral'],
        'Citroën': ['C5 Aircross', 'C3 Aircross', 'C3', 'C4', 'Berlingo'],
        'Mitsubishi': ['Pajero', 'Outlander', 'L200', 'ASX', 'Eclipse Cross', 'Montero Sport', 'Xpander'],
        'Mazda': ['CX-5', 'CX-30', 'CX-50', 'CX-60', 'CX-90', 'Mazda3', 'Mazda6', 'MX-5', 'MX-30'],
        'Subaru': ['Outback', 'Forester', 'Crosstrek', 'WRX', 'Impreza', 'Solterra', 'BRZ', 'Ascent', 'Legacy'],
        'Suzuki': ['Jimny', 'Vitara', 'S-Cross', 'Swift', 'Baleno', 'Ertiga', 'XL7', 'Fronx', 'Invicto'],
        'Isuzu': ['D-Max', 'MU-X'],
        'Fiat': ['500', 'Panda', 'Tipo', '500X', 'Topolino', 'Doblo'],
        'MG': ['ZS', 'HS', '5', '4', 'Marvel R', 'Cyberster', 'Whale'],
        'Changan': ['CS85', 'CS75 Plus', 'CS55 Plus', 'CS35 Plus', 'Uni-T', 'Uni-K', 'Uni-V', 'Alsvin', 'Eado', 'Hunter'],
        'Haval': ['Jolion', 'H6', 'H9', 'Dargo', 'Big Dog'],
        'Chery': ['Tiggo 7 Pro', 'Tiggo 8 Pro', 'Tiggo 4 Pro', 'Arrizo 6', 'Omoda 5', 'Jaecoo J7'],
        'Geely': ['Coolray', 'Azkarra', 'Emgrand', 'Monjaro', 'Starray', 'Galaxy', 'Geometry'],
        'BYD': ['Atto 3', 'Han', 'Tang', 'Seal', 'Dolphin', 'Song Plus', 'Yuan Plus', 'Destroyer 05'],
        'GAC': ['GS3', 'GS4', 'GS8', 'Empow', 'Aion S', 'Aion Y', 'Aion V'],
        'JAC': ['S2', 'S3', 'S4', 'S7', 'T8', 'JS4', 'e-JS1'],
        'Tesla': ['Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck'],
    };

    const CAR_MAKES = Object.keys(CAR_DATA).sort();

    // Popular makes shown first in Qatar
    const POPULAR_MAKES = ['Toyota', 'Nissan', 'Land Rover', 'Lexus', 'BMW', 'Mercedes-Benz', 'Hyundai', 'Kia', 'Honda', 'Porsche', 'GMC', 'Chevrolet', 'Ford', 'Audi', 'Volkswagen'];

    // Year range (newest to oldest)
    const YEARS = [];
    for (let y = new Date().getFullYear() + 2; y >= 1990; y--) YEARS.push(String(y));

    // ─── Part Categories ──────────────────────────────────────────────────────
    const PART_CATEGORIES = [
        'Engine & Components', 'Transmission & Drivetrain', 'Turbo & Supercharger',
        'Fuel System', 'Exhaust & Emission System', 'Cooling System',
        'Suspension & Steering', 'Brakes & ABS', 'Wheels & Tires', 'Axles & Differential',
        'Body Panels & Bumpers', 'Doors & Fenders', 'Glass & Windows', 'Lights & Lamps',
        'Grilles & Trim', 'Mirrors & Accessories', 'Seats & Upholstery',
        'Dashboard & Instruments', 'Center Console & Storage', 'Interior Trim & Carpet',
        'Climate Control (HVAC)', 'Battery & Charging', 'Alternator & Starter',
        'Wiring & Fuses', 'Audio & Infotainment', 'Navigation & Display', 'Lighting Control',
        'Airbags & SRS', 'Seatbelts & Restraints', 'Anti-theft & Security',
        'Cameras & Sensors', 'Radar & Lidar Systems', 'Parking Assist',
        'Adaptive Cruise Control', 'Lane Keep Assist', 'EV Battery Packs', 'Electric Motors',
        'Inverters & Converters', 'Charging Components', 'Hybrid Systems',
        'Roof Racks & Carriers', 'Towing & Hitches', 'Performance Parts', 'Off-Road & 4x4', 'Other Parts'
    ];

    const PART_SUBCATEGORIES = {
        'Engine & Components': ['Complete Engine Assembly', 'Cylinder Head', 'Engine Block (Short/Long)', 'Crankshaft', 'Camshaft', 'Pistons & Rings', 'Timing Chain/Belt', 'Valve Cover', 'Oil Pan', 'Intake Manifold', 'Exhaust Manifold', 'Engine Mount', 'Flywheel', 'Oil Pump', 'Water Pump'],
        'Transmission & Drivetrain': ['Automatic Transmission', 'Manual Transmission', 'CVT Transmission', 'Torque Converter', 'Clutch Kit', 'Driveshaft', 'CV Axle', 'Transfer Case'],
        'Cooling System': ['Radiator', 'Water Pump', 'Thermostat', 'Radiator Fan', 'Cooling Fan Motor', 'Radiator Hose', 'Overflow Tank', 'Temperature Sensor'],
        'Suspension & Steering': ['Shock Absorber', 'Strut Assembly', 'Coil Spring', 'Control Arm', 'Ball Joint', 'Tie Rod End', 'Steering Rack', 'Power Steering Pump', 'Steering Column', 'Sway Bar Link', 'Wheel Hub Assembly', 'Wheel Bearing'],
        'Brakes & ABS': ['ABS Module', 'Brake Caliper', 'Brake Rotor/Disc', 'Brake Pad', 'Master Cylinder', 'Brake Booster', 'Brake Line', 'Wheel Speed Sensor'],
        'Lights & Lamps': ['Headlight Assembly', 'LED Headlight', 'Taillight Assembly', 'Fog Light', 'Turn Signal Light', 'DRL', 'License Plate Light'],
        'Climate Control (HVAC)': ['A/C Compressor', 'Condenser', 'Evaporator Core', 'Heater Core', 'Blower Motor', 'HVAC Control Panel', 'Cabin Air Filter'],
        'Cameras & Sensors': ['Backup Camera', 'Front Camera', '360° Camera System', 'Parking Sensor', 'Rain Sensor'],
    };

    // ─── Qatar Zones & Areas ───────────────────────────────────────────────────
    const QATAR_ZONES = [
        // Doha Central
        'West Bay', 'West Bay Lagoon', 'The Pearl-Qatar', 'Lusail', 'Al Dafna', 'Al Corniche', 'Musheireb', 'Souq Waqif', 'Al Bidda', 'Msheireb Downtown',
        // Doha North
        'Al Sadd', 'Al Muntazah', 'Al Hilal', 'Bin Mahmoud', 'Al Mirqab', 'Al Nasr', 'Madinat Khalifa', 'New Slata', 'Old Airport', 'Fereej Bin Omran',
        // Doha South & West
        'Al Aziziyah', 'Al Waab', 'Al Markhiya', 'Al Rayyan', 'Al Gharrafa', 'Ain Khaled', 'Muaither', 'Umm Salal Mohammed', 'Umm Salal Ali',
        // Industrial & Commercial
        'Industrial Area', 'Salwa Industrial Area', 'Street 1 Industrial', 'New Industrial Area', 'Free Zone', 'Logistics Village',
        // Suburban
        'Al Thumama', 'Al Wukair', 'Al Wakra', 'Al Khor', 'Al Thakhira', 'Simaisma', 'Al Daayen', 'Duhail',
        // Northern Qatar
        'Ras Laffan', 'Al Ruwais', 'Madinat Al Shamal', 'Al Zubarah', 'Al Ghuwairiya', 'Fuwairit',
        // Residential
        'Abu Hamour', 'Al Mansoura', 'Fereej Abdul Aziz', 'Najma', 'Old Al Ghanim', 'Al Maamoura', 'Rawdat Al Khail', 'Al Kheesa', 'Izghawa', 'Jeryan Nejaima',
        // New Developments
        'Lusail Marina', 'Lusail Fox Hills', 'Qetaifan Islands', 'Gewan Island', 'Al Erkyah', 'Msheireb Smart City', 'Education City', 'Qatar Foundation',
        // South
        'Mesaieed', 'Sealine', 'Abu Nakhla', 'Barwa City', 'Barwa Al Baraha',
        // West
        'Dukhan', 'Zekreet', 'Al Sheehaniya', 'Umm Bab', 'Al Karaana',
    ];

    const POPULAR_ZONES = ['West Bay', 'The Pearl-Qatar', 'Lusail', 'Industrial Area', 'Al Wakra', 'Al Rayyan', 'Al Sadd', 'Al Gharrafa', 'Al Khor', 'Abu Hamour', 'Al Thumama', 'Ain Khaled', 'Education City'];

    // ─── State ─────────────────────────────────────────────────────────────────
    let state = {
        token: null, userId: null, userName: null, userEmail: null, userPhone: null,
        authTab: 'login',
        regTemp: {},
        otpTimer: null, otpCountdown: 0,
        activeView: 'new',
        condition: 'any',
        quantity: 1,
        images: [],
        lat: null,
        lng: null,
        myRequests: [],
        requestsLoading: false,
    };

    let dom = {};

    // ─── Searchable Dropdown Widget ────────────────────────────────────────────
    function SearchableDropdown(inputId, listId, wrapId, items, opts = {}) {
        const input = q('#' + inputId);
        const list = q('#' + listId);
        const wrap = q('#' + wrapId);
        if (!input || !list || !wrap) return { getValue: () => '', setValue: () => { }, setItems: () => { } };

        let currentItems = items || [];
        let selectedValue = '';
        let highlightIdx = -1;
        const onSelect = opts.onSelect || (() => { });
        const sectionHeader = opts.sectionHeader || null; // fn(item) => section label or null
        const popularItems = opts.popularItems || [];

        function render(filter) {
            list.innerHTML = '';
            const q = (filter || '').toLowerCase().trim();
            let filtered = currentItems.filter(it => it.toLowerCase().includes(q));

            if (!filtered.length) {
                list.innerHTML = '<div class="crq-dd-empty">No results found</div>';
                return;
            }

            // Show popular section if no filter and popularItems provided
            if (!q && popularItems.length) {
                list.innerHTML += '<div class="crq-dd-section">Popular in Qatar</div>';
                popularItems.filter(p => currentItems.includes(p)).forEach((item, i) => {
                    list.innerHTML += itemHtml(item, i);
                });
                list.innerHTML += '<div class="crq-dd-section">All Makes</div>';
                const rest = filtered.filter(f => !popularItems.includes(f));
                rest.forEach((item, i) => {
                    list.innerHTML += itemHtml(item, popularItems.length + i);
                });
            } else {
                filtered.forEach((item, i) => {
                    list.innerHTML += itemHtml(item, i);
                });
            }

            highlightIdx = -1;
            bindItemClicks();
        }

        function itemHtml(item, idx) {
            const sel = item === selectedValue ? ' selected' : '';
            return `<div class="crq-dropdown-item${sel}" data-value="${escAttr(item)}" data-idx="${idx}" role="option">${escHtml(item)}</div>`;
        }

        function bindItemClicks() {
            list.querySelectorAll('.crq-dropdown-item').forEach(el => {
                el.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    select(el.dataset.value);
                });
            });
        }

        function select(val) {
            selectedValue = val;
            input.value = val;
            close();
            onSelect(val);
        }

        function open() {
            wrap.classList.add('open');
            input.setAttribute('aria-expanded', 'true');
            render(input.value !== selectedValue ? input.value : '');
        }

        function close() {
            wrap.classList.remove('open');
            input.setAttribute('aria-expanded', 'false');
            // Restore selectedValue if user typed but didn't pick
            if (input.value !== selectedValue && selectedValue) {
                input.value = selectedValue;
            }
        }

        function isOpen() { return wrap.classList.contains('open'); }

        // Events
        input.addEventListener('focus', () => { input.select(); open(); });
        input.addEventListener('input', () => { open(); render(input.value); });
        input.addEventListener('blur', () => { setTimeout(close, 150); });

        input.addEventListener('keydown', (e) => {
            const items = list.querySelectorAll('.crq-dropdown-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!isOpen()) open();
                highlightIdx = Math.min(highlightIdx + 1, items.length - 1);
                updateHighlight(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightIdx = Math.max(highlightIdx - 1, 0);
                updateHighlight(items);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (highlightIdx >= 0 && items[highlightIdx]) {
                    select(items[highlightIdx].dataset.value);
                }
            } else if (e.key === 'Escape') {
                close();
                input.blur();
            }
        });

        function updateHighlight(items) {
            items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightIdx));
            if (items[highlightIdx]) items[highlightIdx].scrollIntoView({ block: 'nearest' });
        }

        return {
            getValue: () => selectedValue,
            setValue: (v) => { selectedValue = v; input.value = v; },
            setItems: (newItems) => {
                currentItems = newItems;
                selectedValue = '';
                input.value = '';
                render('');
            },
            enable: () => { input.disabled = false; input.placeholder = opts.placeholder || 'Search…'; },
            disable: (ph) => { input.disabled = true; input.placeholder = ph || 'Select above first…'; selectedValue = ''; input.value = ''; },
        };
    }

    // ─── Init ──────────────────────────────────────────────────────────────────
    let ddMake, ddModel, ddYear, ddZone;

    function init() {
        // Initialize i18n first
        i18n.init();

        const stored = localStorage.getItem('crq_auth');
        if (stored) {
            try { const s = JSON.parse(stored); if (s.token && s.userId) Object.assign(state, s); } catch (_) { }
        }
        bindDOM();
        renderAuthOrApp();
        populateCategories();
        initSearchableDropdowns();
    }

    function initSearchableDropdowns() {
        ddMake = SearchableDropdown('crqCarMake', 'crqCarMakeList', 'crqCarMakeWrap', CAR_MAKES, {
            placeholder: 'Search make…',
            popularItems: POPULAR_MAKES,
            onSelect: (make) => {
                const models = CAR_DATA[make] || [];
                if (models.length) {
                    ddModel.setItems(models);
                    ddModel.enable();
                } else {
                    ddModel.disable('No models found');
                }
            }
        });

        ddModel = SearchableDropdown('crqCarModel', 'crqCarModelList', 'crqCarModelWrap', [], {
            placeholder: 'Search model…',
        });
        ddModel.disable('Select make first…');

        ddYear = SearchableDropdown('crqCarYear', 'crqCarYearList', 'crqCarYearWrap', YEARS, {
            placeholder: 'Search year…',
        });

        ddZone = SearchableDropdown('crqZone', 'crqZoneList', 'crqZoneWrap', QATAR_ZONES, {
            placeholder: 'Search area… e.g. West Bay, Lusail',
            popularItems: POPULAR_ZONES,
        });
    }

    function bindDOM() {
        dom = {
            authWrap: q('#crqAuthWrap'),
            appWrap: q('#crqApp'),
            tabLogin: q('#crqTabLogin'),
            tabRegister: q('#crqTabRegister'),
            formLogin: q('#crqFormLogin'),
            formRegister: q('#crqFormRegister'),
            formOtp: q('#crqFormOtp'),
            alertLogin: q('#crqAlertLogin'),
            alertRegister: q('#crqAlertRegister'),
            alertOtp: q('#crqAlertOtp'),
            inpLoginPhone: q('#crqLoginPhone'),
            inpLoginPwd: q('#crqLoginPwd'),
            btnLogin: q('#crqBtnLogin'),
            inpRegName: q('#crqRegName'),
            inpRegEmail: q('#crqRegEmail'),
            inpRegPhone: q('#crqRegPhone'),
            inpRegPwd: q('#crqRegPwd'),
            btnRegister: q('#crqBtnRegister'),
            otpEmailDisplay: q('#crqOtpEmail'),
            inpOtp: q('#crqOtpCode'),
            btnVerifyOtp: q('#crqBtnVerifyOtp'),
            btnResendOtp: q('#crqBtnResendOtp'),
            otpTimerDisplay: q('#crqOtpTimer'),
            userChipName: q('#crqUserName'),
            btnLogout: q('#crqBtnLogout'),
            viewTabNew: q('#crqViewTabNew'),
            viewTabRequests: q('#crqViewTabRequests'),
            viewNew: q('#crqViewNew'),
            viewRequests: q('#crqViewRequests'),
            selCategory: q('#crqCategory'),
            selSubcategory: q('#crqSubcategory'),
            subGroup: q('#crqSubcategoryGroup'),
            inpDesc: q('#crqDesc'),
            descCount: q('#crqDescCount'),
            inpPartNum: q('#crqPartNum'),
            condAny: q('#crqCondAny'),
            condNew: q('#crqCondNew'),
            condUsed: q('#crqCondUsed'),
            qtyMinus: q('#crqQtyMinus'),
            qtyPlus: q('#crqQtyPlus'),
            qtyVal: q('#crqQtyVal'),
            btnGps: q('#crqBtnGps'),
            gpsResult: q('#crqGpsResult'),
            gpsBtnText: q('#crqGpsBtnText'),
            inpAddressDetail: q('#crqAddressDetail'),
            photoInput: q('#crqPhotoInput'),
            photoGrid: q('#crqPhotoGrid'),
            photoZone: q('#crqPhotoZone'),
            photoCount: q('#crqPhotoCount'),
            btnSubmit: q('#crqBtnSubmit'),
            formAlert: q('#crqFormAlert'),
            successScreen: q('#crqSuccess'),
            btnNewAfterSuccess: q('#crqBtnNewAfterSuccess'),
            btnViewAfterSuccess: q('#crqBtnViewAfterSuccess'),
            requestsList: q('#crqRequestsList'),
            appNudge: q('#crqAppNudge'),
            btnDismissNudge: q('#crqBtnDismissNudge'),
            // Modal
            modalOverlay: q('#crqModalOverlay'),
            modalBackdrop: q('#crqModalBackdrop'),
            modalClose: q('#crqModalClose'),
            modalTitle: q('#crqModalTitle'),
            modalBody: q('#crqModalBody'),
        };
    }

    // ─── helpers ───────────────────────────────────────────────────────────────
    function q(sel) { return document.querySelector(sel); }
    function setLoading(btn, loading, label) {
        if (!btn) return;
        btn.disabled = loading;
        btn.innerHTML = loading
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="crq-spin-icon"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Please wait…'
            : label;
    }
    function showAlert(el, type, msg) { if (!el) return; el.className = 'crq-alert ' + type; el.textContent = msg; el.style.display = 'block'; }
    function hideAlert(el) { if (!el) return; el.style.display = 'none'; el.textContent = ''; }
    function toast(type, msg) {
        const wrap = q('#crqToastWrap');
        if (!wrap) return;
        const t = document.createElement('div');
        t.className = 'crq-toast ' + type;
        t.textContent = msg;
        wrap.appendChild(t);
        setTimeout(() => t.remove(), 4500);
    }
    function saveSession() { localStorage.setItem('crq_auth', JSON.stringify({ token: state.token, userId: state.userId, userName: state.userName, userEmail: state.userEmail, userPhone: state.userPhone })); }
    function clearSession() { localStorage.removeItem('crq_auth'); state.token = null; state.userId = null; state.userName = null; state.userEmail = null; state.userPhone = null; }
    function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function escAttr(s) { return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

    async function apiFetch(path, opts = {}) {
        const headers = { ...(opts.headers || {}) };
        if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
        const isFormData = opts.body instanceof FormData;
        if (!isFormData) headers['Content-Type'] = 'application/json';
        const res = await fetch(API + path, {
            ...opts,
            headers,
            body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const errMsg = data.error || data.message || 'Request failed';
            // Handle expired/invalid token — auto-logout
            if (res.status === 401 && /token_expired|jwt expired|invalid token|unauthorized/i.test(errMsg)) {
                clearSession();
                toast('info', 'Session expired — please sign in again.');
                setTimeout(() => location.reload(), 1200);
                throw new Error('Session expired');
            }
            throw new Error(errMsg);
        }
        return data;
    }

    // ─── Auth / App rendering ──────────────────────────────────────────────────
    function renderAuthOrApp() {
        if (state.token && state.userId) {
            dom.authWrap.style.display = 'none';
            dom.appWrap.classList.add('visible');
            if (dom.userChipName) dom.userChipName.textContent = state.userName || 'Customer';
            bindAppEvents();
            if (!localStorage.getItem('crq_nudge_dismissed') && dom.appNudge) dom.appNudge.style.display = 'flex';
        } else {
            dom.authWrap.style.display = 'flex';
            dom.appWrap.classList.remove('visible');
            bindAuthEvents();
            switchAuthTab('login');
        }
    }

    // ─── Auth ──────────────────────────────────────────────────────────────────
    function bindAuthEvents() {
        if (dom.tabLogin) dom.tabLogin.addEventListener('click', () => switchAuthTab('login'));
        if (dom.tabRegister) dom.tabRegister.addEventListener('click', () => switchAuthTab('register'));
        if (dom.btnLogin) dom.btnLogin.addEventListener('click', handleLogin);
        if (dom.btnRegister) dom.btnRegister.addEventListener('click', handleRegister);
        if (dom.btnVerifyOtp) dom.btnVerifyOtp.addEventListener('click', handleVerifyOtp);
        if (dom.btnResendOtp) dom.btnResendOtp.addEventListener('click', handleResendOtp);
    }

    function switchAuthTab(tab) {
        state.authTab = tab;
        if (dom.tabLogin) dom.tabLogin.classList.toggle('active', tab === 'login');
        if (dom.tabRegister) dom.tabRegister.classList.toggle('active', tab === 'register');
        if (dom.formLogin) dom.formLogin.style.display = tab === 'login' ? 'block' : 'none';
        if (dom.formRegister) dom.formRegister.style.display = tab === 'register' ? 'block' : 'none';
        if (dom.formOtp) dom.formOtp.style.display = tab === 'otp' ? 'block' : 'none';
        hideAlert(dom.alertLogin); hideAlert(dom.alertRegister); hideAlert(dom.alertOtp);
    }

    async function handleLogin() {
        hideAlert(dom.alertLogin);
        const phone = dom.inpLoginPhone?.value.trim(), pwd = dom.inpLoginPwd?.value;
        if (!phone || !pwd) return showAlert(dom.alertLogin, 'error', 'Phone number and password are required.');
        setLoading(dom.btnLogin, true, '');
        try {
            const data = await apiFetch('/auth/login', { method: 'POST', body: { phone_number: phone, password: pwd } });
            if (data.userType && data.userType !== 'customer') { showAlert(dom.alertLogin, 'error', 'This portal is for customers only.'); return; }
            state.token = data.token; state.userId = data.userId; state.userName = data.full_name || data.name || ''; state.userPhone = phone;
            saveSession(); renderAuthOrApp();
        } catch (err) { showAlert(dom.alertLogin, 'error', err.message || 'Login failed.'); }
        finally { setLoading(dom.btnLogin, false, 'Sign In →'); }
    }

    async function handleRegister() {
        hideAlert(dom.alertRegister);
        const full_name = dom.inpRegName?.value.trim(), email = dom.inpRegEmail?.value.trim().toLowerCase();
        const phone_number = dom.inpRegPhone?.value.trim(), password = dom.inpRegPwd?.value;
        if (!full_name || !email || !phone_number || !password) return showAlert(dom.alertRegister, 'error', 'All fields are required.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showAlert(dom.alertRegister, 'error', 'Please enter a valid email address.');
        if (password.length < 6) return showAlert(dom.alertRegister, 'error', 'Password must be at least 6 characters.');
        setLoading(dom.btnRegister, true, '');
        try {
            await apiFetch('/auth/register-with-email', { method: 'POST', body: { full_name, email, phone_number, password } });
            state.regTemp = { full_name, email, phone_number, password };
            if (dom.otpEmailDisplay) dom.otpEmailDisplay.textContent = email;
            switchAuthTab('otp'); startOtpTimer(120);
        } catch (err) { showAlert(dom.alertRegister, 'error', err.message || 'Registration failed.'); }
        finally { setLoading(dom.btnRegister, false, 'Create Account →'); }
    }

    async function handleVerifyOtp() {
        hideAlert(dom.alertOtp);
        const otp = dom.inpOtp?.value.trim();
        if (!otp || otp.length < 4) return showAlert(dom.alertOtp, 'error', 'Please enter the 6-digit verification code.');
        const { full_name, email, phone_number, password } = state.regTemp;
        setLoading(dom.btnVerifyOtp, true, '');
        try {
            const data = await apiFetch('/auth/verify-email-otp', { method: 'POST', body: { full_name, email, phone_number, password, otp } });
            clearOtpTimer();
            state.token = data.token; state.userId = data.userId; state.userName = full_name; state.userEmail = email; state.userPhone = phone_number; state.regTemp = {};
            saveSession(); renderAuthOrApp();
        } catch (err) { showAlert(dom.alertOtp, 'error', err.message || 'Invalid code.'); }
        finally { setLoading(dom.btnVerifyOtp, false, 'Verify & Create Account →'); }
    }

    async function handleResendOtp() {
        const { email, full_name } = state.regTemp;
        if (!email) return;
        hideAlert(dom.alertOtp); dom.btnResendOtp.disabled = true;
        try { await apiFetch('/auth/resend-otp', { method: 'POST', body: { email, full_name } }); showAlert(dom.alertOtp, 'success', 'Verification code resent.'); startOtpTimer(120); }
        catch (err) { showAlert(dom.alertOtp, 'error', err.message || 'Could not resend.'); dom.btnResendOtp.disabled = false; }
    }

    function startOtpTimer(s) {
        clearOtpTimer(); state.otpCountdown = s; dom.btnResendOtp.disabled = true;
        if (dom.otpTimerDisplay) dom.otpTimerDisplay.textContent = `(${s}s)`;
        state.otpTimer = setInterval(() => {
            state.otpCountdown--;
            if (dom.otpTimerDisplay) dom.otpTimerDisplay.textContent = state.otpCountdown > 0 ? `(${state.otpCountdown}s)` : '';
            if (state.otpCountdown <= 0) { clearOtpTimer(); if (dom.btnResendOtp) dom.btnResendOtp.disabled = false; }
        }, 1000);
    }
    function clearOtpTimer() { if (state.otpTimer) { clearInterval(state.otpTimer); state.otpTimer = null; } }

    // ─── App Events ────────────────────────────────────────────────────────────
    function bindAppEvents() {
        if (dom.btnLogout) dom.btnLogout.addEventListener('click', () => { clearSession(); location.reload(); });
        if (dom.viewTabNew) dom.viewTabNew.addEventListener('click', () => switchView('new'));
        if (dom.viewTabRequests) dom.viewTabRequests.addEventListener('click', () => switchView('requests'));
        if (dom.selCategory) dom.selCategory.addEventListener('change', onCategoryChange);
        [dom.condAny, dom.condNew, dom.condUsed].forEach(el => { if (el) el.addEventListener('click', () => setCondition(el.dataset.value)); });
        if (dom.qtyMinus) dom.qtyMinus.addEventListener('click', () => setQty(state.quantity - 1));
        if (dom.qtyPlus) dom.qtyPlus.addEventListener('click', () => setQty(state.quantity + 1));
        if (dom.inpDesc) dom.inpDesc.addEventListener('input', () => { const len = dom.inpDesc.value.length; if (dom.descCount) dom.descCount.textContent = len + '/1000'; if (len > 1000) dom.inpDesc.value = dom.inpDesc.value.slice(0, 1000); });
        if (dom.photoInput) dom.photoInput.addEventListener('change', onPhotoSelect);
        if (dom.photoZone) {
            dom.photoZone.addEventListener('dragover', e => { e.preventDefault(); dom.photoZone.classList.add('drag-over'); });
            dom.photoZone.addEventListener('dragleave', () => dom.photoZone.classList.remove('drag-over'));
            dom.photoZone.addEventListener('drop', e => { e.preventDefault(); dom.photoZone.classList.remove('drag-over'); addPhotos([...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))); });
        }
        if (dom.btnGps) {
            dom.btnGps.addEventListener('click', () => {
                if (!navigator.geolocation) return showErr('Geolocation is not supported by your browser.');
                const originalText = dom.gpsBtnText.textContent;
                dom.gpsBtnText.textContent = '📍 Locating...';
                dom.btnGps.disabled = true;
                navigator.geolocation.getCurrentPosition(pos => {
                    state.lat = pos.coords.latitude;
                    state.lng = pos.coords.longitude;
                    dom.gpsResult.style.display = 'block';
                    dom.gpsResult.innerHTML = `<span style="color:var(--success)">✅ Location captured: ${state.lat.toFixed(5)}, ${state.lng.toFixed(5)}</span>`;
                    dom.gpsBtnText.textContent = '📍 Update location';
                    dom.btnGps.disabled = false;
                }, err => {
                    dom.gpsBtnText.textContent = originalText;
                    dom.btnGps.disabled = false;
                    showErr('Failed to get location. Please allow location access.');
                }, { enableHighAccuracy: true, timeout: 10000 });
            });
        }
        if (dom.btnSubmit) dom.btnSubmit.addEventListener('click', handleSubmit);
        if (dom.btnNewAfterSuccess) dom.btnNewAfterSuccess.addEventListener('click', resetForm);
        if (dom.btnViewAfterSuccess) dom.btnViewAfterSuccess.addEventListener('click', () => { resetForm(); switchView('requests'); });
        if (dom.btnDismissNudge) dom.btnDismissNudge.addEventListener('click', () => { if (dom.appNudge) dom.appNudge.style.display = 'none'; localStorage.setItem('crq_nudge_dismissed', '1'); });

        // Modal
        if (dom.modalClose) dom.modalClose.addEventListener('click', closeModal);
        if (dom.modalBackdrop) dom.modalBackdrop.addEventListener('click', closeModal);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    }

    function switchView(view) {
        state.activeView = view;
        const isNew = view === 'new';
        if (dom.viewTabNew) dom.viewTabNew.classList.toggle('active', isNew);
        if (dom.viewTabRequests) dom.viewTabRequests.classList.toggle('active', !isNew);
        if (dom.viewNew) dom.viewNew.style.display = isNew ? 'block' : 'none';
        if (dom.viewRequests) dom.viewRequests.style.display = isNew ? 'none' : 'block';
        if (!isNew && !state.requestsLoading) loadMyRequests();
    }

    // ─── Form ──────────────────────────────────────────────────────────────────
    function populateCategories() {
        if (!dom.selCategory) return;
        dom.selCategory.innerHTML = '<option value="">— Select category (optional) —</option>';
        PART_CATEGORIES.forEach(cat => { const o = document.createElement('option'); o.value = o.textContent = cat; dom.selCategory.appendChild(o); });
    }

    function onCategoryChange() {
        const cat = dom.selCategory.value;
        const subs = PART_SUBCATEGORIES[cat] || [];
        if (subs.length && dom.selSubcategory && dom.subGroup) {
            dom.selSubcategory.innerHTML = '<option value="">— Select subcategory (optional) —</option>';
            subs.forEach(s => { const o = document.createElement('option'); o.value = o.textContent = s; dom.selSubcategory.appendChild(o); });
            dom.subGroup.style.display = 'block';
        } else if (dom.subGroup) { dom.subGroup.style.display = 'none'; }
    }

    function setCondition(val) { state.condition = val;[dom.condAny, dom.condNew, dom.condUsed].forEach(el => { if (el) el.classList.toggle('active', el.dataset.value === val); }); }
    function setQty(n) { state.quantity = Math.max(1, Math.min(99, n)); if (dom.qtyVal) dom.qtyVal.textContent = state.quantity; if (dom.qtyMinus) dom.qtyMinus.disabled = state.quantity <= 1; }
    function onPhotoSelect(e) { addPhotos([...e.target.files]); e.target.value = ''; }
    function addPhotos(files) { const rem = 5 - state.images.length; files.slice(0, rem).forEach(f => state.images.push(f)); renderPhotoGrid(); if (dom.photoCount) dom.photoCount.textContent = `${state.images.length}/5 photos`; }
    function renderPhotoGrid() {
        if (!dom.photoGrid) return;
        dom.photoGrid.innerHTML = '';
        state.images.forEach((file, i) => {
            const url = URL.createObjectURL(file);
            const t = document.createElement('div'); t.className = 'crq-photo-thumb';
            t.innerHTML = `<img src="${url}" alt="Photo ${i + 1}"><button class="crq-photo-remove" data-idx="${i}" aria-label="Remove photo">×</button>`;
            dom.photoGrid.appendChild(t);
        });
        dom.photoGrid.querySelectorAll('.crq-photo-remove').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); state.images.splice(parseInt(btn.dataset.idx), 1); renderPhotoGrid(); if (dom.photoCount) dom.photoCount.textContent = `${state.images.length}/5 photos`; });
        });
    }

    // ─── Submit ────────────────────────────────────────────────────────────────
    async function handleSubmit() {
        hideAlert(dom.formAlert);
        const car_make = ddMake ? ddMake.getValue() : q('#crqCarMake')?.value.trim();
        const car_model = ddModel ? ddModel.getValue() : q('#crqCarModel')?.value.trim();
        const car_year = ddYear ? ddYear.getValue() : q('#crqCarYear')?.value.trim();
        const part_description = dom.inpDesc?.value.trim();

        if (!car_make) return showErr('Please select a car make.');
        if (!car_model) return showErr('Please select a car model.');
        if (!car_year) return showErr('Please select a year.');
        const yearNum = parseInt(car_year, 10);
        if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 2) return showErr('Please select a valid car year.');
        if (!part_description || part_description.length < 10) return showErr('Part description must be at least 10 characters.');

        const vin_number = q('#crqVin')?.value.trim();
        if (vin_number && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin_number)) return showErr('VIN must be exactly 17 alphanumeric characters.');

        setLoading(dom.btnSubmit, true, '');
        try {
            const fd = new FormData();
            fd.append('car_make', car_make);
            fd.append('car_model', car_model);
            fd.append('car_year', String(yearNum));
            if (vin_number) fd.append('vin_number', vin_number.toUpperCase());
            let finalDesc = part_description;
            if (state.quantity > 1) finalDesc += `\n\nQuantity: ${state.quantity} pcs`;
            fd.append('part_description', finalDesc);
            const cat = dom.selCategory?.value, sub = dom.selSubcategory?.value;
            if (cat) fd.append('part_category', cat);
            if (sub) fd.append('part_subcategory', sub);
            const partNum = dom.inpPartNum?.value.trim();
            if (partNum) fd.append('part_number', partNum);
            fd.append('condition_required', state.condition);
            const zone = ddZone ? ddZone.getValue() : '';
            const detail = dom.inpAddressDetail?.value.trim() || '';
            const addr = [zone, detail].filter(Boolean).join(', ');
            if (addr) fd.append('delivery_address_text', addr);
            if (state.lat && state.lng) {
                fd.append('delivery_lat', state.lat);
                fd.append('delivery_lng', state.lng);
            }
            state.images.forEach(f => fd.append('images', f));
            await apiFetch('/requests', { method: 'POST', body: fd });
            showSuccessScreen();
        } catch (err) { showErr(err.message || 'Failed to submit request.'); }
        finally { setLoading(dom.btnSubmit, false, '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Submit Request'); }
    }

    function showErr(msg) { showAlert(dom.formAlert, 'error', msg); dom.formAlert?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

    function showSuccessScreen() {
        if (dom.viewNew) { const a = dom.viewNew.querySelector('.crq-form-areas'); if (a) a.style.display = 'none'; }
        if (dom.successScreen) { dom.successScreen.classList.add('visible'); dom.successScreen.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        toast('success', '🎉 Request submitted! Garages are reviewing it now.');
    }

    function resetForm() {
        state.condition = 'any'; state.quantity = 1; state.images = [];
        if (ddMake) ddMake.setValue('');
        if (ddModel) { ddModel.disable('Select make first…'); }
        if (ddYear) ddYear.setValue('');
        if (q('#crqVin')) q('#crqVin').value = '';
        if (dom.selCategory) { dom.selCategory.value = ''; onCategoryChange(); }
        if (dom.inpDesc) dom.inpDesc.value = '';
        if (dom.descCount) dom.descCount.textContent = '0/1000';
        if (dom.inpPartNum) dom.inpPartNum.value = '';
        if (ddZone) ddZone.setValue('');
        if (dom.inpAddressDetail) dom.inpAddressDetail.value = '';
        if (dom.photoGrid) dom.photoGrid.innerHTML = '';
        state.lat = null; state.lng = null;
        if (dom.gpsResult) { dom.gpsResult.style.display = 'none'; dom.gpsResult.innerHTML = ''; }
        if (dom.gpsBtnText) dom.gpsBtnText.textContent = '📍 Use my current location';
        if (dom.photoCount) dom.photoCount.textContent = '0/5 photos';
        if (dom.qtyVal) dom.qtyVal.textContent = '1';
        setCondition('any'); hideAlert(dom.formAlert);
        if (dom.successScreen) dom.successScreen.classList.remove('visible');
        if (dom.viewNew) { const a = dom.viewNew.querySelector('.crq-form-areas'); if (a) a.style.display = 'block'; }
    }

    // ─── My Requests ───────────────────────────────────────────────────────────
    async function loadMyRequests() {
        if (!dom.requestsList) return;
        state.requestsLoading = true;
        dom.requestsList.innerHTML = '<div class="crq-spinner"></div>';
        try {
            const data = await apiFetch('/requests/my?page=1&limit=20');
            const requests = data.requests || data.data || [];
            state.myRequests = requests;
            renderRequestsList(requests);
        } catch (err) {
            dom.requestsList.innerHTML = `<div class="crq-empty"><div class="crq-empty-icon">⚠️</div><div class="crq-empty-title">Could not load requests</div><div class="crq-empty-text">${escHtml(err.message)}</div></div>`;
        } finally { state.requestsLoading = false; }
    }

    function renderRequestsList(requests) {
        if (!dom.requestsList) return;
        if (!requests.length) {
            dom.requestsList.innerHTML = `<div class="crq-empty"><div class="crq-empty-icon">📋</div><div class="crq-empty-title">No requests yet</div><div class="crq-empty-text">Submit your first parts request and get bids from verified garages.</div></div>`;
            return;
        }
        dom.requestsList.innerHTML = requests.map(r => {
            const statusClass = { active: 'active', pending: 'active', completed: 'completed', cancelled: 'cancelled', expired: 'expired' }[r.status] || 'expired';
            const statusLabel = { active: 'Active', pending: 'Active', completed: 'Completed', cancelled: 'Cancelled', expired: 'Expired' }[r.status] || r.status;
            const bids = r.bid_count || r.bids_count || 0;
            const date = new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const car = `${r.car_year} ${r.car_make} ${r.car_model}`;
            const desc = r.part_description ? r.part_description.substring(0, 120) : '';
            return `<div class="crq-request-card" data-rid="${r.request_id}">
                <div class="crq-request-card-top">
                    <div><div class="crq-request-car">${escHtml(car)}</div><div class="crq-request-desc">${escHtml(desc)}</div></div>
                    <span class="crq-status-pill ${statusClass}">${statusLabel}</span>
                </div>
                <div class="crq-request-meta">
                    <span class="crq-request-meta-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${date}</span>
                    ${r.part_category ? `<span class="crq-request-meta-item">${escHtml(r.part_category)}</span>` : ''}
                    ${bids > 0 ? `<span class="crq-bid-badge">🏷️ ${bids} bid${bids !== 1 ? 's' : ''}</span>` : ''}
                </div>
            </div>`;
        }).join('');

        // Bind click to open modal
        dom.requestsList.querySelectorAll('.crq-request-card').forEach(card => {
            card.addEventListener('click', () => {
                const rid = card.dataset.rid;
                const req = state.myRequests.find(r => String(r.request_id) === String(rid));
                if (req) openRequestModal(req);
            });
        });
    }

    // ─── Request Detail Modal ──────────────────────────────────────────────────
    async function openRequestModal(r) {
        if (!dom.modalOverlay || !dom.modalBody) return;

        const car = `${r.car_year} ${r.car_make} ${r.car_model}`;
        if (dom.modalTitle) dom.modalTitle.textContent = car;

        // Show loading state immediately
        dom.modalBody.innerHTML = '<div class="crq-spinner"></div>';
        dom.modalOverlay.classList.add('visible');
        dom.modalOverlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Fetch full details with bids from dedicated endpoint
        let fullData = r;
        let bids = [];
        try {
            const data = await apiFetch('/requests/' + r.request_id);
            if (data.request) fullData = data.request;
            bids = data.bids || [];
        } catch (_) {
            // Fallback to basic data if fetch fails
            bids = [];
        }

        renderModalContent(fullData, bids);
    }

    function renderModalContent(r, bids) {
        const car = `${r.car_year} ${r.car_make} ${r.car_model}`;
        const date = new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const statusMap = { active: 'active', pending: 'active', accepted: 'completed', completed: 'completed', cancelled: 'cancelled', expired: 'expired' };
        const labelMap = { active: 'Active', pending: 'Active', accepted: 'Accepted', completed: 'Completed', cancelled: 'Cancelled', expired: 'Expired' };
        const statusClass = statusMap[r.status] || 'expired';
        const statusLabel = labelMap[r.status] || r.status;
        const images = r.image_urls || r.images || [];

        let html = `
            <div class="crq-detail-row">
                <div class="crq-detail-label">Status</div>
                <div class="crq-detail-value"><span class="crq-status-pill ${statusClass}">${statusLabel}</span></div>
            </div>
            <div class="crq-detail-row">
                <div class="crq-detail-label">Vehicle</div>
                <div class="crq-detail-value"><strong>${escHtml(car)}</strong>${r.vin_number ? '<br><small style="color:var(--slate)">VIN: ' + escHtml(r.vin_number) + '</small>' : ''}</div>
            </div>
            <div class="crq-detail-row">
                <div class="crq-detail-label">Part</div>
                <div class="crq-detail-value">${escHtml(r.part_description || '—')}</div>
            </div>`;

        if (r.part_category) html += `
            <div class="crq-detail-row">
                <div class="crq-detail-label">Category</div>
                <div class="crq-detail-value">${escHtml(r.part_category)}${r.part_subcategory ? ' → ' + escHtml(r.part_subcategory) : ''}</div>
            </div>`;

        if (r.part_number) html += `
            <div class="crq-detail-row">
                <div class="crq-detail-label">Part #</div>
                <div class="crq-detail-value" style="font-family:monospace">${escHtml(r.part_number)}</div>
            </div>`;

        html += `
            <div class="crq-detail-row">
                <div class="crq-detail-label">Condition</div>
                <div class="crq-detail-value">${escHtml(r.condition_required === 'any' ? 'Any Condition' : r.condition_required === 'new' ? 'New Only' : r.condition_required === 'used' ? 'Used Only' : (r.condition_required || 'Any'))}</div>
            </div>`;

        if (r.delivery_address_text) html += `
            <div class="crq-detail-row">
                <div class="crq-detail-label">Delivery</div>
                <div class="crq-detail-value">${escHtml(r.delivery_address_text)}</div>
            </div>
            <div class="crq-detail-row">
                <div class="crq-detail-label">Created</div>
                <div class="crq-detail-value">${date}</div>
            </div>`;

        if (!r.delivery_address_text) html += `
            <div class="crq-detail-row">
                <div class="crq-detail-label">Created</div>
                <div class="crq-detail-value">${date}</div>
            </div>`;

        if (images.length) {
            html += `
            <div class="crq-detail-row">
                <div class="crq-detail-label">Photos</div>
                <div class="crq-detail-value"><div class="crq-detail-photos">
                    ${images.map(url => `<img class="crq-detail-photo" src="${escAttr(url)}" alt="Part photo" loading="lazy">`).join('')}
                </div></div>
            </div>`;
        }

        // ── Bids Section ──
        html += '<div class="crq-bids-section">';
        html += `<div class="crq-bids-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
            <span>Garage Bids (${bids.length})</span>
        </div>`;

        if (!bids.length) {
            html += '<div class="crq-bids-empty"><div style="font-size:28px;margin-bottom:8px">⏳</div><div style="font-weight:600;color:var(--charcoal)">No bids yet</div><div style="font-size:13px;color:var(--slate);margin-top:4px">Verified garages are reviewing your request. You\'ll receive bids soon.</div></div>';
        } else {
            bids.forEach((bid, i) => {
                const bidPrice = parseFloat(bid.bid_amount).toFixed(2);
                const deliveryFee = bid.delivery_fee ? parseFloat(bid.delivery_fee).toFixed(2) : null;
                const condLabel = bid.condition_offered === 'new' ? 'New' : bid.condition_offered === 'used' ? 'Used' : bid.condition_offered === 'aftermarket' ? 'Aftermarket' : (bid.condition_offered || '—');
                const garageName = bid.garage_name || `Garage ${i + 1}`;
                const rating = bid.garage_rating ? parseFloat(bid.garage_rating).toFixed(1) : null;
                const txns = bid.total_transactions || 0;
                const bidImages = bid.image_urls || [];
                const bidStatus = bid.status === 'accepted' ? 'accepted' : 'pending';
                const bidStatusLabel = bid.status === 'accepted' ? '✅ Accepted' : '⏳ Pending';
                const rounds = parseInt(bid.negotiation_rounds) || 0;
                const hasPending = bid.has_pending_negotiation;
                const planBadge = bid.plan_code === 'enterprise' ? '🏆' : bid.plan_code === 'professional' ? '⭐' : '';
                const bidNote = bid.notes || bid.message || '';

                html += `<div class="crq-bid-card ${bidStatus}">
                    <div class="crq-bid-card-top">
                        <div class="crq-bid-garage">
                            <div class="crq-bid-garage-avatar">${garageName.charAt(0).toUpperCase()}</div>
                            <div>
                                <div class="crq-bid-garage-name">${planBadge ? planBadge + ' ' : ''}${escHtml(garageName)}</div>
                                <div class="crq-bid-garage-meta">
                                    ${rating ? '⭐ ' + rating : ''}${rating && txns ? ' · ' : ''}${txns ? txns + ' sales' : ''}
                                </div>
                            </div>
                        </div>
                        <div class="crq-bid-price-box">
                            <div class="crq-bid-price">QAR ${bidPrice}</div>
                            ${deliveryFee ? '<div class="crq-bid-delivery">+ QAR ' + deliveryFee + ' delivery</div>' : '<div class="crq-bid-delivery">Free delivery</div>'}
                        </div>
                    </div>
                    <div class="crq-bid-details-row">
                        <span class="crq-bid-detail-chip">${escHtml(condLabel)}</span>
                        <span class="crq-bid-detail-chip">${bidStatusLabel}</span>
                        ${rounds > 0 ? `<span class="crq-bid-detail-chip">🔄 ${rounds} round${rounds !== 1 ? 's' : ''}</span>` : ''}
                        ${hasPending ? '<span class="crq-bid-detail-chip pending-chip">💬 Counter pending</span>' : ''}
                    </div>`;

                if (bidNote) {
                    html += `<div class="crq-bid-note"><strong>Note:</strong> ${escHtml(bidNote)}</div>`;
                }

                if (bidImages.length) {
                    html += `<div class="crq-bid-images">${bidImages.map(url => `<img src="${escAttr(url)}" alt="Bid photo" class="crq-detail-photo" loading="lazy">`).join('')}</div>`;
                }

                html += '</div>';
            });

            // App download CTA — users must accept/reject bids via the mobile app
            html += `<div class="crq-bid-app-cta">
                <div class="crq-bid-app-cta-icon">📱</div>
                <div>
                    <div style="font-weight:700;font-size:14px;color:var(--charcoal)">Accept bids on the QScrap app</div>
                    <div style="font-size:13px;color:var(--slate);margin-top:2px">Download the app to compare, negotiate, and accept bids from garages.</div>
                </div>
            </div>`;
        }

        html += '</div>'; // close bids section

        dom.modalBody.innerHTML = html;
    }

    function closeModal() {
        if (!dom.modalOverlay) return;
        dom.modalOverlay.classList.remove('visible');
        dom.modalOverlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    // ─── Boot ──────────────────────────────────────────────────────────────────
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
    window.crqSwitchAuthTab = switchAuthTab;
})();
