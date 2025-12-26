// QScrap Profile Screen - Premium VIP Design
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { PRIVACY_URL, TERMS_URL, APP_VERSION } from '../../config/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../App';

export default function ProfileScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user, logout, refreshUser } = useAuth();
    const { colors } = useTheme();
    const [profile, setProfile] = useState<any>(null);
    const [unreadNotifications, setUnreadNotifications] = useState<number>(0);

    // Reload profile when screen comes into focus (e.g., after editing)
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadProfile();
            loadUnreadCount();
            refreshUser();
        });
        return unsubscribe;
    }, [navigation]);

    const loadProfile = async () => {
        try {
            const data = await api.getProfile();
            setProfile(data);
        } catch (error) {
            console.log('Failed to load profile:', error);
        }
    };

    const loadUnreadCount = async () => {
        try {
            const data = await api.getNotifications();
            const unreadCount = (data.notifications || []).filter((n: any) => !n.is_read).length;
            setUnreadNotifications(unreadCount);
        } catch (error) {
            console.log('Failed to load notifications:', error);
        }
    };

    const handleLogout = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        await logout();
                    },
                },
            ]
        );
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'Are you sure you want to delete your account? This action is permanent and cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.deleteAccount();
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            await logout();
                            Alert.alert('Account Deleted', 'Your account has been successfully deleted.');
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to delete account');
                        }
                    },
                },
            ]
        );
    };

    const MenuItem = ({
        icon,
        label,
        onPress,
        showArrow = true,
        danger = false,
        badge = ''
    }: {
        icon: string;
        label: string;
        onPress: () => void;
        showArrow?: boolean;
        danger?: boolean;
        badge?: string;
    }) => (
        <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
            activeOpacity={0.7}
        >
            <View style={[styles.menuIconBg, danger && styles.menuIconBgDanger]}
            >
                <Text style={styles.menuIcon}>{icon}</Text>
            </View>
            <Text style={[styles.menuLabel, { color: danger ? '#EF4444' : colors.text }]}>{label}</Text>
            {badge ? (
                <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>{badge}</Text>
                </View>
            ) : null}
            {showArrow && <Text style={styles.menuArrow}>›</Text>}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Premium Header */}
                <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            navigation.navigate('EditProfile' as never);
                        }}
                    >
                        <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                </View>

                {/* Premium Profile Card */}
                <View style={styles.profileCard}>
                    <LinearGradient
                        colors={[Colors.primary, '#B31D4A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.profileGradient}
                    >
                        <View style={styles.avatarContainer}>
                            <Text style={styles.avatar}>
                                {(profile?.user?.full_name || user?.full_name)?.charAt(0)?.toUpperCase() || '👤'}
                            </Text>
                        </View>
                        <Text style={styles.userName}>{profile?.user?.full_name || user?.full_name || 'Customer'}</Text>
                        <Text style={styles.userPhone}>{profile?.user?.phone_number || user?.phone_number}</Text>

                        {/* Stats Row */}
                        <View style={styles.profileStats}>
                            <View style={styles.profileStat}>
                                <Text style={styles.profileStatNumber}>
                                    {profile?.stats?.total_requests || 0}
                                </Text>
                                <Text style={styles.profileStatLabel}>Requests</Text>
                            </View>
                            <View style={styles.profileStatDivider} />
                            <View style={styles.profileStat}>
                                <Text style={styles.profileStatNumber}>
                                    {profile?.stats?.total_orders || 0}
                                </Text>
                                <Text style={styles.profileStatLabel}>Orders</Text>
                            </View>
                            <View style={styles.profileStatDivider} />
                            <View style={styles.profileStat}>
                                <Text style={styles.profileStatNumber}>⭐</Text>
                                <Text style={styles.profileStatLabel}>VIP</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </View>

                {/* Account Section */}
                <View style={styles.menuSection}>
                    <Text style={[styles.menuTitle, { color: colors.textSecondary }]}>Account</Text>
                    <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
                        <MenuItem icon="📋" label="My Addresses" onPress={() => navigation.navigate('Addresses' as never)} />
                        <MenuItem icon="🔔" label="Notifications" onPress={() => navigation.navigate('Notifications' as never)} badge={unreadNotifications > 0 ? String(unreadNotifications) : ''} />
                        <MenuItem icon="🎨" label="Appearance" onPress={() => navigation.navigate('Settings' as never)} />
                    </View>
                </View>

                {/* Support Section */}
                <View style={styles.menuSection}>
                    <Text style={[styles.menuTitle, { color: colors.textSecondary }]}>Support</Text>
                    <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
                        <MenuItem icon="🎫" label="Support Tickets" onPress={() => navigation.navigate('Support' as never)} />
                        <MenuItem icon="💬" label="Help Center" onPress={() => Alert.alert(
                            'Help Center',
                            'How can we help you today?',
                            [
                                { text: 'FAQs', onPress: () => Alert.alert('FAQs', '• How to request a part?\nGo to Home > New Part Request\n\n• How long for delivery?\nTypically 1-3 business days\n\n• Payment methods?\nCash on delivery or card') },
                                { text: 'Contact Support', onPress: () => Linking.openURL('https://wa.me/97412345678?text=Hi%20QScrap%20Support') },
                                { text: 'Cancel', style: 'cancel' }
                            ]
                        )} />
                        <MenuItem icon="📞" label="Contact Us" onPress={() => Alert.alert(
                            'Contact QScrap',
                            'Choose how to reach us:',
                            [
                                { text: '📱 WhatsApp', onPress: () => Linking.openURL('https://wa.me/97412345678') },
                                { text: '📞 Call Us', onPress: () => Linking.openURL('tel:+97412345678') },
                                { text: '✉️ Email', onPress: () => Linking.openURL('mailto:support@qscrap.qa') },
                                { text: 'Cancel', style: 'cancel' }
                            ]
                        )} />
                    </View>
                </View>

                {/* Legal Section */}
                <View style={styles.menuSection}>
                    <Text style={[styles.menuTitle, { color: colors.textSecondary }]}>Legal</Text>
                    <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
                        <MenuItem icon="🔒" label="Privacy Policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
                        <MenuItem icon="📄" label="Terms of Service" onPress={() => Linking.openURL(TERMS_URL)} />
                    </View>
                </View>

                {/* Sign Out */}
                <View style={styles.menuSection}>
                    <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
                        <MenuItem
                            icon="🚪"
                            label="Sign Out"
                            onPress={handleLogout}
                            showArrow={false}
                            danger
                        />
                        <View style={{ height: 1, backgroundColor: colors.border }} />
                        <MenuItem
                            icon="🗑️"
                            label="Delete Account"
                            onPress={handleDeleteAccount}
                            showArrow={false}
                            danger
                        />
                    </View>
                </View>

                {/* Version Footer */}
                <View style={styles.versionContainer}>
                    <View style={styles.versionBadge}>
                        <Text style={styles.versionText}>QScrap v{APP_VERSION}</Text>
                    </View>
                    <Text style={styles.copyrightText}>© 2024 QScrap. All rights reserved.</Text>
                    <Text style={styles.madeWithText}>Made with ❤️ in Qatar</Text>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    scrollView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    headerTitle: {
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        color: Colors.dark.text,
        letterSpacing: -0.5,
    },
    editButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        backgroundColor: Colors.primary + '15',
        borderRadius: BorderRadius.full,
    },
    editButtonText: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: Colors.primary,
    },
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
    },
    avatar: {
        fontSize: 42,
        color: '#fff',
        fontWeight: '700',
    },
    userName: {
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -0.5,
    },
    userPhone: {
        fontSize: FontSizes.md,
        color: 'rgba(255,255,255,0.85)',
        marginTop: Spacing.xs,
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
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        color: '#fff',
    },
    profileStatLabel: {
        fontSize: FontSizes.xs,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    profileStatDivider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    menuSection: {
        marginTop: Spacing.lg,
        paddingHorizontal: Spacing.lg,
    },
    menuTitle: {
        fontSize: FontSizes.xs,
        fontWeight: '700',
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    menuCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.sm,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    menuIconBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    menuIconBgDanger: {
        backgroundColor: '#FEE2E2',
    },
    menuIcon: {
        fontSize: 18,
    },
    menuLabel: {
        flex: 1,
        fontSize: FontSizes.md,
        fontWeight: '500',
        color: Colors.dark.text,
    },
    menuLabelDanger: {
        color: '#EF4444',
    },
    menuBadge: {
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.full,
        marginRight: Spacing.sm,
    },
    menuBadgeText: {
        fontSize: FontSizes.xs,
        fontWeight: '700',
        color: '#fff',
    },
    menuArrow: {
        fontSize: 22,
        color: Colors.dark.textMuted,
    },
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
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: Colors.dark.textSecondary,
    },
    copyrightText: {
        fontSize: FontSizes.xs,
        color: Colors.dark.textMuted,
    },
    madeWithText: {
        fontSize: FontSizes.xs,
        color: Colors.dark.textMuted,
        marginTop: Spacing.xs,
    },
});
