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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

export default function EditProfileScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();

    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
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
            Alert.alert('Error', 'Please enter your full name');
            return;
        }

        setIsSaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            const token = await api.getToken();
            const response = await fetch(`http://192.168.1.59:3000/api/customers/profile`, {
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

            if (response.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Success', 'Profile updated successfully');
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update profile');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all password fields');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'New passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        setIsSaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            const token = await api.getToken();
            const response = await fetch(`http://192.168.1.59:3000/api/auth/change-password`, {
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
                Alert.alert('Success', 'Password changed successfully');
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
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Profile Avatar */}
                <View style={styles.avatarSection}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {fullName.charAt(0).toUpperCase() || '👤'}
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.changePhotoButton}>
                        <Text style={styles.changePhotoText}>Change Photo</Text>
                    </TouchableOpacity>
                </View>

                {/* Personal Info Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Full Name</Text>
                        <TextInput
                            style={styles.input}
                            value={fullName}
                            onChangeText={setFullName}
                            placeholder="Enter your full name"
                            placeholderTextColor={Colors.dark.textMuted}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Phone Number</Text>
                        <TextInput
                            style={[styles.input, styles.inputDisabled]}
                            value={phoneNumber}
                            editable={false}
                            placeholder="Phone number"
                            placeholderTextColor={Colors.dark.textMuted}
                        />
                        <Text style={styles.inputHint}>Contact support to change phone number</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Enter your email"
                            placeholderTextColor={Colors.dark.textMuted}
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
                                <Text style={styles.saveText}>Save Changes</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Change Password Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Change Password</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Current Password</Text>
                        <TextInput
                            style={styles.input}
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            placeholder="Enter current password"
                            placeholderTextColor={Colors.dark.textMuted}
                            secureTextEntry
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>New Password</Text>
                        <TextInput
                            style={styles.input}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder="Enter new password"
                            placeholderTextColor={Colors.dark.textMuted}
                            secureTextEntry
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Confirm New Password</Text>
                        <TextInput
                            style={styles.input}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Confirm new password"
                            placeholderTextColor={Colors.dark.textMuted}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.changePasswordButton}
                        onPress={handleChangePassword}
                        disabled={isSaving}
                    >
                        <Text style={styles.changePasswordText}>Update Password</Text>
                    </TouchableOpacity>
                </View>

                {/* Danger Zone */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: Colors.error }]}>Danger Zone</Text>

                    <TouchableOpacity style={styles.deleteAccountButton}>
                        <Text style={styles.deleteAccountText}>Delete Account</Text>
                    </TouchableOpacity>
                    <Text style={styles.deleteHint}>
                        This will permanently delete your account and all associated data.
                    </Text>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.dark.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
    },
    backButton: { padding: Spacing.sm },
    backText: { color: Colors.primary, fontSize: FontSizes.lg, fontWeight: '600' },
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.dark.text },
    scrollView: { flex: 1, padding: Spacing.lg },
    avatarSection: { alignItems: 'center', marginBottom: Spacing.xl },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.primary + '30',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: Colors.primary,
    },
    avatarText: { fontSize: 40, color: Colors.primary },
    changePhotoButton: { marginTop: Spacing.md },
    changePhotoText: { color: Colors.primary, fontSize: FontSizes.md, fontWeight: '600' },
    section: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.dark.text,
        marginBottom: Spacing.lg,
    },
    inputGroup: { marginBottom: Spacing.md },
    label: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.xs,
    },
    input: {
        backgroundColor: Colors.dark.background,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: FontSizes.md,
        color: Colors.dark.text,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    inputDisabled: {
        opacity: 0.6,
    },
    inputHint: {
        fontSize: FontSizes.xs,
        color: Colors.dark.textMuted,
        marginTop: Spacing.xs,
    },
    saveButton: {
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
        marginTop: Spacing.md,
    },
    saveButtonDisabled: { opacity: 0.7 },
    saveGradient: { paddingVertical: Spacing.md, alignItems: 'center' },
    saveText: { fontSize: FontSizes.md, fontWeight: '700', color: '#fff' },
    changePasswordButton: {
        backgroundColor: Colors.dark.background,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.primary,
        marginTop: Spacing.md,
    },
    changePasswordText: { color: Colors.primary, fontSize: FontSizes.md, fontWeight: '600' },
    deleteAccountButton: {
        backgroundColor: Colors.error + '20',
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.error,
    },
    deleteAccountText: { color: Colors.error, fontSize: FontSizes.md, fontWeight: '600' },
    deleteHint: {
        fontSize: FontSizes.xs,
        color: Colors.dark.textMuted,
        marginTop: Spacing.sm,
        textAlign: 'center',
    },
});
