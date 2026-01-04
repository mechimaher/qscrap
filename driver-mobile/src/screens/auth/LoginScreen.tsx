// QScrap Driver App - Login Screen
// Premium driver login experience

import React, { useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Colors } from '../../constants/theme';

export default function LoginScreen() {
    const { login } = useAuth();
    const { colors } = useTheme();

    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async () => {
        if (!phone.trim() || !password.trim()) {
            Alert.alert('Error', 'Please enter phone number and password');
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsLoading(true);

        const result = await login(phone.trim(), password);

        setIsLoading(false);

        if (!result.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Login Failed', result.error || 'Please check your credentials');
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    return (
        <LinearGradient
            colors={[Colors.dark.background, '#1a1a2e']}
            style={styles.gradient}
        >
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    {/* Logo Section */}
                    <View style={styles.logoSection}>
                        <Text style={styles.logoEmoji}>🚚</Text>
                        <Text style={styles.logoText}>QScrap</Text>
                        <Text style={styles.logoSubtext}>DRIVER</Text>
                        <Text style={styles.tagline}>Delivering Excellence</Text>
                    </View>

                    {/* Form Section */}
                    <View style={styles.formSection}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputIcon}>📱</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Phone Number"
                                placeholderTextColor={colors.textMuted}
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                                autoCapitalize="none"
                                editable={!isLoading}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputIcon}>🔒</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor={colors.textMuted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                editable={!isLoading}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.showPasswordBtn}
                            >
                                <Text style={styles.showPasswordText}>
                                    {showPassword ? '🙈' : '👁️'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                            onPress={handleLogin}
                            disabled={isLoading}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={[Colors.primary, Colors.primaryDark]}
                                style={styles.loginButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <>
                                        <Text style={styles.loginButtonText}>Sign In</Text>
                                        <Text style={styles.loginButtonIcon}>→</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            Driver accounts are created by QScrap Operations
                        </Text>
                        <Text style={styles.footerSubtext}>
                            Contact support if you need assistance
                        </Text>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logoEmoji: {
        fontSize: 64,
        marginBottom: 8,
    },
    logoText: {
        fontSize: 42,
        fontWeight: '800',
        color: Colors.primary,
        letterSpacing: 2,
    },
    logoSubtext: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 6,
        marginTop: 4,
    },
    tagline: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        marginTop: 12,
    },
    formSection: {
        gap: 16,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.surface,
        borderRadius: 16,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    inputIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    input: {
        flex: 1,
        height: 56,
        fontSize: 16,
        color: '#fff',
    },
    showPasswordBtn: {
        padding: 8,
    },
    showPasswordText: {
        fontSize: 20,
    },
    loginButton: {
        marginTop: 8,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    loginButtonDisabled: {
        opacity: 0.7,
    },
    loginButtonGradient: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    loginButtonIcon: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
    },
    footer: {
        alignItems: 'center',
        marginTop: 48,
    },
    footerText: {
        color: Colors.dark.textMuted,
        fontSize: 12,
        textAlign: 'center',
    },
    footerSubtext: {
        color: Colors.dark.textMuted,
        fontSize: 11,
        marginTop: 4,
    },
});
