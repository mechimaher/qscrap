import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    TextInput,
    ScrollView,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../contexts';
import { api } from '../services';
import { Spacing, BorderRadius, FontSize, Shadows } from '../constants';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';

// BRAIN v3.0 Return reasons
const RETURN_REASONS = [
    { id: 'unused', icon: 'cube-outline' },
    { id: 'defective', icon: 'warning-outline' },
    { id: 'wrong_part', icon: 'swap-horizontal-outline' },
] as const;

type ReturnReason = typeof RETURN_REASONS[number]['id'];

const ReturnRequestScreen: React.FC = () => {
    const { colors } = useTheme();
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { orderId } = route.params as { orderId: string };
    const { t, isRTL } = useTranslation();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [preview, setPreview] = useState<any>(null);
    const [selectedReason, setSelectedReason] = useState<ReturnReason | null>(null);
    const [photos, setPhotos] = useState<string[]>([]);
    const [conditionDescription, setConditionDescription] = useState('');
    const [abuseStatus, setAbuseStatus] = useState<any>(null);

    useEffect(() => {
        loadPreviewAndStatus();
    }, [orderId]);

    const loadPreviewAndStatus = async () => {
        try {
            setLoading(true);
            const [previewRes, abuseRes] = await Promise.all([
                api.getReturnPreview(orderId),
                api.getCustomerAbuseStatus(),
            ]);
            setPreview(previewRes);
            setAbuseStatus(abuseRes);
        } catch (error: any) {
            Alert.alert(t('common.error'), error.message || t('return.cannotReturn'));
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        if (photos.length >= 3) {
            Alert.alert(t('common.info'), 'Maximum 3 photos allowed');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled && result.assets[0]) {
            setPhotos([...photos, result.assets[0].uri]);
        }
    };

    const takePhoto = async () => {
        if (photos.length >= 3) {
            Alert.alert(t('common.info'), 'Maximum 3 photos allowed');
            return;
        }

        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('errors.permissionDenied'), t('errors.cameraRequired'));
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled && result.assets[0]) {
            setPhotos([...photos, result.assets[0].uri]);
        }
    };

    const removePhoto = (index: number) => {
        setPhotos(photos.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!selectedReason) {
            Alert.alert(t('common.required'), t('return.reasonTitle'));
            return;
        }

        if (photos.length < 3) {
            Alert.alert(t('common.required'), t('return.photoHint'));
            return;
        }

        Alert.alert(
            t('return.submitReturn'),
            t('return.submittedMessage'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.confirm'),
                    onPress: async () => {
                        try {
                            setSubmitting(true);
                            await api.createReturnRequest(orderId, {
                                reason: selectedReason,
                                photo_urls: photos,
                                condition_description: conditionDescription,
                            });
                            Alert.alert(t('return.submitted'), t('return.submittedMessage'));
                            navigation.navigate('MainTabs');
                        } catch (error: any) {
                            Alert.alert(t('common.error'), error.message);
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

    // Check if return is possible
    if (!preview?.can_return) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={[styles.header, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>{t('return.title')}</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.center}>
                    <Ionicons name="close-circle" size={64} color={colors.danger} />
                    <Text style={[styles.errorText, { color: colors.text }]}>{t('return.cannotReturn')}</Text>
                    <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>{preview?.reason || t('return.expired')}</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Check abuse limits
    if (abuseStatus && !abuseStatus.can_make_return) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={[styles.header, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>{t('return.title')}</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.center}>
                    <Ionicons name="hand-left" size={64} color={colors.warning} />
                    <Text style={[styles.errorText, { color: colors.text }]}>{t('return.abuseWarning')}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('return.title')}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Days Remaining Banner */}
                <View style={[styles.daysBanner, { backgroundColor: colors.success + '15' }]}>
                    <Ionicons name="time" size={24} color={colors.success} />
                    <Text style={[styles.daysText, { color: colors.success }]}>
                        {t('return.daysRemaining', { days: preview?.days_remaining || 0 })}
                    </Text>
                </View>

                {/* Reason Selection */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                    <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('return.reasonTitle')}
                    </Text>
                    {RETURN_REASONS.map(reason => (
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
                                { color: selectedReason === reason.id ? colors.primary : colors.text }
                            ]}>
                                {t(`return.${reason.id === 'wrong_part' ? 'wrongPart' : reason.id}`)}
                            </Text>
                            {selectedReason === reason.id && (
                                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Photo Upload */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                    <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('return.photoRequired')}
                    </Text>
                    <Text style={[styles.photoHint, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('return.photoHint')}
                    </Text>

                    <View style={styles.photoGrid}>
                        {photos.map((uri, index) => (
                            <View key={index} style={styles.photoContainer}>
                                <Image source={{ uri }} style={styles.photo} />
                                <TouchableOpacity
                                    style={[styles.removePhotoBtn, { backgroundColor: colors.danger }]}
                                    onPress={() => removePhoto(index)}
                                >
                                    <Ionicons name="close" size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ))}
                        {photos.length < 3 && (
                            <View style={styles.addPhotoButtons}>
                                <TouchableOpacity
                                    style={[styles.addPhotoBtn, { borderColor: colors.border }]}
                                    onPress={takePhoto}
                                >
                                    <Ionicons name="camera" size={24} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.addPhotoBtn, { borderColor: colors.border }]}
                                    onPress={pickImage}
                                >
                                    <Ionicons name="images" size={24} color={colors.primary} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                    <Text style={[styles.photoCount, { color: colors.textMuted }]}>
                        {t('return.photosAdded', { count: photos.length })}
                    </Text>
                </View>

                {/* Condition Description */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                    <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('return.conditionDescription')}
                    </Text>
                    <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, textAlign: rtlTextAlign(isRTL) }]}
                        placeholder={t('return.conditionPlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        value={conditionDescription}
                        onChangeText={setConditionDescription}
                        multiline
                    />
                </View>

                {/* Fee Breakdown */}
                <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.sm]}>
                    <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('return.feeBreakdown')}
                    </Text>

                    <View style={[styles.feeRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                        <Text style={{ color: colors.danger }}>{t('return.returnFee')}</Text>
                        <Text style={{ color: colors.danger, fontWeight: '600' }}>-{preview?.return_fee} {t('common.currency')}</Text>
                    </View>

                    {preview?.delivery_fee_retained > 0 && (
                        <View style={[styles.feeRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={{ color: colors.warning }}>{t('return.deliveryNonRefundable')}</Text>
                            <Text style={{ color: colors.warning, fontWeight: '600' }}>-{preview?.delivery_fee_retained} {t('common.currency')}</Text>
                        </View>
                    )}

                    <View style={[styles.feeRow, styles.totalRow, { borderTopColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: FontSize.lg }}>{t('return.refundAmount')}</Text>
                        <Text style={{ color: colors.success, fontWeight: '700', fontSize: FontSize.xl }}>{preview?.refund_amount} {t('common.currency')}</Text>
                    </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: (photos.length < 3 || !selectedReason) ? 0.5 : 1 }]}
                    onPress={handleSubmit}
                    disabled={submitting || photos.length < 3 || !selectedReason}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="arrow-undo" size={20} color="#fff" />
                            <Text style={styles.submitBtnText}>{t('return.submitReturn')}</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
    backBtn: { padding: Spacing.sm },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700' },
    content: { flex: 1, padding: Spacing.lg },

    daysBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.lg },
    daysText: { fontSize: FontSize.md, fontWeight: '600' },

    section: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
    sectionTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: Spacing.md },

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

    photoHint: { fontSize: FontSize.sm, marginBottom: Spacing.md },
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    photoContainer: { position: 'relative' },
    photo: { width: 80, height: 80, borderRadius: BorderRadius.md },
    removePhotoBtn: { position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    addPhotoButtons: { flexDirection: 'row', gap: Spacing.sm },
    addPhotoBtn: { width: 80, height: 80, borderRadius: BorderRadius.md, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
    photoCount: { fontSize: FontSize.sm, marginTop: Spacing.sm },

    input: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, height: 100, textAlignVertical: 'top' },

    feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
    totalRow: { borderTopWidth: 1, paddingTop: Spacing.md, marginTop: Spacing.md },

    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.xl },
    submitBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },

    errorText: { fontSize: FontSize.lg, fontWeight: '700', marginTop: Spacing.lg },
    errorSubtext: { fontSize: FontSize.md, marginTop: Spacing.sm, textAlign: 'center' },
});

export default ReturnRequestScreen;
