/**
 * QScrap Biometric Authentication Component
 * Provides Face ID / Touch ID / Fingerprint authentication
 * 
 * INSTALLATION REQUIRED (run this first):
 * npx expo install expo-local-authentication
 * 
 * Until installed, this component will show a prompt to install.
 * 
 * @example
 * <BiometricLogin onSuccess={() => navigation.navigate('Main')} />
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection } from '../utils/rtl';

// Try to import expo-local-authentication (may not be installed yet)
let LocalAuthentication: any = null;
try {
    LocalAuthentication = require('expo-local-authentication');
} catch (e) {
    // Module not installed - component will show installation prompt
}

interface BiometricLoginProps {
    onSuccess?: () => void;
    onFail?: () => void;
}

export const BiometricLogin: React.FC<BiometricLoginProps> = ({
    onSuccess,
    onFail,
}) => {
    const { t, isRTL } = useTranslation();
    const [hasHardware, setHasHardware] = useState(false);
    const [isEnrolled, setIsEnrolled] = useState(false);
    const [biometricType, setBiometricType] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isModuleInstalled, setIsModuleInstalled] = useState(!!LocalAuthentication);

    useEffect(() => {
        if (!isModuleInstalled) return;
        checkBiometricSupport();
    }, [isModuleInstalled]);

    const checkBiometricSupport = async () => {
        try {
            // Check if device has biometric hardware
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            setHasHardware(hasHardware);

            if (!hasHardware) return;

            // Check if biometrics are enrolled
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            setIsEnrolled(isEnrolled);

            // Get supported biometric types
            const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
            
            if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
                setBiometricType(Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock');
            } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
                setBiometricType(Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint');
            } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
                setBiometricType('Iris');
            } else {
                setBiometricType('Biometric');
            }
        } catch (error) {
            console.error('[BiometricLogin] Error checking support:', error);
        }
    };

    const handleBiometricAuth = async () => {
        if (!isModuleInstalled) {
            Alert.alert(
                t('common.error'),
                'Biometric authentication requires expo-local-authentication. Install it now?',
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                        text: 'Install',
                        onPress: () => Linking.openURL('https://docs.expo.dev/versions/latest/sdk/local-authentication/'),
                    },
                ]
            );
            onFail?.();
            return;
        }

        if (!hasHardware || !isEnrolled) {
            Alert.alert(
                t('common.error'),
                t('auth.biometricNotAvailable'),
                [{ text: t('common.ok') }]
            );
            onFail?.();
            return;
        }

        setIsLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            // Attempt biometric authentication
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: t('auth.biometricPrompt'),
                fallbackLabel: t('auth.usePasscode'),
                cancelLabel: t('common.cancel'),
                disableDeviceFallback: false, // Allow PIN/pattern fallback
            });

            if (result.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                // For security, biometric just confirms identity
                // User still needs to login with credentials if not already logged in
                onSuccess?.();
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                onFail?.();
            }
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            console.error('[BiometricLogin] Auth error:', error);
            
            // Don't show error for user cancellation
            if (error.code !== 'ESystem' || error.message !== 'User cancel') {
                Alert.alert(t('common.error'), t('auth.biometricFailed'));
            }
            onFail?.();
        } finally {
            setIsLoading(false);
        }
    };

    // Don't render if no biometric support
    if (!hasHardware || !isEnrolled || !biometricType) {
        return null;
    }

    return (
        <TouchableOpacity
            style={[styles.container, { flexDirection: rtlFlexDirection(isRTL) }]}
            onPress={handleBiometricAuth}
            disabled={isLoading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('auth.biometricLogin')}
        >
            <View style={[styles.iconContainer, { backgroundColor: Colors.primary + '15' }]}>
                <Ionicons
                    name={Platform.OS === 'ios' ? 'scan-outline' : 'finger-print-outline'}
                    size={32}
                    color={Colors.primary}
                />
            </View>
            <View style={styles.textContainer}>
                <Text style={[styles.title, { color: Colors.primary }]}>
                    {t('auth.quickLogin')}
                </Text>
                <Text style={[styles.subtitle, { color: '#666' }]}>
                    {biometricType || ''}
                </Text>
            </View>
            {isLoading && (
                <View style={styles.loadingIndicator}>
                    <Ionicons name="hourglass" size={20} color={Colors.primary} />
                </View>
            )}
        </TouchableOpacity>
    );
};

// Helper function for RTL text alignment
function rtlTextAlign(isRTL: boolean): 'left' | 'right' | 'center' {
    return isRTL ? 'right' : 'left';
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.md,
        ...Shadows.md,
        borderWidth: 1,
        borderColor: Colors.primary + '30',
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: BorderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
    },
    subtitle: {
        fontSize: FontSizes.sm,
        marginTop: 2,
    },
    loadingIndicator: {
        padding: Spacing.sm,
    },
});

export default BiometricLogin;
