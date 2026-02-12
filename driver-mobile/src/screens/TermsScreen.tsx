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
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../i18n';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

const { width } = Dimensions.get('window');

interface Section {
    num: number;
    title: string;
    icon: string;
    content?: string;
    items?: string[];
    footnote?: string;
    highlight?: { type: 'gold' | 'maroon'; text: string };
}

const SECTIONS: Section[] = [
    {
        num: 1,
        title: 'Acceptance of Terms',
        icon: 'checkmark-circle',
        content: 'By downloading, installing, or using the QScrap Customer App or QScrap Driver App, you agree to be bound by these Terms of Service. If you do not agree, you must not use our Apps or services.',
        items: [
            'Users must be at least 18 years old',
            'Users must provide accurate registration information',
            'Users are responsible for maintaining account security',
        ],
    },
    {
        num: 2,
        title: 'Description of Services',
        icon: 'cube',
        content: 'QScrap operates a marketplace connecting customers seeking automotive spare parts with garages offering those parts. Our platform provides:',
        items: [
            'Part Request System: Submit requests with VIN and photos',
            'Bidding Marketplace: Receive competitive quotes from garages',
            'Negotiation Engine: Counter-offer system for fair pricing',
            'Warranty Protection: Standardized warranty on all parts',
            'Delivery Service: QScrap-managed delivery with real-time tracking',
        ],
    },
    {
        num: 3,
        title: 'User Accounts',
        icon: 'person',
        content: 'To access our services, you must create an account. You agree to:',
        items: [
            'Provide accurate, current, and complete registration information',
            'Maintain and update your information to keep it accurate',
            'Keep your password and OTP secure and confidential',
            'Accept responsibility for all activities under your account',
            'Notify us immediately of any unauthorized access',
        ],
        highlight: { type: 'maroon', text: 'Each user may maintain only one active account. Multiple accounts may result in suspension.' },
    },
    {
        num: 4,
        title: 'Orders & Payments',
        icon: 'card',
        content: 'When you accept a bid, you enter into a binding agreement. Payment terms:',
        items: [
            'Cash on Delivery (COD): Payment upon receiving the part',
            'Card Payment: Secure online payment through Stripe',
            'All prices are in Qatari Riyals (QAR)',
            'Delivery fees are calculated based on distance and zone',
            'QScrap acts as an intermediary and does not set part prices',
        ],
    },
    {
        num: 5,
        title: 'Cancellations & Refunds',
        icon: 'return-down-back',
        content: 'Our cancellation and refund policy aims to be fair to all parties:',
        items: [
            'Customers may cancel within 30 seconds without penalty',
            'After acceptance, cancellation fees may apply',
            'Refunds for defective parts are processed within 7-14 business days',
            'Warranty claims must be submitted within the warranty period',
            'Garages are responsible for the quality and accuracy of parts',
        ],
    },
    {
        num: 6,
        title: 'Delivery Terms',
        icon: 'car',
        content: 'QScrap provides delivery services through our network of verified drivers:',
        items: [
            'Delivery times are estimates and not guaranteed',
            'Recipients must be available to receive deliveries',
            'Proof of delivery (photo and/or signature) is required',
            'Failed delivery attempts may incur additional charges',
            'Customers must inspect parts upon delivery and report issues',
        ],
    },
    {
        num: 7,
        title: 'Prohibited Activities',
        icon: 'close-circle',
        items: [
            'Providing false or misleading information',
            'Using the platform for illegal purposes',
            'Attempting to bypass platform fees or processes',
            'Harassment or abuse of other users, drivers, or staff',
            'Manipulating the bidding or review system',
            'Using automated systems or bots to interact with the platform',
        ],
    },
    {
        num: 8,
        title: 'Intellectual Property',
        icon: 'shield-checkmark',
        content: 'All content, design, logos, and technology on QScrap Apps are owned by QScrap Services & Trading L.L.C or its licensors. You may not copy, modify, or distribute any part of our platform without written consent.',
    },
    {
        num: 9,
        title: 'Governing Law',
        icon: 'scale',
        content: 'These Terms are governed by the laws of the State of Qatar. Any disputes shall be subject to the exclusive jurisdiction of Qatar courts. By using QScrap, you consent to the jurisdiction of Qatar courts for any legal matters arising from your use.',
    },
];

export default function TermsScreen() {
    const navigation = useNavigation();
    const { colors, isDarkMode } = useTheme();
    const { t } = useI18n();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

            {/* Premium Header */}
            <LinearGradient
                colors={isDarkMode ? ['#1A0010', '#0D1117'] : [Colors.primary, '#6B1530']}
                style={styles.heroGradient}
            >
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <Ionicons name="arrow-back" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                </View>

                <View style={styles.heroContent}>
                    <View style={styles.heroBadge}>
                        <Ionicons name="document-text" size={14} color={Colors.secondary} />
                        <Text style={styles.heroBadgeText}>Legal Agreement</Text>
                    </View>
                    <Text style={styles.heroTitle}>{t('terms_conditions')}</Text>
                    <Text style={styles.heroArabic}>شروط الخدمة</Text>
                    <Text style={styles.heroDate}>Last updated: January 31, 2026</Text>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Summary Card */}
                <LinearGradient
                    colors={isDarkMode ? ['#1A0010', '#0D1117'] : [Colors.primary, '#6B1530']}
                    style={styles.summaryCard}
                >
                    <View style={styles.summaryIconWrap}>
                        <Ionicons name="document-text" size={28} color="rgba(255,255,255,0.15)" />
                    </View>
                    <Text style={styles.summaryTitle}>Quick Summary</Text>
                    <Text style={styles.summaryText}>
                        QScrap connects customers with automotive spare part garages in Qatar. By using our apps, you agree to fair use, transparent pricing, and secure transactions under Qatar law.
                    </Text>
                </LinearGradient>

                {/* Sections */}
                {SECTIONS.map((section) => (
                    <View key={section.num} style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionNumBadge}>
                                <Text style={styles.sectionNumText}>{section.num}</Text>
                            </View>
                            <View style={styles.sectionTitleWrap}>
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
                            </View>
                            <Ionicons name={section.icon as any} size={20} color={Colors.primary} style={{ opacity: 0.35 }} />
                        </View>

                        {section.content && (
                            <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                                {section.content}
                            </Text>
                        )}

                        {section.items && section.items.map((item, idx) => (
                            <View key={idx} style={styles.listItem}>
                                <Ionicons name="checkmark" size={16} color={Colors.secondary} style={styles.listIcon} />
                                <Text style={[styles.listText, { color: colors.textSecondary }]}>{item}</Text>
                            </View>
                        ))}

                        {section.footnote && (
                            <Text style={[styles.footnote, { color: colors.textMuted }]}>{section.footnote}</Text>
                        )}

                        {section.highlight && (
                            <View style={[
                                styles.highlightBox,
                                {
                                    backgroundColor: isDarkMode
                                        ? (section.highlight.type === 'gold' ? 'rgba(201,162,39,0.1)' : 'rgba(141,27,61,0.12)')
                                        : (section.highlight.type === 'gold' ? '#FFF9E6' : '#FDF2F4'),
                                    borderLeftColor: section.highlight.type === 'gold' ? Colors.secondary : Colors.primary,
                                },
                            ]}>
                                <Ionicons
                                    name="information-circle"
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
                    colors={isDarkMode ? ['#141416', '#1C1C1F'] : ['#1A1A1A', '#2A2A2A']}
                    style={styles.contactCard}
                >
                    <Text style={styles.contactTitle}>Contact Us</Text>
                    <View style={styles.contactGrid}>
                        <ContactItem icon="mail" label="General Support" value="support@qscrap.qa" />
                        <ContactItem icon="call" label="Phone" value="+974 5026 7974" />
                        <ContactItem icon="location" label="Address" value="Industrial Area, Street 10, Doha, Qatar" />
                    </View>
                    <View style={styles.contactLegal}>
                        <Text style={styles.companyName}>QScrap Services & Trading L.L.C</Text>
                        <Text style={styles.companyArabic}>كيوسكراب للخدمات والتجارة ذ.م.م</Text>
                        <Text style={styles.companyCR}>Commercial Registration: 155892 | State of Qatar</Text>
                    </View>
                </LinearGradient>

                <Text style={[styles.footerText, { color: colors.textMuted }]}>
                    © 2026 QScrap Services & Trading L.L.C. All rights reserved.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

function ContactItem({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
        <View style={styles.contactItem}>
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

const styles = StyleSheet.create({
    container: { flex: 1 },
    heroGradient: { paddingBottom: Spacing.xl, paddingHorizontal: Spacing.lg },
    headerRow: { flexDirection: 'row', alignItems: 'center', paddingTop: Spacing.sm, marginBottom: Spacing.md },
    backButton: {
        width: 40, height: 40, borderRadius: BorderRadius.xl,
        backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center',
    },
    heroContent: { alignItems: 'center' },
    heroBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 16, paddingVertical: 6,
        backgroundColor: 'rgba(201,162,39,0.15)', borderWidth: 1,
        borderColor: 'rgba(201,162,39,0.4)', borderRadius: BorderRadius.full,
        marginBottom: Spacing.md,
    },
    heroBadgeText: { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.secondary, letterSpacing: 0.5 },
    heroTitle: { fontSize: width < 380 ? 26 : 32, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: Spacing.xs },
    heroArabic: { fontSize: width < 380 ? 18 : 22, fontWeight: '600', color: Colors.secondary, textAlign: 'center', marginBottom: Spacing.sm },
    heroDate: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.65)' },
    scrollView: { flex: 1 },
    scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
    summaryCard: { borderRadius: BorderRadius.xl, padding: Spacing.xl, marginBottom: Spacing.lg, overflow: 'hidden' },
    summaryIconWrap: { position: 'absolute', top: 16, right: 20 },
    summaryTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.secondary, marginBottom: Spacing.sm },
    summaryText: { fontSize: FontSizes.md, lineHeight: 22, color: 'rgba(255,255,255,0.88)' },
    sectionCard: { borderRadius: BorderRadius.xl, padding: Spacing.xl, marginBottom: Spacing.md, borderWidth: 1, ...Shadows.sm },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.sm },
    sectionNumBadge: { width: 36, height: 36, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
    sectionNumText: { fontSize: FontSizes.md, fontWeight: '700', color: '#fff' },
    sectionTitleWrap: { flex: 1 },
    sectionTitle: { fontSize: width < 380 ? FontSizes.lg : 18, fontWeight: '700' },
    sectionText: { fontSize: FontSizes.md, lineHeight: 24, marginBottom: Spacing.sm },
    listItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.sm },
    listIcon: { marginRight: Spacing.sm, marginTop: 3 },
    listText: { flex: 1, fontSize: FontSizes.md, lineHeight: 22 },
    footnote: { fontSize: FontSizes.sm, fontStyle: 'italic', marginTop: Spacing.sm, lineHeight: 20 },
    highlightBox: { flexDirection: 'row', borderLeftWidth: 4, borderRadius: BorderRadius.sm, padding: Spacing.md, marginTop: Spacing.md },
    highlightText: { fontSize: FontSizes.sm, lineHeight: 20, fontWeight: '500' },
    contactCard: { borderRadius: BorderRadius.xl, padding: Spacing.xl, marginTop: Spacing.lg },
    contactTitle: { fontSize: 20, fontWeight: '700', color: Colors.secondary, marginBottom: Spacing.lg },
    contactGrid: { gap: Spacing.md },
    contactItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    contactIconWrap: { width: 40, height: 40, borderRadius: BorderRadius.md, backgroundColor: 'rgba(201,162,39,0.12)', justifyContent: 'center', alignItems: 'center' },
    contactLabel: { fontSize: FontSizes.xs, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    contactValue: { fontSize: FontSizes.md, color: '#fff' },
    contactLegal: { marginTop: Spacing.lg, paddingTop: Spacing.lg, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
    companyName: { fontSize: FontSizes.lg, fontWeight: '600', color: '#fff', marginBottom: 4 },
    companyArabic: { fontSize: FontSizes.md, color: Colors.secondary, marginBottom: Spacing.sm },
    companyCR: { fontSize: FontSizes.sm, color: '#9A9A9A' },
    footerText: { fontSize: FontSizes.sm, textAlign: 'center', marginTop: Spacing.xl },
});
