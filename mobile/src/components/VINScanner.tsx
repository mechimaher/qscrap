/**
 * VIN Scanner Component
 * 
 * Premium camera-based VIN/Chassis number capture from Qatar registration cards.
 * Uses narrow horizontal strip for focused 17-character VIN capture.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';
import { isValidVIN, autoCorrectVIN, getVINConfidence } from '../utils/vinValidator';
import { api } from '../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// VIN Strip dimensions - narrow horizontal strip for 17-char VIN only
const VIN_STRIP_WIDTH = SCREEN_WIDTH * 0.9;
const VIN_STRIP_HEIGHT = 60; // Narrow strip for VIN line only

interface VINScannerProps {
    visible: boolean;
    onClose: () => void;
    onVINDetected: (vin: string, confidence: number) => void;
}

type ScanState = 'ready' | 'scanning' | 'processing' | 'confirming' | 'error';

export default function VINScanner({ visible, onClose, onVINDetected }: VINScannerProps) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanState, setScanState] = useState<ScanState>('ready');
    const [statusMessage, setStatusMessage] = useState('Position VIN line inside the strip');
    const [detectedVIN, setDetectedVIN] = useState<string | null>(null);
    const [vinConfidence, setVinConfidence] = useState(0);

    const cameraRef = useRef<CameraView>(null);

    // Manual capture - user presses button to capture
    const handleManualCapture = async () => {
        if (!cameraRef.current || scanState !== 'scanning') return;

        try {
            setScanState('processing');
            setStatusMessage('📸 Processing image...');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            // Take photo
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.9,
                base64: true,
            });

            if (!photo?.uri) {
                throw new Error('Failed to capture photo');
            }

            // CRITICAL: Crop to VIN strip area only (<10% height, centered)
            // This captures just the narrow horizontal strip where VIN appears
            const cropHeight = photo.height * 0.08; // 8% height - very narrow
            const cropWidth = photo.width * 0.85;   // 85% width
            const originX = (photo.width - cropWidth) / 2;
            const originY = (photo.height - cropHeight) / 2; // Center vertically

            const manipulated = await ImageManipulator.manipulateAsync(
                photo.uri,
                [
                    {
                        crop: {
                            originX: originX,
                            originY: originY,
                            width: cropWidth,
                            height: cropHeight,
                        },
                    },
                ],
                { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            // Send to backend OCR
            setStatusMessage('🔍 Reading VIN number...');
            const ocrResult = await api.ocrVIN(manipulated.base64 || '');

            if (ocrResult.vin) {
                const correctedVIN = autoCorrectVIN(ocrResult.vin);
                const confidence = getVINConfidence(correctedVIN);

                if (isValidVIN(correctedVIN)) {
                    // Valid VIN found!
                    setDetectedVIN(correctedVIN);
                    setVinConfidence(confidence);
                    setScanState('confirming');
                    setStatusMessage('✅ VIN detected successfully!');
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } else {
                    // Invalid checksum - try again
                    setStatusMessage('⚠️ Could not verify VIN. Try again.');
                    setScanState('scanning');
                }
            } else {
                // No VIN found - retry
                setStatusMessage('🔄 VIN not found. Align VIN line and try again.');
                setScanState('scanning');
            }
        } catch (error: any) {
            console.log('[VINScanner] Error:', error);
            setStatusMessage('⚠️ Could not read VIN. Try again.');
            setScanState('error');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    // Start scanning
    const startScan = () => {
        setDetectedVIN(null);
        setScanState('scanning');
        setStatusMessage('Align VIN line inside strip, then tap capture');
    };

    // Confirm VIN
    const confirmVIN = () => {
        if (detectedVIN) {
            onVINDetected(detectedVIN, vinConfidence);
            onClose();
        }
    };

    // Rescan
    const rescan = () => {
        setDetectedVIN(null);
        setScanState('scanning');
        setStatusMessage('Align VIN line inside strip, then tap capture');
    };

    // Handle close
    const handleClose = () => {
        setScanState('ready');
        setDetectedVIN(null);
        onClose();
    };

    // Request permission if needed
    useEffect(() => {
        if (visible && !permission?.granted) {
            requestPermission();
        }
        if (visible && permission?.granted) {
            startScan();
        }
    }, [visible, permission]);

    if (!visible) return null;

    // Permission denied
    if (permission && !permission.granted) {
        return (
            <Modal visible={visible} animationType="slide" transparent>
                <View style={styles.permissionContainer}>
                    <Text style={styles.permissionIcon}>📷</Text>
                    <Text style={styles.permissionTitle}>Camera Access Required</Text>
                    <Text style={styles.permissionText}>
                        To scan VIN from your registration card, we need camera access.
                    </Text>
                    <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                        <Text style={styles.permissionButtonText}>Grant Access</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <View style={styles.container}>
                {/* Camera View */}
                <CameraView
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    autofocus="on"
                />

                {/* Dark Overlay with VIN Strip Cutout */}
                <View style={styles.overlay}>
                    {/* Top dark area */}
                    <View style={styles.overlayTop} />

                    {/* Middle Row with VIN Strip */}
                    <View style={styles.stripRow}>
                        <View style={styles.overlaySide} />

                        {/* VIN Strip Frame - Narrow horizontal */}
                        <View style={styles.vinStripFrame}>
                            {/* Left edge marker */}
                            <View style={[styles.edgeMarker, styles.edgeLeft]} />
                            {/* Right edge marker */}
                            <View style={[styles.edgeMarker, styles.edgeRight]} />

                            {/* Scan line animation hint */}
                            <View style={styles.scanLineContainer}>
                                <Text style={styles.stripLabel}>━━━ VIN / CHASSIS LINE ━━━</Text>
                            </View>
                        </View>

                        <View style={styles.overlaySide} />
                    </View>

                    {/* Bottom dark area */}
                    <View style={styles.overlayBottom} />
                </View>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                        <Text style={styles.closeText}>✕</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Scan VIN</Text>
                    <View style={{ width: 44 }} />
                </View>

                {/* Status Message */}
                <View style={styles.statusContainer}>
                    <LinearGradient
                        colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.6)']}
                        style={styles.statusGradient}
                    >
                        {scanState === 'processing' && (
                            <ActivityIndicator color="#fff" style={{ marginRight: Spacing.sm }} />
                        )}
                        <Text style={styles.statusText}>{statusMessage}</Text>
                    </LinearGradient>
                </View>

                {/* Confirmation Panel */}
                {scanState === 'confirming' && detectedVIN && (
                    <View style={styles.confirmPanel}>
                        <LinearGradient
                            colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.85)']}
                            style={styles.confirmGradient}
                        >
                            <Text style={styles.confirmLabel}>Detected Chassis Number</Text>
                            <View style={styles.vinDisplay}>
                                {detectedVIN.split('').map((char, index) => (
                                    <View key={index} style={styles.vinCharBox}>
                                        <Text style={styles.vinChar}>{char}</Text>
                                    </View>
                                ))}
                            </View>
                            <View style={styles.confidenceBadge}>
                                <Text style={styles.confidenceText}>
                                    ✓ Checksum Valid • {vinConfidence}% Confidence
                                </Text>
                            </View>

                            <View style={styles.confirmActions}>
                                <TouchableOpacity style={styles.rescanButton} onPress={rescan}>
                                    <Text style={styles.rescanText}>🔄 Rescan</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.confirmButton} onPress={confirmVIN}>
                                    <LinearGradient
                                        colors={Colors.gradients.primary}
                                        style={styles.confirmButtonGradient}
                                    >
                                        <Text style={styles.confirmButtonText}>✓ Confirm VIN</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </View>
                )}

                {/* Error State */}
                {scanState === 'error' && (
                    <View style={styles.errorPanel}>
                        <Text style={styles.errorIcon}>⚠️</Text>
                        <Text style={styles.errorText}>Could not read VIN</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={rescan}>
                            <Text style={styles.retryText}>Try Again</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.manualButton} onPress={handleClose}>
                            <Text style={styles.manualText}>Enter Manually</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Manual Capture Button */}
                {scanState === 'scanning' && (
                    <View style={styles.captureContainer}>
                        <TouchableOpacity
                            style={styles.captureButton}
                            onPress={handleManualCapture}
                        >
                            <View style={styles.captureButtonInner}>
                                <Text style={styles.captureIcon}>📸</Text>
                            </View>
                        </TouchableOpacity>
                        <Text style={styles.captureHint}>Tap to capture VIN</Text>
                    </View>
                )}

                {/* Instructions Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        📋 Position ONLY the VIN/Chassis line inside the strip
                    </Text>
                    <Text style={styles.footerSubtext}>
                        17 characters • One line only
                    </Text>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
    },
    overlayTop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    overlayBottom: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    stripRow: {
        flexDirection: 'row',
        height: VIN_STRIP_HEIGHT,
        alignItems: 'center',
    },
    overlaySide: {
        flex: 1,
        height: VIN_STRIP_HEIGHT,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    vinStripFrame: {
        width: VIN_STRIP_WIDTH,
        height: VIN_STRIP_HEIGHT,
        borderWidth: 3,
        borderColor: '#22C55E',
        borderRadius: BorderRadius.sm,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    edgeMarker: {
        position: 'absolute',
        width: 20,
        height: '100%',
        borderColor: '#fff',
    },
    edgeLeft: {
        left: 0,
        borderLeftWidth: 4,
    },
    edgeRight: {
        right: 0,
        borderRightWidth: 4,
    },
    scanLineContainer: {
        paddingHorizontal: Spacing.md,
    },
    stripLabel: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: FontSizes.xs,
        fontWeight: '600',
        letterSpacing: 2,
    },
    header: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeText: {
        color: '#fff',
        fontSize: 20,
    },
    headerTitle: {
        color: '#fff',
        fontSize: FontSizes.xl,
        fontWeight: '800',
    },
    statusContainer: {
        position: 'absolute',
        top: SCREEN_HEIGHT * 0.5 + VIN_STRIP_HEIGHT / 2 + 30,
        left: Spacing.lg,
        right: Spacing.lg,
    },
    statusGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        borderRadius: BorderRadius.lg,
    },
    statusText: {
        color: '#fff',
        fontSize: FontSizes.md,
        fontWeight: '600',
        textAlign: 'center',
    },
    confirmPanel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    confirmGradient: {
        padding: Spacing.xl,
        paddingBottom: 50,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
    },
    confirmLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: FontSizes.sm,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: Spacing.md,
    },
    vinDisplay: {
        flexDirection: 'row',
        justifyContent: 'center',
        flexWrap: 'wrap',
        marginBottom: Spacing.md,
    },
    vinCharBox: {
        width: 20,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 4,
        margin: 2,
    },
    vinChar: {
        color: '#fff',
        fontSize: FontSizes.md,
        fontWeight: '700',
        fontFamily: 'monospace',
    },
    confidenceBadge: {
        alignSelf: 'center',
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
        marginBottom: Spacing.lg,
    },
    confidenceText: {
        color: '#22C55E',
        fontSize: FontSizes.sm,
        fontWeight: '600',
    },
    confirmActions: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    rescanButton: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
    },
    rescanText: {
        color: '#fff',
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
    confirmButton: {
        flex: 2,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    confirmButtonGradient: {
        paddingVertical: Spacing.md,
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: FontSizes.md,
        fontWeight: '700',
    },
    errorPanel: {
        position: 'absolute',
        bottom: 100,
        left: Spacing.xl,
        right: Spacing.xl,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        padding: Spacing.xl,
        borderRadius: BorderRadius.xl,
        alignItems: 'center',
    },
    errorIcon: {
        fontSize: 48,
        marginBottom: Spacing.md,
    },
    errorText: {
        color: '#fff',
        fontSize: FontSizes.lg,
        fontWeight: '600',
        marginBottom: Spacing.lg,
    },
    retryButton: {
        backgroundColor: Colors.primary,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.sm,
    },
    retryText: {
        color: '#fff',
        fontSize: FontSizes.md,
        fontWeight: '700',
    },
    manualButton: {
        paddingVertical: Spacing.sm,
    },
    manualText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: FontSizes.md,
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: Spacing.lg,
        right: Spacing.lg,
        alignItems: 'center',
    },
    footerText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: FontSizes.sm,
        textAlign: 'center',
    },
    footerSubtext: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: FontSizes.xs,
        textAlign: 'center',
        marginTop: 4,
    },
    permissionContainer: {
        flex: 1,
        backgroundColor: '#121212',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
    },
    permissionIcon: {
        fontSize: 64,
        marginBottom: Spacing.xl,
    },
    permissionTitle: {
        color: '#fff',
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        marginBottom: Spacing.md,
    },
    permissionText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: FontSizes.md,
        textAlign: 'center',
        marginBottom: Spacing.xl,
    },
    permissionButton: {
        backgroundColor: Colors.primary,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.md,
    },
    permissionButtonText: {
        color: '#fff',
        fontSize: FontSizes.md,
        fontWeight: '700',
    },
    cancelButton: {
        paddingVertical: Spacing.sm,
    },
    cancelButtonText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: FontSizes.md,
    },
    // Manual Capture Button Styles
    captureContainer: {
        position: 'absolute',
        bottom: 100,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#fff',
    },
    captureButtonInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureIcon: {
        fontSize: 32,
    },
    captureHint: {
        color: '#fff',
        fontSize: FontSizes.sm,
        fontWeight: '600',
        marginTop: Spacing.sm,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
});
