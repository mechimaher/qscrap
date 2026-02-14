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
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants';

const { width } = Dimensions.get('window');

// ============================================
// LEGAL CONTENT — English
// ============================================
const SECTIONS_EN = [
    {
        num: 1,
        title: 'Acceptance of Terms',
        icon: 'document-text' as const,
        content: 'By downloading, accessing, or using the QScrap Customer App, QScrap Driver App, or any related services ("the Platform"), you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not use our services.',
        highlight: { type: 'gold' as const, text: 'Your continued use of the Platform after any changes to these terms constitutes acceptance of the updated terms.' },
    },
    {
        num: 2,
        title: 'Description of Service',
        icon: 'construct' as const,
        content: 'QScrap Services & Trading L.L.C is a marketplace connecting customers seeking automotive spare parts with local garages and scrap yards in Qatar. We facilitate:',
        items: [
            'Part requests and competitive bidding from multiple garages',
            'Secure order processing and payment handling',
            'Quality inspection and verification of parts',
            'Delivery of spare parts directly to customers',
            'Warranty management and dispute resolution',
        ],
    },
    {
        num: 3,
        title: 'User Accounts',
        icon: 'person-circle' as const,
        content: 'To use our services, you must:',
        items: [
            'Be at least 18 years old or the legal age in your jurisdiction',
            'Provide accurate and complete registration information',
            'Keep your account credentials secure and confidential',
            'Accept responsibility for all activities under your account',
            'Notify us immediately of any unauthorized account access',
        ],
        footnote: 'We reserve the right to suspend or terminate accounts that violate these terms or engage in fraudulent activity.',
    },
    {
        num: 4,
        title: 'Orders & Payments',
        icon: 'card' as const,
        items: [
            'All prices are displayed in Qatari Riyal (QAR)',
            'Delivery fees are calculated based on distance to your location',
            'Orders are binding once you accept a garage\'s bid',
            'Payment options include Cash on Delivery and Card payments',
            'Platform fees are transparently displayed before order confirmation',
            'Refunds are subject to our Cancellation and Refund Policy',
        ],
        highlight: { type: 'default' as const, text: 'QScrap acts as a facilitator between customers and garages. The actual sale contract is between you and the garage providing the part.' },
    },
    {
        num: 5,
        title: 'Warranties & Returns',
        icon: 'shield-checkmark' as const,
        items: [
            'Part warranties are provided by individual garages through the QScrap platform',
            'New parts: 30-day warranty',
            'Used parts (Excellent/Good): 14-day warranty',
            'Used parts (Fair): 7-day warranty',
            'Disputes must be raised within the applicable warranty period',
            'QScrap will mediate disputes between customers and garages',
        ],
    },
    {
        num: 6,
        title: 'Prohibited Activities',
        icon: 'ban' as const,
        content: 'You may not:',
        items: [
            'Use the Platform for any illegal or unauthorized purposes',
            'Provide false, misleading, or fraudulent information',
            'Harass, abuse, or threaten other users, garages, or drivers',
            'Attempt to circumvent our platform fees or commission structure',
            'Engage in price manipulation or bid rigging',
            'Create multiple accounts to exploit promotions',
            'Reverse engineer or attempt to extract source code from our apps',
        ],
    },
    {
        num: 7,
        title: 'Limitation of Liability',
        icon: 'alert-circle' as const,
        content: 'QScrap acts as a marketplace facilitator. To the maximum extent permitted by Qatar law:',
        items: [
            'We are not responsible for the quality or condition of parts sold by garages',
            'We are not liable for delays caused by garages or delivery issues beyond our control',
            'We facilitate but do not guarantee resolution of disputes between users and garages',
            'Our liability is limited to the amount of fees paid to QScrap for the relevant transaction',
        ],
        highlight: { type: 'gold' as const, text: 'Nothing in these terms affects your statutory rights under Qatar\'s Consumer Protection Law (Law No. 8 of 2008).' },
    },
    {
        num: 8,
        title: 'Intellectual Property',
        icon: 'bulb' as const,
        content: 'All content, trademarks, logos, and intellectual property on the Platform belong to QScrap Services & Trading L.L.C or its licensors. You may not copy, modify, distribute, or create derivative works without our express written permission.',
    },
    {
        num: 9,
        title: 'Governing Law & Disputes',
        icon: 'scale' as const,
        content: 'These Terms of Service are governed by the laws of the State of Qatar. Any disputes arising from or related to these terms or your use of the Platform shall be resolved in the courts of Qatar.\n\nFor complaints or concerns, please contact us first. We will attempt to resolve issues through our internal dispute resolution process before any legal action is taken.',
    },
];

// ============================================
// LEGAL CONTENT — Arabic
// ============================================
const SECTIONS_AR = [
    {
        num: 1,
        title: 'قبول الشروط',
        icon: 'document-text' as const,
        content: 'بتحميلك أو وصولك أو استخدامك لتطبيق كيوسكراب للعملاء أو تطبيق كيوسكراب للسائقين أو أي خدمات ذات صلة ("المنصة")، فإنك توافق على الالتزام بشروط الخدمة هذه. إذا لم توافق على أي جزء من هذه الشروط، فلا يحق لك استخدام خدماتنا.',
        highlight: { type: 'gold' as const, text: 'استمرارك في استخدام المنصة بعد أي تغييرات على هذه الشروط يعني قبولك للشروط المحدّثة.' },
    },
    {
        num: 2,
        title: 'وصف الخدمة',
        icon: 'construct' as const,
        content: 'كيوسكراب للخدمات والتجارة ذ.م.م هي سوق إلكتروني يربط العملاء الباحثين عن قطع غيار السيارات بالكراجات ومحلات التشليح المحلية في قطر. نحن نسهّل:',
        items: [
            'طلبات القطع والمزايدة التنافسية من كراجات متعددة',
            'معالجة الطلبات والدفع بشكل آمن',
            'فحص الجودة والتحقق من القطع',
            'توصيل قطع الغيار مباشرة إلى العملاء',
            'إدارة الضمان وحل النزاعات',
        ],
    },
    {
        num: 3,
        title: 'حسابات المستخدمين',
        icon: 'person-circle' as const,
        content: 'لاستخدام خدماتنا، يجب عليك:',
        items: [
            'أن يكون عمرك 18 عامًا على الأقل أو السن القانوني في نطاقك القضائي',
            'تقديم معلومات تسجيل دقيقة وكاملة',
            'الحفاظ على أمان وسرية بيانات حسابك',
            'تحمّل المسؤولية عن جميع الأنشطة التي تتم من خلال حسابك',
            'إبلاغنا فورًا عن أي وصول غير مصرّح به لحسابك',
        ],
        footnote: 'نحتفظ بالحق في تعليق أو إنهاء الحسابات التي تنتهك هذه الشروط أو تشارك في أنشطة احتيالية.',
    },
    {
        num: 4,
        title: 'الطلبات والمدفوعات',
        icon: 'card' as const,
        items: [
            'جميع الأسعار معروضة بالريال القطري (ر.ق)',
            'رسوم التوصيل تُحسب بناءً على المسافة إلى موقعك',
            'الطلبات ملزمة بمجرد قبولك لعرض الكراج',
            'خيارات الدفع تشمل الدفع عند الاستلام والدفع بالبطاقة',
            'رسوم المنصة معروضة بشفافية قبل تأكيد الطلب',
            'الاسترداد يخضع لسياسة الإلغاء والاسترداد لدينا',
        ],
        highlight: { type: 'default' as const, text: 'كيوسكراب يعمل كوسيط بين العملاء والكراجات. عقد البيع الفعلي يكون بينك وبين الكراج المزوّد للقطعة.' },
    },
    {
        num: 5,
        title: 'الضمانات والمرتجعات',
        icon: 'shield-checkmark' as const,
        items: [
            'ضمانات القطع مقدّمة من الكراجات الفردية عبر منصة كيوسكراب',
            'القطع الجديدة: ضمان 30 يومًا',
            'القطع المستعملة (ممتازة/جيدة): ضمان 14 يومًا',
            'القطع المستعملة (مقبولة): ضمان 7 أيام',
            'يجب رفع النزاعات خلال فترة الضمان المعمول بها',
            'كيوسكراب سيتوسط في النزاعات بين العملاء والكراجات',
        ],
    },
    {
        num: 6,
        title: 'الأنشطة المحظورة',
        icon: 'ban' as const,
        content: 'لا يجوز لك:',
        items: [
            'استخدام المنصة لأي أغراض غير قانونية أو غير مصرّح بها',
            'تقديم معلومات كاذبة أو مضللة أو احتيالية',
            'مضايقة أو إساءة أو تهديد المستخدمين الآخرين أو الكراجات أو السائقين',
            'محاولة التحايل على رسوم المنصة أو هيكل العمولة',
            'التلاعب بالأسعار أو التواطؤ في المزايدات',
            'إنشاء حسابات متعددة لاستغلال العروض الترويجية',
            'الهندسة العكسية أو محاولة استخراج الكود المصدري من تطبيقاتنا',
        ],
    },
    {
        num: 7,
        title: 'تحديد المسؤولية',
        icon: 'alert-circle' as const,
        content: 'كيوسكراب يعمل كوسيط في السوق. إلى أقصى حد يسمح به القانون القطري:',
        items: [
            'لسنا مسؤولين عن جودة أو حالة القطع المباعة من قبل الكراجات',
            'لسنا مسؤولين عن التأخيرات الناتجة عن الكراجات أو مشاكل التوصيل الخارجة عن سيطرتنا',
            'نسهّل النزاعات لكن لا نضمن حلها بين المستخدمين والكراجات',
            'مسؤوليتنا محدودة بمبلغ الرسوم المدفوعة لكيوسكراب عن المعاملة المعنية',
        ],
        highlight: { type: 'gold' as const, text: 'لا شيء في هذه الشروط يؤثر على حقوقك القانونية بموجب قانون حماية المستهلك القطري (قانون رقم 8 لسنة 2008).' },
    },
    {
        num: 8,
        title: 'الملكية الفكرية',
        icon: 'bulb' as const,
        content: 'جميع المحتويات والعلامات التجارية والشعارات والملكية الفكرية على المنصة مملوكة لشركة كيوسكراب للخدمات والتجارة ذ.م.م أو المرخّصين لها. لا يجوز لك النسخ أو التعديل أو التوزيع أو إنشاء أعمال مشتقة دون إذن كتابي صريح منا.',
    },
    {
        num: 9,
        title: 'القانون المعمول به والنزاعات',
        icon: 'scale' as const,
        content: 'تخضع شروط الخدمة هذه لقوانين دولة قطر. أي نزاعات ناشئة عن هذه الشروط أو استخدامك للمنصة تُحل في محاكم دولة قطر.\n\nللشكاوى أو الاستفسارات، يرجى التواصل معنا أولاً. سنحاول حل المشكلات من خلال عملية حل النزاعات الداخلية قبل اتخاذ أي إجراء قانوني.',
    },
];

// ============================================
// UI CHROME TRANSLATIONS
// ============================================
const CHROME = {
    en: {
        badge: 'Legal Agreement',
        summaryTitle: 'Agreement Overview',
        summaryText: 'These Terms of Service govern your use of the QScrap platform operated by QScrap Services & Trading L.L.C. By downloading or using our apps and services, you agree to be bound by these terms.',
        lastUpdated: 'Last updated: February 1, 2026',
        contactTitle: 'Contact Us',
        contactItems: [
            { icon: 'mail', label: 'General Inquiries', value: 'support@qscrap.qa' },
            { icon: 'call', label: 'Customer Service', value: '+974 5026 7974' },
            { icon: 'location', label: 'Headquarters', value: 'Doha, State of Qatar' },
            { icon: 'globe', label: 'Website', value: 'qscrap.qa' },
        ],
        companyName: 'QScrap Services & Trading L.L.C',
        companyArabic: 'كيوسكراب للخدمات والتجارة ذ.م.م',
        companyCR: 'Commercial Registration: 155892 | State of Qatar',
        footer: '© 2026 QScrap Services & Trading L.L.C. All rights reserved.',
    },
    ar: {
        badge: 'اتفاقية قانونية',
        summaryTitle: 'نظرة عامة على الاتفاقية',
        summaryText: 'تحكم شروط الخدمة هذه استخدامك لمنصة كيوسكراب التي تديرها شركة كيوسكراب للخدمات والتجارة ذ.م.م. بتحميلك أو استخدامك لتطبيقاتنا وخدماتنا، فإنك توافق على الالتزام بهذه الشروط.',
        lastUpdated: 'آخر تحديث: 1 فبراير 2026',
        contactTitle: 'تواصل معنا',
        contactItems: [
            { icon: 'mail', label: 'استفسارات عامة', value: 'support@qscrap.qa' },
            { icon: 'call', label: 'خدمة العملاء', value: '+974 5026 7974' },
            { icon: 'location', label: 'المقر الرئيسي', value: 'الدوحة، دولة قطر' },
            { icon: 'globe', label: 'الموقع الإلكتروني', value: 'qscrap.qa' },
        ],
        companyName: 'كيوسكراب للخدمات والتجارة ذ.م.م',
        companyArabic: 'QScrap Services & Trading L.L.C',
        companyCR: 'السجل التجاري: 155892 | دولة قطر',
        footer: '© 2026 كيوسكراب للخدمات والتجارة ذ.م.م. جميع الحقوق محفوظة.',
    },
};

/**
 * Terms of Service Screen
 * Premium native layout with sectioned cards, highlight boxes, and responsive design.
 * Content is hardcoded for instant load + offline support + dark mode.
 * Fully bilingual: EN/AR with RTL layout support.
 */
export default function TermsScreen() {
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
                colors={isDark ? ['#2A0A15', '#1A0610'] : [Colors.primary, '#6B1530']}
                style={styles.heroGradient}
            >
                {/* Back button row */}
                <View style={[styles.headerRow, { flexDirection: 'row' }]}>
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
                        <Ionicons name="document-text" size={14} color={Colors.secondary} />
                        <Text style={styles.heroBadgeText}>{chrome.badge}</Text>
                    </View>
                    <Text style={styles.heroTitle}>{t('settings.termsOfService')}</Text>
                    <Text style={styles.heroArabic}>{isRTL ? 'Terms of Service' : 'شروط الخدمة'}</Text>
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
                    colors={isDark ? ['#2A0A15', '#1A0610'] : [Colors.primary, '#6B1530']}
                    style={styles.summaryCard}
                >
                    <View style={styles.summaryIconWrap}>
                        <Ionicons name="clipboard" size={28} color="rgba(255,255,255,0.3)" />
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
                        <View style={[styles.sectionHeader, { flexDirection: 'row' }]}>
                            <View style={styles.sectionNumBadge}>
                                <Text style={styles.sectionNumText}>{section.num}</Text>
                            </View>
                            <View style={styles.sectionTitleWrap}>
                                <Text style={[styles.sectionTitle, { color: colors.text, textAlign }]}>{section.title}</Text>
                            </View>
                            <Ionicons name={section.icon as any} size={20} color={Colors.primary} style={{ opacity: 0.4 }} />
                        </View>

                        {/* Content */}
                        {section.content && (
                            <Text style={[styles.sectionText, { color: colors.textSecondary, textAlign }]}>
                                {section.content}
                            </Text>
                        )}

                        {/* List items */}
                        {section.items && section.items.map((item, idx) => (
                            <View key={idx} style={[styles.listItem, { flexDirection: 'row' }]}>
                                <Ionicons name="checkmark" size={16} color={Colors.secondary} style={styles.listIcon} />
                                <Text style={[styles.listText, { color: colors.textSecondary, textAlign }]}>{item}</Text>
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
                                        ? (section.highlight.type === 'gold' ? 'rgba(201,162,39,0.1)' : 'rgba(141,27,61,0.1)')
                                        : (section.highlight.type === 'gold' ? '#FFF9E6' : '#FAF0F3'),
                                    borderStartColor: section.highlight.type === 'gold' ? Colors.secondary : Colors.primary,
                                },
                            ]}>
                                <Ionicons
                                    name={section.highlight.type === 'gold' ? 'information-circle' : 'flag'}
                                    size={18}
                                    color={section.highlight.type === 'gold' ? Colors.secondary : Colors.primary}
                                    style={styles.highlightIcon}
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
                <Text style={[styles.footer, { color: colors.textMuted }]}>
                    {chrome.footer}
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

// ============================================
// CONTACT ITEM COMPONENT
// ============================================
function ContactItem({ icon, label, value, isRTL }: { icon: string; label: string; value: string; isRTL: boolean }) {
    const textAlign = isRTL ? ('right' as const) : ('left' as const);
    return (
        <View style={[styles.contactItem, { flexDirection: 'row' }]}>
            <View style={styles.contactIconWrap}>
                <Ionicons name={icon as any} size={18} color={Colors.secondary} />
            </View>
            <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                <Text style={[styles.contactLabel, { textAlign }]}>{label}</Text>
                <Text style={[styles.contactValue, { textAlign }]}>{value}</Text>
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
        backgroundColor: 'rgba(255,255,255,0.15)',
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
        backgroundColor: 'rgba(201,162,39,0.2)',
        borderWidth: 1,
        borderColor: Colors.secondary,
        borderRadius: BorderRadius.full,
        marginBottom: Spacing.md,
    },
    heroBadgeText: {
        fontSize: FontSizes.xs,
        fontWeight: '600',
        color: Colors.secondary,
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
        color: Colors.secondary,
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    heroDate: {
        fontSize: FontSizes.xs,
        color: 'rgba(255,255,255,0.7)',
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
        end: 20,
    },
    summaryTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.secondary,
        marginBottom: Spacing.sm,
    },
    summaryText: {
        fontSize: FontSizes.md,
        lineHeight: 22,
        color: 'rgba(255,255,255,0.9)',
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
        backgroundColor: Colors.primary,
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
        marginEnd: Spacing.sm,
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

    // Highlight box
    highlightBox: {
        flexDirection: 'row',
        borderStartWidth: 4,
        borderRadius: BorderRadius.sm,
        padding: Spacing.md,
        marginTop: Spacing.md,
    },
    highlightIcon: {
        marginEnd: Spacing.sm,
        marginTop: 2,
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
        color: Colors.secondary,
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
        backgroundColor: 'rgba(201,162,39,0.15)',
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
        color: Colors.secondary,
        marginBottom: Spacing.sm,
    },
    companyCR: {
        fontSize: FontSizes.sm,
        color: '#9A9A9A',
    },

    // Footer
    footer: {
        fontSize: FontSizes.sm,
        textAlign: 'center',
        marginTop: Spacing.xl,
    },
});
