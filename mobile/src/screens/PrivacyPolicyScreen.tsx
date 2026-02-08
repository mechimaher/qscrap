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
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';
import { Spacing, BorderRadius, FontSize } from '../constants';

/**
 * Privacy Policy Screen
 * Required for Google Play and Apple App Store certification.
 */
const PrivacyPolicyScreen: React.FC = () => {
    const { colors } = useTheme();
    const navigation = useNavigation();
    const { t, isRTL } = useTranslation();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('privacy.title')}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Text style={[styles.lastUpdated, { color: colors.textMuted, textAlign: rtlTextAlign(isRTL) }]}>
                    {t('privacy.lastUpdated', { date: 'January 31, 2026' })}
                </Text>

                <Section title={t('privacy.section1Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('privacy.section1Content1')}
                    </Text>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('privacy.section1Content2')}
                    </Text>
                </Section>

                <Section title={t('privacy.section2Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.subheading, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{t('privacy.personalInfo')}</Text>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('privacy.section2Content1')}
                    </Text>
                    <BulletList colors={colors} isRTL={isRTL} items={[
                        t('privacy.section2Item1'),
                        t('privacy.section2Item2'),
                        t('privacy.section2Item3'),
                        t('privacy.section2Item4'),
                        t('privacy.section2Item5'),
                        t('privacy.section2Item6'),
                    ]} />

                    <Text style={[styles.subheading, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{t('privacy.autoCollectedInfo')}</Text>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('privacy.section2Content2')}
                    </Text>
                    <BulletList colors={colors} isRTL={isRTL} items={[
                        t('privacy.section2Item7'),
                        t('privacy.section2Item8'),
                        t('privacy.section2Item9'),
                        t('privacy.section2Item10'),
                        t('privacy.section2Item11'),
                    ]} />
                </Section>

                <Section title={t('privacy.section3Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('privacy.section3Content')}
                    </Text>
                    <BulletList colors={colors} isRTL={isRTL} items={[
                        t('privacy.section3Item1'),
                        t('privacy.section3Item2'),
                        t('privacy.section3Item3'),
                        t('privacy.section3Item4'),
                        t('privacy.section3Item5'),
                        t('privacy.section3Item6'),
                        t('privacy.section3Item7'),
                    ]} />
                </Section>

                <Section title={t('privacy.section4Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('privacy.section4Content')}
                    </Text>
                    <BulletList colors={colors} isRTL={isRTL} items={[
                        t('privacy.section4Item1'),
                        t('privacy.section4Item2'),
                        t('privacy.section4Item3'),
                        t('privacy.section4Item4'),
                        t('privacy.section4Item5'),
                    ]} />
                </Section>

                <Section title={t('privacy.section5Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('privacy.section5Content')}
                    </Text>
                </Section>

                <Section title={t('privacy.section6Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('privacy.section6Content')}
                    </Text>
                    <BulletList colors={colors} isRTL={isRTL} items={[
                        t('privacy.section6Item1'),
                        t('privacy.section6Item2'),
                        t('privacy.section6Item3'),
                        t('privacy.section6Item4'),
                        t('privacy.section6Item5'),
                    ]} />
                </Section>

                <Section title={t('privacy.section7Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('privacy.section7Content')}
                    </Text>
                </Section>

                <Section title={t('privacy.section8Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('privacy.section8Content')}
                    </Text>
                </Section>

                <Section title={t('privacy.section9Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('privacy.section9Content')}
                    </Text>
                </Section>

                <Section title={t('privacy.section10Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('privacy.section10Content')}
                    </Text>
                    <Text style={[styles.contactInfo, { color: colors.primary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('privacy.email')}: privacy@qscrap.qa{'\n'}
                        {t('privacy.phone')}: +974 5026 7974{'\n'}
                        {t('privacy.address')}: Industrial Area, St 10, P.O. Box 32544, Doha, Qatar
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
    isRTL: boolean;
}

const Section: React.FC<SectionProps> = ({ title, children, colors, isRTL }) => (
    <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{title}</Text>
        {children}
    </View>
);

interface BulletListProps {
    items: string[];
    colors: any;
    isRTL: boolean;
}

const BulletList: React.FC<BulletListProps> = ({ items, colors, isRTL }) => (
    <View style={[styles.bulletList, isRTL ? { marginRight: Spacing.sm, marginLeft: 0 } : { marginLeft: Spacing.sm, marginRight: 0 }]}>
        {items.map((item, index) => (
            <View key={index} style={[styles.bulletItem, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <Text style={[styles.bullet, { color: colors.primary }, isRTL ? { marginLeft: Spacing.sm, marginRight: 0 } : { marginRight: Spacing.sm, marginLeft: 0 }]}>•</Text>
                <Text style={[styles.bulletText, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>{item}</Text>
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
