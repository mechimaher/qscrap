// ===== 2026 ENTERPRISE BILINGUAL I18N SYSTEM FOR LEGAL PAGES =====
// Full Arabic + English translations for legal pages
// Following Qatar compliance requirements

const legalTranslations = {
    en: {
        // Navigation
        'nav.backHome': 'Back to Home',

        // Common UI badges
        'hero.protected': 'Your Data is Protected',
        'hero.regulated': 'Regulated by Qatar Law',
        'hero.dispute': 'Fair & Transparent',
        'hero.protection': 'Customer Protection',
        'hero.agreement': 'Legal Agreement',

        // ===== REFUND POLICY =====
        'refund.title': 'Refund Policy',
        'refund.titleAr': 'سياسة الاسترداد',
        'refund.lastUpdated': 'Last updated: February 1, 2026 | آخر تحديث: 1 فبراير 2026',

        // Summary
        'refund.summary.title': '💰 Our Commitment to You',
        'refund.summary.text': 'At QScrap, we believe in fair and transparent refund policies. This document outlines when and how you can receive a refund for your orders. Our escrow payment system ensures your money is protected throughout the entire transaction process.',

        // Section 1
        'refund.s1.title': '7-Day Return Guarantee',
        'refund.s1.intro': 'All parts purchased through QScrap come with a 7-day return guarantee from the date of delivery:',
        'refund.s1.item1': "If the part doesn't fit your vehicle as specified",
        'refund.s1.item2': 'If the part is significantly different from the description',
        'refund.s1.item3': 'If the part is defective or damaged upon receipt',
        'refund.s1.item4': 'If the part was incorrectly identified by the garage',
        'refund.s1.highlight': "<strong>Full refund guaranteed</strong> within 7 days if the part doesn't match the listing description or is defective.",

        // Section 2
        'refund.s2.title': 'Cancellation Stages & Refunds',
        'refund.s2.intro': 'Your refund amount depends on when you cancel your order:',
        'refund.s2.th1': 'Stage',
        'refund.s2.th2': 'When',
        'refund.s2.th3': 'Refund',
        'refund.s2.stage1': 'Before Garage Accepts',
        'refund.s2.when1': 'Order submitted, waiting for garage',
        'refund.s2.refund1': '100% Refund',
        'refund.s2.stage2': 'After Garage Accepts',
        'refund.s2.when2': 'Garage confirmed, preparing part',
        'refund.s2.refund2': '100% Refund',
        'refund.s2.stage3': 'Part Ready',
        'refund.s2.when3': 'Part prepared, awaiting pickup',
        'refund.s2.refund3': '90% Refund',
        'refund.s2.stage4': 'Driver Assigned',
        'refund.s2.when4': 'Driver picked up the part',
        'refund.s2.refund4': '85% Refund',
        'refund.s2.stage5': 'In Transit',
        'refund.s2.when5': 'Part is on the way to you',
        'refund.s2.refund5': '80% Refund',
        'refund.s2.stage6': 'After Delivery',
        'refund.s2.when6': 'Within 7-day return window',
        'refund.s2.refund6': '85-100% Refund*',
        'refund.s2.note': '<strong>*Note:</strong> Post-delivery refunds may vary based on part condition. Full refund for defective/wrong parts. Return shipping may be deducted for change-of-mind returns.',

        // Section 3
        'refund.s3.title': 'Non-Refundable Items',
        'refund.s3.intro': 'The following situations are not eligible for refund:',
        'refund.s3.item1': 'Parts that have been installed or modified',
        'refund.s3.item2': 'Parts damaged after delivery due to customer handling',
        'refund.s3.item3': 'Parts returned after the 7-day return window',
        'refund.s3.item4': 'Custom-order or specially sourced parts (unless defective)',
        'refund.s3.item5': 'Electrical parts that have been tested/connected (unless defective on arrival)',
        'refund.s3.warning': '<strong>Important:</strong> Always inspect your parts before installation. Once installed, parts cannot be returned for fitment issues.',

        // Section 4
        'refund.s4.title': 'How to Request a Refund',
        'refund.s4.intro': 'To request a refund:',
        'refund.s4.item1': 'Open the QScrap app and go to "My Orders"',
        'refund.s4.item2': 'Select the order you wish to return or cancel',
        'refund.s4.item3': 'Tap "Request Refund" and select your reason',
        'refund.s4.item4': 'Upload photos if reporting a defective or wrong part',
        'refund.s4.item5': 'Our support team will review within 24 hours',
        'refund.s4.contact': 'For urgent issues, contact us directly at <a href="mailto:support@qscrap.qa">support@qscrap.qa</a> or WhatsApp <a href="https://wa.me/97450267974" dir="ltr">+974 5026 7974</a>.',

        // Section 5
        'refund.s5.title': 'Refund Processing Time',
        'refund.s5.item1': '<strong>Card Payments:</strong> 5-7 business days after approval',
        'refund.s5.item2': '<strong>Cash on Delivery:</strong> Bank transfer within 3-5 business days',
        'refund.s5.item3': '<strong>QScrap Wallet:</strong> Instant credit after approval',
        'refund.s5.tip': '<strong>Tip:</strong> Refunds to your QScrap Wallet are processed instantly and can be used for future purchases or withdrawn to your bank account.',

        // Section 6
        'refund.s6.title': 'Dispute Resolution',
        'refund.s6.intro': 'If you disagree with a refund decision:',
        'refund.s6.item1': 'Request an escalation through the app or email',
        'refund.s6.item2': 'Our senior support team will review within 48 hours',
        'refund.s6.item3': 'You may provide additional evidence (photos, videos)',
        'refund.s6.item4': 'Final decisions comply with Qatar Consumer Protection Law',
        'refund.s6.rights': "<strong>Consumer Rights:</strong> Nothing in this policy affects your statutory rights under Qatar's Consumer Protection Law (Law No. 8 of 2008) and MOCI regulations.",

        // Contact Card
        'refund.contact.title': '📞 Need Help?',
        'refund.contact.support': 'Refund Support',
        'refund.contact.whatsapp': 'WhatsApp',
        'refund.contact.service': 'Customer Service',
        'refund.contact.website': 'Website',
        'refund.contact.company': 'QScrap Services & Trading L.L.C',
        'refund.contact.companyAr': 'كيوسكراب للخدمات والتجارة ذ.م.م',
        'refund.contact.cr': '',

        // ===== TERMS OF SERVICE =====
        'terms.title': 'Terms of Service',
        'terms.titleAr': 'شروط الخدمة',
        'terms.lastUpdated': 'Last updated: February 1, 2026 | آخر تحديث: 1 فبراير 2026',

        'terms.summary.title': '📋 Agreement Overview',
        'terms.summary.text': 'These Terms of Service govern your use of the QScrap platform operated by QScrap Services & Trading L.L.C. By downloading or using our apps and services, you agree to be bound by these terms. Please read them carefully before using our marketplace.',

        'terms.s1.title': 'Acceptance of Terms',
        'terms.s1.p1': 'By downloading, accessing, or using the QScrap Customer App, QScrap Driver App, or any related services ("the Platform"), you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not use our services.',
        'terms.s1.note': '<strong>Important:</strong> Your continued use of the Platform after any changes to these terms constitutes acceptance of the updated terms.',

        'terms.s2.title': 'Description of Service',
        'terms.s2.intro': 'QScrap Services & Trading L.L.C / كيوسكراب للخدمات والتجارة ذ.م.م is a marketplace connecting customers seeking automotive spare parts with local garages and scrap yards in Qatar. We facilitate:',
        'terms.s2.item1': 'Part requests and competitive bidding from multiple garages',
        'terms.s2.item2': 'Secure order processing and payment handling',
        'terms.s2.item3': 'Quality inspection and verification of parts',
        'terms.s2.item4': 'Delivery of spare parts directly to customers',
        'terms.s2.item5': 'Warranty management and dispute resolution',

        'terms.s3.title': 'User Accounts',
        'terms.s3.intro': 'To use our services, you must:',
        'terms.s3.item1': 'Be at least 18 years old or the legal age in your jurisdiction',
        'terms.s3.item2': 'Provide accurate and complete registration information',
        'terms.s3.item3': 'Keep your account credentials secure and confidential',
        'terms.s3.item4': 'Accept responsibility for all activities under your account',
        'terms.s3.item5': 'Notify us immediately of any unauthorized account access',
        'terms.s3.note': 'We reserve the right to suspend or terminate accounts that violate these terms or engage in fraudulent activity.',

        'terms.s4.title': 'Orders and Payments',
        'terms.s4.item1': 'All prices are displayed in Qatari Riyal (QAR)',
        'terms.s4.item2': 'Delivery fees are calculated based on distance to your location',
        'terms.s4.item3': "Orders are binding once you accept a garage's bid",
        'terms.s4.item4': 'Payment options include Cash on Delivery and Card payments',
        'terms.s4.item5': 'Platform fees are transparently displayed before order confirmation',
        'terms.s4.item6': 'Refunds are subject to our Cancellation and Refund Policy',
        'terms.s4.note': '<strong>Note:</strong> QScrap acts as a facilitator between customers and garages. The actual sale contract is between you and the garage providing the part.',

        'terms.s5.title': 'Warranties and Returns',
        'terms.s5.item1': 'Part warranties are provided by individual garages through the QScrap platform',
        'terms.s5.item2': 'All parts carry a standard 7-day warranty from date of delivery',
        'terms.s5.item3': 'The 7-day warranty applies equally to new and used parts of all conditions',
        'terms.s5.item4': 'Disputes must be raised within the 7-day warranty period',
        'terms.s5.item5': 'QScrap will mediate disputes between customers and garages',

        'terms.s6.title': 'Prohibited Activities',
        'terms.s6.intro': 'You may not:',
        'terms.s6.item1': 'Use the Platform for any illegal or unauthorized purposes',
        'terms.s6.item2': 'Provide false, misleading, or fraudulent information',
        'terms.s6.item3': 'Harass, abuse, or threaten other users, garages, or drivers',
        'terms.s6.item4': 'Attempt to circumvent our platform fees or commission structure',
        'terms.s6.item5': 'Engage in price manipulation or bid rigging',
        'terms.s6.item6': 'Create multiple accounts to exploit promotions',
        'terms.s6.item7': 'Reverse engineer or attempt to extract source code from our apps',

        'terms.s7.title': 'Limitation of Liability',
        'terms.s7.intro': 'QScrap acts as a marketplace facilitator. To the maximum extent permitted by Qatar law:',
        'terms.s7.item1': 'We are not responsible for the quality or condition of parts sold by garages',
        'terms.s7.item2': 'We are not liable for delays caused by garages or delivery issues beyond our control',
        'terms.s7.item3': 'We facilitate but do not guarantee resolution of disputes between users and garages',
        'terms.s7.item4': 'Our liability is limited to the amount of fees paid to QScrap for the relevant transaction',
        'terms.s7.rights': "<strong>Consumer Rights:</strong> Nothing in these terms affects your statutory rights under Qatar's Consumer Protection Law (Law No. 8 of 2008).",

        'terms.s8.title': 'Intellectual Property',
        'terms.s8.text': 'All content, trademarks, logos, and intellectual property on the Platform belong to QScrap Services & Trading L.L.C or its licensors. You may not copy, modify, distribute, or create derivative works without our express written permission.',

        'terms.s9.title': 'Governing Law & Disputes',
        'terms.s9.p1': 'These Terms of Service are governed by the laws of the State of Qatar. Any disputes arising from or related to these terms or your use of the Platform shall be resolved in the courts of Qatar.',
        'terms.s9.p2': 'For complaints or concerns, please contact us first. We will attempt to resolve issues through our internal dispute resolution process before any legal action is taken.',

        'terms.contact.title': '📞 Contact Us',
        'terms.contact.inquiries': 'General Inquiries',
        'terms.contact.service': 'Customer Service',
        'terms.contact.hq': 'Headquarters',
        'terms.contact.hqValue': 'Doha, State of Qatar',
        'terms.contact.website': 'Website',

        // ===== PRIVACY POLICY =====
        'privacy.title': 'Privacy Policy',
        'privacy.titleAr': 'سياسة الخصوصية',
        'privacy.lastUpdated': 'Last updated: February 1, 2026 | آخر تحديث: 1 فبراير 2026',

        'privacy.summary.title': '🔒 Your Privacy Matters',
        'privacy.summary.text': 'At QScrap, we take your privacy seriously. This policy explains how we collect, use, and protect your personal information. We comply with Qatar Personal Data Protection Law and international best practices.',

        'privacy.s1.title': 'Information We Collect',
        'privacy.s1.intro': 'We collect the following types of information:',
        'privacy.s1.h1': '📱 Account Information',
        'privacy.s1.h1.items': 'Full name, email address, phone number, and profile photo',
        'privacy.s1.h2': '🚗 Vehicle Information',
        'privacy.s1.h2.items': 'Vehicle make, model, year, VIN number, and registration details',
        'privacy.s1.h3': '📍 Location Data',
        'privacy.s1.h3.items': 'Delivery addresses and real-time location for deliveries',
        'privacy.s1.h4': '💳 Payment Information',
        'privacy.s1.h4.items': 'Payment method details (processed securely by our payment partners)',

        'privacy.s2.title': 'How We Use Your Information',
        'privacy.s2.intro': 'We use your information to:',
        'privacy.s2.item1': 'Process and fulfill your spare parts orders',
        'privacy.s2.item2': 'Connect you with verified garages and drivers',
        'privacy.s2.item3': 'Provide real-time delivery tracking',
        'privacy.s2.item4': 'Process payments and refunds securely',
        'privacy.s2.item5': 'Send order updates and important notifications',
        'privacy.s2.item6': 'Improve our services and user experience',
        'privacy.s2.item7': 'Comply with legal obligations',

        'privacy.s3.title': 'Data Sharing',
        'privacy.s3.intro': 'We share your information only with:',
        'privacy.s3.item1': '<strong>Garages:</strong> To fulfill your part requests (limited to necessary details)',
        'privacy.s3.item2': '<strong>Delivery Drivers:</strong> To deliver your orders (address and contact only)',
        'privacy.s3.item3': '<strong>Payment Processors:</strong> To process your transactions securely',
        'privacy.s3.item4': '<strong>Legal Authorities:</strong> When required by Qatar law',
        'privacy.s3.note': '<strong>We never sell your personal data to third parties.</strong>',

        'privacy.s4.title': 'Data Security',
        'privacy.s4.intro': 'We protect your data with:',
        'privacy.s4.item1': 'SSL/TLS encryption for all data transmission',
        'privacy.s4.item2': 'Encrypted storage for sensitive information',
        'privacy.s4.item3': 'Regular security audits and updates',
        'privacy.s4.item4': 'Strict access controls for our team',
        'privacy.s4.item5': 'Secure data centers in compliance with Qatar regulations',

        'privacy.s5.title': 'Your Rights',
        'privacy.s5.intro': "Under Qatar's Personal Data Protection Law, you have the right to:",
        'privacy.s5.item1': '<strong>Access:</strong> Request a copy of your personal data',
        'privacy.s5.item2': '<strong>Rectification:</strong> Correct inaccurate information',
        'privacy.s5.item3': '<strong>Erasure:</strong> Request deletion of your data (with some exceptions)',
        'privacy.s5.item4': '<strong>Portability:</strong> Receive your data in a portable format',
        'privacy.s5.item5': '<strong>Objection:</strong> Object to certain processing activities',
        'privacy.s5.contact': 'To exercise any of these rights, contact us at <a href="mailto:privacy@qscrap.qa">privacy@qscrap.qa</a>',

        'privacy.s6.title': 'Data Retention',
        'privacy.s6.p1': 'We retain your data for as long as your account is active or as needed to provide services. Transaction records are kept for 7 years as required by Qatar commercial law.',
        'privacy.s6.p2': 'When you delete your account, we will remove your personal data within 30 days, except where retention is required by law.',

        'privacy.s7.title': 'Cookies and Tracking',
        'privacy.s7.p1': 'Our mobile apps use minimal tracking for essential functionality:',
        'privacy.s7.item1': 'Session management',
        'privacy.s7.item2': 'Crash reporting and performance monitoring',
        'privacy.s7.item3': 'Push notification delivery',
        'privacy.s7.p2': 'We do not use third-party advertising trackers.',

        'privacy.s8.title': 'Changes to This Policy',
        'privacy.s8.p1': 'We may update this policy from time to time. We will notify you of significant changes via email or app notification.',
        'privacy.s8.p2': 'Continued use of QScrap after changes constitutes acceptance of the updated policy.',

        'privacy.contact.title': '📞 Contact Us',
        'privacy.contact.privacy': 'Privacy Inquiries',
        'privacy.contact.dpo': 'Data Protection Officer',
        'privacy.contact.general': 'General Support',
        'privacy.contact.address': 'Address',
        'privacy.contact.addressValue': 'Doha, Qatar',

        // Footer
        'footer.copyright': '© 2026 QScrap Services & Trading L.L.C. All rights reserved.',
        'footer.compliance': 'Compliant with Google Play Developer Program Policies and Qatar\'s Personal Data Protection Law.',
        'footer.backHome': 'Back to QScrap Home',
        'footer.privacy': 'Privacy Policy',
        'footer.terms': 'Terms of Service',
        'footer.refund': 'Refund Policy'
    },
    ar: {
        // Navigation
        'nav.backHome': 'العودة للرئيسية',

        // Common UI badges
        'hero.protected': 'بياناتك محمية',
        'hero.regulated': 'منظم بموجب قانون قطر',
        'hero.dispute': 'عادل وشفاف',
        'hero.protection': 'حماية المستهلك',
        'hero.agreement': 'اتفاقية قانونية',

        // ===== REFUND POLICY (Arabic) =====
        'refund.title': 'سياسة الاسترداد',
        'refund.titleAr': '', // Hide subtitle in Arabic mode
        'refund.lastUpdated': 'آخر تحديث: 1 فبراير 2026',

        // Section Numbers (Arabic Numerals)
        'refund.s1.num': '1',
        'refund.s2.num': '2',
        'refund.s3.num': '3',
        'refund.s4.num': '4',
        'refund.s5.num': '5',
        'refund.s6.num': '6',

        // Summary
        'refund.summary.title': '💰 التزامنا تجاهك',
        'refund.summary.text': 'في كيوسكراب، نؤمن بسياسات استرداد عادلة وشفافة. يوضح هذا المستند متى وكيف يمكنك استرداد أموالك. يضمن نظام الضمان لدينا حماية أموالك طوال عملية المعاملة بالكامل.',

        // Section 1
        'refund.s1.title': 'ضمان الإرجاع خلال 7 أيام',
        'refund.s1.intro': 'جميع القطع المشتراة عبر كيوسكراب تأتي مع ضمان إرجاع لمدة 7 أيام من تاريخ التسليم:',
        'refund.s1.item1': 'إذا كانت القطعة لا تناسب سيارتك حسب المواصفات',
        'refund.s1.item2': 'إذا كانت القطعة مختلفة بشكل كبير عن الوصف',
        'refund.s1.item3': 'إذا كانت القطعة معيبة أو تالفة عند الاستلام',
        'refund.s1.item4': 'إذا تم تحديد القطعة بشكل خاطئ من قبل الكراج',
        'refund.s1.highlight': '<strong>استرداد كامل مضمون</strong> خلال 7 أيام إذا كانت القطعة لا تتطابق مع الوصف أو كانت معيبة.',

        // Section 2
        'refund.s2.title': 'مراحل الإلغاء والاسترداد',
        'refund.s2.intro': 'يعتمد مبلغ الاسترداد على وقت إلغاء طلبك:',
        'refund.s2.th1': 'المرحلة',
        'refund.s2.th2': 'الحالة',
        'refund.s2.th3': 'الاسترداد',
        'refund.s2.stage1': 'قبل قبول الكراج',
        'refund.s2.when1': 'تم تقديم الطلب، في انتظار الكراج',
        'refund.s2.refund1': 'استرداد 100%',
        'refund.s2.stage2': 'بعد قبول الكراج',
        'refund.s2.when2': 'الكراج أكد، يحضر القطعة',
        'refund.s2.refund2': 'استرداد 100%',
        'refund.s2.stage3': 'القطعة جاهزة',
        'refund.s2.when3': 'القطعة محضرة، في انتظار الاستلام',
        'refund.s2.refund3': 'استرداد 90%',
        'refund.s2.stage4': 'السائق معين',
        'refund.s2.when4': 'السائق استلم القطعة',
        'refund.s2.refund4': 'استرداد 85%',
        'refund.s2.stage5': 'في الطريق',
        'refund.s2.when5': 'القطعة في الطريق إليك',
        'refund.s2.refund5': 'استرداد 80%',
        'refund.s2.stage6': 'بعد التسليم',
        'refund.s2.when6': 'خلال فترة الإرجاع 7 أيام',
        'refund.s2.refund6': 'استرداد 85-100%*',
        'refund.s2.note': '<strong>*ملاحظة:</strong> قد يختلف الاسترداد بعد التسليم بناءً على حالة القطعة. استرداد كامل للقطع المعيبة/الخاطئة. قد يُخصم رسوم الشحن للإرجاع بسبب تغيير الرأي.',

        // Section 3
        'refund.s3.title': 'العناصر غير القابلة للاسترداد',
        'refund.s3.intro': 'الحالات التالية غير مؤهلة للاسترداد:',
        'refund.s3.item1': 'القطع التي تم تركيبها أو تعديلها',
        'refund.s3.item2': 'القطع التالفة بعد التسليم بسبب سوء التعامل',
        'refund.s3.item3': 'القطع المرجعة بعد فترة الإرجاع 7 أيام',
        'refund.s3.item4': 'القطع المصنعة حسب الطلب أو المستوردة خصيصاً (إلا إذا كانت معيبة)',
        'refund.s3.item5': 'القطع الكهربائية التي تم اختبارها/توصيلها (إلا إذا كانت معيبة عند الوصول)',
        'refund.s3.warning': '<strong>مهم:</strong> افحص قطعك دائماً قبل التركيب. بمجرد التركيب، لا يمكن إرجاع القطع لمشاكل التوافق.',

        // Section 4
        'refund.s4.title': 'كيفية طلب الاسترداد',
        'refund.s4.intro': 'لطلب استرداد:',
        'refund.s4.item1': 'افتح تطبيق كيوسكراب واذهب إلى "طلباتي"',
        'refund.s4.item2': 'اختر الطلب الذي تريد إرجاعه أو إلغاءه',
        'refund.s4.item3': 'اضغط على "طلب استرداد" واختر السبب',
        'refund.s4.item4': 'ارفع صوراً إذا كنت تبلغ عن قطعة معيبة أو خاطئة',
        'refund.s4.item5': 'سيراجع فريق الدعم خلال 24 ساعة',
        'refund.s4.contact': 'للمسائل العاجلة، تواصل معنا مباشرة على <a href="mailto:support@qscrap.qa">support@qscrap.qa</a> أو واتساب <a href="https://wa.me/97450267974" dir="ltr">+974 5026 7974</a>.',

        // Section 5
        'refund.s5.title': 'وقت معالجة الاسترداد',
        'refund.s5.item1': '<strong>الدفع بالبطاقة:</strong> 5-7 أيام عمل بعد الموافقة',
        'refund.s5.item2': '<strong>الدفع عند الاستلام:</strong> تحويل بنكي خلال 3-5 أيام عمل',
        'refund.s5.item3': '<strong>محفظة كيوسكراب:</strong> رصيد فوري بعد الموافقة',
        'refund.s5.tip': '<strong>نصيحة:</strong> الاسترداد إلى محفظة كيوسكراب يتم فوراً ويمكن استخدامه للمشتريات المستقبلية أو سحبه لحسابك البنكي.',

        // Section 6
        'refund.s6.title': 'حل النزاعات',
        'refund.s6.intro': 'إذا كنت لا توافق على قرار الاسترداد:',
        'refund.s6.item1': 'اطلب التصعيد عبر التطبيق أو البريد الإلكتروني',
        'refund.s6.item2': 'سيراجع فريق الدعم الأقدم خلال 48 ساعة',
        'refund.s6.item3': 'يمكنك تقديم أدلة إضافية (صور، فيديوهات)',
        'refund.s6.item4': 'القرارات النهائية تتوافق مع قانون حماية المستهلك القطري',
        'refund.s6.rights': '<strong>حقوق المستهلك:</strong> لا شيء في هذه السياسة يؤثر على حقوقك القانونية بموجب قانون حماية المستهلك القطري (القانون رقم 8 لسنة 2008) ولوائح وزارة التجارة والصناعة.',

        // Contact Card
        'refund.contact.title': '📞 تحتاج مساعدة؟',
        'refund.contact.support': 'دعم الاسترداد',
        'refund.contact.whatsapp': 'واتساب',
        'refund.contact.service': 'خدمة العملاء',
        'refund.contact.website': 'الموقع',
        'refund.contact.company': 'كيوسكراب للخدمات والتجارة ذ.م.م',
        'refund.contact.companyAr': 'QScrap Services & Trading L.L.C',
        'refund.contact.cr': '',

        // ===== TERMS OF SERVICE (Arabic) =====
        'terms.title': 'شروط الخدمة',
        'terms.titleAr': '', // Hide subtitle in Arabic mode
        'terms.lastUpdated': 'آخر تحديث: 1 فبراير 2026',

        // Section Numbers (Arabic Numerals)
        'terms.s1.num': '1',
        'terms.s2.num': '2',
        'terms.s3.num': '3',
        'terms.s4.num': '4',
        'terms.s5.num': '5',
        'terms.s6.num': '6',
        'terms.s7.num': '7',
        'terms.s8.num': '8',
        'terms.s9.num': '9',

        'terms.summary.title': '📋 نظرة عامة على الاتفاقية',
        'terms.summary.text': 'تحكم شروط الخدمة هذه استخدامك لمنصة كيوسكراب التي تديرها شركة كيوسكراب للخدمات والتجارة ذ.م.م. بتحميل أو استخدام تطبيقاتنا وخدماتنا، فإنك توافق على الالتزام بهذه الشروط. يرجى قراءتها بعناية قبل استخدام سوقنا.',

        'terms.s1.title': 'قبول الشروط',
        'terms.s1.p1': 'بتحميل أو الوصول إلى أو استخدام تطبيق كيوسكراب للعملاء أو تطبيق كيوسكراب للسائقين أو أي خدمات ذات صلة ("المنصة")، فإنك توافق على الالتزام بشروط الخدمة هذه. إذا كنت لا توافق على أي جزء من هذه الشروط، فلا يجوز لك استخدام خدماتنا.',
        'terms.s1.note': '<strong>مهم:</strong> استمرارك في استخدام المنصة بعد أي تغييرات على هذه الشروط يشكل قبولاً للشروط المحدثة.',

        'terms.s2.title': 'وصف الخدمة',
        'terms.s2.intro': 'كيوسكراب للخدمات والتجارة ذ.م.م هي سوق تربط العملاء الباحثين عن قطع غيار السيارات بالكراجات ومحلات الخردة المحلية في قطر. نسهل:',
        'terms.s2.item1': 'طلبات القطع والمزايدة التنافسية من كراجات متعددة',
        'terms.s2.item2': 'معالجة الطلبات الآمنة والتعامل مع المدفوعات',
        'terms.s2.item3': 'فحص الجودة والتحقق من القطع',
        'terms.s2.item4': 'توصيل قطع الغيار مباشرة للعملاء',
        'terms.s2.item5': 'إدارة الضمان وحل النزاعات',

        'terms.s3.title': 'حسابات المستخدمين',
        'terms.s3.intro': 'لاستخدام خدماتنا، يجب عليك:',
        'terms.s3.item1': 'أن يكون عمرك 18 عاماً على الأقل أو العمر القانوني في ولايتك القضائية',
        'terms.s3.item2': 'تقديم معلومات تسجيل دقيقة وكاملة',
        'terms.s3.item3': 'الحفاظ على بيانات اعتماد حسابك آمنة وسرية',
        'terms.s3.item4': 'تحمل المسؤولية عن جميع الأنشطة تحت حسابك',
        'terms.s3.item5': 'إخطارنا فوراً بأي وصول غير مصرح به للحساب',
        'terms.s3.note': 'نحتفظ بالحق في تعليق أو إنهاء الحسابات التي تنتهك هذه الشروط أو تشارك في نشاط احتيالي.',

        'terms.s4.title': 'الطلبات والمدفوعات',
        'terms.s4.item1': 'جميع الأسعار معروضة بالريال القطري',
        'terms.s4.item2': 'تُحسب رسوم التوصيل بناءً على المسافة إلى موقعك',
        'terms.s4.item3': 'الطلبات ملزمة بمجرد قبولك لعرض الكراج',
        'terms.s4.item4': 'خيارات الدفع تشمل الدفع عند الاستلام والبطاقة',
        'terms.s4.item5': 'رسوم المنصة معروضة بشفافية قبل تأكيد الطلب',
        'terms.s4.item6': 'الاستردادات تخضع لسياسة الإلغاء والاسترداد',
        'terms.s4.note': '<strong>ملاحظة:</strong> كيوسكراب تعمل كوسيط بين العملاء والكراجات. عقد البيع الفعلي بينك وبين الكراج الذي يوفر القطعة.',

        'terms.s5.title': 'الضمانات والإرجاع',
        'terms.s5.item1': 'ضمانات القطع مقدمة من الكراجات الفردية عبر منصة كيوسكراب',
        'terms.s5.item2': 'جميع القطع تحمل ضمان موحد لمدة 7 أيام من تاريخ التسليم',
        'terms.s5.item3': 'ضمان 7 أيام ينطبق بالتساوي على القطع الجديدة والمستعملة بجميع حالاتها',
        'terms.s5.item4': 'يجب رفع النزاعات خلال فترة الضمان البالغة 7 أيام',
        'terms.s5.item5': 'كيوسكراب ستتوسط في النزاعات بين العملاء والكراجات',

        'terms.s6.title': 'الأنشطة المحظورة',
        'terms.s6.intro': 'لا يجوز لك:',
        'terms.s6.item1': 'استخدام المنصة لأي أغراض غير قانونية أو غير مصرح بها',
        'terms.s6.item2': 'تقديم معلومات كاذبة أو مضللة أو احتيالية',
        'terms.s6.item3': 'مضايقة أو إساءة أو تهديد المستخدمين الآخرين أو الكراجات أو السائقين',
        'terms.s6.item4': 'محاولة التحايل على رسوم المنصة أو هيكل العمولة',
        'terms.s6.item5': 'المشاركة في التلاعب بالأسعار أو التواطؤ في المزايدات',
        'terms.s6.item6': 'إنشاء حسابات متعددة لاستغلال العروض الترويجية',
        'terms.s6.item7': 'الهندسة العكسية أو محاولة استخراج الكود المصدري من تطبيقاتنا',

        'terms.s7.title': 'حدود المسؤولية',
        'terms.s7.intro': 'كيوسكراب تعمل كميسر للسوق. إلى أقصى حد يسمح به قانون قطر:',
        'terms.s7.item1': 'نحن غير مسؤولين عن جودة أو حالة القطع المباعة من الكراجات',
        'terms.s7.item2': 'نحن غير مسؤولين عن التأخيرات الناتجة عن الكراجات أو مشاكل التوصيل الخارجة عن سيطرتنا',
        'terms.s7.item3': 'نسهل ولكن لا نضمن حل النزاعات بين المستخدمين والكراجات',
        'terms.s7.item4': 'مسؤوليتنا محدودة بمبلغ الرسوم المدفوعة لكيوسكراب للمعاملة ذات الصلة',
        'terms.s7.rights': '<strong>حقوق المستهلك:</strong> لا شيء في هذه الشروط يؤثر على حقوقك القانونية بموجب قانون حماية المستهلك القطري (القانون رقم 8 لسنة 2008).',

        'terms.s8.title': 'الملكية الفكرية',
        'terms.s8.text': 'جميع المحتوى والعلامات التجارية والشعارات والملكية الفكرية على المنصة ملك لشركة كيوسكراب للخدمات والتجارة ذ.م.م أو مرخصيها. لا يجوز لك نسخ أو تعديل أو توزيع أو إنشاء أعمال مشتقة دون إذن كتابي صريح منا.',

        'terms.s9.title': 'القانون الحاكم والنزاعات',
        'terms.s9.p1': 'تخضع شروط الخدمة هذه لقوانين دولة قطر. أي نزاعات ناشئة عن أو متعلقة بهذه الشروط أو استخدامك للمنصة ستُحل في محاكم قطر.',
        'terms.s9.p2': 'للشكاوى أو المخاوف، يرجى الاتصال بنا أولاً. سنحاول حل المسائل من خلال عملية حل النزاعات الداخلية قبل اتخاذ أي إجراء قانوني.',

        'terms.contact.title': '📞 تواصل معنا',
        'terms.contact.inquiries': 'الاستفسارات العامة',
        'terms.contact.service': 'خدمة العملاء',
        'terms.contact.hq': 'المقر الرئيسي',
        'terms.contact.hqValue': 'الدوحة، دولة قطر',
        'terms.contact.website': 'الموقع',

        // ===== PRIVACY POLICY (Arabic) - COMPREHENSIVE =====
        'privacy.title': 'سياسة الخصوصية',
        'privacy.titleAr': '', // Hide subtitle in Arabic mode
        'privacy.lastUpdated': 'آخر تحديث: 1 فبراير 2026',

        'privacy.summary.title': '🔒 خصوصيتك مهمة',
        'privacy.summary.text': 'في كيوسكراب، نأخذ خصوصيتك على محمل الجد. توضح هذه السياسة كيف نجمع ونستخدم ونحمي معلوماتك الشخصية. نلتزم بقانون حماية البيانات الشخصية القطري وأفضل الممارسات الدولية.',

        // Section Numbers (Arabic Numerals)
        'privacy.s1.num': '1',
        'privacy.s2.num': '2',
        'privacy.s3.num': '3',
        'privacy.s4.num': '4',
        'privacy.s5.num': '5',
        'privacy.s6.num': '6',
        'privacy.s7.num': '7',
        'privacy.s8.num': '8',
        'privacy.s9.num': '9',
        'privacy.s10.num': '10',
        'privacy.s11.num': '11',
        'privacy.s12.num': '12',
        'privacy.s13.num': '13',

        // Section 1: Introduction & Scope
        'privacy.s1.title': 'المقدمة والنطاق',
        'privacy.s1.p1': 'كيوسكراب للخدمات والتجارة ذ.م.م هي شركة مسجلة في دولة قطر تشغل تطبيق كيوسكراب للعملاء وتطبيق كيوسكراب للسائقين (مجتمعين، "التطبيقات"). تنطبق سياسة الخصوصية هذه على جميع المستخدمين:',
        'privacy.s1.user1': '<strong>العملاء:</strong> المستخدمون الباحثون عن قطع غيار السيارات',
        'privacy.s1.user2': '<strong>شركاء الكراجات:</strong> الشركات التي توفر قطع الغيار عبر سوقنا',
        'privacy.s1.user3': '<strong>السائقون:</strong> موظفو التوصيل الذين يستخدمون تطبيق كيوسكراب للسائقين',
        'privacy.s1.p2': 'باستخدام تطبيقاتنا أو خدماتنا، فإنك توافق على جمع واستخدام والإفصاح عن معلوماتك كما هو موضح في سياسة الخصوصية هذه. تتوافق هذه السياسة مع القانون القطري رقم 13 لسنة 2016 بشأن حماية البيانات الشخصية وسياسات برنامج مطوري جوجل بلاي.',

        // Section 2: Information We Collect
        'privacy.s2.title': 'المعلومات التي نجمعها',
        'privacy.s2.h1': '2.1 المعلومات الشخصية التي تقدمها',
        'privacy.s2.h1.intro': 'عند التسجيل واستخدام تطبيقاتنا، نجمع:',
        'privacy.s2.h1.item1': '<strong>معلومات الحساب:</strong> الاسم الكامل، رقم الهاتف، البريد الإلكتروني',
        'privacy.s2.h1.item2': '<strong>معلومات الملف الشخصي:</strong> صورة الملف الشخصي (اختيارية)، اللغة المفضلة',
        'privacy.s2.h1.item3': '<strong>معلومات السيارة:</strong> رقم الهيكل (VIN)، الشركة المصنعة، الموديل، السنة لمطابقة القطع',
        'privacy.s2.h1.item4': '<strong>معلومات الدفع:</strong> تفضيلات طريقة الدفع (الدفع عند الاستلام، البطاقة)',
        'privacy.s2.h1.item5': '<strong>معلومات الأعمال (للكراجات):</strong> رقم السجل التجاري، تفاصيل الحساب البنكي (IBAN)، عنوان العمل',
        'privacy.s2.h1.item6': '<strong>معلومات السائق:</strong> الهوية القطرية، رخصة القيادة، تسجيل المركبة، الحساب البنكي للمدفوعات',
        'privacy.s2.h2': '2.2 المعلومات المجمعة تلقائياً',
        'privacy.s2.h2.intro': 'عند استخدام تطبيقاتنا، نجمع تلقائياً:',
        'privacy.s2.h2.item1': '<strong>معلومات الجهاز:</strong> نوع الجهاز، إصدار نظام التشغيل، معرفات الجهاز الفريدة، رموز الإشعارات',
        'privacy.s2.h2.item2': '<strong>بيانات الموقع:</strong> إحداثيات GPS لحساب منطقة التوصيل، التتبع الفوري أثناء التوصيلات',
        'privacy.s2.h2.item3': '<strong>بيانات الاستخدام:</strong> تفاعلات التطبيق، الميزات المستخدمة، أنماط التصفح، استعلامات البحث، مدة الجلسة',
        'privacy.s2.h2.item4': '<strong>بيانات السجل:</strong> عنوان IP، أوقات الوصول، أعطال التطبيق، نشاط النظام',
        'privacy.s2.h2.item5': '<strong>الصور والوسائط:</strong> الصور التي ترفعها لطلبات القطع (صور VIN، صور القطع، إثبات التسليم)',
        'privacy.s2.h3': '2.3 بيانات الموقع',
        'privacy.s2.h3.important': '<strong>مهم:</strong> تتطلب تطبيقاتنا الوصول إلى الموقع لتعمل بشكل صحيح. نستخدم بيانات الموقع من أجل:',
        'privacy.s2.h3.item1': 'حساب رسوم التوصيل الدقيقة بناءً على المسافة',
        'privacy.s2.h3.item2': 'مطابقتك مع الكراجات القريبة',
        'privacy.s2.h3.item3': 'تتبع الطلبات الفوري وتنسيق التوصيل',
        'privacy.s2.h3.item4': 'ملاحة السائق وتحسين المسار',
        'privacy.s2.h3.disable': 'يمكنك تعطيل خدمات الموقع في إعدادات جهازك، لكن هذا سيؤثر بشكل كبير على وظائف خدماتنا بما في ذلك حساب رسوم التوصيل وتتبع الطلبات.',

        // Section 3: How We Use Your Information
        'privacy.s3.title': 'كيف نستخدم معلوماتك',
        'privacy.s3.h1': '3.1 تقديم الخدمة',
        'privacy.s3.h1.item1': 'معالجة وتنفيذ طلبات قطع الغيار',
        'privacy.s3.h1.item2': 'تسهيل المزايدة بين العملاء والكراجات',
        'privacy.s3.h1.item3': 'حساب رسوم التوصيل بناءً على موقعك',
        'privacy.s3.h1.item4': 'توفير تتبع الطلبات والإشعارات الفورية',
        'privacy.s3.h1.item5': 'معالجة المدفوعات والمستحقات',
        'privacy.s3.h1.item6': 'إدارة الضمانات والإرجاع والاستردادات',
        'privacy.s3.h2': '3.2 التواصل',
        'privacy.s3.h2.item1': 'إرسال تأكيدات الطلبات والتحديثات وإشعارات التوصيل',
        'privacy.s3.h2.item2': 'دعم العملاء وحل النزاعات',
        'privacy.s3.h2.item3': 'الإعلانات المهمة للخدمة وتحديثات السياسات',
        'privacy.s3.h2.item4': 'الاتصالات التسويقية (بموافقتك)',
        'privacy.s3.h3': '3.3 التحسين والأمان',
        'privacy.s3.h3.item1': 'تحليل أنماط الاستخدام لتحسين خدماتنا',
        'privacy.s3.h3.item2': 'كشف الاحتيال والوقاية منه',
        'privacy.s3.h3.item3': 'ضمان سلامة وأمان المنصة',
        'privacy.s3.h3.item4': 'الامتثال للالتزامات القانونية',

        // Section 4: Data Sharing & Disclosure
        'privacy.s4.title': 'مشاركة البيانات والإفصاح',
        'privacy.s4.intro': 'قد نشارك معلوماتك مع:',
        'privacy.s4.h1': '4.1 شركاء الخدمة',
        'privacy.s4.h1.item1': '<strong>الكراجات:</strong> اسمك ورقم هاتفك وعنوان التوصيل لتنفيذ الطلب',
        'privacy.s4.h1.item2': '<strong>السائقون:</strong> اسمك ورقم هاتفك وموقع التوصيل لتوصيل الطلب',
        'privacy.s4.h1.item3': '<strong>معالجو الدفع:</strong> تفاصيل المعاملة لمعالجة الدفع',
        'privacy.s4.h2': '4.2 مزودو خدمات الطرف الثالث',
        'privacy.s4.h2.item1': '<strong>البنية التحتية السحابية:</strong> AWS/Google Cloud للتخزين الآمن للبيانات',
        'privacy.s4.h2.item2': '<strong>التحليلات:</strong> Google Analytics لتحليل الاستخدام',
        'privacy.s4.h2.item3': '<strong>الخرائط والموقع:</strong> خرائط جوجل لخدمات الموقع',
        'privacy.s4.h2.item4': '<strong>الإشعارات الفورية:</strong> Firebase Cloud Messaging للإشعارات',
        'privacy.s4.h3': '4.3 المتطلبات القانونية',
        'privacy.s4.h3.text': 'قد نفصح عن معلوماتك عند الاقتضاء بموجب قانون قطر، أوامر المحكمة، أو اللوائح الحكومية، بما في ذلك الامتثال للقانون القطري رقم 13 لسنة 2016 بشأن حماية البيانات الشخصية.',
        'privacy.s4.noSell': '<strong>🔒 نحن لا نبيع معلوماتك الشخصية لأطراف ثالثة لأغراض الإعلان أو التسويق.</strong>',

        // Section 5: Data Security
        'privacy.s5.title': 'أمان البيانات',
        'privacy.s5.intro': 'نطبق إجراءات أمان معيارية في الصناعة لحماية بياناتك:',
        'privacy.s5.item1': '<strong>التشفير:</strong> جميع عمليات نقل البيانات تستخدم تشفير SSL/TLS (HTTPS)',
        'privacy.s5.item2': '<strong>التخزين الآمن:</strong> البيانات مخزنة في قواعد بيانات مشفرة مع ضوابط الوصول',
        'privacy.s5.item3': '<strong>المصادقة:</strong> التحقق بـ OTP للوصول إلى الحساب',
        'privacy.s5.item4': '<strong>التحكم في الوصول:</strong> قيود الوصول المبنية على الأدوار للموظفين',
        'privacy.s5.item5': '<strong>التدقيق المنتظم:</strong> تقييمات الأمان واختبار الثغرات',
        'privacy.s5.item6': '<strong>الاستجابة للحوادث:</strong> إجراءات الإخطار بخرق البيانات خلال 72 ساعة',
        'privacy.s5.disclaimer': 'بينما نسعى لحماية بياناتك، لا توجد طريقة نقل عبر الإنترنت آمنة 100%. لا يمكننا ضمان الأمان المطلق.',

        // Section 6: Data Retention
        'privacy.s6.title': 'الاحتفاظ بالبيانات',
        'privacy.s6.intro': 'نحتفظ بمعلوماتك الشخصية طالما كان ذلك ضرورياً من أجل:',
        'privacy.s6.item1': 'تقديم خدماتنا وتنفيذ الطلبات',
        'privacy.s6.item2': 'الامتثال للمتطلبات القانونية القطرية (الاحتفاظ 10 سنوات للسجلات التجارية وفقاً للقانون التجاري القطري)',
        'privacy.s6.item3': 'حل النزاعات وتنفيذ الاتفاقيات',
        'privacy.s6.item4': 'الحفاظ على مسارات التدقيق للامتثال التنظيمي',
        'privacy.s6.deletion': 'عندما لا تعود البيانات ضرورية، نحذفها بأمان أو نجعلها مجهولة الهوية.',

        // Section 7: Your Rights
        'privacy.s7.title': 'حقوقك',
        'privacy.s7.intro': 'بموجب قوانين حماية البيانات القطرية وسياساتنا، لديك الحق في:',
        'privacy.s7.item1': '<strong>الوصول:</strong> طلب نسخة من بياناتك الشخصية التي نحتفظ بها',
        'privacy.s7.item2': '<strong>التصحيح:</strong> تحديث أو تصحيح المعلومات غير الدقيقة',
        'privacy.s7.item3': '<strong>الحذف:</strong> طلب حذف حسابك وبياناتك الشخصية (مع مراعاة متطلبات الاحتفاظ القانونية)',
        'privacy.s7.item4': '<strong>قابلية النقل:</strong> طلب تصدير بياناتك بتنسيق شائع',
        'privacy.s7.item5': '<strong>إلغاء الاشتراك:</strong> إلغاء الاشتراك في الاتصالات التسويقية',
        'privacy.s7.item6': '<strong>سحب الموافقة:</strong> إلغاء الأذونات للمعالجة الاختيارية للبيانات',
        'privacy.s7.contact': 'لممارسة هذه الحقوق، تواصل معنا على <a href="mailto:privacy@qscrap.qa">privacy@qscrap.qa</a>. سنرد خلال 30 يوماً.',

        // Section 8: Account Deletion
        'privacy.s8.title': 'حذف الحساب',
        'privacy.s8.intro': 'يمكنك طلب حذف الحساب من خلال التطبيق أو بالتواصل معنا. عند الحذف:',
        'privacy.s8.item1': 'سيتم إزالة ملفك الشخصي وبياناتك الشخصية أو جعلها مجهولة الهوية',
        'privacy.s8.item2': 'قد يتم الاحتفاظ بسجل الطلبات بشكل مجهول الهوية للأغراض القانونية/التدقيقية',
        'privacy.s8.item3': 'بعض البيانات المطلوبة قانوناً (الفواتير، سجلات المعاملات) سيتم الاحتفاظ بها وفقاً للقانون التجاري القطري',

        // Section 9: Children's Privacy
        'privacy.s9.title': 'خصوصية الأطفال',
        'privacy.s9.text': 'تطبيقاتنا غير مخصصة للمستخدمين دون 18 عاماً. نحن لا نجمع عن قصد معلومات شخصية من الأطفال دون 18 عاماً. إذا كنت تعتقد أن طفلاً قد زودنا بمعلومات شخصية، يرجى الاتصال بنا فوراً، وسنحذف هذه المعلومات.',

        // Section 10: Third-Party Links
        'privacy.s10.title': 'روابط الطرف الثالث',
        'privacy.s10.text': 'قد تحتوي تطبيقاتنا على روابط لمواقع أو خدمات طرف ثالث. نحن غير مسؤولين عن ممارسات الخصوصية لهؤلاء الأطراف الثالثة. نشجعك على قراءة سياسات الخصوصية الخاصة بهم قبل تقديم أي معلومات شخصية.',

        // Section 11: International Data Transfers
        'privacy.s11.title': 'نقل البيانات الدولي',
        'privacy.s11.text': 'قد يتم نقل معلوماتك ومعالجتها على خوادم خارج قطر (مثل البنية التحتية السحابية في الإمارات أو أوروبا أو الولايات المتحدة). نضمن وجود ضمانات مناسبة لحماية بياناتك وفقاً للقانون القطري رقم 13 لسنة 2016.',

        // Section 12: Changes to This Policy
        'privacy.s12.title': 'التغييرات على هذه السياسة',
        'privacy.s12.intro': 'قد نحدث سياسة الخصوصية هذه بشكل دوري. سنخطرك بالتغييرات المهمة من خلال:',
        'privacy.s12.item1': 'إشعارات داخل التطبيق',
        'privacy.s12.item2': 'البريد الإلكتروني على عنوانك المسجل',
        'privacy.s12.item3': 'إشعار بارز على موقعنا',
        'privacy.s12.acceptance': 'استمرار استخدام تطبيقاتنا بعد التغييرات يشكل قبولاً للسياسة المحدثة.',

        // Section 13: Governing Law
        'privacy.s13.title': 'القانون الحاكم',
        'privacy.s13.text': 'تخضع سياسة الخصوصية هذه لقوانين دولة قطر، بما في ذلك القانون رقم 13 لسنة 2016 بشأن حماية البيانات الشخصية. أي نزاعات ستخضع للاختصاص القضائي الحصري لمحاكم قطر.',

        // Contact Card
        'privacy.contact.title': '📞 تواصل معنا',
        'privacy.contact.privacy': 'استفسارات الخصوصية',
        'privacy.contact.dpo': 'مسؤول حماية البيانات',
        'privacy.contact.general': 'الدعم العام',
        'privacy.contact.phone': 'الهاتف',
        'privacy.contact.address': 'العنوان',
        'privacy.contact.addressValue': 'الدوحة، قطر',

        // Footer
        'footer.copyright': 'كيوسكراب للخدمات والتجارة ذ.م.م © 2026. جميع الحقوق محفوظة.',
        'footer.compliance': 'متوافق مع سياسات برنامج مطوري Google Play وقانون حماية البيانات الشخصية في قطر.',
        'footer.backHome': 'العودة إلى الصفحة الرئيسية',
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
            const translation = legalTranslations[lang][key];
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
    },

    t(key) {
        return legalTranslations[this.currentLang][key] || key;
    }
};

// Initialize i18n on DOM ready
document.addEventListener('DOMContentLoaded', () => legalI18n.init());
