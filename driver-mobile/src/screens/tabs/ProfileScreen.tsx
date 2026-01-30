// QScrap Driver App - Profile Screen
// Driver profile, vehicle info, and settings

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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { api } from '../../services/api';
import { Colors, Spacing } from '../../constants/theme';
import { LEGAL_DOCS } from '../../constants/legal';

export default function ProfileScreen() {
    const navigation = useNavigation<any>();
    const { driver, logout, refreshDriver } = useAuth();
    const { colors } = useTheme();
    const {
        navApp, setNavApp,
        language, setLanguage,
        notificationsEnabled, setNotificationsEnabled
    } = useSettings();

    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isBankModalVisible, setIsBankModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [editForm, setEditForm] = useState({
        full_name: driver?.full_name || '',
        email: driver?.email || '',
        vehicle_model: driver?.vehicle_model || '',
        vehicle_plate: driver?.vehicle_plate || '',
    });

    const [bankForm, setBankForm] = useState({
        bank_name: driver?.bank_name || '',
        bank_account_iban: driver?.bank_account_iban || '',
        bank_account_name: driver?.bank_account_name || '',
    });

    useEffect(() => {
        if (driver) {
            setEditForm({
                full_name: driver.full_name || '',
                email: driver.email || '',
                vehicle_model: driver.vehicle_model || '',
                vehicle_plate: driver.vehicle_plate || '',
            });
            setBankForm({
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
            setIsBankModalVisible(false);
            Alert.alert('Success', 'Profile updated successfully');
        } catch (err) {
            console.error('[Profile] Update error:', err);
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const handleContactSupport = () => {
        const whatsappUrl = 'whatsapp://send?phone=97455555555'; // Example support number
        Linking.canOpenURL(whatsappUrl).then(supported => {
            if (supported) {
                Linking.openURL(whatsappUrl);
            } else {
                Linking.openURL('mailto:support@qscrap.qa');
            }
        });
    };

    const handleTerms = () => {
        navigation.navigate('WebView', { html: LEGAL_DOCS.TERMS, title: 'Terms & Conditions' });
    };

    const handlePrivacyPolicy = () => {
        navigation.navigate('WebView', { html: LEGAL_DOCS.PRIVACY, title: 'Privacy Policy' });
    };

    const handleDeleteAccount = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Alert.alert(
            'Delete Account',
            'This action is PERMANENT. All your data will be anonymized and you will lose access to your account. Are you absolutely sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Forever',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsSaving(true);
                            await api.deleteAccount();
                            await logout();
                            Alert.alert('Success', 'Your account has been deleted.');
                        } catch (err) {
                            console.error('[Profile] Delete error:', err);
                            Alert.alert('Error', 'Failed to delete account. Please contact support.');
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
            'Logout',
            'Are you sure you want to logout? You will be set to offline.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
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
            'Preferred Navigation',
            'Select your default navigation app:',
            [
                { text: 'In-App Map', onPress: () => setNavApp('in_app'), style: navApp === 'in_app' ? 'default' : 'default' },
                { text: 'Google Maps', onPress: () => setNavApp('google'), style: navApp === 'google' ? 'default' : 'default' },
                { text: 'Waze', onPress: () => setNavApp('waze'), style: navApp === 'waze' ? 'default' : 'default' },
                { text: 'Cancel', style: 'cancel' }
            ]
        );
    };

    const handleLanguageChange = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert(
            'Language / اللغة',
            'Select your preferred language:',
            [
                { text: 'English', onPress: () => setLanguage('en'), style: language === 'en' ? 'default' : 'default' },
                { text: 'العربية (Arabic)', onPress: () => setLanguage('ar'), style: language === 'ar' ? 'default' : 'default' },
                { text: 'Cancel', style: 'cancel' }
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

    if (!driver) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Card */}
                <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => setIsEditModalVisible(true)}
                    >
                        <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <View style={styles.avatarContainer}>
                        <Text style={styles.avatarEmoji}>👨‍✈️</Text>
                        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
                    </View>
                    <Text style={[styles.driverName, { color: colors.text }]}>
                        {driver.full_name || 'Driver'}
                    </Text>
                    <Text style={[styles.driverPhone, { color: colors.textSecondary }]}>
                        {driver.phone || ''}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                        <Text style={[styles.statusText, { color: getStatusColor() }]}>
                            {driver.status === 'available' ? 'Available' :
                                driver.status === 'busy' ? 'On Delivery' : 'Offline'}
                        </Text>
                    </View>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
                        <Text style={styles.statIcon}>📦</Text>
                        <Text style={[styles.statValue, { color: colors.text }]}>
                            {String(driver.total_deliveries || 0)}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textMuted }]}>Deliveries</Text>
                    </View>
                    <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
                        <Text style={styles.statIcon}>⭐</Text>
                        <Text style={[styles.statValue, { color: colors.text }]}>
                            {formatRating(driver.rating_average)}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textMuted }]}>Rating</Text>
                    </View>
                </View>

                {/* Vehicle Info */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Vehicle Info</Text>
                    <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
                        <InfoRow
                            icon="🚗"
                            label="Type"
                            value={driver?.vehicle_type || 'Not set'}
                            colors={colors}
                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <InfoRow
                            icon="🚘"
                            label="Model"
                            value={driver?.vehicle_model || 'Not set'}
                            colors={colors}
                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <InfoRow
                            icon="🔢"
                            label="Plate"
                            value={driver?.vehicle_plate || 'Not set'}
                            colors={colors}
                        />
                    </View>
                </View>

                {/* Bank Details */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Bank Details</Text>
                        <TouchableOpacity onPress={() => setIsBankModalVisible(true)}>
                            <Text style={[styles.editLink, { color: Colors.primary }]}>Update</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
                        <InfoRow
                            icon="🏦"
                            label="Bank"
                            value={driver?.bank_name || 'Not set'}
                            colors={colors}
                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <InfoRow
                            icon="💳"
                            label="IBAN"
                            value={driver?.bank_account_iban ? `***${driver.bank_account_iban.slice(-4)}` : 'Not set'}
                            colors={colors}
                        />
                    </View>
                </View>

                {/* Documents (VVIP Feature) */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Documents</Text>
                    <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
                        <InfoRow
                            icon="📄"
                            label="Driver License"
                            value="Verified"
                            valueColor={Colors.success}
                            colors={colors}
                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <InfoRow
                            icon="🛡️"
                            label="Vehicle Insurance"
                            value="Exp. 12/2026"
                            valueColor={Colors.warning}
                            colors={colors}
                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <InfoRow
                            icon="🆔"
                            label="Qatar ID"
                            value="Verified"
                            valueColor={Colors.success}
                            colors={colors}
                        />
                    </View>
                </View>

                {/* Settings */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Settings</Text>
                    <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
                        <TouchableOpacity style={styles.settingRow} onPress={toggleNotifications}>
                            <Text style={styles.settingIcon}>🔔</Text>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>
                                Notifications
                            </Text>
                            <View style={[
                                styles.toggle,
                                { backgroundColor: notificationsEnabled ? Colors.success : colors.border }
                            ]}>
                                <View style={[
                                    styles.toggleKnob,
                                    { transform: [{ translateX: notificationsEnabled ? 12 : 0 }] }
                                ]} />
                            </View>
                        </TouchableOpacity>
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity style={styles.settingRow} onPress={handleLanguageChange}>
                            <Text style={styles.settingIcon}>🌐</Text>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>
                                Language
                            </Text>
                            <Text style={[styles.settingValue, { color: colors.text }]}>
                                {language === 'en' ? 'English (US)' : 'العربية'}
                            </Text>
                        </TouchableOpacity>
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity style={styles.settingRow} onPress={handleNavAppChange}>
                            <Text style={styles.settingIcon}>🗺️</Text>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>
                                Navigation App
                            </Text>
                            <Text style={[styles.settingValue, { color: Colors.primary }]}>
                                {navApp === 'in_app' ? 'In-App Map' : navApp === 'google' ? 'Google Maps' : 'Waze'}
                            </Text>
                        </TouchableOpacity>
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity style={styles.settingRow} onPress={handleContactSupport}>
                            <Text style={styles.settingIcon}>📞</Text>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>
                                Contact Support
                            </Text>
                            <Text style={[styles.settingValue, { color: Colors.primary }]}>
                                WhatsApp →
                            </Text>
                        </TouchableOpacity>
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity style={styles.settingRow} onPress={handleTerms}>
                            <Text style={styles.settingIcon}>📄</Text>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>
                                Terms & Conditions
                            </Text>
                            <Text style={[styles.settingValue, { color: Colors.primary }]}>
                                View →
                            </Text>
                        </TouchableOpacity>
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity style={styles.settingRow} onPress={handlePrivacyPolicy}>
                            <Text style={styles.settingIcon}>🔒</Text>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>
                                Privacy Policy
                            </Text>
                            <Text style={[styles.settingValue, { color: Colors.primary }]}>
                                View →
                            </Text>
                        </TouchableOpacity>
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity style={styles.settingRow} onPress={handleDeleteAccount}>
                            <Text style={styles.settingIcon}>⚠️</Text>
                            <Text style={[styles.settingLabel, { color: Colors.danger }]}>
                                Delete Account
                            </Text>
                            <Text style={[styles.settingValue, { color: Colors.danger }]}>
                                →
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Logout */}
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                    activeOpacity={0.8}
                >
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                {/* Version */}
                <Text style={[styles.version, { color: colors.textMuted }]}>
                    QScrap Driver Enterprise v1.1.0 (Build 5658)
                </Text>
            </ScrollView>

            {/* Edit Profile Modal */}
            <Modal visible={isEditModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Profile</Text>

                        <ScrollView style={styles.modalForm}>
                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Full Name</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                                value={editForm.full_name}
                                onChangeText={(val) => setEditForm({ ...editForm, full_name: val })}
                                placeholder="Enter full name"
                                placeholderTextColor={colors.textMuted}
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email Address</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                                value={editForm.email}
                                onChangeText={(val) => setEditForm({ ...editForm, email: val })}
                                placeholder="Enter email"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Vehicle Model</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                                value={editForm.vehicle_model}
                                onChangeText={(val) => setEditForm({ ...editForm, vehicle_model: val })}
                                placeholder="e.g. Honda Shadow"
                                placeholderTextColor={colors.textMuted}
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Plate Number</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                                value={editForm.vehicle_plate}
                                onChangeText={(val) => setEditForm({ ...editForm, vehicle_plate: val })}
                                placeholder="e.g. 12345"
                                placeholderTextColor={colors.textMuted}
                            />
                        </ScrollView>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setIsEditModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={() => handleUpdateProfile(editForm)}
                                disabled={isSaving}
                            >
                                <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Bank Details Modal */}
            <Modal visible={isBankModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Bank Details</Text>

                        <ScrollView style={styles.modalForm}>
                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Bank Name</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                                value={bankForm.bank_name}
                                onChangeText={(val) => setBankForm({ ...bankForm, bank_name: val })}
                                placeholder="e.g. QNB"
                                placeholderTextColor={colors.textMuted}
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Account Name</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                                value={bankForm.bank_account_name}
                                onChangeText={(val) => setBankForm({ ...bankForm, bank_account_name: val })}
                                placeholder="Name as per bank record"
                                placeholderTextColor={colors.textMuted}
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>IBAN</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                                value={bankForm.bank_account_iban}
                                onChangeText={(val) => setBankForm({ ...bankForm, bank_account_iban: val })}
                                placeholder="QA..."
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="characters"
                            />
                        </ScrollView>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setIsBankModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={() => handleUpdateProfile(bankForm)}
                                disabled={isSaving}
                            >
                                <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save'}</Text>
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

function InfoRow({ icon, label, value, valueColor, colors }: any) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>{icon}</Text>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
            <Text style={[styles.infoValue, { color: valueColor || colors.text }]}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingTop: 8,
        paddingBottom: Spacing.BOTTOM_NAV_HEIGHT,
    },
    profileCard: {
        padding: 28,
        borderRadius: 28,
        alignItems: 'center',
        marginBottom: 16,
        // VVIP 2026: Glassmorphism effect
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.6)',
        borderTopColor: 'rgba(255,255,255,0.8)',
        // Premium shadow
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 6,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    avatarEmoji: {
        fontSize: 72,
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
    driverName: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 4,
    },
    driverPhone: {
        fontSize: 14,
        marginBottom: 12,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    statItem: {
        flex: 1,
        padding: 20,
        borderRadius: 24,
        alignItems: 'center',
        // VVIP 2026: Glassmorphism
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.6)',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    statIcon: {
        fontSize: 28,
        marginBottom: 8,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: 12,
        marginTop: 4,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
    },
    infoCard: {
        borderRadius: 24,
        overflow: 'hidden',
        // VVIP 2026: Subtle glassmorphism border
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    infoIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    infoLabel: {
        flex: 1,
        fontSize: 14,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        marginHorizontal: 16,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    settingIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    settingLabel: {
        flex: 1,
        fontSize: 14,
    },
    settingValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    logoutButton: {
        backgroundColor: Colors.danger,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 16,
    },
    logoutText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    version: {
        textAlign: 'center',
        fontSize: 12,
        marginBottom: 20,
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
        padding: 12,
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
        color: Colors.textMuted,
        fontWeight: '700',
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '700',
    },
    editButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: Colors.primary + '15',
    },
    editButtonText: {
        color: Colors.primary,
        fontWeight: '700',
        fontSize: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    editLink: {
        fontSize: 14,
        fontWeight: '600',
    },
    toggle: {
        width: 36,
        height: 20,
        borderRadius: 12,
        padding: 2,
        justifyContent: 'center',
    },
    toggleKnob: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
});
