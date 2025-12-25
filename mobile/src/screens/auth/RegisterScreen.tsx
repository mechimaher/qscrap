// QScrap Register Screen - Premium Design
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

type RegisterScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export default function RegisterScreen() {
    const navigation = useNavigation<RegisterScreenNavigationProp>();
    const { register, login } = useAuth();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRegister = async () => {
        if (!name || !phone || !password || !confirmPassword) {
            setError('Please fill all fields');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setIsLoading(true);
        setError('');

        const result = await register(name, phone, password);

        if (!result.success) {
            setIsLoading(false);
            setError(result.error || 'Registration failed');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
            // Auto login after registration
            const loginResult = await login(phone, password);
            setIsLoading(false);

            if (!loginResult.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                navigation.navigate('Login');
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
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
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Text style={styles.backText}>← Back</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Form Section */}
                    <View style={styles.formSection}>
                        <Text style={styles.welcomeText}>Create Account</Text>
                        <Text style={styles.subtitleText}>Join QScrap today</Text>

                        {error ? (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : null}

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Full Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your full name"
                                placeholderTextColor={Colors.dark.textMuted}
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Phone Number</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="+974 XXXX XXXX"
                                placeholderTextColor={Colors.dark.textMuted}
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Password</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Min 6 characters"
                                placeholderTextColor={Colors.dark.textMuted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Confirm Password</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Repeat password"
                                placeholderTextColor={Colors.dark.textMuted}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
                            onPress={handleRegister}
                            disabled={isLoading}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={Colors.gradients.primary}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.registerButtonGradient}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.registerButtonText}>Create Account</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        <View style={styles.loginSection}>
                            <Text style={styles.loginText}>Already have an account?</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                                <Text style={styles.loginLink}>Sign In</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    keyboardView: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        padding: Spacing.lg,
    },
    header: {
        marginTop: Spacing.xxl,
        marginBottom: Spacing.lg,
    },
    backButton: {
        padding: Spacing.sm,
    },
    backText: {
        color: Colors.primary,
        fontSize: FontSizes.lg,
        fontWeight: '600',
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
    registerButton: {
        marginTop: Spacing.md,
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
    },
    registerButtonDisabled: { opacity: 0.7 },
    registerButtonGradient: {
        paddingVertical: Spacing.md,
        alignItems: 'center',
    },
    registerButtonText: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#fff',
    },
    loginSection: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Spacing.lg,
    },
    loginText: {
        fontSize: FontSizes.md,
        color: Colors.dark.textSecondary,
    },
    loginLink: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: Colors.primary,
        marginLeft: Spacing.xs,
    },
});
