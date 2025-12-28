import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Switch,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator,
    Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, useTheme } from '../contexts';
import { dashboardApi } from '../services';
import { Spacing, BorderRadius, FontSize, Shadows } from '../constants';
import { APP_VERSION } from '../constants/config';

interface Stats {
    total_requests: number;
    total_orders: number;
    completed_orders: number;
    active_orders: number;
}

const ProfileScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const { colors, isDark, toggleTheme } = useTheme();
    const { user, logout } = useAuth();

    const [stats, setStats] = useState<Stats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    // Edit Profile Modal
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [editName, setEditName] = useState(user?.full_name || '');
    const [saving, setSaving] = useState(false);

    // Addresses Modal
    const [showAddresses, setShowAddresses] = useState(false);
    const [addresses, setAddresses] = useState<string[]>([]);
    const [newAddress, setNewAddress] = useState('');

    useEffect(() => {
        loadStats();
        loadPreferences();
    }, []);

    const loadStats = async () => {
        try {
            const response = await dashboardApi.getStats();
            setStats(response.data);
        } catch (error) {
            console.error('Failed to load stats:', error);
        } finally {
            setLoadingStats(false);
        }
    };

    const loadPreferences = async () => {
        try {
            const notifications = await AsyncStorage.getItem('notifications_enabled');
            if (notifications !== null) {
                setNotificationsEnabled(notifications === 'true');
            }

            const savedAddresses = await AsyncStorage.getItem('saved_addresses');
            if (savedAddresses) {
                setAddresses(JSON.parse(savedAddresses));
            }
        } catch (error) {
            console.error('Failed to load preferences:', error);
        }
    };

    const toggleNotifications = async (value: boolean) => {
        await Haptics.selectionAsync();
        setNotificationsEnabled(value);
        await AsyncStorage.setItem('notifications_enabled', value.toString());
    };

    const handleToggleTheme = async () => {
        await Haptics.selectionAsync();
        toggleTheme();
    };

    const saveProfile = async () => {
        if (!editName.trim()) {
            Alert.alert('Error', 'Name cannot be empty');
            return;
        }

        setSaving(true);
        try {
            // Update local storage (backend update would need an API endpoint)
            const updatedUser = { ...user, full_name: editName.trim() };
            await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
            setShowEditProfile(false);
            Alert.alert('Success', 'Profile updated successfully');
        } catch (error) {
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const addAddress = async () => {
        if (!newAddress.trim()) return;

        const updated = [...addresses, newAddress.trim()];
        setAddresses(updated);
        setNewAddress('');
        await AsyncStorage.setItem('saved_addresses', JSON.stringify(updated));
    };

    const removeAddress = async (index: number) => {
        const updated = addresses.filter((_, i) => i !== index);
        setAddresses(updated);
        await AsyncStorage.setItem('saved_addresses', JSON.stringify(updated));
    };

    const handleLogout = async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: logout }
            ]
        );
    };

    const handleNavigate = async (screen: string) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate(screen);
    };

    const getInitials = (name: string) => {
        return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: colors.primary }]}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{getInitials(user?.full_name || '')}</Text>
                    </View>
                    <Text style={styles.name}>{user?.full_name || 'User'}</Text>
                    <Text style={styles.phone}>{user?.phone_number}</Text>

                    <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => {
                            setEditName(user?.full_name || '');
                            setShowEditProfile(true);
                        }}
                    >
                        <Ionicons name="pencil" size={16} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Stats Cards */}
                <View style={styles.statsContainer}>
                    <View style={[styles.statCard, { backgroundColor: colors.surface }, Shadows.sm]}>
                        <Ionicons name="cube-outline" size={24} color={colors.primary} />
                        <Text style={[styles.statValue, { color: colors.text }]}>
                            {loadingStats ? '-' : stats?.total_requests || 0}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Requests</Text>
                    </View>

                    <View style={[styles.statCard, { backgroundColor: colors.surface }, Shadows.sm]}>
                        <Ionicons name="cart-outline" size={24} color={colors.warning} />
                        <Text style={[styles.statValue, { color: colors.text }]}>
                            {loadingStats ? '-' : stats?.active_orders || 0}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active</Text>
                    </View>

                    <View style={[styles.statCard, { backgroundColor: colors.surface }, Shadows.sm]}>
                        <Ionicons name="checkmark-circle-outline" size={24} color={colors.success} />
                        <Text style={[styles.statValue, { color: colors.text }]}>
                            {loadingStats ? '-' : stats?.completed_orders || 0}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Done</Text>
                    </View>
                </View>

                {/* Settings */}
                <View style={styles.content}>
                    {/* Account Section */}
                    <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ACCOUNT</Text>

                        <TouchableOpacity
                            style={styles.row}
                            onPress={() => {
                                setEditName(user?.full_name || '');
                                setShowEditProfile(true);
                            }}
                        >
                            <View style={styles.rowLeft}>
                                <View style={[styles.iconBg, { backgroundColor: colors.primary + '15' }]}>
                                    <Ionicons name="person-outline" size={20} color={colors.primary} />
                                </View>
                                <Text style={[styles.rowText, { color: colors.text }]}>Edit Profile</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.row}
                            onPress={() => setShowAddresses(true)}
                        >
                            <View style={styles.rowLeft}>
                                <View style={[styles.iconBg, { backgroundColor: colors.success + '15' }]}>
                                    <Ionicons name="location-outline" size={20} color={colors.success} />
                                </View>
                                <View>
                                    <Text style={[styles.rowText, { color: colors.text }]}>Saved Addresses</Text>
                                    <Text style={[styles.rowSubtext, { color: colors.textMuted }]}>
                                        {addresses.length} address{addresses.length !== 1 ? 'es' : ''}
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Preferences */}
                    <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PREFERENCES</Text>

                        <View style={styles.row}>
                            <View style={styles.rowLeft}>
                                <View style={[styles.iconBg, { backgroundColor: colors.warning + '15' }]}>
                                    <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={colors.warning} />
                                </View>
                                <Text style={[styles.rowText, { color: colors.text }]}>Dark Mode</Text>
                            </View>
                            <Switch
                                value={isDark}
                                onValueChange={handleToggleTheme}
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor="#fff"
                            />
                        </View>

                        <View style={styles.row}>
                            <View style={styles.rowLeft}>
                                <View style={[styles.iconBg, { backgroundColor: colors.danger + '15' }]}>
                                    <Ionicons name="notifications-outline" size={20} color={colors.danger} />
                                </View>
                                <View>
                                    <Text style={[styles.rowText, { color: colors.text }]}>Notifications</Text>
                                    <Text style={[styles.rowSubtext, { color: colors.textMuted }]}>
                                        {notificationsEnabled ? 'Enabled' : 'Disabled'}
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={notificationsEnabled}
                                onValueChange={toggleNotifications}
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor="#fff"
                            />
                        </View>
                    </View>

                    {/* Support */}
                    <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ABOUT</Text>

                        <TouchableOpacity
                            style={styles.row}
                            onPress={() => Linking.openURL('https://qscrap.qa/faq')}
                        >
                            <View style={styles.rowLeft}>
                                <View style={[styles.iconBg, { backgroundColor: colors.primary + '15' }]}>
                                    <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
                                </View>
                                <Text style={[styles.rowText, { color: colors.text }]}>Help & FAQ</Text>
                            </View>
                            <Ionicons name="open-outline" size={18} color={colors.textMuted} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.row}
                            onPress={() => handleNavigate('Terms')}
                        >
                            <View style={styles.rowLeft}>
                                <View style={[styles.iconBg, { backgroundColor: colors.textMuted + '15' }]}>
                                    <Ionicons name="document-text-outline" size={20} color={colors.textMuted} />
                                </View>
                                <Text style={[styles.rowText, { color: colors.text }]}>Terms of Service</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.row}
                            onPress={() => handleNavigate('PrivacyPolicy')}
                        >
                            <View style={styles.rowLeft}>
                                <View style={[styles.iconBg, { backgroundColor: colors.info + '15' }]}>
                                    <Ionicons name="shield-checkmark-outline" size={20} color={colors.info} />
                                </View>
                                <Text style={[styles.rowText, { color: colors.text }]}>Privacy Policy</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Logout */}
                    <TouchableOpacity
                        style={[styles.logoutBtn, { backgroundColor: colors.danger + '15' }]}
                        onPress={handleLogout}
                    >
                        <Ionicons name="log-out-outline" size={22} color={colors.danger} />
                        <Text style={[styles.logoutText, { color: colors.danger }]}>Sign Out</Text>
                    </TouchableOpacity>

                    <Text style={[styles.version, { color: colors.textMuted }]}>QScrap v{APP_VERSION || '1.0.0'}</Text>
                </View>
            </ScrollView>

            {/* Edit Profile Modal */}
            <Modal
                visible={showEditProfile}
                animationType="slide"
                transparent
                onRequestClose={() => setShowEditProfile(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Profile</Text>
                            <TouchableOpacity onPress={() => setShowEditProfile(false)}>
                                <Ionicons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Full Name</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            placeholder="Enter your name"
                            placeholderTextColor={colors.textMuted}
                            value={editName}
                            onChangeText={setEditName}
                        />

                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Phone Number</Text>
                        <View style={[styles.input, styles.disabledInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                            <Text style={{ color: colors.textMuted }}>{user?.phone_number}</Text>
                        </View>
                        <Text style={[styles.inputHint, { color: colors.textMuted }]}>
                            Contact support to change your phone number
                        </Text>

                        <TouchableOpacity
                            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                            onPress={saveProfile}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveBtnText}>Save Changes</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Addresses Modal */}
            <Modal
                visible={showAddresses}
                animationType="slide"
                transparent
                onRequestClose={() => setShowAddresses(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, styles.addressModal, { backgroundColor: colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Saved Addresses</Text>
                            <TouchableOpacity onPress={() => setShowAddresses(false)}>
                                <Ionicons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.addressList}>
                            {addresses.length === 0 ? (
                                <View style={styles.emptyAddresses}>
                                    <Ionicons name="location-outline" size={48} color={colors.textMuted} />
                                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>No saved addresses</Text>
                                </View>
                            ) : (
                                addresses.map((addr, index) => (
                                    <View key={index} style={[styles.addressItem, { backgroundColor: colors.background }]}>
                                        <Ionicons name="location" size={20} color={colors.primary} />
                                        <Text style={[styles.addressText, { color: colors.text }]} numberOfLines={2}>
                                            {addr}
                                        </Text>
                                        <TouchableOpacity onPress={() => removeAddress(index)}>
                                            <Ionicons name="trash-outline" size={20} color={colors.danger} />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </ScrollView>

                        <View style={styles.addAddressRow}>
                            <TextInput
                                style={[styles.addressInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                placeholder="Enter new address..."
                                placeholderTextColor={colors.textMuted}
                                value={newAddress}
                                onChangeText={setNewAddress}
                            />
                            <TouchableOpacity
                                style={[styles.addBtn, { backgroundColor: colors.primary }]}
                                onPress={addAddress}
                            >
                                <Ionicons name="add" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingTop: 50,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        position: 'relative'
    },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
    name: { color: '#fff', fontSize: FontSize.xxl, fontWeight: '700', marginTop: Spacing.md },
    phone: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.md, marginTop: Spacing.xs },
    editBtn: {
        position: 'absolute',
        top: 20,
        right: 20,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center'
    },

    statsContainer: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginTop: -30, gap: Spacing.sm },
    statCard: { flex: 1, alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.lg },
    statValue: { fontSize: FontSize.xl, fontWeight: '700', marginTop: Spacing.xs },
    statLabel: { fontSize: FontSize.xs, marginTop: 2 },

    content: { padding: Spacing.lg },
    section: { borderRadius: BorderRadius.lg, marginBottom: Spacing.lg, overflow: 'hidden' },
    sectionTitle: { fontSize: FontSize.xs, fontWeight: '600', letterSpacing: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
    rowText: { fontSize: FontSize.md },
    rowSubtext: { fontSize: FontSize.xs, marginTop: 2 },
    iconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, marginTop: Spacing.md },
    logoutText: { fontSize: FontSize.md, fontWeight: '600' },
    version: { textAlign: 'center', marginTop: Spacing.xl, marginBottom: Spacing.xl, fontSize: FontSize.sm },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.xl, paddingBottom: Spacing.xl + 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
    modalTitle: { fontSize: FontSize.xl, fontWeight: '700' },

    inputLabel: { fontSize: FontSize.sm, fontWeight: '600', marginBottom: Spacing.xs, marginTop: Spacing.md },
    input: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md },
    disabledInput: { justifyContent: 'center' },
    inputHint: { fontSize: FontSize.xs, marginTop: Spacing.xs },
    saveBtn: { padding: Spacing.lg, borderRadius: BorderRadius.lg, alignItems: 'center', marginTop: Spacing.xl },
    saveBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },

    addressModal: { maxHeight: '80%' },
    addressList: { maxHeight: 300 },
    emptyAddresses: { alignItems: 'center', paddingVertical: Spacing.xl },
    emptyText: { marginTop: Spacing.md, fontSize: FontSize.md },
    addressItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
    addressText: { flex: 1, fontSize: FontSize.md },
    addAddressRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
    addressInput: { flex: 1, borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md },
    addBtn: { width: 50, height: 50, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
});

export default ProfileScreen;
