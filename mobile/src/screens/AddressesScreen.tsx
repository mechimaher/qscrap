import React, { useState, useEffect } from 'react';
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
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { api, Address } from '../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type AddressScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AddressBookScreen() {
    const navigation = useNavigation<AddressScreenNavigationProp>();
    const route = useRoute();
    const params = route.params as { onSelect?: (address: Address) => void } | undefined;
    const isSelectionMode = !!params?.onSelect;

    const [addresses, setAddresses] = useState<Address[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);

    // Add Form State
    const [label, setLabel] = useState('');
    const [addressText, setAddressText] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadAddresses();
    }, []);

    const loadAddresses = async () => {
        try {
            setIsLoading(true);
            const data = await api.getAddresses();
            setAddresses(data.addresses);
        } catch (error) {
            Alert.alert('Error', 'Failed to load addresses');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddAddress = async () => {
        if (!label || !addressText) {
            Alert.alert('Missing Fields', 'Please fill in all fields');
            return;
        }

        setIsSaving(true);
        try {
            await api.addAddress({ label, address_text: addressText });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setLabel('');
            setAddressText('');
            setIsAdding(false);
            loadAddresses();
        } catch (error: any) {
            console.log('Add address error:', error);
            let errorMessage = 'Failed to save address';
            if (error?.message) {
                errorMessage = error.message;
            } else if (typeof error === 'object') {
                errorMessage = JSON.stringify(error);
            } else if (error) {
                errorMessage = String(error);
            }
            Alert.alert('Error', errorMessage);
        } finally {
            setIsSaving(false);
        }
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
            params.onSelect(address);
            navigation.goBack();
        }
    };

    const handleUseCurrentLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            const loc = await Location.getCurrentPositionAsync({});
            const addr = await Location.reverseGeocodeAsync(loc.coords);

            if (addr.length > 0) {
                const a = addr[0];
                setAddressText(`${a.street || ''} ${a.city || ''}, Qatar`.trim());
            }
        } catch (error) {
            console.log('Location error', error);
        }
    };

    const renderItem = ({ item }: { item: Address }) => (
        <TouchableOpacity
            style={[styles.card, item.is_default && styles.defaultCard]}
            onPress={() => isSelectionMode ? handleSelect(item) : null}
            disabled={!isSelectionMode}
        >
            <View style={{ flex: 1 }}>
                <View style={styles.cardHeader}>
                    <Text style={styles.label}>{item.label}</Text>
                    {item.is_default && <Text style={styles.defaultBadge}>Default</Text>}
                </View>
                <Text style={styles.addressText}>{item.address_text}</Text>
            </View>

            {!isSelectionMode && (
                <TouchableOpacity onPress={() => handleDelete(item.address_id)} style={styles.deleteButton}>
                    <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{isSelectionMode ? 'Select Address' : 'Address Book'}</Text>
                <TouchableOpacity onPress={() => setIsAdding(true)} style={styles.addButton}>
                    <Text style={styles.addText}>+</Text>
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={addresses}
                    renderItem={renderItem}
                    keyExtractor={item => item.address_id}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No addresses saved.</Text>
                    }
                />
            )}

            {/* Add Address Modal */}
            <Modal visible={isAdding} animationType="slide" transparent>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>New Address</Text>

                        <Text style={styles.inputLabel}>Label (e.g. Home, Office)</Text>
                        <TextInput
                            style={styles.input}
                            value={label}
                            onChangeText={setLabel}
                            placeholder="Home"
                            placeholderTextColor={Colors.dark.textMuted}
                        />

                        <Text style={styles.inputLabel}>Address</Text>
                        <View style={styles.addressRow}>
                            <TextInput
                                style={[styles.input, { flex: 1 }]}
                                value={addressText}
                                onChangeText={setAddressText}
                                placeholder="Street, City..."
                                placeholderTextColor={Colors.dark.textMuted}
                            />
                            <TouchableOpacity style={styles.locButton} onPress={handleUseCurrentLocation}>
                                <Text>📍</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity onPress={() => setIsAdding(false)} style={styles.cancelButton}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleAddAddress}
                                style={styles.saveButton}
                                disabled={isSaving}
                            >
                                <LinearGradient
                                    colors={Colors.gradients.primary}
                                    style={styles.saveGradient}
                                >
                                    {isSaving ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.saveText}>Save Address</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.dark.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderColor: Colors.dark.border },
    backButton: { padding: Spacing.sm },
    backText: { color: Colors.primary, fontSize: FontSizes.md, fontWeight: '600' },
    title: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.dark.text },
    addButton: { padding: Spacing.sm },
    addText: { fontSize: 24, color: Colors.primary, fontWeight: '700' },
    list: { padding: Spacing.lg },
    card: {
        flexDirection: 'row',
        backgroundColor: Colors.dark.surface,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    defaultCard: { borderColor: Colors.primary },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    label: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.dark.text, marginRight: Spacing.sm },
    defaultBadge: { fontSize: 10, color: Colors.primary, backgroundColor: Colors.primary + '20', paddingHorizontal: 6, borderRadius: 4 },
    addressText: { fontSize: FontSizes.sm, color: Colors.dark.textSecondary },
    deleteButton: { padding: Spacing.sm },
    deleteText: { color: Colors.error, fontSize: 18 },
    emptyText: { textAlign: 'center', color: Colors.dark.textMuted, marginTop: 50 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: Colors.dark.surface, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.xl },
    modalTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.dark.text, marginBottom: Spacing.lg },
    inputLabel: { color: Colors.dark.textSecondary, marginBottom: Spacing.xs, fontSize: FontSizes.sm },
    input: { backgroundColor: Colors.dark.background, borderRadius: BorderRadius.md, padding: Spacing.md, color: Colors.dark.text, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.dark.border },
    addressRow: { flexDirection: 'row', gap: Spacing.sm },
    locButton: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary + '20', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.primary },
    modalActions: { flexDirection: 'row', marginTop: Spacing.lg, gap: Spacing.md },
    cancelButton: { flex: 1, padding: Spacing.md, alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.dark.border },
    cancelText: { color: Colors.dark.text },
    saveButton: { flex: 2, borderRadius: BorderRadius.md, overflow: 'hidden' },
    saveGradient: { padding: Spacing.md, alignItems: 'center' },
    saveText: { color: '#fff', fontWeight: '700' },
});
