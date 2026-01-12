// QScrap Driver App - Part Inspection Screen
// Premium pre-pickup part verification flow
// VVIP QScrap-specific quality control feature

import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/theme';
import { api } from '../services/api';
import { offlineQueue } from '../services/OfflineQueue';
import { API_ENDPOINTS } from '../config/api';

interface ChecklistItem {
    id: string;
    label: string;
    description: string;
    checked: boolean;
    required: boolean;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
    {
        id: 'matches_description',
        label: 'Part Matches Description',
        description: 'The part matches the order description',
        checked: false,
        required: true,
    },
    {
        id: 'no_visible_damage',
        label: 'No Visible Damage',
        description: 'Part has no cracks, dents, or scratches',
        checked: false,
        required: true,
    },
    {
        id: 'properly_packaged',
        label: 'Properly Packaged',
        description: 'Part is securely packaged for transport',
        checked: false,
        required: true,
    },
    {
        id: 'correct_quantity',
        label: 'Correct Quantity',
        description: 'All items in the order are present',
        checked: false,
        required: true,
    },
];

export default function PartInspectionScreen() {
    const { colors } = useTheme();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { assignmentId, orderId, orderNumber, partDescription } = route.params || {};

    const [permission, requestPermission] = useCameraPermissions();
    const [showCamera, setShowCamera] = useState(false);
    const [photos, setPhotos] = useState<string[]>([]);
    const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const cameraRef = useRef<any>(null);

    // Check if inspection is complete
    const requiredItemsChecked = checklist.filter(item => item.required).every(item => item.checked);
    const hasPhoto = photos.length > 0;
    const canProceed = requiredItemsChecked && hasPhoto;

    const handleTakePhoto = async () => {
        if (!cameraRef.current) return;

        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.7,
                base64: true,
            });

            setPhotos(prev => [...prev, photo.uri]);
            setShowCamera(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('Failed to take photo:', error);
            Alert.alert('Error', 'Failed to take photo');
        }
    };

    const handleToggleItem = (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setChecklist(prev =>
            prev.map(item =>
                item.id === id ? { ...item, checked: !item.checked } : item
            )
        );
    };

    const handleRemovePhoto = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleProceed = async () => {
        if (!canProceed) {
            Alert.alert('Incomplete', 'Please complete all required checks and take at least one photo.');
            return;
        }

        setIsSubmitting(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        try {
            // Upload photos and inspection data
            // Upload photos and inspection data
            // VVIP: Use Offline Queue for guaranteed sync
            // 1. Optimistic Update
            const { useJobStore } = require('../stores/useJobStore');
            useJobStore.getState().updateAssignmentStatus(assignmentId, 'picked_up');

            // 2. Direct API Call (Removed OfflineQueue for simplicity/reliability)
            await api.updateAssignmentStatus(assignmentId, 'picked_up', `Inspection complete. ${photos.length} photo(s) taken. All checks passed.`);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                '✅ Inspection Complete',
                'Part verified. Proceeding to delivery.',
                [
                    {
                        text: 'Start Delivery',
                        onPress: () => {
                            // Go back to detail screen which will now show "Start Delivery" or "In Transit"
                            // triggering the next step in the flow smoothly
                            navigation.goBack();
                        },
                    },
                ]
            );
        } catch (error: any) {
            console.error('Inspection submit error:', error);
            Alert.alert('Error', error.message || 'Failed to submit inspection');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReportIssue = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Alert.alert(
            '⚠️ Report Issue',
            'What issue did you find with the part?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Wrong Part',
                    onPress: () => reportIssue('wrong_part'),
                },
                {
                    text: 'Damaged',
                    onPress: () => reportIssue('damaged'),
                },
                {
                    text: 'Missing Items',
                    onPress: () => reportIssue('missing_items'),
                },
            ]
        );
    };

    const reportIssue = async (issueType: string) => {
        try {
            await api.updateAssignmentStatus(assignmentId, 'failed', {
                failure_reason: `Inspection failed: ${issueType}`,
            });

            Alert.alert(
                'Issue Reported',
                'Operations has been notified. Please wait for further instructions.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to report issue');
        }
    };

    // Camera permission request
    if (!permission?.granted) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.permissionContainer}>
                    <Text style={styles.permissionIcon}>📷</Text>
                    <Text style={[styles.permissionTitle, { color: colors.text }]}>
                        Camera Permission Required
                    </Text>
                    <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
                        We need camera access to take photos of the part for quality verification.
                    </Text>
                    <TouchableOpacity
                        style={styles.permissionButton}
                        onPress={requestPermission}
                    >
                        <LinearGradient
                            colors={[Colors.primary, Colors.primaryDark]}
                            style={styles.permissionGradient}
                        >
                            <Text style={styles.permissionButtonText}>Grant Permission</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // Camera view
    if (showCamera) {
        return (
            <View style={styles.cameraContainer}>
                <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    facing="back"
                >
                    {/* Camera overlay */}
                    <View style={styles.cameraOverlay}>
                        <View style={styles.cameraGuide}>
                            <View style={[styles.corner, styles.cornerTL]} />
                            <View style={[styles.corner, styles.cornerTR]} />
                            <View style={[styles.corner, styles.cornerBL]} />
                            <View style={[styles.corner, styles.cornerBR]} />
                        </View>
                        <Text style={styles.cameraHint}>
                            Position part in frame
                        </Text>
                    </View>

                    {/* Camera controls */}
                    <View style={styles.cameraControls}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => setShowCamera(false)}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.captureButton}
                            onPress={handleTakePhoto}
                        >
                            <View style={styles.captureButtonInner} />
                        </TouchableOpacity>

                        <View style={{ width: 60 }} />
                    </View>
                </CameraView>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={[styles.backButton, { color: Colors.primary }]}>← Back</Text>
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]}>Part Inspection</Text>
                <View style={{ width: 50 }} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {/* Order Info */}
                <View style={[styles.orderCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.orderNumber, { color: Colors.primary }]}>
                        Order #{orderNumber || '---'}
                    </Text>
                    <Text style={[styles.partDesc, { color: colors.text }]} numberOfLines={2}>
                        {partDescription || 'Auto Part'}
                    </Text>
                </View>

                {/* Photo Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        📸 Part Photos {photos.length > 0 ? `(${photos.length})` : ''}
                    </Text>

                    <View style={styles.photoGrid}>
                        {photos.map((uri, index) => (
                            <View key={index} style={styles.photoContainer}>
                                <Image source={{ uri }} style={styles.photo} />
                                <TouchableOpacity
                                    style={styles.removePhoto}
                                    onPress={() => handleRemovePhoto(index)}
                                >
                                    <Text style={styles.removePhotoText}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        ))}

                        <TouchableOpacity
                            style={[styles.addPhoto, { backgroundColor: colors.surface }]}
                            onPress={() => setShowCamera(true)}
                        >
                            <Text style={styles.addPhotoIcon}>📷</Text>
                            <Text style={[styles.addPhotoText, { color: colors.textSecondary }]}>
                                Add Photo
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Checklist Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        ✅ Verification Checklist
                    </Text>

                    {checklist.map(item => (
                        <TouchableOpacity
                            key={item.id}
                            style={[styles.checklistItem, { backgroundColor: colors.surface }]}
                            onPress={() => handleToggleItem(item.id)}
                        >
                            <View style={[
                                styles.checkbox,
                                item.checked && styles.checkboxChecked,
                            ]}>
                                {item.checked && <Text style={styles.checkmark}>✓</Text>}
                            </View>
                            <View style={styles.checklistInfo}>
                                <Text style={[
                                    styles.checklistLabel,
                                    { color: colors.text },
                                    item.checked && styles.checklistLabelChecked,
                                ]}>
                                    {item.label} {item.required && <Text style={{ color: Colors.danger }}>*</Text>}
                                </Text>
                                <Text style={[styles.checklistDesc, { color: colors.textMuted }]}>
                                    {item.description}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={[styles.actions, { backgroundColor: colors.background }]}>
                <TouchableOpacity
                    style={[styles.issueButton, { backgroundColor: Colors.danger + '15', borderWidth: 1, borderColor: Colors.danger + '30' }]}
                    onPress={handleReportIssue}
                >
                    <Text style={[styles.issueButtonText, { color: Colors.danger }]}>
                        ⚠️ Report Issue
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.proceedButton,
                        !canProceed && styles.proceedButtonDisabled,
                    ]}
                    onPress={handleProceed}
                    disabled={!canProceed || isSubmitting}
                >
                    <LinearGradient
                        colors={canProceed ? Colors.gradients.primary : ['#9ca3af', '#6b7280']}
                        style={styles.proceedGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.proceedButtonText}>
                                {canProceed ? '✓ Confirm & Proceed' : 'Complete Checklist'}
                            </Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backButton: {
        fontSize: 16,
        fontWeight: '600',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 20,
    },
    orderCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 24,
    },
    orderNumber: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
    },
    partDesc: {
        fontSize: 16,
        fontWeight: '600',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 12,
    },
    photoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    photoContainer: {
        position: 'relative',
    },
    photo: {
        width: 100,
        height: 100,
        borderRadius: 12,
    },
    removePhoto: {
        position: 'absolute',
        top: -8,
        right: -8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.danger,
        justifyContent: 'center',
        alignItems: 'center',
    },
    removePhotoText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    addPhoto: {
        width: 100,
        height: 100,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.primary,
        borderStyle: 'dashed',
    },
    addPhotoIcon: {
        fontSize: 28,
        marginBottom: 4,
    },
    addPhotoText: {
        fontSize: 12,
    },
    checklistItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
        gap: 12,
    },
    checkbox: {
        width: 28,
        height: 28,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: Colors.success,
        borderColor: Colors.success,
    },
    checkmark: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    checklistInfo: {
        flex: 1,
    },
    checklistLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    checklistLabelChecked: {
        textDecorationLine: 'line-through',
        opacity: 0.7,
    },
    checklistDesc: {
        fontSize: 12,
        marginTop: 2,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        paddingBottom: 32,
    },
    issueButton: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    issueButtonText: {
        fontSize: 14,
        fontWeight: '700',
    },
    proceedButton: {
        flex: 2,
        borderRadius: 16,
        overflow: 'hidden',
    },
    proceedButtonDisabled: {
        opacity: 0.7,
    },
    proceedGradient: {
        padding: 16,
        alignItems: 'center',
    },
    proceedButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    // Permission screen
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    permissionIcon: {
        fontSize: 64,
        marginBottom: 20,
    },
    permissionTitle: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 12,
        textAlign: 'center',
    },
    permissionText: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
    },
    permissionButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    permissionGradient: {
        paddingHorizontal: 32,
        paddingVertical: 16,
    },
    permissionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    // Camera screen
    cameraContainer: {
        flex: 1,
    },
    camera: {
        flex: 1,
    },
    cameraOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraGuide: {
        width: 280,
        height: 280,
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderColor: '#fff',
    },
    cornerTL: {
        top: 0,
        left: 0,
        borderTopWidth: 3,
        borderLeftWidth: 3,
    },
    cornerTR: {
        top: 0,
        right: 0,
        borderTopWidth: 3,
        borderRightWidth: 3,
    },
    cornerBL: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 3,
        borderLeftWidth: 3,
    },
    cornerBR: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 3,
        borderRightWidth: 3,
    },
    cameraHint: {
        color: '#fff',
        fontSize: 14,
        marginTop: 20,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    cameraControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 40,
        paddingBottom: 60,
    },
    cancelButton: {
        padding: 10,
    },
    cancelButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 4,
        borderColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureButtonInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#fff',
    },
});
