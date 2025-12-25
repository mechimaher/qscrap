// QScrap Login Screen - Premium Design
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../../constants/theme';
import { AuthStackParamList } from '../../../App';

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
    const navigation = useNavigation<LoginScreenNavigationProp>();
    const { login } = useAuth();

    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async () => {
        if (!phone || !password) {
            setError('Please enter phone number and password');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setIsLoading(true);
        setError('');

        const result = await login(phone, password);

        setIsLoading(false);

        if (!result.success) {
            setError(result.error || 'Login failed');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    return (
        <LinearGradient
            colors={[Colors.dark.background, '#0a1a0a']}
            style={styles.container}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Logo Section */}
                    <View style={styles.logoSection}>
                        <Text style={styles.logoEmoji}>🔧</Text>
                        <Text style={styles.logoText}>QScrap</Text>
                        <Text style={styles.tagline}>Auto Parts Marketplace</Text>
                    </View>

                    {/* Form Section */}
                    <View style={styles.formSection}>
                        <Text style={styles.welcomeText}>Welcome Back</Text>
                        <Text style={styles.subtitleText}>Sign in to continue</Text>

                        {error ? (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : null}

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Phone Number</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="+974 XXXX XXXX"
                                placeholderTextColor={Colors.dark.textMuted}
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Password</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter password"
                                placeholderTextColor={Colors.dark.textMuted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                            onPress={handleLogin}
                            disabled={isLoading}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={Colors.gradients.primary}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.loginButtonGradient}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.loginButtonText}>Sign In</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        <View style={styles.registerSection}>
                            <Text style={styles.registerText}>Don't have an account?</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                                <Text style={styles.registerLink}>Sign Up</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            By signing in, you agree to our{' '}
                            <Text style={styles.footerLink}>Terms</Text> &{' '}
                            <Text style={styles.footerLink}>Privacy Policy</Text>
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
        justifyContent: 'center',
        padding: Spacing.lg,
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: Spacing.xxl,
    },
    logoEmoji: {
        fontSize: 64,
        marginBottom: Spacing.sm,
    },
    logoText: {
        fontSize: FontSizes.display,
        fontWeight: '800',
        color: Colors.primary,
        letterSpacing: 2,
    },
    tagline: {
        fontSize: FontSizes.md,
        color: Colors.dark.textSecondary,
        marginTop: Spacing.xs,
    },
    formSection: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        ...Shadows.lg,
    },
    welcomeText: {
        fontSize: FontSizes.xxl,
        fontWeight: '700',
        color: Colors.dark.text,
        textAlign: 'center',
    },
    subtitleText: {
        fontSize: FontSizes.md,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing.lg,
    },
    errorContainer: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.error,
    },
    errorText: {
        color: Colors.error,
        fontSize: FontSizes.sm,
        textAlign: 'center',
    },
    inputContainer: {
        marginBottom: Spacing.md,
    },
    inputLabel: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.xs,
    },
    input: {
        backgroundColor: Colors.dark.background,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: FontSizes.lg,
        color: Colors.dark.text,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    loginButton: {
        marginTop: Spacing.md,
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
    },
    loginButtonDisabled: {
        opacity: 0.7,
    },
    loginButtonGradient: {
        paddingVertical: Spacing.md,
        alignItems: 'center',
    },
    loginButtonText: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#fff',
    },
    registerSection: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Spacing.lg,
    },
    registerText: {
        fontSize: FontSizes.md,
        color: Colors.dark.textSecondary,
    },
    registerLink: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: Colors.primary,
        marginLeft: Spacing.xs,
    },
    footer: {
        marginTop: Spacing.xl,
        alignItems: 'center',
    },
    footerText: {
        fontSize: FontSizes.xs,
        color: Colors.dark.textMuted,
        textAlign: 'center',
    },
    footerLink: {
        color: Colors.primary,
    },
});
