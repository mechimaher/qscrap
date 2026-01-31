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
 * Terms of Service Screen
 * Required for Google Play and Apple App Store certification.
 */
const TermsScreen: React.FC = () => {
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
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('terms.title')}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Text style={[styles.lastUpdated, { color: colors.textMuted, textAlign: rtlTextAlign(isRTL) }]}>
                    {t('terms.lastUpdated', { date: 'January 31, 2026' })}
                </Text>

                <Section title={t('terms.section1Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('terms.section1Content')}
                    </Text>
                </Section>

                <Section title={t('terms.section2Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('terms.section2Content')}
                    </Text>
                </Section>

                <Section title={t('terms.section3Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('terms.section3Content')}
                    </Text>
                    <BulletList colors={colors} isRTL={isRTL} items={[
                        t('terms.section3Item1'),
                        t('terms.section3Item2'),
                        t('terms.section3Item3'),
                        t('terms.section3Item4'),
                        t('terms.section3Item5'),
                    ]} />
                </Section>

                <Section title={t('terms.section4Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.subheading, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{t('terms.subheading1')}</Text>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('terms.section4Content1')}
                    </Text>

                    <Text style={[styles.subheading, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{t('terms.subheading2')}</Text>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('terms.section4Content2')}
                    </Text>
                </Section>

                <Section title={t('terms.section5Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('terms.section5Content')}
                    </Text>
                    <BulletList colors={colors} isRTL={isRTL} items={[
                        t('terms.section5Item1'),
                        t('terms.section5Item2'),
                        t('terms.section5Item3'),
                        t('terms.section5Item4'),
                        t('terms.section5Item5'),
                    ]} />
                </Section>

                <Section title={t('terms.section6Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('terms.section6Content')}
                    </Text>
                </Section>

                <Section title={t('terms.section7Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('terms.section7Content')}
                    </Text>
                    <BulletList colors={colors} isRTL={isRTL} items={[
                        t('terms.section7Item1'),
                        t('terms.section7Item2'),
                        t('terms.section7Item3'),
                        t('terms.section7Item4'),
                        t('terms.section7Item5'),
                    ]} />
                </Section>

                <Section title={t('terms.section8Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('terms.section8Content')}
                    </Text>
                    <BulletList colors={colors} isRTL={isRTL} items={[
                        t('terms.section8Item1'),
                        t('terms.section8Item2'),
                        t('terms.section8Item3'),
                        t('terms.section8Item4'),
                        t('terms.section8Item5'),
                        t('terms.section8Item6'),
                    ]} />
                </Section>

                <Section title={t('terms.section9Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('terms.section9Content')}
                    </Text>
                    <BulletList colors={colors} isRTL={isRTL} items={[
                        t('terms.section9Item1'),
                        t('terms.section9Item2'),
                        t('terms.section9Item3'),
                        t('terms.section9Item4'),
                        t('terms.section9Item5'),
                    ]} />
                </Section>

                <Section title={t('terms.section10Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('terms.section10Content')}
                    </Text>
                </Section>

                <Section title={t('terms.section11Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('terms.section11Content')}
                    </Text>
                </Section>

                <Section title={t('terms.section12Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('terms.section12Content')}
                    </Text>
                </Section>

                <Section title={t('terms.section13Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('terms.section13Content')}
                    </Text>
                </Section>

                <Section title={t('terms.section14Title')} colors={colors} isRTL={isRTL}>
                    <Text style={[styles.paragraph, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('terms.section14Content')}
                    </Text>
                    <Text style={[styles.contactInfo, { color: colors.primary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('terms.email')}: legal@qscrap.qa{'\n'}
                        {t('terms.phone')}: +974 4455 4444{'\n'}
                        {t('terms.address')}: Industrial Area, St 10, P.O. Box 32544, Doha, Qatar
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

export default TermsScreen;
