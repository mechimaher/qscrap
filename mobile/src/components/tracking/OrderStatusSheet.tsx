import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Linking, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { rtlFlexDirection, rtlTextAlign } from '../../utils/rtl';

const { height } = Dimensions.get('window');

interface OrderStatusSheetProps {
    t: any;
    isRTL: boolean;
    navigation: any;
    orderId: string;
    orderNumber: string;
    bottomSheetY: Animated.Value;
    panResponder: any;
    eta: string | null;
    distance: string | null;
    driverInfo: { id?: string; name: string; phone: string; vehicle: string } | null;
    orderDetails: any;
    onShareLocation: () => void;
    deliveryOtp: string | null;
    otpExpiresAt: string | null;
    isOtpLoading: boolean;
    onRefreshOtp: () => void;
}

const getStatusIndex = (status: string): number => {
    const statusMapping: Record<string, number> = {
        'confirmed': 0, 'preparing': 0, 'ready_for_pickup': 0, 'collected': 0,
        'qc_in_progress': 0, 'qc_passed': 0,
        'in_transit': 1, 'arriving': 1,
        'delivered': 2, 'completed': 3,
    };
    return statusMapping[status] ?? 0;
};

const getExpiryLabel = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const expiry = new Date(expiresAt).getTime();
    if (Number.isNaN(expiry)) return null;
    const diffMs = expiry - Date.now();
    if (diffMs <= 0) return '0m';
    const minutes = Math.max(1, Math.round(diffMs / 60000));
    if (minutes >= 60) {
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hrs}h ${mins}m`;
    }
    return `${minutes}m`;
};

export default function OrderStatusSheet({
    t,
    isRTL,
    navigation,
    orderId,
    orderNumber,
    bottomSheetY,
    panResponder,
    eta,
    distance,
    driverInfo,
    orderDetails,
    onShareLocation,
    deliveryOtp,
    otpExpiresAt,
    isOtpLoading,
    onRefreshOtp,
}: OrderStatusSheetProps) {
    const renderTimeline = () => {
        if (!orderDetails) return null;
        return (
            <View style={styles.statusTimeline}>
                {['prepared', 'in_transit', 'delivered', 'completed'].map((step, index) => {
                    const statusIdx = getStatusIndex(orderDetails.order_status);
                    const isCompleted = statusIdx > index;
                    const isCurrent = statusIdx === index;
                    const labels = [t('tracking.timelinePrepared'), t('tracking.timelineInTransit'), t('tracking.timelineDelivered'), t('tracking.timelineCompleted')];
                    const icons: (keyof typeof Ionicons.glyphMap)[] = ['checkmark', 'car-sport', 'cube', 'star'];

                    return (
                        <React.Fragment key={step}>
                            <View style={styles.timelineStep}>
                                <View style={[
                                    styles.timelineNode,
                                    isCompleted && styles.timelineNodeCompleted,
                                    isCurrent && styles.timelineNodeCurrent,
                                ]}>
                                    <Text style={[
                                        styles.timelineIcon,
                                        (isCompleted || isCurrent) && styles.timelineIconActive,
                                    ]}>
                                        {isCompleted || isCurrent ? <Ionicons name={icons[index]} size={14} color="#fff" /> : <Text style={styles.timelineIcon}>○</Text>}
                                    </Text>
                                </View>
                                <Text style={[
                                    styles.timelineLabel,
                                    isCompleted && styles.timelineLabelCompleted,
                                    isCurrent && styles.timelineLabelCurrent,
                                ]}>
                                    {labels[index]}
                                </Text>
                            </View>
                            {index < 3 && (
                                <View style={[
                                    styles.timelineConnector,
                                    isCompleted && styles.timelineConnectorCompleted,
                                ]} />
                            )}
                        </React.Fragment>
                    );
                })}
            </View>
        );
    };

    return (
        <Animated.View
            style={[styles.bottomSheet, { transform: [{ translateY: bottomSheetY }] }]}
            {...panResponder.panHandlers}
        >
            <View style={styles.handle} />

            <LinearGradient colors={Colors.gradients.primaryDark} style={styles.etaCard}>
                <View style={styles.etaContent}>
                    <Text style={[styles.etaLabel, { textAlign: rtlTextAlign(isRTL) }]}>{t('tracking.estimatedArrival')}</Text>
                    <View style={[styles.etaRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                        {eta ? (
                            <>
                                <Text style={styles.etaTime}>{eta}</Text>
                                {distance && <Text style={styles.etaDistance}>• {distance} {t('tracking.away')}</Text>}
                            </>
                        ) : (
                            <Text style={styles.etaCalculating}>{t('common.loading')}</Text>
                        )}
                    </View>
                </View>
                <View style={styles.etaIcon}>
                    <Ionicons name="car-sport" size={40} color="#fff" />
                </View>
            </LinearGradient>

            {driverInfo && (
                <View style={styles.driverCard}>
                    <View style={styles.driverAvatar}>
                        <Ionicons name="person" size={24} color={Colors.primary} />
                    </View>
                    <View style={styles.driverDetails}>
                        <Text style={styles.driverName}>{driverInfo.name}</Text>
                        <Text style={styles.driverVehicle}>{driverInfo.vehicle}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.callDriverButton}
                        onPress={() => {
                            if (driverInfo?.phone) {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                Linking.openURL(`tel:${driverInfo.phone}`);
                            } else {
                                Alert.alert(t('tracking.noPhone'), t('tracking.noPhoneMsg'));
                            }
                        }}
                    >
                        <Ionicons name="call-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.messageDriverButton}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            navigation.navigate('Chat', {
                                orderId: orderId,
                                orderNumber: orderNumber,
                                recipientName: driverInfo?.name || t('common.driver'),
                                recipientType: 'driver',
                            });
                        }}
                    >
                        <Ionicons name="chatbubble-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}

            {orderDetails && (
                <View style={styles.orderCard}>
                    {deliveryOtp && (
                        <View style={styles.otpCard}>
                            <View style={styles.otpHeader}>
                                <View style={styles.otpBadge}>
                                    <Ionicons name="lock-closed" size={16} color="#fff" />
                                    <Text style={styles.otpBadgeText}>{t('tracking.secureOtp')}</Text>
                                </View>
                                {otpExpiresAt && (
                                    <Text style={styles.otpExpiry}>
                                        {t('tracking.otpExpiresIn', { time: getExpiryLabel(otpExpiresAt) })}
                                    </Text>
                                )}
                            </View>

                            <Text style={styles.otpCode}>{deliveryOtp}</Text>
                            <Text style={[styles.otpHint, { textAlign: rtlTextAlign(isRTL) }]}>
                                {t('tracking.otpInstruction')}
                            </Text>

                            <View style={[styles.otpActions, { flexDirection: rtlFlexDirection(isRTL) }]}>
                                <TouchableOpacity
                                    style={styles.otpActionButton}
                                    onPress={async () => {
                                        await Clipboard.setStringAsync(deliveryOtp);
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                >
                                    <Ionicons name="copy-outline" size={18} color={Colors.primary} />
                                    <Text style={styles.otpActionText}>{t('tracking.copyOtp')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.otpActionButton}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        onRefreshOtp();
                                    }}
                                    disabled={isOtpLoading}
                                >
                                    {isOtpLoading ? (
                                        <ActivityIndicator size="small" color={Colors.primary} />
                                    ) : (
                                        <>
                                            <Ionicons name="refresh" size={18} color={Colors.primary} />
                                            <Text style={styles.otpActionText}>{t('tracking.refreshOtp')}</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {renderTimeline()}
                    
                    <View style={styles.orderInfoRow}>
                        <View style={styles.garageSection}>
                            <Text style={[styles.orderLabel, { textAlign: rtlTextAlign(isRTL) }]}>{t('tracking.from')}</Text>
                            <Text style={styles.garageName}>{orderDetails.garage_name}</Text>
                        </View>
                        <View style={styles.partSection}>
                            <Text style={styles.partName} numberOfLines={2}>{orderDetails.part_description}</Text>
                            <View style={styles.partBadges}>
                                <View style={styles.conditionBadge}>
                                    <Text style={styles.conditionText}>{orderDetails.part_condition.replace('_', ' ').toUpperCase()}</Text>
                                </View>
                                {orderDetails.warranty_days > 0 && (
                                    <View style={styles.warrantyBadge}>
                                        <Text style={styles.warrantyText}>{t('tracking.warranty', { days: orderDetails.warranty_days })}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>

                    <View style={styles.pricingSection}>
                        <View style={[styles.priceRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={styles.priceLabel}>{t('order.partPrice')}</Text>
                            <Text style={styles.priceValue}>{orderDetails.part_price.toFixed(0)} {t('common.currency')}</Text>
                        </View>
                        <View style={[styles.priceRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={styles.priceLabel}>{t('order.deliveryFee')}</Text>
                            <Text style={styles.priceValue}>{orderDetails.delivery_fee.toFixed(0)} {t('common.currency')}</Text>
                        </View>
                        {orderDetails.loyalty_discount > 0 && (
                            <View style={[styles.priceRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                                <Text style={[styles.priceLabel, { color: Colors.success }]}>{t('order.loyaltyDiscount')}</Text>
                                <Text style={[styles.priceValue, { color: Colors.success }]}>-{orderDetails.loyalty_discount.toFixed(0)} {t('common.currency')}</Text>
                            </View>
                        )}
                        <View style={styles.priceDivider} />
                        <View style={[styles.priceRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={styles.totalLabel}>{t('common.total')}</Text>
                            <Text style={styles.totalValue}>{orderDetails.total_amount.toFixed(0)} {t('common.currency')}</Text>
                        </View>
                    </View>
                </View>
            )}

            <TouchableOpacity style={styles.shareLocationCard} onPress={onShareLocation}>
                <LinearGradient colors={Colors.gradients.premium} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.shareLocationGradient}>
                    <Ionicons name="location" size={24} color="#fff" style={{ marginRight: 8 }} />
                    <View style={styles.shareLocationText}>
                        <Text style={styles.shareLocationTitle}>{t('tracking.shareLocation')}</Text>
                        <Text style={styles.shareLocationSubtitle}>{t('tracking.shareLocationHint')}</Text>
                    </View>
                    <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>

            <View style={styles.sanitizationCard}>
                <Ionicons name="sparkles-outline" size={18} color={Colors.success} style={{ marginRight: Spacing.sm }} />
                <Text style={styles.sanitizationText}>{t('tracking.sanitizationPromise')}</Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    bottomSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: height * 0.75,
        backgroundColor: Colors.light.surface,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        padding: Spacing.lg,
        paddingBottom: Spacing.xxl,
        ...Shadows.lg,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.light.border,
        alignSelf: 'center',
        marginBottom: Spacing.lg,
    },
    etaCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.md,
    },
    etaContent: { flex: 1 },
    etaLabel: { fontSize: FontSizes.sm, color: 'rgba(255,255,255,0.7)' },
    etaRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: Spacing.xs },
    etaTime: { fontSize: FontSizes.xxxl, fontWeight: '800', color: '#fff' },
    etaDistance: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.8)', marginLeft: Spacing.sm },
    etaCalculating: { fontSize: FontSizes.lg, color: 'rgba(255,255,255,0.6)' },
    etaIcon: { marginLeft: Spacing.md },
    driverCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.light.surfaceSecondary,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.md,
    },
    driverAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Colors.light.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    driverDetails: { flex: 1, marginLeft: Spacing.md },
    driverName: { fontSize: FontSizes.lg, fontWeight: '600', color: Colors.light.text },
    driverVehicle: { fontSize: FontSizes.sm, color: Colors.light.textSecondary },
    callDriverButton: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.xl,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.sm,
    },
    messageDriverButton: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.xl,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    orderCard: {
        backgroundColor: Colors.light.surfaceSecondary,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    statusTimeline: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
        paddingHorizontal: Spacing.sm,
    },
    timelineStep: { alignItems: 'center' },
    timelineNode: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.light.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.light.border,
    },
    timelineNodeCompleted: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    timelineNodeCurrent: { borderColor: Colors.primary, borderWidth: 3 },
    timelineIcon: { fontSize: 16, color: Colors.light.text },
    timelineIconActive: { color: '#fff' },
    timelineLabel: {
        fontSize: FontSizes.xs,
        color: Colors.light.textMuted,
        marginTop: Spacing.xs,
        fontWeight: '500',
    },
    timelineLabelCompleted: { color: Colors.primary, fontWeight: '600' },
    timelineLabelCurrent: { color: Colors.primary, fontWeight: '700' },
    timelineConnector: {
        flex: 1,
        height: 3,
        backgroundColor: Colors.light.border,
        marginHorizontal: Spacing.xs,
        marginBottom: Spacing.lg,
    },
    timelineConnectorCompleted: { backgroundColor: Colors.primary },
    orderInfoRow: { marginBottom: Spacing.md },
    garageSection: { marginBottom: Spacing.sm },
    orderLabel: {
        fontSize: FontSizes.xs,
        color: Colors.light.textMuted,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    garageName: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.light.text,
        marginTop: Spacing.xs,
    },
    partSection: { marginTop: Spacing.sm },
    partName: {
        fontSize: FontSizes.md,
        color: Colors.light.textSecondary,
        marginBottom: Spacing.xs,
    },
    partBadges: { flexDirection: 'row', gap: Spacing.xs },
    conditionBadge: {
        backgroundColor: Colors.info + '20',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
    },
    conditionText: { fontSize: FontSizes.xs, color: Colors.info, fontWeight: '600' },
    warrantyBadge: {
        backgroundColor: Colors.success + '20',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
    },
    warrantyText: { fontSize: FontSizes.xs, color: Colors.success, fontWeight: '600' },
    pricingSection: {
        borderTopWidth: 1,
        borderTopColor: Colors.light.border,
        paddingTop: Spacing.sm,
        marginTop: Spacing.sm,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.xs,
    },
    priceLabel: { fontSize: FontSizes.sm, color: Colors.light.textMuted },
    priceValue: { fontSize: FontSizes.sm, color: Colors.light.textSecondary },
    priceDivider: {
        height: 1,
        backgroundColor: Colors.light.border,
        marginVertical: Spacing.xs,
    },
    totalLabel: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.light.text },
    totalValue: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.primary },
    shareLocationCard: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        marginTop: Spacing.md,
        ...Shadows.md,
    },
    shareLocationGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
    },
    shareLocationText: { flex: 1 },
    shareLocationTitle: { fontSize: FontSizes.md, fontWeight: '700', color: '#fff' },
    shareLocationSubtitle: { fontSize: FontSizes.xs, color: 'rgba(255, 255, 255, 0.8)', marginTop: 2 },
    otpCard: {
        backgroundColor: '#0f172a',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
    },
    otpHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    otpBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#22c55e33',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
    },
    otpBadgeText: { color: '#22c55e', fontWeight: '700', marginLeft: 6, fontSize: FontSizes.sm },
    otpExpiry: { color: '#cbd5e1', fontSize: FontSizes.xs },
    otpCode: { fontSize: 32, fontWeight: '800', letterSpacing: 4, color: '#fff', marginVertical: Spacing.xs },
    otpHint: { color: '#e2e8f0', fontSize: FontSizes.sm, marginBottom: Spacing.sm },
    otpActions: { flexDirection: 'row', gap: Spacing.md },
    otpActionButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    otpActionText: { color: Colors.primary, fontWeight: '700' },
    sanitizationCard: {
        marginTop: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.light.surfaceSecondary,
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    sanitizationText: { color: Colors.light.textSecondary, fontSize: FontSizes.sm, flex: 1 },
});
