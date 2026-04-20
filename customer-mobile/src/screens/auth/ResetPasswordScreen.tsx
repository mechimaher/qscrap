// QScrap Customer App - Reset Password Screen (Step 3 of 3)
// Enterprise Standard: Strong password validation with real-time feedback

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
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { api } from '../../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { rtlTextAlign } from '../../utils/rtl';

type RootStackParamList = {
    ResetPassword: { email: string; otp: string };
};

type ResetPasswordRouteProp = { email: string; otp: string };
type ResetPasswordNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen() {
    const navigation = useNavigation<ResetPasswordNavigationProp>();
    const route = useRoute<any>();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();

    const { email, otp } = route.params;
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Password strength tracking
    const [passwordStrength, setPasswordStrength] = useState({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false,
    });

    // Validate password in real-time
    React.useEffect(() => {
        setPasswordStrength({
            length: newPassword.length >= 12,
            uppercase: /[A-Z]/.test(newPassword),
            lowercase: /[a-z]/.test(newPassword),
            number: /[0-9]/.test(newPassword),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
        });
    }, [newPassword]);

    const calculateStrength = () => {
        const met = Object.values(passwordStrength).filter(Boolean).length;
        if (met === 5) return { level: 'strong', color: Colors.success };
        if (met >= 3) return { level: 'medium', color: Colors.warning };
        return { level: 'weak', color: Colors.error };
    };

    const strength = calculateStrength();

    const validatePassword = (): boolean => {
        if (newPassword.length < 12) {
            setError(t('auth.passwordTooShort'));
            return false;
        }

        if (!/[A-Z]/.test(newPassword)) {
            setError(t('auth.passwordNeedsUppercase'));
            return false;
        }

        if (!/[a-z]/.test(newPassword)) {
            setError(t('auth.passwordNeedsLowercase'));
            return false;
        }

        if (!/[0-9]/.test(newPassword)) {
            setError(t('auth.passwordNeedsNumber'));
            return false;
        }

        if (newPassword === confirmPassword.toLowerCase() || newPassword.toLowerCase() === confirmPassword) {
            setError(t('auth.passwordsMustDiffer'));
            return false;
        }

        return true;
    };

    const handleResetPassword = async () => {
        // Validation
        if (!newPassword || !confirmPassword) {
            setError(t('auth.fillAllFields'));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        if (!validatePassword()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        if (newPassword !== confirmPassword) {
            setError(t('auth.passwordsDontMatch'));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            // Reset password via API
            await api.resetPassword({
                email,
                otp,
                newPassword,
            });

            setIsLoading(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            Alert.alert(
                t('auth.passwordResetSuccess'),
                t('auth.passwordResetSuccessMessage'),
                [
                    {
                        text: t('common.ok'),
                        onPress: () => {
                            // Navigate back to login
                            (navigation as any).navigate('Login');
                        },
                    },
                ]
            );
        } catch (error: any) {
            setIsLoading(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            if (error.message?.includes('OTP')) {
                setError(t('auth.invalidCode'));
            } else if (error.message?.includes('Network')) {
                setError(t('auth.networkError'));
            } else {
                setError(error.message || t('auth.resetFailed'));
            }
        }
    };

    const RequirementRow = ({ met, text }: { met: boolean; text: string }) => (
        <View style={[styles.requirementRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
            <Ionicons
                name={met ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={met ? Colors.success : colors.textMuted}
                style={[isRTL && { marginRight: 0, marginLeft: Spacing.xs }, !isRTL && { marginRight: Spacing.xs }]}
            />
            <Text style={[styles.requirementText, { color: met ? Colors.success : colors.textMuted, textAlign: rtlTextAlign(isRTL) }]}>
                {text}
            </Text>
        </View>
    );

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
                            <Ionicons name="shield-checkmark" size={48} color="#fff" />
                        </View>
                        <Text style={styles.title}>{t('auth.resetPassword')}</Text>
                        <Text style={styles.subtitle}>
                            {t('auth.createStrongPassword')}
                        </Text>
                    </View>

                    {/* Error Message */}
                    {error ? (
                        <View style={styles.errorContainer}>
                            <Ionicons name="alert-circle" size={20} color={Colors.error} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    {/* Password Strength Indicator */}
                    <View style={styles.strengthContainer}>
                        <View style={styles.strengthBar}>
                            <View
                                style={[
                                    styles.strengthFill,
                                    {
                                        width: `${(Object.values(passwordStrength).filter(Boolean).length / 5) * 100}%`,
                                        backgroundColor: strength.color,
                                    },
                                ]}
                            />
                        </View>
                        <Text style={[styles.strengthText, { color: strength.color }]}>
                            {t('auth.passwordStrength')}: {strength.level.toUpperCase()}
                        </Text>
                    </View>

                    {/* New Password Input */}
                    <View style={styles.inputContainer}>
                        <Text style={[styles.inputLabel, { color: 'rgba(255,255,255,0.8)', textAlign: rtlTextAlign(isRTL) }]}>
                            {t('auth.newPassword')}
                        </Text>
                        <View style={[styles.inputWrapper, { backgroundColor: 'rgba(255,255,255,0.95)' }]}>
                            <Ionicons
                                name="lock-closed"
                                size={20}
                                color={Colors.primary}
                                style={[isRTL && { marginRight: 0, marginLeft: Spacing.sm }, !isRTL && { marginRight: Spacing.sm }]}
                            />
                            <TextInput
                                style={[styles.input, { textAlign: rtlTextAlign(isRTL) }]}
                                placeholder={t('auth.newPassword')}
                                placeholderTextColor="#666"
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!isLoading}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.eyeIcon}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye-off' : 'eye'}
                                    size={20}
                                    color="#666"
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Confirm Password Input */}
                    <View style={styles.inputContainer}>
                        <Text style={[styles.inputLabel, { color: 'rgba(255,255,255,0.8)', textAlign: rtlTextAlign(isRTL) }]}>
                            {t('auth.confirmPassword')}
                        </Text>
                        <View style={[styles.inputWrapper, { backgroundColor: 'rgba(255,255,255,0.95)' }]}>
                            <Ionicons
                                name="lock-closed"
                                size={20}
                                color={Colors.primary}
                                style={[isRTL && { marginRight: 0, marginLeft: Spacing.sm }, !isRTL && { marginRight: Spacing.sm }]}
                            />
                            <TextInput
                                style={[styles.input, { textAlign: rtlTextAlign(isRTL) }]}
                                placeholder={t('auth.confirmPassword')}
                                placeholderTextColor="#666"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry={!showConfirmPassword}
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!isLoading}
                            />
                            <TouchableOpacity
                                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                style={styles.eyeIcon}
                            >
                                <Ionicons
                                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                                    size={20}
                                    color="#666"
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Password Requirements */}
                    <View style={styles.requirementsContainer}>
                        <Text style={[styles.requirementsTitle, { color: 'rgba(255,255,255,0.8)' }]}>
                            {t('auth.passwordRequirements')}
                        </Text>
                        <RequirementRow met={passwordStrength.length} text={t('auth.requirementLength')} />
                        <RequirementRow met={passwordStrength.uppercase} text={t('auth.requirementUppercase')} />
                        <RequirementRow met={passwordStrength.lowercase} text={t('auth.requirementLowercase')} />
                        <RequirementRow met={passwordStrength.number} text={t('auth.requirementNumber')} />
                        <RequirementRow met={passwordStrength.special} text={t('auth.requirementSpecial')} />
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[styles.submitButton, (isLoading || Object.values(passwordStrength).filter(Boolean).length < 5) && styles.submitButtonDisabled]}
                        onPress={handleResetPassword}
                        disabled={isLoading || Object.values(passwordStrength).filter(Boolean).length < 5}
                        activeOpacity={0.9}
                    >
                        <LinearGradient
                            colors={Colors.gradients.primary}
                            style={styles.submitButtonGradient}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.submitButtonText}>{t('auth.resetPassword')}</Text>
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
    strengthContainer: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
    },
    strengthBar: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: Spacing.xs,
    },
    strengthFill: {
        height: '100%',
        borderRadius: 2,
    },
    strengthText: {
        fontSize: FontSizes.xs,
        fontWeight: '600',
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
    eyeIcon: {
        padding: Spacing.xs,
    },
    requirementsContainer: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
    },
    requirementsTitle: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        marginBottom: Spacing.sm,
    },
    requirementRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    requirementText: {
        fontSize: FontSizes.sm,
        flex: 1,
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
    },
    securityNoticeText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: FontSizes.sm,
        marginLeft: Spacing.sm,
        textAlign: 'center',
        flex: 1,
    },
});

// Helper for RTL
function rtlFlexDirection(isRTL: boolean): 'row' | 'row-reverse' {
    return isRTL ? 'row-reverse' : 'row';
}
