// QScrap Driver App - Profile Screen
// Driver profile, vehicle info, and settings

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Colors } from '../../constants/theme';

export default function ProfileScreen() {
    const { driver, logout } = useAuth();
    const { colors } = useTheme();

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

    const getStatusColor = () => {
        switch (driver?.status) {
            case 'available': return Colors.success;
            case 'busy': return Colors.warning;
            default: return Colors.danger;
        }
    };

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
                    <View style={styles.avatarContainer}>
                        <Text style={styles.avatarEmoji}>👨‍✈️</Text>
                        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
                    </View>
                    <Text style={[styles.driverName, { color: colors.text }]}>
                        {driver?.full_name || 'Driver'}
                    </Text>
                    <Text style={[styles.driverPhone, { color: colors.textSecondary }]}>
                        {driver?.phone}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                        <Text style={[styles.statusText, { color: getStatusColor() }]}>
                            {driver?.status === 'available' ? 'Available' :
                                driver?.status === 'busy' ? 'On Delivery' : 'Offline'}
                        </Text>
                    </View>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
                        <Text style={styles.statIcon}>📦</Text>
                        <Text style={[styles.statValue, { color: colors.text }]}>
                            {driver?.total_deliveries || 0}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textMuted }]}>Deliveries</Text>
                    </View>
                    <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
                        <Text style={styles.statIcon}>⭐</Text>
                        <Text style={[styles.statValue, { color: colors.text }]}>
                            {formatRating(driver?.rating_average)}
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
                            label="Vehicle Type"
                            value={driver?.vehicle_type || 'Not set'}
                            colors={colors}
                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <InfoRow
                            icon="🔢"
                            label="Plate Number"
                            value={driver?.vehicle_plate || 'Not set'}
                            colors={colors}
                        />
                    </View>
                </View>

                {/* Settings */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Settings</Text>
                    <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
                        <TouchableOpacity style={styles.settingRow}>
                            <Text style={styles.settingIcon}>🔔</Text>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>
                                Notifications
                            </Text>
                            <Text style={[styles.settingValue, { color: Colors.success }]}>
                                Enabled
                            </Text>
                        </TouchableOpacity>
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity style={styles.settingRow}>
                            <Text style={styles.settingIcon}>📞</Text>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>
                                Contact Support
                            </Text>
                            <Text style={[styles.settingValue, { color: Colors.primary }]}>
                                →
                            </Text>
                        </TouchableOpacity>
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity style={styles.settingRow}>
                            <Text style={styles.settingIcon}>📄</Text>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>
                                Terms & Conditions
                            </Text>
                            <Text style={[styles.settingValue, { color: Colors.primary }]}>
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
                    QScrap Driver v1.0.0
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

// Helper function for safe rating formatting
function formatRating(value: any): string {
    if (value === null || value === undefined) return '0.0';
    const num = Number(value);
    return isNaN(num) ? '0.0' : num.toFixed(1);
}

function InfoRow({ icon, label, value, colors }: any) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>{icon}</Text>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
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
    },
    profileCard: {
        padding: 24,
        borderRadius: 20,
        alignItems: 'center',
        marginBottom: 16,
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
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
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
        borderRadius: 16,
        overflow: 'hidden',
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
});
