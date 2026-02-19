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
        content: 'By accessing or using the QScrap mobile applications, website, or related services (collectively, the "Platform"), you agree to be legally bound by these Terms of Service. If you do not agree, you must not use the Platform.',
    },
    {
        num: 2,
        title: 'Eligibility',
        icon: 'person-circle' as const,
        content: 'You must have full legal capacity under the laws of your country of residence and be at least 18 years old to use the Platform.',
    },
    {
        num: 3,
        title: 'Nature of the Platform',
        icon: 'construct' as const,
        items: [
            'The Platform is a digital marketplace that connects users with independent garages and spare-parts suppliers.',
            'QScrap is not a seller, repair provider, or logistics company unless expressly stated.',
        ],
    },
    {
        num: 4,
        title: 'Orders and Contract Formation',
        icon: 'receipt' as const,
        items: [
            'Orders become legally binding contracts only when: A user accepts a garage\'s bid; and The user confirms the order through the Platform interface.',
            'The resulting contract is formed directly between the user and the garage, not with QScrap.',
        ],
    },
    {
        num: 5,
        title: 'Payments',
        icon: 'card' as const,
        items: [
            'The Platform is not a bank or financial institution.',
            'Payments are processed through licensed third-party payment providers authorized to operate in Qatar.',
            'QScrap does not hold customer funds except where legally permitted.',
            'All prices are stated inclusive or exclusive of applicable taxes as indicated at checkout.',
        ],
    },
    {
        num: 6,
        title: 'Warranties and Spare Parts',
        icon: 'shield-checkmark' as const,
        items: [
            'Any warranty on spare parts or services is provided solely by the supplying garage.',
            'Unless otherwise stated, the standard warranty period is seven (7) days from delivery.',
        ],
    },
    {
        num: 7,
        title: 'Prohibited Activities',
        icon: 'ban' as const,
        content: 'Users must not:',
        items: [
            'Manipulate pricing or bids',
            'Submit fraudulent orders',
            'Interfere with Platform security',
            'Engage in unlawful or unfair commercial practices',
        ],
    },
    {
        num: 8,
        title: 'Limitation of Liability',
        icon: 'alert-circle' as const,
        content: 'To the maximum extent permitted by law, QScrap shall not be liable for indirect or consequential damages arising from Platform use. Nothing in these Terms excludes liability for:',
        items: [
            'Fraud or fraudulent misrepresentation',
            'Gross negligence',
            'Death or personal injury',
            'Mandatory consumer rights under applicable law',
        ],
    },
    {
        num: 9,
        title: 'Force Majeure',
        icon: 'thunderstorm' as const,
        content: 'QScrap is not liable for failure or delay caused by events beyond reasonable control, including government actions, telecom outages, fuel shortages, cyber incidents, or extreme weather.',
    },
    {
        num: 10,
        title: 'Governing Law and Dispute Resolution',
        icon: 'scale' as const,
        items: [
            'These Terms are governed by the laws of the State of Qatar.',
            'The courts of Doha, Qatar have exclusive jurisdiction.',
            'Before court proceedings, parties agree to attempt amicable settlement through the Consumer Protection Department of the Ministry of Commerce and Industry.',
        ],
    },
    {
        num: 11,
        title: 'Commercial Disclosure',
        icon: 'business' as const,
        items: [
            'Legal Entity: QScrap Services & Trading L.L.C',
            'Commercial Registration No.: [CR NUMBER]',
            'Registered Address: Doha, Qatar',
            'Email: legal@qscrap.qa',
        ],
    },
    {
        num: 12,
        title: 'Amendments',
        icon: 'create' as const,
        content: 'QScrap may update these Terms at any time. Continued use of the Platform constitutes acceptance of the updated Terms.',
    },
    {
        num: 13,
        title: 'Contact',
        icon: 'mail' as const,
        content: 'For legal inquiries, contact: legal@qscrap.qa',
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
        content: 'باستخدامك لتطبيقات أو موقع كيوسكراب أو أي من خدماتها الإلكترونية («المنصة الإلكترونية»)، فإنك توافق على الالتزام القانوني بهذه الشروط. وإذا لم توافق، يجب عليك عدم استخدام المنصة.',
    },
    {
        num: 2,
        title: 'الأهلية القانونية',
        icon: 'person-circle' as const,
        content: 'يشترط أن تكون متمتعًا بالأهلية القانونية الكاملة وفقًا لقوانين بلد إقامتك، وألا يقل عمرك عن 18 عامًا.',
    },
    {
        num: 3,
        title: 'طبيعة المنصة',
        icon: 'construct' as const,
        items: [
            'تُعد المنصة سوقًا رقميًا يربط المستخدمين بالكراجات وموردي قطع الغيار المستقلين.',
            'ولا تُعد كيوسكراب بائعًا أو مقدم خدمة إصلاح أو نقل إلا إذا نُصّ على ذلك صراحةً.',
        ],
    },
    {
        num: 4,
        title: 'تكوين العقد والطلبات',
        icon: 'receipt' as const,
        items: [
            'تصبح الطلبات عقودًا ملزمة قانونًا فقط عند: قبول المستخدم لعرض أحد الكراجات؛ وتأكيد الطلب عبر واجهة المنصة.',
            'وينشأ العقد مباشرةً بين المستخدم والكراج دون أن تكون كيوسكراب طرفًا فيه.',
        ],
    },
    {
        num: 5,
        title: 'المدفوعات',
        icon: 'card' as const,
        items: [
            'المنصة ليست بنكًا أو مؤسسة مالية.',
            'تتم معالجة المدفوعات عبر مزودي خدمات دفع مرخصين في دولة قطر.',
            'لا تحتفظ كيوسكراب بأموال العملاء إلا في الحدود المسموح بها قانونًا.',
            'تُعرض الأسعار شاملة أو غير شاملة للضرائب حسب ما هو موضح عند الدفع.',
        ],
    },
    {
        num: 6,
        title: 'الضمان وقطع الغيار',
        icon: 'shield-checkmark' as const,
        items: [
            'يكون أي ضمان على قطع الغيار أو الخدمات مقدمًا حصريًا من الكراج المورد.',
            'وما لم يُذكر خلاف ذلك، تكون مدة الضمان القياسية سبعة (7) أيام من تاريخ التسليم.',
        ],
    },
    {
        num: 7,
        title: 'الأنشطة المحظورة',
        icon: 'ban' as const,
        content: 'يُحظر على المستخدم:',
        items: [
            'التلاعب بالأسعار أو العطاءات',
            'تقديم طلبات احتيالية',
            'تعطيل أمن المنصة',
            'ممارسة أي نشاط تجاري غير مشروع أو غير عادل',
        ],
    },
    {
        num: 8,
        title: 'تحديد المسؤولية',
        icon: 'alert-circle' as const,
        content: 'إلى أقصى حد يسمح به القانون، لا تتحمل كيوسكراب المسؤولية عن الأضرار غير المباشرة أو التبعية الناتجة عن استخدام المنصة. ولا يسري أي استبعاد للمسؤولية على:',
        items: [
            'الغش أو التدليس',
            'الإهمال الجسيم',
            'الوفاة أو الإصابة الجسدية',
            'حقوق المستهلك المقررة قانونًا',
        ],
    },
    {
        num: 9,
        title: 'القوة القاهرة',
        icon: 'thunderstorm' as const,
        content: 'لا تتحمل كيوسكراب المسؤولية عن أي تأخير أو إخفاق ناتج عن ظروف خارجة عن السيطرة، بما في ذلك القرارات الحكومية أو انقطاع الاتصالات أو نقص الوقود أو الهجمات السيبرانية أو الأحوال الجوية الشديدة.',
    },
    {
        num: 10,
        title: 'القانون الواجب التطبيق وتسوية النزاعات',
        icon: 'scale' as const,
        items: [
            'تخضع هذه الشروط لقوانين دولة قطر، وتختص محاكم الدوحة دون غيرها بنظر أي نزاع.',
            'ويتعين قبل اللجوء للقضاء محاولة التسوية الودية عبر إدارة حماية المستهلك بوزارة التجارة والصناعة.',
        ],
    },
    {
        num: 11,
        title: 'الإفصاح التجاري',
        icon: 'business' as const,
        items: [
            'الاسم القانوني: كيوسكراب للخدمات والتجارة ذ.م.م',
            'رقم السجل التجاري: [●]',
            'العنوان المسجل في قطر: الدوحة، قطر',
            'البريد الإلكتروني: legal@qscrap.qa',
        ],
    },
    {
        num: 12,
        title: 'التعديلات',
        icon: 'create' as const,
        content: 'يجوز لكيوسكراب تعديل هذه الشروط في أي وقت، ويُعد استمرارك في استخدام المنصة موافقة على التعديلات.',
    },
    {
        num: 13,
        title: 'التواصل',
        icon: 'mail' as const,
        content: 'للاستفسارات القانونية: legal@qscrap.qa',
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
            { icon: 'call', label: 'WhatsApp Support', value: '+974 5026 7974' },
            { icon: 'globe', label: 'Website', value: 'qscrap.qa' },
        ],
        companyName: 'QScrap Services & Trading L.L.C',
        companyArabic: 'كيوسكراب للخدمات والتجارة ذ.م.م',
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
            { icon: 'call', label: 'دعم واتساب', value: '+974 5026 7974' },
            { icon: 'globe', label: 'الموقع الإلكتروني', value: 'qscrap.qa' },
        ],
        companyName: 'كيوسكراب للخدمات والتجارة ذ.م.م',
        companyArabic: 'QScrap Services & Trading L.L.C',
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
