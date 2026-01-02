// QScrap New Request Screen - Premium "Excellence" Edition
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
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { api } from '../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import SearchableDropdown from '../components/SearchableDropdown';

import ImageViewerModal from '../components/ImageViewerModal';
import VINDecoder, { DecodedVIN } from '../components/VINDecoder';
import { CAR_MAKES, CAR_MODELS, YEARS } from '../constants/carData';
import { Address } from '../services/api';
import { PART_CATEGORIES, PART_SUBCATEGORIES } from '../constants/categoryData';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function NewRequestScreen() {
    const navigation = useNavigation<NavigationProp>();

    // Vehicle State
    const [carMake, setCarMake] = useState('');
    const [carModel, setCarModel] = useState('');
    const [carYear, setCarYear] = useState('');
    const [vinNumber, setVinNumber] = useState('');

    // Part State
    const [partCategory, setPartCategory] = useState('');
    const [partSubCategory, setPartSubCategory] = useState('');
    const [partDescription, setPartDescription] = useState('');
    const [partNumber, setPartNumber] = useState('');
    const [condition, setCondition] = useState('any');

    // Delivery State
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [deliveryFee, setDeliveryFee] = useState<number | null>(null);

    // Media State
    const [images, setImages] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // UI State

    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [availableSubCategories, setAvailableSubCategories] = useState<string[]>([]);

    // Filter Models when Make changes
    useEffect(() => {
        if (carMake && CAR_MODELS[carMake]) {
            setAvailableModels(CAR_MODELS[carMake]);
            setCarModel(''); // Reset model when make changes
        } else {
            setAvailableModels([]);
        }
    }, [carMake]);

    // Filter Subcategories when Category changes
    useEffect(() => {
        if (partCategory && PART_SUBCATEGORIES[partCategory]) {
            setAvailableSubCategories(PART_SUBCATEGORIES[partCategory]);
            setPartSubCategory(''); // Reset sub when cat changes
        } else {
            setAvailableSubCategories([]);
        }
    }, [partCategory]);

    const handleGetLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required for delivery');
                return;
            }

            const loc = await Location.getCurrentPositionAsync({});
            setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });

            // Calculate delivery fee
            const feeData = await api.calculateDeliveryFee(loc.coords.latitude, loc.coords.longitude);
            if (feeData.success) {
                setDeliveryFee(feeData.delivery_fee);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            // Reverse geocode (simplified)
            const address = await Location.reverseGeocodeAsync(loc.coords);
            if (address.length > 0) {
                const a = address[0];
                setDeliveryAddress(`${a.street || ''} ${a.city || ''}, Qatar`.trim());
            }
        } catch (error) {
            console.log('Location error:', error);
            Alert.alert('Error', 'Failed to get location');
        }
    };

    const handleSelectAddress = async () => {
        navigation.navigate('Addresses', {
            onSelect: async (address: Address) => {
                console.log('[NewRequest] Address selected:', address);
                setDeliveryAddress(address.address_text);

                // Calculate delivery fee if coordinates available
                if (address.latitude && address.longitude) {
                    setLocation({ lat: address.latitude, lng: address.longitude });
                    try {
                        const res = await api.calculateDeliveryFee(address.latitude, address.longitude);
                        console.log('[NewRequest] Fee calculated:', res);
                        if (res.success) {
                            setDeliveryFee(res.delivery_fee);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } else {
                            // If calculation fails, set default fee
                            setDeliveryFee(25);
                            Alert.alert('Note', 'Using standard delivery fee (25 QAR)');
                        }
                    } catch (error) {
                        console.log('[NewRequest] Fee calculation error:', error);
                        setDeliveryFee(25);
                        Alert.alert('Note', 'Using standard delivery fee (25 QAR)');
                    }
                } else {
                    // No coordinates - use default fee
                    setDeliveryFee(25);
                    Alert.alert('Note', 'Address has no coordinates. Using standard delivery fee (25 QAR)');
                }
            }
        } as any);
    };

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            const newImages = result.assets.map(a => a.uri);
            setImages([...images, ...newImages].slice(0, 5));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const handleTakePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera permission is required');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
        });

        if (!result.canceled) {
            setImages([...images, result.assets[0].uri].slice(0, 5));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };



    const handleSubmit = async () => {
        if (!carMake || !carModel || !carYear) {
            Alert.alert('Vehicle Info Missing', 'Please specify the vehicle details.');
            return;
        }

        if (!partCategory && !partDescription) {
            Alert.alert('Missing Fields', 'Please select a part category or describe the part.');
            return;
        }

        // If Part Desc is empty but subcategory selected, use subcategory as description or append
        let finalDescription = partDescription;
        if (!finalDescription && partSubCategory) {
            finalDescription = `${partCategory} - ${partSubCategory}`;
        } else if (partSubCategory) {
            finalDescription = `[${partCategory} - ${partSubCategory}] ${partDescription}`;
        } else if (partCategory && !partDescription.includes(partCategory)) {
            finalDescription = `[${partCategory}] ${partDescription}`;
        }

        if (!finalDescription) {
            Alert.alert('Missing Description', 'Please describe the part you need.');
            return;
        }

        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('car_make', carMake);
            formData.append('car_model', carModel);
            formData.append('car_year', carYear);
            formData.append('vin_number', vinNumber);
            formData.append('part_description', finalDescription);
            formData.append('part_number', partNumber);
            formData.append('condition_required', condition);
            formData.append('delivery_address_text', deliveryAddress);

            if (location) {
                formData.append('delivery_lat', location.lat.toString());
                formData.append('delivery_lng', location.lng.toString());
            }

            // Add images
            images.forEach((uri, index) => {
                formData.append('images', {
                    uri,
                    name: `image_${index}.jpg`,
                    type: 'image/jpeg',
                } as any);
            });

            const result = await api.createRequest(formData);

            if (result.request_id) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Success!', 'Your request has been submitted. Garages will send bids soon!', [
                    { text: 'OK', onPress: () => navigation.goBack() }
                ]);
            } else {
                throw new Error(result.error || 'Failed to submit');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to submit request');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsLoading(false);
        }
    };

    const conditions = [
        { value: 'any', label: 'Any' },
        { value: 'new', label: 'New' },
        { value: 'used', label: 'Used' },
    ];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
                        <Text style={styles.closeText}>✕</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>New Part Request</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

                    {/* Vehicle Metadata */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Vehicle Information</Text>

                        {/* Make & Year Row */}
                        <View style={styles.row}>
                            <View style={styles.halfInput}>
                                <SearchableDropdown
                                    label="Make *"
                                    placeholder="Select Make"
                                    items={CAR_MAKES}
                                    value={carMake}
                                    onSelect={setCarMake}
                                />
                            </View>
                            <View style={styles.halfInput}>
                                <SearchableDropdown
                                    label="Year *"
                                    placeholder="Year"
                                    items={YEARS}
                                    value={carYear}
                                    onSelect={setCarYear}
                                />
                            </View>
                        </View>

                        {/* Model */}
                        <SearchableDropdown
                            label="Model *"
                            placeholder={carMake ? "Select Model" : "Select Make first"}
                            items={availableModels}
                            value={carModel}
                            onSelect={setCarModel}
                            disabled={!carMake}
                        />

                        {/* VIN Decoder */}
                        <VINDecoder
                            value={vinNumber}
                            onChangeText={setVinNumber}
                            onDecoded={(decoded: DecodedVIN) => {
                                // Auto-fill vehicle info from decoded VIN
                                if (decoded.make) setCarMake(decoded.make);
                                if (decoded.model) setCarModel(decoded.model);
                                if (decoded.year) setCarYear(decoded.year);
                            }}
                        />
                    </View>

                    {/* Part Details - Enhanced with Categories */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Part Details</Text>

                        {/* Category */}
                        <SearchableDropdown
                            label="Category *"
                            placeholder="Select Category"
                            items={PART_CATEGORIES}
                            value={partCategory}
                            onSelect={setPartCategory}
                        />

                        {/* Sub Category */}
                        {availableSubCategories.length > 0 && (
                            <SearchableDropdown
                                label="Sub-Category"
                                placeholder="Select Component"
                                items={availableSubCategories}
                                value={partSubCategory}
                                onSelect={setPartSubCategory}
                            />
                        )}

                        <Text style={styles.inputLabel}>Descriptions *</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Additional details (e.g. left side, color...)"
                            placeholderTextColor={Colors.dark.textMuted}
                            value={partDescription}
                            onChangeText={setPartDescription}
                            multiline
                            numberOfLines={3}
                        />

                        <Text style={styles.inputLabel}>Part Number (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="OEM part number"
                            placeholderTextColor={Colors.dark.textMuted}
                            value={partNumber}
                            onChangeText={setPartNumber}
                        />

                        <Text style={styles.inputLabel}>Condition Required</Text>
                        <View style={styles.conditionRow}>
                            {conditions.map(c => (
                                <TouchableOpacity
                                    key={c.value}
                                    style={[
                                        styles.conditionButton,
                                        condition === c.value && styles.conditionButtonActive
                                    ]}
                                    onPress={() => {
                                        setCondition(c.value);
                                        Haptics.selectionAsync();
                                    }}
                                >
                                    <Text style={[
                                        styles.conditionText,
                                        condition === c.value && styles.conditionTextActive
                                    ]}>{c.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Images Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Photos (Optional)</Text>

                        <View style={styles.imageActions}>
                            <TouchableOpacity style={styles.imageButton} onPress={handleTakePhoto}>
                                <Text style={styles.imageButtonIcon}>📷</Text>
                                <Text style={styles.imageButtonText}>Camera</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.imageButton} onPress={handlePickImage}>
                                <Text style={styles.imageButtonIcon}>🖼️</Text>
                                <Text style={styles.imageButtonText}>Gallery</Text>
                            </TouchableOpacity>
                        </View>

                        {images.length > 0 && (
                            <ScrollView horizontal style={styles.imagePreview}>
                                {images.map((uri, index) => (
                                    <View key={index} style={styles.imageContainer}>
                                        <TouchableOpacity onPress={() => {
                                            setCurrentImageIndex(index);
                                            setImageViewerVisible(true);
                                        }}>
                                            <Image source={{ uri }} style={styles.image} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.removeImage}
                                            onPress={() => setImages(images.filter((_, i) => i !== index))}
                                        >
                                            <Text style={styles.removeImageText}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>

                    {/* Delivery Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Delivery Location</Text>

                        <View style={styles.locationActions}>
                            <TouchableOpacity style={styles.locationButton} onPress={handleGetLocation}>
                                <Text style={styles.locationIcon}>📍</Text>
                                <Text style={styles.locationText}>
                                    {location ? 'Current Location Set' : 'Use Current Location'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.addressBookButton} onPress={handleSelectAddress}>
                                <Text style={styles.locationIcon}>📖</Text>
                                <Text style={styles.addressBookText}>Address Book</Text>
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder="Or enter address manually"
                            placeholderTextColor={Colors.dark.textMuted}
                            value={deliveryAddress}
                            onChangeText={setDeliveryAddress}
                        />

                        {deliveryFee !== null && (
                            <View style={styles.feePreview}>
                                <Text style={styles.feeLabel}>Estimated Delivery Fee</Text>
                                <Text style={styles.feeAmount}>{deliveryFee} QAR</Text>
                            </View>
                        )}
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={isLoading}
                    >
                        <LinearGradient
                            colors={Colors.gradients.primary}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.submitGradient}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.submitText}>Submit Request</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    <View style={{ height: 100 }} />
                </ScrollView>
            </KeyboardAvoidingView>



            {/* Image Viewer */}
            <ImageViewerModal
                visible={imageViewerVisible}
                images={images}
                imageIndex={currentImageIndex}
                onClose={() => setImageViewerVisible(false)}
            />
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
    closeButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 20,
    },
    closeText: { fontSize: 18, color: Colors.dark.text },
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.dark.text, letterSpacing: -0.5 },
    scrollView: { flex: 1, padding: Spacing.lg },
    section: {
        marginBottom: Spacing.lg,
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        ...Shadows.sm,
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.dark.text,
        marginBottom: Spacing.md,
    },
    row: { flexDirection: 'row', gap: Spacing.md },
    halfInput: { flex: 1 },
    inputLabel: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.xs,
    },
    inputHint: {
        fontSize: FontSizes.xs,
        color: Colors.dark.textMuted,
        marginBottom: Spacing.sm,
        fontStyle: 'italic',
    },
    input: {
        backgroundColor: '#F8F9FA',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        fontSize: FontSizes.md,
        color: Colors.dark.text,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        marginBottom: Spacing.md,
    },
    textArea: { minHeight: 80, textAlignVertical: 'top' },

    // VIN Specific Styles
    vinContainer: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    vinInput: {
        flex: 1,
        backgroundColor: '#F8F9FA',
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: FontSizes.md,
        color: Colors.dark.text,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        minHeight: 52,
        textAlignVertical: 'center',
    },
    scanButton: { height: 50, borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.sm },
    scanButtonGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, height: '100%' },
    scanIcon: { fontSize: 20, marginRight: Spacing.xs },
    scanText: { color: '#fff', fontWeight: '700', fontSize: FontSizes.sm },

    conditionRow: { flexDirection: 'row', gap: Spacing.sm },
    conditionButton: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        backgroundColor: '#F8F9FA',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#E8E8E8',
    },
    conditionButtonActive: {
        backgroundColor: Colors.primary + '15',
        borderColor: Colors.primary,
    },
    conditionText: { fontSize: FontSizes.md, color: Colors.dark.textSecondary, fontWeight: '500' },
    conditionTextActive: { color: Colors.primary, fontWeight: '700' },
    imageActions: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
    imageButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8F9FA',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    imageButtonIcon: { fontSize: 20, marginRight: Spacing.sm },
    imageButtonText: { fontSize: FontSizes.md, color: Colors.dark.text, fontWeight: '500' },
    imagePreview: { flexDirection: 'row' },
    imageContainer: { marginRight: Spacing.sm, position: 'relative' },
    image: { width: 80, height: 80, borderRadius: BorderRadius.md },
    removeImage: {
        position: 'absolute',
        top: -8,
        right: -8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.error,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.sm,
    },
    removeImageText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    locationActions: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
    locationButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary + '15',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    addressBookButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8F9FA',
        borderWidth: 1,
        borderColor: '#E8E8E8',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
    },
    addressBookText: { fontSize: FontSizes.md, color: Colors.dark.text, fontWeight: '600' },
    locationIcon: { fontSize: 20, marginRight: Spacing.sm },
    locationText: { fontSize: FontSizes.md, color: Colors.primary, fontWeight: '600' },
    feePreview: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: '#4CAF50',
    },
    feeLabel: { fontSize: FontSizes.md, color: Colors.dark.text },
    feeAmount: { fontSize: FontSizes.xl, fontWeight: '800', color: '#4CAF50' },
    submitButton: { borderRadius: BorderRadius.xl, overflow: 'hidden', marginTop: Spacing.md, ...Shadows.md },
    submitButtonDisabled: { opacity: 0.7 },
    submitGradient: { paddingVertical: Spacing.lg, alignItems: 'center' },
    submitText: { fontSize: FontSizes.lg, fontWeight: '800', color: '#fff' },
});
