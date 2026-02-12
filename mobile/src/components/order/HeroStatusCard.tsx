// HeroStatusCard - Premium gradient status header for orders
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Order } from '../../services/api';
import { Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { useTranslation } from '../../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

const HeroStatusCard = ({ order, statusConfig }: { order: Order; statusConfig: any }) => {
    const { t } = useTranslation();
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const isActive = !['completed', 'cancelled'].includes(order.order_status);

    useEffect(() => {
        if (isActive) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1, duration: 1500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 0, duration: 1500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [isActive]);

    const iconScale = pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.15],
    });

    return (
        <LinearGradient
            colors={statusConfig.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
        >
            <Animated.View style={[
                styles.heroIconContainer,
                { transform: [{ scale: iconScale }] }
            ]}>
                <Ionicons name={statusConfig.icon as any} size={56} color="#fff" />
            </Animated.View>
            <Text style={styles.heroLabel}>{statusConfig.label}</Text>
            <Text style={styles.heroDescription}>{statusConfig.description}</Text>
            <View style={styles.heroOrderNumber}>
                <Text style={styles.heroOrderText}>{t('common.order')} #{order.order_number}</Text>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    heroCard: {
        margin: Spacing.lg,
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        alignItems: 'center',
        ...Shadows.lg,
    },
    heroIconContainer: { marginBottom: Spacing.sm, alignItems: 'center' },
    heroLabel: { fontSize: FontSizes.xxl, fontWeight: '800', color: '#fff' },
    heroDescription: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.85)', marginTop: Spacing.xs, textAlign: 'center' },
    heroOrderNumber: { marginTop: Spacing.lg, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
    heroOrderText: { color: '#fff', fontWeight: '600', fontSize: FontSizes.sm },
});

export default HeroStatusCard;
