import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Image,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useTheme } from '../contexts';
import { requestApi, api } from '../services';
import { Spacing, BorderRadius, FontSize, Shadows, PART_CATEGORIES, CAR_MAKES } from '../constants';

const HomeScreen: React.FC = () => {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(false);

    // Form state
    const [carMake, setCarMake] = useState('');
    const [carModel, setCarModel] = useState('');
    const [carYear, setCarYear] = useState('');
    const [vinNumber, setVinNumber] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [partDescription, setPartDescription] = useState('');
    const [partNumber, setPartNumber] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [images, setImages] = useState<string[]>([]);

    // Saved addresses
    const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
    const [loadingLocation, setLoadingLocation] = useState(false);

    useEffect(() => {
        loadSavedAddresses();
    }, []);

    const loadSavedAddresses = async () => {
        try {
            const data = await api.getAddresses();
            setSavedAddresses(data.addresses || []);
        } catch (error) {
            console.log('No saved addresses');
        }
    };

    const useCurrentLocation = async () => {
        try {
            setLoadingLocation(true);
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please enable location access');
                return;
            }

            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            const addr = await Location.reverseGeocodeAsync(location.coords);

            if (addr.length > 0) {
                const a = addr[0];
                const formatted = [a.street, a.district, a.city, 'Qatar'].filter(Boolean).join(', ');
                setDeliveryAddress(formatted || 'Current Location');
            }
        } catch (error) {
            Alert.alert('Error', 'Could not get current location');
        } finally {
            setLoadingLocation(false);
        }
    };

    const pickImages = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant photo library access');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.7,
            selectionLimit: 5,
        });

        if (!result.canceled) {
            setImages(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 5));
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!carMake || !carModel || !carYear || !selectedCategory || !partDescription || !deliveryAddress) {
            Alert.alert('Error', 'Please fill all required fields');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('car_make', carMake);
            formData.append('car_model', carModel);
            formData.append('car_year', carYear);
            formData.append('vin_number', vinNumber);
            formData.append('part_category', selectedCategory);
            formData.append('part_description', partDescription);
            formData.append('part_number', partNumber);
            formData.append('delivery_address', deliveryAddress);

            images.forEach((uri, index) => {
                formData.append('images', {
                    uri,
                    type: 'image/jpeg',
                    name: `image_${index}.jpg`,
                } as any);
            });

            await requestApi.create(formData);
            Alert.alert('Success! 🎉', 'Your request has been submitted. You will receive bids from garages soon.');

            // Reset form
            setCarMake(''); setCarModel(''); setCarYear(''); setVinNumber('');
            setSelectedCategory(''); setPartDescription(''); setPartNumber('');
            setDeliveryAddress(''); setImages([]);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to submit request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.text }]}>Request a Part</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Get quotes from verified garages
                    </Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    {/* Vehicle Section */}
                    <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.md]}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="car-outline" size={22} color={colors.primary} />
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Vehicle Info</Text>
                        </View>

                        <View style={styles.row}>
                            <View style={styles.halfInput}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>Make *</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border }]}
                                    placeholder="e.g. Toyota"
                                    placeholderTextColor={colors.textMuted}
                                    value={carMake}
                                    onChangeText={setCarMake}
                                />
                            </View>
                            <View style={styles.halfInput}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>Model *</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border }]}
                                    placeholder="e.g. Camry"
                                    placeholderTextColor={colors.textMuted}
                                    value={carModel}
                                    onChangeText={setCarModel}
                                />
                            </View>
                        </View>

                        <View style={styles.row}>
                            <View style={styles.halfInput}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>Year *</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border }]}
                                    placeholder="2020"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="number-pad"
                                    value={carYear}
                                    onChangeText={setCarYear}
                                    maxLength={4}
                                />
                            </View>
                            <View style={styles.halfInput}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>VIN</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border }]}
                                    placeholder="17 chars"
                                    placeholderTextColor={colors.textMuted}
                                    value={vinNumber}
                                    onChangeText={setVinNumber}
                                    maxLength={17}
                                    autoCapitalize="characters"
                                />
                            </View>
                        </View>
                    </View>

                    {/* Category Section */}
                    <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.md]}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="grid-outline" size={22} color={colors.primary} />
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Category *</Text>
                        </View>
                        <View style={styles.categoryGrid}>
                            {PART_CATEGORIES.map(cat => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[
                                        styles.categoryItem,
                                        { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                                        selectedCategory === cat.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                                    ]}
                                    onPress={() => setSelectedCategory(cat.id)}
                                >
                                    <Ionicons
                                        name={cat.icon as any}
                                        size={24}
                                        color={selectedCategory === cat.id ? '#fff' : colors.textSecondary}
                                    />
                                    <Text style={[
                                        styles.categoryText,
                                        { color: selectedCategory === cat.id ? '#fff' : colors.text }
                                    ]}>
                                        {cat.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Part Details */}
                    <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.md]}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="construct-outline" size={22} color={colors.primary} />
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Part Details</Text>
                        </View>

                        <Text style={[styles.label, { color: colors.textSecondary }]}>Description *</Text>
                        <TextInput
                            style={[styles.textArea, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border }]}
                            placeholder="Describe the part you need..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={4}
                            value={partDescription}
                            onChangeText={setPartDescription}
                            textAlignVertical="top"
                        />

                        <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.md }]}>Part Number (optional)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border }]}
                            placeholder="OEM part number"
                            placeholderTextColor={colors.textMuted}
                            value={partNumber}
                            onChangeText={setPartNumber}
                        />
                    </View>

                    {/* Images */}
                    <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.md]}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="images-outline" size={22} color={colors.primary} />
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Photos</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.imageUpload, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                            onPress={pickImages}
                        >
                            <Ionicons name="cloud-upload-outline" size={32} color={colors.primary} />
                            <Text style={[styles.uploadText, { color: colors.textSecondary }]}>Tap to upload (max 5)</Text>
                        </TouchableOpacity>

                        {images.length > 0 && (
                            <View style={styles.imageGrid}>
                                {images.map((uri, index) => (
                                    <View key={index} style={styles.imageWrapper}>
                                        <Image source={{ uri }} style={styles.imagePreview} />
                                        <TouchableOpacity style={styles.removeImage} onPress={() => removeImage(index)}>
                                            <Ionicons name="close-circle" size={24} color={colors.danger} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Delivery */}
                    <View style={[styles.section, { backgroundColor: colors.surface }, Shadows.md]}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="location-outline" size={22} color={colors.primary} />
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Delivery *</Text>
                        </View>

                        {/* Quick Select Saved Addresses */}
                        {savedAddresses.length > 0 && (
                            <View style={styles.quickAddressContainer}>
                                <Text style={[styles.quickAddressLabel, { color: colors.textSecondary }]}>Quick Select:</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.addressChips}>
                                    {savedAddresses.slice(0, 3).map((addr: any) => (
                                        <TouchableOpacity
                                            key={addr.address_id}
                                            style={[
                                                styles.addressChip,
                                                { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                                                deliveryAddress === addr.address_text && { backgroundColor: colors.primary + '20', borderColor: colors.primary }
                                            ]}
                                            onPress={() => setDeliveryAddress(addr.address_text)}
                                        >
                                            <Ionicons
                                                name={addr.label.toLowerCase().includes('home') ? 'home' : addr.label.toLowerCase().includes('work') ? 'briefcase' : 'location'}
                                                size={14}
                                                color={deliveryAddress === addr.address_text ? colors.primary : colors.textSecondary}
                                            />
                                            <Text style={[styles.addressChipText, { color: deliveryAddress === addr.address_text ? colors.primary : colors.text }]}>
                                                {addr.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Current Location Button */}
                        <TouchableOpacity
                            style={[styles.locationButton, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}
                            onPress={useCurrentLocation}
                            disabled={loadingLocation}
                        >
                            {loadingLocation ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Ionicons name="navigate" size={18} color={colors.primary} />
                            )}
                            <Text style={[styles.locationButtonText, { color: colors.primary }]}>
                                Use Current Location
                            </Text>
                        </TouchableOpacity>

                        <TextInput
                            style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border, marginTop: Spacing.sm }]}
                            placeholder="Street, Building, Zone, Area"
                            placeholderTextColor={colors.textMuted}
                            value={deliveryAddress}
                            onChangeText={setDeliveryAddress}
                        />
                    </View>

                    {/* Submit */}
                    <TouchableOpacity
                        style={[styles.submitButton, { backgroundColor: colors.primary }]}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="send" size={20} color="#fff" />
                                <Text style={styles.submitText}>Submit Request</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: Spacing.xl, paddingBottom: Spacing.md },
    title: { fontSize: FontSize.xxl, fontWeight: '700' },
    subtitle: { fontSize: FontSize.md, marginTop: Spacing.xs },
    form: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    section: { borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg, gap: Spacing.sm },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: '600' },
    row: { flexDirection: 'row', gap: Spacing.md },
    halfInput: { flex: 1 },
    label: { fontSize: FontSize.sm, fontWeight: '600', marginBottom: Spacing.xs },
    input: { height: 48, borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg, fontSize: FontSize.md },
    textArea: { height: 100, borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.lg, fontSize: FontSize.md },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    categoryItem: {
        width: '23%', aspectRatio: 1, borderRadius: BorderRadius.md, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
    },
    categoryText: { fontSize: FontSize.xs, fontWeight: '500', textAlign: 'center' },
    imageUpload: {
        height: 100, borderRadius: BorderRadius.md, borderWidth: 2, borderStyle: 'dashed',
        alignItems: 'center', justifyContent: 'center',
    },
    uploadText: { marginTop: Spacing.xs, fontSize: FontSize.sm },
    imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
    imageWrapper: { position: 'relative' },
    imagePreview: { width: 70, height: 70, borderRadius: BorderRadius.sm },
    removeImage: { position: 'absolute', top: -8, right: -8 },
    submitButton: {
        flexDirection: 'row', height: 56, borderRadius: BorderRadius.lg,
        alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.md,
    },
    submitText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '600' },
    // Quick Address Select
    quickAddressContainer: { marginBottom: Spacing.sm },
    quickAddressLabel: { fontSize: FontSize.xs, fontWeight: '600', marginBottom: Spacing.xs },
    addressChips: { flexDirection: 'row' },
    addressChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full, borderWidth: 1, marginRight: Spacing.sm,
    },
    addressChipText: { fontSize: FontSize.sm, fontWeight: '500' },
    // Location Button
    locationButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1,
    },
    locationButtonText: { fontSize: FontSize.sm, fontWeight: '600' },
});

export default HomeScreen;
