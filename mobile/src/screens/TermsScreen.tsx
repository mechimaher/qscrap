import React from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts';
import { Spacing, BorderRadius, FontSize } from '../constants';

/**
 * Terms of Service Screen
 * Required for Google Play and Apple App Store certification.
 */
const TermsScreen: React.FC = () => {
    const { colors } = useTheme();
    const navigation = useNavigation();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Terms of Service</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Text style={[styles.lastUpdated, { color: colors.textMuted }]}>
                    Last updated: December 2024
                </Text>

                <Section title="1. Acceptance of Terms" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        By accessing and using the QScrap mobile application ("App"), you agree to be bound
                        by these Terms of Service ("Terms"). If you do not agree to these Terms, please do
                        not use the App.
                    </Text>
                </Section>

                <Section title="2. Description of Service" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        QScrap is a marketplace platform that connects customers seeking auto parts with
                        verified garages and suppliers in Qatar. We facilitate the search, bidding, purchase,
                        and delivery of both new and used auto parts.
                    </Text>
                </Section>

                <Section title="3. User Accounts" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        To use our services, you must:
                    </Text>
                    <BulletList colors={colors} items={[
                        'Be at least 18 years of age',
                        'Provide accurate and complete registration information',
                        'Maintain the security of your account credentials',
                        'Notify us immediately of any unauthorized access',
                        'Accept responsibility for all activities under your account',
                    ]} />
                </Section>

                <Section title="4. Part Requests & Bids" colors={colors}>
                    <Text style={[styles.subheading, { color: colors.text }]}>Submitting Requests</Text>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        When you submit a part request, you agree to provide accurate vehicle and part
                        information. Inaccurate information may result in unsuitable bids or order issues.
                    </Text>

                    <Text style={[styles.subheading, { color: colors.text }]}>Accepting Bids</Text>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        Accepting a bid creates a binding agreement between you and the garage. You commit
                        to purchasing the part at the agreed price plus applicable delivery fees.
                    </Text>
                </Section>

                <Section title="5. Payments" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        Payment terms:
                    </Text>
                    <BulletList colors={colors} items={[
                        'All prices are in Qatari Riyals (QAR)',
                        'Payment is due upon order confirmation',
                        'We accept cash on delivery and card payments',
                        'Prices include VAT where applicable',
                        'Delivery fees are calculated based on distance',
                    ]} />
                </Section>

                <Section title="6. Delivery" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        Delivery is provided through our logistics partners. Delivery times are estimates
                        and not guaranteed. You must be available to receive the delivery at the specified
                        address. Failed delivery attempts may incur additional charges.
                    </Text>
                </Section>

                <Section title="7. Returns & Refunds" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        Return policies vary by garage. Generally:
                    </Text>
                    <BulletList colors={colors} items={[
                        'Parts must be unused and in original condition',
                        'Returns must be initiated within 7 days of delivery',
                        'Warranty claims are handled by the respective garage',
                        'Refunds are processed within 5-10 business days',
                        'Delivery fees are non-refundable for buyer remorse returns',
                    ]} />
                </Section>

                <Section title="8. Prohibited Activities" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        You agree not to:
                    </Text>
                    <BulletList colors={colors} items={[
                        'Provide false or misleading information',
                        'Circumvent the platform for direct transactions',
                        'Harass or abuse garages, drivers, or staff',
                        'Use the app for any illegal purposes',
                        'Attempt to manipulate reviews or ratings',
                        'Violate any applicable laws or regulations',
                    ]} />
                </Section>

                <Section title="9. Limitation of Liability" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        QScrap acts as a marketplace facilitator. We are not responsible for:
                    </Text>
                    <BulletList colors={colors} items={[
                        'The quality or condition of parts sold by garages',
                        'Accuracy of part descriptions provided by garages',
                        'Disputes between users and garages',
                        'Delays or issues with third-party delivery',
                        'Indirect or consequential damages',
                    ]} />
                </Section>

                <Section title="10. Dispute Resolution" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        If you have a dispute regarding an order, you may file a dispute through the app.
                        We will mediate between parties in good faith. Unresolved disputes may be subject
                        to the laws of the State of Qatar.
                    </Text>
                </Section>

                <Section title="11. Intellectual Property" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        All content, trademarks, and intellectual property in the App are owned by QScrap
                        or its licensors. You may not copy, modify, or distribute any content without
                        prior written permission.
                    </Text>
                </Section>

                <Section title="12. Termination" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        We reserve the right to suspend or terminate your account at our discretion for
                        violations of these Terms or for any other reason. You may delete your account
                        at any time through the app settings.
                    </Text>
                </Section>

                <Section title="13. Changes to Terms" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        We may modify these Terms at any time. Continued use of the App after changes
                        constitutes acceptance of the new Terms. We will notify users of significant changes.
                    </Text>
                </Section>

                <Section title="14. Contact" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        For questions about these Terms, contact us at:
                    </Text>
                    <Text style={[styles.contactInfo, { color: colors.primary }]}>
                        Email: legal@qscrap.qa{'\n'}
                        Phone: +974 XXXX XXXX{'\n'}
                        Address: Doha, Qatar
                    </Text>
                </Section>

                <View style={styles.bottomPadding} />
            </ScrollView>
        </SafeAreaView>
    );
};

// Helper Components
interface SectionProps {
    title: string;
    children: React.ReactNode;
    colors: any;
}

const Section: React.FC<SectionProps> = ({ title, children, colors }) => (
    <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        {children}
    </View>
);

interface BulletListProps {
    items: string[];
    colors: any;
}

const BulletList: React.FC<BulletListProps> = ({ items, colors }) => (
    <View style={styles.bulletList}>
        {items.map((item, index) => (
            <View key={index} style={styles.bulletItem}>
                <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{item}</Text>
            </View>
        ))}
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
        borderBottomWidth: 1,
    },
    backBtn: {
        padding: Spacing.sm,
    },
    headerTitle: {
        fontSize: FontSize.lg,
        fontWeight: '700',
    },
    content: {
        padding: Spacing.lg,
    },
    lastUpdated: {
        fontSize: FontSize.sm,
        fontStyle: 'italic',
        marginBottom: Spacing.xl,
    },
    section: {
        marginBottom: Spacing.xl,
    },
    sectionTitle: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        marginBottom: Spacing.md,
    },
    subheading: {
        fontSize: FontSize.md,
        fontWeight: '600',
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
    },
    paragraph: {
        fontSize: FontSize.md,
        lineHeight: 24,
        marginBottom: Spacing.md,
    },
    bulletList: {
        marginLeft: Spacing.sm,
    },
    bulletItem: {
        flexDirection: 'row',
        marginBottom: Spacing.xs,
    },
    bullet: {
        fontSize: FontSize.md,
        marginRight: Spacing.sm,
    },
    bulletText: {
        fontSize: FontSize.md,
        flex: 1,
        lineHeight: 22,
    },
    contactInfo: {
        fontSize: FontSize.md,
        lineHeight: 24,
    },
    bottomPadding: {
        height: 50,
    },
});

export default TermsScreen;
