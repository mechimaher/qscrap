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
import { api } from '../services';
import { Spacing, BorderRadius, FontSize, Shadows } from '../constants';

import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';

const CancellationPreviewScreen: React.FC = () => {
    const { colors } = useTheme();
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { orderId } = route.params as { orderId: string };
    const { t, isRTL } = useTranslation();

    const CANCELLATION_REASONS = [
        { id: 'changed_mind', label: t('cancel.changedMind'), icon: 'refresh-outline' },
        { id: 'found_elsewhere', label: t('cancel.foundElsewhere'), icon: 'search-outline' },
        { id: 'too_long', label: t('cancel.takingTooLong'), icon: 'time-outline' },
        { id: 'price_issue', label: t('cancel.priceIssue'), icon: 'pricetag-outline' },
        { id: 'other', label: t('cancel.other'), icon: 'ellipsis-horizontal-outline' },
    ];

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
            const response = await api.getCancellationPreview(orderId);
            setPreview(response.data);

        } catch (error: any) {
            Alert.alert(t('common.error'), error.response?.data?.error || t('cancel.loadFailed'));
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!selectedReason) {
            Alert.alert(t('common.required'), t('cancel.selectReason'));
            return;
        }

        const reason = selectedReason === 'other' ? otherReason :
            CANCELLATION_REASONS.find(r => r.id === selectedReason)?.label || selectedReason;

        if (selectedReason === 'other' && !otherReason.trim()) {
            Alert.alert(t('common.required'), t('cancel.provideReason'));
            return;
        }

        Alert.alert(
            t('cancel.confirmTitle'),
            t('cancel.confirmMessage', { fee: preview?.fee || 0, refund: preview?.refundAmount || 0 }),
            [
                { text: t('cancel.noKeepOrder'), style: 'cancel' },
                {
                    text: t('cancel.yesCancel'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setSubmitting(true);
                            await api.cancelOrder(orderId, reason);
                            Alert.alert(t('cancel.cancelled'), t('cancel.refundProcessed'));
                            navigation.navigate('MainTabs');
                        } catch (error: any) {
                            Alert.alert(t('common.error'), error.response?.data?.error || t('cancel.cancelFailed'));
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
            <View style={[styles.header, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('cancel.title')}</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                {/* Warning Banner */}
                <View style={[styles.warningBanner, { backgroundColor: colors.warning + '15', flexDirection: rtlFlexDirection(isRTL) }]}>
                    <Ionicons name="warning" size={24} color={colors.warning} />
                    <Text style={[styles.warningText, { color: colors.warning, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('cancel.feeWarning')}
                    </Text>
                </View>

                {/* Order Summary */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                    <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{t('cancel.orderSummary')}</Text>
                    <Text style={[styles.orderNumber, { color: colors.primary, textAlign: rtlTextAlign(isRTL) }]}>#{preview?.order_number}</Text>
                    <Text style={[styles.partDesc, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>{preview?.part_description}</Text>
                    <Text style={[styles.price, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{preview?.total_amount} {t('common.currency')}</Text>
                </View>

                {/* Fee Breakdown */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                    <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{t('cancel.refundDetails')}</Text>

                    <View style={[styles.feeRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                        <Text style={{ color: colors.textSecondary }}>{t('cancel.orderTotal')}</Text>
                        <Text style={{ color: colors.text, fontWeight: '600' }}>{preview?.total_amount} {t('common.currency')}</Text>
                    </View>

                    {preview?.fee > 0 && (
                        <View style={[styles.feeRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={{ color: colors.danger }}>{t('cancel.cancellationFee')} ({preview?.feeRate}%)</Text>
                            <Text style={{ color: colors.danger, fontWeight: '600' }}>-{preview?.fee} {t('common.currency')}</Text>
                        </View>
                    )}

                    <View style={[styles.feeRow, styles.totalRow, { borderTopColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: FontSize.lg }}>{t('cancel.refundAmount')}</Text>
                        <Text style={{ color: colors.success, fontWeight: '700', fontSize: FontSize.xl }}>{preview?.refundAmount} {t('common.currency')}</Text>
                    </View>
                </View>

                {/* Reason Selection */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                    <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{t('cancel.reasonTitle')}</Text>

                    {CANCELLATION_REASONS.map(reason => (
                        <TouchableOpacity
                            key={reason.id}
                            style={[
                                styles.reasonOption,
                                {
                                    backgroundColor: selectedReason === reason.id ? colors.primary + '15' : colors.surfaceSecondary,
                                    borderColor: selectedReason === reason.id ? colors.primary : 'transparent',
                                    flexDirection: rtlFlexDirection(isRTL)
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
                                { color: selectedReason === reason.id ? colors.primary : colors.text, textAlign: rtlTextAlign(isRTL) }
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
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, textAlign: rtlTextAlign(isRTL) }]}
                            placeholder={t('cancel.otherReasonPlaceholder')}
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
                                <Text style={styles.cancelBtnText}>{t('cancel.confirmAction')}</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.keepBtn, { borderColor: colors.border }]}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={[styles.keepBtnText, { color: colors.text }]}>{t('cancel.keepOrder')}</Text>
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
