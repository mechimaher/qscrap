import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    TextInput,
    Image,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../contexts';
import { api } from '../services';
import { Spacing, BorderRadius, FontSize, Shadows } from '../constants';

const DISPUTE_REASONS = [
    { id: 'wrong_item', label: 'Wrong Item Received', icon: 'swap-horizontal-outline', refund: '100%' },
    { id: 'damaged', label: 'Item Damaged', icon: 'alert-circle-outline', refund: '100%' },
    { id: 'not_as_described', label: 'Not as Described', icon: 'document-text-outline', refund: '100%' },
    { id: 'quality_issue', label: 'Quality Issue', icon: 'construct-outline', refund: '80%' },
    { id: 'changed_mind', label: 'Changed My Mind', icon: 'refresh-outline', refund: '70%' },
];

const DisputeScreen: React.FC = () => {
    const { colors } = useTheme();
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { orderId } = route.params as { orderId: string };

    const [loading, setLoading] = useState(false);
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [description, setDescription] = useState('');
    const [images, setImages] = useState<string[]>([]);

    const pickImage = async () => {
        if (images.length >= 5) {
            Alert.alert('Limit Reached', 'You can upload up to 5 images');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            selectionLimit: 5 - images.length,
            quality: 0.8,
        });

        if (!result.canceled) {
            setImages([...images, ...result.assets.map(a => a.uri)]);
        }
    };

    const takePhoto = async () => {
        if (images.length >= 5) {
            Alert.alert('Limit Reached', 'You can upload up to 5 images');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
        });

        if (!result.canceled) {
            setImages([...images, result.assets[0].uri]);
        }
    };

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!selectedReason) {
            Alert.alert('Required', 'Please select a reason for your dispute');
            return;
        }

        if (!description.trim()) {
            Alert.alert('Required', 'Please describe the issue');
            return;
        }

        if (images.length === 0) {
            Alert.alert('Required', 'Please add at least one photo as evidence');
            return;
        }

        try {
            setLoading(true);

            const formData = new FormData();
            formData.append('order_id', orderId);
            formData.append('reason', selectedReason);
            formData.append('description', description);

            images.forEach((uri, index) => {
                const filename = uri.split('/').pop() || `photo_${index}.jpg`;
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : 'image/jpeg';

                formData.append('photos', {
                    uri,
                    name: filename,
                    type,
                } as any);
            });

            await api.createDispute(formData);

            Alert.alert(
                'Dispute Submitted',
                'Your dispute has been submitted. The garage has 48 hours to respond. We will notify you of any updates.',
                [{ text: 'OK', onPress: () => navigation.navigate('MainTabs') }]
            );
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to submit dispute');
        } finally {
            setLoading(false);
        }
    };

    const selectedReasonInfo = DISPUTE_REASONS.find(r => r.id === selectedReason);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Report Issue</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Info Banner */}
                <View style={[styles.infoBanner, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="information-circle" size={24} color={colors.primary} />
                    <Text style={[styles.infoText, { color: colors.primary }]}>
                        Disputes must be filed within 48 hours of delivery. Provide evidence photos for faster resolution.
                    </Text>
                </View>

                {/* Reason Selection */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>What's the issue?</Text>

                {DISPUTE_REASONS.map(reason => (
                    <TouchableOpacity
                        key={reason.id}
                        style={[
                            styles.reasonCard,
                            {
                                backgroundColor: selectedReason === reason.id ? colors.primary + '15' : colors.surface,
                                borderColor: selectedReason === reason.id ? colors.primary : colors.border,
                            },
                            Shadows.sm
                        ]}
                        onPress={() => setSelectedReason(reason.id)}
                    >
                        <View style={[styles.reasonIcon, { backgroundColor: colors.surfaceSecondary }]}>
                            <Ionicons name={reason.icon as any} size={24} color={colors.primary} />
                        </View>
                        <View style={styles.reasonInfo}>
                            <Text style={[styles.reasonLabel, { color: colors.text }]}>{reason.label}</Text>
                            <Text style={[styles.reasonRefund, { color: colors.success }]}>Up to {reason.refund} refund</Text>
                        </View>
                        {selectedReason === reason.id && (
                            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                        )}
                    </TouchableOpacity>
                ))}

                {/* Description */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.lg }]}>Describe the issue</Text>
                <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    placeholder="Please provide details about the problem..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    value={description}
                    onChangeText={setDescription}
                />

                {/* Photos */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.lg }]}>Evidence Photos</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Add photos of the issue (up to 5)</Text>

                <View style={styles.photoSection}>
                    <TouchableOpacity
                        style={[styles.photoBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={takePhoto}
                    >
                        <Ionicons name="camera" size={28} color={colors.primary} />
                        <Text style={[styles.photoBtnText, { color: colors.textSecondary }]}>Camera</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.photoBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={pickImage}
                    >
                        <Ionicons name="images" size={28} color={colors.primary} />
                        <Text style={[styles.photoBtnText, { color: colors.textSecondary }]}>Gallery</Text>
                    </TouchableOpacity>
                </View>

                {images.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreview}>
                        {images.map((uri, index) => (
                            <View key={index} style={styles.imageContainer}>
                                <Image source={{ uri }} style={styles.previewImage} />
                                <TouchableOpacity
                                    style={[styles.removeBtn, { backgroundColor: colors.danger }]}
                                    onPress={() => removeImage(index)}
                                >
                                    <Ionicons name="close" size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                )}

                {/* Expected Resolution */}
                {selectedReasonInfo && (
                    <View style={[styles.resolutionCard, { backgroundColor: colors.success + '15' }]}>
                        <Ionicons name="cash-outline" size={24} color={colors.success} />
                        <View style={styles.resolutionInfo}>
                            <Text style={[styles.resolutionTitle, { color: colors.success }]}>Expected Resolution</Text>
                            <Text style={[styles.resolutionText, { color: colors.textSecondary }]}>
                                You may receive up to {selectedReasonInfo.refund} refund based on the garage's response and our review.
                            </Text>
                        </View>
                    </View>
                )}

                {/* Submit Button */}
                <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="send" size={20} color="#fff" />
                            <Text style={styles.submitBtnText}>Submit Dispute</Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
    backBtn: { padding: Spacing.sm },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700' },
    content: { flex: 1, padding: Spacing.lg },

    infoBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.lg },
    infoText: { flex: 1, fontSize: FontSize.sm },

    sectionTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: Spacing.md },
    sectionSubtitle: { fontSize: FontSize.sm, marginTop: -Spacing.sm, marginBottom: Spacing.md },

    reasonCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.sm,
        borderWidth: 1,
    },
    reasonIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    reasonInfo: { flex: 1, marginLeft: Spacing.md },
    reasonLabel: { fontSize: FontSize.md, fontWeight: '600' },
    reasonRefund: { fontSize: FontSize.sm, marginTop: 2 },

    input: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: FontSize.md,
        height: 120,
        textAlignVertical: 'top'
    },

    photoSection: { flexDirection: 'row', gap: Spacing.md },
    photoBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderStyle: 'dashed'
    },
    photoBtnText: { marginTop: Spacing.xs, fontSize: FontSize.sm },

    imagePreview: { marginTop: Spacing.md },
    imageContainer: { marginRight: Spacing.sm },
    previewImage: { width: 100, height: 100, borderRadius: BorderRadius.md },
    removeBtn: { position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

    resolutionCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.lg },
    resolutionInfo: { flex: 1 },
    resolutionTitle: { fontSize: FontSize.md, fontWeight: '600' },
    resolutionText: { fontSize: FontSize.sm, marginTop: 2 },

    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg, borderRadius: BorderRadius.lg, marginTop: Spacing.xl },
    submitBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
});

export default DisputeScreen;
