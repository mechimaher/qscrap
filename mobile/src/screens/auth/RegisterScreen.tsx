// QScrap Register Screen - Premium VIP Design with Full i18n Support
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
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../../utils/rtl';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { AuthStackParamList } from '../../../App';
import { api } from '../../services/api';

type RegisterScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export default function RegisterScreen() {
    const navigation = useNavigation<RegisterScreenNavigationProp>();
    const { register, login } = useAuth();
    const { t, isRTL } = useTranslation();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleRegister = async () => {
        // Validation
        if (!name || !email || !phone || !password || !confirmPassword) {
            setError(t('auth.fillAllFields'));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        // Email validation
        if (!validateEmail(email)) {
            setError('Please enter a valid email address');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        if (password !== confirmPassword) {
            setError(t('auth.passwordsDontMatch'));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        if (password.length < 6) {
            setError(t('auth.passwordMinLength'));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            // Call new Email OTP registration API
            const result = await api.registerWithEmail({
                full_name: name,
                email: email.toLowerCase().trim(),
                phone_number: phone,
                password
            });

            setIsLoading(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Navigate to OTP verification screen
            navigation.navigate('VerifyOTP' as any, {
                email: email.toLowerCase().trim(),
                full_name: name,
                phone_number: phone,
                password
            });
        } catch (error: any) {
            setIsLoading(false);
            setError(error.message || 'Registration failed. Please try again.');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Text style={styles.backText}>{isRTL ? '→' : '←'} {t('common.back')}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Title Section */}
                    <View style={styles.titleSection}>
                        <Image
                            source={require('../../../assets/logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        <Text style={[styles.titleText, { textAlign: 'center' }]}>{t('auth.joinQScrap')}</Text>
                        <Text style={[styles.subtitleText, { textAlign: 'center' }]}>{t('auth.createAccountInSeconds')}</Text>
                    </View>

                    {/* Form Card */}
                    <View style={styles.formCard}>
                        {error ? (
                            <View style={[styles.errorContainer, { flexDirection: rtlFlexDirection(isRTL) }]}>
                                <Text style={[styles.errorIcon, isRTL && { marginRight: 0, marginLeft: Spacing.sm }]}>⚠️</Text>
                                <Text style={[styles.errorText, { textAlign: rtlTextAlign(isRTL) }]}>{error}</Text>
                            </View>
                        ) : null}

                        <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { textAlign: rtlTextAlign(isRTL) }]}>👤 {t('auth.fullName')}</Text>
                            <TextInput
                                style={[styles.input, { textAlign: rtlTextAlign(isRTL) }]}
                                placeholder={t('auth.enterFullName')}
                                placeholderTextColor="#999"
                                value={name}
                                onChangeText={setName}
                                autoCapitalize="words"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { textAlign: rtlTextAlign(isRTL) }]}>📧 Email Address</Text>
                            <TextInput
                                style={[styles.input, { textAlign: rtlTextAlign(isRTL) }]}
                                placeholder="name@company.qa"
                                placeholderTextColor="#999"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { textAlign: rtlTextAlign(isRTL) }]}>📱 {t('auth.phoneNumber')}</Text>
                            <TextInput
                                style={[styles.input, { textAlign: rtlTextAlign(isRTL) }]}
                                placeholder="+974 XXXX XXXX"
                                placeholderTextColor="#999"
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { textAlign: rtlTextAlign(isRTL) }]}>🔒 {t('auth.password')}</Text>
                            <TextInput
                                style={[styles.input, { textAlign: rtlTextAlign(isRTL) }]}
                                placeholder={t('auth.minCharacters')}
                                placeholderTextColor="#999"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { textAlign: rtlTextAlign(isRTL) }]}>🔒 {t('auth.confirmPassword')}</Text>
                            <TextInput
                                style={[styles.input, { textAlign: rtlTextAlign(isRTL) }]}
                                placeholder={t('auth.repeatPassword')}
                                placeholderTextColor="#999"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
                            onPress={handleRegister}
                            disabled={isLoading}
                            activeOpacity={0.9}
                        >
                            <LinearGradient
                                colors={[Colors.primary, '#B31D4A']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.registerButtonGradient}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.registerButtonText}>{t('auth.createAccount')}</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Benefits */}
                        <View style={[styles.benefits, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <View style={styles.benefitItem}>
                                <Text style={styles.benefitIcon}>✓</Text>
                                <Text style={styles.benefitText}>{t('auth.freeToJoin')}</Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <Text style={styles.benefitIcon}>✓</Text>
                                <Text style={styles.benefitText}>{t('auth.noHiddenFees')}</Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <Text style={styles.benefitIcon}>✓</Text>
                                <Text style={styles.benefitText}>{t('auth.verifiedSellers')}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Login Section */}
                    <View style={[styles.loginSection, { flexDirection: rtlFlexDirection(isRTL) }]}>
                        <Text style={styles.loginText}>{t('auth.alreadyHaveAccount')}</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={[styles.loginLink, isRTL && { marginLeft: 0, marginRight: Spacing.xs }]}>{t('auth.signIn')}</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        padding: Spacing.lg,
    },
    header: {
        marginTop: Spacing.lg,
        marginBottom: Spacing.md,
    },
    backButton: {
        padding: Spacing.sm,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: BorderRadius.md,
        alignSelf: 'flex-start',
    },
    backText: {
        color: '#ffffff',
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
    titleSection: {
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    logo: {
        width: 80,
        height: 80,
        borderRadius: 20,
        marginBottom: Spacing.md,
    },
    titleText: {
        fontSize: FontSizes.xxl + 4,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: -0.5,
        textShadowColor: 'rgba(138, 21, 56, 0.6)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 10,
    },
    subtitleText: {
        fontSize: FontSizes.md,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: Spacing.xs,
    },
    formCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        ...Shadows.lg,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: '#EF4444',
    },
    errorIcon: {
        fontSize: 16,
        marginRight: Spacing.sm,
    },
    errorText: {
        color: '#EF4444',
        fontSize: FontSizes.sm,
        flex: 1,
    },
    inputContainer: {
        marginBottom: Spacing.md,
    },
    inputLabel: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: '#525252',
        marginBottom: Spacing.xs,
    },
    input: {
        backgroundColor: '#F8F9FA',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        fontSize: FontSizes.md,
        color: '#1a1a1a',
        borderWidth: 1.5,
        borderColor: '#E8E8E8',
    },
    registerButton: {
        marginTop: Spacing.md,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.md,
    },
    registerButtonDisabled: { opacity: 0.7 },
    registerButtonGradient: {
        paddingVertical: Spacing.md + 4,
        alignItems: 'center',
    },
    registerButtonText: {
        fontSize: FontSizes.lg,
        fontWeight: '800',
        color: '#fff',
    },
    benefits: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: Spacing.lg,
        paddingTop: Spacing.lg,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    benefitItem: {
        alignItems: 'center',
    },
    benefitIcon: {
        fontSize: 16,
        color: '#22C55E',
        fontWeight: '700',
        marginBottom: 4,
    },
    benefitText: {
        fontSize: FontSizes.xs,
        color: '#525252',
    },
    loginSection: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Spacing.xl,
    },
    loginText: {
        fontSize: FontSizes.md,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    loginLink: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#ffffff',
        marginLeft: Spacing.xs,
    },
});
