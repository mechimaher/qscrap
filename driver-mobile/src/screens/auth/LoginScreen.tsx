// QScrap Driver App - Login Screen
// Premium driver login experience with Qatar VVIP Theme
// Matching customer app logo styling and effects

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
    Image,
    Linking,
    Animated,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows, BorderRadius, FontWeights } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
    const { login } = useAuth();

    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Premium Animations (matching customer app)
    const floatAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Floating animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: -8,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Entrance fade
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
        ]).start();

        // Subtle pulse for gold ring
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 2000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

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
                    {/* Logo Section with Premium Animation */}
                    <Animated.View style={[
                        styles.logoSection,
                        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                    ]}>
                        <Animated.View
                            style={[
                                styles.logoContainer,
                                {
                                    transform: [
                                        { translateY: floatAnim },
                                        { scale: pulseAnim }
                                    ],
                                    shadowColor: '#D4AF37',
                                }
                            ]}
                        >
                            {/* Gold Ring */}
                            <View style={styles.goldRing} />
                            <Image
                                source={require('../../../assets/logo.png')}
                                style={styles.logo}
                                resizeMode="cover"
                            />
                        </Animated.View>
                        <Text style={styles.logoText}>QSCRAP</Text>
                        <View style={styles.driverBadge}>
                            <Text style={styles.driverBadgeText}>DRIVER</Text>
                        </View>
                        <View style={styles.taglineContainer}>
                            <View style={styles.goldLine} />
                            <Text style={styles.tagline}>Delivering Excellence</Text>
                            <View style={styles.goldLine} />
                        </View>
                    </Animated.View>

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
        borderRadius: 24,
        marginBottom: 16,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
        elevation: 12,
    },
    logo: {
        width: 100,
        height: 100,
        borderRadius: 24,
        overflow: 'hidden',
    },
    goldRing: {
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: 28,
        borderWidth: 3,
        borderColor: '#D4AF37',
    },
    logoText: {
        fontSize: 42,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: 2,
        textShadowColor: 'rgba(138, 21, 56, 0.6)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 10,
    },
    driverBadge: {
        backgroundColor: Colors.secondary,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 9999,
        marginTop: 8,
    },
    driverBadgeText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.primaryDark,
        letterSpacing: 4,
    },
    taglineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
    },
    tagline: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '600',
        marginHorizontal: 12,
    },
    goldLine: {
        width: 30,
        height: 2,
        backgroundColor: '#D4AF37',
        borderRadius: 1,
    },
    formSection: {
        gap: 16,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
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
        borderRadius: 16,
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
        fontWeight: '700',
    },
    loginButtonIcon: {
        color: Colors.primaryDark,
        fontSize: 20,
        fontWeight: '700',
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
