// QScrap New Request Screen - 2026 Premium Refactored Edition
// No VIN - Uses Saved Vehicles - Stepped Wizard - Modern UI

import React, { useState, useRef, useEffect } from 'react';
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
    KeyboardAvoidingView,
    Platform,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { api } from '../services/api';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../components/Toast';
import MyVehiclesSelector, { SavedVehicle } from '../components/MyVehiclesSelector';
import SearchableDropdown from '../components/SearchableDropdown';
import { PART_CATEGORIES, PART_SUBCATEGORIES } from '../constants/categoryData';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type NewRequestRouteProp = RouteProp<RootStackParamList, 'NewRequest'>;

// Prefill data structure for Order Again functionality
interface PrefillData {
    carMake?: string;
    carModel?: string;
    carYear?: number;
    partDescription?: string;
    partCategory?: string;
    partSubCategory?: string;
    imageUrls?: string[]; // Previous order images to reference
}

const CONDITION_OPTIONS = [
    { value: 'any', label: 'Any Condition', icon: '🔄', color: '#6B7280' },
    { value: 'new', label: 'New Only', icon: '✨', color: '#22C55E' },
    { value: 'used', label: 'Used Only', icon: '♻️', color: '#F59E0B' },
];

export default function NewRequestScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<NewRequestRouteProp>();
    const { colors } = useTheme();
    const toast = useToast();

    // Extract prefill data from route params (for Order Again)
    const prefillData: PrefillData | undefined = route.params?.prefill;

    // Selected Vehicle
    const [selectedVehicle, setSelectedVehicle] = useState<SavedVehicle | null>(null);

    // Part Details
    const [partCategory, setPartCategory] = useState('');
    const [partSubCategory, setPartSubCategory] = useState('');
    const [partDescription, setPartDescription] = useState('');
    const [partNumber, setPartNumber] = useState('');
    const [condition, setCondition] = useState('any');
    const [availableSubCategories, setAvailableSubCategories] = useState<string[]>([]);

    // Photos - Split into Part Damage and Vehicle ID
    const [images, setImages] = useState<string[]>([]);  // Part damage photos
    const [carFrontImage, setCarFrontImage] = useState<string | null>(null);  // Vehicle front ID
    const [carRearImage, setCarRearImage] = useState<string | null>(null);    // Vehicle rear ID

    // Delivery location for driver navigation (lat/lng captured from HomeScreen)
    const [deliveryLocation, setDeliveryLocation] = useState<{
        lat: number | null;
        lng: number | null;
        address: string;
    }>({ lat: null, lng: null, address: '' });

    // Loading
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    // Handle Order Again prefill - VVIP Quality Implementation
    useEffect(() => {
        if (!prefillData) return;

        // Pre-fill part description
        if (prefillData.partDescription) {
            setPartDescription(prefillData.partDescription);
        }

        // Pre-fill part category
        if (prefillData.partCategory) {
            setPartCategory(prefillData.partCategory);
        }

        // Pre-fill part subcategory (after category is set)
        if (prefillData.partSubCategory) {
            // Delay to ensure category is processed first
            setTimeout(() => {
                setPartSubCategory(prefillData.partSubCategory!);
            }, 100);
        }

        // Note: Images are NOT pre-filled as they may be outdated.
        // User should take fresh photos for the new request.

        // Show success toast to indicate pre-fill
        if (prefillData.partDescription || prefillData.partCategory) {
            setTimeout(() => {
                toast.info('Order Again', 'Form pre-filled with your previous order details');
            }, 500);
        }
    }, [prefillData]);

    // Apply delivery location from HomeScreen for driver navigation
    useEffect(() => {
        const locationFromNav = route.params?.deliveryLocation;
        if (locationFromNav) {
            setDeliveryLocation({
                lat: locationFromNav.lat,
                lng: locationFromNav.lng,
                address: locationFromNav.address,
            });
        }
    }, [route.params?.deliveryLocation]);

    // Auto-select vehicle when vehicles are loaded
    const handleVehiclesLoaded = (vehicles: SavedVehicle[]) => {
        if (vehicles.length === 0) return;

        // If we have prefill data (Order Again), try to find exact match
        if (prefillData?.carMake) {
            const matchingVehicle = vehicles.find(v =>
                v.car_make.toLowerCase() === prefillData.carMake?.toLowerCase() &&
                v.car_model.toLowerCase() === prefillData.carModel?.toLowerCase() &&
                v.car_year === prefillData.carYear
            );
            if (matchingVehicle) {
                setSelectedVehicle(matchingVehicle);
                return;
            }
        }

        // Always auto-select the first vehicle (sorted by last_used_at or is_primary)
        // Backend returns vehicles sorted: primary first, then by last_used_at DESC
        setSelectedVehicle(vehicles[0]);
    };

    // Update subcategories when category changes
    useEffect(() => {
        if (partCategory && PART_SUBCATEGORIES[partCategory]) {
            setAvailableSubCategories(PART_SUBCATEGORIES[partCategory]);
            setPartSubCategory('');
        } else {
            setAvailableSubCategories([]);
        }
    }, [partCategory]);

    const handleVehicleSelect = (vehicle: SavedVehicle) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedVehicle(vehicle);
    };

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            toast.error('Permission Denied', 'Camera roll access is required');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.8,
            selectionLimit: 5 - images.length,
        });

        if (!result.canceled && result.assets) {
            const newImages = result.assets.map(asset => asset.uri);
            setImages(prev => [...prev, ...newImages].slice(0, 5));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const handleTakePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            toast.error('Permission Denied', 'Camera access is required');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
            allowsEditing: true,
        });

        if (!result.canceled && result.assets[0]) {
            setImages(prev => [...prev, result.assets[0].uri].slice(0, 5));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const handleRemoveImage = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    // Vehicle ID Photo Handlers
    const handlePickCarFrontImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            toast.error('Permission Denied', 'Camera roll access required');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: true,
        });
        if (!result.canceled && result.assets[0]) {
            setCarFrontImage(result.assets[0].uri);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const handlePickCarRearImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            toast.error('Permission Denied', 'Camera roll access required');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: true,
        });
        if (!result.canceled && result.assets[0]) {
            setCarRearImage(result.assets[0].uri);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const handleTakeCarFrontPhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            toast.error('Permission Denied', 'Camera access required');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
        if (!result.canceled && result.assets[0]) {
            setCarFrontImage(result.assets[0].uri);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const handleTakeCarRearPhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            toast.error('Permission Denied', 'Camera access required');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
        if (!result.canceled && result.assets[0]) {
            setCarRearImage(result.assets[0].uri);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const handleSubmit = async () => {
        // Prevent double submission
        if (isSubmitting) {
            return;
        }

        // Validation
        if (!selectedVehicle) {
            toast.error('Missing Vehicle', 'Please select a vehicle');
            return;
        }

        if (!partDescription.trim()) {
            toast.error('Missing Description', 'Please describe the part you need');
            return;
        }

        setIsSubmitting(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const formData = new FormData();

            // Vehicle data
            formData.append('car_make', selectedVehicle.car_make);
            formData.append('car_model', selectedVehicle.car_model);
            formData.append('car_year', selectedVehicle.car_year.toString());
            if (selectedVehicle.vin_number) {
                formData.append('vin_number', selectedVehicle.vin_number);
            }

            // Part data
            formData.append('part_description', partDescription.trim());
            if (partCategory) formData.append('part_category', partCategory);
            if (partSubCategory) formData.append('part_subcategory', partSubCategory);
            if (partNumber.trim()) formData.append('part_number', partNumber.trim());
            formData.append('condition_required', condition);

            // Delivery location - critical for driver navigation
            if (deliveryLocation.lat && deliveryLocation.lng) {
                formData.append('delivery_lat', deliveryLocation.lat.toString());
                formData.append('delivery_lng', deliveryLocation.lng.toString());
                formData.append('delivery_address_text', deliveryLocation.address);
            }

            // Part Damage Photos
            images.forEach((uri, index) => {
                const uriParts = uri.split('.');
                const fileType = uriParts[uriParts.length - 1];
                formData.append('images', {
                    uri,
                    name: `part_${index}.${fileType}`,
                    type: `image/${fileType}`,
                } as any);
            });

            // Vehicle ID Photos (for Qatar scrap yards)
            if (carFrontImage) {
                const frontParts = carFrontImage.split('.');
                const frontType = frontParts[frontParts.length - 1];
                formData.append('car_front_image', {
                    uri: carFrontImage,
                    name: `car_front.${frontType}`,
                    type: `image/${frontType}`,
                } as any);
            }

            if (carRearImage) {
                const rearParts = carRearImage.split('.');
                const rearType = rearParts[rearParts.length - 1];
                formData.append('car_rear_image', {
                    uri: carRearImage,
                    name: `car_rear.${rearType}`,
                    type: `image/${rearType}`,
                } as any);
            }

            const response = await api.createRequest(formData);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            toast.success('Request Created!', 'Garages are reviewing your request');

            // Navigate to request details
            navigation.replace('RequestDetail', { requestId: response.request_id });

        } catch (error: any) {
            console.error('[NewRequest] Submit error:', error);
            toast.error('Error', error.message || 'Failed to create request');
        } finally {
            setIsSubmitting(false);
        }
    };

    const canSubmit = selectedVehicle && partDescription.trim().length > 10;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                {/* Premium Header */}
                <Animated.View
                    style={[
                        styles.header,
                        { backgroundColor: colors.surface, borderBottomColor: colors.border },
                        { opacity: fadeAnim },
                    ]}
                >
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.closeButton}
                    >
                        <Text style={[styles.closeIcon, { color: colors.text }]}>←</Text>
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>New Request</Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                            Find your part instantly
                        </Text>
                    </View>
                    <View style={{ width: 40 }} />
                </Animated.View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View
                        style={{
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        }}
                    >
                        {/* 1. Select Vehicle */}
                        <View style={[styles.section, { backgroundColor: colors.surface }]}>
                            <View style={styles.sectionHeader}>
                                <View style={[styles.stepBadge, { backgroundColor: Colors.primary + '15' }]}>
                                    <Text style={[styles.stepNumber, { color: Colors.primary }]}>1</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Vehicle</Text>
                                    <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                                        Choose from your saved cars
                                    </Text>
                                </View>
                            </View>

                            <MyVehiclesSelector
                                onSelect={handleVehicleSelect}
                                selectedVehicleId={selectedVehicle?.vehicle_id}
                                onVehiclesLoaded={handleVehiclesLoaded}
                            />

                            {selectedVehicle && (
                                <View style={[styles.selectedVehicleBadge, { backgroundColor: Colors.primary + '10' }]}>
                                    <Text style={styles.checkIcon}>✓</Text>
                                    <Text style={[styles.selectedText, { color: Colors.primary }]}>
                                        {selectedVehicle.car_make} {selectedVehicle.car_model} ({selectedVehicle.car_year})
                                    </Text>
                                </View>
                            )}

                            {!selectedVehicle && (
                                <TouchableOpacity
                                    onPress={() => navigation.navigate('MyVehicles')}
                                    style={styles.addVehicleButton}
                                >
                                    <Text style={[styles.addVehicleText, { color: Colors.primary }]}>
                                        + Add New Vehicle
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* 2. Part Details */}
                        <View style={[styles.section, { backgroundColor: colors.surface }]}>
                            <View style={styles.sectionHeader}>
                                <View style={[styles.stepBadge, { backgroundColor: '#F59E0B15' }]}>
                                    <Text style={[styles.stepNumber, { color: '#F59E0B' }]}>2</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Part Details</Text>
                                    <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                                        What do you need?
                                    </Text>
                                </View>
                            </View>

                            {/* Category (Optional) */}
                            <SearchableDropdown
                                label="Category (Optional)"
                                placeholder="e.g. Engine, Body, Interior"
                                items={PART_CATEGORIES}
                                value={partCategory}
                                onSelect={setPartCategory}
                            />

                            {/* Subcategory (Optional) */}
                            {partCategory && availableSubCategories.length > 0 && (
                                <SearchableDropdown
                                    label="Subcategory (Optional)"
                                    placeholder="Select subcategory"
                                    items={availableSubCategories}
                                    value={partSubCategory}
                                    onSelect={setPartSubCategory}
                                />
                            )}

                            {/* Part Description */}
                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: colors.text }]}>
                                    Description *
                                </Text>
                                <TextInput
                                    style={[
                                        styles.textArea,
                                        {
                                            backgroundColor: colors.background,
                                            color: colors.text,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                    placeholder="E.g. Front bumper for 2020 Camry, black color preferred"
                                    placeholderTextColor={colors.textMuted}
                                    value={partDescription}
                                    onChangeText={setPartDescription}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                />
                                <Text style={[styles.charCount, { color: colors.textMuted }]}>
                                    {partDescription.length}/500
                                </Text>
                            </View>

                            {/* Part Number (Optional) */}
                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: colors.text }]}>
                                    Part Number (Optional)
                                </Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            backgroundColor: colors.background,
                                            color: colors.text,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                    placeholder="OEM or aftermarket part number"
                                    placeholderTextColor={colors.textMuted}
                                    value={partNumber}
                                    onChangeText={setPartNumber}
                                    autoCapitalize="characters"
                                />
                            </View>

                            {/* Condition */}
                            <Text style={[styles.label, { color: colors.text }]}>Condition Preference</Text>
                            <View style={styles.conditionGrid}>
                                {CONDITION_OPTIONS.map((opt) => (
                                    <TouchableOpacity
                                        key={opt.value}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setCondition(opt.value);
                                        }}
                                        style={[
                                            styles.conditionCard,
                                            {
                                                backgroundColor:
                                                    condition === opt.value
                                                        ? opt.color + '15'
                                                        : colors.background,
                                                borderColor:
                                                    condition === opt.value
                                                        ? opt.color
                                                        : colors.border,
                                                borderWidth: condition === opt.value ? 2 : 1,
                                            },
                                        ]}
                                    >
                                        <Text style={styles.conditionIcon}>{opt.icon}</Text>
                                        <Text
                                            style={[
                                                styles.conditionLabel,
                                                {
                                                    color:
                                                        condition === opt.value
                                                            ? opt.color
                                                            : colors.text,
                                                },
                                            ]}
                                        >
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* 3. Photos */}
                        <View style={[styles.section, { backgroundColor: colors.surface }]}>
                            <View style={styles.sectionHeader}>
                                <View style={[styles.stepBadge, { backgroundColor: '#22C55E15' }]}>
                                    <Text style={[styles.stepNumber, { color: '#22C55E' }]}>3</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                        Photos (Optional)
                                    </Text>
                                    <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                                        Add up to 5 photos
                                    </Text>
                                </View>
                            </View>

                            {/* Photo Grid */}
                            <View style={styles.photoGrid}>
                                {images.map((uri, index) => (
                                    <View key={index} style={styles.photoWrapper}>
                                        <Image source={{ uri }} style={styles.photo} />
                                        <TouchableOpacity
                                            onPress={() => handleRemoveImage(index)}
                                            style={styles.removePhotoButton}
                                        >
                                            <Text style={styles.removePhotoIcon}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}

                                {images.length < 5 && (
                                    <TouchableOpacity
                                        onPress={handlePickImage}
                                        style={[
                                            styles.addPhotoButton,
                                            { backgroundColor: colors.background, borderColor: colors.border },
                                        ]}
                                    >
                                        <Text style={styles.addPhotoIcon}>📷</Text>
                                        <Text style={[styles.addPhotoText, { color: colors.textSecondary }]}>
                                            Gallery
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {images.length < 5 && (
                                    <TouchableOpacity
                                        onPress={handleTakePhoto}
                                        style={[
                                            styles.addPhotoButton,
                                            { backgroundColor: colors.background, borderColor: colors.border },
                                        ]}
                                    >
                                        <Text style={styles.addPhotoIcon}>📸</Text>
                                        <Text style={[styles.addPhotoText, { color: colors.textSecondary }]}>
                                            Camera
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* 4. Vehicle ID Photos */}
                        <View style={[styles.section, { backgroundColor: colors.surface }]}>
                            <View style={styles.sectionHeader}>
                                <View style={[styles.stepBadge, { backgroundColor: '#F59E0B15' }]}>
                                    <Text style={[styles.stepNumber, { color: '#F59E0B' }]}>4</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                        Vehicle ID Photos
                                    </Text>
                                    <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                                        Help garages identify your car
                                    </Text>
                                </View>
                            </View>

                            <Text style={[styles.photoLabel, { color: colors.textSecondary, marginBottom: 8 }]}>
                                🚗 Front View (License Plate)
                            </Text>
                            {carFrontImage ? (
                                <View style={{ marginBottom: 16 }}>
                                    <Image source={{ uri: carFrontImage }} style={{ width: '100%', height: 200, borderRadius: 12 }} />
                                    <TouchableOpacity
                                        onPress={() => setCarFrontImage(null)}
                                        style={[styles.removePhotoButton, { top: 8, right: 8 }]}
                                    >
                                        <Text style={styles.removePhotoIcon}>✕</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                                    <TouchableOpacity
                                        onPress={handlePickCarFrontImage}
                                        style={[styles.addPhotoButton, { flex: 1, backgroundColor: colors.background, borderColor: colors.border }]}
                                    >
                                        <Text style={styles.addPhotoIcon}>📷</Text>
                                        <Text style={[styles.addPhotoText, { color: colors.textSecondary }]}>Gallery</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleTakeCarFrontPhoto}
                                        style={[styles.addPhotoButton, { flex: 1, backgroundColor: colors.background, borderColor: colors.border }]}
                                    >
                                        <Text style={styles.addPhotoIcon}>📸</Text>
                                        <Text style={[styles.addPhotoText, { color: colors.textSecondary }]}>Camera</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <Text style={[styles.photoLabel, { color: colors.textSecondary, marginBottom: 8 }]}>
                                🚙 Rear View (Model ID)
                            </Text>
                            {carRearImage ? (
                                <View>
                                    <Image source={{ uri: carRearImage }} style={{ width: '100%', height: 200, borderRadius: 12 }} />
                                    <TouchableOpacity
                                        onPress={() => setCarRearImage(null)}
                                        style={[styles.removePhotoButton, { top: 8, right: 8 }]}
                                    >
                                        <Text style={styles.removePhotoIcon}>✕</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <TouchableOpacity
                                        onPress={handlePickCarRearImage}
                                        style={[styles.addPhotoButton, { flex: 1, backgroundColor: colors.background, borderColor: colors.border }]}
                                    >
                                        <Text style={styles.addPhotoIcon}>📷</Text>
                                        <Text style={[styles.addPhotoText, { color: colors.textSecondary }]}>Gallery</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleTakeCarRearPhoto}
                                        style={[styles.addPhotoButton, { flex: 1, backgroundColor: colors.background, borderColor: colors.border }]}
                                    >
                                        <Text style={styles.addPhotoIcon}>📸</Text>
                                        <Text style={[styles.addPhotoText, { color: colors.textSecondary }]}>Camera</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        <View style={{ height: 120 }} />
                    </Animated.View>
                </ScrollView>

                {/* Submit Button - Fixed at bottom */}
                <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={!canSubmit || isSubmitting}
                        style={[
                            styles.submitButton,
                            !canSubmit && styles.submitButtonDisabled,
                        ]}
                        activeOpacity={0.9}
                    >
                        <LinearGradient
                            colors={
                                canSubmit && !isSubmitting
                                    ? [Colors.primary, '#B31D4A']
                                    : ['#9CA3AF', '#6B7280']
                            }
                            style={styles.submitGradient}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Text style={styles.submitText}>Submit Request</Text>
                                    <Text style={styles.submitIcon}>→</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                    {!canSubmit && (
                        <Text style={[styles.footerHint, { color: colors.textMuted }]}>
                            {!selectedVehicle
                                ? 'Select a vehicle to continue'
                                : 'Add a part description (min 10 characters)'}
                        </Text>
                    )}
                </View>
            </KeyboardAvoidingView >
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeIcon: { fontSize: 24 },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
    headerSubtitle: { fontSize: FontSizes.xs, marginTop: 2 },
    scrollView: { flex: 1 },
    scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
    section: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.lg,
        gap: Spacing.md,
    },
    stepBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNumber: { fontSize: FontSizes.md, fontWeight: '800' },
    sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
    sectionSubtitle: { fontSize: FontSizes.sm, marginTop: 2 },
    selectedVehicleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.md,
        gap: Spacing.sm,
    },
    checkIcon: { fontSize: 18 },
    selectedText: { fontSize: FontSizes.md, fontWeight: '600' },
    addVehicleButton: {
        padding: Spacing.md,
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    addVehicleText: { fontSize: FontSizes.md, fontWeight: '600' },
    inputGroup: { marginBottom: Spacing.md },
    label: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        marginBottom: Spacing.xs,
    },
    input: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: FontSizes.md,
    },
    textArea: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: FontSizes.md,
        minHeight: 120,
    },
    charCount: {
        fontSize: FontSizes.xs,
        marginTop: Spacing.xs,
        textAlign: 'right',
    },
    conditionGrid: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.xs,
    },
    conditionCard: {
        flex: 1,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        gap: Spacing.xs,
    },
    conditionIcon: { fontSize: 24 },
    conditionLabel: { fontSize: FontSizes.xs, fontWeight: '600', textAlign: 'center' },
    photoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    photoWrapper: {
        width: 100,
        height: 100,
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
        position: 'relative',
    },
    photo: { width: '100%', height: '100%' },
    removePhotoButton: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    removePhotoIcon: { color: '#fff', fontSize: 14 },
    addPhotoButton: {
        width: 100,
        height: 100,
        borderRadius: BorderRadius.md,
        borderWidth: 2,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
    },
    addPhotoIcon: { fontSize: 28 },
    addPhotoText: { fontSize: FontSizes.xs, fontWeight: '600' },
    photoLabel: { fontSize: FontSizes.sm, fontWeight: '600', marginBottom: 8 },
    footer: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.lg,
        borderTopWidth: 1,
    },
    submitButton: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    submitButtonDisabled: { opacity: 0.5 },
    submitGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        gap: Spacing.sm,
    },
    submitText: {
        color: '#fff',
        fontSize: FontSizes.lg,
        fontWeight: '700',
    },
    submitIcon: {
        color: '#fff',
        fontSize: FontSizes.xl,
    },
    footerHint: {
        fontSize: FontSizes.xs,
        textAlign: 'center',
        marginTop: Spacing.sm,
    },
});
