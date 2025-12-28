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
 * Privacy Policy Screen
 * Required for Google Play and Apple App Store certification.
 */
const PrivacyPolicyScreen: React.FC = () => {
    const { colors } = useTheme();
    const navigation = useNavigation();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy Policy</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Text style={[styles.lastUpdated, { color: colors.textMuted }]}>
                    Last updated: December 2024
                </Text>

                <Section title="1. Introduction" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        Welcome to QScrap ("we," "our," or "us"). This Privacy Policy explains how we collect,
                        use, disclose, and safeguard your information when you use our mobile application.
                    </Text>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        Please read this privacy policy carefully. If you do not agree with the terms of this
                        privacy policy, please do not access the application.
                    </Text>
                </Section>

                <Section title="2. Information We Collect" colors={colors}>
                    <Text style={[styles.subheading, { color: colors.text }]}>Personal Information</Text>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        We may collect personally identifiable information that you voluntarily provide, including:
                    </Text>
                    <BulletList colors={colors} items={[
                        'Name and contact information',
                        'Phone number',
                        'Delivery address',
                        'Vehicle information (make, model, year, VIN)',
                        'Payment information',
                        'Photos of auto parts you upload',
                    ]} />

                    <Text style={[styles.subheading, { color: colors.text }]}>Automatically Collected Information</Text>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        When you use our app, we automatically collect:
                    </Text>
                    <BulletList colors={colors} items={[
                        'Device type and operating system',
                        'IP address',
                        'App usage data and analytics',
                        'Location data (with your permission)',
                        'Push notification tokens',
                    ]} />
                </Section>

                <Section title="3. How We Use Your Information" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        We use the information we collect to:
                    </Text>
                    <BulletList colors={colors} items={[
                        'Process and fulfill your part requests',
                        'Connect you with verified auto parts garages',
                        'Facilitate delivery of purchased parts',
                        'Send order updates and notifications',
                        'Provide customer support',
                        'Improve our services and user experience',
                        'Detect and prevent fraud',
                    ]} />
                </Section>

                <Section title="4. Sharing Your Information" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        We may share your information with:
                    </Text>
                    <BulletList colors={colors} items={[
                        'Auto parts garages to fulfill your requests',
                        'Delivery partners for order delivery',
                        'Payment processors for transaction processing',
                        'Service providers who assist our operations',
                        'Law enforcement when required by law',
                    ]} />
                </Section>

                <Section title="5. Data Security" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        We implement appropriate technical and organizational security measures to protect your
                        personal information. However, no electronic transmission over the internet can be
                        guaranteed to be 100% secure.
                    </Text>
                </Section>

                <Section title="6. Your Rights" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        You have the right to:
                    </Text>
                    <BulletList colors={colors} items={[
                        'Access your personal data',
                        'Correct inaccurate data',
                        'Request deletion of your data',
                        'Opt out of marketing communications',
                        'Withdraw consent at any time',
                    ]} />
                </Section>

                <Section title="7. Data Retention" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        We retain your personal information for as long as necessary to provide our services
                        and fulfill the purposes outlined in this policy, unless a longer retention period is
                        required by law.
                    </Text>
                </Section>

                <Section title="8. Children's Privacy" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        Our service is not intended for individuals under 18 years of age. We do not knowingly
                        collect personal information from children.
                    </Text>
                </Section>

                <Section title="9. Changes to This Policy" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        We may update this privacy policy from time to time. We will notify you of any changes
                        by posting the new policy on this page and updating the "Last updated" date.
                    </Text>
                </Section>

                <Section title="10. Contact Us" colors={colors}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
                        If you have questions about this Privacy Policy, please contact us at:
                    </Text>
                    <Text style={[styles.contactInfo, { color: colors.primary }]}>
                        Email: privacy@qscrap.qa{'\n'}
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

export default PrivacyPolicyScreen;
