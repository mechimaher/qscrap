// QScrap Settings Screen - App Preferences and Notifications
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    Alert,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

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
    const { isDarkMode, toggleTheme, colors } = useTheme();
    const [settings, setSettings] = useState<SettingsState>({ ...defaultSettings, darkMode: isDarkMode });

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const saved = await AsyncStorage.getItem('qscrap_settings');
            if (saved) {
                setSettings({ ...defaultSettings, ...JSON.parse(saved) });
            }
        } catch (error) {
            console.log('Failed to load settings:', error);
        }
    };

    const updateSetting = async (key: keyof SettingsState, value: boolean | string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);

        try {
            await AsyncStorage.setItem('qscrap_settings', JSON.stringify(newSettings));
        } catch (error) {
            console.log('Failed to save settings:', error);
        }
    };

    const handleLanguageChange = () => {
        Alert.alert(
            'Select Language',
            'Choose your preferred language',
            [
                { text: 'English', onPress: () => updateSetting('language', 'en') },
                { text: 'العربية', onPress: () => updateSetting('language', 'ar') },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const handleClearCache = () => {
        Alert.alert(
            'Clear Cache',
            'This will clear temporary data. You will remain logged in.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    onPress: async () => {
                        await AsyncStorage.removeItem('qscrap_cache');
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        Alert.alert('Success', 'Cache cleared successfully');
                    },
                },
            ]
        );
    };

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
        <View style={styles.settingRow}>
            <Text style={styles.settingIcon}>{icon}</Text>
            <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
                {subtitle && <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
            </View>
            <Switch
                value={value}
                onValueChange={onToggle}
                trackColor={{ false: Colors.dark.border, true: Colors.primary + '60' }}
                thumbColor={value ? Colors.primary : Colors.dark.textMuted}
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
        <TouchableOpacity style={styles.settingRow} onPress={onPress}>
            <Text style={styles.settingIcon}>{icon}</Text>
            <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
            </View>
            <View style={styles.actionValue}>
                {value && <Text style={styles.valueText}>{value}</Text>}
                <Text style={styles.chevron}>›</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Notifications Section */}
                <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Notifications</Text>

                    <SettingRow
                        icon="🔔"
                        title="Push Notifications"
                        subtitle="Receive notifications on your device"
                        value={settings.pushNotifications}
                        onToggle={() => updateSetting('pushNotifications', !settings.pushNotifications)}
                    />

                    <SettingRow
                        icon="💰"
                        title="Bid Alerts"
                        subtitle="Get notified when garages submit bids"
                        value={settings.bidNotifications}
                        onToggle={() => updateSetting('bidNotifications', !settings.bidNotifications)}
                    />

                    <SettingRow
                        icon="📦"
                        title="Order Updates"
                        subtitle="Status changes and confirmations"
                        value={settings.orderNotifications}
                        onToggle={() => updateSetting('orderNotifications', !settings.orderNotifications)}
                    />

                    <SettingRow
                        icon="🚗"
                        title="Delivery Tracking"
                        subtitle="Driver location and ETA updates"
                        value={settings.deliveryNotifications}
                        onToggle={() => updateSetting('deliveryNotifications', !settings.deliveryNotifications)}
                    />
                </View>

                {/* Sound & Haptics */}
                <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Sound & Haptics</Text>

                    <SettingRow
                        icon="🔊"
                        title="Sound Effects"
                        subtitle="Play sounds for notifications"
                        value={settings.soundEnabled}
                        onToggle={() => updateSetting('soundEnabled', !settings.soundEnabled)}
                    />

                    <SettingRow
                        icon="📳"
                        title="Vibration"
                        subtitle="Haptic feedback for actions"
                        value={settings.vibrationEnabled}
                        onToggle={() => updateSetting('vibrationEnabled', !settings.vibrationEnabled)}
                    />
                </View>

                {/* Appearance */}
                <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>

                    <SettingRow
                        icon="🌙"
                        title="Dark Mode"
                        subtitle="Use dark theme"
                        value={isDarkMode}
                        onToggle={() => {
                            toggleTheme();
                            updateSetting('darkMode', !isDarkMode);
                        }}
                    />

                    <ActionRow
                        icon="🌐"
                        title="Language"
                        value={settings.language === 'en' ? 'English' : 'العربية'}
                        onPress={handleLanguageChange}
                    />
                </View>

                {/* Storage */}
                <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Storage</Text>

                    <ActionRow
                        icon="🗑️"
                        title="Clear Cache"
                        onPress={handleClearCache}
                    />
                </View>

                {/* About */}
                <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>About</Text>

                    <ActionRow
                        icon="ℹ️"
                        title="App Version"
                        value="1.0.0"
                        onPress={() => Alert.alert('QScrap', 'Version 1.0.0\nBuild: 2024.12.25\n\n🇶🇦 Made in Qatar with ❤️')}
                    />

                    <ActionRow
                        icon="📄"
                        title="Terms of Service"
                        onPress={() => Linking.openURL('https://qscrap.qa/terms')}
                    />

                    <ActionRow
                        icon="🔒"
                        title="Privacy Policy"
                        onPress={() => Linking.openURL('https://qscrap.qa/privacy')}
                    />

                    <ActionRow
                        icon="📧"
                        title="Contact Support"
                        onPress={() => Alert.alert('Support', 'Email: support@qscrap.qa\nPhone: +974 1234 5678')}
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
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.dark.text },
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
        color: Colors.dark.textSecondary,
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
    settingTitle: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.dark.text },
    settingSubtitle: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    actionValue: { flexDirection: 'row', alignItems: 'center' },
    valueText: {
        fontSize: FontSizes.md,
        color: Colors.dark.textMuted,
        marginRight: Spacing.sm,
    },
    chevron: { fontSize: 24, color: Colors.dark.textMuted },
});
