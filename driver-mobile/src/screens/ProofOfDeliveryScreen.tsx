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

type WizardStep = 'photo' | 'payment' | 'success';

export default function ProofOfDeliveryScreen() {
    const { colors } = useTheme();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { assignmentId, orderId } = route.params;

    const [step, setStep] = useState<WizardStep>('photo');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Data
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    // Signature removed for faster delivery flow
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
    const [orderDetails, setOrderDetails] = useState<{ total_amount: number; part_price: number; delivery_fee: number; cod_amount: number; payment_method: string } | null>(null);
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
                    const paymentMethod = assignment.payment_method || 'cash';

                    // BUSINESS MODEL:
                    // - payment_method = 'card_full' means FULL PAYMENT (part + delivery) was paid upfront → COD = 0
                    // - payment_method = 'card' means DELIVERY FEE was paid upfront via Stripe → COD = part_price
                    // - payment_method = 'cash' means nothing paid upfront → COD = part_price + delivery_fee
                    let codAmount = 0;
                    if (paymentMethod === 'card_full') {
                        codAmount = 0; // Full payment already collected online
                    } else if (paymentMethod === 'card') {
                        codAmount = partPrice; // Delivery fee paid, collect part only
                    } else {
                        codAmount = partPrice + deliveryFee; // Collect both at delivery
                    }

                    console.log('[POD] Loaded assignment:', {
                        assignmentId,
                        partPrice,
                        deliveryFee,
                        total,
                        paymentMethod,
                        codAmount,
                        fullPaidOnline: paymentMethod === 'card_full',
                        deliveryFeePaidOnline: paymentMethod === 'card' || paymentMethod === 'card_full'
                    });

                    setOrderDetails({
                        total_amount: total,
                        part_price: partPrice,
                        delivery_fee: deliveryFee,
                        cod_amount: codAmount,
                        payment_method: paymentMethod
                    });

                    // Always default to cash for COD collection (driver always needs to collect something)
                    setPaymentMethod('cash');
                }
            } catch (error) {
                console.error('[POD] Failed to load assignment details:', error);
                Alert.alert(
                    'Error Loading Details',
                    'Could not load order information. Please try again.',
                    [
                        { text: 'Cancel', style: 'cancel', onPress: () => navigation.goBack() },
                        { text: 'Retry', onPress: () => loadOrderDetails() }
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

    // --- STEP 3: SUBMIT ---
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

            // 3. Upload photo to get URL (backend will store and return URL)
            // Upload proof - photo only (no signature for faster flow)
            const uploadResponse = await executeWithOfflineFallback(
                async () => api.uploadProof(
                    assignmentId,
                    base64Photo,
                    undefined, // No signature - enterprise speed optimization
                    `Payment: ${paymentMethod}`
                ),
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

            // 4. Complete order with POD (creates payout immediately!)
            // This new endpoint marks order as 'completed' and creates garage payout
            const podPhotoUrl = uploadResponse?.photo_url || permanentUri;

            await executeWithOfflineFallback(
                async () => {
                    const token = await api.getToken();
                    // CRITICAL FIX: Must use full URL with API_BASE_URL
                    const fullUrl = `${API_BASE_URL}${API_ENDPOINTS.COMPLETE_WITH_POD}`;
                    console.log('[POD] Completing delivery:', { orderId, fullUrl });
                    const response = await fetch(fullUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            order_id: orderId,
                            pod_photo_url: podPhotoUrl
                        })
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('[POD] Completion failed:', response.status, errorText);
                        throw new Error(`Failed to complete delivery: ${response.status}`);
                    }
                    return response.json();
                },
                {
                    endpoint: API_ENDPOINTS.COMPLETE_WITH_POD,
                    method: 'POST',
                    body: { order_id: orderId, pod_photo_url: podPhotoUrl }
                },
                { successMessage: 'Order completed! Payout created.' }
            );

            // 5. Update local store
            const { useJobStore } = require('../stores/useJobStore');
            useJobStore.getState().updateAssignmentStatus(assignmentId, 'delivered');

            setStep('success');
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Premium UX: Auto-navigate home after success step
    useEffect(() => {
        if (step === 'success') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const timer = setTimeout(() => {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Main' }],
                });
            }, 2500);
            return () => clearTimeout(timer);
        }
    }, [step]);

    // --- RENDERS ---

    const renderPhotoStep = () => {
        if (!permission?.granted) {
            return (
                <View style={styles.center}>
                    <Text style={{ color: colors.text, marginBottom: 20 }}>Camera permission needed</Text>
                    <TouchableOpacity
                        style={styles.btnGradientWrapper}
                        onPress={requestPermission}
                    >
                        <LinearGradient
                            colors={Colors.gradients.primary}
                            style={styles.btnGradient}
                        >
                            <Text style={styles.btnText}>Grant Permission</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            );
        }

        if (photoUri) {
            return (
                <View style={styles.stepContainer}>
                    <Text style={[styles.title, { color: colors.text }]}>Confirm Photo</Text>
                    <Image source={{ uri: photoUri }} style={styles.previewImage} />
                    <View style={styles.row}>
                        <TouchableOpacity
                            style={styles.btnOutline}
                            onPress={retakePhoto}
                        >
                            <Text style={[styles.btnTextOutline, { color: colors.text }]}>Retake</Text>
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
                                <Text style={styles.btnText}>Next: Confirm Payment →</Text>
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
                <Text style={styles.overlayText}>Take photo of package</Text>
            </View>
        );
    };

    // renderSignatureStep removed - enterprise speed optimization

    const renderPaymentStep = () => (
        <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.text }]}>Payment Collection</Text>

            {/* Clear breakdown of what to collect */}
            {isLoadingOrder ? (
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Loading...</Text>
            ) : orderDetails?.payment_method === 'card_full' ? (
                // Full payment already collected - no COD needed
                <View style={{ marginBottom: 24, alignItems: 'center' }}>
                    <Text style={{ fontSize: 48, marginBottom: 16 }}>✅</Text>
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
                    <Text style={[styles.subtitle, { color: colors.text, marginBottom: 0 }]}>
                        Collect {orderDetails?.cod_amount?.toFixed(0) || '0'} QAR
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>
                        {orderDetails?.payment_method === 'card'
                            ? `(Part price only)`
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
                            <Text style={{ fontSize: 32 }}>💵</Text>
                            <Text style={[
                                styles.paymentText,
                                { color: paymentMethod === 'cash' ? Colors.primary : colors.text }
                            ]}>Cash</Text>
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
                            <Text style={{ fontSize: 32 }}>💳</Text>
                            <Text style={[
                                styles.paymentText,
                                { color: paymentMethod === 'online' ? Colors.primary : colors.text }
                            ]}>Card / Transfer</Text>
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
                        <Text style={styles.btnText}>Complete Delivery ✓</Text>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    const renderSuccessStep = () => (
        <View style={styles.center}>
            <Text style={{ fontSize: 64 }}>✅</Text>
            <Text style={[styles.title, { color: colors.text, marginTop: 16 }]}>Delivery Complete!</Text>
            <Text style={{ color: colors.textSecondary, marginBottom: 32 }}>Returning to home...</Text>
            <ActivityIndicator color={Colors.primary} size="small" />
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header / Steps Indicator */}
            {step !== 'success' && (
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
                        <Text style={{ fontSize: 24, color: colors.text }}>✕</Text>
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
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ddd' },
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
