// QScrap Profile Screen - User settings and account
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
import { PRIVACY_URL, TERMS_URL, APP_VERSION } from '../../config/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../App';

export default function ProfileScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user, logout, refreshUser } = useAuth();
    const [profile, setProfile] = useState<any>(null);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const data = await api.getProfile();
            setProfile(data);
        } catch (error) {
            console.log('Failed to load profile:', error);
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

    const MenuItem = ({
        icon,
        label,
        onPress,
        showArrow = true,
        danger = false
    }: {
        icon: string;
        label: string;
        onPress: () => void;
        showArrow?: boolean;
        danger?: boolean;
    }) => (
        <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
            <Text style={styles.menuIcon}>{icon}</Text>
            <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
            {showArrow && <Text style={styles.menuArrow}>›</Text>}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Profile</Text>
                </View>

                {/* Profile Card */}
                <View style={styles.profileCard}>
                    <LinearGradient
                        colors={Colors.gradients.primaryDark}
                        style={styles.profileGradient}
                    >
                        <View style={styles.avatarContainer}>
                            <Text style={styles.avatar}>👤</Text>
                        </View>
                        <Text style={styles.userName}>{user?.full_name || 'Customer'}</Text>
                        <Text style={styles.userPhone}>{user?.phone_number}</Text>
                        {profile?.stats && (
                            <View style={styles.profileStats}>
                                <View style={styles.profileStat}>
                                    <Text style={styles.profileStatNumber}>{profile.stats.total_requests || 0}</Text>
                                    <Text style={styles.profileStatLabel}>Requests</Text>
                                </View>
                                <View style={styles.profileStatDivider} />
                                <View style={styles.profileStat}>
                                    <Text style={styles.profileStatNumber}>{profile.stats.total_orders || 0}</Text>
                                    <Text style={styles.profileStatLabel}>Orders</Text>
                                </View>
                            </View>
                        )}
                    </LinearGradient>
                </View>

                {/* Menu Section */}
                <View style={styles.menuSection}>
                    <Text style={styles.menuTitle}>Account</Text>
                    <View style={styles.menuCard}>
                        <MenuItem icon="📋" label="My Addresses" onPress={() => navigation.navigate('Addresses' as never)} />
                        <MenuItem icon="🔔" label="Notifications" onPress={() => { }} />
                        <MenuItem icon="🎨" label="Appearance" onPress={() => { }} />
                    </View>
                </View>

                <View style={styles.menuSection}>
                    <Text style={styles.menuTitle}>Support</Text>
                    <View style={styles.menuCard}>
                        <MenuItem icon="💬" label="Help Center" onPress={() => { }} />
                        <MenuItem icon="📞" label="Contact Us" onPress={() => { }} />
                    </View>
                </View>

                <View style={styles.menuSection}>
                    <Text style={styles.menuTitle}>Legal</Text>
                    <View style={styles.menuCard}>
                        <MenuItem
                            icon="🔒"
                            label="Privacy Policy"
                            onPress={() => Linking.openURL(PRIVACY_URL)}
                        />
                        <MenuItem
                            icon="📄"
                            label="Terms of Service"
                            onPress={() => Linking.openURL(TERMS_URL)}
                        />
                    </View>
                </View>

                <View style={styles.menuSection}>
                    <View style={styles.menuCard}>
                        <MenuItem
                            icon="🚪"
                            label="Sign Out"
                            onPress={handleLogout}
                            showArrow={false}
                            danger
                        />
                    </View>
                </View>

                {/* Version */}
                <View style={styles.versionContainer}>
                    <Text style={styles.versionText}>QScrap v{APP_VERSION}</Text>
                    <Text style={styles.copyrightText}>© 2024 QScrap. All rights reserved.</Text>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    scrollView: {
        flex: 1,
    },
    header: {
        padding: Spacing.lg,
    },
    headerTitle: {
        fontSize: FontSizes.xxl,
        fontWeight: '700',
        color: Colors.dark.text,
    },
    profileCard: {
        marginHorizontal: Spacing.lg,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.lg,
    },
    profileGradient: {
        padding: Spacing.xl,
        alignItems: 'center',
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.dark.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    avatar: {
        fontSize: 40,
    },
    userName: {
        fontSize: FontSizes.xl,
        fontWeight: '700',
        color: '#fff',
    },
    userPhone: {
        fontSize: FontSizes.md,
        color: 'rgba(255,255,255,0.8)',
        marginTop: Spacing.xs,
    },
    profileStats: {
        flexDirection: 'row',
        marginTop: Spacing.lg,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
    },
    profileStat: {
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
    },
    profileStatNumber: {
        fontSize: FontSizes.xxl,
        fontWeight: '700',
        color: '#fff',
    },
    profileStatLabel: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.7)',
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
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.sm,
        textTransform: 'uppercase',
    },
    menuCard: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    menuIcon: {
        fontSize: 20,
        marginRight: Spacing.md,
    },
    menuLabel: {
        flex: 1,
        fontSize: FontSizes.md,
        color: Colors.dark.text,
    },
    menuLabelDanger: {
        color: Colors.error,
    },
    menuArrow: {
        fontSize: 20,
        color: Colors.dark.textMuted,
    },
    versionContainer: {
        alignItems: 'center',
        marginTop: Spacing.xl,
    },
    versionText: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textMuted,
    },
    copyrightText: {
        fontSize: FontSizes.xs,
        color: Colors.dark.textMuted,
        marginTop: Spacing.xs,
    },
});
