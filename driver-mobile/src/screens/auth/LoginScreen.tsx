// QScrap Driver App - Login Screen
// Premium driver login experience with Qatar VVIP Theme

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
    Image,
    Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows, BorderRadius, FontWeights } from '../../constants/theme';

export default function LoginScreen() {
    const { login } = useAuth();

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
            colors={[Colors.primary, Colors.primaryDark, '#4a0d1f']}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.5, y: 1 }}
        >
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    {/* Logo Section */}
                    <View style={styles.logoSection}>
                        <View style={styles.logoContainer}>
                            <Text style={styles.logoEmoji}>🚚</Text>
                        </View>
                        <Text style={styles.logoText}>QScrap</Text>
                        <View style={styles.driverBadge}>
                            <Text style={styles.driverBadgeText}>DRIVER</Text>
                        </View>
                        <Text style={styles.tagline}>Delivering Excellence</Text>
                    </View>

                    {/* Form Section */}
                    <View style={styles.formSection}>
                        <View style={styles.inputContainer}>
                            <View style={styles.inputIconContainer}>
                                <Text style={styles.inputIcon}>📱</Text>
                            </View>
                            {/* P1 FIX: Qatar Country Code Display */}
                            <View style={styles.countryCodeContainer}>
                                <Text style={styles.countryCodeText}>+974</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder="Phone Number"
                                placeholderTextColor="rgba(255,255,255,0.5)"
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                                autoCapitalize="none"
                                editable={!isLoading}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <View style={styles.inputIconContainer}>
                                <Text style={styles.inputIcon}>🔒</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor="rgba(255,255,255,0.5)"
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
                                colors={[Colors.secondary, '#a68520']}
                                style={styles.loginButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color={Colors.primaryDark} size="small" />
                                ) : (
                                    <>
                                        <Text style={styles.loginButtonText}>Sign In</Text>
                                        <Text style={styles.loginButtonIcon}>→</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* P2: Forgot Password */}
                        <TouchableOpacity
                            style={styles.forgotPasswordButton}
                            onPress={() => {
                                Alert.alert(
                                    'Forgot Password?',
                                    'Driver accounts are managed by QScrap Operations. Please contact support on WhatsApp to reset your password.',
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Contact Support',
                                            onPress: () => Linking.openURL('whatsapp://send?phone=97455555555&text=Hi, I need help resetting my driver password')
                                        }
                                    ]
                                );
                            }}
                        >
                            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
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
                        <TouchableOpacity
                            style={styles.helpButton}
                            onPress={() => Linking.openURL('whatsapp://send?phone=97455555555')}
                        >
                            <Text style={styles.helpButtonText}>Need Help?</Text>
                        </TouchableOpacity>
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
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    logoEmoji: {
        fontSize: 56,
    },
    logoText: {
        fontSize: 42,
        fontWeight: FontWeights.heavy,
        color: '#fff',
        letterSpacing: 2,
    },
    driverBadge: {
        backgroundColor: Colors.secondary,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
        marginTop: 8,
    },
    driverBadgeText: {
        fontSize: 14,
        fontWeight: FontWeights.bold,
        color: Colors.primaryDark,
        letterSpacing: 4,
    },
    tagline: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 16,
    },
    formSection: {
        gap: 16,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    inputIconContainer: {
        width: 48,
        alignItems: 'center',
    },
    inputIcon: {
        fontSize: 20,
    },
    countryCodeContainer: {
        paddingRight: 8,
        borderRightWidth: 1,
        borderRightColor: 'rgba(255,255,255,0.2)',
    },
    countryCodeText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
    input: {
        flex: 1,
        height: 56,
        fontSize: 16,
        color: '#fff',
    },
    showPasswordBtn: {
        padding: 16,
    },
    showPasswordText: {
        fontSize: 20,
    },
    loginButton: {
        marginTop: 8,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        ...Shadows.glow,
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
        color: Colors.primaryDark,
        fontSize: 18,
        fontWeight: FontWeights.bold,
    },
    loginButtonIcon: {
        color: Colors.primaryDark,
        fontSize: 20,
        fontWeight: FontWeights.bold,
    },
    forgotPasswordButton: {
        marginTop: 16,
        alignItems: 'center',
        paddingVertical: 8,
    },
    forgotPasswordText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    footer: {
        alignItems: 'center',
        marginTop: 48,
    },
    footerText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        textAlign: 'center',
    },
    footerSubtext: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        marginTop: 4,
    },
    helpButton: {
        marginTop: 16,
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    helpButtonText: {
        color: Colors.secondary,
        fontSize: 12,
        fontWeight: 'bold',
    },
});

