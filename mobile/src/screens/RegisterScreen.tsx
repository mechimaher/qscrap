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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useTheme } from '../contexts';
import { Spacing, BorderRadius, FontSize, Shadows } from '../constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type RegisterScreenProps = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Register'>;
};

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
    const { colors } = useTheme();
    const { register } = useAuth();
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRegister = async () => {
        setError('');

        if (!fullName || !phone || !password) {
            setError('Please fill all fields');
            return;
        }

        // Phone validation (Qatar numbers start with 3, 5, 6, 7 and are 8 digits)
        const phoneRegex = /^[3567]\d{7}$/;
        // Allow +974 prefix or just 8 digits
        const cleanPhone = phone.replace('+974', '').replace(/\s/g, '');

        if (!phoneRegex.test(cleanPhone)) {
            setError('Please enter a valid Qatar phone number (8 digits starting with 3, 5, 6, or 7)');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            await register(fullName, phone, password);
        } catch (error: any) {
            setError(error.message || 'Registration failed');
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
                        <Text style={[styles.appName, { color: colors.text }]}>Join QScrap</Text>
                        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
                            Find auto parts faster
                        </Text>
                    </View>

                    {/* Form */}
                    <View style={[styles.form, { backgroundColor: colors.surface }, Shadows.lg]}>

                        {/* Error Message */}
                        {error ? (
                            <View style={[styles.errorContainer, { backgroundColor: colors.error + '15', borderColor: colors.error }]}>
                                <Ionicons name="alert-circle" size={20} color={colors.error} />
                                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                            </View>
                        ) : null}

                        {/* Full Name */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name</Text>
                            <View style={[styles.inputContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                                <Ionicons name="person-outline" size={20} color={colors.textMuted} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="Your full name"
                                    placeholderTextColor={colors.textMuted}
                                    value={fullName}
                                    onChangeText={setFullName}
                                />
                            </View>
                        </View>

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
                                />
                            </View>
                        </View>

                        {/* Password */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
                            <View style={[styles.inputContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="Min 6 characters"
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

                        {/* Register Button */}
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.primary }]}
                            onPress={handleRegister}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>Create Account</Text>
                            )}
                        </TouchableOpacity>

                        {/* Login Link */}
                        <View style={styles.loginLink}>
                            <Text style={[styles.loginText, { color: colors.textSecondary }]}>
                                Already have an account?
                            </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                                <Text style={[styles.loginLinkText, { color: colors.primary }]}>
                                    {' '}Sign In
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
    container: { flex: 1 },
    keyboardView: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
    header: { alignItems: 'center', marginBottom: Spacing.xxxl },
    logoContainer: {
        width: 80, height: 80, borderRadius: BorderRadius.xl,
        alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg,
    },
    appName: { fontSize: 28, fontWeight: '700' },
    tagline: { fontSize: FontSize.md, marginTop: Spacing.xs },
    form: { borderRadius: BorderRadius.xl, padding: Spacing.xxl },
    errorContainer: {
        flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
        borderRadius: BorderRadius.md, marginBottom: Spacing.lg, borderWidth: 1, gap: Spacing.sm
    },
    errorText: { fontSize: FontSize.sm, flex: 1 },
    inputGroup: { marginBottom: Spacing.lg },
    label: { fontSize: FontSize.sm, fontWeight: '600', marginBottom: Spacing.sm },
    inputContainer: {
        flexDirection: 'row', alignItems: 'center', borderWidth: 1,
        borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg, height: 52, gap: Spacing.md,
    },
    input: { flex: 1, fontSize: FontSize.md },
    button: {
        height: 52, borderRadius: BorderRadius.md,
        alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg,
    },
    buttonText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '600' },
    loginLink: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xxl },
    loginText: { fontSize: FontSize.md },
    loginLinkText: { fontSize: FontSize.md, fontWeight: '600' },
});

export default RegisterScreen;
