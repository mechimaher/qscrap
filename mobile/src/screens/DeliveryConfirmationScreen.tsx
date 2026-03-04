// QScrap Delivery Confirmation Screen
// Buyer confirms receipt, captures photos, releases escrow

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';
import { useTranslation } from '../contexts/LanguageContext';
import { extractErrorMessage } from '../utils/errorHandler';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';

export default function DeliveryConfirmationScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();

    const { order, escrow } = route.params || {};

    const [photos, setPhotos] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<'capture' | 'confirm' | 'success'>('capture');

    const hoursRemaining = escrow?.inspection_expires_at
        ? Math.max(0, Math.floor((new Date(escrow.inspection_expires_at).getTime() - Date.now()) / 3600000))
        : 48;

    const takePhoto = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return;

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setPhotos(prev => [...prev, result.assets[0].uri]);
        }
    };

    const removePhoto = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleConfirm = async () => {
        if (photos.length < 2) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(t('delivery.photosRequired'), t('delivery.takePhotos'));
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsLoading(true);

        try {
            await api.confirmEscrowReceipt(escrow?.escrow_id || 'test', photos);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setStep('success');
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(t('common.error'), extractErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    const handleReportIssue = () => {
        Alert.alert(
            t('delivery.reportIssue'),
            t('delivery.reportIssuePrompt'),
            [
                { text: t('delivery.wrongPart'), onPress: () => navigateDispute('Wrong part received') },
                { text: t('delivery.damaged'), onPress: () => navigateDispute('Part arrived damaged') },
                { text: t('delivery.notAsDescribed'), onPress: () => navigateDispute('Condition not as described') },
                { text: t('common.cancel'), style: 'cancel' }
            ]
        );
    };

    const navigateDispute = (reason: string) => {
        navigation.navigate('Dispute', { order_id: order?.order_id, reason, photos });
    };

    // Success State
    if (step === 'success') {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.successContainer}>
                    <LinearGradient
                        colors={[Colors.success, '#2d8a4e']}
                        style={styles.successIcon}
                    >
                        <Ionicons name="checkmark" size={60} color="#fff" />
                    </LinearGradient>
                    <Text style={[styles.successTitle, { color: colors.text }]}>
                        {t('delivery.confirmed')}
                    </Text>
                    <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
                        {t('delivery.paymentReleased')}{'\n'}{t('delivery.thankYou')}
                    </Text>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('HomeTab')}
                        style={styles.doneButton}
                    >
                        <LinearGradient
                            colors={[Colors.primary, '#6b1029']}
                            style={styles.doneGradient}
                        >
                            <Text style={styles.doneButtonText}>{t('common.backToHome')}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('delivery.confirmTitle')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Order Summary */}
                <View style={[styles.orderCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.orderNumber, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('common.order')} #{order?.order_number || 'N/A'}
                    </Text>
                    <Text style={[styles.partName, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                        {order?.part_name || t('delivery.autoPart')}
                    </Text>
                    <Text style={[styles.seller, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('common.from')} {order?.garage_name || t('common.seller')}
                    </Text>
                </View>

                {/* Inspection Timer */}
                <View style={[styles.timerCard, { backgroundColor: Colors.warning + '20', flexDirection: rtlFlexDirection(isRTL) }]}>
                    <Ionicons name="time-outline" size={24} color={Colors.warning} />
                    <View style={styles.timerContent}>
                        <Text style={[styles.timerTitle, { color: Colors.warning, textAlign: rtlTextAlign(isRTL) }]}>
                            {t('delivery.inspection')}: {hoursRemaining}h {t('delivery.remaining')}
                        </Text>
                        <Text style={[styles.timerSubtitle, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                            {t('delivery.confirmWindow')}
                        </Text>
                    </View>
                </View>

                {/* Photo Capture */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('delivery.captureCondition')}
                    </Text>
                    <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('delivery.takePhotosPrompt')}
                    </Text>

                    <View style={styles.photoGrid}>
                        {photos.map((uri, index) => (
                            <View key={index} style={styles.photoWrapper}>
                                <Image source={{ uri }} style={styles.photo} />
                                <TouchableOpacity
                                    style={styles.removeBtn}
                                    onPress={() => removePhoto(index)}
                                >
                                    <Ionicons name="close-circle" size={24} color={Colors.error} />
                                </TouchableOpacity>
                            </View>
                        ))}
                        {photos.length < 5 && (
                            <TouchableOpacity
                                style={[styles.addPhoto, { borderColor: colors.border }]}
                                onPress={takePhoto}
                            >
                                <Ionicons name="camera" size={32} color={Colors.primary} />
                                <Text style={[styles.addPhotoText, { color: colors.textSecondary }]}>
                                    {t('delivery.addPhoto')}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Checklist */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('delivery.beforeConfirming')}
                    </Text>
                    <View style={[styles.checklist, { backgroundColor: colors.surface }]}>
                        {[t('delivery.check1'), t('delivery.check2'), t('delivery.check3'), t('delivery.check4')].map((item, i) => (
                            <View key={i} style={[styles.checkItem, { flexDirection: rtlFlexDirection(isRTL) }]}>
                                <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
                                <Text style={[styles.checkText, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{item}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>

            {/* Footer */}
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                    style={[styles.issueButton, { borderColor: Colors.error, flexDirection: rtlFlexDirection(isRTL) }]}
                    onPress={handleReportIssue}
                >
                    <Ionicons name="warning-outline" size={20} color={Colors.error} />
                    <Text style={[styles.issueButtonText, { color: Colors.error }]}>{t('delivery.reportIssue')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleConfirm}
                    disabled={isLoading || photos.length < 2}
                    style={[styles.confirmButton, (isLoading || photos.length < 2) && { opacity: 0.6 }]}
                >
                    <LinearGradient
                        colors={photos.length >= 2 ? [Colors.success, '#2d8a4e'] : ['#ccc', '#aaa']}
                        style={styles.confirmGradient}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                <Text style={styles.confirmButtonText}>{t('delivery.confirmRelease')}</Text>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: Spacing.lg, borderBottomWidth: 1,
    },
    backButton: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '700' },
    content: { flex: 1, padding: Spacing.lg },
    orderCard: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.md },
    orderNumber: { fontSize: FontSizes.sm, marginBottom: 4 },
    partName: { fontSize: FontSizes.lg, fontWeight: '700', marginBottom: 4 },
    seller: { fontSize: FontSizes.sm },
    timerCard: {
        flexDirection: 'row', alignItems: 'center', padding: Spacing.lg,
        borderRadius: BorderRadius.lg, marginBottom: Spacing.lg, gap: Spacing.md,
    },
    timerContent: { flex: 1 },
    timerTitle: { fontWeight: '700' },
    timerSubtitle: { fontSize: FontSizes.sm },
    section: { marginBottom: Spacing.xl },
    sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', marginBottom: 4 },
    sectionSubtitle: { fontSize: FontSizes.sm, marginBottom: Spacing.md },
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    photoWrapper: { position: 'relative' },
    photo: { width: 100, height: 100, borderRadius: BorderRadius.md },
    removeBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: '#fff', borderRadius: 12 },
    addPhoto: {
        width: 100, height: 100, borderRadius: BorderRadius.md, borderWidth: 2, borderStyle: 'dashed',
        alignItems: 'center', justifyContent: 'center',
    },
    addPhotoText: { fontSize: FontSizes.xs, marginTop: 4 },
    checklist: { padding: Spacing.lg, borderRadius: BorderRadius.lg, gap: Spacing.sm },
    checkItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    checkText: { flex: 1 },
    footer: { padding: Spacing.lg, borderTopWidth: 1, gap: Spacing.md },
    issueButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.lg, gap: Spacing.sm,
    },
    issueButtonText: { fontWeight: '600' },
    confirmButton: { width: '100%' },
    confirmGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, gap: Spacing.sm,
    },
    confirmButtonText: { color: '#fff', fontWeight: '700', fontSize: FontSizes.md },
    successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    successIcon: {
        width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg,
    },
    successTitle: { fontSize: FontSizes.xxl, fontWeight: '700', marginBottom: Spacing.sm },
    successSubtitle: { fontSize: FontSizes.md, textAlign: 'center', lineHeight: 24, marginBottom: Spacing.xl },
    doneButton: { width: '100%' },
    doneGradient: { paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, alignItems: 'center' },
    doneButtonText: { color: '#fff', fontWeight: '700', fontSize: FontSizes.md },
});
