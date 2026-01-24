// QScrap Driver App - Biometric Setup Screen
// P2 FEATURE: Real Face ID / Touch ID Integration

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    Dimensions,
    Animated,
    Easing,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../../contexts/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function BiometricSetupScreen() {
    const { colors } = useTheme();
    const navigation = useNavigation<any>();
    const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
    const [biometricType, setBiometricType] = useState<string>('');
    const [isCompatible, setIsCompatible] = useState(false);
    const [isEnrolled, setIsEnrolled] = useState(false);

    // Animations
    const scanAnim = React.useRef(new Animated.Value(0)).current;
    const pulseAnim = React.useRef(new Animated.Value(1)).current;

    useEffect(() => {
        checkBiometricCapability();
    }, []);

    // P2: Check device biometric capability
    const checkBiometricCapability = async () => {
        try {
            const compatible = await LocalAuthentication.hasHardwareAsync();
            setIsCompatible(compatible);

            if (compatible) {
                const enrolled = await LocalAuthentication.isEnrolledAsync();
                setIsEnrolled(enrolled);

                const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
                if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
                    setBiometricType('Face ID');
                } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
                    setBiometricType('Fingerprint');
                } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
                    setBiometricType('Iris');
                } else {
                    setBiometricType('Biometric');
                }
            }
        } catch (error) {
            console.error('[Biometric] Capability check failed:', error);
        }
    };

    const startScan = async () => {
        if (!isCompatible) {
            Alert.alert('Not Supported', 'Your device does not support biometric authentication.');
            return;
        }

        if (!isEnrolled) {
            Alert.alert(
                'No Biometrics Enrolled',
                'Please set up Face ID or Fingerprint in your device settings first.',
                [{ text: 'OK' }]
            );
            return;
        }

        setStatus('scanning');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: `Authenticate to enable ${biometricType}`,
                fallbackLabel: 'Use Passcode',
                disableDeviceFallback: false,
            });

            if (result.success) {
                // Save biometric preference
                await SecureStore.setItemAsync('biometric_enabled', 'true');
                setStatus('success');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                setStatus('failed');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setTimeout(() => setStatus('idle'), 2000);
            }
        } catch (error) {
            console.error('[Biometric] Authentication error:', error);
            setStatus('failed');
            setTimeout(() => setStatus('idle'), 2000);
        }
    };

    const handleContinue = () => {
        navigation.navigate('Main');
    };

    const handleSkip = async () => {
        await SecureStore.setItemAsync('biometric_enabled', 'false');
        navigation.navigate('Main');
    };

    const renderScanner = () => {
        return (
            <View style={styles.scannerContainer}>
                <View style={[styles.scannerCircle, { borderColor: status === 'success' ? Colors.success : Colors.primary }]}>
                    <Ionicons
                        name={status === 'success' ? "checkmark-circle" : "scan-outline"}
                        size={80}
                        color={status === 'success' ? Colors.success : Colors.primary}
                    />

                    {status === 'scanning' && (
                        <Animated.View
                            style={[
                                styles.scanBeam,
                                {
                                    transform: [{
                                        translateY: scanAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [-100, 100]
                                        })
                                    }]
                                }
                            ]}
                        />
                    )}
                </View>
                <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                    {status === 'idle' && "Tap to Set Up Face ID"}
                    {status === 'scanning' && "Scanning..."}
                    {status === 'success' && "Face ID Verified"}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="finger-print" size={40} color={Colors.primary} />
                    </View>
                    <Text style={[styles.title, { color: colors.text }]}>
                        {biometricType || 'Biometric'} Access
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {isCompatible && isEnrolled
                            ? `Secure your account and login faster with ${biometricType}.`
                            : isCompatible
                                ? `Please set up ${biometricType} in your device settings first.`
                                : 'Your device does not support biometric authentication.'}
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.scanArea}
                    onPress={startScan}
                    disabled={status !== 'idle' || !isCompatible || !isEnrolled}
                    activeOpacity={0.8}
                >
                    {renderScanner()}
                </TouchableOpacity>

                <View style={styles.footer}>
                    {status === 'success' ? (
                        <TouchableOpacity style={styles.btnPrimary} onPress={handleContinue}>
                            <Text style={styles.btnText}>Enable & Continue</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.btnSecondary} onPress={handleSkip}>
                            <Text style={[styles.btnTextSecondary, { color: colors.textSecondary }]}>Skip for Now</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1, padding: 24, justifyContent: 'space-between' },
    header: { alignItems: 'center', marginTop: 40 },
    iconContainer: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 24
    },
    title: { fontSize: 28, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
    subtitle: { fontSize: 16, textAlign: 'center', lineHeight: 24, paddingHorizontal: 20 },

    scanArea: { alignItems: 'center', justifyContent: 'center', height: 300 },
    scannerContainer: { alignItems: 'center', justifyContent: 'center' },
    scannerCircle: {
        width: 200, height: 200, borderRadius: 100,
        borderWidth: 2,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 24,
        overflow: 'hidden'
    },
    scanBeam: {
        position: 'absolute',
        width: '100%', height: 2,
        backgroundColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 5
    },
    statusText: { fontSize: 18, fontWeight: '600' },

    footer: { gap: 16 },
    btnPrimary: {
        backgroundColor: Colors.primary,
        padding: 18, borderRadius: 12,
        alignItems: 'center',
        ...Shadows.md
    },
    btnSecondary: {
        padding: 18, borderRadius: 12,
        alignItems: 'center'
    },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    btnTextSecondary: { fontWeight: '600', fontSize: 16 },
});
