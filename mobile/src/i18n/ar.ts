/**
 * Arabic Translations for QScrap Mobile App
 * الترجمات العربية لتطبيق كيو سكراب
 */

export const ar = {
    // Common - عام
    common: {
        loading: 'جاري التحميل...',
        error: 'خطأ',
        success: 'نجاح',
        cancel: 'إلغاء',
        confirm: 'تأكيد',
        save: 'حفظ',
        delete: 'حذف',
        edit: 'تعديل',
        close: 'إغلاق',
        back: 'رجوع',
        next: 'التالي',
        done: 'تم',
        retry: 'إعادة المحاولة',
        search: 'بحث',
        noResults: 'لا توجد نتائج',
        optional: 'اختياري',
        required: 'مطلوب',
        qar: 'ر.ق',
    },

    // Auth - المصادقة
    auth: {
        login: 'تسجيل الدخول',
        register: 'إنشاء حساب',
        logout: 'تسجيل الخروج',
        phone: 'رقم الهاتف',
        password: 'كلمة المرور',
        confirmPassword: 'تأكيد كلمة المرور',
        fullName: 'الاسم الكامل',
        welcomeBack: 'مرحباً بعودتك',
        signInContinue: 'سجل الدخول للمتابعة',
        noAccount: 'ليس لديك حساب؟',
        hasAccount: 'لديك حساب بالفعل؟',
        forgotPassword: 'نسيت كلمة المرور؟',
        agreeTerms: 'بتسجيل الدخول، أنت توافق على',
        termsOfService: 'شروط الخدمة',
        and: 'و',
        privacyPolicy: 'سياسة الخصوصية',
        logoutConfirm: 'هل أنت متأكد من تسجيل الخروج؟',
        loginFailed: 'فشل تسجيل الدخول',
        registerFailed: 'فشل التسجيل',
    },

    // Navigation - التنقل
    nav: {
        home: 'طلب جديد',
        requests: 'الطلبات',
        orders: 'الطلبيات',
        profile: 'الملف الشخصي',
        support: 'الدعم',
    },

    // Home / Create Request - الرئيسية / إنشاء طلب
    home: {
        title: 'ابحث عن قطع غيار',
        subtitle: 'ابحث عن قطع من الكراجات المعتمدة في قطر',
        carMake: 'نوع السيارة',
        carModel: 'موديل السيارة',
        carYear: 'سنة الصنع',
        vinOptional: 'رقم الشاسيه (اختياري)',
        partCategory: 'فئة القطعة',
        partDescription: 'وصف القطعة',
        partDescriptionPlaceholder: 'صف القطعة التي تحتاجها...',
        partNumber: 'رقم القطعة (اختياري)',
        deliveryAddress: 'عنوان التوصيل',
        deliveryAddressPlaceholder: 'أدخل عنوان التوصيل...',
        addPhotos: 'إضافة صور',
        photosHelp: 'أضف صور للقطعة أو سيارتك للحصول على نتائج أفضل',
        submitRequest: 'إرسال الطلب',
        submitting: 'جاري الإرسال...',
        requestSubmitted: 'تم إرسال الطلب!',
        requestSubmittedMsg: 'ستتلقى عروض أسعار من الكراجات قريباً',
    },

    // Requests - الطلبات
    requests: {
        title: 'طلباتي',
        count: '{{count}} طلب',
        noRequests: 'لا توجد طلبات',
        noRequestsMsg: 'أنشئ أول طلب واحصل على عروض من الكراجات المعتمدة',
        createRequest: 'إنشاء طلب',
        noMatching: 'لا توجد طلبات مطابقة',
        noMatchingMsg: 'جرب تعديل الفلاتر لرؤية المزيد من النتائج',
        clearFilters: 'مسح الفلاتر',
        filters: {
            all: 'الكل',
            active: 'نشط',
            withBids: 'مع عروض',
            expired: 'منتهي',
        },
        bids: '{{count}} عرض',
    },

    // Orders - الطلبيات
    orders: {
        title: 'طلبياتي',
        count: '{{count}} طلبية',
        noOrders: 'لا توجد طلبيات',
        noOrdersMsg: 'عند قبول عرض سعر، ستظهر الطلبية هنا',
        browseRequests: 'تصفح الطلبات',
        noMatching: 'لا توجد طلبيات مطابقة',
        noMatchingMsg: 'جرب تعديل الفلاتر لرؤية المزيد من النتائج',
        clearFilters: 'مسح الفلاتر',
        filters: {
            all: 'الكل',
            active: 'نشط',
            completed: 'مكتمل',
            cancelled: 'ملغي',
        },
        trackDelivery: 'تتبع التوصيل',
        confirmDelivery: 'تأكيد الاستلام',
        writeReview: 'كتابة تقييم',
        cancelOrder: 'إلغاء الطلب',
        openDispute: 'فتح شكوى',
    },

    // Profile - الملف الشخصي
    profile: {
        title: 'الملف الشخصي',
        editProfile: 'تعديل الملف',
        savedAddresses: 'العناوين المحفوظة',
        addresses: '{{count}} عنوان',
        darkMode: 'الوضع الداكن',
        notifications: 'الإشعارات',
        enabled: 'مفعل',
        disabled: 'معطل',
        helpFaq: 'المساعدة والأسئلة',
        termsPrivacy: 'شروط الخدمة',
        privacyPolicy: 'سياسة الخصوصية',
        version: 'الإصدار {{version}}',
        account: 'الحساب',
        preferences: 'التفضيلات',
        about: 'حول التطبيق',
    },

    // Support - الدعم
    support: {
        title: 'الدعم',
        newTicket: 'تذكرة جديدة',
        openTickets: 'التذاكر المفتوحة',
        closedTickets: 'التذاكر المغلقة',
        noTickets: 'لا توجد تذاكر دعم',
        noTicketsMsg: 'تحتاج مساعدة؟ أنشئ تذكرة دعم',
        createTicket: 'إنشاء تذكرة',
        subject: 'الموضوع',
        message: 'الرسالة',
        typeMessage: 'اكتب رسالتك...',
        send: 'إرسال',
    },

    // Status - الحالة
    status: {
        pending: 'قيد الانتظار',
        processing: 'قيد المعالجة',
        active: 'نشط',
        completed: 'مكتمل',
        cancelled: 'ملغي',
        delivered: 'تم التوصيل',
        outForDelivery: 'في الطريق',
        disputed: 'متنازع عليه',
        expired: 'منتهي',
    },

    // Onboarding - الترحيب
    onboarding: {
        skip: 'تخطي',
        next: 'التالي',
        getStarted: 'ابدأ الآن',
        slide1Title: 'ابحث عن أي قطعة غيار',
        slide1Desc: 'ابحث عن قطع جديدة أو مستعملة لأي نوع وموديل سيارة. شبكتنا من الكراجات المعتمدة تغطي احتياجاتك.',
        slide2Title: 'احصل على عروض تنافسية',
        slide2Desc: 'انشر طلبك واحصل على عروض متعددة من موردين موثوقين. قارن الأسعار والضمانات والتقييمات.',
        slide3Title: 'الجودة مضمونة',
        slide3Desc: 'جميع الكراجات معتمدة. القطع تمر بفحص الجودة قبل التوصيل. حماية الضمان متضمنة.',
        slide4Title: 'توصيل سريع',
        slide4Desc: 'تتبع طلبك في الوقت الفعلي. توصيل في نفس اليوم متاح في كافة أنحاء قطر. إرجاع سهل.',
    },

    // Errors - الأخطاء
    errors: {
        network: 'لا يوجد اتصال بالإنترنت',
        server: 'خطأ في الخادم. يرجى المحاولة مرة أخرى.',
        unknown: 'حدث خطأ ما',
        required: '{{field}} مطلوب',
        invalidEmail: 'يرجى إدخال بريد إلكتروني صحيح',
        invalidPhone: 'يرجى إدخال رقم هاتف صحيح',
        passwordShort: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
        passwordMismatch: 'كلمات المرور غير متطابقة',
    },
};

export default ar;
