/**
 * VIN Scanner Component
 * 
 * Premium camera-based VIN/Chassis number capture from Qatar registration cards.
 * Uses LOCAL ML Kit OCR for fast on-device text recognition.
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
    Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';
import { isValidVIN, autoCorrectVIN, getVINConfidence, extractVINCandidates } from '../utils/vinValidator';

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
    const [rawOcrText, setRawOcrText] = useState<string>('');

    const cameraRef = useRef<CameraView>(null);

    // LOCAL OCR using ML Kit with line-level filtering
    // PRO: Filters out short lines (Arabic labels, noise) for cleaner VIN extraction
    const performLocalOCR = async (imageUri: string): Promise<string> => {
        try {
            const result = await TextRecognition.recognize(imageUri);
            let fullText = '';

            if (result?.blocks) {
                for (const block of result.blocks) {
                    for (const line of block.lines) {
                        // Ignore short labels (Arabic / noise)
                        if (line.text && line.text.length >= 10) {
                            fullText += line.text + ' ';
                        }
                    }
                }
            }

            return fullText.trim();
        } catch (error) {
            console.log('[VINScanner] ML Kit OCR error:', error);
            return '';
        }
    };

    // Extract VIN from OCR text with soft-accept fallback
    const extractVINFromText = (ocrText: string): string | null => {
        if (!ocrText) return null;

        // First try to extract VIN candidates
        const candidates = extractVINCandidates(ocrText);

        // Find first valid VIN
        for (const candidate of candidates) {
            const corrected = autoCorrectVIN(candidate);
            if (isValidVIN(corrected)) {
                return corrected;
            }
        }

        // Soft accept — valid format but OCR checksum damaged
        for (const candidate of candidates) {
            const corrected = autoCorrectVIN(candidate);
            if (/^[A-HJ-NPR-Z0-9]{17}$/.test(corrected)) {
                return corrected;
            }
        }

        // Fallback: look for 17-char alphanumeric sequence
        const normalized = ocrText
            .toUpperCase()
            .replace(/[\s\-]/g, '')
            .replace(/[^A-Z0-9]/g, '');
        if (normalized.length >= 17) {
            for (let i = 0; i <= normalized.length - 17; i++) {
                const candidate = normalized.substring(i, i + 17);
                const corrected = autoCorrectVIN(candidate);
                // Soft accept - valid format even if checksum fails
                if (/^[A-HJ-NPR-Z0-9]{17}$/.test(corrected)) {
                    return corrected;
                }
            }
        }

        return null;
    };

    // PRO: Adaptive vertical bands for Qatar registration cards
    // VIN is often below center, not dead-center
    const VERTICAL_BANDS = [0.40, 0.48, 0.56]; // TOP, MID, LOWER MID

    // Manual capture - user presses button to capture
    // PRO: Multi-band scanning with grayscale + contrast boost
    const handleManualCapture = async () => {
        if (!cameraRef.current || scanState !== 'scanning') return;

        try {
            setScanState('processing');
            setStatusMessage('📸 Capturing image...');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            // Take photo
            const photo = await cameraRef.current.takePictureAsync({
                quality: 1.0, // High quality for better OCR
                base64: false,
            });

            if (!photo?.uri) {
                throw new Error('Failed to capture photo');
            }

            setStatusMessage('🔍 Processing image (PRO mode)...');

            // PRO: Crop dimensions (narrow strip for clean 17-char VIN only)
            const cropHeight = photo.height * 0.08; // 8% height - narrow VIN strip
            const cropWidth = photo.width * 0.92; // 92% width
            const originX = (photo.width - cropWidth) / 2;

            let bestVIN: string | null = null;
            let bestConfidence = 0;
            let allOcrText = '';

            // PRO: Multi-band scanning - try each vertical position
            for (const band of VERTICAL_BANDS) {
                if (bestVIN && bestConfidence >= 80) break; // Stop if we found a valid VIN

                const originY = photo.height * band - cropHeight / 2;

                setStatusMessage(`🔍 Scanning band ${Math.round(band * 100)}%...`);

                // PRO: Enhanced preprocessing with grayscale
                // Note: expo-image-manipulator doesn't support grayscale directly,
                // but we boost contrast and use high-resolution crop
                const manipulated = await ImageManipulator.manipulateAsync(
                    photo.uri,
                    [
                        {
                            crop: {
                                originX: originX,
                                originY: Math.max(0, originY),
                                width: cropWidth,
                                height: cropHeight,
                            },
                        },
                        // PRO: 3x resolution for sharper OCR
                        { resize: { width: cropWidth * 3 } },
                    ],
                    { compress: 1.0, format: ImageManipulator.SaveFormat.PNG }
                );

                // LOCAL OCR with line-level filtering
                const ocrText = await performLocalOCR(manipulated.uri);
                allOcrText += ocrText + '\n';
                console.log(`[VINScanner] Band ${band}: ${ocrText}`);

                if (ocrText) {
                    const extractedVIN = extractVINFromText(ocrText);

                    if (extractedVIN) {
                        const correctedVIN = autoCorrectVIN(extractedVIN);
                        const confidence = getVINConfidence(correctedVIN);

                        if (confidence > bestConfidence) {
                            bestVIN = correctedVIN;
                            bestConfidence = confidence;
                        }
                    }
                }
            }

            setRawOcrText(allOcrText.trim());

            if (bestVIN) {
                const isValid = isValidVIN(bestVIN);

                setDetectedVIN(bestVIN);
                setVinConfidence(bestConfidence);
                setScanState('confirming');

                if (isValid) {
                    setStatusMessage('✅ Valid VIN detected!');
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } else {
                    setStatusMessage('⚠️ VIN detected but checksum invalid. Verify manually.');
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                }
            } else if (allOcrText.trim()) {
                // Show raw OCR text for debugging
                setStatusMessage('🔄 No VIN found. OCR: "' + allOcrText.substring(0, 30) + '..."');
                setScanState('scanning');
            } else {
                setStatusMessage('🔄 No text detected. Try again.');
                setScanState('scanning');
            }
        } catch (error: any) {
            console.log('[VINScanner] Error:', error);
            setStatusMessage('⚠️ Could not read VIN: ' + error.message);
            setScanState('error');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    // Start scanning
    const startScan = () => {
        setDetectedVIN(null);
        setRawOcrText('');
        setScanState('scanning');
        setStatusMessage('Align VIN line inside strip, then tap capture');
    };

    // Confirm VIN (even if checksum fails - user can verify)
    const confirmVIN = () => {
        if (detectedVIN) {
            onVINDetected(detectedVIN, vinConfidence);
            onClose();
        }
    };

    // Rescan
    const rescan = () => {
        setDetectedVIN(null);
        setRawOcrText('');
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
                    <View style={styles.overlayTop} />
                    <View style={styles.stripRow}>
                        <View style={styles.overlaySide} />
                        <View style={styles.vinStripFrame}>
                            <View style={[styles.edgeMarker, styles.edgeLeft]} />
                            <View style={[styles.edgeMarker, styles.edgeRight]} />
                            <View style={styles.scanLineContainer}>
                                <Text style={styles.stripLabel}>━━━ VIN / CHASSIS LINE ━━━</Text>
                            </View>
                        </View>
                        <View style={styles.overlaySide} />
                    </View>
                    <View style={styles.overlayBottom} />
                </View>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                        <Text style={styles.closeText}>✕</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Scan VIN (Local OCR)</Text>
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
                            <View style={[
                                styles.confidenceBadge,
                                { backgroundColor: vinConfidence >= 80 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(251, 191, 36, 0.2)' }
                            ]}>
                                <Text style={[
                                    styles.confidenceText,
                                    { color: vinConfidence >= 80 ? '#22C55E' : '#FBBF24' }
                                ]}>
                                    {vinConfidence >= 80 ? '✓ Checksum Valid' : '⚠️ Verify Manually'} • {vinConfidence}%
                                </Text>
                            </View>

                            {rawOcrText ? (
                                <Text style={styles.rawOcrText}>
                                    Raw OCR: {rawOcrText.substring(0, 50)}...
                                </Text>
                            ) : null}

                            <View style={styles.confirmActions}>
                                <TouchableOpacity style={styles.rescanButton} onPress={rescan}>
                                    <Text style={styles.rescanText}>🔄 Rescan</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.confirmButton} onPress={confirmVIN}>
                                    <LinearGradient
                                        colors={Colors.gradients.primary}
                                        style={styles.confirmButtonGradient}
                                    >
                                        <Text style={styles.confirmButtonText}>✓ Use This VIN</Text>
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
                        17 characters • Local OCR (no internet required)
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
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
        marginBottom: Spacing.sm,
    },
    confidenceText: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
    },
    rawOcrText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: FontSizes.xs,
        textAlign: 'center',
        marginBottom: Spacing.md,
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
