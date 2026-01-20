import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { api, Address } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { MapLocationPicker } from '../components/MapLocationPicker';

type AddressScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
const { width } = Dimensions.get('window');

// Popular Qatar Areas for Quick-Pick
const QATAR_ZONES = [
    { name: 'Al Sadd', lat: 25.2632, lng: 51.5230 },
    { name: 'The Pearl', lat: 25.3716, lng: 51.5513 },
    { name: 'West Bay', lat: 25.3235, lng: 51.5310 },
    { name: 'Lusail', lat: 25.4300, lng: 51.4900 },
    { name: 'Al Wakra', lat: 25.1659, lng: 51.6036 },
    { name: 'Al Rayyan', lat: 25.2919, lng: 51.4244 },
    { name: 'Al Duhail', lat: 25.3100, lng: 51.4700 },
    { name: 'Industrial Area', lat: 25.1800, lng: 51.4500 },
];

export default function AddressBookScreen() {
    const navigation = useNavigation<AddressScreenNavigationProp>();
    const route = useRoute();
    const params = route.params as { onSelect?: (address: Address) => void } | undefined;
    const isSelectionMode = !!params?.onSelect;
    const { colors } = useTheme();

    const [addresses, setAddresses] = useState<Address[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Add/Edit Flow State
    const [showAddFlow, setShowAddFlow] = useState(false);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);
    const [flowStep, setFlowStep] = useState<'map' | 'details'>('map');

    // Location State
    const [selectedLocation, setSelectedLocation] = useState<{
        latitude: number;
        longitude: number;
        address: string;
    } | null>(null);

    // Form State
    const [label, setLabel] = useState('');
    const [addressText, setAddressText] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isDetectingGPS, setIsDetectingGPS] = useState(false);

    useEffect(() => {
        loadAddresses();
    }, []);

    const loadAddresses = async () => {
        try {
            setIsLoading(true);
            const data = await api.getAddresses();
            setAddresses(data.addresses || []);
        } catch (error) {
            Alert.alert('Error', 'Failed to load addresses');
        } finally {
            setIsLoading(false);
        }
    };

    // Start Add Address Flow
    const handleStartAdd = () => {
        setEditingAddress(null);
        setLabel('');
        setAddressText('');
        setSelectedLocation(null);
        setFlowStep('map');
        setShowAddFlow(true);
    };

    // Start Edit Address Flow
    const handleEdit = (address: Address) => {
        setEditingAddress(address);
        setLabel(address.label);
        setAddressText(address.address_text);
        // Parse coordinates as floats - DB returns strings
        const lat = address.latitude ? parseFloat(String(address.latitude)) : 25.2854;
        const lng = address.longitude ? parseFloat(String(address.longitude)) : 51.5310;
        setSelectedLocation({
            latitude: lat,
            longitude: lng,
            address: address.address_text,
        });
        setFlowStep('map');
        setShowAddFlow(true);
    };

    // Handle Map Location Selection
    const handleLocationSelect = (location: { latitude: number; longitude: number; address: string }) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSelectedLocation(location);
        setAddressText(location.address);
        setFlowStep('details');
    };

    // Quick GPS Detection
    const handleQuickGPS = async () => {
        try {
            setIsDetectingGPS(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Please enable location access in settings.');
                return;
            }

            // Use Balanced accuracy with 5s timeout
            const locationPromise = Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('GPS Timeout')), 5000)
            );

            const loc = await Promise.race([locationPromise, timeoutPromise]);

            const [geocoded] = await Location.reverseGeocodeAsync({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
            });

            const area = geocoded?.district || geocoded?.subregion || geocoded?.name || '';
            const city = geocoded?.city || 'Doha';
            const street = geocoded?.street || '';
            const addressStr = `${street}, ${area}, ${city}`.replace(/^, /, '').trim();

            setSelectedLocation({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                address: addressStr,
            });
            setAddressText(addressStr);
            setFlowStep('details');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.log('[GPS] Detection failed:', error);
            Alert.alert('GPS Failed', 'Could not detect location. Please select on map.');
        } finally {
            setIsDetectingGPS(false);
        }
    };

    // Quick-Pick Zone Selection
    const handleZoneSelect = (zone: typeof QATAR_ZONES[0]) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedLocation({
            latitude: zone.lat,
            longitude: zone.lng,
            address: `${zone.name}, Doha, Qatar`,
        });
        setAddressText(`${zone.name}, Doha, Qatar`);
        setFlowStep('details');
    };

    // Save Address
    const handleSaveAddress = async () => {
        if (!label.trim()) {
            Alert.alert('Missing Label', 'Please add a label (e.g., Home, Office)');
            return;
        }
        if (!addressText.trim()) {
            Alert.alert('Missing Address', 'Please enter an address');
            return;
        }
        if (!selectedLocation) {
            Alert.alert('No Location', 'Please select a location on the map');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                label: label.trim(),
                address_text: addressText.trim(),
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
            };

            if (editingAddress) {
                await api.updateAddress(editingAddress.address_id, payload);
            } else {
                await api.addAddress(payload);
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowAddFlow(false);
            loadAddresses();
        } catch (error: any) {
            console.log('Save address error:', error);
            Alert.alert('Error', error?.message || 'Failed to save address');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCloseFlow = () => {
        setShowAddFlow(false);
        setEditingAddress(null);
        setSelectedLocation(null);
        setLabel('');
        setAddressText('');
        setFlowStep('map');
    };

    const handleDelete = async (id: string) => {
        Alert.alert('Delete Address', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await api.deleteAddress(id);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        loadAddresses();
                    } catch (error) {
                        Alert.alert('Error', 'Failed to delete');
                    }
                }
            }
        ]);
    };

    const handleSelect = (address: Address) => {
        if (params?.onSelect) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            params.onSelect(address);
            navigation.goBack();
        }
    };

    const renderAddressCard = ({ item }: { item: Address }) => (
        <TouchableOpacity
            style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
                item.is_default && styles.defaultCard
            ]}
            onPress={() => isSelectionMode ? handleSelect(item) : null}
            disabled={!isSelectionMode}
            activeOpacity={isSelectionMode ? 0.7 : 1}
        >
            <View style={styles.cardIcon}>
                <Text style={styles.cardIconText}>
                    {item.label?.toLowerCase().includes('home') ? '🏠' :
                        item.label?.toLowerCase().includes('office') ? '🏢' :
                            item.label?.toLowerCase().includes('work') ? '💼' : '📍'}
                </Text>
            </View>
            <View style={{ flex: 1 }}>
                <View style={styles.cardHeader}>
                    <Text style={[styles.label, { color: colors.text }]}>{item.label}</Text>
                    {item.is_default && <Text style={styles.defaultBadge}>Default</Text>}
                </View>
                <Text style={[styles.addressText, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.address_text}
                </Text>
                {item.latitude && item.longitude && (
                    <Text style={styles.coordsText}>
                        📍 {parseFloat(String(item.latitude)).toFixed(4)}, {parseFloat(String(item.longitude)).toFixed(4)}
                    </Text>
                )}
            </View>

            {!isSelectionMode && (
                <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => handleEdit(item)} style={styles.editButton}>
                        <Text style={styles.editText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.address_id)} style={styles.deleteButton}>
                        <Text style={styles.deleteText}>✕</Text>
                    </TouchableOpacity>
                </View>
            )}
        </TouchableOpacity>
    );

    // ============================================
    // MAP SELECTION STEP
    // ============================================
    const renderMapStep = () => (
        <View style={styles.mapStepContainer}>
            {/* Header */}
            <View style={[styles.flowHeader, { backgroundColor: colors.surface }]}>
                <TouchableOpacity onPress={handleCloseFlow} style={styles.flowBackBtn}>
                    <Text style={styles.flowBackText}>✕</Text>
                </TouchableOpacity>
                <Text style={[styles.flowTitle, { color: colors.text }]}>
                    {editingAddress ? 'Edit Location' : 'Select Location'}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Quick Actions */}
            <View style={[styles.quickActionsBar, { backgroundColor: colors.surface }]}>
                <TouchableOpacity
                    style={[styles.quickActionBtn, { backgroundColor: '#22C55E20' }]}
                    onPress={handleQuickGPS}
                    disabled={isDetectingGPS}
                >
                    {isDetectingGPS ? (
                        <ActivityIndicator color="#22C55E" size="small" />
                    ) : (
                        <>
                            <Text style={styles.quickActionIcon}>📍</Text>
                            <Text style={[styles.quickActionText, { color: '#22C55E' }]}>Use GPS</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Quick-Pick Zones */}
            <View style={[styles.zonesContainer, { backgroundColor: colors.background }]}>
                <Text style={[styles.zonesTitle, { color: colors.textSecondary }]}>
                    🏙️ Popular Areas
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {QATAR_ZONES.map((zone) => (
                        <TouchableOpacity
                            key={zone.name}
                            style={[styles.zoneChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            onPress={() => handleZoneSelect(zone)}
                        >
                            <Text style={[styles.zoneChipText, { color: colors.text }]}>{zone.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Map */}
            <View style={styles.mapContainer}>
                <MapLocationPicker
                    onLocationSelect={handleLocationSelect}
                    onCancel={handleCloseFlow}
                    initialLocation={selectedLocation || (editingAddress?.latitude ? {
                        latitude: parseFloat(String(editingAddress.latitude)),
                        longitude: parseFloat(String(editingAddress.longitude)),
                    } : undefined)}
                />
            </View>
        </View>
    );

    // ============================================
    // DETAILS/CONFIRM STEP
    // ============================================
    const renderDetailsStep = () => (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.detailsContainer}
        >
            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                {/* Header */}
                <View style={[styles.flowHeader, { backgroundColor: colors.surface }]}>
                    <TouchableOpacity onPress={() => setFlowStep('map')} style={styles.flowBackBtn}>
                        <Text style={styles.flowBackText}>←</Text>
                    </TouchableOpacity>
                    <Text style={[styles.flowTitle, { color: colors.text }]}>Confirm Address</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Location Preview Card */}
                <View style={[styles.previewCard, { backgroundColor: colors.surface }]}>
                    <LinearGradient
                        colors={Colors.gradients.primary as [string, string]}
                        style={styles.previewGradient}
                    >
                        <Text style={styles.previewIcon}>📍</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.previewLabel}>Selected Location</Text>
                            <Text style={styles.previewAddress} numberOfLines={2}>
                                {addressText || 'No address'}
                            </Text>
                            {selectedLocation && (
                                <Text style={styles.previewCoords}>
                                    {selectedLocation.latitude.toFixed(5)}, {selectedLocation.longitude.toFixed(5)}
                                </Text>
                            )}
                        </View>
                    </LinearGradient>
                    <TouchableOpacity
                        style={styles.changeLocationBtn}
                        onPress={() => setFlowStep('map')}
                    >
                        <Text style={styles.changeLocationText}>Change Location</Text>
                    </TouchableOpacity>
                </View>

                {/* Form */}
                <View style={[styles.formContainer, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                        Label *
                    </Text>
                    <View style={styles.labelChips}>
                        {['Home', 'Office', 'Work', 'Other'].map((preset) => (
                            <TouchableOpacity
                                key={preset}
                                style={[
                                    styles.labelChip,
                                    { backgroundColor: colors.background, borderColor: colors.border },
                                    label === preset && styles.labelChipActive
                                ]}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setLabel(preset);
                                }}
                            >
                                <Text style={[
                                    styles.labelChipText,
                                    { color: label === preset ? '#fff' : colors.text }
                                ]}>
                                    {preset === 'Home' ? '🏠' : preset === 'Office' ? '🏢' : preset === 'Work' ? '💼' : '📍'} {preset}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                        value={label}
                        onChangeText={setLabel}
                        placeholder="Or type custom label..."
                        placeholderTextColor={colors.textMuted}
                    />

                    <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: Spacing.lg }]}>
                        Full Address
                    </Text>
                    <TextInput
                        style={[styles.input, styles.addressInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                        value={addressText}
                        onChangeText={setAddressText}
                        placeholder="Street, Building, Zone..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={3}
                    />
                </View>

                {/* Save Button */}
                <View style={styles.saveContainer}>
                    <TouchableOpacity
                        style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
                        onPress={handleSaveAddress}
                        disabled={isSaving}
                    >
                        <LinearGradient
                            colors={Colors.gradients.primary as [string, string]}
                            style={styles.saveGradient}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveText}>
                                    {editingAddress ? '✓ Update Address' : '✓ Save Address'}
                                </Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.background }]}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]}>
                    {isSelectionMode ? 'Select Address' : 'Address Book'}
                </Text>
                <TouchableOpacity onPress={handleStartAdd} style={styles.addButton}>
                    <LinearGradient colors={Colors.gradients.primary as [string, string]} style={styles.addGradient}>
                        <Text style={styles.addText}>+</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* Address List */}
            {isLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={addresses}
                    renderItem={renderAddressCard}
                    keyExtractor={item => item.address_id}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyEmoji}>📍</Text>
                            <Text style={styles.emptyText}>No addresses saved yet</Text>
                            <TouchableOpacity onPress={handleStartAdd} style={styles.emptyButton}>
                                <Text style={styles.emptyButtonText}>+ Add Your First Address</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            {/* Add/Edit Flow Modal */}
            <Modal visible={showAddFlow} animationType="slide">
                <SafeAreaView style={[styles.flowContainer, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
                    {flowStep === 'map' ? renderMapStep() : renderDetailsStep()}
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: Spacing.sm,
        borderRadius: BorderRadius.md,
    },
    backText: { color: Colors.primary, fontSize: FontSizes.md, fontWeight: '600' },
    title: { fontSize: FontSizes.xl, fontWeight: '800', letterSpacing: -0.5 },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
    },
    addGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addText: { fontSize: 24, color: '#fff', fontWeight: '700' },
    list: { padding: Spacing.lg, paddingBottom: 100 },

    // Address Card
    card: {
        flexDirection: 'row',
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        marginBottom: Spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        ...Shadows.sm,
    },
    defaultCard: { borderColor: Colors.primary, borderWidth: 2 },
    cardIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    cardIconText: { fontSize: 22 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    label: { fontSize: FontSizes.md, fontWeight: '700', marginRight: Spacing.sm },
    defaultBadge: {
        fontSize: 10,
        color: Colors.primary,
        backgroundColor: Colors.primary + '15',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: BorderRadius.full,
        fontWeight: '600',
    },
    addressText: { fontSize: FontSizes.sm, lineHeight: 20 },
    coordsText: { fontSize: 10, color: '#9CA3AF', marginTop: 4 },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    editButton: { padding: Spacing.sm },
    editText: { fontSize: 18 },
    deleteButton: { padding: Spacing.sm },
    deleteText: { color: Colors.error, fontSize: 18, fontWeight: '700' },

    // Empty State
    emptyContainer: { alignItems: 'center', paddingTop: 60 },
    emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
    emptyText: { fontSize: FontSizes.md, color: '#737373', marginBottom: Spacing.lg },
    emptyButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
    },
    emptyButtonText: { color: '#fff', fontWeight: '700', fontSize: FontSizes.md },

    // Flow Container
    flowContainer: { flex: 1 },
    flowHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    flowBackBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    flowBackText: { fontSize: 18, color: Colors.primary, fontWeight: '700' },
    flowTitle: { fontSize: FontSizes.lg, fontWeight: '800' },

    // Map Step
    mapStepContainer: { flex: 1 },
    quickActionsBar: {
        flexDirection: 'row',
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    quickActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        borderRadius: BorderRadius.lg,
        gap: Spacing.xs,
    },
    quickActionIcon: { fontSize: 18 },
    quickActionText: { fontWeight: '700', fontSize: FontSizes.sm },
    zonesContainer: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    zonesTitle: {
        fontSize: FontSizes.xs,
        fontWeight: '600',
        marginBottom: Spacing.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    zoneChip: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.lg,
        marginRight: Spacing.sm,
        borderWidth: 1,
    },
    zoneChipText: { fontWeight: '600', fontSize: FontSizes.sm },
    mapContainer: { flex: 1 },

    // Details Step
    detailsContainer: { flex: 1 },
    previewCard: {
        margin: Spacing.lg,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.md,
    },
    previewGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    previewIcon: { fontSize: 32 },
    previewLabel: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
    previewAddress: { fontSize: FontSizes.md, color: '#fff', fontWeight: '700' },
    previewCoords: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
    changeLocationBtn: {
        padding: Spacing.md,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    changeLocationText: { color: Colors.primary, fontWeight: '600', fontSize: FontSizes.sm },

    formContainer: {
        marginHorizontal: Spacing.lg,
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        ...Shadows.sm,
    },
    inputLabel: { marginBottom: Spacing.xs, fontSize: FontSizes.sm, fontWeight: '600' },
    labelChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    labelChip: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
    },
    labelChipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    labelChipText: { fontWeight: '600', fontSize: FontSizes.sm },
    input: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        fontSize: FontSizes.md,
    },
    addressInput: {
        minHeight: 80,
        textAlignVertical: 'top',
    },

    saveContainer: {
        padding: Spacing.lg,
        paddingBottom: Spacing.xxl,
    },
    saveButton: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        ...Shadows.md,
    },
    saveGradient: {
        padding: Spacing.lg,
        alignItems: 'center',
    },
    saveText: { color: '#fff', fontWeight: '800', fontSize: FontSizes.lg },
});
