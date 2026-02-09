// AnimatedStats - Dashboard stats cards with count-up animation
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { Stats } from '../../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, FontFamily } from '../../constants/theme';
import { rtlFlexDirection, rtlTextAlign } from '../../utils/rtl';

const { width } = Dimensions.get('window');
const cardWidth = (width - Spacing.lg * 3) / 2;

// Inline AnimatedNumber for stats (uses local styles)
const AnimatedNumber = ({ value, delay = 0 }: { value: number; delay?: number }) => {
    const [displayValue, setDisplayValue] = useState(0);
    const animRef = useRef<any>(null);
    const { colors } = useTheme();

    useEffect(() => {
        const timeout = setTimeout(() => {
            const step = (timestamp: number) => {
                if (!animRef.current) animRef.current = timestamp;
                const progress = Math.min((timestamp - animRef.current) / 1000, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                setDisplayValue(Math.floor(eased * value));
                if (progress < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }, delay);
        return () => clearTimeout(timeout);
    }, [value, delay]);

    return <Text style={[styles.statValue, { color: colors.text }]}>{displayValue}</Text>;
};

const AnimatedStats = ({
    stats,
    onRequestsPress,
    onOrdersPress
}: {
    stats: Stats | null;
    onRequestsPress: () => void;
    onOrdersPress: () => void;
}) => {
    const slideAnims = useRef([
        new Animated.Value(40),
        new Animated.Value(40),
        new Animated.Value(40),
    ]).current;
    const fadeAnims = useRef([
        new Animated.Value(0),
        new Animated.Value(0),
        new Animated.Value(0),
    ]).current;
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();

    useEffect(() => {
        slideAnims.forEach((anim, index) => {
            Animated.timing(anim, {
                toValue: 0,
                duration: 500,
                delay: 400 + index * 100,
                easing: Easing.out(Easing.back(1.1)),
                useNativeDriver: true,
            }).start();
        });

        fadeAnims.forEach((anim, index) => {
            Animated.timing(anim, {
                toValue: 1,
                duration: 400,
                delay: 400 + index * 100,
                useNativeDriver: true,
            }).start();
        });
    }, []);

    const StatCard = ({
        index,
        emoji,
        value,
        label,
        colors: cardColors,
        onPress
    }: {
        index: number;
        emoji: string;
        value: number;
        label: string;
        colors: readonly [string, string];
        onPress: () => void;
    }) => {
        const scaleAnim = useRef(new Animated.Value(1)).current;

        const handlePressIn = () => {
            Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
        };
        const handlePressOut = () => {
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
        };

        return (
            <Animated.View style={[
                styles.statCardWrapper,
                {
                    opacity: fadeAnims[index],
                    transform: [{ translateY: slideAnims[index] }, { scale: scaleAnim }],
                }
            ]}>
                <TouchableOpacity
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    activeOpacity={1}
                    accessibilityLabel={`${value} ${label}`}
                    accessibilityRole="button"
                >
                    <LinearGradient colors={cardColors} style={styles.statCardInner}>
                        <Text style={styles.statEmoji}>{emoji}</Text>
                        <AnimatedNumber value={value} delay={500 + index * 150} />
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <View style={styles.statsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>📊 {t('home.yourActivity')}</Text>
            <View style={[styles.statsRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <StatCard
                    index={0}
                    emoji="🔍"
                    value={stats?.active_requests || 0}
                    label={t('home.activeRequests')}
                    colors={['#FFF9E6', '#FFF3CC']}
                    onPress={onRequestsPress}
                />
                <StatCard
                    index={1}
                    emoji="🚚"
                    value={stats?.pending_deliveries || 0}
                    label={t('home.inProgress')}
                    colors={['#E6F7FF', '#CCF0FF']}
                    onPress={onOrdersPress}
                />
            </View>
            <Animated.View style={[
                styles.statCardWide,
                {
                    opacity: fadeAnims[2],
                    transform: [{ translateY: slideAnims[2] }],
                }
            ]}>
                <TouchableOpacity onPress={onOrdersPress} activeOpacity={0.9}>
                    <LinearGradient
                        colors={['rgba(138,21,56,0.08)', 'rgba(138,21,56,0.15)']}
                        style={[styles.statCardWideInner, { flexDirection: rtlFlexDirection(isRTL) }]}
                    >
                        <View style={[styles.wideCardLeft, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={[styles.wideCardEmoji, isRTL ? { marginLeft: Spacing.sm, marginRight: 0 } : { marginRight: Spacing.sm, marginLeft: 0 }]}>📦</Text>
                            <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                                <AnimatedNumber value={stats?.total_orders || 0} delay={700} />
                                <Text style={[styles.wideCardLabel, { color: colors.textSecondary }]}>{t('home.totalOrders')}</Text>
                            </View>
                        </View>
                        <View style={[styles.wideCardBadge, { backgroundColor: colors.primary + '20' }]}>
                            <Text style={[styles.wideCardBadgeText, { color: colors.primary }]}>{t('common.viewAll')} {isRTL ? '←' : '→'}</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    statsSection: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
    sectionTitle: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        fontFamily: FontFamily.semibold,
        marginBottom: Spacing.sm,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    statCardWrapper: { width: cardWidth },
    statCardInner: {
        padding: Spacing.xs,
        alignItems: 'center',
        minHeight: 72,
        justifyContent: 'center',
        borderRadius: BorderRadius.md,
    },
    statEmoji: { fontSize: 20, marginBottom: 2 },
    statValue: { fontSize: 24, fontWeight: '700', fontFamily: FontFamily.bold },
    statLabel: { fontSize: FontSizes.xs, marginTop: 1, fontFamily: FontFamily.medium },
    statCardWide: {
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    statCardWideInner: {
        padding: Spacing.sm,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    wideCardLeft: { flexDirection: 'row', alignItems: 'center' },
    wideCardEmoji: { fontSize: 28, marginRight: Spacing.sm },
    wideCardLabel: { fontSize: FontSizes.xs },
    wideCardBadge: {
        backgroundColor: Colors.primary + '15',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        borderRadius: BorderRadius.full,
    },
    wideCardBadgeText: { fontSize: 10, color: Colors.primary, fontWeight: '600' },
});

export default AnimatedStats;
