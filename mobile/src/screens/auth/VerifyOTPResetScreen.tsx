// QScrap Customer App - Verify OTP for Password Reset (Step 2 of 3)
// Enterprise Standard: OTP verification with rate limiting and expiry

import React, { useState, useEffect, useRef } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { api } from '../../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { rtlTextAlign } from '../../utils/rtl';

type RootStackParamList = {
    VerifyOTPReset: { email: string };
    ResetPassword: { email: string; otp: string };
};

type VerifyOTPResetRouteProp = { email: string };
type VerifyOTPResetNavigationProp = NativeStackNavigationProp<RootStackParamList, 'VerifyOTPReset'>;

export default function VerifyOTPResetScreen() {
    const navigation = useNavigation<VerifyOTPResetNavigationProp>();
    const route = useRoute<any>();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();

    const { email } = route.params;
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [timer, setTimer] = useState(300); // 5 minutes
    const [canResend, setCanResend] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);

    const inputRefs = useRef<(TextInput | null)[]>([]);

    useEffect(() => {
        // Countdown timer
        const interval = setInterval(() => {
            setTimer(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Enable resend after 60 seconds
        const resendTimer = setTimeout(() => setCanResend(true), 60000);

        return () => {
            clearInterval(interval);
            clearTimeout(resendTimer);
        };
    }, []);

    const handleOTPChange = (value: string, index: number) => {
        if (value.length > 1) return; // Only single digit

        const newOTP = [...otp];
        newOTP[index] = value;
        setOtp(newOTP);

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 digits entered
        if (newOTP.every(digit => digit !== '')) {
            handleVerify(newOTP.join(''));
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (otpCode: string) => {
        setIsVerifying(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            // Verify OTP
            await api.verifyPasswordResetOTP({
                email,
                otp: otpCode,
            });

            setIsVerifying(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Navigate to password reset screen
            (navigation as any).navigate('ResetPassword', { email, otp: otpCode });
        } catch (error: any) {
            setIsVerifying(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            Alert.alert(
                t('auth.verificationFailed'),
                error.message || t('auth.invalidCode'),
                [{ text: t('common.ok') }]
            );

            // Clear OTP
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        }
    };

    const handleResend = async () => {
        if (!canResend || isResending) return;

        setIsResending(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            await api.resendPasswordResetOTP(email);

            setIsResending(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            Alert.alert(
                t('auth.codeSent'),
                t('auth.codeSentMsg'),
                [{ text: t('common.ok') }]
            );

            // Reset timer
            setTimer(300);
            setCanResend(false);
            setTimeout(() => setCanResend(true), 60000);
        } catch (error: any) {
            setIsResending(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(
                t('common.error'),
                error.message || t('auth.resendFailed'),
                [{ text: t('common.ok') }]
            );
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Mask email for display (e.g., j***@gmail.com)
    const maskEmail = (email: string) => {
        const [username, domain] = email.split('@');
        if (!domain) return email;
        const masked = username.charAt(0) + '***';
        return `${masked}@${domain}`;
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
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                        >
                            <Ionicons name="arrow-back" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* Icon & Title */}
                    <View style={styles.iconSection}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="mail" size={48} color="#fff" />
                        </View>
                        <Text style={styles.title}>{t('auth.verifyOTP')}</Text>
                        <Text style={styles.subtitle}>
                            {t('auth.otpSentTo', { email: maskEmail(email) })}
                        </Text>
                    </View>

                    {/* OTP Input */}
                    <View style={styles.otpContainer}>
                        {otp.map((digit, index) => (
                            <TextInput
                                key={index}
                                ref={ref => { inputRefs.current[index] = ref; }}
                                style={[
                                    styles.otpInput,
                                    digit ? styles.otpInputFilled : null
                                ]}
                                value={digit}
                                onChangeText={val => handleOTPChange(val, index)}
                                onKeyPress={e => handleKeyPress(e, index)}
                                keyboardType="number-pad"
                                maxLength={1}
                                selectTextOnFocus
                                editable={!isVerifying}
                            />
                        ))}
                    </View>

                    {/* Timer */}
                    <Text style={[styles.timer, timer === 0 && styles.timerExpired]}>
                        {timer > 0 ? (
                            <>{t('auth.codeExpiresIn')} {formatTime(timer)}</>
                        ) : (
                            <>{t('auth.codeExpired')}</>
                        )}
                    </Text>

                    {/* Verifying Indicator */}
                    {isVerifying && (
                        <View style={styles.verifyingContainer}>
                            <ActivityIndicator color="#fff" size="small" />
                            <Text style={styles.verifyingText}>{t('auth.verifying')}</Text>
                        </View>
                    )}

                    {/* Resend Code */}
                    <TouchableOpacity
                        style={[styles.resendButton, (!canResend || isResending) && styles.resendButtonDisabled]}
                        onPress={handleResend}
                        disabled={!canResend || isResending}
                    >
                        {isResending ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.resendText}>
                                {canResend ? t('auth.resendCode') : t('auth.resendWait', { seconds: 60 })}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Security Notice */}
                    <View style={styles.securityNotice}>
                        <Ionicons name="shield-checkmark" size={16} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.securityNoticeText}>
                            {t('auth.otpSecure')}
                        </Text>
                    </View>
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
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
        gap: Spacing.sm,
    },
    otpInput: {
        width: 50,
        height: 60,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: BorderRadius.lg,
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
        color: '#1a1a1a',
        borderWidth: 2,
        borderColor: '#E8E8E8',
        ...Shadows.md,
    },
    otpInputFilled: {
        borderColor: Colors.primary,
        backgroundColor: '#fff',
    },
    timer: {
        fontSize: FontSizes.sm,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: Spacing.xl,
        textAlign: 'center',
    },
    timerExpired: {
        color: '#FF6B6B',
        fontWeight: '700',
    },
    verifyingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    verifyingText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
    resendButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        marginBottom: Spacing.lg,
        alignItems: 'center',
    },
    resendButtonDisabled: {
        opacity: 0.5,
    },
    resendText: {
        color: '#fff',
        fontSize: FontSizes.md,
        fontWeight: '700',
        textAlign: 'center',
    },
    securityNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
    },
    securityNoticeText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: FontSizes.sm,
        marginLeft: Spacing.sm,
        textAlign: 'center',
        flex: 1,
    },
});
