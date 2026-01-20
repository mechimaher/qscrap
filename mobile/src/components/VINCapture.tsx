/**
 * VIN Capture Component
 * Two options: Text input (17 chars) or Camera capture
 * For Qatar Istimara (Registration Card)
 */
import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Alert,
    Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

interface VINCaptureProps {
    value?: string;
    imageUri?: string;
    onVINChange: (vin: string) => void;
    onImageChange: (uri: string | null) => void;
    disabled?: boolean;
}

// VIN validation: 17 chars, no I, O, Q (per ISO 3779)
const validateVIN = (vin: string): boolean => {
    if (vin.length !== 17) return false;
    const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/;
    return vinRegex.test(vin.toUpperCase());
};

const formatVIN = (vin: string): string => {
    // Remove invalid characters and uppercase
    return vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17);
};

export default function VINCapture({
    value = '',
    imageUri,
    onVINChange,
    onImageChange,
    disabled = false,
}: VINCaptureProps) {
    const { colors } = useTheme();
    const [localVIN, setLocalVIN] = useState(value);
    const [isValid, setIsValid] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const shakeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        setLocalVIN(value);
        setIsValid(validateVIN(value));
    }, [value]);

    const handleVINInput = (text: string) => {
        const formatted = formatVIN(text);
        setLocalVIN(formatted);

        const valid = validateVIN(formatted);
        setIsValid(valid);

        if (formatted.length === 17) {
            if (valid) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onVINChange(formatted);
            } else {
                // Shake animation for invalid
                Animated.sequence([
                    Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
                ]).start();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        } else {
            onVINChange(formatted);
        }
    };

    const handleCameraCapture = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Permission Required', 'Camera access is needed to capture VIN photo');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: true,
            aspect: [16, 9], // Registration card aspect ratio
        });

        if (!result.canceled && result.assets[0]) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onImageChange(result.assets[0].uri);
        }
    };

    const handleGalleryPick = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Permission Required', 'Gallery access is needed');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: true,
            aspect: [16, 9],
        });

        if (!result.canceled && result.assets[0]) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onImageChange(result.assets[0].uri);
        }
    };

    const removeImage = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onImageChange(null);
    };

    return (
        <View style={styles.container}>
            {/* Section Header */}
            <View style={styles.header}>
                <Text style={styles.headerEmoji}>🔑</Text>
                <View style={styles.headerText}>
                    <Text style={[styles.title, { color: colors.text }]}>
                        VIN / Chassis Number
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Found on your Istimara (Registration Card)
                    </Text>
                </View>
            </View>

            {/* VIN Text Input */}
            <Animated.View style={[
                styles.inputContainer,
                { transform: [{ translateX: shakeAnim }] }
            ]}>
                <TextInput
                    style={[
                        styles.vinInput,
                        {
                            backgroundColor: colors.surface,
                            color: colors.text,
                            borderColor: localVIN.length === 17
                                ? (isValid ? '#22C55E' : '#EF4444')
                                : colors.border
                        }
                    ]}
                    value={localVIN}
                    onChangeText={handleVINInput}
                    placeholder="WVWZZZ3CZWE123456"
                    placeholderTextColor={colors.textSecondary}
                    maxLength={17}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!disabled}
                />
                <View style={styles.inputStatus}>
                    {localVIN.length === 17 && isValid && (
                        <Text style={styles.validIcon}>✓</Text>
                    )}
                    <Text style={[styles.charCount, { color: colors.textSecondary }]}>
                        {localVIN.length}/17
                    </Text>
                </View>
            </Animated.View>

            {/* Divider */}
            <View style={styles.dividerContainer}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Photo Capture */}
            {imageUri ? (
                <View style={styles.imagePreview}>
                    <Image source={{ uri: imageUri }} style={styles.previewImage} />
                    <TouchableOpacity
                        style={styles.removeImageBtn}
                        onPress={removeImage}
                    >
                        <Text style={styles.removeIcon}>×</Text>
                    </TouchableOpacity>
                    <View style={styles.imageLabel}>
                        <Text style={styles.imageLabelText}>📷 VIN Photo Captured</Text>
                    </View>
                </View>
            ) : (
                <View style={styles.captureOptions}>
                    <TouchableOpacity
                        style={[styles.captureBtn, { backgroundColor: Colors.primary + '15' }]}
                        onPress={handleCameraCapture}
                        disabled={disabled}
                    >
                        <Text style={styles.captureBtnIcon}>📷</Text>
                        <Text style={[styles.captureBtnText, { color: Colors.primary }]}>
                            Take Photo of Istimara
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.captureBtn, styles.galleryBtn, { backgroundColor: colors.surface }]}
                        onPress={handleGalleryPick}
                        disabled={disabled}
                    >
                        <Text style={styles.captureBtnIcon}>🖼️</Text>
                        <Text style={[styles.captureBtnText, { color: colors.textSecondary }]}>
                            Choose from Gallery
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Help Text */}
            <Text style={[styles.helpText, { color: colors.textSecondary }]}>
                💡 VIN helps garages find the exact part for your vehicle
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: Spacing.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    headerEmoji: {
        fontSize: 24,
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: FontSizes.md,
        fontWeight: '700',
    },
    subtitle: {
        fontSize: FontSizes.xs,
        marginTop: 2,
    },
    inputContainer: {
        position: 'relative',
    },
    vinInput: {
        fontSize: 18,
        fontFamily: 'monospace',
        letterSpacing: 2,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 2,
        textAlign: 'center',
        fontWeight: '600',
    },
    inputStatus: {
        position: 'absolute',
        right: Spacing.md,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: Spacing.xs,
    },
    validIcon: {
        color: '#22C55E',
        fontSize: 18,
        fontWeight: '700',
    },
    charCount: {
        fontSize: FontSizes.xs,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.lg,
        gap: Spacing.md,
    },
    dividerLine: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        fontSize: FontSizes.xs,
        fontWeight: '600',
    },
    captureOptions: {
        gap: Spacing.sm,
    },
    captureBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        gap: Spacing.sm,
    },
    galleryBtn: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    captureBtnIcon: {
        fontSize: 20,
    },
    captureBtnText: {
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
    imagePreview: {
        position: 'relative',
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
    },
    previewImage: {
        width: '100%',
        height: 150,
        borderRadius: BorderRadius.md,
    },
    removeImageBtn: {
        position: 'absolute',
        top: Spacing.sm,
        right: Spacing.sm,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeIcon: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    imageLabel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(34, 197, 94, 0.9)',
        padding: Spacing.sm,
    },
    imageLabelText: {
        color: '#fff',
        fontSize: FontSizes.sm,
        fontWeight: '600',
        textAlign: 'center',
    },
    helpText: {
        fontSize: FontSizes.xs,
        textAlign: 'center',
        marginTop: Spacing.md,
    },
});
