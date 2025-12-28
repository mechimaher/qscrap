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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useTheme } from '../contexts';
import { Spacing, BorderRadius, FontSize, Shadows } from '../constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type LoginScreenProps = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
    const { colors } = useTheme();
    const { login } = useAuth();
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!phone || !password) {
            Alert.alert('Error', 'Please enter phone and password');
            return;
        }

        setLoading(true);
        try {
            await login(phone, password);
        } catch (error: any) {
            Alert.alert('Login Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={[styles.logoContainer, { backgroundColor: colors.primary }]}>
                            <Ionicons name="car-sport" size={40} color="#fff" />
                        </View>
                        <Text style={[styles.appName, { color: colors.text }]}>QScrap</Text>
                        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
                            Find Auto Parts in Qatar
                        </Text>
                    </View>

                    {/* Form */}
                    <View style={[styles.form, { backgroundColor: colors.surface }, Shadows.lg]}>
                        <Text style={[styles.formTitle, { color: colors.text }]}>Welcome Back</Text>
                        <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>
                            Sign in to continue
                        </Text>

                        {/* Phone Input */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Phone Number</Text>
                            <View style={[styles.inputContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                                <Ionicons name="call-outline" size={20} color={colors.textMuted} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="+974 5XXX XXXX"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="phone-pad"
                                    value={phone}
                                    onChangeText={setPhone}
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        {/* Password Input */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
                            <View style={[styles.inputContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="Enter password"
                                    placeholderTextColor={colors.textMuted}
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    <Ionicons
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={20}
                                        color={colors.textMuted}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Login Button */}
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.primary }]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>Sign In</Text>
                            )}
                        </TouchableOpacity>

                        {/* Register Link */}
                        <View style={styles.registerLink}>
                            <Text style={[styles.registerText, { color: colors.textSecondary }]}>
                                Don't have an account?
                            </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                                <Text style={[styles.registerLinkText, { color: colors.primary }]}>
                                    {' '}Register
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Legal Links */}
                    <View style={styles.legalLinks}>
                        <Text style={[styles.legalText, { color: colors.textMuted }]}>
                            By signing in, you agree to our
                        </Text>
                        <View style={styles.legalLinkRow}>
                            <TouchableOpacity onPress={() => navigation.navigate('Terms')}>
                                <Text style={[styles.legalLinkText, { color: colors.primary }]}>
                                    Terms of Service
                                </Text>
                            </TouchableOpacity>
                            <Text style={[styles.legalText, { color: colors.textMuted }]}> and </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
                                <Text style={[styles.legalLinkText, { color: colors.primary }]}>
                                    Privacy Policy
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

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
        padding: Spacing.xl,
    },
    header: {
        alignItems: 'center',
        marginBottom: Spacing.xxxl,
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: BorderRadius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
    },
    appName: {
        fontSize: 32,
        fontWeight: '700',
        letterSpacing: 1,
    },
    tagline: {
        fontSize: FontSize.md,
        marginTop: Spacing.xs,
    },
    form: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.xxl,
    },
    formTitle: {
        fontSize: FontSize.xxl,
        fontWeight: '700',
        marginBottom: Spacing.xs,
    },
    formSubtitle: {
        fontSize: FontSize.md,
        marginBottom: Spacing.xxl,
    },
    inputGroup: {
        marginBottom: Spacing.lg,
    },
    label: {
        fontSize: FontSize.sm,
        fontWeight: '600',
        marginBottom: Spacing.sm,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.lg,
        height: 52,
        gap: Spacing.md,
    },
    input: {
        flex: 1,
        fontSize: FontSize.md,
    },
    button: {
        height: 52,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Spacing.lg,
    },
    buttonText: {
        color: '#fff',
        fontSize: FontSize.lg,
        fontWeight: '600',
    },
    registerLink: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: Spacing.xxl,
    },
    registerText: {
        fontSize: FontSize.md,
    },
    registerLinkText: {
        fontSize: FontSize.md,
        fontWeight: '600',
    },
    legalLinks: {
        alignItems: 'center',
        marginTop: Spacing.xxl,
        paddingHorizontal: Spacing.lg,
    },
    legalText: {
        fontSize: FontSize.sm,
        textAlign: 'center',
    },
    legalLinkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.xs,
    },
    legalLinkText: {
        fontSize: FontSize.sm,
        fontWeight: '600',
    },
});

export default LoginScreen;
