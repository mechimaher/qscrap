import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing } from '../constants/theme';

interface InsightsCardProps {
    moneySaved: number;
    loyaltyPoints: number;
    ordersCompleted: number;
}

const InsightsCard: React.FC<InsightsCardProps> = ({
    moneySaved,
    loyaltyPoints,
    ordersCompleted,
}) => {
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerIcon}>💡</Text>
                <Text style={styles.headerTitle}>Your Insights</Text>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
                {/* Money Saved */}
                <View style={styles.statCard}>
                    <LinearGradient
                        colors={['#10B981', '#059669']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.statGradient}
                    >
                        <Text style={styles.statIcon}>💰</Text>
                        <Text style={styles.statValue}>{moneySaved} QAR</Text>
                        <Text style={styles.statLabel}>Saved This Month</Text>
                    </LinearGradient>
                </View>

                {/* Loyalty Points */}
                <View style={styles.statCard}>
                    <LinearGradient
                        colors={[Colors.primary, '#6B0F28']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.statGradient}
                    >
                        <Text style={styles.statIcon}>⭐</Text>
                        <Text style={styles.statValue}>{loyaltyPoints}</Text>
                        <Text style={styles.statLabel}>Loyalty Points</Text>
                    </LinearGradient>
                </View>

                {/* Orders Completed */}
                <View style={styles.statCard}>
                    <LinearGradient
                        colors={['#3B82F6', '#2563EB']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.statGradient}
                    >
                        <Text style={styles.statIcon}>📦</Text>
                        <Text style={styles.statValue}>{ordersCompleted}</Text>
                        <Text style={styles.statLabel}>Orders Completed</Text>
                    </LinearGradient>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.lg,
        paddingHorizontal: Spacing.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    headerIcon: {
        fontSize: 24,
        marginRight: Spacing.sm,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.text,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    statCard: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    statGradient: {
        padding: Spacing.md,
        alignItems: 'center',
        minHeight: 110,
        justifyContent: 'center',
    },
    statIcon: {
        fontSize: 28,
        marginBottom: 6,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
    },
});

export default InsightsCard;
