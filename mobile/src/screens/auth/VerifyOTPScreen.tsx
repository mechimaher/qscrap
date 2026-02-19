// QScrap Verify OTP Screen - Email Verification
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { useTranslation } from '../../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../../../App';
import { rtlFlexDirection, rtlTextAlign } from '../../utils/rtl';

type VerifyOTPScreenProps = NativeStackScreenProps<AuthStackParamList, 'VerifyOTP'>;

export default function VerifyOTPScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
    const route = useRoute<VerifyOTPScreenProps['route']>();
    const { refreshUser } = useAuth();

    const { email, full_name, phone_number, password } = route.params;
    const { t, isRTL } = useTranslation();

    const [otp, setOTP] = useState(['', '', '', '', '', '']);
    const [timer, setTimer] = useState(600); // 10 minutes
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

        // Enable resend after 30 seconds
        const resendTimer = setTimeout(() => setCanResend(true), 30000);

        return () => {
            clearInterval(interval);
            clearTimeout(resendTimer);
        };
    }, []);

    const handleOTPChange = (value: string, index: number) => {
        if (value.length > 1) return; // Only single digit

        const newOTP = [...otp];
        newOTP[index] = value;
        setOTP(newOTP);

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
            await api.verifyEmailOTP({
                email,
                otp: otpCode,
                full_name,
                phone_number,
                password
            });

            setIsVerifying(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Refresh user state to trigger navigation to home
            await refreshUser();

            Alert.alert(
                t('auth.registrationSuccess'),
                t('auth.accountCreated'),
                [
                    {
                        text: t('auth.getStarted'),
                        onPress: () => {
                            // Navigation is now automatic via AuthContext
                        }
                    }
                ]
            );
        } catch (error: any) {
            setIsVerifying(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            Alert.alert(t('auth.verificationFailed'), error.message || t('auth.invalidCode'));

            // Clear OTP
            setOTP(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        }
    };

    const handleResend = async () => {
        if (!canResend || isResending) return;

        setIsResending(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            await api.resendOTP(email, full_name);

            setIsResending(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            Alert.alert(t('auth.codeSent'), t('auth.codeSentMsg'));

            // Reset timer
            setTimer(600);
            setCanResend(false);
            setTimeout(() => setCanResend(true), 30000);
        } catch (error: any) {
            setIsResending(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(t('common.error'), error.message || t('auth.resendFailed'));
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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
                {/* Header */}
                <View style={[styles.header, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={20} color={Colors.theme.text} />
                        <Text style={styles.backText}>{t('common.back')}</Text>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <Ionicons name="mail-outline" size={64} color="#fff" style={{ marginBottom: Spacing.md }} />
                    <Text style={styles.title}>{t('auth.emailVerification')}</Text>
                    <Text style={styles.subtitle}>
                        {t('auth.enterCodeSentTo')}{'\n'}
                        <Text style={styles.email}>{email}</Text>
                    </Text>

                    {/* OTP Input */}
                    <View style={[styles.otpContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
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

                    {/* Verify Button */}
                    {isVerifying && (
                        <View style={[styles.verifyingContainer, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <ActivityIndicator color={Colors.primary} size="small" />
                            <Text style={styles.verifyingText}>{t('auth.verifying')}</Text>
                        </View>
                    )}

                    {/* Resend */}
                    <TouchableOpacity
                        style={[styles.resendButton, (!canResend || isResending) && styles.resendButtonDisabled]}
                        onPress={handleResend}
                        disabled={!canResend || isResending}
                    >
                        {isResending ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.resendText}>
                                {canResend ? t('auth.resendCode') : t('auth.resendWait', { seconds: 30 })}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Help */}
                    <TouchableOpacity
                        style={styles.helpButton}
                        onPress={() => {
                            navigation.goBack();
                        }}
                    >
                        <Text style={styles.helpText}>{t('auth.wrongEmail')}</Text>
                    </TouchableOpacity>
                </View>
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
    header: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.xxl,
        paddingBottom: Spacing.md,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.sm,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: BorderRadius.md,
        gap: Spacing.xs,
    },
    backText: {
        color: '#ffffff',
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        paddingHorizontal: Spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: FontSizes.xxl + 4,
        fontWeight: '800',
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: FontSizes.md,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
        marginBottom: Spacing.xxl,
    },
    email: {
        fontWeight: '700',
        color: Colors.secondary,
    },
    otpContainer: {
        justifyContent: 'center',
        marginBottom: Spacing.lg,
        gap: Spacing.sm,
    },
    otpInput: {
        width: 50,
        height: 60,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: Spacing.xl,
        textAlign: 'center',
    },
    timerExpired: {
        color: '#FF6B6B',
        fontWeight: '700',
    },
    verifyingContainer: {
        alignItems: 'center',
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    verifyingText: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
    resendButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        marginBottom: Spacing.md,
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
    helpButton: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
    },
    helpText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: FontSizes.sm,
        textDecorationLine: 'underline',
        textAlign: 'center',
    },
});
