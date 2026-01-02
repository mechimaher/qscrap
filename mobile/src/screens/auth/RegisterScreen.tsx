// QScrap Register Screen - Premium VIP Design
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
            colors={['#0f0c29', '#302b63', '#24243e']}
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
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Text style={styles.backText}>← Back</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Title Section */}
                    <View style={styles.titleSection}>
                        <Text style={styles.titleEmoji}>🚀</Text>
                        <Text style={styles.titleText}>Join QScrap</Text>
                        <Text style={styles.subtitleText}>Create your account in seconds</Text>
                    </View>

                    {/* Form Card */}
                    <View style={styles.formCard}>
                        {error ? (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorIcon}>⚠️</Text>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : null}

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>👤 Full Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your full name"
                                placeholderTextColor="#999"
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>📱 Phone Number</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="+974 XXXX XXXX"
                                placeholderTextColor="#999"
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>🔒 Password</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Min 6 characters"
                                placeholderTextColor="#999"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>🔒 Confirm Password</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Repeat password"
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
                                    <Text style={styles.registerButtonText}>Create Account</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Benefits */}
                        <View style={styles.benefits}>
                            <View style={styles.benefitItem}>
                                <Text style={styles.benefitIcon}>✓</Text>
                                <Text style={styles.benefitText}>Free to join</Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <Text style={styles.benefitIcon}>✓</Text>
                                <Text style={styles.benefitText}>No hidden fees</Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <Text style={styles.benefitIcon}>✓</Text>
                                <Text style={styles.benefitText}>Verified sellers</Text>
                            </View>
                        </View>
                    </View>

                    {/* Login Section */}
                    <View style={styles.loginSection}>
                        <Text style={styles.loginText}>Already have an account?</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.loginLink}>Sign In</Text>
                        </TouchableOpacity>
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
    titleEmoji: {
        fontSize: 48,
        marginBottom: Spacing.sm,
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
        color: '#525252', // Always dark on white card
        marginBottom: Spacing.xs,
    },
    input: {
        backgroundColor: '#F8F9FA',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        fontSize: FontSizes.md,
        color: '#1a1a1a', // Always dark input text on light background
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
        color: '#525252', // Always dark on white card
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
