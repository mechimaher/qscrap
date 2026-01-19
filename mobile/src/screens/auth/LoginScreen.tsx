// QScrap Login Screen - Premium VIP Design
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
    Dimensions,
    Image,
    Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth, useTheme } from '../../contexts';
import { Spacing, BorderRadius, FontSizes, Shadows, Colors as ThemeColors } from '../../constants/theme';
import { AuthStackParamList } from '../../../App';

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;
const { width } = Dimensions.get('window');

export default function LoginScreen() {
    const navigation = useNavigation<LoginScreenNavigationProp>();
    const { login } = useAuth();
    const { colors } = useTheme();

    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Animations
    const floatAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const goldShimmerAnim = useRef(new Animated.Value(0)).current;

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

        // Gold shimmer effect
        Animated.loop(
            Animated.timing(goldShimmerAnim, {
                toValue: 1,
                duration: 3000,
                useNativeDriver: true,
            })
        ).start();
    }, []);

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
            colors={ThemeColors.gradients.primaryDark}
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
                    {/* Logo Section with Premium Animation */}
                    <Animated.View style={[
                        styles.logoSection,
                        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                    ]}>
                        <Animated.View
                            style={[
                                styles.logoContainer,
                                {
                                    transform: [{ translateY: floatAnim }],
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
                        <Text style={styles.logoText}>QScrap</Text>
                        <View style={styles.taglineContainer}>
                            <View style={styles.goldLine} />
                            <Text style={styles.tagline}>Qatar's Premier Auto Parts</Text>
                            <View style={styles.goldLine} />
                        </View>
                        <Text style={styles.taglineSubtext}>Used • Commercial • Genuine OEM</Text>
                    </Animated.View>

                    {/* Form Card with Gold Accent */}
                    <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
                        {/* Gold Top Accent */}
                        <LinearGradient
                            colors={['#D4AF37', '#F5D67B', '#D4AF37']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.goldTopAccent}
                        />
                        <Text style={[styles.welcomeText, { color: colors.text }]}>Welcome Back</Text>
                        <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>Sign in to continue</Text>

                        {error ? (
                            <View style={[styles.errorContainer, { backgroundColor: colors.error + '15', borderColor: colors.error }]}>
                                <Text style={styles.errorIcon}>⚠️</Text>
                                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                            </View>
                        ) : null}

                        <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>📱 Phone Number</Text>
                            <TextInput
                                style={[styles.input, {
                                    backgroundColor: colors.surfaceSecondary,
                                    color: colors.text,
                                    borderColor: colors.border
                                }]}
                                placeholder="+974 XXXX XXXX"
                                placeholderTextColor={colors.textMuted}
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>🔒 Password</Text>
                            <TextInput
                                style={[styles.input, {
                                    backgroundColor: colors.surfaceSecondary,
                                    color: colors.text,
                                    borderColor: colors.border
                                }]}
                                placeholder="Enter your password"
                                placeholderTextColor={colors.textMuted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <TouchableOpacity style={styles.forgotPassword}>
                            <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>Forgot Password?</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                            onPress={handleLogin}
                            disabled={isLoading}
                            activeOpacity={0.9}
                        >
                            <LinearGradient
                                colors={ThemeColors.gradients.primary}
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
                    </View>

                    {/* Register Section */}
                    <View style={styles.registerSection}>
                        <Text style={styles.registerText}>Don't have an account?</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                            <Text style={styles.registerLink}>Create Account</Text>
                        </TouchableOpacity>
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
        marginBottom: Spacing.xl,
    },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 24,
        marginBottom: Spacing.md,
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
    logoText: {
        fontSize: 42,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: 1,
        textShadowColor: 'rgba(138, 21, 56, 0.6)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 10,
    },
    tagline: {
        fontSize: FontSizes.md,
        color: 'rgba(255, 255, 255, 0.9)',
        fontWeight: '600',
        marginHorizontal: Spacing.sm,
    },
    taglineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    taglineSubtext: {
        fontSize: FontSizes.sm,
        color: 'rgba(212, 175, 55, 0.9)',
        marginTop: Spacing.xs,
        fontWeight: '500',
    },
    goldLine: {
        width: 30,
        height: 2,
        backgroundColor: '#D4AF37',
        borderRadius: 1,
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
    goldTopAccent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
    },
    formCard: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        paddingTop: Spacing.xl + 4,
        overflow: 'hidden',
        ...Shadows.lg,
    },
    welcomeText: {
        fontSize: FontSizes.xxl,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    subtitleText: {
        fontSize: FontSizes.md,
        textAlign: 'center',
        marginBottom: Spacing.lg,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
    },
    errorIcon: {
        fontSize: 16,
        marginRight: Spacing.sm,
    },
    errorText: {
        fontSize: FontSizes.sm,
        flex: 1,
    },
    inputContainer: {
        marginBottom: Spacing.md,
    },
    inputLabel: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        marginBottom: Spacing.xs,
    },
    input: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        fontSize: FontSizes.lg,
        borderWidth: 1.5,
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: Spacing.md,
    },
    forgotPasswordText: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
    },
    loginButton: {
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.md,
    },
    loginButtonDisabled: {
        opacity: 0.7,
    },
    loginButtonGradient: {
        paddingVertical: Spacing.md + 4,
        alignItems: 'center',
    },
    loginButtonText: {
        fontSize: FontSizes.lg,
        fontWeight: '800',
        color: '#fff',
    },
    registerSection: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Spacing.xl,
    },
    registerText: {
        fontSize: FontSizes.md,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    registerLink: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: '#fff',
        marginLeft: Spacing.xs,
    },
    footer: {
        marginTop: Spacing.xl,
        alignItems: 'center',
    },
    footerText: {
        fontSize: FontSizes.xs,
        color: 'rgba(255, 255, 255, 0.6)',
        textAlign: 'center',
        lineHeight: 18,
    },
    footerLink: {
        color: '#fff',
        fontWeight: '600',
    },
});
