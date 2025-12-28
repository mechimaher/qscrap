import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts';
import { cancellationApi } from '../services';
import { Spacing, BorderRadius, FontSize, Shadows } from '../constants';

const CANCELLATION_REASONS = [
    { id: 'changed_mind', label: 'Changed my mind', icon: 'refresh-outline' },
    { id: 'found_elsewhere', label: 'Found it elsewhere', icon: 'search-outline' },
    { id: 'too_long', label: 'Taking too long', icon: 'time-outline' },
    { id: 'price_issue', label: 'Price issue', icon: 'pricetag-outline' },
    { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

const CancellationPreviewScreen: React.FC = () => {
    const { colors } = useTheme();
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { orderId } = route.params as { orderId: string };

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [preview, setPreview] = useState<any>(null);
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [otherReason, setOtherReason] = useState('');

    useEffect(() => {
        loadPreview();
    }, [orderId]);

    const loadPreview = async () => {
        try {
            setLoading(true);
            const response = await cancellationApi.getPreview(orderId);
            setPreview(response.data);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to load cancellation details');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!selectedReason) {
            Alert.alert('Required', 'Please select a reason for cancellation');
            return;
        }

        const reason = selectedReason === 'other' ? otherReason :
            CANCELLATION_REASONS.find(r => r.id === selectedReason)?.label || selectedReason;

        if (selectedReason === 'other' && !otherReason.trim()) {
            Alert.alert('Required', 'Please provide a reason');
            return;
        }

        Alert.alert(
            'Confirm Cancellation',
            `Are you sure you want to cancel this order?\n\nCancellation fee: ${preview?.fee || 0} QAR\nRefund amount: ${preview?.refundAmount || 0} QAR`,
            [
                { text: 'No, Keep Order', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setSubmitting(true);
                            await cancellationApi.cancelOrder(orderId, reason);
                            Alert.alert('Cancelled', 'Your order has been cancelled. Refund will be processed within 3-5 business days.');
                            navigation.navigate('MainTabs');
                        } catch (error: any) {
                            Alert.alert('Error', error.response?.data?.error || 'Failed to cancel order');
                        } finally {
                            setSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Cancel Order</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                {/* Warning Banner */}
                <View style={[styles.warningBanner, { backgroundColor: colors.warning + '15' }]}>
                    <Ionicons name="warning" size={24} color={colors.warning} />
                    <Text style={[styles.warningText, { color: colors.warning }]}>
                        Cancellation may incur fees depending on order status
                    </Text>
                </View>

                {/* Order Summary */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Order Summary</Text>
                    <Text style={[styles.orderNumber, { color: colors.primary }]}>#{preview?.order_number}</Text>
                    <Text style={[styles.partDesc, { color: colors.textSecondary }]}>{preview?.part_description}</Text>
                    <Text style={[styles.price, { color: colors.text }]}>{preview?.total_amount} QAR</Text>
                </View>

                {/* Fee Breakdown */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Refund Details</Text>

                    <View style={styles.feeRow}>
                        <Text style={{ color: colors.textSecondary }}>Order Total</Text>
                        <Text style={{ color: colors.text, fontWeight: '600' }}>{preview?.total_amount} QAR</Text>
                    </View>

                    {preview?.fee > 0 && (
                        <View style={styles.feeRow}>
                            <Text style={{ color: colors.danger }}>Cancellation Fee ({preview?.feeRate}%)</Text>
                            <Text style={{ color: colors.danger, fontWeight: '600' }}>-{preview?.fee} QAR</Text>
                        </View>
                    )}

                    <View style={[styles.feeRow, styles.totalRow, { borderTopColor: colors.border }]}>
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: FontSize.lg }}>Refund Amount</Text>
                        <Text style={{ color: colors.success, fontWeight: '700', fontSize: FontSize.xl }}>{preview?.refundAmount} QAR</Text>
                    </View>
                </View>

                {/* Reason Selection */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Reason for Cancellation</Text>

                    {CANCELLATION_REASONS.map(reason => (
                        <TouchableOpacity
                            key={reason.id}
                            style={[
                                styles.reasonOption,
                                {
                                    backgroundColor: selectedReason === reason.id ? colors.primary + '15' : colors.surfaceSecondary,
                                    borderColor: selectedReason === reason.id ? colors.primary : 'transparent',
                                }
                            ]}
                            onPress={() => setSelectedReason(reason.id)}
                        >
                            <Ionicons
                                name={reason.icon as any}
                                size={20}
                                color={selectedReason === reason.id ? colors.primary : colors.textSecondary}
                            />
                            <Text style={[
                                styles.reasonText,
                                { color: selectedReason === reason.id ? colors.primary : colors.text }
                            ]}>
                                {reason.label}
                            </Text>
                            {selectedReason === reason.id && (
                                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                            )}
                        </TouchableOpacity>
                    ))}

                    {selectedReason === 'other' && (
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                            placeholder="Please specify..."
                            placeholderTextColor={colors.textMuted}
                            value={otherReason}
                            onChangeText={setOtherReason}
                            multiline
                        />
                    )}
                </View>

                {/* Action Buttons */}
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.cancelBtn, { backgroundColor: colors.danger }]}
                        onPress={handleCancel}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="close-circle" size={20} color="#fff" />
                                <Text style={styles.cancelBtnText}>Cancel Order</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.keepBtn, { borderColor: colors.border }]}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={[styles.keepBtnText, { color: colors.text }]}>Keep Order</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
    backBtn: { padding: Spacing.sm },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700' },
    content: { flex: 1, padding: Spacing.lg },

    warningBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.lg },
    warningText: { flex: 1, fontSize: FontSize.sm, fontWeight: '500' },

    section: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
    sectionTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: Spacing.md },
    orderNumber: { fontSize: FontSize.lg, fontWeight: '700' },
    partDesc: { fontSize: FontSize.md, marginTop: Spacing.xs },
    price: { fontSize: FontSize.lg, fontWeight: '600', marginTop: Spacing.sm },

    feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
    totalRow: { borderTopWidth: 1, paddingTop: Spacing.md, marginTop: Spacing.md },

    reasonOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
    },
    reasonText: { flex: 1, fontSize: FontSize.md },

    input: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, marginTop: Spacing.sm, height: 80, textAlignVertical: 'top' },

    actions: { gap: Spacing.md, marginTop: 'auto' },
    cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg, borderRadius: BorderRadius.lg },
    cancelBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
    keepBtn: { alignItems: 'center', padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1 },
    keepBtnText: { fontSize: FontSize.md, fontWeight: '600' },
});

export default CancellationPreviewScreen;
