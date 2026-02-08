// QScrap Profile Screen - Premium VIP Design with Full i18n Support
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
import { useTranslation } from '../../contexts/LanguageContext';
import { useToast } from '../../components/Toast';
import AccountDeletionModal from '../../components/AccountDeletionModal';
import { APP_VERSION } from '../../config/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../App';
import { rtlFlexDirection, rtlChevron, rtlMarginHorizontal } from '../../utils/rtl';

export default function ProfileScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user, logout, refreshUser } = useAuth();
    const { colors } = useTheme();
    const { t, isRTL, language } = useTranslation();
    const toast = useToast();
    const [profile, setProfile] = useState<any>(null);
    const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
    const [showDeletionModal, setShowDeletionModal] = useState(false);

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
            toast.error(t('common.error'), t('errors.loadFailed'));
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
            t('profile.signOut'),
            t('profile.confirmSignOut'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('profile.signOut'),
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowDeletionModal(true);
    };

    const handleDeletionNavigate = (screen: string) => {
        // Navigate to the appropriate screen from the deletion modal
        switch (screen) {
            case 'Orders':
                navigation.navigate('Orders');
                break;
            case 'SupportTickets':
            case 'Support':
                navigation.navigate('Support');
                break;
            case 'Requests':
                // Navigate back to tab navigator - Requests tab
                (navigation as any).navigate('MainTabs', { screen: 'Requests' });
                break;
            default:
                navigation.navigate('Support');
        }
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
            style={[styles.menuItem, { flexDirection: rtlFlexDirection(isRTL) }]}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
            activeOpacity={0.7}
        >
            <View style={[styles.menuIconBg, danger && styles.menuIconBgDanger, rtlMarginHorizontal(isRTL, 0, Spacing.md)]}
            >
                <Text style={styles.menuIcon}>{icon}</Text>
            </View>
            <Text style={[styles.menuLabel, { color: danger ? '#EF4444' : colors.text }]}>{label}</Text>
            {badge ? (
                <View style={[styles.menuBadge, rtlMarginHorizontal(isRTL, 0, Spacing.sm)]}>
                    <Text style={styles.menuBadgeText}>{badge}</Text>
                </View>
            ) : null}
            {showArrow && <Text style={styles.menuArrow}>{rtlChevron(isRTL)}</Text>}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Premium Header */}
                <View style={[
                    styles.header,
                    {
                        backgroundColor: colors.surface,
                        borderBottomColor: colors.border,
                        flexDirection: rtlFlexDirection(isRTL)
                    }
                ]}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>{t('profile.title')}</Text>
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            navigation.navigate('EditProfile');
                        }}
                    >
                        <Text style={styles.editButtonText}>{t('profile.edit')}</Text>
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
                        <Text style={styles.userName}>{profile?.user?.full_name || user?.full_name || t('common.customer')}</Text>
                        <Text style={styles.userPhone}>{profile?.user?.phone_number || user?.phone_number}</Text>

                        {/* Stats Row */}
                        <View style={[styles.profileStats, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <View style={styles.profileStat}>
                                <Text style={styles.profileStatNumber}>
                                    {profile?.stats?.total_requests || 0}
                                </Text>
                                <Text style={styles.profileStatLabel}>{t('profile.requestsCount')}</Text>
                            </View>
                            <View style={styles.profileStatDivider} />
                            <View style={styles.profileStat}>
                                <Text style={styles.profileStatNumber}>
                                    {profile?.stats?.total_orders || 0}
                                </Text>
                                <Text style={styles.profileStatLabel}>{t('profile.ordersCount')}</Text>
                            </View>
                            <View style={styles.profileStatDivider} />
                            <View style={styles.profileStat}>
                                <Text style={styles.profileStatNumber}>⭐</Text>
                                <Text style={styles.profileStatLabel}>{t('profile.vip')}</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </View>

                {/* Account Section */}
                <View style={styles.menuSection}>
                    <Text style={[styles.menuTitle, { color: colors.textSecondary }]}>{t('profile.account')}</Text>
                    <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
                        <MenuItem icon="📋" label={t('profile.myAddresses')} onPress={() => navigation.navigate('Addresses')} />
                        <MenuItem icon="🔔" label={t('profile.notifications')} onPress={() => navigation.navigate('Notifications')} badge={unreadNotifications > 0 ? String(unreadNotifications) : ''} />
                        <MenuItem icon="🎨" label={t('profile.appearance')} onPress={() => navigation.navigate('Settings')} />
                    </View>
                </View>

                {/* Support Section */}
                <View style={styles.menuSection}>
                    <Text style={[styles.menuTitle, { color: colors.textSecondary }]}>{t('profile.support')}</Text>
                    <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
                        <MenuItem icon="🎫" label={t('profile.supportTickets')} onPress={() => navigation.navigate('Support')} />
                        <MenuItem icon="📞" label={t('profile.contactUs')} onPress={() => Alert.alert(
                            t('profile.contactUs'),
                            t('profile.chooseContact'),
                            [
                                { text: t('alerts.whatsapp'), onPress: () => Linking.openURL('https://wa.me/97450267974?text=Hello%20QScrap%20Support') },
                                { text: t('alerts.callUs'), onPress: () => Linking.openURL('tel:+97450267974') },
                                { text: t('alerts.emailUs'), onPress: () => Linking.openURL('mailto:support@qscrap.qa') },
                                { text: t('common.cancel'), style: 'cancel' }
                            ]
                        )} />
                    </View>
                </View>

                {/* Legal Section */}
                <View style={styles.menuSection}>
                    <Text style={[styles.menuTitle, { color: colors.textSecondary }]}>{t('profile.legal')}</Text>
                    <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
                        <MenuItem icon="🔒" label={t('settings.privacyPolicy')} onPress={() => navigation.navigate('PrivacyPolicy')} />
                        <MenuItem icon="📄" label={t('settings.termsOfService')} onPress={() => navigation.navigate('Terms')} />
                    </View>
                </View>

                {/* Sign Out */}
                <View style={styles.menuSection}>
                    <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
                        <MenuItem
                            icon="🚪"
                            label={t('profile.signOut')}
                            onPress={handleLogout}
                            showArrow={false}
                            danger
                        />
                        <View style={{ height: 1, backgroundColor: colors.border }} />
                        <MenuItem
                            icon="🗑️"
                            label={t('profile.deleteAccount')}
                            onPress={handleDeleteAccount}
                            showArrow={false}
                            danger
                        />
                    </View>
                </View>

                {/* Version Footer */}
                <View style={styles.versionContainer}>
                    <View style={styles.versionBadge}>
                        <Text style={styles.versionText}>{t('profile.version', { version: APP_VERSION })}</Text>
                    </View>
                    <Text style={styles.copyrightText}>{t('profile.allRightsReserved', { year: new Date().getFullYear() })}</Text>
                    <Text style={styles.madeWithText}>{t('profile.madeInQatar')}</Text>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Account Deletion Modal */}
            <AccountDeletionModal
                visible={showDeletionModal}
                onClose={() => setShowDeletionModal(false)}
                onNavigate={handleDeletionNavigate}
            />
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
        opacity: 0.4,
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
        opacity: 0.7,
    },
    copyrightText: {
        fontSize: FontSizes.xs,
        opacity: 0.5,
    },
    madeWithText: {
        fontSize: FontSizes.xs,
        opacity: 0.5,
        marginTop: Spacing.xs,
    },
});
