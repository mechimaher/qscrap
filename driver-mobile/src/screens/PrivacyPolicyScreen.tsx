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
    subsections?: { title: string; items?: string[]; content?: string }[];
    highlight?: { type: 'gold' | 'default'; text: string };
}

const SECTIONS: Section[] = [
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
        footnote: 'By using our Apps or services, you consent to the collection, use, and disclosure of your information as described in this Privacy Policy.',
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
                    'Driver Information: Qatar ID, driver\'s license, vehicle registration',
                ],
            },
            {
                title: '2.2 Information Collected Automatically',
                items: [
                    'Device Information: Device type, OS version, unique identifiers, push tokens',
                    'Location Data: GPS coordinates for delivery zones, real-time tracking',
                    'Usage Data: App interactions, features used, session duration',
                    'Photos & Media: Images uploaded for part requests and proof of delivery',
                ],
            },
        ],
        highlight: { type: 'default', text: 'Our Apps require location access to function properly. You may disable it in settings, but this will impact functionality.' },
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
                    'Calculating delivery fees based on your location',
                    'Providing real-time order tracking and notifications',
                    'Processing payments and payouts',
                ],
            },
            {
                title: '3.2 Communication',
                items: [
                    'Sending order confirmations, updates, and delivery notifications',
                    'Customer support and dispute resolution',
                    'Important service announcements and policy updates',
                ],
            },
            {
                title: '3.3 Improvement & Safety',
                items: [
                    'Analyzing usage patterns to improve our services',
                    'Fraud detection and prevention',
                    'Ensuring platform safety and security',
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
            'Incident Response: Data breach notification within 72 hours',
        ],
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
        ],
        footnote: 'When data is no longer needed, we securely delete or anonymize it.',
    },
    {
        num: 7,
        title: 'Your Rights',
        icon: 'hand-left',
        content: 'Under Qatar\'s data protection laws, you have the right to:',
        items: [
            'Access: Request a copy of your personal data',
            'Correction: Update or correct inaccurate information',
            'Deletion: Request deletion of your account and data',
            'Portability: Request an export of your data',
            'Opt-out: Unsubscribe from marketing communications',
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
            'Data required by law will be retained per Qatar Commercial Law',
        ],
    },
    {
        num: 9,
        title: 'Children\'s Privacy',
        icon: 'people',
        content: 'Our Apps are not intended for users under 18 years of age. We do not knowingly collect personal information from children under 18.',
    },
    {
        num: 10,
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
        num: 11,
        title: 'Governing Law',
        icon: 'scale',
        content: 'This Privacy Policy is governed by the laws of the State of Qatar, including Law No. 13 of 2016 on Personal Data Protection. Any disputes shall be subject to the exclusive jurisdiction of Qatar courts.',
    },
];

export default function PrivacyPolicyScreen() {
    const navigation = useNavigation();
    const { colors, isDarkMode } = useTheme();
    const { t } = useI18n();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

            {/* Premium Header */}
            <LinearGradient
                colors={isDarkMode ? ['#0A1628', '#0D1117'] : ['#1E3A5F', '#0F1F33']}
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
                        <Ionicons name="shield-checkmark" size={14} color="#4ADE80" />
                        <Text style={styles.heroBadgeText}>Your Data is Protected</Text>
                    </View>
                    <Text style={styles.heroTitle}>{t('privacy_policy')}</Text>
                    <Text style={styles.heroArabic}>سياسة الخصوصية</Text>
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
                    colors={isDarkMode ? ['#0A1628', '#0D1117'] : ['#1E3A5F', '#0F1F33']}
                    style={styles.summaryCard}
                >
                    <View style={styles.summaryIconWrap}>
                        <Ionicons name="lock-closed" size={28} color="rgba(255,255,255,0.2)" />
                    </View>
                    <Text style={styles.summaryTitle}>Your Privacy is Our Priority</Text>
                    <Text style={styles.summaryText}>
                        This Privacy Policy explains how QScrap Services & Trading L.L.C collects, uses, shares, and protects your personal information. We are committed to transparency and compliance with Qatar's data protection laws.
                    </Text>
                </LinearGradient>

                {/* Sections */}
                {SECTIONS.map((section) => (
                    <View key={section.num} style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                        <View style={styles.sectionHeader}>
                            <View style={[styles.sectionNumBadge, { backgroundColor: '#1E3A5F' }]}>
                                <Text style={styles.sectionNumText}>{section.num}</Text>
                            </View>
                            <View style={styles.sectionTitleWrap}>
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
                            </View>
                            <Ionicons name={section.icon as any} size={20} color="#1E3A5F" style={{ opacity: 0.35 }} />
                        </View>

                        {section.content && (
                            <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                                {section.content}
                            </Text>
                        )}

                        {section.items && section.items.map((item, idx) => (
                            <View key={idx} style={styles.listItem}>
                                <Ionicons name="checkmark" size={16} color="#1E3A5F" style={styles.listIcon} />
                                <Text style={[styles.listText, { color: colors.textSecondary }]}>{item}</Text>
                            </View>
                        ))}

                        {/* Subsections */}
                        {section.subsections && section.subsections.map((sub, idx) => (
                            <View key={idx} style={styles.subsection}>
                                <View style={styles.subsectionHeader}>
                                    <View style={styles.subsectionBar} />
                                    <Text style={[styles.subsectionTitle, { color: isDarkMode ? '#6BA3D6' : '#1E3A5F' }]}>{sub.title}</Text>
                                </View>
                                {sub.content && (
                                    <Text style={[styles.sectionText, { color: colors.textSecondary }]}>{sub.content}</Text>
                                )}
                                {sub.items && sub.items.map((item, i) => (
                                    <View key={i} style={styles.listItem}>
                                        <Ionicons name="checkmark" size={16} color={Colors.secondary} style={styles.listIcon} />
                                        <Text style={[styles.listText, { color: colors.textSecondary }]}>{item}</Text>
                                    </View>
                                ))}
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
                                        ? (section.highlight.type === 'gold' ? 'rgba(201,162,39,0.1)' : 'rgba(30,58,95,0.15)')
                                        : (section.highlight.type === 'gold' ? '#FFF9E6' : '#EFF6FF'),
                                    borderLeftColor: section.highlight.type === 'gold' ? Colors.secondary : '#1E3A5F',
                                },
                            ]}>
                                <Ionicons
                                    name={section.highlight.type === 'gold' ? 'lock-closed' : 'information-circle'}
                                    size={18}
                                    color={section.highlight.type === 'gold' ? Colors.secondary : '#1E3A5F'}
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
                        <ContactItem icon="shield" label="Data Protection Officer" value="privacy@qscrap.qa" />
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
                <Text style={[styles.footerCompliance, { color: colors.textMuted }]}>
                    Compliant with Google Play Policies and Qatar's Personal Data Protection Law.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

function ContactItem({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
        <View style={styles.contactItem}>
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
        backgroundColor: 'rgba(74,222,128,0.15)', borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.4)', borderRadius: BorderRadius.full,
        marginBottom: Spacing.md,
    },
    heroBadgeText: { fontSize: FontSizes.xs, fontWeight: '600', color: '#4ADE80', letterSpacing: 0.5 },
    heroTitle: { fontSize: width < 380 ? 26 : 32, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: Spacing.xs },
    heroArabic: { fontSize: width < 380 ? 18 : 22, fontWeight: '600', color: '#4ADE80', textAlign: 'center', marginBottom: Spacing.sm },
    heroDate: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.65)' },
    scrollView: { flex: 1 },
    scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
    summaryCard: { borderRadius: BorderRadius.xl, padding: Spacing.xl, marginBottom: Spacing.lg, overflow: 'hidden' },
    summaryIconWrap: { position: 'absolute', top: 16, right: 20 },
    summaryTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: '#4ADE80', marginBottom: Spacing.sm },
    summaryText: { fontSize: FontSizes.md, lineHeight: 22, color: 'rgba(255,255,255,0.88)' },
    sectionCard: { borderRadius: BorderRadius.xl, padding: Spacing.xl, marginBottom: Spacing.md, borderWidth: 1, ...Shadows.sm },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.sm },
    sectionNumBadge: { width: 36, height: 36, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
    sectionNumText: { fontSize: FontSizes.md, fontWeight: '700', color: '#fff' },
    sectionTitleWrap: { flex: 1 },
    sectionTitle: { fontSize: width < 380 ? FontSizes.lg : 18, fontWeight: '700' },
    sectionText: { fontSize: FontSizes.md, lineHeight: 24, marginBottom: Spacing.sm },
    listItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.sm },
    listIcon: { marginRight: Spacing.sm, marginTop: 3 },
    listText: { flex: 1, fontSize: FontSizes.md, lineHeight: 22 },
    footnote: { fontSize: FontSizes.sm, fontStyle: 'italic', marginTop: Spacing.sm, lineHeight: 20 },
    subsection: { marginTop: Spacing.md },
    subsectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    subsectionBar: { width: 4, height: 20, backgroundColor: Colors.secondary, borderRadius: 2 },
    subsectionTitle: { fontSize: FontSizes.md, fontWeight: '600', flex: 1 },
    highlightBox: { flexDirection: 'row', borderLeftWidth: 4, borderRadius: BorderRadius.sm, padding: Spacing.md, marginTop: Spacing.md },
    highlightText: { fontSize: FontSizes.sm, lineHeight: 20, fontWeight: '500' },
    contactCard: { borderRadius: BorderRadius.xl, padding: Spacing.xl, marginTop: Spacing.lg },
    contactTitle: { fontSize: 20, fontWeight: '700', color: '#4ADE80', marginBottom: Spacing.lg },
    contactGrid: { gap: Spacing.md },
    contactItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    contactIconWrap: { width: 40, height: 40, borderRadius: BorderRadius.md, backgroundColor: 'rgba(74,222,128,0.12)', justifyContent: 'center', alignItems: 'center' },
    contactLabel: { fontSize: FontSizes.xs, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    contactValue: { fontSize: FontSizes.md, color: '#fff' },
    contactLegal: { marginTop: Spacing.lg, paddingTop: Spacing.lg, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
    companyName: { fontSize: FontSizes.lg, fontWeight: '600', color: '#fff', marginBottom: 4 },
    companyArabic: { fontSize: FontSizes.md, color: '#4ADE80', marginBottom: Spacing.sm },
    companyCR: { fontSize: FontSizes.sm, color: '#9A9A9A' },
    footerText: { fontSize: FontSizes.sm, textAlign: 'center', marginTop: Spacing.xl },
    footerCompliance: { fontSize: FontSizes.xs, textAlign: 'center', marginTop: Spacing.xs, lineHeight: 18 },
});
