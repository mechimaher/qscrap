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

        'refund.s1.num': '1',
        'refund.s2.num': '2',
        'refund.s3.num': '3',
        'refund.s4.num': '4',
        'refund.s5.num': '5',
        'refund.s6.num': '6',

        'refund.contact.company': 'QScrap Services & Trading L.L.C',
        'refund.contact.companyAr': 'كيوسكراب للخدمات والتجارة ذ.م.م',
        'refund.contact.cr': 'CR No: [CR Number]',

        // ===== TERMS OF SERVICE =====
        'terms.title': 'Terms of Service',
        'terms.titleAr': 'شروط الخدمة',
        'terms.lastUpdated': 'Last updated: February 2026',

        // Summary
        'terms.summary.title': '📋 Agreement Overview',
        'terms.summary.text': 'These Terms of Service govern your use of the QScrap platform operated by QScrap Services & Trading L.L.C. By accessing or using the Platform, you agree to be legally bound by these terms. Please read them carefully before using our marketplace.',

        // Section Numbers
        'terms.s1.num': '1',
        'terms.s2.num': '2',
        'terms.s3.num': '3',
        'terms.s4.num': '4',
        'terms.s5.num': '5',
        'terms.s6.num': '6',
        'terms.s7.num': '7',
        'terms.s8.num': '8',
        'terms.s9.num': '9',
        'terms.s10.num': '10',
        'terms.s11.num': '11',
        'terms.s12.num': '12',
        'terms.s13.num': '13',

        'terms.s1.title': 'Acceptance of Terms',
        'terms.s1.text': 'By accessing or using the QScrap mobile applications, website, or related services (collectively, the "Platform"), you agree to be legally bound by these Terms of Service. If you do not agree, you must not use the Platform.',

        'terms.s2.title': 'Eligibility',
        'terms.s2.text': 'You must have full legal capacity under the laws of your country of residence and be at least 18 years old to use the Platform.',

        'terms.s3.title': 'Nature of the Platform',
        'terms.s3.l1.i1': 'The Platform is a digital marketplace that connects users with independent garages and spare-parts suppliers.',
        'terms.s3.l1.i2': 'QScrap is not a seller, repair provider, or logistics company unless expressly stated.',

        'terms.s4.title': 'Orders and Contract Formation',
        'terms.s4.l1.i1': "Orders become legally binding contracts only when: A user accepts a garage's bid; and The user confirms the order through the Platform interface.",
        'terms.s4.l1.i2': 'The resulting contract is formed directly between the user and the garage, not with QScrap.',

        'terms.s5.title': 'Payments',
        'terms.s5.l1.i1': 'The Platform is not a bank or financial institution.',
        'terms.s5.l1.i2': 'Payments are processed through licensed third-party payment providers authorized to operate in Qatar.',
        'terms.s5.l1.i3': 'QScrap does not hold customer funds except where legally permitted.',
        'terms.s5.l1.i4': 'All prices are stated inclusive or exclusive of applicable taxes as indicated at checkout.',

        'terms.s6.title': 'Warranties and Spare Parts',
        'terms.s6.l1.i1': 'Any warranty on spare parts or services is provided solely by the supplying garage.',
        'terms.s6.l1.i2': 'Unless otherwise stated, the standard warranty period is seven (7) days from delivery.',

        'terms.s7.title': 'Prohibited Activities',
        'terms.s7.intro': 'Users must not:',
        'terms.s7.l1.i1': 'Manipulate pricing or bids',
        'terms.s7.l1.i2': 'Submit fraudulent orders',
        'terms.s7.l1.i3': 'Interfere with Platform security',
        'terms.s7.l1.i4': 'Engage in unlawful or unfair commercial practices',

        'terms.s8.title': 'Limitation of Liability',
        'terms.s8.intro': 'To the maximum extent permitted by law, QScrap shall not be liable for indirect or consequential damages arising from Platform use. Nothing in these Terms excludes liability for:',
        'terms.s8.l1.i1': 'Fraud or fraudulent misrepresentation',
        'terms.s8.l1.i2': 'Gross negligence',
        'terms.s8.l1.i3': 'Death or personal injury',
        'terms.s8.l1.i4': 'Mandatory consumer rights under applicable law',

        'terms.s9.title': 'Force Majeure',
        'terms.s9.text': 'QScrap is not liable for failure or delay caused by events beyond reasonable control, including government actions, telecom outages, fuel shortages, cyber incidents, or extreme weather.',

        'terms.s10.title': 'Governing Law and Dispute Resolution',
        'terms.s10.l1.i1': 'These Terms are governed by the laws of the State of Qatar.',
        'terms.s10.l1.i2': 'The courts of Doha, Qatar have exclusive jurisdiction.',
        'terms.s10.l1.i3': 'Before court proceedings, parties agree to attempt amicable settlement through the Consumer Protection Department of the Ministry of Commerce and Industry.',

        'terms.s11.title': 'Commercial Disclosure',
        'terms.s11.l1.i1': 'Legal Entity: QScrap Services & Trading L.L.C',
        'terms.s11.l1.i2': 'Commercial Registration No.: [CR NUMBER]',
        'terms.s11.l1.i3': 'Registered Address: Doha, Qatar',
        'terms.s11.l1.i4': 'Email: legal@qscrap.qa',

        'terms.s12.title': 'Amendments',
        'terms.s12.text': 'QScrap may update these Terms at any time. Continued use of the Platform constitutes acceptance of the updated Terms.',

        'terms.s13.title': 'Contact',
        'terms.s13.text': 'For legal inquiries, contact: <a href="mailto:legal@qscrap.qa" class="legal-link">legal@qscrap.qa</a>',

        // Terms Contact Card
        'terms.contact.title': '📞 Contact Us',
        'terms.contact.legal': 'Legal Inquiries',
        'terms.contact.support': 'Support',
        'terms.contact.phone': 'Phone',
        'terms.contact.hq': 'Headquarters',
        'terms.contact.hqValue': 'Doha, State of Qatar',
        'terms.contact.website': 'Website',

        // ===== PRIVACY POLICY =====
        'privacy.title': 'Privacy Policy',
        'privacy.titleAr': 'سياسة الخصوصية',
        'privacy.lastUpdated': 'Last Updated: February 2026',

        // Summary
        'privacy.summary.title': '🔒 Your Privacy is Our Priority',
        'privacy.summary.text': 'This Privacy Policy explains how QScrap Services & Trading L.L.C ("QScrap", "we", "us", or "our") collects, uses, shares, and protects your personal information when you use our mobile applications and services. We are committed to transparency and compliance with Qatar\'s Law No. 13 of 2016 on Personal Data Protection.',

        // Section Numbers
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
        'privacy.s14.num': '14',

        'privacy.s1.title': 'Introduction and Scope',
        'privacy.s1.p1': 'QScrap Services & Trading L.L.C operates the QScrap Customer App and QScrap Driver App. This Privacy Policy applies to all users:',
        'privacy.s1.user1': '<strong>Customers:</strong> Individual users searching for automotive spare parts',
        'privacy.s1.user2': '<strong>Garage Partners:</strong> Businesses providing spare parts through our Platform',
        'privacy.s1.user3': '<strong>Drivers:</strong> Delivery personnel using the QScrap Driver App',
        'privacy.s1.p2': 'By using our applications or services, you agree to the collection, use, and disclosure of your information as described in this Privacy Policy. This policy complies with Qatar\'s Law No. 13 of 2016 on Personal Data Protection.',

        'privacy.s2.title': 'Information We Collect',
        'privacy.s2.subtitle1': '2.1 Personal Information You Provide',
        'privacy.s2.l1.i1': 'Account Information: Full name, phone number, email address',
        'privacy.s2.l1.i2': 'Profile Information: Profile picture (optional), language preferences',
        'privacy.s2.l1.i3': 'Vehicle Information: VIN, make, model, year for parts matching',
        'privacy.s2.l1.i4': 'Payment Information: Payment method preferences (COD, Card)',
        'privacy.s2.l1.i5': 'Business Information (Garages): CR number, IBAN, business address',
        'privacy.s2.l1.i6': 'Driver Information: QID, Driving License, Vehicle Registration',

        'privacy.s2.subtitle2': '2.2 Information Collected Automatically',
        'privacy.s2.l2.i1': 'Device Information: Device type, OS version, unique identifiers, push tokens',
        'privacy.s2.l2.i2': 'Location Data: GPS coordinates for delivery areas, real-time tracking',
        'privacy.s2.l2.i3': 'Usage Data: App interactions, features used, session duration',
        'privacy.s2.l2.i4': 'Log Data: IP address, access times, app crashes, system activity',
        'privacy.s2.l2.i5': 'Photos and Media: Uploaded photos for parts requests and proof of delivery',

        'privacy.s2.subtitle3': '2.3 Location Data',
        'privacy.s2.p1': 'Our applications require location access to function correctly. We use it for delivery fee calculation, nearest garage matching, real-time tracking, and route optimization. You can disable this in settings, but it will impact functionality.',

        'privacy.s3.title': 'How We Use Your Information',
        'privacy.s3.l1.i1': 'Processing and fulfilling spare parts requests and orders',
        'privacy.s3.l1.i2': 'Facilitating bidding between customers and garages',
        'privacy.s3.l1.i3': 'Calculating delivery fees based on your location',
        'privacy.s3.l1.i4': 'Providing real-time order tracking and notifications',
        'privacy.s3.l1.i5': 'Processing payments and disbursements',
        'privacy.s3.l1.i6': 'Managing warranties, returns, and refunds',

        'privacy.s4.title': 'Data Sharing and Disclosure',
        'privacy.s4.intro': 'We may share your information with:',
        'privacy.s4.l1.i1': 'Garages: Your name, phone, and delivery address to fulfill orders',
        'privacy.s4.l1.i2': 'Drivers: Your name, phone, and delivery location for order drops',
        'privacy.s4.l1.i3': 'Payment Processors: Transaction details for payment processing',
        'privacy.s4.l1.i4': 'Third-party Service Providers (Cloud, Analytics, Maps) for operation',
        'privacy.s4.l1.i5': 'Competent Authorities when required by law',
        'privacy.s4.alert': 'We do not sell your personal information to third parties for advertising or marketing.',

        'privacy.s5.title': 'Data Security',
        'privacy.s5.l1.i1': 'Encryption: All data transfers use SSL/TLS (HTTPS)',
        'privacy.s5.l1.i2': 'Secure Storage: Encrypted databases with access controls',
        'privacy.s5.l1.i3': 'Authentication: OTP verification for account access',
        'privacy.s5.l1.i4': 'Access Control: Role-based restrictions for employees',
        'privacy.s5.alert': 'While we strive to protect your data, no method of transmission over the internet is 100% secure.',

        'privacy.s6.title': 'International Data Transfers',
        'privacy.s6.p1': 'Your information may be transferred to and processed on servers located outside Qatar. We ensure appropriate safeguards are in place to protect your data in accordance with Qatar Law No. 13 of 2016.',

        'privacy.s7.title': 'Data Retention',
        'privacy.s7.l1.i1': 'We retain your personal information as long as necessary to provide our services and comply with Qatar\'s legal requirements (e.g., 10-year retention for commercial records).',
        'privacy.s7.l1.i2': 'When data no longer serves a legitimate purpose, we securely delete or anonymize it.',

        'privacy.s8.title': 'Your Rights',
        'privacy.s8.intro': 'Under Qatar Data Protection Laws and our policies, you have the right to:',
        'privacy.s8.l1.i1': 'Access: Request a copy of your personal data',
        'privacy.s8.l1.i2': 'Correction: Update or correct inaccurate information',
        'privacy.s8.l1.i3': 'Deletion: Request deletion of your account and data (subject to legal retention)',
        'privacy.s8.l1.i4': 'Data Portability and Withdrawal of Consent',
        'privacy.s8.alert': 'To exercise these rights, contact us at <a href="mailto:privacy@qscrap.qa">privacy@qscrap.qa</a>.',

        'privacy.s9.title': 'Account Deletion',
        'privacy.s9.intro': 'You can request account deletion through the app. Upon deletion, your profile will be removed or anonymized, except where retention is required by law.',

        'privacy.s10.title': 'Children\'s Privacy',
        'privacy.s10.p1': 'Our applications are not intended for individuals under 18 years old. We do not knowingly collect personal information from minors.',

        'privacy.s11.title': 'Third Party Links',
        'privacy.s11.p1': 'We are not responsible for the privacy practices of third-party websites or services linked from our applications.',

        'privacy.s12.title': 'Changes to this Policy',
        'privacy.s12.p1': 'We may update this Privacy Policy. We will notify you of material changes. Continued use of our apps constitutes acceptance of the updated policy.',

        'privacy.s13.title': 'Governing Law',
        'privacy.s13.p1': 'This Policy is governed by the laws of the State of Qatar, and Doha courts have exclusive jurisdiction over any disputes.',

        'privacy.s14.title': 'Contact Information',
        'privacy.s14.l1.i1': 'QScrap Services & Trading L.L.C',
        'privacy.s14.l1.i2': 'Commercial Registration No.: [CR NUMBER]',
        'privacy.s14.l1.i3': 'Email: <a href="mailto:privacy@qscrap.qa">privacy@qscrap.qa</a>',

        // Privacy Contact Card
        'privacy.contact.title': '📞 Contact Us',
        'privacy.contact.dpo': 'Data Protection Officer',
        'privacy.contact.general': 'General Support',
        'privacy.contact.phone': 'Phone',
        'privacy.contact.address': 'Location',
        'privacy.contact.addressValue': 'Doha, Qatar',

        // Footer (Matching footer component)
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
        'footer.email': 'support@qscrap.qa',
        'footer.phone': '+974 5026 7974',
        'footer.whatsapp': 'WhatsApp Support',
        'footer.legalInfo.en': 'QScrap Services & Trading L.L.C | Doha, Qatar',
        'footer.legalInfo.ar': 'كيوسكراب للخدمات والتجارة ذ.م.م | الدوحة، قطر',
        'footer.copyright': '© 2026 QScrap. All rights reserved.'
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
        'refund.contact.cr': 'سجل تجاري رقم: [CR Number]',

        // ===== TERMS OF SERVICE (Arabic) =====
        'terms.title': 'شروط الخدمة',
        'terms.titleAr': '', // Hide subtitle in Arabic mode
        'terms.lastUpdated': 'آخر تحديث: 2026',
        'terms.summary.title': '📋 نظرة عامة على الاتفاقية',
        'terms.summary.text': 'تحكم شروط الخدمة هذه استخدامك لمنصة كيوسكراب التي تديرها شركة كيوسكراب للخدمات والتجارة ذ.م.م. من خلال استخدام المنصة، فإنك توافق على الالتزام بهذه الشروط. يرجى قراءتها بعناية.',

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
        'terms.s10.num': '10',
        'terms.s11.num': '11',
        'terms.s12.num': '12',
        'terms.s13.num': '13',

        'terms.s1.title': 'قبول الشروط',
        'terms.s1.text': 'باستخدامك لتطبيقات أو موقع كيوسكراب أو أي من خدماتها الإلكترونية («المنصة الإلكترونية»)، فإنك توافق على الالتزام القانوني بهذه الشروط. وإذا لم توافق، يجب عليك عدم استخدام المنصة.',

        'terms.s2.title': 'الأهلية القانونية',
        'terms.s2.text': 'يشترط أن تكون متمتعًا بالأهلية القانونية الكاملة وفقًا لقوانين بلد إقامتك، وألا يقل عمرك عن 18 عامًا.',

        'terms.s3.title': 'طبيعة المنصة',
        'terms.s3.l1.i1': 'تُعد المنصة سوقًا رقميًا يربط المستخدمين بالكراجات وموردي قطع الغيار المستقلين.',
        'terms.s3.l1.i2': 'ولا تُعد كيوسكراب بائعًا أو مقدم خدمة إصلاح أو نقل إلا إذا نُصّ على ذلك صراحةً.',

        'terms.s4.title': 'تكوين العقد والطلبات',
        'terms.s4.l1.i1': 'تصبح الطلبات عقودًا ملزمة قانونًا فقط عند: قبول المستخدم لعرض أحد الكراجات؛ وتأكيد الطلب عبر واجهة المنصة.',
        'terms.s4.l1.i2': 'وينشأ العقد مباشرةً بين المستخدم والكراج دون أن تكون كيوسكراب طرفًا فيه.',

        'terms.s5.title': 'المدفوعات',
        'terms.s5.l1.i1': 'المنصة ليست بنكًا أو مؤسسة مالية.',
        'terms.s5.l1.i2': 'تتم معالجة المدفوعات عبر مزودي خدمات دفع مرخصين في دولة قطر.',
        'terms.s5.l1.i3': 'لا تحتفظ كيوسكراب بأموال العملاء إلا في الحدود المسموح بها قانونًا.',
        'terms.s5.l1.i4': 'تُعرض الأسعار شاملة أو غير شاملة للضرائب حسب ما هو موضح عند الدفع.',

        'terms.s6.title': 'الضمان وقطع الغيار',
        'terms.s6.l1.i1': 'يكون أي ضمان على قطع الغيار أو الخدمات مقدمًا حصريًا من الكراج المورد.',
        'terms.s6.l1.i2': 'وما لم يُذكر خلاف ذلك، تكون مدة الضمان القياسية سبعة (7) أيام من تاريخ التسليم.',

        'terms.s7.title': 'الأنشطة المحظورة',
        'terms.s7.intro': 'يُحظر على المستخدم:',
        'terms.s7.l1.i1': 'التلاعب بالأسعار أو العطاءات',
        'terms.s7.l1.i2': 'تقديم طلبات احتيالية',
        'terms.s7.l1.i3': 'تعطيل أمن المنصة',
        'terms.s7.l1.i4': 'ممارسة أي نشاط تجاري غير مشروع أو غير عادل',

        'terms.s8.title': 'تحديد المسؤولية',
        'terms.s8.intro': 'إلى أقصى حد يسمح به القانون، لا تتحمل كيوسكراب المسؤولية عن الأضرار غير المباشرة أو التبعية الناتجة عن استخدام المنصة. ولا يسري أي استبعاد للمسؤولية على:',
        'terms.s8.l1.i1': 'الغش أو التدليس',
        'terms.s8.l1.i2': 'الإهمال الجسيم',
        'terms.s8.l1.i3': 'الوفاة أو الإصابة الجسدية',
        'terms.s8.l1.i4': 'حقوق المستهلك المقررة قانونًا',

        'terms.s9.title': 'القوة القاهرة',
        'terms.s9.text': 'لا تتحمل كيوسكراب المسؤولية عن أي تأخير أو إخفاق ناتج عن ظروف خارجة عن السيطرة، بما في ذلك القرارات الحكومية أو انقطاع الاتصالات أو نقص الوقود أو الهجمات السيبرانية أو الأحوال الجوية الشديدة.',

        'terms.s10.title': 'القانون الواجب التطبيق وتسوية النزاعات',
        'terms.s10.l1.i1': 'تخضع هذه الشروط لقوانين دولة قطر.',
        'terms.s10.l1.i2': 'تختص محاكم الدوحة، قطر، بالنظر في أي نزاع بشكل حصري.',
        'terms.s10.l1.i3': 'قبل البدء في أي إجراءات قضائية، يوافق الأطراف على محاولة التسوية الودية من خلال إدارة حماية المستهلك بوزارة التجارة والصناعة.',

        'terms.s11.title': 'الإفصاح التجاري',
        'terms.s11.l1.i1': 'الاسم القانوني: كيوسكراب للخدمات والتجارة ذ.م.م',
        'terms.s11.l1.i2': 'رقم السجل التجاري: [CR NUMBER]',
        'terms.s11.l1.i3': 'العنوان المسجل في قطر: الدوحة، قطر',
        'terms.s11.l1.i4': 'البريد الإلكتروني: legal@qscrap.qa',

        'terms.s12.title': 'التعديلات',
        'terms.s12.text': 'يجوز لكيوسكراب تعديل هذه الشروط في أي وقت، ويُعد استمرارك في استخدام المنصة موافقة على التعديلات.',

        'terms.s13.title': 'التواصل',
        'terms.s13.text': 'للاستفسارات القانونية: <a href="mailto:legal@qscrap.qa" class="legal-link">legal@qscrap.qa</a>',

        // Terms Contact Card (Arabic)
        'terms.contact.title': '📞 تواصل معنا',
        'terms.contact.legal': 'الاستفسارات القانونية',
        'terms.contact.support': 'الدعم',
        'terms.contact.phone': 'الهاتف',
        'terms.contact.hq': 'المقر الرئيسي',
        'terms.contact.hqValue': 'الدوحة، دولة قطر',
        'terms.contact.website': 'الموقع الإلكتروني',

        // ===== PRIVACY POLICY (Arabic) =====
        'privacy.title': 'سياسة الخصوصية',
        'privacy.titleAr': '', // Hide subtitle in Arabic mode
        'privacy.lastUpdated': 'آخر تحديث: 2026',

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
        'privacy.s14.num': '14',

        // Summary (Arabic)
        'privacy.summary.title': '🔒 خصوصيتك هي أولويتنا',
        'privacy.summary.text': 'توضح سياسة الخصوصية هذه كيف تجمع شركة كيوسكراب للخدمات والتجارة ذ.م.م ("كيوسكراب" أو "نحن") وتستخدم وتشارك وتحمي معلوماتك الشخصية عند استخدام تطبيقاتنا وخدماتنا. نحن ملتزمون بالشفافية والامتثال للقانون القطري رقم 13 لسنة 2016 بشأن حماية البيانات الشخصية.',

        'privacy.s1.title': 'المقدمة والنطاق',
        'privacy.s1.p1': 'تدير شركة كيوسكراب للخدمات والتجارة ذ.م.م تطبيق كيوسكراب للعملاء وتطبيق كيوسكراب للسائقين. تنطبق سياسة الخصوصية هذه على جميع المستخدمين:',
        'privacy.s1.user1': '<strong>العملاء:</strong> المستخدمون الباحثون عن قطع غيار السيارات',
        'privacy.s1.user2': '<strong>شركاء الكراجات:</strong> الشركات التي توفر قطع الغيار عبر منصتنا',
        'privacy.s1.user3': '<strong>السائقون:</strong> موظفو التوصيل الذين يستخدمون تطبيق كيوسكراب للسائقين',
        'privacy.s1.p2': 'باستخدامك لتطبيقاتنا أو خدماتنا، فإنك توافق على جمع واستخدام والإفصاح عن معلوماتك كما هو موضح في سياسة الخصوصية هذه. تتوافق هذه السياسة مع القانون القطري رقم 13 لسنة 2016 بشأن حماية البيانات الشخصية.',

        'privacy.s2.title': 'المعلومات التي نجمعها',
        'privacy.s2.subtitle1': '2.1 المعلومات الشخصية التي تقدمها',
        'privacy.s2.l1.i1': 'معلومات الحساب: الاسم الكامل، رقم الهاتف، البريد الإلكتروني',
        'privacy.s2.l1.i2': 'معلومات الملف الشخصي: صورة الملف الشخصي (اختيارية)، اللغة المفضلة',
        'privacy.s2.l1.i3': 'معلومات المركبة: رقم الهيكل، الشركة المصنعة، الطراز، سنة الصنع لمطابقة القطع',
        'privacy.s2.l1.i4': 'معلومات الدفع: تفضيلات طريقة الدفع (الدفع عند الاستلام، البطاقة)',
        'privacy.s2.l1.i5': 'معلومات الأعمال (للكراجات): رقم السجل التجاري، رقم الحساب البنكي الدولي (IBAN)، عنوان العمل',
        'privacy.s2.l1.i6': 'معلومات السائق: الهوية القطرية، رخصة القيادة، تسجيل المركبة',

        'privacy.s2.subtitle2': '2.2 المعلومات المجمّعة تلقائياً',
        'privacy.s2.l2.i1': 'معلومات الجهاز: نوع الجهاز، إصدار نظام التشغيل، المعرّفات الفريدة، رموز الإشعارات',
        'privacy.s2.l2.i2': 'بيانات الموقع: إحداثيات GPS لمناطق التوصيل، التتبع في الوقت الفعلي',
        'privacy.s2.l2.i3': 'بيانات الاستخدام: تفاعلات التطبيق، الميزات المستخدمة، مدة الجلسة',
        'privacy.s2.l2.i4': 'بيانات السجل: عنوان IP، أوقات الوصول، أعطال التطبيق، نشاط النظام',
        'privacy.s2.l2.i5': 'الصور والوسائط: الصور المرفوعة لطلبات القطع وإثبات التسليم',

        'privacy.s2.subtitle3': '2.3 بيانات الموقع',
        'privacy.s2.p1': 'تتطلب تطبيقاتنا الوصول إلى الموقع لتعمل بشكل صحيح. نستخدمه لحساب رسوم التوصيل ومطابقة الكراجات القريبة والتتبع في الوقت الفعلي وتحسين المسارات. يمكنك تعطيله في الإعدادات، لكن ذلك سيؤثر على الوظائف.',

        'privacy.s3.title': 'كيف نستخدم معلوماتك',
        'privacy.s3.l1.i1': 'معالجة وتنفيذ طلبات قطع الغيار والطلبات',
        'privacy.s3.l1.i2': 'تسهيل المزايدة بين العملاء والكراجات',
        'privacy.s3.l1.i3': 'حساب رسوم التوصيل بناءً على موقعك',
        'privacy.s3.l1.i4': 'توفير تتبع الطلبات والإشعارات في الوقت الفعلي',
        'privacy.s3.l1.i5': 'معالجة المدفوعات والتحويلات',
        'privacy.s3.l1.i6': 'إدارة الضمانات والمرتجعات والاسترداد',

        'privacy.s4.title': 'مشاركة البيانات والإفصاح',
        'privacy.s4.intro': 'قد نشارك معلوماتك مع:',
        'privacy.s4.l1.i1': 'الكراجات: اسمك ورقم هاتفك وعنوان التوصيل لتنفيذ الطلب',
        'privacy.s4.l1.i2': 'السائقون: اسمك ورقم هاتفك وموقع التوصيل لتسليم الطلب',
        'privacy.s4.l1.i3': 'معالجو الدفع: تفاصيل المعاملات لمعالجة الدفع',
        'privacy.s4.l1.i4': 'مزودو الخدمات الخارجيون (السحابة، التحليلات، الخرائط) لغرض تشغيل الخدمة',
        'privacy.s4.l1.i5': 'الجهات المختصة عند الاقتضاء بموجب القانون',
        'privacy.s4.alert': 'نحن لا نبيع معلوماتك الشخصية لأطراف ثالثة لأغراض الإعلان أو التسويق.',

        'privacy.s5.title': 'أمن البيانات',
        'privacy.s5.l1.i1': 'التشفير: جميع عمليات نقل البيانات تستخدم SSL/TLS (HTTPS)',
        'privacy.s5.l1.i2': 'التخزين الآمن: قواعد بيانات مشفرة مع ضوابط الوصول',
        'privacy.s5.l1.i3': 'المصادقة: التحقق عبر رمز الاستخدام الواحد (OTP) للوصول إلى الحساب',
        'privacy.s5.l1.i4': 'التحكم في الوصول: قيود قائمة على الأدوار للموظفين',
        'privacy.s5.alert': 'بينما نسعى لحماية بياناتك، لا توجد طريقة لنقل البيانات عبر الإنترنت آمنة بنسبة 100%.',

        'privacy.s6.title': 'نقل البيانات الدولي',
        'privacy.s6.p1': 'قد يتم نقل معلوماتك ومعالجتها على خوادم موجودة خارج قطر. نضمن وجود ضمانات مناسبة لحماية بياناتك وفقًا للقانون القطري رقم 13 لسنة 2016.',

        'privacy.s7.title': 'الاحتفاظ بالبيانات',
        'privacy.s7.l1.i1': 'نحتفظ بمعلوماتك الشخصية طالما كان ذلك ضروريًا لتقديم خدماتنا والامتثال للمتطلبات القانونية في قطر (مثل الاحتفاظ لمدة 10 سنوات للسجلات التجارية).',
        'privacy.s7.l1.i2': 'عندما لا تعود البيانات تخدم غرضًا مشروعًا، نحذفها بشكل آمن أو نجعلها مجهولة الهوية.',

        'privacy.s8.title': 'حقوقك',
        'privacy.s8.intro': 'بموجب قوانين حماية البيانات القطرية وسياساتنا، لديك الحق في:',
        'privacy.s8.l1.i1': 'الوصول: طلب نسخة من بياناتك الشخصية',
        'privacy.s8.l1.i2': 'التصحيح: تحديث أو تصحيح المعلومات غير الدقيقة',
        'privacy.s8.l1.i3': 'الحذف: طلب حذف حسابك وبياناتك (وفقًا للاحتفاظ القانوني)',
        'privacy.s8.l1.i4': 'إمكانية نقل البيانات وسحب الموافقة',
        'privacy.s8.alert': 'لممارسة هذه الحقوق، تواصل معنا على <a href="mailto:privacy@qscrap.qa">privacy@qscrap.qa</a>.',

        'privacy.s9.title': 'حذف الحساب',
        'privacy.s9.intro': 'يمكنك طلب حذف حسابك من خلال التطبيق. عند الحذف، سيتم إزالة ملفك الشخصي أو جعل معلوماتك مجهولة الهوية، باستثناء ما يتطلبه القانون.',

        'privacy.s10.title': 'خصوصية القُصّر',
        'privacy.s10.p1': 'تطبيقاتنا غير مخصصة لمن هم دون 18 عامًا. نحن لا نجمع عمدًا معلومات شخصية من القُصّر.',

        'privacy.s11.title': 'روابط الأطراف الثالثة',
        'privacy.s11.p1': 'نحن غير مسؤولين عن ممارسات الخصوصية لمواقع أو خدمات الأطراف الثالثة المرتبطة بتطبيقاتنا.',

        'privacy.s12.title': 'التغييرات على هذه السياسة',
        'privacy.s12.p1': 'قد نحدّث سياسة الخصوصية هذه. سنخطرك بالتغييرات الجوهرية. استمرارك في استخدام تطبيقاتنا يعني قبولك للسياسة المحدّثة.',

        'privacy.s13.title': 'القانون المعمول به',
        'privacy.s13.p1': 'تخضع هذه السياسة لقوانين دولة قطر، وتختص محاكم الدوحة بالنظر في أي نزاعات.',

        'privacy.s14.title': 'معلومات التواصل',
        'privacy.s14.l1.i1': 'كيوسكراب للخدمات والتجارة ذ.م.م',
        'privacy.s14.l1.i2': 'سجل تجاري رقم: [CR NUMBER]',
        'privacy.s14.l1.i3': 'البريد الإلكتروني: <a href="mailto:privacy@qscrap.qa">privacy@qscrap.qa</a>',

        // Privacy Contact Card (Arabic)
        'privacy.contact.title': '📞 تواصل معنا',
        'privacy.contact.dpo': 'مسؤول حماية البيانات',
        'privacy.contact.general': 'الدعم العام',
        'privacy.contact.phone': 'الهاتف',
        'privacy.contact.address': 'الموقع',
        'privacy.contact.addressValue': 'الدوحة، قطر',

        // Footer (Matching footer component)
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
        'footer.contactTitle': 'تواصل',
        'footer.email': 'support@qscrap.qa',
        'footer.phone': '+974 5026 7974',
        'footer.whatsapp': 'دعم واتساب',
        'footer.legalInfo.en': 'QScrap Services & Trading L.L.C | Doha, Qatar',
        'footer.legalInfo.ar': 'كيوسكراب للخدمات والتجارة ذ.م.م | الدوحة، قطر',
        'footer.copyright': 'كيوسكراب © 2026. جميع الحقوق محفوظة.'
    }
};

// Expose translations globally for footer-loader.js
window.translations = legalTranslations;

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

// Re-apply current language when footer component is injected asynchronously.
document.addEventListener('footer:loaded', () => {
    legalI18n.setLanguage(legalI18n.currentLang, false);
});
