// QScrap Customer App - Forgot Password Screen (Step 1 of 3)
// Enterprise Standard: Email input with neutral response to prevent account enumeration

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { api } from '../../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { rtlFlexDirection, rtlTextAlign } from '../../utils/rtl';

type RootStackParamList = {
    ForgotPassword: undefined;
    VerifyOTPReset: { email: string };
    ResetPassword: { email: string; otp: string };
};

type ForgotPasswordNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen() {
    const navigation = useNavigation<ForgotPasswordNavigationProp>();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();

    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleRequestReset = async () => {
        // Validation
        if (!email.trim()) {
            setError(t('auth.enterEmail'));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        if (!validateEmail(email.trim())) {
            setError(t('auth.invalidEmail'));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            // Enterprise Security: Neutral response to prevent account enumeration
            await api.requestPasswordReset(email.trim().toLowerCase());

            // Always show success message regardless of whether email exists
            // This prevents attackers from determining which emails are registered
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            Alert.alert(
                t('auth.resetEmailSent'),
                t('auth.resetEmailSentMessage', { email: email.trim() }),
                [
                    {
                        text: t('common.ok'),
                        onPress: () => {
                            // Navigate to OTP verification
                            navigation.navigate('VerifyOTPReset', { email: email.trim().toLowerCase() });
                        },
                    },
                ]
            );
        } catch (error: any) {
            // Even on error, show neutral message for security
            // Backend should handle rate limiting, etc.
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            
            // Only show technical errors (network, etc.), not "email not found"
            if (error.message?.includes('Network') || error.message?.includes('timeout')) {
                setError(t('auth.networkError'));
            } else {
                // Show generic message
                Alert.alert(
                    t('auth.resetEmailSent'),
                    t('auth.resetEmailSentMessage', { email: email.trim() }),
                    [{
                        text: t('common.ok'),
                        onPress: () => navigation.navigate('VerifyOTPReset', { email: email.trim().toLowerCase() }),
                    }]
                );
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={[Colors.primary, Colors.primaryDark, '#4A0D1F']}
            style={styles.container}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={[styles.header, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                        >
                            <Ionicons
                                name={isRTL ? 'arrow-forward' : 'arrow-back'}
                                size={20}
                                color="#fff"
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Icon & Title */}
                    <View style={styles.iconSection}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="lock-closed" size={48} color="#fff" />
                        </View>
                        <Text style={styles.title}>{t('auth.forgotPassword')}</Text>
                        <Text style={styles.subtitle}>
                            {t('auth.forgotPasswordSubtitle')}
                        </Text>
                    </View>

                    {/* Error Message */}
                    {error ? (
                        <View style={styles.errorContainer}>
                            <Ionicons name="alert-circle" size={20} color={Colors.error} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    {/* Email Input */}
                    <View style={styles.inputContainer}>
                        <Text style={[styles.inputLabel, { color: 'rgba(255,255,255,0.8)', textAlign: rtlTextAlign(isRTL) }]}>
                            {t('auth.emailAddress')}
                        </Text>
                        <View style={[styles.inputWrapper, { backgroundColor: 'rgba(255,255,255,0.95)' }]}>
                            <Ionicons
                                name="mail"
                                size={20}
                                color={Colors.primary}
                                style={[isRTL && { marginRight: 0, marginLeft: Spacing.sm }, !isRTL && { marginRight: Spacing.sm }]}
                            />
                            <TextInput
                                style={[styles.input, { textAlign: rtlTextAlign(isRTL) }]}
                                placeholder={t('auth.emailPlaceholder')}
                                placeholderTextColor="#666"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!isLoading}
                            />
                        </View>
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                        onPress={handleRequestReset}
                        disabled={isLoading}
                        activeOpacity={0.9}
                    >
                        <LinearGradient
                            colors={Colors.gradients.primary}
                            style={styles.submitButtonGradient}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.submitButtonText}>{t('auth.sendResetLink')}</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Security Notice */}
                    <View style={styles.securityNotice}>
                        <Ionicons name="shield-checkmark" size={16} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.securityNoticeText}>
                            {t('auth.passwordResetSecure')}
                        </Text>
                    </View>

                    {/* Back to Login */}
                    <TouchableOpacity
                        style={styles.backToLogin}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backToLoginText}>
                            {t('auth.backToLogin')}
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: Spacing.lg,
    },
    header: {
        marginTop: Spacing.lg,
        marginBottom: Spacing.xl,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconSection: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    title: {
        fontSize: FontSizes.xxl + 4,
        fontWeight: '800',
        color: '#fff',
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: FontSizes.md,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        lineHeight: 22,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239,68,68,0.15)',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.error,
    },
    errorText: {
        flex: 1,
        color: '#fff',
        fontSize: FontSizes.sm,
        marginLeft: Spacing.sm,
    },
    inputContainer: {
        marginBottom: Spacing.lg,
    },
    inputLabel: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        marginBottom: Spacing.xs,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
    },
    input: {
        flex: 1,
        fontSize: FontSizes.lg,
        color: '#1a1a1a',
    },
    submitButton: {
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.md,
        marginBottom: Spacing.lg,
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitButtonGradient: {
        paddingVertical: Spacing.md + 4,
        alignItems: 'center',
    },
    submitButtonText: {
        fontSize: FontSizes.lg,
        fontWeight: '800',
        color: '#fff',
    },
    securityNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
    },
    securityNoticeText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: FontSizes.sm,
        marginLeft: Spacing.sm,
        textAlign: 'center',
        flex: 1,
    },
    backToLogin: {
        alignItems: 'center',
        paddingVertical: Spacing.md,
    },
    backToLoginText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
});
