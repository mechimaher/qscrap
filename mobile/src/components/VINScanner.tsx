import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Dimensions,
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType, FlashMode } from 'expo-camera'; // Importing types if needed, but CameraView is the component
import * as ImageManipulator from 'expo-image-manipulator';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';
import * as Haptics from 'expo-haptics';
import { isValidVIN, cleanupVIN } from '../utils/vinUtils';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const MASK_WIDTH = width * 0.9;
const MASK_HEIGHT = 60; // Narrow rectangle for VIN

interface VINScannerProps {
    visible: boolean;
    onClose: () => void;
    onScan: (vin: string) => void;
}

export default function VINScanner({ visible, onClose, onScan }: VINScannerProps) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [torch, setTorch] = useState(false);
    const cameraRef = useRef<CameraView>(null);
    const scanLineAnim = useRef(new Animated.Value(0)).current;

    // Animation loop
    useEffect(() => {
        if (visible) {
            const loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(scanLineAnim, {
                        toValue: 1,
                        duration: 2000,
                        easing: Easing.linear,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scanLineAnim, {
                        toValue: 0,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                ])
            );
            loop.start();
            return () => loop.stop();
        }
    }, [visible]);

    if (!permission) {
        // Camera permissions are still loading
        return <View />;
    }

    if (!permission.granted) {
        return (
            <Modal visible={visible} animationType="slide">
                <View style={styles.permissionContainer}>
                    <Text style={styles.permissionText}>We need your permission to show the camera</Text>
                    <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
                        <Text style={styles.permissionButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onClose} style={styles.closeButtonText}>
                        <Text style={styles.closeText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        );
    }

    const takePictureAndScan = async () => {
        if (cameraRef.current && !scanned) {
            setScanned(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            try {
                const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });

                // MOCK DELAY & LOGIC (Simulated "Smart" OCR)
                setTimeout(() => {
                    // Start Simulation
                    const mockVINs = [
                        '1M8GDM9A2KP042788', // Valid
                        'JTEBU14R880011400', // Valid
                        '4T1B11HK4WU184659'  // Valid
                    ];
                    // Pick random for demo
                    const extractedText = mockVINs[Math.floor(Math.random() * mockVINs.length)];

                    const clean = cleanupVIN(extractedText);

                    if (clean && isValidVIN(clean)) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        onScan(clean);
                        onClose();
                    } else {
                        Alert.alert('Scan Failed', 'Could not detect a valid VIN. Please align carefully or enter manually.', [
                            { text: 'Try Again', onPress: () => setScanned(false) }
                        ]);
                    }
                }, 1500);

            } catch (error) {
                console.log('Camera error', error);
                setScanned(false);
            }
        }
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.container}>
                <CameraView
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    enableTorch={torch}
                >
                    <View style={styles.overlay}>
                        {/* Top Mask */}
                        <View style={styles.maskRow} />

                        {/* Middle Row */}
                        <View style={styles.middleRow}>
                            <View style={styles.maskSide} />
                            <View style={styles.scanZone}>
                                <View style={styles.cornerTL} />
                                <View style={styles.cornerTR} />
                                <View style={styles.cornerBL} />
                                <View style={styles.cornerBR} />

                                <Animated.View
                                    style={[
                                        styles.scanLine,
                                        {
                                            transform: [{
                                                translateY: scanLineAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [0, MASK_HEIGHT]
                                                })
                                            }]
                                        }
                                    ]}
                                />
                            </View>
                            <View style={styles.maskSide} />
                        </View>

                        {/* Bottom Mask */}
                        <View style={styles.maskRow}>
                            <Text style={styles.hintText}>Align VIN code within the frame</Text>

                            <View style={styles.controls}>
                                <TouchableOpacity
                                    style={styles.controlButton}
                                    onPress={() => setTorch(!torch)}
                                >
                                    <Text style={styles.controlIcon}>{torch ? '🔦' : '⚡️'}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.captureButton}
                                    onPress={takePictureAndScan}
                                    disabled={scanned}
                                >
                                    <View style={styles.captureInner}>
                                        {scanned && <ActivityIndicator color={Colors.primary} />}
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.controlButton} onPress={onClose}>
                                    <Text style={styles.controlIcon}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </CameraView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.dark.background },
    permissionText: { color: '#fff', marginBottom: 20, fontSize: 16 },
    permissionButton: { backgroundColor: Colors.primary, padding: 15, borderRadius: 8 },
    permissionButtonText: { color: '#fff', fontWeight: 'bold' },
    closeButtonText: { marginTop: 20 },
    closeText: { color: Colors.dark.textSecondary },

    overlay: { flex: 1 },
    maskRow: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
    middleRow: { flexDirection: 'row', height: MASK_HEIGHT },
    maskSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    scanZone: {
        width: MASK_WIDTH,
        height: MASK_HEIGHT,
        borderColor: 'transparent', // Corners handles visuals
        position: 'relative',
    },

    // Scan Line
    scanLine: {
        width: '100%',
        height: 2,
        backgroundColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOpacity: 0.8,
        shadowRadius: 5,
        elevation: 5,
    },

    // Quarters/Corners for "Tech" look
    cornerTL: { position: 'absolute', top: 0, left: 0, width: 20, height: 20, borderTopWidth: 2, borderLeftWidth: 2, borderColor: Colors.primary },
    cornerTR: { position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderTopWidth: 2, borderRightWidth: 2, borderColor: Colors.primary },
    cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 20, height: 20, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: Colors.primary },
    cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderBottomWidth: 2, borderRightWidth: 2, borderColor: Colors.primary },

    hintText: {
        color: '#fff',
        fontSize: FontSizes.md,
        fontWeight: '600',
        marginBottom: 40,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        width: '100%',
        paddingBottom: 40,
    },
    controlButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlIcon: { fontSize: 20, color: '#fff' },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureInner: {
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 2,
        borderColor: '#000',
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
