// QScrap Driver App - Proof of Delivery (POD) Wizard
// VVIP Experience: Step-by-step flow for smooth handoff
// Steps: Photo -> Signature -> Payment -> Success

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
import SignatureScreen from 'react-native-signature-canvas';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { api, API_ENDPOINTS } from '../services/api';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../constants/theme';
import * as Haptics from 'expo-haptics';
import { offlineQueue } from '../services/OfflineQueue';
import { executeWithOfflineFallback } from '../utils/syncHelper';

type WizardStep = 'photo' | 'signature' | 'payment' | 'success';

export default function ProofOfDeliveryScreen() {
    const { colors } = useTheme();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { assignmentId } = route.params;

    const [step, setStep] = useState<WizardStep>('photo');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Data
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [signatureData, setSignatureData] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');

    // Camera
    const cameraRef = useRef<CameraView>(null);
    const [permission, requestPermission] = useCameraPermissions();
    const [isCameraReady, setIsCameraReady] = useState(false);

    // Signature
    const signatureRef = useRef<any>(null);

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

    // --- STEP 2: SIGNATURE ---
    const handleSignatureOK = (signature: string) => {
        // signature is base64 string
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSignatureData(signature);
        setStep('payment');
    };

    // --- STEP 3: SUBMIT ---
    const handleSubmit = async () => {
        if (!photoUri || !signatureData) return;

        setIsSubmitting(true);
        try {
            // 1. Save Photo to permanent storage (media service pattern)
            const photoFilename = `pod_${assignmentId}_${Date.now()}.jpg`;
            const permanentUri = ((FileSystem as any).documentDirectory || '') + photoFilename;
            await FileSystem.copyAsync({ from: photoUri, to: permanentUri });

            // 2. Upload Proof (Hybrid Sync)
            // We use OfflineQueue to ensure this happens even if net drops now
            const payload = {
                photoPath: permanentUri, // Service will read this
                signature: signatureData, // Small enough for MMKV string
                paymentMethod,
                completedAt: new Date().toISOString()
            };

            await executeWithOfflineFallback(
                async () => {
                    const base64Photo = await FileSystem.readAsStringAsync(permanentUri, {
                        encoding: 'base64'
                    });
                    await api.uploadProof(
                        assignmentId,
                        base64Photo,
                        signatureData.replace('data:image/png;base64,', ''),
                        `Payment: ${paymentMethod}`
                    );
                },
                {
                    endpoint: API_ENDPOINTS.UPLOAD_PROOF(assignmentId),
                    method: 'POST',
                    body: payload
                },
                { successMessage: 'Proof uploaded' }
            );

            // 3. Update status (Hybrid Sync)
            const { useJobStore } = require('../stores/useJobStore');
            useJobStore.getState().updateAssignmentStatus(assignmentId, 'delivered');

            await executeWithOfflineFallback(
                async () => api.updateAssignmentStatus(assignmentId, 'delivered', { notes: `Delivered via App. Payment: ${paymentMethod}` }),
                {
                    endpoint: API_ENDPOINTS.UPDATE_ASSIGNMENT_STATUS(assignmentId),
                    method: 'PATCH',
                    body: { status: 'delivered', notes: `Delivered via App. Payment: ${paymentMethod}` }
                },
                { successMessage: 'Delivery completed' }
            );

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
                    routes: [{ name: 'MainTabs' }],
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
                                setStep('signature');
                            }}
                        >
                            <LinearGradient
                                colors={Colors.gradients.primary}
                                style={styles.btnGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text style={styles.btnText}>Next: Signature →</Text>
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

    const renderSignatureStep = () => (
        <View style={[styles.stepContainer, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.text }]}>Customer Signature</Text>
            <View style={styles.signatureBox}>
                <SignatureScreen
                    ref={signatureRef}
                    onOK={handleSignatureOK}
                    webStyle={`
                        .m-signature-pad { box-shadow: none; border: none; } 
                        .m-signature-pad--body { border: none; }
                        .m-signature-pad--footer { display: none; margin: 0px; }
                        body,html { width: 100%; height: 100%; background: #f5f5f5; }
                    `}
                    backgroundColor="#f5f5f5"
                />
            </View>
            <View style={styles.row}>
                <TouchableOpacity
                    style={styles.btnOutline}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        signatureRef.current?.clearSignature();
                    }}
                >
                    <Text style={[styles.btnTextOutline, { color: colors.text }]}>Clear</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.btnGradientWrapper}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        signatureRef.current?.readSignature();
                    }}
                >
                    <LinearGradient
                        colors={Colors.gradients.primary}
                        style={styles.btnGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <Text style={styles.btnText}>Confirm Signature</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderPaymentStep = () => (
        <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.text }]}>Payment Collection</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Collect 150.00 QAR</Text>

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
                    ]}>Paid Online</Text>
                </TouchableOpacity>
            </View>

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
                        <View style={[styles.dot, step === 'signature' && styles.dotActive]} />
                        <View style={[styles.dot, step === 'payment' && styles.dotActive]} />
                    </View>
                    <View style={{ width: 40 }} />
                </View>
            )}

            <View style={styles.content}>
                {step === 'photo' && renderPhotoStep()}
                {step === 'signature' && renderSignatureStep()}
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

    // Signature
    signatureBox: { height: 300, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd', marginBottom: 20 },

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
