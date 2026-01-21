// QScrap Edit Profile Screen - Full Profile Management
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { api } from '../services/api';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

export default function EditProfileScreen() {
    const navigation = useNavigation();
    const { user, refreshUser } = useAuth();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();

    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        setIsLoading(true);
        try {
            const data = await api.getProfile();
            if (data.profile) {
                setFullName(data.profile.full_name || '');
                setPhoneNumber(data.profile.phone_number || '');
                setEmail(data.profile.email || '');
            }
        } catch (error) {
            console.log('Failed to load profile:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveProfile = async () => {
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
                throw new Error(data.error || data.message || 'Failed to update profile');
            }
        } catch (error: any) {
            const errorMessage = typeof error === 'string'
                ? error
                : error?.message || 'Failed to update profile';
            Alert.alert('Error', errorMessage);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePhoto = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert(
            t('profile.changePhoto'),
            t('profile.chooseOption'),
            [
                {
                    text: `📷 ${t('profile.takePhoto')}`,
                    onPress: async () => {
                        const { status } = await ImagePicker.requestCameraPermissionsAsync();
                        if (status !== 'granted') {
                            Alert.alert(t('common.permissionRequired'), t('profile.cameraAccessNeeded'));
                            return;
                        }
                        const result = await ImagePicker.launchCameraAsync({
                            mediaTypes: ['images'],
                            allowsEditing: true,
                            aspect: [1, 1],
                            quality: 0.8,
                        });
                        if (!result.canceled && result.assets[0]) {
                            setAvatarUri(result.assets[0].uri);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }
                    },
                },
                {
                    text: `🖼️ ${t('profile.chooseFromGallery')}`,
                    onPress: async () => {
                        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        if (status !== 'granted') {
                            Alert.alert(t('common.permissionRequired'), t('profile.galleryAccessNeeded'));
                            return;
                        }
                        const result = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ['images'],
                            allowsEditing: true,
                            aspect: [1, 1],
                            quality: 0.8,
                        });
                        if (!result.canceled && result.assets[0]) {
                            setAvatarUri(result.assets[0].uri);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }
                    },
                },
                { text: t('common.cancel'), style: 'cancel' },
            ]
        );
    };

    const handleChangePassword = async () => {
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
                throw new Error(data.error || 'Failed to change password');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to change password');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 100 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.background }]}>
                    <Text style={styles.backText}>{isRTL ? '→' : '←'} {t('common.back')}</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('profile.editProfile')}</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Profile Avatar */}
                <View style={styles.avatarSection}>
                    <View style={styles.avatar}>
                        {avatarUri ? (
                            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                        ) : (
                            <Text style={styles.avatarText}>
                                {fullName.charAt(0).toUpperCase() || '👤'}
                            </Text>
                        )}
                    </View>
                    <TouchableOpacity style={styles.changePhotoButton} onPress={handleChangePhoto}>
                        <Text style={styles.changePhotoText}>📷 {t('profile.changePhoto')}</Text>
                    </TouchableOpacity>
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
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                        onPress={handleSaveProfile}
                        disabled={isSaving}
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

                {/* Danger Zone */}
                <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: Colors.error, textAlign: rtlTextAlign(isRTL) }]}>{t('profile.dangerZone')}</Text>

                    <TouchableOpacity style={styles.deleteAccountButton}>
                        <Text style={styles.deleteAccountText}>{t('profile.deleteAccount')}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.deleteHint, { textAlign: rtlTextAlign(isRTL) }]}>
                        {t('profile.deleteAccountWarning')}
                    </Text>
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
