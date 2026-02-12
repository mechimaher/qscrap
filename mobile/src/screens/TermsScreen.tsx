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
// LEGAL CONTENT — Single source of truth
// ============================================
const SECTIONS = [
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

/**
 * Terms of Service Screen
 * Premium native layout with sectioned cards, highlight boxes, and responsive design.
 * Content is hardcoded for instant load + offline support + dark mode.
 */
export default function TermsScreen() {
    const navigation = useNavigation();
    const { colors, isDark } = useTheme();
    const { t, isRTL } = useTranslation();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

            {/* Premium Header */}
            <LinearGradient
                colors={isDark ? ['#2A0A15', '#1A0610'] : [Colors.primary, '#6B1530']}
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
                        <Ionicons name="document-text" size={14} color={Colors.secondary} />
                        <Text style={styles.heroBadgeText}>Legal Agreement</Text>
                    </View>
                    <Text style={styles.heroTitle}>{t('settings.termsOfService')}</Text>
                    <Text style={styles.heroArabic}>شروط الخدمة</Text>
                    <Text style={styles.heroDate}>Last updated: February 1, 2026</Text>
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
                    <Text style={styles.summaryTitle}>Agreement Overview</Text>
                    <Text style={styles.summaryText}>
                        These Terms of Service govern your use of the QScrap platform operated by QScrap Services & Trading L.L.C. By downloading or using our apps and services, you agree to be bound by these terms.
                    </Text>
                </LinearGradient>

                {/* Sections */}
                {SECTIONS.map((section) => (
                    <View key={section.num} style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                        {/* Section Header */}
                        <View style={[styles.sectionHeader, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <View style={styles.sectionNumBadge}>
                                <Text style={styles.sectionNumText}>{section.num}</Text>
                            </View>
                            <View style={styles.sectionTitleWrap}>
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
                            </View>
                            <Ionicons name={section.icon as any} size={20} color={Colors.primary} style={{ opacity: 0.4 }} />
                        </View>

                        {/* Content */}
                        {section.content && (
                            <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                                {section.content}
                            </Text>
                        )}

                        {/* List items */}
                        {section.items && section.items.map((item, idx) => (
                            <View key={idx} style={[styles.listItem, { flexDirection: rtlFlexDirection(isRTL) }]}>
                                <Ionicons name="checkmark" size={16} color={Colors.secondary} style={[styles.listIcon, isRTL && { marginLeft: Spacing.sm, marginRight: 0 }]} />
                                <Text style={[styles.listText, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>{item}</Text>
                            </View>
                        ))}

                        {/* Footnote */}
                        {section.footnote && (
                            <Text style={[styles.footnote, { color: colors.textMuted }]}>{section.footnote}</Text>
                        )}

                        {/* Highlight box */}
                        {section.highlight && (
                            <View style={[
                                styles.highlightBox,
                                {
                                    backgroundColor: isDark
                                        ? (section.highlight.type === 'gold' ? 'rgba(201,162,39,0.1)' : 'rgba(141,27,61,0.1)')
                                        : (section.highlight.type === 'gold' ? '#FFF9E6' : '#FAF0F3'),
                                    borderLeftColor: section.highlight.type === 'gold' ? Colors.secondary : Colors.primary,
                                },
                                isRTL && styles.highlightBoxRTL,
                            ]}>
                                <Ionicons
                                    name={section.highlight.type === 'gold' ? 'information-circle' : 'flag'}
                                    size={18}
                                    color={section.highlight.type === 'gold' ? Colors.secondary : Colors.primary}
                                    style={{ marginRight: Spacing.sm, marginTop: 2 }}
                                />
                                <Text style={[styles.highlightText, { color: colors.text, flex: 1 }]}>
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
                    <Text style={styles.contactTitle}>Contact Us</Text>
                    <View style={styles.contactGrid}>
                        <ContactItem icon="mail" label="General Inquiries" value="support@qscrap.qa" isRTL={isRTL} />
                        <ContactItem icon="call" label="Customer Service" value="+974 5026 7974" isRTL={isRTL} />
                        <ContactItem icon="location" label="Headquarters" value="Doha, State of Qatar" isRTL={isRTL} />
                        <ContactItem icon="globe" label="Website" value="qscrap.qa" isRTL={isRTL} />
                    </View>
                    <View style={styles.contactLegal}>
                        <Text style={styles.companyName}>QScrap Services & Trading L.L.C</Text>
                        <Text style={styles.companyArabic}>كيوسكراب للخدمات والتجارة ذ.م.م</Text>
                        <Text style={styles.companyCR}>Commercial Registration: 155892 | State of Qatar</Text>
                    </View>
                </LinearGradient>

                {/* Footer */}
                <Text style={[styles.footer, { color: colors.textMuted }]}>
                    © 2026 QScrap Services & Trading L.L.C. All rights reserved.
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
                <Ionicons name={icon as any} size={18} color={Colors.secondary} />
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
        right: 20,
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
