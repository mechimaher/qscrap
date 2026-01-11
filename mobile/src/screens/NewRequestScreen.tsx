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
import { Colors, Spacing, BorderRadius, FontSizes, Shadows, Colors as ThemeColors } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../components/Toast';
import { DEFAULT_DELIVERY_FEE } from '../constants/config';
import SearchableDropdown from '../components/SearchableDropdown';

import ImageViewerModal from '../components/ImageViewerModal';
import VINDecoder, { DecodedVIN } from '../components/VINDecoder';
import { CAR_MAKES, CAR_MODELS, YEARS } from '../constants/carData';
import { Address } from '../services/api';
import { PART_CATEGORIES, PART_SUBCATEGORIES } from '../constants/categoryData';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function NewRequestScreen() {
    const navigation = useNavigation<NavigationProp>();
    const { colors } = useTheme();
    const toast = useToast();

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
                toast.error('Permission Denied', 'Location permission is required for delivery');
                return;
            }

            const loc = await Location.getCurrentPositionAsync({});
            setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });

            // Calculate delivery fee
            const feeData = await api.calculateDeliveryFee(loc.coords.latitude, loc.coords.longitude);
            if (feeData.success) {
                setDeliveryFee(feeData.delivery_fee);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                setDeliveryFee(DEFAULT_DELIVERY_FEE);
            }

            // Reverse geocode (simplified)
            const address = await Location.reverseGeocodeAsync(loc.coords);
            if (address.length > 0) {
                const a = address[0];
                setDeliveryAddress(`${a.street || ''} ${a.city || ''}, Qatar`.trim());
            }
        } catch (error) {
            console.log('Location error:', error);
            toast.error('Error', 'Failed to get location');
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
                            setDeliveryFee(DEFAULT_DELIVERY_FEE);
                            toast.info('Note', `Using standard delivery fee (${DEFAULT_DELIVERY_FEE} QAR)`);
                        }
                    } catch (error) {
                        console.log('[NewRequest] Fee calculation error:', error);
                        setDeliveryFee(DEFAULT_DELIVERY_FEE);
                        toast.info('Note', `Using standard delivery fee (${DEFAULT_DELIVERY_FEE} QAR)`);
                    }
                } else {
                    // No coordinates - use default fee
                    setDeliveryFee(DEFAULT_DELIVERY_FEE);
                    toast.info('Note', `Address has no coordinates. Using standard delivery fee (${DEFAULT_DELIVERY_FEE} QAR)`);
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
            toast.error('Permission Denied', 'Camera permission is required');
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
            toast.error('Vehicle Info Missing', 'Please specify the vehicle details.');
            return;
        }

        if (!partCategory && !partDescription) {
            toast.error('Missing Fields', 'Please select a part category or describe the part.');
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
            toast.error('Missing Description', 'Please describe the part you need.');
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
                toast.success('Success!', 'Your request has been submitted. Garages will send bids soon!');
                setTimeout(() => {
                    navigation.goBack();
                }, 1500);
            } else {
                throw new Error(result.error || 'Failed to submit');
            }
        } catch (error: any) {
            toast.error('Error', error.message || 'Failed to submit request');
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
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                {/* Header */}
                <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.closeButton, { backgroundColor: colors.background }]}>
                        <Text style={[styles.closeText, { color: colors.text }]}>✕</Text>
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>New Part Request</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

                    {/* Vehicle Metadata */}
                    <View style={[styles.section, { backgroundColor: colors.surface }]}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionIcon}>🚗</Text>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Vehicle Information</Text>
                            <View style={[styles.requiredBadge, { backgroundColor: colors.primary + '15' }]}>
                                <Text style={[styles.requiredText, { color: colors.primary }]}>REQUIRED</Text>
                            </View>
                        </View>

                        {/* VIN Decoder - FIRST to guide customers */}
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

                        {/* Divider with OR */}
                        <View style={styles.orDivider}>
                            <View style={[styles.orLine, { backgroundColor: colors.border }]} />
                            <Text style={[styles.orText, { color: colors.textMuted }]}>OR ENTER MANUALLY</Text>
                            <View style={[styles.orLine, { backgroundColor: colors.border }]} />
                        </View>

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

                        {/* Model - with allowCustom for manual entry */}
                        <SearchableDropdown
                            label="Model *"
                            placeholder={carMake ? "Select or type model" : "Select Make first"}
                            items={availableModels}
                            value={carModel}
                            onSelect={setCarModel}
                            disabled={!carMake}
                        />
                        <Text style={[styles.modelHint, { color: colors.textSecondary }]}>💡 Can't find your model? Just type it above</Text>
                    </View>

                    {/* Part Details - Enhanced with Categories */}
                    <View style={[styles.section, { backgroundColor: colors.surface }]}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionIcon}>🔧</Text>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Part Details</Text>
                        </View>

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

                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Descriptions *</Text>
                        <TextInput
                            style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            placeholder="Additional details (e.g. left side, color...)"
                            placeholderTextColor={colors.textMuted}
                            value={partDescription}
                            onChangeText={setPartDescription}
                            multiline
                            numberOfLines={3}
                        />

                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Part Number (Optional)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            placeholder="OEM part number"
                            placeholderTextColor={colors.textMuted}
                            value={partNumber}
                            onChangeText={setPartNumber}
                        />

                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Condition Required</Text>
                        <View style={styles.conditionRow}>
                            {conditions.map(c => (
                                <TouchableOpacity
                                    key={c.value}
                                    style={[
                                        styles.conditionButton,
                                        { backgroundColor: colors.background, borderColor: colors.border },
                                        condition === c.value && { backgroundColor: colors.primary + '15', borderColor: colors.primary }
                                    ]}
                                    onPress={() => {
                                        setCondition(c.value);
                                        Haptics.selectionAsync();
                                    }}
                                >
                                    <Text style={[
                                        styles.conditionText,
                                        { color: colors.textSecondary },
                                        condition === c.value && { color: colors.primary, fontWeight: '700' }
                                    ]}>{c.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Images Section */}
                    <View style={[styles.section, { backgroundColor: colors.surface }]}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionIcon}>📷</Text>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Photos</Text>
                            <View style={[styles.optionalTag, { backgroundColor: colors.background }]}>
                                <Text style={[styles.optionalTagText, { color: colors.textSecondary }]}>Optional</Text>
                            </View>
                        </View>

                        <View style={styles.imageActions}>
                            <TouchableOpacity style={[styles.imageButton, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={handleTakePhoto}>
                                <Text style={styles.imageButtonIcon}>📷</Text>
                                <Text style={[styles.imageButtonText, { color: colors.text }]}>Camera</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.imageButton, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={handlePickImage}>
                                <Text style={styles.imageButtonIcon}>🖼️</Text>
                                <Text style={[styles.imageButtonText, { color: colors.text }]}>Gallery</Text>
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
                                            style={[styles.removeImage, { backgroundColor: colors.error }]}
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
                    <View style={[styles.section, { backgroundColor: colors.surface }]}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionIcon}>📦</Text>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Delivery Location</Text>
                        </View>

                        <View style={styles.locationActions}>
                            <TouchableOpacity style={[styles.locationButton, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]} onPress={handleGetLocation}>
                                <Text style={styles.locationIcon}>📍</Text>
                                <Text style={[styles.locationText, { color: colors.primary }]}>
                                    {location ? 'Current Location Set' : 'Use Current Location'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.addressBookButton, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={handleSelectAddress}>
                                <Text style={styles.locationIcon}>📖</Text>
                                <Text style={[styles.addressBookText, { color: colors.text }]}>Address Book</Text>
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            placeholder="Or enter address manually"
                            placeholderTextColor={colors.textMuted}
                            value={deliveryAddress}
                            onChangeText={setDeliveryAddress}
                        />

                        {deliveryFee !== null && (
                            <View style={[styles.feePreview, { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]}>
                                <Text style={[styles.feeLabel, { color: '#1a1a1a' }]}>Estimated Delivery Fee</Text>
                                <Text style={[styles.feeAmount, { color: '#4CAF50' }]}>{deliveryFee} QAR</Text>
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
                            colors={ThemeColors.gradients.primary}
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
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        borderBottomWidth: 1,
    },
    closeButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
    },
    closeText: { fontSize: 18 },
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '800', letterSpacing: -0.5 },
    scrollView: { flex: 1, padding: Spacing.lg },
    section: {
        marginBottom: Spacing.lg,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        ...Shadows.sm,
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    sectionIcon: {
        fontSize: 20,
        marginRight: Spacing.sm,
    },
    requiredBadge: {
        marginLeft: 'auto',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.full,
    },
    requiredText: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    optionalTag: {
        marginLeft: 'auto',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.full,
    },
    optionalTagText: {
        fontSize: 9,
        fontWeight: '600',
    },
    row: { flexDirection: 'row', gap: Spacing.md },
    halfInput: { flex: 1 },
    inputLabel: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        marginBottom: Spacing.xs,
    },
    inputHint: {
        fontSize: FontSizes.xs,
        marginBottom: Spacing.sm,
        fontStyle: 'italic',
    },
    input: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        fontSize: FontSizes.md,
        borderWidth: 1,
        marginBottom: Spacing.md,
    },
    textArea: { minHeight: 80, textAlignVertical: 'top' },

    // VIN Specific Styles
    vinContainer: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    vinInput: {
        flex: 1,
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: FontSizes.md,
        borderWidth: 1,
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
        alignItems: 'center',
        borderWidth: 2,
    },
    conditionText: { fontSize: FontSizes.md, fontWeight: '500' },
    imageActions: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
    imageButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
    },
    imageButtonIcon: { fontSize: 20, marginRight: Spacing.sm },
    imageButtonText: { fontSize: FontSizes.md, fontWeight: '500' },
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
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
    },
    addressBookButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
    },
    addressBookText: { fontSize: FontSizes.md, fontWeight: '600' },
    locationIcon: { fontSize: 20, marginRight: Spacing.sm },
    locationText: { fontSize: FontSizes.md, fontWeight: '600' },
    feePreview: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
    },
    feeLabel: { fontSize: FontSizes.md },
    feeAmount: { fontSize: FontSizes.xl, fontWeight: '800' },
    submitButton: { borderRadius: BorderRadius.xl, overflow: 'hidden', marginTop: Spacing.md, ...Shadows.md },
    submitButtonDisabled: { opacity: 0.7 },
    submitGradient: { paddingVertical: Spacing.lg, alignItems: 'center' },
    submitText: { fontSize: FontSizes.lg, fontWeight: '800', color: '#fff' },
    // OR Divider styles
    orDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.lg,
        marginBottom: Spacing.md,
    },
    orLine: {
        flex: 1,
        height: 1,
    },
    orText: {
        paddingHorizontal: Spacing.md,
        fontSize: FontSizes.xs,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    modelHint: {
        fontSize: FontSizes.xs,
        marginTop: Spacing.xs,
        fontStyle: 'italic',
    },
});
