// QScrap Support Screen - WhatsApp-First Support (Qatar Market Optimized)
// Removed ticket system in favor of direct WhatsApp Business communication
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Linking,
    ScrollView,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';

// QScrap WhatsApp Business Number (Qatar)
const WHATSAPP_NUMBER = '+97433557700';

interface SupportOption {
    id: string;
    icon: string;
    titleKey: string;
    descriptionKey: string;
    messagePrefix: string;
}

const SUPPORT_OPTIONS: SupportOption[] = [
    {
        id: 'general',
        icon: '💬',
        titleKey: 'support.generalInquiry',
        descriptionKey: 'support.generalDesc',
        messagePrefix: 'Hi QScrap! I have a question: ',
    },
    {
        id: 'order',
        icon: '📦',
        titleKey: 'support.orderHelp',
        descriptionKey: 'support.orderHelpDesc',
        messagePrefix: 'Hi QScrap! I need help with my order: ',
    },
    {
        id: 'payment',
        icon: '💳',
        titleKey: 'support.paymentIssue',
        descriptionKey: 'support.paymentDesc',
        messagePrefix: 'Hi QScrap! I have a payment issue: ',
    },
    {
        id: 'complaint',
        icon: '⚠️',
        titleKey: 'support.fileComplaint',
        descriptionKey: 'support.complaintDesc',
        messagePrefix: 'Hi QScrap! I would like to report an issue: ',
    },
];

export default function SupportScreen() {
    const navigation = useNavigation();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();

    const openWhatsApp = (messagePrefix: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const message = encodeURIComponent(messagePrefix);
        const url = `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${message}`;

        Linking.canOpenURL(url)
            .then((supported) => {
                if (supported) {
                    return Linking.openURL(url);
                } else {
                    // Fallback to web WhatsApp
                    const webUrl = `https://wa.me/${WHATSAPP_NUMBER.replace('+', '')}?text=${message}`;
                    return Linking.openURL(webUrl);
                }
            })
            .catch((err) => {
                console.error('WhatsApp open error:', err);
                Alert.alert(
                    t('common.error'),
                    t('support.whatsappNotInstalled'),
                    [{ text: t('common.ok') }]
                );
            });
    };

    const renderSupportOption = (option: SupportOption) => (
        <TouchableOpacity
            key={option.id}
            style={[styles.optionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => openWhatsApp(option.messagePrefix)}
            activeOpacity={0.7}
        >
            <View style={[styles.optionContent, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <View style={styles.iconContainer}>
                    <Text style={styles.optionIcon}>{option.icon}</Text>
                </View>
                <View style={styles.textContainer}>
                    <Text style={[styles.optionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                        {t(option.titleKey)}
                    </Text>
                    <Text style={[styles.optionDescription, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t(option.descriptionKey)}
                    </Text>
                </View>
                <Text style={[styles.arrow, { color: Colors.primary }]}>{isRTL ? '←' : '→'}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.background }]}>
                    <Text style={styles.backText}>{isRTL ? '→' : '←'} {t('common.back')}</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('support.title')}</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <LinearGradient
                        colors={['#25D366', '#128C7E']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.heroGradient}
                    >
                        <Text style={styles.heroIcon}>💬</Text>
                        <Text style={[styles.heroTitle, { textAlign: 'center' }]}>{t('support.whatsappTitle')}</Text>
                        <Text style={[styles.heroSubtitle, { textAlign: 'center' }]}>{t('support.whatsappSubtitle')}</Text>

                        <TouchableOpacity
                            style={styles.mainChatButton}
                            onPress={() => openWhatsApp('Hi QScrap! ')}
                            activeOpacity={0.9}
                        >
                            <Text style={styles.mainChatIcon}>📱</Text>
                            <Text style={styles.mainChatText}>{t('support.startChat')}</Text>
                        </TouchableOpacity>
                    </LinearGradient>
                </View>

                {/* Quick Help Options */}
                <View style={styles.optionsSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('support.quickHelp')}
                    </Text>
                    {SUPPORT_OPTIONS.map(renderSupportOption)}
                </View>

                {/* Business Hours Info */}
                <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={styles.infoIcon}>🕐</Text>
                    <View style={styles.infoTextContainer}>
                        <Text style={[styles.infoTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                            {t('support.businessHours')}
                        </Text>
                        <Text style={[styles.infoText, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                            {t('support.hoursDetail')}
                        </Text>
                    </View>
                </View>

                {/* Response Time Promise */}
                <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={styles.infoIcon}>⚡</Text>
                    <View style={styles.infoTextContainer}>
                        <Text style={[styles.infoTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                            {t('support.fastResponse')}
                        </Text>
                        <Text style={[styles.infoText, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                            {t('support.responseTime')}
                        </Text>
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAFAFA' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backButton: {
        padding: Spacing.sm,
        backgroundColor: '#F5F5F5',
        borderRadius: BorderRadius.md,
    },
    backText: { color: Colors.primary, fontSize: FontSizes.md, fontWeight: '600' },
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: '#1a1a1a' },
    scrollView: { flex: 1 },
    heroSection: {
        margin: Spacing.lg,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.lg,
    },
    heroGradient: {
        padding: Spacing.xl,
        alignItems: 'center',
    },
    heroIcon: {
        fontSize: 48,
        marginBottom: Spacing.md,
    },
    heroTitle: {
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        color: '#fff',
        marginBottom: Spacing.sm,
    },
    heroSubtitle: {
        fontSize: FontSizes.md,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: Spacing.lg,
    },
    mainChatButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.full,
        ...Shadows.md,
    },
    mainChatIcon: {
        fontSize: 20,
        marginRight: Spacing.sm,
    },
    mainChatText: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#25D366',
    },
    optionsSection: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: Spacing.md,
    },
    optionCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        ...Shadows.sm,
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
    },
    optionIcon: {
        fontSize: 24,
    },
    textContainer: {
        flex: 1,
    },
    optionTitle: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    optionDescription: {
        fontSize: FontSizes.sm,
        color: '#525252',
    },
    arrow: {
        fontSize: 20,
        fontWeight: '700',
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    infoIcon: {
        fontSize: 32,
        marginRight: Spacing.md,
    },
    infoTextContainer: {
        flex: 1,
    },
    infoTitle: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    infoText: {
        fontSize: FontSizes.sm,
        color: '#525252',
    },
});
