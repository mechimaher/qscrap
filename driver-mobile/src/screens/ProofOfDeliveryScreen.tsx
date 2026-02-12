// QScrap Driver App - Proof of Delivery (POD) Wizard
// Enterprise Fast-Flow: Photo → Payment → Complete
// Signature removed for speed - Operations can view POD photo if needed

import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Alert,
    ScrollView,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
// SignatureScreen removed for faster delivery flow
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { api, API_ENDPOINTS } from '../services/api';
import { API_BASE_URL } from '../config/api';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../constants/theme';
import * as Haptics from 'expo-haptics';
import { offlineQueue } from '../services/OfflineQueue';
import { executeWithOfflineFallback } from '../utils/syncHelper';
import { useI18n } from '../i18n';

type WizardStep = 'photo' | 'payment' | 'success';

export default function ProofOfDeliveryScreen() {
    const { colors } = useTheme();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { t } = useI18n();
    const { assignmentId, orderId } = route.params;

    const [step, setStep] = useState<WizardStep>('photo');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Data
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    // Signature removed for faster delivery flow
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
    const [orderDetails, setOrderDetails] = useState<{ total_amount: number; part_price: number; delivery_fee: number; loyalty_discount: number; cod_amount: number; payment_method: string } | null>(null);
    const [isLoadingOrder, setIsLoadingOrder] = useState(true);

    // Camera
    const cameraRef = useRef<CameraView>(null);
    const [permission, requestPermission] = useCameraPermissions();
    const [isCameraReady, setIsCameraReady] = useState(false);

    // Signature removed for enterprise speed optimization

    // Load order details on mount
    useEffect(() => {
        const loadOrderDetails = async () => {
            try {
                // CRITICAL FIX: Driver app should use /driver/assignments/:id, NOT /orders/:id
                const response = await api.getAssignmentDetails(assignmentId);

                if (response?.assignment) {
                    const assignment = response.assignment;

                    // Parse amounts safely
                    const total = parseFloat(String(assignment.total_amount)) || 0;
                    const partPrice = parseFloat(String(assignment.part_price)) || 0;
                    const deliveryFee = parseFloat(String(assignment.delivery_fee)) || 0;
                    const loyaltyDiscount = parseFloat(String(assignment.loyalty_discount)) || 0;
                    const paymentMethod = assignment.payment_method || 'cash';

                    // DISCOUNT-AWARE BUSINESS MODEL:
                    // effectivePartPrice = partPrice - loyaltyDiscount (what customer actually owes for the part)
                    // - payment_method = 'card_full' → COD = 0 (everything paid online, discount already applied)
                    // - payment_method = 'card' → COD = effectivePartPrice (delivery fee paid online, collect discounted part price)
                    // - payment_method = 'cash' → COD = effectivePartPrice + deliveryFee (collect both at delivery)
                    const effectivePartPrice = Math.max(0, partPrice - loyaltyDiscount);
                    let codAmount = 0;
                    if (paymentMethod === 'card_full') {
                        codAmount = 0; // Full payment already collected online
                    } else if (paymentMethod === 'card') {
                        codAmount = effectivePartPrice; // Delivery fee paid, collect discounted part only
                    } else {
                        codAmount = effectivePartPrice + deliveryFee; // Collect both at delivery
                    }

                    setOrderDetails({
                        total_amount: total,
                        part_price: effectivePartPrice,
                        delivery_fee: deliveryFee,
                        loyalty_discount: loyaltyDiscount,
                        cod_amount: codAmount,
                        payment_method: paymentMethod,
                    });

                    // Set payment method based on order payment status
                    if (paymentMethod === 'card_full') {
                        // Fully paid online - no COD needed
                        setPaymentMethod('online');
                    } else {
                        // COD needed - default to cash
                        setPaymentMethod('cash');
                    }
                }
            } catch (error) {
                console.error('[POD] Failed to load assignment details:', error);
                Alert.alert(
                    'Error Loading Details',
                    'Could not load order information. Please try again.',
                    [
                        { text: 'Cancel', style: 'cancel', onPress: () => navigation.goBack() },
                        { text: 'Retry', onPress: () => loadOrderDetails() },
                    ]
                );
            } finally {
                setIsLoadingOrder(false);
            }
        };
        loadOrderDetails();
    }, [assignmentId]);

    // --- STEP 1: PHOTO ---
    const takePicture = async () => {
        if (!cameraRef.current || !isCameraReady) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.5,
                base64: false,
            });
            setPhotoUri(photo?.uri || null);
        } catch (error) {
            Alert.alert("Error", "Failed to take photo");
        }
    };

    const retakePhoto = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPhotoUri(null);
    };

    // Signature step removed for faster enterprise delivery flow
    // Operations can view delivery photo via dashboard if needed

    const handleSubmit = async () => {
        if (!photoUri || !orderId) return;

        setIsSubmitting(true);
        try {
            // 1. Save Photo to permanent storage (media service pattern)
            const photoFilename = `pod_${assignmentId}_${Date.now()}.jpg`;
            const permanentUri = ((FileSystem as any).documentDirectory || '') + photoFilename;
            await FileSystem.copyAsync({ from: photoUri, to: permanentUri });

            // 2. Read photo as base64
            const base64Photo = await FileSystem.readAsStringAsync(permanentUri, {
                encoding: 'base64'
            });


            // 3. Upload photo to server and get public URL
            const uploadResponse = await executeWithOfflineFallback(
                async () => {
                    // Generate accurate payment notes based on order payment method
                    let paymentNotes = '';
                    if (orderDetails?.payment_method === 'card_full') {
                        paymentNotes = 'Payment: Fully paid online (card)';
                    } else if (orderDetails?.payment_method === 'card') {
                        paymentNotes = `Payment: Part price collected as ${paymentMethod} (delivery fee paid online)`;
                    } else {
                        paymentNotes = `Payment: ${paymentMethod}`;
                    }

                    return api.uploadProof(
                        assignmentId,
                        base64Photo,
                        undefined, // No signature - enterprise speed optimization
                        paymentNotes
                    );
                },
                {
                    endpoint: API_ENDPOINTS.UPLOAD_PROOF(assignmentId),
                    method: 'POST',
                    body: {
                        photoPath: permanentUri,
                        paymentMethod,
                        completedAt: new Date().toISOString()
                    }
                },
                { successMessage: 'Proof uploaded' }
            );


            // 4. Extract photo URL from response
            // executeWithOfflineFallback wraps result in { status, data }
            const responseData = (uploadResponse as any)?.data || uploadResponse;
            const podPhotoUrl = responseData?.photo_url;

            if (!podPhotoUrl) {
                console.error('[POD] No photo_url in response:', uploadResponse);
                throw new Error('Failed to upload photo - no URL returned from server');
            }


            // 5. Complete order with POD
            await executeWithOfflineFallback(
                async () => {
                    return api.request(API_ENDPOINTS.COMPLETE_WITH_POD, {
                        method: 'POST',
                        body: JSON.stringify({
                            order_id: orderId,
                            pod_photo_url: podPhotoUrl
                        })
                    });
                },
                {
                    endpoint: API_ENDPOINTS.COMPLETE_WITH_POD,
                    method: 'POST',
                    body: { order_id: orderId, pod_photo_url: podPhotoUrl }
                },
                { successMessage: 'Order completed successfully.' }
            );

            // 6. Update local store
            const jobStore = require('../stores/useJobStore').useJobStore;
            jobStore.getState().updateAssignmentStatus(assignmentId, 'delivered');

            setStep('success');
        } catch (err: any) {
            console.error('[POD] Submit error:', err);
            Alert.alert("Error", err.message || "Failed to complete delivery");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Success haptic — no auto-redirect, driver taps Done when ready
    useEffect(() => {
        if (step === 'success') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    }, [step]);

    // --- RENDERS ---

    const renderPhotoStep = () => {
        if (!permission?.granted) {
            return (
                <View style={styles.center}>
                    <Text style={{ color: colors.text, marginBottom: 20 }}>{t('camera_permission_needed')}</Text>
                    <TouchableOpacity
                        style={styles.btnGradientWrapper}
                        onPress={requestPermission}
                    >
                        <LinearGradient
                            colors={Colors.gradients.primary}
                            style={styles.btnGradient}
                        >
                            <Text style={styles.btnText}>{t('grant_permission')}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            );
        }

        if (photoUri) {
            return (
                <View style={styles.stepContainer}>
                    <Text style={[styles.title, { color: colors.text }]}>{t('confirm_photo')}</Text>
                    <Image source={{ uri: photoUri }} style={styles.previewImage} />
                    <View style={styles.row}>
                        <TouchableOpacity
                            style={styles.btnOutline}
                            onPress={retakePhoto}
                        >
                            <Text style={[styles.btnTextOutline, { color: colors.text }]}>{t('retake')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.btnGradientWrapper}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                setStep('payment');
                            }}
                        >
                            <LinearGradient
                                colors={Colors.gradients.primary}
                                style={styles.btnGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text style={styles.btnText}>{t('next_confirm_payment')}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.cameraContainer}>
                <CameraView
                    style={styles.camera}
                    facing="back"
                    ref={cameraRef}
                    onCameraReady={() => setIsCameraReady(true)}
                >
                    <View style={styles.cameraControls}>
                        <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
                            <View style={styles.captureInner} />
                        </TouchableOpacity>
                    </View>
                </CameraView>
                <Text style={styles.overlayText}>{t('photo_of_package')}</Text>
            </View>
        );
    };

    // renderSignatureStep removed - enterprise speed optimization

    const renderPaymentStep = () => (
        <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.text }]}>{t('payment_collection')}</Text>

            {/* Clear breakdown of what to collect */}
            {isLoadingOrder ? (
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('loading')}</Text>
            ) : orderDetails?.payment_method === 'card_full' ? (
                // Full payment already collected - no COD needed
                <View style={{ marginBottom: 24, alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
                    <Text style={{ fontSize: 20, color: Colors.success, fontWeight: '700', textAlign: 'center' }}>
                        Full Payment Already Collected
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
                        Customer paid {orderDetails?.total_amount?.toFixed(0)} QAR online
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>
                        No cash collection needed
                    </Text>
                </View>
            ) : (
                <View style={{ marginBottom: 24 }}>
                    {orderDetails?.payment_method === 'card' && (
                        <Text style={{ fontSize: 14, color: Colors.success, textAlign: 'center', marginBottom: 8 }}>
                            ✓ Delivery fee ({orderDetails?.delivery_fee?.toFixed(0)} QAR) paid online
                        </Text>
                    )}
                    {(orderDetails?.loyalty_discount ?? 0) > 0 && (
                        <Text style={{ fontSize: 14, color: '#F59E0B', textAlign: 'center', marginBottom: 8 }}>
                            <Ionicons name="pricetag-outline" size={14} color="#F59E0B" /> Loyalty discount of {orderDetails?.loyalty_discount?.toFixed(0)} QAR applied
                        </Text>
                    )}
                    <Text style={[styles.subtitle, { color: colors.text, marginBottom: 0 }]}>
                        Collect {orderDetails?.cod_amount?.toFixed(0) || '0'} QAR
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>
                        {orderDetails?.payment_method === 'card'
                            ? (orderDetails?.loyalty_discount ?? 0) > 0
                                ? `(Part price after discount)`
                                : `(Part price only)`
                            : `(Part ${orderDetails?.part_price?.toFixed(0)} + Delivery ${orderDetails?.delivery_fee?.toFixed(0)})`}
                    </Text>
                </View>
            )}

            {/* Payment method selection - driver selects HOW they collected COD (only if COD needed) */}
            {orderDetails?.payment_method !== 'card_full' && (
                <>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 12 }}>
                        How did customer pay?
                    </Text>
                    <View style={styles.paymentOptions}>
                        <TouchableOpacity
                            style={[
                                styles.paymentOption,
                                paymentMethod === 'cash' && styles.paymentSelected,
                                { borderColor: paymentMethod === 'cash' ? Colors.primary : colors.border }
                            ]}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setPaymentMethod('cash');
                            }}
                        >
                            <Ionicons name="cash-outline" size={32} color="#10B981" />
                            <Text style={[
                                styles.paymentText,
                                { color: paymentMethod === 'cash' ? Colors.primary : colors.text }
                            ]}>{t('cash')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.paymentOption,
                                paymentMethod === 'online' && styles.paymentSelected,
                                { borderColor: paymentMethod === 'online' ? Colors.primary : colors.border }
                            ]}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setPaymentMethod('online');
                            }}
                        >
                            <Ionicons name="card-outline" size={32} color="#3B82F6" />
                            <Text style={[
                                styles.paymentText,
                                { color: paymentMethod === 'online' ? Colors.primary : colors.text }
                            ]}>{t('card_transfer')}</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}

            <TouchableOpacity
                style={styles.btnGradientWrapper}
                onPress={handleSubmit}
                disabled={isSubmitting}
            >
                <LinearGradient
                    colors={['#059669', '#047857']}
                    style={styles.btnGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.btnText}>{t('complete_delivery_button')}</Text>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    const renderSuccessStep = () => (
        <View style={styles.center}>
            <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
            <Text style={[styles.title, { color: colors.text, marginTop: 16 }]}>{t('delivery_complete')}</Text>

            {/* Delivery summary */}
            {orderDetails && (
                <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginTop: 16, marginBottom: 24, width: '100%' }}>
                    {(orderDetails.payment_method === 'cod' || orderDetails.payment_method === 'cash') && (
                        <Text style={{ color: '#10B981', fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
                            <Ionicons name="cash" size={16} color="#10B981" /> COD Collected: QAR {orderDetails.cod_amount?.toFixed(0) || orderDetails.total_amount?.toFixed(0)}
                        </Text>
                    )}
                    <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
                        This delivery has been confirmed
                    </Text>
                </View>
            )}

            {/* Manual Done button — driver controls when to go back */}
            <TouchableOpacity
                style={{ width: '100%' }}
                onPress={() => {
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'Main' }],
                    });
                }}
            >
                <LinearGradient
                    colors={[Colors.primary, Colors.primaryDark]}
                    style={{ paddingVertical: 16, borderRadius: 12, alignItems: 'center' }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{t('done_check')}</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header / Steps Indicator */}
            {step !== 'success' && (
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
                        <Ionicons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.stepIndicators}>
                        <View style={[styles.dot, step === 'photo' && styles.dotActive]} />
                        <View style={[styles.dot, step === 'payment' && styles.dotActive]} />
                    </View>
                    <View style={{ width: 40 }} />
                </View>
            )}

            <View style={styles.content}>
                {step === 'photo' && renderPhotoStep()}
                {step === 'payment' && renderPaymentStep()}
                {step === 'success' && renderSuccessStep()}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 60 },
    stepIndicators: { flexDirection: 'row', gap: 8 },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D4D4D4' },
    dotActive: { backgroundColor: Colors.primary },

    content: { flex: 1 },
    stepContainer: { flex: 1, padding: 24 },
    title: { fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 18, marginBottom: 32, textAlign: 'center' },

    // Photo
    cameraContainer: { flex: 1, borderRadius: 20, overflow: 'hidden', margin: 16 },
    camera: { flex: 1 },
    cameraControls: { position: 'absolute', bottom: 30, width: '100%', alignItems: 'center' },
    captureBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
    captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
    overlayText: { textAlign: 'center', margin: 10, color: '#aaa' },
    previewImage: { width: '100%', height: 400, borderRadius: 16, marginBottom: 20 },



    // Payment
    paymentOptions: { flexDirection: 'row', gap: 16, marginBottom: 40 },
    paymentOption: { flex: 1, padding: 20, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    paymentSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
    paymentText: { marginTop: 8, fontWeight: '600' },

    // Buttons
    // Buttons
    row: { flexDirection: 'row', gap: 16 },
    btnGradientWrapper: { flex: 1, borderRadius: 12, overflow: 'hidden' }, // Wrapper for gradient
    btnGradient: { padding: 18, alignItems: 'center', justifyContent: 'center' },

    btnPrimary: { flex: 1, backgroundColor: Colors.primary, padding: 18, borderRadius: 12, alignItems: 'center' },
    btnOutline: { flex: 1, borderWidth: 1, padding: 18, borderRadius: 12, alignItems: 'center', borderColor: '#E5E5E5' },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    btnTextOutline: { fontWeight: '700', fontSize: 16 },
});
