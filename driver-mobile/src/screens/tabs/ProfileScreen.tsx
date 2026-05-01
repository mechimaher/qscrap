// QScrap Driver App - Profile Screen
// Enhanced Premium VVIP Design with i18n Support (Aligned with Customer App)

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Modal,
    TextInput,
    Linking,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useI18n } from '../../i18n';
import { api } from '../../services/api';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';


import { log, warn, error as logError } from '../../utils/logger';

const APP_VERSION = Constants.expoConfig?.version || (Constants.manifest as any)?.version || '1.0.0';

export default function ProfileScreen() {
    const navigation = useNavigation<any>();
    const { driver, logout, refreshDriver } = useAuth();
    const { colors } = useTheme();
    const { t } = useI18n();
    const {
        navApp, setNavApp,
        notificationsEnabled, setNotificationsEnabled
    } = useSettings();

    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Vehicle type options for Qatar delivery market
    const VEHICLE_TYPES = [
        { value: 'motorcycle', icon: 'bicycle-outline' as const, label: t('motorcycle') },
        { value: 'car', icon: 'car-outline' as const, label: t('car') },
        { value: 'van', icon: 'car-sport-outline' as const, label: t('van') },
        { value: 'truck', icon: 'bus-outline' as const, label: t('truck') },
    ];

    const [editForm, setEditForm] = useState({
        full_name: driver?.full_name || '',
        email: driver?.email || '',
        vehicle_type: driver?.vehicle_type || 'motorcycle',
        vehicle_model: driver?.vehicle_model || '',
        vehicle_plate: driver?.vehicle_plate || '',
        bank_name: driver?.bank_name || '',
        bank_account_iban: driver?.bank_account_iban || '',
        bank_account_name: driver?.bank_account_name || '',
    });


    useEffect(() => {
        if (driver) {
            setEditForm({
                full_name: driver.full_name || '',
                email: driver.email || '',
                vehicle_type: driver.vehicle_type || 'motorcycle',
                vehicle_model: driver.vehicle_model || '',
                vehicle_plate: driver.vehicle_plate || '',
                bank_name: driver.bank_name || '',
                bank_account_iban: driver.bank_account_iban || '',
                bank_account_name: driver.bank_account_name || '',
            });
        }
    }, [driver]);

    const handleUpdateProfile = async (data: any) => {
        try {
            setIsSaving(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await api.updateProfile(data);
            await refreshDriver();
            setIsEditModalVisible(false);
            Alert.alert(t('success'), t('profile_updated'));
        } catch (err) {
            logError('[Profile] Update error:', err);
            Alert.alert(t('error'), t('something_went_wrong'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleContactSupport = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert(
            t('contact_support'),
            t('choose_contact'),
            [
                { text: t('whatsapp'), onPress: () => Linking.openURL('https://wa.me/97430007227?text=Hello%20QScrap%20Driver%20Support') },
                { text: t('call_us'), onPress: () => Linking.openURL('tel:+97430007227') },
                { text: t('email_us'), onPress: () => Linking.openURL('mailto:drivers@qscrap.qa') },
                { text: t('cancel'), style: 'cancel' }
            ]
        );
    };

    const handleTerms = () => {
        navigation.navigate('Terms' as never);
    };

    const handlePrivacyPolicy = () => {
        navigation.navigate('PrivacyPolicy' as never);
    };

    const handleDeleteAccount = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Alert.alert(
            t('delete_account'),
            t('delete_account_warning'),
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('delete_forever'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsSaving(true);
                            await api.deleteAccount();
                            await logout();
                            Alert.alert(t('success'), t('account_deleted'));
                        } catch (err) {
                            logError('[Profile] Delete error:', err);
                            Alert.alert(t('error'), t('something_went_wrong'));
                        } finally {
                            setIsSaving(false);
                        }
                    },
                },
            ]
        );
    };

    const handleLogout = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            t('sign_out'),
            t('confirm_sign_out'),
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('sign_out'),
                    style: 'destructive',
                    onPress: async () => {
                        await logout();
                    },
                },
            ]
        );
    };

    const handleNavAppChange = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert(
            t('navigation_app'),
            t('choose_nav_app'),
            [
                { text: t('in_app_map'), onPress: () => setNavApp('in_app') },
                { text: t('google_maps'), onPress: () => setNavApp('google') },
                { text: t('waze'), onPress: () => setNavApp('waze') },
                { text: t('cancel'), style: 'cancel' }
            ]
        );
    };



    const toggleNotifications = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setNotificationsEnabled(!notificationsEnabled);
    };

    const getStatusColor = () => {
        if (!driver?.status) return Colors.textMuted;
        switch (driver.status) {
            case 'available': return Colors.success;
            case 'busy': return Colors.warning;
            default: return Colors.danger;
        }
    };

    const getStatusText = () => {
        if (!driver?.status) return t('offline');
        switch (driver.status) {
            case 'available': return t('available');
            case 'busy': return t('on_delivery');
            default: return t('offline');
        }
    };

    const getNavAppName = () => {
        switch (navApp) {
            case 'google': return t('google_maps');
            case 'waze': return t('waze');
            default: return t('in_app_map');
        }
    };

    const getVehicleIcon = (): React.ComponentProps<typeof Ionicons>['name'] => {
        switch (driver?.vehicle_type) {
            case 'car': return 'car-outline';
            case 'van': return 'car-sport-outline';
            case 'truck': return 'bus-outline';
            default: return 'bicycle-outline';
        }
    };

    const getVehicleLabel = (): string => {
        const match = VEHICLE_TYPES.find(v => v.value === driver?.vehicle_type);
        return match?.label || driver?.vehicle_type || t('motorcycle');
    };

    // Menu Item Component (like customer app)
    const MenuItem = ({
        icon,
        label,
        onPress,
        showArrow = true,
        danger = false,
        value = '',
        toggle = false,
        toggleValue = false,
    }: {
        icon: React.ComponentProps<typeof Ionicons>['name'];
        label: string;
        onPress: () => void;
        showArrow?: boolean;
        danger?: boolean;
        value?: string;
        toggle?: boolean;
        toggleValue?: boolean;
    }) => (
        <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
            activeOpacity={0.7}
        >
            <View style={[styles.menuIconBg, danger && styles.menuIconBgDanger]}>
                <Ionicons name={icon} size={20} color={danger ? '#EF4444' : Colors.primary} />
            </View>
            <Text style={[
                styles.menuLabel,
                { color: danger ? '#EF4444' : colors.text },

            ]}>{label}</Text>
            {value ? (
                <Text style={[styles.menuValue, { color: Colors.primary }]}>{value}</Text>
            ) : null}
            {toggle ? (
                <View style={[
                    styles.toggle,
                    { backgroundColor: toggleValue ? Colors.success : colors.border }
                ]}>
                    <View style={[
                        styles.toggleKnob,
                        { transform: [{ translateX: toggleValue ? 14 : 0 }] }
                    ]} />
                </View>
            ) : showArrow ? (
                <Text style={styles.menuArrow}>›</Text>
            ) : null}
        </TouchableOpacity>
    );

    if (!driver) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('profile')}</Text>
                <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setIsEditModalVisible(true);
                    }}
                >
                    <Text style={styles.editButtonText}>{t('edit_profile')}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Premium Profile Card with Gradient */}
                <View style={styles.profileCard}>
                    <LinearGradient
                        colors={[Colors.primary, '#8B1538']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.profileGradient}
                    >
                        {/* Avatar with Status Indicator */}
                        <View style={styles.avatarContainer}>
                            <Text style={styles.avatar}>
                                {driver.full_name?.charAt(0)?.toUpperCase() || 'D'}
                            </Text>
                            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
                        </View>
                        <Text style={styles.userName}>{driver.full_name || 'Driver'}</Text>
                        <Text style={styles.userPhone}>{driver.phone || ''}</Text>

                        {/* Stats Row */}
                        <View style={styles.profileStats}>
                            <View style={styles.profileStat}>
                                <Text style={styles.profileStatNumber}>
                                    {String(driver.total_deliveries || 0)}
                                </Text>
                                <Text style={styles.profileStatLabel}>{t('deliveries')}</Text>
                            </View>
                            <View style={styles.profileStatDivider} />
                            <View style={styles.profileStat}>
                                <Text style={styles.profileStatNumber}>
                                    {formatRating(driver.rating_average)}
                                </Text>
                                <Text style={styles.profileStatLabel}>{t('rating')}</Text>
                            </View>
                            <View style={styles.profileStatDivider} />
                            <View style={styles.profileStat}>
                                <Text style={styles.profileStatNumber}>
                                    {driver.total_earnings ? `${driver.total_earnings} QAR` : '0 QAR'}
                                </Text>
                                <Text style={styles.profileStatLabel}>{t('total_earnings')}</Text>
                            </View>
                        </View>
                        
                        {/* Member Status Row */}
                        <View style={{ flexDirection: 'row', marginTop: 16, alignItems: 'center', gap: 8 }}>
                            <View style={[styles.statusBadgeSmall, { backgroundColor: getStatusColor() + '30', width: 24, height: 24 }]} >
                                <View style={[styles.statusDotSmall, { backgroundColor: getStatusColor(), width: 8, height: 8 }]} />
                            </View>
                            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' }}>
                                {getStatusText()}
                            </Text>
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)', marginHorizontal: 4 }} />
                            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                                {driver.vehicle_plate ? t('vehicle_plate_display', { plate: driver.vehicle_plate }) : t('motorcycle')}
                            </Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* Vehicle Info Section — Enhanced */}
                <View style={styles.menuSection}>
                    <Text style={[styles.menuTitle, { color: colors.textSecondary }]}>{t('vehicle_details')}</Text>
                    <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
                        <MenuItem
                            icon={getVehicleIcon()}
                            label={t('vehicle_type')}
                            value={getVehicleLabel()}
                            onPress={() => setIsEditModalVisible(true)}
                        />
                        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                        <MenuItem
                            icon="speedometer-outline"
                            label={t('vehicle_model')}
                            value={driver.vehicle_model || '—'}
                            onPress={() => setIsEditModalVisible(true)}
                        />
                        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                        <MenuItem
                            icon="card-outline"
                            label={t('license_plate')}
                            value={driver.vehicle_plate || '—'}
                            onPress={() => setIsEditModalVisible(true)}
                        />
                    </View>
                </View>

                {/* Payment Details Section */}
                <View style={styles.menuSection}>
                    <Text style={[styles.menuTitle, { color: colors.textSecondary }]}>{t('payment_details')}</Text>
                    <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
                        <MenuItem
                            icon="wallet-outline"
                            label={t('bank_name')}
                            value={driver.bank_name || '—'}
                            onPress={() => setIsEditModalVisible(true)}
                        />
                        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                        <MenuItem
                            icon="document-text-outline"
                            label={t('iban')}
                            value={driver.bank_account_iban ? '••••' + driver.bank_account_iban.slice(-4) : '—'}
                            onPress={() => setIsEditModalVisible(true)}
                        />
                    </View>
                </View>

                {/* Settings Section */}
                <View style={styles.menuSection}>
                    <Text style={[styles.menuTitle, { color: colors.textSecondary }]}>{t('settings')}</Text>
                    <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
                        <MenuItem
                            icon="notifications-outline"
                            label={t('notifications')}
                            onPress={toggleNotifications}
                            showArrow={false}
                            toggle={true}
                            toggleValue={notificationsEnabled}
                        />

                        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                        <MenuItem
                            icon="map-outline"
                            label={t('navigation_app')}
                            value={getNavAppName()}
                            onPress={handleNavAppChange}
                        />
                    </View>
                </View>

                {/* Support Section */}
                <View style={styles.menuSection}>
                    <Text style={[styles.menuTitle, { color: colors.textSecondary }]}>{t('support')}</Text>
                    <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
                        <MenuItem
                            icon="call-outline"
                            label={t('contact_support')}
                            onPress={handleContactSupport}
                        />
                    </View>
                </View>

                {/* Legal Section */}
                <View style={styles.menuSection}>
                    <Text style={[styles.menuTitle, { color: colors.textSecondary }]}>{t('legal')}</Text>
                    <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
                        <MenuItem
                            icon="document-text-outline"
                            label={t('terms_conditions')}
                            onPress={handleTerms}
                        />
                        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                        <MenuItem
                            icon="lock-closed-outline"
                            label={t('privacy_policy')}
                            onPress={handlePrivacyPolicy}
                        />
                    </View>
                </View>

                {/* Danger Zone */}
                <View style={styles.menuSection}>
                    <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
                        <MenuItem
                            icon="log-out-outline"
                            label={t('sign_out')}
                            onPress={handleLogout}
                            showArrow={false}
                            danger
                        />
                        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                        <MenuItem
                            icon="trash-outline"
                            label={t('delete_account')}
                            onPress={handleDeleteAccount}
                            showArrow={false}
                            danger
                        />
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.versionContainer}>
                    <View style={styles.versionBadge}>
                        <Text style={styles.versionText}>
                            {t('version_text', { version: APP_VERSION })}
                        </Text>
                    </View>
                    <Text style={styles.copyrightText}>
                        {t('all_rights_reserved', { year: new Date().getFullYear() })}
                    </Text>
                    <Text style={styles.madeWithText}>{t('made_in_qatar')}</Text>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Edit Profile Modal */}
            <Modal visible={isEditModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{t('edit_profile')}</Text>

                        <ScrollView style={styles.modalForm}>
                            <Text style={[styles.sectionHeading, { color: colors.text }]}>{t('driver_info')}</Text>

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('full_name')}</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                value={editForm.full_name}
                                onChangeText={(val) => setEditForm({ ...editForm, full_name: val })}
                                placeholder={t('full_name')}
                                placeholderTextColor={colors.textMuted}
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('email')}</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                value={editForm.email}
                                onChangeText={(val) => setEditForm({ ...editForm, email: val })}
                                placeholder={t('email')}
                                placeholderTextColor={colors.textMuted}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />

                            <Text style={[styles.sectionHeading, { color: colors.text, marginTop: 12 }]}>{t('vehicle_info')}</Text>
                            
                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('vehicle_type')}</Text>
                            <View style={styles.vehicleTypeSelector}>
                                {VEHICLE_TYPES.map((type) => (
                                    <TouchableOpacity
                                        key={type.value}
                                        style={[
                                            styles.vehicleTypeOption,
                                            { borderColor: editForm.vehicle_type === type.value ? Colors.primary : colors.border },
                                            editForm.vehicle_type === type.value && { backgroundColor: Colors.primary + '10' }
                                        ]}
                                        onPress={() => setEditForm({ ...editForm, vehicle_type: type.value })}
                                    >
                                        <Ionicons 
                                            name={type.icon} 
                                            size={24} 
                                            color={editForm.vehicle_type === type.value ? Colors.primary : colors.textMuted} 
                                        />
                                        <Text style={[
                                            styles.vehicleTypeText,
                                            { color: editForm.vehicle_type === type.value ? Colors.primary : colors.textSecondary },
                                            editForm.vehicle_type === type.value && { fontWeight: '700' }
                                        ]}>
                                            {type.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('vehicle_model')}</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                value={editForm.vehicle_model}
                                onChangeText={(val) => setEditForm({ ...editForm, vehicle_model: val })}
                                placeholder="e.g. Toyota Hilux / Honda PCX"
                                placeholderTextColor={colors.textMuted}
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('license_plate')}</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                value={editForm.vehicle_plate}
                                onChangeText={(val) => setEditForm({ ...editForm, vehicle_plate: val })}
                                placeholder="e.g. 123456"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="number-pad"
                            />

                            <Text style={[styles.sectionHeading, { color: colors.text, marginTop: 12 }]}>{t('payment_details')}</Text>
                            <Text style={[styles.inputSubtext, { color: colors.textMuted }]}>{t('bank_details_description')}</Text>

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('bank_name')}</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                value={editForm.bank_name}
                                onChangeText={(val) => setEditForm({ ...editForm, bank_name: val })}
                                placeholder={t('bank_name_placeholder')}
                                placeholderTextColor={colors.textMuted}
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('account_name')}</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                value={editForm.bank_account_name}
                                onChangeText={(val) => setEditForm({ ...editForm, bank_account_name: val })}
                                placeholder={t('account_name_placeholder')}
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="words"
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('iban')}</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                value={editForm.bank_account_iban}
                                onChangeText={(val) => setEditForm({ ...editForm, bank_account_iban: val })}
                                placeholder={t('iban_placeholder')}
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="characters"
                            />
                            
                            {/* Bottom spacing for scroll area */}
                            <View style={{ height: 40 }} />
                        </ScrollView>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setIsEditModalVisible(false)}
                            >
                                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>{t('cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={() => handleUpdateProfile(editForm)}
                                disabled={isSaving}
                            >
                                <Text style={styles.saveButtonText}>{isSaving ? t('loading') : t('save')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

// Helper function for safe rating formatting
function formatRating(value: any): string {
    if (value === null || value === undefined) return '0.0';
    const num = Number(value);
    return isNaN(num) ? '0.0' : num.toFixed(1);
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    editButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        backgroundColor: Colors.primary + '15',
        borderRadius: BorderRadius.full,
    },
    editButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.primary,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    // Profile Card
    profileCard: {
        marginHorizontal: Spacing.lg,
        marginTop: Spacing.lg,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.lg,
    },
    profileGradient: {
        padding: Spacing.xl,
        alignItems: 'center',
    },
    avatarContainer: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.md,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.5)',
        position: 'relative',
    },
    avatar: {
        fontSize: 42,
        color: '#fff',
        fontWeight: '700',
    },
    statusIndicator: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 3,
        borderColor: '#fff',
    },
    userName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -0.5,
    },
    userPhone: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 4,
    },
    profileStats: {
        flexDirection: 'row',
        marginTop: Spacing.lg,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
    },
    profileStat: {
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
    },
    profileStatNumber: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
    },
    profileStatLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    profileStatDivider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    statusBadgeSmall: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusDotSmall: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    // Menu Sections
    menuSection: {
        marginTop: Spacing.lg,
        paddingHorizontal: Spacing.lg,
    },
    menuTitle: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: Spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    menuCard: {
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.sm,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
    },
    menuIconBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginEnd: Spacing.md,
    },
    menuIconBgDanger: {
        backgroundColor: '#FEE2E2',
    },
    menuIcon: {
        fontSize: 18,
    },
    menuLabel: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
    },
    menuValue: {
        fontSize: 14,
        fontWeight: '600',
        marginEnd: 8,
    },
    menuArrow: {
        fontSize: 22,
        opacity: 0.4,
    },
    menuDivider: {
        height: 1,
        marginStart: 68,
    },
    toggle: {
        width: 44,
        height: 24,
        borderRadius: 12,
        padding: 2,
        justifyContent: 'center',
    },
    toggleKnob: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    // Footer
    versionContainer: {
        alignItems: 'center',
        marginTop: Spacing.xl,
        paddingHorizontal: Spacing.lg,
    },
    versionBadge: {
        backgroundColor: '#F0F0F0',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
        marginBottom: Spacing.sm,
    },
    versionText: {
        fontSize: 14,
        fontWeight: '600',
        opacity: 0.7,
    },
    copyrightText: {
        fontSize: 12,
        opacity: 0.5,
    },
    madeWithText: {
        fontSize: 12,
        opacity: 0.5,
        marginTop: 4,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 32,
        paddingTop: 24,
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 24,
        textAlign: 'center',
    },
    modalForm: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    saveButton: {
        backgroundColor: Colors.primary,
    },
    cancelButtonText: {
        color: '#666',
        fontWeight: '700',
        fontSize: 16,
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    sectionHeading: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
        letterSpacing: -0.3,
    },
    inputSubtext: {
        fontSize: 13,
        marginBottom: 16,
        marginTop: -10,
    },
    vehicleTypeSelector: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20,
    },
    vehicleTypeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1.5,
        gap: 8,
        flex: 1,
        minWidth: '45%',
    },
    vehicleTypeText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
