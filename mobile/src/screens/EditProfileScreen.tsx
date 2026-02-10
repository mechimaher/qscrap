import { log, warn, error as logError } from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';
import { SkeletonCard } from '../components/SkeletonLoader';
// QScrap Edit Profile Screen - Full Profile Management
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
// ImagePicker removed - avatar upload not yet implemented on backend
import { useNavigation } from '@react-navigation/native';
import { api } from '../services/api';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';
import { useToast } from '../components/Toast';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

export default function EditProfileScreen() {
    const navigation = useNavigation();
    const { user, refreshUser } = useAuth();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const toast = useToast();

    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    // avatarUri removed - avatar upload not yet implemented on backend
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getProfile();
            // Backend returns { user: {...}, stats: {...}, addresses: [...] }
            // Check both 'user' (new format) and 'profile' (legacy fallback)
            const profileData = data.user || data.profile;
            if (profileData) {
                setFullName(profileData.full_name || '');
                setPhoneNumber(profileData.phone_number || '');
                setEmail(profileData.email || '');
            }
        } catch (error) {
            log('Failed to load profile:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleSaveProfile = useCallback(async () => {
        if (!fullName.trim()) {
            Alert.alert(t('common.error'), t('profile.enterFullName'));
            return;
        }

        setIsSaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            const token = await api.getToken();
            // Use correct endpoint: /api/dashboard/profile
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.UPDATE_PROFILE}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    full_name: fullName.trim(),
                    email: email.trim() || null,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // Refresh user data in AuthContext so ProfileScreen shows updated name
                await refreshUser();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(t('common.success'), t('profile.profileUpdated'), [
                    { text: t('common.ok'), onPress: () => navigation.goBack() }
                ]);
            } else {
                throw new Error(data.error || data.message || t('profile.updateFailed'));
            }
        } catch (error: any) {
            handleApiError(error, toast, { useAlert: true });
        } finally {
            setIsSaving(false);
        }
    }, [fullName, email, toast, t, navigation, refreshUser]);

    // handleChangePhoto removed - avatar upload not yet implemented on backend

    const handleChangePassword = useCallback(async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert(t('common.error'), t('profile.fillAllPasswordFields'));
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert(t('common.error'), t('profile.passwordsDontMatch'));
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert(t('common.error'), t('profile.passwordMinLength'));
            return;
        }

        setIsSaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            const token = await api.getToken();
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CHANGE_PASSWORD}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                }),
            });

            if (response.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(t('common.success'), t('profile.passwordChanged'));
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                const data = await response.json();
                throw new Error(data.error || t('profile.passwordChangeFailed'));
            }
        } catch (error: any) {
            handleApiError(error, toast, { useAlert: true });
        } finally {
            setIsSaving(false);
        }
    }, [currentPassword, newPassword, confirmPassword, toast, t]);

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={{ padding: 16 }}>
                    <SkeletonCard style={{ marginBottom: 16 }} />
                    <SkeletonCard style={{ marginBottom: 16 }} />
                    <SkeletonCard />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.background }]} accessibilityRole="button" accessibilityLabel={t('common.back')}>
                    <Text style={styles.backText}>{isRTL ? '→' : '←'} {t('common.back')}</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('profile.editProfile')}</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Simple Avatar - Display Only */}
                <View style={styles.avatarSection}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {fullName.charAt(0).toUpperCase() || '👤'}
                        </Text>
                    </View>
                </View>

                {/* Personal Info Section */}
                <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{t('profile.personalInfo')}</Text>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { textAlign: rtlTextAlign(isRTL) }]}>{t('profile.fullName')}</Text>
                        <TextInput
                            style={[styles.input, { textAlign: rtlTextAlign(isRTL) }]}
                            value={fullName}
                            onChangeText={setFullName}
                            placeholder={t('profile.enterFullName')}
                            placeholderTextColor="#999"
                            accessibilityLabel={t('profile.fullName')}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { textAlign: rtlTextAlign(isRTL) }]}>{t('profile.phoneNumber')}</Text>
                        <TextInput
                            style={[styles.input, styles.inputDisabled, { textAlign: rtlTextAlign(isRTL) }]}
                            value={phoneNumber}
                            editable={false}
                            placeholder={t('profile.phoneNumber')}
                            placeholderTextColor="#999"
                            accessibilityLabel={t('profile.phoneNumber')}
                            accessibilityState={{ disabled: true }}
                        />
                        <Text style={[styles.inputHint, { textAlign: rtlTextAlign(isRTL) }]}>{t('profile.contactSupport')}</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { textAlign: rtlTextAlign(isRTL) }]}>{t('profile.emailOptional')}</Text>
                        <TextInput
                            style={[styles.input, { textAlign: rtlTextAlign(isRTL) }]}
                            value={email}
                            onChangeText={setEmail}
                            placeholder={t('profile.enterEmail')}
                            placeholderTextColor="#999"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            accessibilityLabel={t('profile.emailOptional')}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                        onPress={handleSaveProfile}
                        disabled={isSaving}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.saveChanges')}
                        accessibilityState={{ disabled: isSaving }}
                    >
                        <LinearGradient
                            colors={['#22c55e', '#16a34a'] as const}
                            style={styles.saveGradient}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.saveText}>{t('common.saveChanges')}</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Change Password Section */}
                <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{t('profile.changePassword')}</Text>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { textAlign: rtlTextAlign(isRTL) }]}>{t('profile.currentPassword')}</Text>
                        <TextInput
                            style={[styles.input, { textAlign: rtlTextAlign(isRTL) }]}
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            placeholder={t('profile.enterCurrentPassword')}
                            placeholderTextColor="#999"
                            secureTextEntry
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { textAlign: rtlTextAlign(isRTL) }]}>{t('profile.newPassword')}</Text>
                        <TextInput
                            style={[styles.input, { textAlign: rtlTextAlign(isRTL) }]}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder={t('profile.enterNewPassword')}
                            placeholderTextColor="#999"
                            secureTextEntry
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { textAlign: rtlTextAlign(isRTL) }]}>{t('profile.confirmNewPassword')}</Text>
                        <TextInput
                            style={[styles.input, { textAlign: rtlTextAlign(isRTL) }]}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder={t('profile.confirmNewPassword')}
                            placeholderTextColor="#999"
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.changePasswordButton}
                        onPress={handleChangePassword}
                        disabled={isSaving}
                    >
                        <Text style={styles.changePasswordText}>{t('profile.updatePassword')}</Text>
                    </TouchableOpacity>
                </View>


                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAFAFA' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backButton: {
        padding: Spacing.sm,
        backgroundColor: '#F5F5F5',
        borderRadius: BorderRadius.md,
    },
    backText: { color: Colors.primary, fontSize: FontSizes.md, fontWeight: '600' },
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: '#1a1a1a' },
    scrollView: { flex: 1, padding: Spacing.lg },
    avatarSection: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
        backgroundColor: '#fff',
        padding: Spacing.xl,
        borderRadius: BorderRadius.xl,
        ...Shadows.sm,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: Colors.primary,
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 50,
    },
    avatarText: { fontSize: 40, color: Colors.primary },
    changePhotoButton: {
        marginTop: Spacing.md,
        backgroundColor: Colors.primary + '10',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
    },
    changePhotoText: { color: Colors.primary, fontSize: FontSizes.md, fontWeight: '600' },
    section: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        ...Shadows.sm,
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: Spacing.lg,
    },
    inputGroup: { marginBottom: Spacing.md },
    label: {
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
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    inputDisabled: {
        opacity: 0.6,
        backgroundColor: '#F0F0F0',
    },
    inputHint: {
        fontSize: FontSizes.xs,
        color: '#737373',
        marginTop: Spacing.xs,
    },
    saveButton: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        marginTop: Spacing.md,
        ...Shadows.sm,
    },
    saveButtonDisabled: { opacity: 0.7 },
    saveGradient: { paddingVertical: Spacing.md, alignItems: 'center' },
    saveText: { fontSize: FontSizes.md, fontWeight: '700', color: '#fff' },
    changePasswordButton: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.primary,
        marginTop: Spacing.md,
    },
    changePasswordText: { color: Colors.primary, fontSize: FontSizes.md, fontWeight: '600' },
    deleteAccountButton: {
        backgroundColor: Colors.error + '10',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.error,
    },
    deleteAccountText: { color: Colors.error, fontSize: FontSizes.md, fontWeight: '600' },
    deleteHint: {
        fontSize: FontSizes.xs,
        color: '#737373',
        marginTop: Spacing.sm,
        textAlign: 'center',
    },
});
