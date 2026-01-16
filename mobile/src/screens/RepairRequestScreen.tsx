// QScrap Repair Request Screen - Request Car Repair/Checkup
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Image,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../services/api';
import { Colors, Typography, VVIP_COLORS } from '../theme';
import MyVehiclesSelector from '../components/MyVehiclesSelector';
import { CAR_MAKES, CAR_MODELS, YEARS } from '../constants/carData';
import { SavedVehicle } from '../services/api';

// Problem types for repair requests
const PROBLEM_TYPES = [
    { id: 'engine', label: 'Engine', icon: 'car-sport-outline' },
    { id: 'brakes', label: 'Brakes', icon: 'stop-circle-outline' },
    { id: 'suspension', label: 'Suspension', icon: 'swap-vertical-outline' },
    { id: 'electrical', label: 'Electrical', icon: 'flash-outline' },
    { id: 'ac', label: 'A/C & Cooling', icon: 'snow-outline' },
    { id: 'transmission', label: 'Transmission', icon: 'cog-outline' },
    { id: 'body', label: 'Body Work', icon: 'construct-outline' },
    { id: 'general', label: 'General Checkup', icon: 'medical-outline' },
];

const URGENCY_OPTIONS = [
    { id: 'low', label: 'Not Urgent', color: '#10b981' },
    { id: 'normal', label: 'Normal', color: '#3b82f6' },
    { id: 'high', label: 'Urgent', color: '#f59e0b' },
    { id: 'emergency', label: 'Emergency', color: '#ef4444' },
];

export default function RepairRequestScreen() {
    const navigation = useNavigation();

    // Vehicle state
    const [carMake, setCarMake] = useState('');
    const [carModel, setCarModel] = useState('');
    const [carYear, setCarYear] = useState('');
    const [vinNumber, setVinNumber] = useState('');
    const [savedVehicleId, setSavedVehicleId] = useState<string | null>(null);
    const [useVehicleSelector, setUseVehicleSelector] = useState(true);

    // Problem state
    const [problemType, setProblemType] = useState('general');
    const [problemDescription, setProblemDescription] = useState('');
    const [urgency, setUrgency] = useState('normal');

    // Media state
    const [images, setImages] = useState<string[]>([]);
    const [videos, setVideos] = useState<string[]>([]);
    // Audio recordings would require expo-av, placeholder for now

    // UI state
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Vehicle, 2: Problem, 3: Media

    // Handle vehicle selection from saved vehicles
    const handleVehicleSelect = (vehicle: SavedVehicle) => {
        setCarMake(vehicle.make);
        setCarModel(vehicle.model);
        setCarYear(vehicle.year.toString());
        setVinNumber(vehicle.vin_number || '');
        setSavedVehicleId(vehicle.vehicle_id);
        setStep(2);
    };

    // Manual vehicle entry
    const handleManualEntry = () => {
        setUseVehicleSelector(false);
        setSavedVehicleId(null);
    };

    // Image picker
    const handlePickImages = async () => {
        if (images.length >= 10) {
            Alert.alert('Limit Reached', 'Maximum 10 images allowed');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.7,
            selectionLimit: 10 - images.length,
        });

        if (!result.canceled) {
            const newImages = result.assets.map(a => a.uri);
            setImages([...images, ...newImages]);
        }
    };

    // Camera for photos
    const handleTakePhoto = async () => {
        if (images.length >= 10) {
            Alert.alert('Limit Reached', 'Maximum 10 images allowed');
            return;
        }

        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Camera access is needed to take photos');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            quality: 0.7,
        });

        if (!result.canceled) {
            setImages([...images, result.assets[0].uri]);
        }
    };

    // Video picker
    const handlePickVideo = async () => {
        if (videos.length >= 3) {
            Alert.alert('Limit Reached', 'Maximum 3 videos allowed');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            quality: 0.5,
            videoMaxDuration: 60, // 1 minute max
        });

        if (!result.canceled) {
            setVideos([...videos, result.assets[0].uri]);
        }
    };

    // Remove media
    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
    };

    const removeVideo = (index: number) => {
        setVideos(videos.filter((_, i) => i !== index));
    };

    // Submit request
    const handleSubmit = async () => {
        if (!carMake || !carModel || !problemDescription.trim()) {
            Alert.alert('Missing Info', 'Please fill in vehicle and problem details');
            return;
        }

        setLoading(true);
        try {
            // Upload images first (if any)
            const imageUrls: string[] = [];
            for (const uri of images) {
                try {
                    const formData = new FormData();
                    formData.append('file', {
                        uri,
                        type: 'image/jpeg',
                        name: 'repair_photo.jpg',
                    } as any);

                    const uploadRes = await api.post('/uploads/image', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });
                    if (uploadRes.data.url) {
                        imageUrls.push(uploadRes.data.url);
                    }
                } catch (uploadErr) {
                    console.warn('Image upload failed:', uploadErr);
                }
            }

            // Submit repair request
            const res = await api.post('/repair/requests', {
                car_make: carMake,
                car_model: carModel,
                car_year: carYear ? parseInt(carYear) : null,
                vin_number: vinNumber || null,
                saved_vehicle_id: savedVehicleId,
                problem_type: problemType,
                problem_description: problemDescription,
                urgency,
                image_urls: imageUrls,
                video_urls: [], // Would need separate video upload handling
                audio_urls: [],
                service_location: 'workshop',
            });

            if (res.data.request_id) {
                Alert.alert(
                    'Request Submitted!',
                    'Workshops will start sending you quotes. We\'ll notify you when bids come in.',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            }
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to submit request');
        } finally {
            setLoading(false);
        }
    };

    // Render step indicator
    const renderStepIndicator = () => (
        <View style={styles.stepIndicator}>
            {[1, 2, 3].map((s) => (
                <View key={s} style={styles.stepRow}>
                    <View style={[styles.stepDot, step >= s && styles.stepDotActive]}>
                        <Text style={styles.stepNumber}>{s}</Text>
                    </View>
                    {s < 3 && <View style={[styles.stepLine, step > s && styles.stepLineActive]} />}
                </View>
            ))}
        </View>
    );

    // Step 1: Vehicle Selection
    const renderVehicleStep = () => (
        <View>
            <Text style={styles.stepTitle}>Select Your Vehicle</Text>
            <Text style={styles.stepSubtitle}>Choose from saved vehicles or enter manually</Text>

            {useVehicleSelector ? (
                <View>
                    <MyVehiclesSelector onSelect={handleVehicleSelect} />
                    <TouchableOpacity style={styles.manualButton} onPress={handleManualEntry}>
                        <Ionicons name="create-outline" size={20} color={VVIP_COLORS.gold} />
                        <Text style={styles.manualButtonText}>Enter Vehicle Manually</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Make *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g., Toyota"
                            placeholderTextColor="#666"
                            value={carMake}
                            onChangeText={setCarMake}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Model *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g., Camry"
                            placeholderTextColor="#666"
                            value={carModel}
                            onChangeText={setCarModel}
                        />
                    </View>
                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.label}>Year</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="2023"
                                placeholderTextColor="#666"
                                value={carYear}
                                onChangeText={setCarYear}
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                            <Text style={styles.label}>VIN (Optional)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="VIN Number"
                                placeholderTextColor="#666"
                                value={vinNumber}
                                onChangeText={setVinNumber}
                            />
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[styles.nextButton, (!carMake || !carModel) && styles.buttonDisabled]}
                        onPress={() => carMake && carModel && setStep(2)}
                        disabled={!carMake || !carModel}
                    >
                        <Text style={styles.nextButtonText}>Continue</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    // Step 2: Problem Description
    const renderProblemStep = () => (
        <View>
            <Text style={styles.stepTitle}>What's the Problem?</Text>
            <Text style={styles.stepSubtitle}>Select issue type and describe the problem</Text>

            <Text style={styles.label}>Problem Type</Text>
            <View style={styles.problemGrid}>
                {PROBLEM_TYPES.map((type) => (
                    <TouchableOpacity
                        key={type.id}
                        style={[styles.problemCard, problemType === type.id && styles.problemCardActive]}
                        onPress={() => setProblemType(type.id)}
                    >
                        <Ionicons
                            name={type.icon as any}
                            size={24}
                            color={problemType === type.id ? VVIP_COLORS.gold : '#888'}
                        />
                        <Text style={[styles.problemLabel, problemType === type.id && styles.problemLabelActive]}>
                            {type.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Describe the Problem *</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Describe what you're experiencing... e.g., 'Strange noise when braking, vibration at high speed'"
                    placeholderTextColor="#666"
                    value={problemDescription}
                    onChangeText={setProblemDescription}
                    multiline
                    numberOfLines={4}
                />
            </View>

            <Text style={styles.label}>Urgency Level</Text>
            <View style={styles.urgencyRow}>
                {URGENCY_OPTIONS.map((opt) => (
                    <TouchableOpacity
                        key={opt.id}
                        style={[styles.urgencyButton, urgency === opt.id && { borderColor: opt.color }]}
                        onPress={() => setUrgency(opt.id)}
                    >
                        <View style={[styles.urgencyDot, { backgroundColor: opt.color }]} />
                        <Text style={[styles.urgencyText, urgency === opt.id && { color: opt.color }]}>
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
                    <Ionicons name="arrow-back" size={20} color="#fff" />
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.nextButton, !problemDescription.trim() && styles.buttonDisabled]}
                    onPress={() => problemDescription.trim() && setStep(3)}
                    disabled={!problemDescription.trim()}
                >
                    <Text style={styles.nextButtonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );

    // Step 3: Media Upload
    const renderMediaStep = () => (
        <View>
            <Text style={styles.stepTitle}>Add Photos & Videos</Text>
            <Text style={styles.stepSubtitle}>Help workshops understand the issue better</Text>

            <View style={styles.mediaSection}>
                <Text style={styles.label}>Photos ({images.length}/10)</Text>
                <View style={styles.mediaButtons}>
                    <TouchableOpacity style={styles.mediaButton} onPress={handlePickImages}>
                        <Ionicons name="images-outline" size={24} color={VVIP_COLORS.gold} />
                        <Text style={styles.mediaButtonText}>Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.mediaButton} onPress={handleTakePhoto}>
                        <Ionicons name="camera-outline" size={24} color={VVIP_COLORS.gold} />
                        <Text style={styles.mediaButtonText}>Camera</Text>
                    </TouchableOpacity>
                </View>
                {images.length > 0 && (
                    <ScrollView horizontal style={styles.imageScroll}>
                        {images.map((uri, index) => (
                            <View key={index} style={styles.imagePreview}>
                                <Image source={{ uri }} style={styles.previewImage} />
                                <TouchableOpacity style={styles.removeButton} onPress={() => removeImage(index)}>
                                    <Ionicons name="close-circle" size={24} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>

            <View style={styles.mediaSection}>
                <Text style={styles.label}>Videos ({videos.length}/3)</Text>
                <TouchableOpacity style={styles.mediaButton} onPress={handlePickVideo}>
                    <Ionicons name="videocam-outline" size={24} color={VVIP_COLORS.gold} />
                    <Text style={styles.mediaButtonText}>Add Video (max 1 min)</Text>
                </TouchableOpacity>
                {videos.length > 0 && (
                    <View style={styles.videoList}>
                        {videos.map((uri, index) => (
                            <View key={index} style={styles.videoItem}>
                                <Ionicons name="videocam" size={20} color={VVIP_COLORS.gold} />
                                <Text style={styles.videoText}>Video {index + 1}</Text>
                                <TouchableOpacity onPress={() => removeVideo(index)}>
                                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}
            </View>

            <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.backButton} onPress={() => setStep(2)}>
                    <Ionicons name="arrow-back" size={20} color="#fff" />
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit}
                disabled={loading}
            >
                <LinearGradient
                    colors={[VVIP_COLORS.maroon, VVIP_COLORS.maroonDark]}
                    style={styles.submitGradient}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Text style={styles.submitText}>Submit Repair Request</Text>
                            <Ionicons name="checkmark-circle" size={24} color="#fff" />
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <LinearGradient colors={[VVIP_COLORS.maroon, '#0f0f0f']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIcon}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Request Repair</Text>
                <View style={{ width: 40 }} />
            </LinearGradient>

            {renderStepIndicator()}

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                {step === 1 && renderVehicleStep()}
                {step === 2 && renderProblemStep()}
                {step === 3 && renderMediaStep()}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f0f0f',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    backIcon: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    stepIndicator: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
        backgroundColor: '#1a1a1a',
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepDotActive: {
        backgroundColor: VVIP_COLORS.maroon,
    },
    stepNumber: {
        color: '#fff',
        fontWeight: '600',
    },
    stepLine: {
        width: 50,
        height: 3,
        backgroundColor: '#333',
        marginHorizontal: 8,
    },
    stepLineActive: {
        backgroundColor: VVIP_COLORS.maroon,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    stepTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    stepSubtitle: {
        fontSize: 14,
        color: '#888',
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        color: '#888',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 16,
        color: '#fff',
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    row: {
        flexDirection: 'row',
    },
    manualButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        marginTop: 16,
        borderWidth: 1,
        borderColor: VVIP_COLORS.gold,
        borderRadius: 12,
        borderStyle: 'dashed',
    },
    manualButtonText: {
        color: VVIP_COLORS.gold,
        marginLeft: 8,
        fontSize: 16,
    },
    problemGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 20,
    },
    problemCard: {
        width: '23%',
        aspectRatio: 1,
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        margin: '1%',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    problemCardActive: {
        borderColor: VVIP_COLORS.gold,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
    },
    problemLabel: {
        fontSize: 11,
        color: '#888',
        marginTop: 4,
        textAlign: 'center',
    },
    problemLabelActive: {
        color: VVIP_COLORS.gold,
    },
    urgencyRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 24,
    },
    urgencyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: '#1a1a1a',
        borderRadius: 20,
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    urgencyDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 6,
    },
    urgencyText: {
        color: '#888',
        fontSize: 13,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    nextButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: VVIP_COLORS.maroon,
        borderRadius: 12,
        padding: 16,
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    backButtonText: {
        color: '#fff',
        marginLeft: 8,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    mediaSection: {
        marginBottom: 24,
    },
    mediaButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    mediaButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    mediaButtonText: {
        color: '#fff',
        marginLeft: 8,
    },
    imageScroll: {
        marginTop: 12,
    },
    imagePreview: {
        marginRight: 12,
        position: 'relative',
    },
    previewImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
    },
    removeButton: {
        position: 'absolute',
        top: -8,
        right: -8,
    },
    videoList: {
        marginTop: 12,
    },
    videoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        gap: 12,
    },
    videoText: {
        color: '#fff',
        flex: 1,
    },
    submitButton: {
        marginTop: 24,
        borderRadius: 16,
        overflow: 'hidden',
    },
    submitGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
    },
    submitText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginRight: 8,
    },
});
