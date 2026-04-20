import { log, warn, error as logError } from '../utils/logger';
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    Alert,
    TextInput,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { rtlFlexDirection, rtlTextAlign, rtlChevron, rtlMarginHorizontal } from '../utils/rtl';
import { APP_VERSION } from '../config/api';
import { Ionicons } from '@expo/vector-icons';

interface SettingsState {
    pushNotifications: boolean;
    bidNotifications: boolean;
    orderNotifications: boolean;
    deliveryNotifications: boolean;
    soundEnabled: boolean;
    vibrationEnabled: boolean;
    darkMode: boolean;
    language: 'en' | 'ar';
}

const defaultSettings: SettingsState = {
    pushNotifications: true,
    bidNotifications: true,
    orderNotifications: true,
    deliveryNotifications: true,
    soundEnabled: true,
    vibrationEnabled: true,
    darkMode: true,
    language: 'en',
};

export default function SettingsScreen() {
    const navigation = useNavigation();
    const { isDarkMode, toggleTheme, setTheme, themeMode, colors } = useTheme();
    const { t, language, setLanguage, isRTL } = useLanguage();
    const { logout } = useAuth();
    const [settings, setSettings] = useState<SettingsState>({ ...defaultSettings, darkMode: isDarkMode, language });

    // Delete account state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    // Sync settings with current language from context
    useEffect(() => {
        setSettings(prev => ({ ...prev, language }));
    }, [language]);

    const loadSettings = useCallback(async () => {
        try {
            const saved = await AsyncStorage.getItem('qscrap_settings');
            if (saved) {
                setSettings({ ...defaultSettings, ...JSON.parse(saved) });
            }
        } catch (error) {
            log('Failed to load settings:', error);
        }
    }, []);

    const updateSetting = useCallback(async (key: keyof SettingsState, value: boolean | string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);

        try {
            await AsyncStorage.setItem('qscrap_settings', JSON.stringify(newSettings));
        } catch (error) {
            log('Failed to save settings:', error);
        }
    }, [settings]);

    const handleLanguageChange = useCallback(() => {
        Alert.alert(
            t('alerts.selectLanguage'),
            t('alerts.chooseLanguage'),
            [
                { text: 'English', onPress: () => setLanguage('en') },
                { text: 'العربية', onPress: () => setLanguage('ar') },
                { text: t('common.cancel'), style: 'cancel' },
            ]
        );
    }, [t, setLanguage]);

    const handleAppearanceChange = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert(
            t('settings.appearance'),
            t('settings.chooseTheme'),
            [
                {
                    text: t('settings.light'),
                    onPress: () => setTheme('light')
                },
                {
                    text: t('settings.dark'),
                    onPress: () => setTheme('dark')
                },
                {
                    text: t('settings.system'),
                    onPress: () => setTheme('system')
                },
                { text: t('common.cancel'), style: 'cancel' },
            ]
        );
    }, [t, setTheme]);

    const getAppearanceLabel = () => {
        switch (themeMode) {
            case 'light': return t('settings.light');
            case 'dark': return t('settings.dark');
            case 'system': return t('settings.system');
            default: return t('settings.system');
        }
    };

    const handleClearCache = useCallback(() => {
        Alert.alert(
            t('settings.clearCacheTitle'),
            t('settings.clearCacheMessage'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.clear'),
                    onPress: async () => {
                        await AsyncStorage.removeItem('qscrap_cache');
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        Alert.alert(t('common.success'), t('settings.cacheCleared'));
                    },
                },
            ]
        );
    }, [t]);

    // GOOGLE PLAY 2026 REQUIREMENT: Delete Account
    const handleDeleteAccount = useCallback(async () => {
        if (!deletePassword.trim()) {
            Alert.alert(t('common.error'), t('settings.enterPasswordToDelete'));
            return;
        }

        setIsDeleting(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        try {
            // Call backend to delete account
            await api.request('/users/me', {
                method: 'DELETE',
                body: JSON.stringify({ password: deletePassword }),
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowDeleteModal(false);

            // Clear all local data
            await AsyncStorage.clear();

            // Log out and redirect to login
            Alert.alert(
                t('settings.accountDeleted'),
                t('settings.accountDeletedMessage'),
                [{ text: t('common.ok'), onPress: () => logout() }]
            );
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(
                t('common.error'),
                error.message || t('settings.deleteAccountFailed')
            );
        } finally {
            setIsDeleting(false);
            setDeletePassword('');
        }
    }, [deletePassword, t, logout]);

    const SettingRow = ({
        icon,
        title,
        subtitle,
        value,
        onToggle
    }: {
        icon: string;
        title: string;
        subtitle?: string;
        value: boolean;
        onToggle: () => void;
    }) => (
        <View style={[styles.settingRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
            <Ionicons name={icon as any} size={22} color={colors.text} style={isRTL ? { marginRight: 0, marginLeft: Spacing.md } : { marginRight: Spacing.md }} />
            <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{title}</Text>
                {subtitle && <Text style={[styles.settingSubtitle, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>{subtitle}</Text>}
            </View>
            <Switch
                value={value}
                onValueChange={onToggle}
                trackColor={{ false: '#E5E5E5', true: Colors.primary + '60' }}
                thumbColor={value ? Colors.primary : '#999'}
                accessibilityLabel={title}
                accessibilityRole="switch"
                accessibilityState={{ checked: value }}
            />
        </View>
    );

    const ActionRow = ({
        icon,
        title,
        value,
        onPress
    }: {
        icon: string;
        title: string;
        value?: string;
        onPress: () => void;
    }) => (
        <TouchableOpacity style={[styles.settingRow, { flexDirection: rtlFlexDirection(isRTL) }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
            <Ionicons name={icon as any} size={22} color={colors.text} style={isRTL ? { marginRight: 0, marginLeft: Spacing.md } : { marginRight: Spacing.md }} />
            <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{title}</Text>
            </View>
            <View style={[styles.actionValue, { flexDirection: rtlFlexDirection(isRTL) }]}>
                {value && <Text style={[styles.valueText, isRTL ? { marginLeft: Spacing.sm, marginRight: 0 } : {}]}>{value}</Text>}
                <Text style={styles.chevron}>{rtlChevron(isRTL)}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t('common.back')}>
                    <Ionicons name="arrow-back" size={20} color={Colors.primary} /> <Text style={styles.backText}>{t('common.back')}</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('settings.title')}</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Notifications Section */}
                <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }, isRTL ? { marginRight: Spacing.sm, marginLeft: 0 } : {}]}>{t('settings.notifications')}</Text>

                    <SettingRow
                        icon="notifications-outline"
                        title={t('settings.pushNotifications')}
                        subtitle={t('settings.receiveNotifications')}
                        value={settings.pushNotifications}
                        onToggle={() => updateSetting('pushNotifications', !settings.pushNotifications)}
                    />

                    <SettingRow
                        icon="cash-outline"
                        title={t('settings.bidAlerts')}
                        subtitle={t('settings.bidAlertsDesc')}
                        value={settings.bidNotifications}
                        onToggle={() => updateSetting('bidNotifications', !settings.bidNotifications)}
                    />

                    <SettingRow
                        icon="cube-outline"
                        title={t('settings.orderUpdates')}
                        subtitle={t('settings.orderUpdatesDesc')}
                        value={settings.orderNotifications}
                        onToggle={() => updateSetting('orderNotifications', !settings.orderNotifications)}
                    />

                    <SettingRow
                        icon="car-outline"
                        title={t('settings.deliveryTracking')}
                        subtitle={t('settings.deliveryTrackingDesc')}
                        value={settings.deliveryNotifications}
                        onToggle={() => updateSetting('deliveryNotifications', !settings.deliveryNotifications)}
                    />
                </View>

                {/* Language */}
                <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }, isRTL ? { marginRight: Spacing.sm, marginLeft: 0 } : {}]}>{t('settings.language')}</Text>

                    <ActionRow
                        icon="globe-outline"
                        title={t('settings.language')}
                        value={language === 'en' ? 'English' : 'العربية'}
                        onPress={handleLanguageChange}
                    />
                </View>

                {/* Appearance - VVIP 2026 Dark Mode */}
                <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }, isRTL ? { marginRight: Spacing.sm, marginLeft: 0 } : {}]}>{t('settings.appearance')}</Text>

                    <ActionRow
                        icon="color-palette-outline"
                        title={t('settings.theme')}
                        value={getAppearanceLabel()}
                        onPress={handleAppearanceChange}
                    />
                </View>

                {/* Storage */}
                <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }, isRTL ? { marginRight: Spacing.sm, marginLeft: 0 } : {}]}>{t('settings.storage')}</Text>

                    <ActionRow
                        icon="trash-outline"
                        title={t('settings.clearCache')}
                        onPress={handleClearCache}
                    />
                </View>

                {/* About */}
                <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }, isRTL ? { marginRight: Spacing.sm, marginLeft: 0 } : {}]}>{t('settings.about')}</Text>

                    <ActionRow
                        icon="information-circle-outline"
                        title={t('settings.appVersion')}
                        value={APP_VERSION || '1.0.0'}
                        onPress={() => Alert.alert('QScrap', `${t('settings.appVersion')}: ${APP_VERSION}\n\n${t('profile.madeInQatar')}`)}
                    />

                    <ActionRow
                        icon="document-text-outline"
                        title={t('settings.termsOfService')}
                        onPress={() => (navigation as any).navigate('Terms')}
                    />

                    <ActionRow
                        icon="lock-closed-outline"
                        title={t('settings.privacyPolicy')}
                        onPress={() => (navigation as any).navigate('PrivacyPolicy')}
                    />

                    <ActionRow
                        icon="mail-outline"
                        title={t('settings.contactSupport')}
                        onPress={() => Alert.alert(t('settings.contactSupport'), t('profile.contactInfo'))}
                    />
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
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '800', letterSpacing: -0.5 },
    scrollView: { flex: 1, padding: Spacing.lg },
    section: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        ...Shadows.sm,
    },
    sectionTitle: {
        fontSize: FontSizes.sm,
        fontWeight: '700',
        marginBottom: Spacing.md,
        marginLeft: Spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
    },
    settingIcon: { fontSize: 22, marginRight: Spacing.md },
    settingInfo: { flex: 1 },
    settingTitle: { fontSize: FontSizes.md, fontWeight: '600' },
    settingSubtitle: {
        fontSize: FontSizes.sm,
        marginTop: 2,
    },
    actionValue: { flexDirection: 'row', alignItems: 'center' },
    valueText: {
        fontSize: FontSizes.md,
        color: '#737373',
        marginRight: Spacing.sm,
    },
    chevron: { fontSize: 24, color: '#737373' },
});
