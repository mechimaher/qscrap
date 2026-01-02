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
import { useTheme } from '../contexts/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type AddressScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AddressBookScreen() {
    const navigation = useNavigation<AddressScreenNavigationProp>();
    const route = useRoute();
    const params = route.params as { onSelect?: (address: Address) => void } | undefined;
    const isSelectionMode = !!params?.onSelect;
    const { colors } = useTheme();

    const [addresses, setAddresses] = useState<Address[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);

    // Add/Edit Form State
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

    const handleEdit = (address: Address) => {
        setEditingAddress(address);
        setLabel(address.label);
        setAddressText(address.address_text);
        setIsAdding(true);
    };

    const handleUpdateAddress = async () => {
        if (!editingAddress || !label || !addressText) {
            Alert.alert('Missing Fields', 'Please fill in all fields');
            return;
        }

        setIsSaving(true);
        try {
            await api.updateAddress(editingAddress.address_id, { label, address_text: addressText });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setLabel('');
            setAddressText('');
            setEditingAddress(null);
            setIsAdding(false);
            loadAddresses();
        } catch (error: any) {
            console.log('Update address error:', error);
            let errorMessage = 'Failed to update address';
            if (error?.message) {
                errorMessage = error.message;
            }
            Alert.alert('Error', errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCloseModal = () => {
        setIsAdding(false);
        setEditingAddress(null);
        setLabel('');
        setAddressText('');
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
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, item.is_default && styles.defaultCard]}
            onPress={() => isSelectionMode ? handleSelect(item) : null}
            disabled={!isSelectionMode}
        >
            <View style={{ flex: 1 }}>
                <View style={styles.cardHeader}>
                    <Text style={[styles.label, { color: colors.text }]}>{item.label}</Text>
                    {item.is_default && <Text style={styles.defaultBadge}>Default</Text>}
                </View>
                <Text style={[styles.addressText, { color: colors.textSecondary }]}>{item.address_text}</Text>
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

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.background }]}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]}>{isSelectionMode ? 'Select Address' : 'Address Book'}</Text>
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
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{editingAddress ? 'Edit Address' : 'New Address'}</Text>

                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Label (e.g. Home, Office)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                            value={label}
                            onChangeText={setLabel}
                            placeholder="Home"
                            placeholderTextColor={colors.textMuted}
                        />

                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Address</Text>
                        <View style={styles.addressRow}>
                            <TextInput
                                style={[styles.input, { flex: 1, backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                                value={addressText}
                                onChangeText={setAddressText}
                                placeholder="Street, City..."
                                placeholderTextColor={colors.textMuted}
                            />
                            <TouchableOpacity style={styles.locButton} onPress={handleUseCurrentLocation}>
                                <Text>📍</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity onPress={handleCloseModal} style={[styles.cancelButton, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={editingAddress ? handleUpdateAddress : handleAddAddress}
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
                                        <Text style={styles.saveText}>{editingAddress ? 'Update' : 'Save Address'}</Text>
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
    container: { flex: 1, backgroundColor: '#FAFAFA' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderColor: '#F0F0F0'
    },
    backButton: {
        padding: Spacing.sm,
        backgroundColor: '#F5F5F5',
        borderRadius: BorderRadius.md,
    },
    backText: { color: Colors.primary, fontSize: FontSizes.md, fontWeight: '600' },
    title: { fontSize: FontSizes.xl, fontWeight: '800', letterSpacing: -0.5 }, // color set dynamically
    addButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.primary + '15',
        borderRadius: 20,
    },
    addText: { fontSize: 24, color: Colors.primary, fontWeight: '700' },
    list: { padding: Spacing.lg },
    card: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        marginBottom: Spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E8E8E8',
        ...Shadows.sm,
    },
    defaultCard: { borderColor: Colors.primary, borderWidth: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    label: { fontSize: FontSizes.md, fontWeight: '700', marginRight: Spacing.sm }, // color set dynamically
    defaultBadge: {
        fontSize: 10,
        color: Colors.primary,
        backgroundColor: Colors.primary + '15',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: BorderRadius.full,
        fontWeight: '600',
    },
    addressText: { fontSize: FontSizes.sm }, // color set dynamically
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    editButton: { padding: Spacing.sm },
    editText: { fontSize: 18 },
    deleteButton: { padding: Spacing.sm },
    deleteText: { color: Colors.error, fontSize: 18 },
    emptyText: { textAlign: 'center', color: '#737373', marginTop: 50, fontSize: FontSizes.md },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        padding: Spacing.xl
    },
    modalTitle: { fontSize: FontSizes.xl, fontWeight: '800', marginBottom: Spacing.lg }, // color set dynamically
    inputLabel: { marginBottom: Spacing.xs, fontSize: FontSizes.sm, fontWeight: '600' }, // color set dynamically
    input: {
        backgroundColor: '#F8F9FA',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: '#E8E8E8'
    },
    addressRow: { flexDirection: 'row', gap: Spacing.sm },
    locButton: {
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.primary + '15',
        borderRadius: BorderRadius.lg,
        borderWidth: 1.5,
        borderColor: Colors.primary
    },
    modalActions: { flexDirection: 'row', marginTop: Spacing.lg, gap: Spacing.md },
    cancelButton: {
        flex: 1,
        padding: Spacing.md,
        alignItems: 'center',
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        backgroundColor: '#F8F9FA',
    },
    cancelText: { fontWeight: '600' }, // color set dynamically
    saveButton: { flex: 2, borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.sm },
    saveGradient: { padding: Spacing.md, alignItems: 'center' },
    saveText: { color: '#fff', fontWeight: '700' },
});
