import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    TextInput,
    Image,
    ScrollView
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

const DisputeScreen: React.FC = () => {
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { orderId } = route.params as { orderId: string };

    const DISPUTE_REASONS = [
        { id: 'wrong_item', label: t('dispute.reasonWrongItem'), icon: 'swap-horizontal-outline', refund: '100%' },
        { id: 'damaged', label: t('dispute.reasonDamaged'), icon: 'alert-circle-outline', refund: '100%' },
        { id: 'not_as_described', label: t('dispute.reasonNotAsDescribed'), icon: 'document-text-outline', refund: '100%' },
        { id: 'quality_issue', label: t('dispute.reasonQuality'), icon: 'construct-outline', refund: '80%' },
        { id: 'changed_mind', label: t('dispute.reasonChangedMind'), icon: 'refresh-outline', refund: '70%' },
    ];

    const [loading, setLoading] = useState(false);
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [description, setDescription] = useState('');
    const [images, setImages] = useState<string[]>([]);

    const pickImage = async () => {
        if (images.length >= 5) {
            Alert.alert(t('dispute.limitReached'), t('dispute.limitReachedMsg'));
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            selectionLimit: 5 - images.length,
            quality: 0.8,
        });

        if (!result.canceled) {
            setImages([...images, ...result.assets.map(a => a.uri)]);
        }
    };

    const takePhoto = async () => {
        if (images.length >= 5) {
            Alert.alert(t('dispute.limitReached'), t('dispute.limitReachedMsg'));
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
        });

        if (!result.canceled) {
            setImages([...images, result.assets[0].uri]);
        }
    };

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!selectedReason) {
            Alert.alert(t('common.required'), t('dispute.selectReason'));
            return;
        }

        if (!description.trim()) {
            Alert.alert(t('common.required'), t('dispute.describeIssue'));
            return;
        }

        if (images.length === 0) {
            Alert.alert(t('common.required'), t('dispute.addPhotoEvidence'));
            return;
        }

        try {
            setLoading(true);

            const formData = new FormData();
            formData.append('order_id', orderId);
            formData.append('reason', selectedReason);
            formData.append('description', description);

            images.forEach((uri, index) => {
                const filename = uri.split('/').pop() || `photo_${index}.jpg`;
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : 'image/jpeg';

                formData.append('photos', {
                    uri,
                    name: filename,
                    type,
                } as any);
            });

            await api.createDispute(formData);

            Alert.alert(
                t('dispute.submitted'),
                t('dispute.submittedMsg'),
                [{ text: t('common.ok'), onPress: () => navigation.navigate('MainTabs') }]
            );
        } catch (error: any) {
            Alert.alert(t('common.error'), error.response?.data?.error || t('dispute.submitFailed'));
        } finally {
            setLoading(false);
        }
    };

    const selectedReasonInfo = DISPUTE_REASONS.find(r => r.id === selectedReason);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('dispute.reportIssue')}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Info Banner */}
                <View style={[styles.infoBanner, { backgroundColor: colors.primary + '15', flexDirection: rtlFlexDirection(isRTL) }]}>
                    <Ionicons name="information-circle" size={24} color={colors.primary} />
                    <Text style={[styles.infoText, { color: colors.primary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('dispute.infoBanner')}
                    </Text>
                </View>

                {/* Reason Selection */}
                <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{t('dispute.whatsTheIssue')}</Text>

                {DISPUTE_REASONS.map(reason => (
                    <TouchableOpacity
                        key={reason.id}
                        style={[
                            styles.reasonCard,
                            {
                                backgroundColor: selectedReason === reason.id ? colors.primary + '15' : colors.surface,
                                borderColor: selectedReason === reason.id ? colors.primary : colors.border,
                                flexDirection: rtlFlexDirection(isRTL)
                            },
                            Shadows.sm
                        ]}
                        onPress={() => setSelectedReason(reason.id)}
                    >
                        <View style={[styles.reasonIcon, { backgroundColor: colors.surfaceSecondary }]}>
                            <Ionicons name={reason.icon as any} size={24} color={colors.primary} />
                        </View>
                        <View style={[styles.reasonInfo, isRTL ? { marginRight: Spacing.md } : { marginLeft: Spacing.md }]}>
                            <Text style={[styles.reasonLabel, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{reason.label}</Text>
                            <Text style={[styles.reasonRefund, { color: colors.success, textAlign: rtlTextAlign(isRTL) }]}>{t('dispute.upTo')} {reason.refund} {t('common.refund')}</Text>
                        </View>
                        {selectedReason === reason.id && (
                            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                        )}
                    </TouchableOpacity>
                ))}

                {/* Description */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.lg, textAlign: rtlTextAlign(isRTL) }]}>{t('dispute.describeIssue')}</Text>
                <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, textAlign: rtlTextAlign(isRTL) }]}
                    placeholder={t('dispute.describePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    value={description}
                    onChangeText={setDescription}
                />

                {/* Photos */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.lg, textAlign: rtlTextAlign(isRTL) }]}>{t('dispute.evidencePhotos')}</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>{t('dispute.addPhotosParam', { count: 5 })}</Text>

                <View style={[styles.photoSection, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    <TouchableOpacity
                        style={[styles.photoBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={takePhoto}
                    >
                        <Ionicons name="camera" size={28} color={colors.primary} />
                        <Text style={[styles.photoBtnText, { color: colors.textSecondary }]}>{t('common.camera')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.photoBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={pickImage}
                    >
                        <Ionicons name="images" size={28} color={colors.primary} />
                        <Text style={[styles.photoBtnText, { color: colors.textSecondary }]}>{t('common.gallery')}</Text>
                    </TouchableOpacity>
                </View>

                {images.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreview}>
                        {images.map((uri, index) => (
                            <View key={index} style={styles.imageContainer}>
                                <Image source={{ uri }} style={styles.previewImage} />
                                <TouchableOpacity
                                    style={[styles.removeBtn, { backgroundColor: colors.danger }]}
                                    onPress={() => removeImage(index)}
                                >
                                    <Ionicons name="close" size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                )}

                {/* Expected Resolution */}
                {selectedReasonInfo && (
                    <View style={[styles.resolutionCard, { backgroundColor: colors.success + '15', flexDirection: rtlFlexDirection(isRTL) }]}>
                        <Ionicons name="cash-outline" size={24} color={colors.success} />
                        <View style={[styles.resolutionInfo, isRTL ? { marginRight: Spacing.md } : { marginLeft: Spacing.md }]}>
                            <Text style={[styles.resolutionTitle, { color: colors.success, textAlign: rtlTextAlign(isRTL) }]}>{t('dispute.expectedResolution')}</Text>
                            <Text style={[styles.resolutionText, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                                {t('dispute.resolutionMsg', { refund: selectedReasonInfo.refund })}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Submit Button */}
                <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <View style={{ flexDirection: rtlFlexDirection(isRTL), alignItems: 'center' }}>
                            <Ionicons name="send" size={20} color="#fff" />
                            <Text style={[styles.submitBtnText, isRTL ? { marginRight: Spacing.sm } : { marginLeft: Spacing.sm }]}>{t('dispute.submitDispute')}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
    backBtn: { padding: Spacing.sm },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700' },
    content: { flex: 1, padding: Spacing.lg },

    infoBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.lg },
    infoText: { flex: 1, fontSize: FontSize.sm },

    sectionTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: Spacing.md },
    sectionSubtitle: { fontSize: FontSize.sm, marginTop: -Spacing.sm, marginBottom: Spacing.md },

    reasonCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.sm,
        borderWidth: 1,
    },
    reasonIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    reasonInfo: { flex: 1 },
    reasonLabel: { fontSize: FontSize.md, fontWeight: '600' },
    reasonRefund: { fontSize: FontSize.sm, marginTop: 2 },

    input: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: FontSize.md,
        height: 120,
        textAlignVertical: 'top'
    },

    photoSection: { flexDirection: 'row', gap: Spacing.md },
    photoBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderStyle: 'dashed'
    },
    photoBtnText: { marginTop: Spacing.xs, fontSize: FontSize.sm },

    imagePreview: { marginTop: Spacing.md },
    imageContainer: { marginRight: Spacing.sm },
    previewImage: { width: 100, height: 100, borderRadius: BorderRadius.md },
    removeBtn: { position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

    resolutionCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.lg },
    resolutionInfo: { flex: 1 },
    resolutionTitle: { fontSize: FontSize.md, fontWeight: '600' },
    resolutionText: { fontSize: FontSize.sm, marginTop: 2 },

    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg, borderRadius: BorderRadius.lg, marginTop: Spacing.xl },
    submitBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
});

export default DisputeScreen;
