// HeroRequestCard - Premium header component for request details
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Animated,
    Easing,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Request } from '../../services/api';
import { UPLOAD_BASE_URL } from '../../config/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { useTranslation } from '../../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../../utils/rtl';
import { Ionicons } from '@expo/vector-icons';

const HeroRequestCard = ({
    request,
    colors,
    onImagePress
}: {
    request: Request;
    colors: any;
    onImagePress: (images: string[], index: number) => void;
}) => {
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const countdownRef = useRef<NodeJS.Timeout | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<{ text: string; urgency: string } | null>(null);

    const { t, isRTL } = useTranslation();

    // Calculate time remaining
    const calculateTimeRemaining = useCallback(() => {
        if (!request.expires_at) return null;
        const now = new Date();
        const expires = new Date(request.expires_at);
        const diff = expires.getTime() - now.getTime();

        if (diff <= 0) return { text: t('common.expired'), urgency: 'expired' };

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;

        let urgency = 'normal';
        if (hours <= 6) urgency = 'critical';
        else if (hours <= 24) urgency = 'warning';

        if (days > 0) {
            return { text: `${days}d ${remainingHours}h ${minutes}m`, urgency };
        }
        return { text: `${hours}h ${minutes}m`, urgency };
    }, [request.expires_at]);

    useEffect(() => {
        setTimeRemaining(calculateTimeRemaining());
        countdownRef.current = setInterval(() => {
            setTimeRemaining(calculateTimeRemaining());
        }, 60000); // Update every minute

        return () => {
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [calculateTimeRemaining]);

    // Pulse animation for active status
    useEffect(() => {
        if (request.status === 'active') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 0,
                        duration: 1500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [request.status]);

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'active': return { color: '#22C55E', bg: '#DCFCE7', icon: 'ellipse' as const, label: t('status.active') };
            case 'accepted': return { color: '#3B82F6', bg: '#DBEAFE', icon: 'checkmark' as const, label: t('status.accepted') };
            case 'expired': return { color: '#9CA3AF', bg: '#F3F4F6', icon: 'time-outline' as const, label: t('status.expired') };
            default: return { color: '#6B7280', bg: '#F3F4F6', icon: 'ellipse' as const, label: status };
        }
    };

    const getUrgencyColor = (urgency: string) => {
        switch (urgency) {
            case 'critical': return '#EF4444';
            case 'warning': return '#F59E0B';
            default: return '#22C55E';
        }
    };

    const statusConfig = getStatusConfig(request.status);
    const isActive = request.status === 'active';

    const pulseOpacity = pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.6, 1],
    });

    return (
        <LinearGradient
            colors={isActive ? ['#1a1a2e', '#16213e', '#0f0f23'] : ['#f8f9fa', '#e9ecef', '#dee2e6']}
            style={styles.heroCard}
        >
            {/* Status Badge */}
            <View style={[styles.heroHeader, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <Animated.View style={[
                    styles.heroStatusBadge,
                    { backgroundColor: statusConfig.bg },
                    isActive && { opacity: pulseOpacity }
                ]}>
                    <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} style={{ marginRight: Spacing.xs }} />
                    <Text style={[styles.heroStatusText, { color: statusConfig.color }]}>
                        {statusConfig.label}
                    </Text>
                </Animated.View>

                {/* Countdown Timer */}
                {isActive && timeRemaining && (
                    <View style={[
                        styles.countdownBadge,
                        { backgroundColor: getUrgencyColor(timeRemaining.urgency) + '20' }
                    ]}>
                        <Text style={styles.countdownIcon}>⏱</Text>
                        <Text style={[
                            styles.countdownText,
                            { color: getUrgencyColor(timeRemaining.urgency) }
                        ]}>
                            {timeRemaining.text}
                        </Text>
                    </View>
                )}
            </View>

            {/* Car Info */}
            <View style={[styles.heroCarInfo, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <Ionicons name="car-sport" size={48} color={isActive ? '#C9A227' : Colors.primary} style={isRTL ? { marginLeft: Spacing.md, marginRight: 0 } : { marginRight: Spacing.md, marginLeft: 0 }} />
                <View style={styles.heroCarDetails}>
                    <Text style={[styles.heroCarName, !isActive && { color: '#1a1a1a' }, { textAlign: rtlTextAlign(isRTL) }]}>
                        {request.car_make} {request.car_model}
                    </Text>
                    <Text style={[styles.heroCarYear, !isActive && { color: Colors.primary }, { textAlign: rtlTextAlign(isRTL) }]}>
                        {request.car_year}
                    </Text>
                </View>
            </View>

            {/* Divider */}
            <View style={[styles.heroDivider, !isActive && { backgroundColor: '#dee2e6' }]} />

            {/* Part Category & Description */}
            <View style={styles.heroSection}>
                <Text style={[styles.heroLabel, !isActive && { color: '#525252' }, { textAlign: rtlTextAlign(isRTL) }]}>
                    {t('requestDetail.partNeeded')}
                </Text>
                {request.part_category ? (
                    <>
                        <Text style={[styles.heroPartDescription, !isActive && { color: '#1a1a1a' }, { textAlign: rtlTextAlign(isRTL) }]}>
                            {request.part_category}{(request as any).part_subcategory ? ` > ${(request as any).part_subcategory}` : ''}
                        </Text>
                        {request.part_description && request.part_description !== request.part_category && (
                            <Text style={[styles.heroPartNotes, !isActive && { color: '#525252' }, { textAlign: rtlTextAlign(isRTL) }]}>
                                {request.part_description}
                            </Text>
                        )}
                    </>
                ) : (
                    <Text style={[styles.heroPartDescription, !isActive && { color: '#1a1a1a' }, { textAlign: rtlTextAlign(isRTL) }]}>
                        {request.part_description}
                    </Text>
                )}
            </View>

            {/* Part Number & VIN */}
            {(request.part_number || request.vin_number) && (
                <View style={[styles.heroMetaRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    {request.part_number && (
                        <View style={styles.heroMetaItem}>
                            <Text style={[styles.heroMetaLabel, !isActive && { color: '#737373' }, { textAlign: rtlTextAlign(isRTL) }]}>{t('requestDetail.partNumber')}</Text>
                            <Text style={[styles.heroMetaValue, !isActive && { color: '#1a1a1a' }, { textAlign: rtlTextAlign(isRTL) }]}>
                                {request.part_number}
                            </Text>
                        </View>
                    )}
                    {request.vin_number && (
                        <View style={styles.heroMetaItem}>
                            <Text style={[styles.heroMetaLabel, !isActive && { color: '#737373' }, { textAlign: rtlTextAlign(isRTL) }]}>{t('common.vin')}</Text>
                            <Text style={[styles.heroMetaValue, !isActive && { color: '#1a1a1a' }, { textAlign: rtlTextAlign(isRTL) }]}>
                                {request.vin_number}
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {/* Images */}
            {request.image_urls && request.image_urls.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.heroImages}>
                    {request.image_urls.map((url, index) => {
                        const fullUrl = url.startsWith('http') ? url : `${UPLOAD_BASE_URL}${url}`;
                        return (
                            <TouchableOpacity
                                key={index}
                                onPress={() => {
                                    const images = request.image_urls!.map(u =>
                                        u.startsWith('http') ? u : `${UPLOAD_BASE_URL}${u}`
                                    );
                                    onImagePress(images, index);
                                }}
                                activeOpacity={0.85}
                            >
                                <Image source={{ uri: fullUrl }} style={styles.heroImage} />
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}

            {/* Vehicle ID Photos */}
            {((request as any).car_front_image_url || (request as any).car_rear_image_url) && (
                <>
                    <Text style={[styles.heroLabel, !isActive && { color: '#525252' }, { textAlign: rtlTextAlign(isRTL) }]}>
                        {t('newRequest.vehicleIdPhotos')}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.heroImages}>
                        {(request as any).car_front_image_url && (
                            <View style={{ marginRight: 12 }}>
                                <TouchableOpacity
                                    onPress={() => {
                                        const url = (request as any).car_front_image_url;
                                        const fullUrl = url.startsWith('http') ? url : `${UPLOAD_BASE_URL}${url}`;
                                        onImagePress([fullUrl], 0);
                                    }}
                                    activeOpacity={0.85}
                                >
                                    <Image
                                        source={{
                                            uri: ((request as any).car_front_image_url as string).startsWith('http')
                                                ? (request as any).car_front_image_url
                                                : `${UPLOAD_BASE_URL}${(request as any).car_front_image_url}`
                                        }}
                                        style={styles.heroImage}
                                    />
                                    <Text style={styles.vehiclePhotoLabel}>{t('newRequest.frontView')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {(request as any).car_rear_image_url && (
                            <View>
                                <TouchableOpacity
                                    onPress={() => {
                                        const url = (request as any).car_rear_image_url;
                                        const fullUrl = url.startsWith('http') ? url : `${UPLOAD_BASE_URL}${url}`;
                                        onImagePress([fullUrl], 0);
                                    }}
                                    activeOpacity={0.85}
                                >
                                    <Image
                                        source={{
                                            uri: ((request as any).car_rear_image_url as string).startsWith('http')
                                                ? (request as any).car_rear_image_url
                                                : `${UPLOAD_BASE_URL}${(request as any).car_rear_image_url}`
                                        }}
                                        style={styles.heroImage}
                                    />
                                    <Text style={styles.vehiclePhotoLabel}>{t('newRequest.rearView')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                </>
            )}
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    heroCard: {
        margin: Spacing.lg,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        ...Shadows.lg,
    },
    heroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    heroStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    heroStatusIcon: { fontSize: 12, marginRight: Spacing.xs },
    heroStatusText: { fontSize: FontSizes.sm, fontWeight: '700' },
    countdownBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    countdownIcon: { fontSize: 12, marginRight: 4 },
    countdownText: { fontSize: FontSizes.sm, fontWeight: '700' },
    heroCarInfo: { flexDirection: 'row', alignItems: 'center' },
    heroCarEmoji: { fontSize: 48, marginRight: Spacing.md },
    heroCarDetails: { flex: 1 },
    heroCarName: { fontSize: FontSizes.xxl, fontWeight: '800', color: '#fff' },
    heroCarYear: { fontSize: FontSizes.lg, color: '#C9A227', fontWeight: '600' },
    heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: Spacing.lg },
    heroSection: { marginBottom: Spacing.md },
    heroLabel: {
        fontSize: FontSizes.xs,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.6)',
        letterSpacing: 1,
        marginBottom: Spacing.xs,
    },
    heroPartDescription: { fontSize: FontSizes.lg, color: '#fff', lineHeight: 24 },
    heroPartNotes: { fontSize: FontSizes.sm, color: 'rgba(255,255,255,0.7)', marginTop: Spacing.xs, lineHeight: 20 },
    heroMetaRow: { flexDirection: 'row', gap: Spacing.xl, marginTop: Spacing.md },
    heroMetaItem: {},
    heroMetaLabel: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
    heroMetaValue: { fontSize: FontSizes.md, color: '#fff', fontFamily: 'monospace' },
    heroImages: { marginTop: Spacing.lg },
    heroImage: { width: 80, height: 80, borderRadius: BorderRadius.md, marginRight: Spacing.sm },
    vehiclePhotoLabel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: 80,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingVertical: 3,
        fontSize: 9,
        color: '#fff',
        fontWeight: '600',
        textAlign: 'center',
        letterSpacing: 0.3,
        borderBottomLeftRadius: BorderRadius.md,
        borderBottomRightRadius: BorderRadius.md,
    },
});

export default HeroRequestCard;
