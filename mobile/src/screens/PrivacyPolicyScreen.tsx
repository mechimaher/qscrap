import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection } from '../utils/rtl';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants';

const { width } = Dimensions.get('window');

// ============================================
// SECTION TYPE
// ============================================
interface Section {
    num: number;
    title: string;
    icon: string;
    content?: string;
    items?: string[];
    footnote?: string;
    subsections?: { title: string; items?: string[]; content?: string }[];
    highlight?: { type: 'gold' | 'default'; text: string };
}

// ============================================
// PRIVACY CONTENT — mirrors public/privacy.html
// ============================================
const SECTIONS_EN: Section[] = [
    {
        num: 1,
        title: 'Introduction & Scope',
        icon: 'globe',
        content: 'QScrap Services & Trading L.L.C (CR: 155892) operates the QScrap Customer App and QScrap Driver App. This Privacy Policy applies to all users:',
        items: [
            'Customers: Users seeking automotive spare parts',
            'Garage Partners: Businesses providing spare parts through our marketplace',
            'Drivers: Delivery personnel using the QScrap Driver App',
        ],
        footnote: 'By using our Apps or services, you consent to the collection, use, and disclosure of your information as described in this Privacy Policy. This policy complies with Qatar\'s Law No. 13 of 2016 on Personal Data Protection.',
    },
    {
        num: 2,
        title: 'Information We Collect',
        icon: 'layers',
        subsections: [
            {
                title: '2.1 Personal Information You Provide',
                items: [
                    'Account Information: Full name, phone number, email address',
                    'Profile Information: Profile picture (optional), preferred language',
                    'Vehicle Information: VIN, make, model, year for parts matching',
                    'Payment Information: Payment method preferences (Cash on Delivery, Card)',
                    'Business Information (Garages): CR number, IBAN, business address',
                    'Driver Information: Qatar ID, driver\'s license, vehicle registration',
                ],
            },
            {
                title: '2.2 Information Collected Automatically',
                items: [
                    'Device Information: Device type, OS version, unique identifiers, push tokens',
                    'Location Data: GPS coordinates for delivery zones, real-time tracking',
                    'Usage Data: App interactions, features used, session duration',
                    'Log Data: IP address, access times, app crashes, system activity',
                    'Photos & Media: Images uploaded for part requests and proof of delivery',
                ],
            },
        ],
        highlight: { type: 'default', text: 'Our Apps require location access to function properly. We use it for delivery fee calculation, nearby garage matching, real-time tracking, and route optimization. You may disable it in settings, but this will impact functionality.' },
    },
    {
        num: 3,
        title: 'How We Use Your Information',
        icon: 'analytics',
        subsections: [
            {
                title: '3.1 Service Provision',
                items: [
                    'Processing and fulfilling spare part requests and orders',
                    'Facilitating bidding between customers and garages',
                    'Calculating delivery fees based on your location',
                    'Providing real-time order tracking and notifications',
                    'Processing payments and payouts',
                    'Managing warranties, returns, and refunds',
                ],
            },
            {
                title: '3.2 Communication',
                items: [
                    'Sending order confirmations, updates, and delivery notifications',
                    'Customer support and dispute resolution',
                    'Important service announcements and policy updates',
                    'Marketing communications (with your consent)',
                ],
            },
            {
                title: '3.3 Improvement & Safety',
                items: [
                    'Analyzing usage patterns to improve our services',
                    'Fraud detection and prevention',
                    'Ensuring platform safety and security',
                    'Compliance with legal obligations',
                ],
            },
        ],
    },
    {
        num: 4,
        title: 'Data Sharing & Disclosure',
        icon: 'share-social',
        content: 'We may share your information with:',
        subsections: [
            {
                title: '4.1 Service Partners',
                items: [
                    'Garages: Your name, phone number, and delivery address for order fulfilment',
                    'Drivers: Your name, phone number, and delivery location for order delivery',
                    'Payment Processors: Transaction details for payment processing',
                ],
            },
            {
                title: '4.2 Third-Party Service Providers',
                items: [
                    'Cloud Infrastructure: Secure data storage',
                    'Analytics: Usage analysis',
                    'Maps & Location: Google Maps for location services',
                    'Push Notifications: Firebase Cloud Messaging for notifications',
                ],
            },
            {
                title: '4.3 Legal Requirements',
                content: 'We may disclose your information when required by Qatar law, court orders, or government regulations.',
            },
        ],
        highlight: { type: 'gold', text: 'We do NOT sell your personal information to third parties for advertising or marketing purposes.' },
    },
    {
        num: 5,
        title: 'Data Security',
        icon: 'lock-closed',
        content: 'We implement industry-standard security measures to protect your data:',
        items: [
            'Encryption: All data transmissions use SSL/TLS (HTTPS)',
            'Secure Storage: Encrypted databases with access controls',
            'Authentication: OTP-based verification for account access',
            'Access Control: Role-based restrictions for employees',
            'Regular Audits: Security assessments and vulnerability testing',
            'Incident Response: Data breach notification within 72 hours',
        ],
        footnote: 'While we strive to protect your data, no method of transmission over the Internet is 100% secure.',
    },
    {
        num: 6,
        title: 'Data Retention',
        icon: 'time',
        content: 'We retain your personal information for as long as necessary to:',
        items: [
            'Provide our services and fulfill orders',
            'Comply with Qatar\'s legal requirements (10-year retention for commercial records)',
            'Resolve disputes and enforce agreements',
            'Maintain audit trails for regulatory compliance',
        ],
        footnote: 'When data is no longer needed, we securely delete or anonymize it.',
    },
    {
        num: 7,
        title: 'Your Rights',
        icon: 'hand-left',
        content: 'Under Qatar\'s data protection laws and our policies, you have the right to:',
        items: [
            'Access: Request a copy of your personal data',
            'Correction: Update or correct inaccurate information',
            'Deletion: Request deletion of your account and data (subject to legal retention)',
            'Portability: Request an export of your data in a common format',
            'Opt-out: Unsubscribe from marketing communications',
            'Withdraw Consent: Revoke permissions for optional data processing',
        ],
        footnote: 'To exercise these rights, contact us at privacy@qscrap.qa. We will respond within 30 days.',
    },
    {
        num: 8,
        title: 'Account Deletion',
        icon: 'trash',
        content: 'You may request account deletion through the app or by contacting us. Upon deletion:',
        items: [
            'Your profile and personal data will be removed or anonymized',
            'Order history may be retained in anonymized form for legal/audit purposes',
            'Data required by law (invoices, transaction records) will be retained per Qatar Commercial Law',
        ],
    },
    {
        num: 9,
        title: 'Children\'s Privacy',
        icon: 'people',
        content: 'Our Apps are not intended for users under 18 years of age. We do not knowingly collect personal information from children under 18. If you believe a child has provided us with personal information, please contact us immediately.',
    },
    {
        num: 10,
        title: 'Third-Party Links',
        icon: 'link',
        content: 'Our Apps may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to read their privacy policies before providing any personal information.',
    },
    {
        num: 11,
        title: 'International Data Transfers',
        icon: 'earth',
        content: 'Your information may be transferred to and processed on servers located outside Qatar. We ensure appropriate safeguards are in place to protect your data in accordance with Qatar\'s Law No. 13 of 2016.',
    },
    {
        num: 12,
        title: 'Changes to This Policy',
        icon: 'create',
        content: 'We may update this Privacy Policy periodically. We will notify you of significant changes through:',
        items: [
            'In-app notifications',
            'Email to your registered email address',
            'A prominent notice on our website',
        ],
        footnote: 'Continued use of our Apps after changes constitutes acceptance of the updated policy.',
    },
    {
        num: 13,
        title: 'Governing Law',
        icon: 'scale',
        content: 'This Privacy Policy is governed by the laws of the State of Qatar, including Law No. 13 of 2016 on Personal Data Protection. Any disputes shall be subject to the exclusive jurisdiction of Qatar courts.',
    },
];

// ============================================
// PRIVACY CONTENT — Arabic
// ============================================
const SECTIONS_AR: Section[] = [
    {
        num: 1,
        title: 'المقدمة والنطاق',
        icon: 'globe',
        content: 'تدير شركة كيوسكراب للخدمات والتجارة ذ.م.م (السجل التجاري: 155892) تطبيق كيوسكراب للعملاء وتطبيق كيوسكراب للسائقين. تنطبق سياسة الخصوصية هذه على جميع المستخدمين:',
        items: [
            'العملاء: المستخدمون الباحثون عن قطع غيار السيارات',
            'شركاء الكراجات: الشركات التي توفر قطع الغيار عبر منصتنا',
            'السائقون: موظفو التوصيل الذين يستخدمون تطبيق كيوسكراب للسائقين',
        ],
        footnote: 'باستخدامك لتطبيقاتنا أو خدماتنا، فإنك توافق على جمع واستخدام والإفصاح عن معلوماتك كما هو موضح في سياسة الخصوصية هذه. تتوافق هذه السياسة مع القانون القطري رقم 13 لسنة 2016 بشأن حماية البيانات الشخصية.',
    },
    {
        num: 2,
        title: 'المعلومات التي نجمعها',
        icon: 'layers',
        subsections: [
            {
                title: '2.1 المعلومات الشخصية التي تقدمها',
                items: [
                    'معلومات الحساب: الاسم الكامل، رقم الهاتف، البريد الإلكتروني',
                    'معلومات الملف الشخصي: صورة الملف الشخصي (اختيارية)، اللغة المفضلة',
                    'معلومات المركبة: رقم الهيكل، الشركة المصنعة، الطراز، سنة الصنع لمطابقة القطع',
                    'معلومات الدفع: تفضيلات طريقة الدفع (الدفع عند الاستلام، البطاقة)',
                    'معلومات الأعمال (للكراجات): رقم السجل التجاري، رقم الآيبان، عنوان العمل',
                    'معلومات السائق: الهوية القطرية، رخصة القيادة، تسجيل المركبة',
                ],
            },
            {
                title: '2.2 المعلومات المجمّعة تلقائيًا',
                items: [
                    'معلومات الجهاز: نوع الجهاز، إصدار نظام التشغيل، المعرّفات الفريدة، رموز الإشعارات',
                    'بيانات الموقع: إحداثيات GPS لمناطق التوصيل، التتبع في الوقت الفعلي',
                    'بيانات الاستخدام: تفاعلات التطبيق، الميزات المستخدمة، مدة الجلسة',
                    'بيانات السجل: عنوان IP، أوقات الوصول، أعطال التطبيق، نشاط النظام',
                    'الصور والوسائط: الصور المرفوعة لطلبات القطع وإثبات التسليم',
                ],
            },
        ],
        highlight: { type: 'default', text: 'تتطلب تطبيقاتنا الوصول إلى الموقع لتعمل بشكل صحيح. نستخدمه لحساب رسوم التوصيل ومطابقة الكراجات القريبة والتتبع في الوقت الفعلي وتحسين المسارات. يمكنك تعطيله في الإعدادات، لكن ذلك سيؤثر على الوظائف.' },
    },
    {
        num: 3,
        title: 'كيف نستخدم معلوماتك',
        icon: 'analytics',
        subsections: [
            {
                title: '3.1 تقديم الخدمة',
                items: [
                    'معالجة وتنفيذ طلبات قطع الغيار والطلبات',
                    'تسهيل المزايدة بين العملاء والكراجات',
                    'حساب رسوم التوصيل بناءً على موقعك',
                    'توفير تتبع الطلبات والإشعارات في الوقت الفعلي',
                    'معالجة المدفوعات والتحويلات',
                    'إدارة الضمانات والمرتجعات والاسترداد',
                ],
            },
            {
                title: '3.2 التواصل',
                items: [
                    'إرسال تأكيدات الطلبات والتحديثات وإشعارات التوصيل',
                    'دعم العملاء وحل النزاعات',
                    'إعلانات الخدمة المهمة وتحديثات السياسات',
                    'الاتصالات التسويقية (بموافقتك)',
                ],
            },
            {
                title: '3.3 التحسين والأمان',
                items: [
                    'تحليل أنماط الاستخدام لتحسين خدماتنا',
                    'كشف ومنع الاحتيال',
                    'ضمان أمان وسلامة المنصة',
                    'الامتثال للالتزامات القانونية',
                ],
            },
        ],
    },
    {
        num: 4,
        title: 'مشاركة البيانات والإفصاح',
        icon: 'share-social',
        content: 'قد نشارك معلوماتك مع:',
        subsections: [
            {
                title: '4.1 شركاء الخدمة',
                items: [
                    'الكراجات: اسمك ورقم هاتفك وعنوان التوصيل لتنفيذ الطلب',
                    'السائقون: اسمك ورقم هاتفك وموقع التوصيل لتسليم الطلب',
                    'معالجو الدفع: تفاصيل المعاملات لمعالجة الدفع',
                ],
            },
            {
                title: '4.2 مزودو الخدمات الخارجيون',
                items: [
                    'البنية التحتية السحابية: تخزين آمن للبيانات',
                    'التحليلات: تحليل الاستخدام',
                    'الخرائط والموقع: خرائط جوجل لخدمات الموقع',
                    'الإشعارات الفورية: Firebase Cloud Messaging للإشعارات',
                ],
            },
            {
                title: '4.3 المتطلبات القانونية',
                content: 'قد نفصح عن معلوماتك عندما يتطلب ذلك القانون القطري أو أوامر المحكمة أو اللوائح الحكومية.',
            },
        ],
        highlight: { type: 'gold', text: 'نحن لا نبيع معلوماتك الشخصية لأطراف ثالثة لأغراض الإعلان أو التسويق.' },
    },
    {
        num: 5,
        title: 'أمن البيانات',
        icon: 'lock-closed',
        content: 'نطبّق إجراءات أمنية وفق المعايير المعتمدة لحماية بياناتك:',
        items: [
            'التشفير: جميع عمليات نقل البيانات تستخدم SSL/TLS (HTTPS)',
            'التخزين الآمن: قواعد بيانات مشفرة مع ضوابط الوصول',
            'المصادقة: التحقق عبر OTP للوصول إلى الحساب',
            'التحكم في الوصول: قيود قائمة على الأدوار للموظفين',
            'التدقيق المنتظم: تقييمات أمنية واختبارات الثغرات',
            'الاستجابة للحوادث: إخطار بانتهاك البيانات خلال 72 ساعة',
        ],
        footnote: 'بينما نسعى لحماية بياناتك، لا توجد طريقة لنقل البيانات عبر الإنترنت آمنة بنسبة 100%.',
    },
    {
        num: 6,
        title: 'الاحتفاظ بالبيانات',
        icon: 'time',
        content: 'نحتفظ بمعلوماتك الشخصية طالما كان ذلك ضروريًا من أجل:',
        items: [
            'تقديم خدماتنا وتنفيذ الطلبات',
            'الامتثال للمتطلبات القانونية في قطر (الاحتفاظ لمدة 10 سنوات للسجلات التجارية)',
            'حل النزاعات وإنفاذ الاتفاقيات',
            'الحفاظ على سجلات المراجعة للامتثال التنظيمي',
        ],
        footnote: 'عندما لا تعود البيانات مطلوبة، نحذفها بشكل آمن أو نجعلها مجهولة الهوية.',
    },
    {
        num: 7,
        title: 'حقوقك',
        icon: 'hand-left',
        content: 'بموجب قوانين حماية البيانات القطرية وسياساتنا، لديك الحق في:',
        items: [
            'الوصول: طلب نسخة من بياناتك الشخصية',
            'التصحيح: تحديث أو تصحيح المعلومات غير الدقيقة',
            'الحذف: طلب حذف حسابك وبياناتك (وفقًا للاحتفاظ القانوني)',
            'النقل: طلب تصدير بياناتك بتنسيق شائع',
            'إلغاء الاشتراك: إلغاء الاشتراك من الاتصالات التسويقية',
            'سحب الموافقة: إلغاء الأذونات لمعالجة البيانات الاختيارية',
        ],
        footnote: 'لممارسة هذه الحقوق، تواصل معنا على privacy@qscrap.qa. سنرد خلال 30 يومًا.',
    },
    {
        num: 8,
        title: 'حذف الحساب',
        icon: 'trash',
        content: 'يمكنك طلب حذف حسابك من خلال التطبيق أو بالتواصل معنا. عند الحذف:',
        items: [
            'سيتم إزالة ملفك الشخصي وبياناتك الشخصية أو جعلها مجهولة الهوية',
            'قد يتم الاحتفاظ بسجل الطلبات بشكل مجهول لأغراض قانونية/المراجعة',
            'البيانات المطلوبة قانونيًا (الفواتير، سجلات المعاملات) سيتم الاحتفاظ بها وفقًا للقانون التجاري القطري',
        ],
    },
    {
        num: 9,
        title: 'خصوصية الأطفال',
        icon: 'people',
        content: 'تطبيقاتنا غير مخصصة للمستخدمين الذين تقل أعمارهم عن 18 عامًا. نحن لا نجمع عمدًا معلومات شخصية من الأطفال دون سن 18 عامًا. إذا كنت تعتقد أن طفلاً قدم لنا معلومات شخصية، يرجى التواصل معنا فورًا.',
    },
    {
        num: 10,
        title: 'روابط الأطراف الثالثة',
        icon: 'link',
        content: 'قد تحتوي تطبيقاتنا على روابط لمواقع أو خدمات أطراف ثالثة. نحن غير مسؤولين عن ممارسات الخصوصية لهذه الأطراف. ننصحك بقراءة سياسات الخصوصية الخاصة بهم قبل تقديم أي معلومات شخصية.',
    },
    {
        num: 11,
        title: 'نقل البيانات الدولي',
        icon: 'earth',
        content: 'قد يتم نقل معلوماتك ومعالجتها على خوادم موجودة خارج قطر. نضمن وجود ضمانات مناسبة لحماية بياناتك وفقًا للقانون القطري رقم 13 لسنة 2016.',
    },
    {
        num: 12,
        title: 'التغييرات على هذه السياسة',
        icon: 'create',
        content: 'قد نحدّث سياسة الخصوصية هذه بشكل دوري. سنخطرك بالتغييرات الجوهرية من خلال:',
        items: [
            'إشعارات داخل التطبيق',
            'بريد إلكتروني إلى عنوان بريدك الإلكتروني المسجل',
            'إشعار بارز على موقعنا الإلكتروني',
        ],
        footnote: 'استمرارك في استخدام تطبيقاتنا بعد التغييرات يعني قبولك للسياسة المحدّثة.',
    },
    {
        num: 13,
        title: 'القانون المعمول به',
        icon: 'scale',
        content: 'تخضع سياسة الخصوصية هذه لقوانين دولة قطر، بما في ذلك القانون رقم 13 لسنة 2016 بشأن حماية البيانات الشخصية. تخضع أي نزاعات للاختصاص الحصري لمحاكم دولة قطر.',
    },
];

// ============================================
// UI CHROME TRANSLATIONS
// ============================================
const CHROME = {
    en: {
        badge: 'Your Data is Protected',
        summaryTitle: 'Your Privacy is Our Priority',
        summaryText: 'This Privacy Policy explains how QScrap Services & Trading L.L.C collects, uses, shares, and protects your personal information. We are committed to transparency and compliance with Qatar\'s Law No. 13 of 2016 on Personal Data Protection.',
        lastUpdated: 'Last updated: January 31, 2026',
        contactTitle: 'Contact Us',
        contactItems: [
            { icon: 'shield', label: 'Data Protection Officer', value: 'privacy@qscrap.qa' },
            { icon: 'mail', label: 'General Support', value: 'support@qscrap.qa' },
            { icon: 'call', label: 'Phone', value: '+974 5026 7974' },
            { icon: 'location', label: 'Address', value: 'Industrial Area, Street 10, Doha, Qatar' },
        ],
        companyName: 'QScrap Services & Trading L.L.C',
        companyArabic: 'كيوسكراب للخدمات والتجارة ذ.م.م',
        companyCR: 'Commercial Registration: 155892 | State of Qatar',
        footer: '© 2026 QScrap Services & Trading L.L.C. All rights reserved.',
        compliance: 'Compliant with Google Play Developer Program Policies and Qatar\'s Personal Data Protection Law.',
    },
    ar: {
        badge: 'بياناتك محمية',
        summaryTitle: 'خصوصيتك هي أولويتنا',
        summaryText: 'توضح سياسة الخصوصية هذه كيف تجمع شركة كيوسكراب للخدمات والتجارة ذ.م.م معلوماتك الشخصية وتستخدمها وتشاركها وتحميها. نحن ملتزمون بالشفافية والامتثال للقانون القطري رقم 13 لسنة 2016 بشأن حماية البيانات الشخصية.',
        lastUpdated: 'آخر تحديث: 31 يناير 2026',
        contactTitle: 'تواصل معنا',
        contactItems: [
            { icon: 'shield', label: 'مسؤول حماية البيانات', value: 'privacy@qscrap.qa' },
            { icon: 'mail', label: 'الدعم العام', value: 'support@qscrap.qa' },
            { icon: 'call', label: 'الهاتف', value: '+974 5026 7974' },
            { icon: 'location', label: 'العنوان', value: 'المنطقة الصناعية، شارع 10، الدوحة، قطر' },
        ],
        companyName: 'كيوسكراب للخدمات والتجارة ذ.م.م',
        companyArabic: 'QScrap Services & Trading L.L.C',
        companyCR: 'السجل التجاري: 155892 | دولة قطر',
        footer: '© 2026 كيوسكراب للخدمات والتجارة ذ.م.م. جميع الحقوق محفوظة.',
        compliance: 'متوافق مع سياسات برنامج مطوري Google Play وقانون حماية البيانات الشخصية القطري.',
    },
};

/**
 * Privacy Policy Screen
 * Premium native layout — instant load, offline support, dark mode, RTL.
 * Fully bilingual: EN/AR with RTL layout support.
 */
export default function PrivacyPolicyScreen() {
    const navigation = useNavigation();
    const { colors, isDark } = useTheme();
    const { t, language, isRTL } = useTranslation();
    const sections = language === 'ar' ? SECTIONS_AR : SECTIONS_EN;
    const chrome = CHROME[language] || CHROME.en;
    const textAlign = isRTL ? ('right' as const) : ('left' as const);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

            {/* Premium Header */}
            <LinearGradient
                colors={isDark ? ['#0A1628', '#0D1117'] : ['#1E3A5F', '#0F1F33']}
                style={styles.heroGradient}
            >
                {/* Back button row */}
                <View style={[styles.headerRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.back')}
                    >
                        <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                </View>

                {/* Hero content */}
                <View style={styles.heroContent}>
                    <View style={styles.heroBadge}>
                        <Ionicons name="shield-checkmark" size={14} color="#4ADE80" />
                        <Text style={styles.heroBadgeText}>{chrome.badge}</Text>
                    </View>
                    <Text style={styles.heroTitle}>{t('settings.privacyPolicy')}</Text>
                    <Text style={styles.heroArabic}>{isRTL ? 'Privacy Policy' : 'سياسة الخصوصية'}</Text>
                    <Text style={styles.heroDate}>{chrome.lastUpdated}</Text>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Summary Card */}
                <LinearGradient
                    colors={isDark ? ['#0A1628', '#0D1117'] : ['#1E3A5F', '#0F1F33']}
                    style={styles.summaryCard}
                >
                    <View style={styles.summaryIconWrap}>
                        <Ionicons name="lock-closed" size={28} color="rgba(255,255,255,0.2)" />
                    </View>
                    <Text style={[styles.summaryTitle, { textAlign }]}>{chrome.summaryTitle}</Text>
                    <Text style={[styles.summaryText, { textAlign }]}>
                        {chrome.summaryText}
                    </Text>
                </LinearGradient>

                {/* Sections */}
                {sections.map((section) => (
                    <View key={section.num} style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                        {/* Section Header */}
                        <View style={[styles.sectionHeader, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <View style={[styles.sectionNumBadge, { backgroundColor: '#1E3A5F' }]}>
                                <Text style={styles.sectionNumText}>{section.num}</Text>
                            </View>
                            <View style={styles.sectionTitleWrap}>
                                <Text style={[styles.sectionTitle, { color: colors.text, textAlign }]}>{section.title}</Text>
                            </View>
                            <Ionicons name={section.icon as any} size={20} color="#1E3A5F" style={{ opacity: 0.35 }} />
                        </View>

                        {/* Content */}
                        {section.content && (
                            <Text style={[styles.sectionText, { color: colors.textSecondary, textAlign }]}>
                                {section.content}
                            </Text>
                        )}

                        {/* List items (top-level) */}
                        {section.items && section.items.map((item, idx) => (
                            <View key={idx} style={[styles.listItem, { flexDirection: rtlFlexDirection(isRTL) }]}>
                                <Ionicons name="checkmark" size={16} color="#1E3A5F" style={[styles.listIcon, isRTL && { marginLeft: Spacing.sm, marginRight: 0 }]} />
                                <Text style={[styles.listText, { color: colors.textSecondary, textAlign }]}>{item}</Text>
                            </View>
                        ))}

                        {/* Subsections */}
                        {section.subsections && section.subsections.map((sub, idx) => (
                            <View key={idx} style={styles.subsection}>
                                <View style={[styles.subsectionHeader, { flexDirection: rtlFlexDirection(isRTL) }]}>
                                    <View style={styles.subsectionBar} />
                                    <Text style={[styles.subsectionTitle, { color: isDark ? '#6BA3D6' : '#1E3A5F', textAlign }]}>{sub.title}</Text>
                                </View>
                                {sub.content && (
                                    <Text style={[styles.sectionText, { color: colors.textSecondary, textAlign }]}>{sub.content}</Text>
                                )}
                                {sub.items && sub.items.map((item, i) => (
                                    <View key={i} style={[styles.listItem, { flexDirection: rtlFlexDirection(isRTL) }]}>
                                        <Ionicons name="checkmark" size={16} color={Colors.secondary} style={[styles.listIcon, isRTL && { marginLeft: Spacing.sm, marginRight: 0 }]} />
                                        <Text style={[styles.listText, { color: colors.textSecondary, textAlign }]}>{item}</Text>
                                    </View>
                                ))}
                            </View>
                        ))}

                        {/* Footnote */}
                        {section.footnote && (
                            <Text style={[styles.footnote, { color: colors.textMuted, textAlign }]}>{section.footnote}</Text>
                        )}

                        {/* Highlight box */}
                        {section.highlight && (
                            <View style={[
                                styles.highlightBox,
                                {
                                    backgroundColor: isDark
                                        ? (section.highlight.type === 'gold' ? 'rgba(201,162,39,0.1)' : 'rgba(30,58,95,0.15)')
                                        : (section.highlight.type === 'gold' ? '#FFF9E6' : '#EFF6FF'),
                                    borderLeftColor: section.highlight.type === 'gold' ? Colors.secondary : '#1E3A5F',
                                },
                                isRTL && styles.highlightBoxRTL,
                            ]}>
                                <Ionicons
                                    name={section.highlight.type === 'gold' ? 'lock-closed' : 'information-circle'}
                                    size={18}
                                    color={section.highlight.type === 'gold' ? Colors.secondary : '#1E3A5F'}
                                    style={isRTL ? { marginLeft: Spacing.sm, marginTop: 2 } : { marginRight: Spacing.sm, marginTop: 2 }}
                                />
                                <Text style={[styles.highlightText, { color: colors.text, flex: 1, textAlign }]}>
                                    {section.highlight.text}
                                </Text>
                            </View>
                        )}
                    </View>
                ))}

                {/* Contact Card */}
                <LinearGradient
                    colors={isDark ? ['#141416', '#1C1C1F'] : ['#1A1A1A', '#2A2A2A']}
                    style={styles.contactCard}
                >
                    <Text style={[styles.contactTitle, { textAlign }]}>{chrome.contactTitle}</Text>
                    <View style={styles.contactGrid}>
                        {chrome.contactItems.map((item, idx) => (
                            <ContactItem key={idx} icon={item.icon} label={item.label} value={item.value} isRTL={isRTL} />
                        ))}
                    </View>
                    <View style={styles.contactLegal}>
                        <Text style={styles.companyName}>{chrome.companyName}</Text>
                        <Text style={styles.companyArabic}>{chrome.companyArabic}</Text>
                        <Text style={styles.companyCR}>{chrome.companyCR}</Text>
                    </View>
                </LinearGradient>

                {/* Footer */}
                <Text style={[styles.footerText, { color: colors.textMuted }]}>
                    {chrome.footer}
                </Text>
                <Text style={[styles.footerCompliance, { color: colors.textMuted }]}>
                    {chrome.compliance}
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

// ============================================
// CONTACT ITEM COMPONENT
// ============================================
function ContactItem({ icon, label, value, isRTL }: { icon: string; label: string; value: string; isRTL: boolean }) {
    return (
        <View style={[styles.contactItem, { flexDirection: rtlFlexDirection(isRTL) }]}>
            <View style={styles.contactIconWrap}>
                <Ionicons name={icon as any} size={18} color="#4ADE80" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.contactLabel}>{label}</Text>
                <Text style={styles.contactValue}>{value}</Text>
            </View>
        </View>
    );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
    container: { flex: 1 },

    // Hero
    heroGradient: {
        paddingBottom: Spacing.xl,
        paddingHorizontal: Spacing.lg,
    },
    headerRow: {
        alignItems: 'center',
        paddingTop: Spacing.sm,
        marginBottom: Spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: BorderRadius.xl,
        backgroundColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroContent: { alignItems: 'center' },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 6,
        backgroundColor: 'rgba(74,222,128,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.4)',
        borderRadius: BorderRadius.full,
        marginBottom: Spacing.md,
    },
    heroBadgeText: {
        fontSize: FontSizes.xs,
        fontWeight: '600',
        color: '#4ADE80',
        letterSpacing: 0.5,
    },
    heroTitle: {
        fontSize: width < 380 ? 26 : 32,
        fontWeight: '800',
        color: '#fff',
        textAlign: 'center',
        marginBottom: Spacing.xs,
    },
    heroArabic: {
        fontSize: width < 380 ? 18 : 22,
        fontWeight: '600',
        color: '#4ADE80',
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    heroDate: {
        fontSize: FontSizes.xs,
        color: 'rgba(255,255,255,0.65)',
    },

    // Scroll
    scrollView: { flex: 1 },
    scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },

    // Summary card
    summaryCard: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        marginBottom: Spacing.lg,
        overflow: 'hidden',
    },
    summaryIconWrap: {
        position: 'absolute',
        top: 16,
        right: 20,
    },
    summaryTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#4ADE80',
        marginBottom: Spacing.sm,
    },
    summaryText: {
        fontSize: FontSizes.md,
        lineHeight: 22,
        color: 'rgba(255,255,255,0.88)',
    },

    // Section cards
    sectionCard: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        marginBottom: Spacing.md,
        borderWidth: 1,
        ...Shadows.sm,
    },
    sectionHeader: {
        alignItems: 'center',
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    sectionNumBadge: {
        width: 36,
        height: 36,
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionNumText: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#fff',
    },
    sectionTitleWrap: { flex: 1 },
    sectionTitle: {
        fontSize: width < 380 ? FontSizes.lg : 18,
        fontWeight: '700',
    },

    // Content
    sectionText: {
        fontSize: FontSizes.md,
        lineHeight: 24,
        marginBottom: Spacing.sm,
    },
    listItem: {
        alignItems: 'flex-start',
        marginBottom: Spacing.sm,
    },
    listIcon: {
        marginRight: Spacing.sm,
        marginTop: 3,
    },
    listText: {
        flex: 1,
        fontSize: FontSizes.md,
        lineHeight: 22,
    },
    footnote: {
        fontSize: FontSizes.sm,
        fontStyle: 'italic',
        marginTop: Spacing.sm,
        lineHeight: 20,
    },

    // Subsections
    subsection: {
        marginTop: Spacing.md,
    },
    subsectionHeader: {
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    subsectionBar: {
        width: 4,
        height: 20,
        backgroundColor: Colors.secondary,
        borderRadius: 2,
    },
    subsectionTitle: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        flex: 1,
    },

    // Highlight box
    highlightBox: {
        flexDirection: 'row',
        borderLeftWidth: 4,
        borderRadius: BorderRadius.sm,
        padding: Spacing.md,
        marginTop: Spacing.md,
    },
    highlightBoxRTL: {
        borderLeftWidth: 0,
        borderRightWidth: 4,
    },
    highlightText: {
        fontSize: FontSizes.sm,
        lineHeight: 20,
        fontWeight: '500',
    },

    // Contact card
    contactCard: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        marginTop: Spacing.lg,
    },
    contactTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#4ADE80',
        marginBottom: Spacing.lg,
    },
    contactGrid: { gap: Spacing.md },
    contactItem: {
        alignItems: 'center',
        gap: Spacing.sm,
    },
    contactIconWrap: {
        width: 40,
        height: 40,
        borderRadius: BorderRadius.md,
        backgroundColor: 'rgba(74,222,128,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contactLabel: {
        fontSize: FontSizes.xs,
        color: '#9A9A9A',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    contactValue: {
        fontSize: FontSizes.md,
        color: '#fff',
    },
    contactLegal: {
        marginTop: Spacing.lg,
        paddingTop: Spacing.lg,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
    },
    companyName: {
        fontSize: FontSizes.lg,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    companyArabic: {
        fontSize: FontSizes.md,
        color: '#4ADE80',
        marginBottom: Spacing.sm,
    },
    companyCR: {
        fontSize: FontSizes.sm,
        color: '#9A9A9A',
    },

    // Footer
    footerText: {
        fontSize: FontSizes.sm,
        textAlign: 'center',
        marginTop: Spacing.xl,
    },
    footerCompliance: {
        fontSize: FontSizes.xs,
        textAlign: 'center',
        marginTop: Spacing.xs,
        lineHeight: 18,
    },
});
