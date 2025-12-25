// QScrap Order Detail Screen - Full Featured with Tracking
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api, Order } from '../services/api';
import { SOCKET_URL } from '../config/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { RootStackParamList } from '../../App';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function OrderDetailScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute();
    const { orderId } = route.params as { orderId: string };

    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConfirming, setIsConfirming] = useState(false);
    const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

    useEffect(() => {
        loadOrderDetails();
    }, []);

    const loadOrderDetails = async () => {
        try {
            const data = await api.getMyOrders();
            const foundOrder = data.orders?.find((o: Order) => o.order_id === orderId);
            setOrder(foundOrder || null);
        } catch (error) {
            console.log('Failed to load order:', error);
            Alert.alert('Error', 'Failed to load order details');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmDelivery = async () => {
        Alert.alert(
            'Confirm Delivery',
            'Have you received your part? This will complete the order.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm Receipt',
                    onPress: async () => {
                        setIsConfirming(true);
                        try {
                            await api.confirmDelivery(orderId);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            Alert.alert(
                                'Order Completed!',
                                'Thank you for using QScrap. Your order is now complete.',
                                [{ text: 'OK', onPress: () => navigation.goBack() }]
                            );
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to confirm delivery');
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        } finally {
                            setIsConfirming(false);
                        }
                    },
                },
            ]
        );
    };

    const handleCallDriver = () => {
        if (order?.driver_phone) {
            Linking.openURL(`tel:${order.driver_phone}`);
        }
    };

    const handleDownloadInvoice = async () => {
        if (!order) return;

        setIsDownloadingInvoice(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const token = await api.getToken();

            // Step 1: Generate invoice (or get existing)
            const generateResponse = await fetch(`${SOCKET_URL}/api/documents/invoice/${order.order_id}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            let documentId = null;

            if (generateResponse.ok) {
                const invoiceData = await generateResponse.json();
                // API returns {document: {document_id: ...}}
                documentId = invoiceData.document?.document_id || invoiceData.document_id;
            } else {
                // Try to get existing invoice
                const docsResponse = await fetch(`${SOCKET_URL}/api/documents/order/${order.order_id}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const docsData = await docsResponse.json();
                const existingInvoice = docsData.documents?.find((d: any) => d.document_type === 'invoice');

                if (existingInvoice) {
                    documentId = existingInvoice.document_id;
                }
            }

            if (!documentId) {
                throw new Error('Could not generate or find invoice');
            }

            // Open PDF in browser (handles download natively)
            const pdfUrl = `${SOCKET_URL}/api/documents/${documentId}/download?token=${token}`;
            await Linking.openURL(pdfUrl);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error: any) {
            console.log('Invoice download error:', error);
            Alert.alert('Error', error.message || 'Failed to download invoice');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsDownloadingInvoice(false);
        }
    };

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'confirmed': return {
                color: Colors.info,
                icon: '✓',
                label: 'Confirmed',
                description: 'Garage has confirmed your order'
            };
            case 'preparing': return {
                color: Colors.warning,
                icon: '🔧',
                label: 'Preparing',
                description: 'Garage is preparing your part'
            };
            case 'ready_for_pickup': return {
                color: Colors.info,
                icon: '📦',
                label: 'Ready for Pickup',
                description: 'Driver will pick up soon'
            };
            case 'picked_up': return {
                color: Colors.info,
                icon: '🚚',
                label: 'Picked Up',
                description: 'Driver has picked up your part'
            };
            case 'in_transit': return {
                color: Colors.primary,
                icon: '🚗',
                label: 'On The Way',
                description: 'Your part is on the way!'
            };
            case 'delivered': return {
                color: Colors.success,
                icon: '📍',
                label: 'Delivered',
                description: 'Please confirm receipt'
            };
            case 'completed': return {
                color: Colors.success,
                icon: '✅',
                label: 'Completed',
                description: 'Order completed successfully'
            };
            default: return {
                color: Colors.dark.textMuted,
                icon: '•',
                label: status,
                description: ''
            };
        }
    };

    const getStepProgress = (status: string) => {
        const steps = ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered', 'completed'];
        const currentIndex = steps.indexOf(status);
        return currentIndex >= 0 ? currentIndex : 0;
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 100 }} />
            </SafeAreaView>
        );
    }

    if (!order) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>Order not found</Text>
            </SafeAreaView>
        );
    }

    const statusInfo = getStatusInfo(order.order_status);
    const stepProgress = getStepProgress(order.order_status);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Order #{order.order_number}</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Status Card */}
                <View style={[styles.statusCard, { borderColor: statusInfo.color }]}>
                    <LinearGradient
                        colors={[statusInfo.color + '20', statusInfo.color + '05']}
                        style={styles.statusGradient}
                    >
                        <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
                        <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
                            {statusInfo.label}
                        </Text>
                        <Text style={styles.statusDescription}>{statusInfo.description}</Text>
                    </LinearGradient>
                </View>

                {/* Progress Steps */}
                <View style={styles.progressContainer}>
                    <Text style={styles.sectionTitle}>Order Progress</Text>
                    <View style={styles.progressSteps}>
                        {['Confirmed', 'Preparing', 'Ready', 'Picked Up', 'On Way', 'Delivered', 'Complete'].map((step, index) => (
                            <View key={step} style={styles.progressStep}>
                                <View style={[
                                    styles.progressDot,
                                    index <= stepProgress && styles.progressDotActive
                                ]}>
                                    {index <= stepProgress && <Text style={styles.progressCheck}>✓</Text>}
                                </View>
                                {index < 6 && (
                                    <View style={[
                                        styles.progressLine,
                                        index < stepProgress && styles.progressLineActive
                                    ]} />
                                )}
                            </View>
                        ))}
                    </View>
                    <View style={styles.progressLabels}>
                        {['Confirmed', 'Preparing', 'Ready', 'Picked', 'Transit', 'Delivered', 'Done'].map((step, index) => (
                            <Text key={step} style={[
                                styles.progressLabel,
                                index <= stepProgress && styles.progressLabelActive
                            ]}>{step}</Text>
                        ))}
                    </View>
                </View>

                {/* Driver Info (if in transit) */}
                {order.driver_name && order.order_status === 'in_transit' && (
                    <View style={styles.driverCard}>
                        <View style={styles.driverInfo}>
                            <View style={styles.driverAvatar}>
                                <Text style={styles.driverAvatarText}>🚗</Text>
                            </View>
                            <View>
                                <Text style={styles.driverLabel}>Your Driver</Text>
                                <Text style={styles.driverName}>{order.driver_name}</Text>
                            </View>
                        </View>
                        {order.driver_phone && (
                            <TouchableOpacity style={styles.callButton} onPress={handleCallDriver}>
                                <Text style={styles.callIcon}>📞</Text>
                                <Text style={styles.callText}>Call</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Live Map Button - when driver is on the way */}
                {['picked_up', 'in_transit'].includes(order.order_status) && (
                    <TouchableOpacity
                        style={styles.mapButton}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            navigation.navigate('Tracking', {
                                orderId: order.order_id,
                                orderNumber: order.order_number,
                                deliveryAddress: order.delivery_address,
                            });
                        }}
                    >
                        <LinearGradient
                            colors={['#3b82f6', '#1d4ed8'] as const}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.mapButtonGradient}
                        >
                            <Text style={styles.mapButtonIcon}>🗺️</Text>
                            <Text style={styles.mapButtonText}>Open Live Map</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Order Details */}
                <View style={styles.detailsCard}>
                    <Text style={styles.sectionTitle}>Order Details</Text>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Garage</Text>
                        <Text style={styles.detailValue}>{order.garage_name}</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Vehicle</Text>
                        <Text style={styles.detailValue}>
                            {order.car_make} {order.car_model} ({order.car_year})
                        </Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Part Price</Text>
                        <Text style={styles.detailValue}>{order.part_price} QAR</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Delivery Fee</Text>
                        <Text style={styles.detailValue}>{order.delivery_fee} QAR</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.detailRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>{order.total_amount} QAR</Text>
                    </View>

                    {/* Download Invoice Button - for completed orders */}
                    {order.order_status === 'completed' && (
                        <TouchableOpacity
                            style={[styles.invoiceButton, isDownloadingInvoice && styles.invoiceButtonDisabled]}
                            onPress={handleDownloadInvoice}
                            disabled={isDownloadingInvoice}
                        >
                            <LinearGradient
                                colors={['#6366f1', '#4f46e5'] as const}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.invoiceGradient}
                            >
                                {isDownloadingInvoice ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <>
                                        <Text style={styles.invoiceIcon}>📄</Text>
                                        <Text style={styles.invoiceText}>Download Invoice</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Delivery Address */}
                {order.delivery_address && (
                    <View style={styles.addressCard}>
                        <Text style={styles.sectionTitle}>Delivery Address</Text>
                        <View style={styles.addressRow}>
                            <Text style={styles.addressIcon}>📍</Text>
                            <Text style={styles.addressText}>{order.delivery_address}</Text>
                        </View>
                    </View>
                )}

                {/* Confirm Delivery Button */}
                {order.order_status === 'delivered' && (
                    <TouchableOpacity
                        style={[styles.confirmButton, isConfirming && styles.confirmButtonDisabled]}
                        onPress={handleConfirmDelivery}
                        disabled={isConfirming}
                    >
                        <LinearGradient
                            colors={Colors.gradients.primary}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.confirmGradient}
                        >
                            {isConfirming ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Text style={styles.confirmIcon}>✅</Text>
                                    <Text style={styles.confirmText}>Confirm I Received the Part</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Order Date */}
                <View style={styles.metaInfo}>
                    <Text style={styles.metaText}>
                        Ordered on {new Date(order.created_at).toLocaleDateString()} at{' '}
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.dark.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
    },
    backButton: { padding: Spacing.sm },
    backText: { color: Colors.primary, fontSize: FontSizes.lg, fontWeight: '600' },
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.dark.text },
    scrollView: { flex: 1, padding: Spacing.lg },
    errorText: {
        color: Colors.error,
        fontSize: FontSizes.lg,
        textAlign: 'center',
        marginTop: 100
    },
    statusCard: {
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        borderWidth: 2,
        marginBottom: Spacing.lg,
    },
    statusGradient: {
        padding: Spacing.xl,
        alignItems: 'center',
    },
    statusIcon: { fontSize: 48, marginBottom: Spacing.sm },
    statusLabel: { fontSize: FontSizes.xxl, fontWeight: '700' },
    statusDescription: {
        fontSize: FontSizes.md,
        color: Colors.dark.textSecondary,
        marginTop: Spacing.xs
    },
    progressContainer: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.dark.text,
        marginBottom: Spacing.md,
    },
    progressSteps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    progressStep: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    progressDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.dark.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressDotActive: { backgroundColor: Colors.primary },
    progressCheck: { color: '#fff', fontSize: 12, fontWeight: '700' },
    progressLine: { flex: 1, height: 3, backgroundColor: Colors.dark.border },
    progressLineActive: { backgroundColor: Colors.primary },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
    progressLabel: { fontSize: FontSizes.xs, color: Colors.dark.textMuted, textAlign: 'center', width: 45 },
    progressLabelActive: { color: Colors.primary, fontWeight: '600' },
    driverCard: {
        backgroundColor: Colors.primary + '20',
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    driverInfo: { flexDirection: 'row', alignItems: 'center' },
    driverAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Colors.dark.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    driverAvatarText: { fontSize: 24 },
    driverLabel: { fontSize: FontSizes.sm, color: Colors.dark.textSecondary },
    driverName: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.dark.text },
    callButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
    },
    callIcon: { fontSize: 16, marginRight: Spacing.xs },
    callText: { color: '#fff', fontWeight: '600' },
    detailsCard: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    detailLabel: { fontSize: FontSizes.md, color: Colors.dark.textSecondary },
    detailValue: { fontSize: FontSizes.md, color: Colors.dark.text, textAlign: 'right', flex: 1 },
    divider: { height: 1, backgroundColor: Colors.dark.border, marginVertical: Spacing.md },
    totalLabel: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.dark.text },
    totalValue: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.primary },
    addressCard: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    addressRow: { flexDirection: 'row', alignItems: 'flex-start' },
    addressIcon: { fontSize: 20, marginRight: Spacing.sm },
    addressText: { fontSize: FontSizes.md, color: Colors.dark.text, flex: 1, lineHeight: 22 },
    confirmButton: { borderRadius: BorderRadius.lg, overflow: 'hidden', marginBottom: Spacing.lg },
    confirmButtonDisabled: { opacity: 0.7 },
    confirmGradient: {
        flexDirection: 'row',
        paddingVertical: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmIcon: { fontSize: 20, marginRight: Spacing.sm },
    confirmText: { fontSize: FontSizes.lg, fontWeight: '700', color: '#fff' },
    metaInfo: { alignItems: 'center', marginTop: Spacing.md },
    metaText: { fontSize: FontSizes.sm, color: Colors.dark.textMuted },
    mapButton: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        marginBottom: Spacing.lg,
    },
    mapButtonGradient: {
        flexDirection: 'row',
        paddingVertical: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mapButtonIcon: { fontSize: 24, marginRight: Spacing.sm },
    mapButtonText: { fontSize: FontSizes.lg, fontWeight: '700', color: '#fff' },
    // Invoice Button Styles
    invoiceButton: {
        marginTop: Spacing.lg,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        ...Shadows.md,
    },
    invoiceButtonDisabled: {
        opacity: 0.6,
    },
    invoiceGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
    },
    invoiceIcon: {
        fontSize: 20,
        marginRight: Spacing.sm,
    },
    invoiceText: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        color: '#fff',
    },
});
