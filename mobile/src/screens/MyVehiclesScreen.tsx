// QScrap - My Vehicles Screen
// Display saved vehicles with simple Make/Model/Year

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Animated,
    Alert,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';
import { getAllMakes, getModelsForMake, YEARS } from '../constants/carData';
import VINCapture from '../components/VINCapture';

interface Vehicle {
    vehicle_id: string;
    car_make: string;
    car_model: string;
    car_year: number;
    vin_number?: string;
    nickname?: string;
    is_primary?: boolean;
    request_count?: number;
    created_at: string;
}

// Get all makes from carData
const CAR_MAKES = getAllMakes();

export default function MyVehiclesScreen() {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Add Vehicle Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [newMake, setNewMake] = useState('');
    const [newModel, setNewModel] = useState('');
    const [newYear, setNewYear] = useState('');
    const [newNickname, setNewNickname] = useState('');
    const [newVIN, setNewVIN] = useState('');
    const [vinImageUri, setVinImageUri] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);

    // Premium cascading selectors
    const [showMakePicker, setShowMakePicker] = useState(false);
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [showYearPicker, setShowYearPicker] = useState(false);
    const [availableModels, setAvailableModels] = useState<string[]>([]);

    const loadVehicles = useCallback(async () => {
        try {
            const result = await api.getMyVehicles();
            setVehicles(result.vehicles || []);
        } catch (error) {
            console.log('[MyVehicles] Error:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { loadVehicles(); }, [loadVehicles]));

    const onRefresh = () => {
        setIsRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        loadVehicles();
    };

    const handleAddVehicle = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setNewMake('');
        setNewModel('');
        setNewYear(new Date().getFullYear().toString());
        setNewNickname('');
        setNewVIN('');
        setVinImageUri(null);
        setShowAddModal(true);
    };

    const handleSaveVehicle = async () => {
        if (!newMake.trim() || !newModel.trim() || !newYear.trim()) {
            Alert.alert('Missing Info', 'Please enter Make, Model, and Year');
            return;
        }

        const year = parseInt(newYear);
        if (year < 1990 || year > new Date().getFullYear() + 1) {
            Alert.alert('Invalid Year', 'Please enter a valid year (1990-present)');
            return;
        }

        // VIN is now REQUIRED
        const trimmedVIN = newVIN.trim().toUpperCase();
        if (!trimmedVIN || trimmedVIN.length !== 17) {
            Alert.alert('VIN Required', 'Please enter a valid 17-character VIN from your Istimara (Registration Card)');
            return;
        }
        // VIN format validation (no I, O, Q per ISO 3779)
        const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/;
        if (!vinRegex.test(trimmedVIN)) {
            Alert.alert('Invalid VIN', 'VIN can only contain letters (except I, O, Q) and numbers');
            return;
        }

        setIsAdding(true);
        try {
            await api.addVehicle({
                car_make: newMake.trim(),
                car_model: newModel.trim(),
                car_year: year,
                nickname: newNickname.trim() || undefined,
                vin_number: trimmedVIN, // Now required
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowAddModal(false);
            loadVehicles();
        } catch (error) {
            console.log('[MyVehicles] Add error:', error);
            Alert.alert('Error', 'Could not add vehicle. Please try again.');
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteVehicle = (vehicle: Vehicle) => {
        Alert.alert(
            'Remove Vehicle',
            `Remove ${vehicle.car_make} ${vehicle.car_model} from your saved vehicles?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.deleteVehicle(vehicle.vehicle_id);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            loadVehicles();
                        } catch (error: any) {
                            console.log('[MyVehicles] Delete error:', error);
                            // Show user-friendly error message
                            const errorMessage = error?.response?.data?.error || error?.message || 'Failed to delete vehicle';
                            Alert.alert(
                                'Cannot Delete Vehicle',
                                errorMessage,
                                [{ text: 'OK' }]
                            );
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        }
                    }
                }
            ]
        );
    };

    // Edit vehicle state
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

    const handleEditVehicle = (vehicle: Vehicle) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEditingVehicle(vehicle);
        setNewMake(vehicle.car_make);
        setNewModel(vehicle.car_model);
        setNewYear(vehicle.car_year.toString());
        setNewNickname(vehicle.nickname || '');
        setNewVIN(vehicle.vin_number || '');
        setVinImageUri(null); // Reset image for fresh capture
        setShowAddModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingVehicle) return;

        // VIN validation for edit too
        const trimmedVIN = newVIN.trim().toUpperCase();
        if (trimmedVIN && trimmedVIN.length !== 17) {
            Alert.alert('Invalid VIN', 'VIN must be exactly 17 characters');
            return;
        }
        const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/;
        if (trimmedVIN && !vinRegex.test(trimmedVIN)) {
            Alert.alert('Invalid VIN', 'VIN can only contain letters (except I, O, Q) and numbers');
            return;
        }

        setIsAdding(true);
        try {
            await api.updateVehicle(editingVehicle.vehicle_id, {
                nickname: newNickname.trim() || undefined,
                vin_number: trimmedVIN || undefined,
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowAddModal(false);
            setEditingVehicle(null);
            loadVehicles();
        } catch (error) {
            console.log('[MyVehicles] Edit error:', error);
            Alert.alert('Error', 'Could not update vehicle. Please try again.');
        } finally {
            setIsAdding(false);
        }
    };

    const VehicleCard = ({ item, index }: { item: Vehicle; index: number }) => {
        const fadeAnim = useRef(new Animated.Value(0)).current;
        const slideAnim = useRef(new Animated.Value(30)).current;

        useEffect(() => {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 300, delay: index * 80, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 350, delay: index * 80, useNativeDriver: true }),
            ]).start();
        }, []);

        return (
            <Animated.View style={[styles.cardWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <TouchableOpacity
                    style={[styles.card, { backgroundColor: colors.surface }]}
                    onPress={() => handleEditVehicle(item)}
                    activeOpacity={0.8}
                >
                    <View style={styles.cardLeft}>
                        <View style={[styles.iconBg, item.is_primary && styles.iconBgPrimary]}>
                            <Text style={styles.carEmoji}>🚗</Text>
                        </View>
                        <View style={styles.cardInfo}>
                            <View style={styles.nameRow}>
                                <Text style={[styles.vehicleName, { color: colors.text }]}>
                                    {item.car_make} {item.car_model}
                                </Text>
                                {item.is_primary && (
                                    <View style={styles.primaryBadge}>
                                        <Text style={styles.primaryText}>★</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.vehicleYear, { color: colors.textSecondary }]}>
                                {item.car_year}{item.nickname ? ` • ${item.nickname}` : ''}
                            </Text>
                            {item.request_count && item.request_count > 0 && (
                                <Text style={[styles.statsText, { color: Colors.primary }]}>
                                    {item.request_count} request{item.request_count > 1 ? 's' : ''}
                                </Text>
                            )}
                        </View>
                    </View>
                    <View style={styles.cardActions}>
                        <TouchableOpacity
                            style={styles.editBtn}
                            onPress={() => handleEditVehicle(item)}
                        >
                            <Ionicons name="pencil-outline" size={18} color={Colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={() => handleDeleteVehicle(item)}
                        >
                            <Ionicons name="trash-outline" size={18} color={Colors.error} />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const EmptyState = () => (
        <View style={styles.emptyState}>
            <View style={[styles.emptyIconBg, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={styles.emptyIcon}>🚗</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Saved Vehicles</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Add your vehicles for faster part requests
            </Text>
            <TouchableOpacity onPress={handleAddVehicle} style={styles.addButton}>
                <LinearGradient
                    colors={[Colors.primary, '#6b1029']}
                    style={styles.addGradient}
                >
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.addButtonText}>Add Vehicle</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>My Vehicles</Text>
                <TouchableOpacity onPress={handleAddVehicle} style={styles.addIconBtn}>
                    <Ionicons name="add-circle" size={28} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Vehicle Count */}
            {vehicles.length > 0 && (
                <View style={styles.countBar}>
                    <Text style={[styles.countText, { color: colors.textSecondary }]}>
                        {vehicles.length} vehicle{vehicles.length > 1 ? 's' : ''} saved
                    </Text>
                </View>
            )}

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    {[0, 1, 2].map(i => (
                        <View key={i} style={[styles.skeletonCard, { backgroundColor: colors.surfaceSecondary }]} />
                    ))}
                </View>
            ) : (
                <FlatList
                    data={vehicles}
                    keyExtractor={(item) => item.vehicle_id}
                    renderItem={({ item, index }) => <VehicleCard item={item} index={index} />}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            tintColor={Colors.primary}
                        />
                    }
                    ListEmptyComponent={EmptyState}
                />
            )}

            {/* Add Vehicle Modal */}
            <Modal
                visible={showAddModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowAddModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                {editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
                            </Text>
                            <TouchableOpacity onPress={() => { setShowAddModal(false); setEditingVehicle(null); }}>
                                <Ionicons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingBottom: 20 }}
                        >

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>🚗 Make {editingVehicle ? '' : '*'}</Text>
                            {editingVehicle ? (
                                <View style={[styles.input, styles.disabledInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                                    <Text style={[styles.inputText, { color: colors.text }]}>{newMake}</Text>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.selectorBtn, { backgroundColor: colors.background, borderColor: newMake ? Colors.primary : colors.border }]}
                                    onPress={() => setShowMakePicker(true)}
                                >
                                    <Text style={[styles.selectorText, { color: newMake ? colors.text : colors.textMuted }]}>
                                        {newMake || 'Select car make...'}
                                    </Text>
                                    <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
                                </TouchableOpacity>
                            )}

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>📋 Model {editingVehicle ? '' : '*'}</Text>
                            {editingVehicle ? (
                                <View style={[styles.input, styles.disabledInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                                    <Text style={[styles.inputText, { color: colors.text }]}>{newModel}</Text>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.selectorBtn, { backgroundColor: colors.background, borderColor: newModel ? Colors.primary : colors.border, opacity: newMake ? 1 : 0.5 }]}
                                    onPress={() => newMake && setShowModelPicker(true)}
                                    disabled={!newMake}
                                >
                                    <Text style={[styles.selectorText, { color: newModel ? colors.text : colors.textMuted }]}>
                                        {newModel || (newMake ? 'Select model...' : 'Select make first')}
                                    </Text>
                                    <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
                                </TouchableOpacity>
                            )}

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>📅 Year {editingVehicle ? '' : '*'}</Text>
                            {editingVehicle ? (
                                <View style={[styles.input, styles.disabledInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                                    <Text style={[styles.inputText, { color: colors.text }]}>{newYear}</Text>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.selectorBtn, { backgroundColor: colors.background, borderColor: newYear ? Colors.primary : colors.border }]}
                                    onPress={() => setShowYearPicker(true)}
                                >
                                    <Text style={[styles.selectorText, { color: newYear ? colors.text : colors.textMuted }]}>
                                        {newYear || 'Select year (1980-2027)'}
                                    </Text>
                                    <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
                                </TouchableOpacity>
                            )}

                            {/* VIN Capture - REQUIRED with Photo Support */}
                            <VINCapture
                                value={newVIN}
                                imageUri={vinImageUri || undefined}
                                onVINChange={setNewVIN}
                                onImageChange={setVinImageUri}
                                disabled={isAdding}
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>💬 Nickname (optional)</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                value={newNickname}
                                onChangeText={setNewNickname}
                                placeholder="e.g. My Daily, Wife's Car"
                                placeholderTextColor={colors.textMuted}
                            />

                            <TouchableOpacity
                                onPress={editingVehicle ? handleSaveEdit : handleSaveVehicle}
                                disabled={isAdding}
                                style={styles.saveButton}
                            >
                                <LinearGradient
                                    colors={isAdding ? ['#999', '#777'] : [Colors.primary, '#6b1029']}
                                    style={styles.saveGradient}
                                >
                                    <Text style={styles.saveButtonText}>
                                        {isAdding ? 'Saving...' : (editingVehicle ? 'Update Vehicle' : 'Save Vehicle')}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Make Picker Modal - Searchable */}
            <Modal visible={showMakePicker} animationType="slide" transparent>
                <View style={styles.pickerOverlay}>
                    <View style={[styles.pickerContent, { backgroundColor: colors.surface }]}>
                        <View style={styles.pickerHeader}>
                            <Text style={[styles.pickerTitle, { color: colors.text }]}>🚗 Select Make</Text>
                            <TouchableOpacity onPress={() => setShowMakePicker(false)}>
                                <Ionicons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={[styles.searchInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            placeholder="Search makes..."
                            placeholderTextColor={colors.textMuted}
                            value={newMake}
                            onChangeText={setNewMake}
                            autoFocus
                        />
                        <FlatList
                            data={CAR_MAKES.filter(m => m.toLowerCase().includes(newMake.toLowerCase()))}
                            keyExtractor={(item) => item}
                            style={styles.pickerList}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.pickerItem, newMake === item && { backgroundColor: Colors.primary + '20' }]}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setNewMake(item);
                                        setNewModel(''); // Reset model when make changes
                                        setAvailableModels(getModelsForMake(item));
                                        setShowMakePicker(false);
                                    }}
                                >
                                    <Text style={[styles.pickerItemText, { color: colors.text }]}>{item}</Text>
                                    {newMake === item && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>

            {/* Model Picker Modal - Searchable */}
            <Modal visible={showModelPicker} animationType="slide" transparent>
                <View style={styles.pickerOverlay}>
                    <View style={[styles.pickerContent, { backgroundColor: colors.surface }]}>
                        <View style={styles.pickerHeader}>
                            <Text style={[styles.pickerTitle, { color: colors.text }]}>📋 Select Model</Text>
                            <TouchableOpacity onPress={() => setShowModelPicker(false)}>
                                <Ionicons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={[styles.searchInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            placeholder="Search models..."
                            placeholderTextColor={colors.textMuted}
                            value={newModel}
                            onChangeText={setNewModel}
                            autoFocus
                        />
                        <FlatList
                            data={availableModels.filter(m => m.toLowerCase().includes(newModel.toLowerCase()))}
                            keyExtractor={(item) => item}
                            style={styles.pickerList}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.pickerItem, newModel === item && { backgroundColor: Colors.primary + '20' }]}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setNewModel(item);
                                        setShowModelPicker(false);
                                    }}
                                >
                                    <Text style={[styles.pickerItemText, { color: colors.text }]}>{item}</Text>
                                    {newModel === item && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <Text style={[styles.emptyPickerText, { color: colors.textMuted }]}>
                                    No models found. Try typing to search.
                                </Text>
                            }
                        />
                    </View>
                </View>
            </Modal>

            {/* Year Picker Modal - Smooth Scroll */}
            <Modal visible={showYearPicker} animationType="slide" transparent>
                <View style={styles.pickerOverlay}>
                    <View style={[styles.pickerContent, { backgroundColor: colors.surface }]}>
                        <View style={styles.pickerHeader}>
                            <Text style={[styles.pickerTitle, { color: colors.text }]}>📅 Select Year</Text>
                            <TouchableOpacity onPress={() => setShowYearPicker(false)}>
                                <Ionicons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={YEARS}
                            keyExtractor={(item) => item.toString()}
                            style={styles.pickerList}
                            showsVerticalScrollIndicator={false}
                            initialScrollIndex={YEARS.findIndex(y => y === new Date().getFullYear())}
                            getItemLayout={(_, index) => ({ length: 50, offset: 50 * index, index })}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.yearItem, newYear === item.toString() && { backgroundColor: Colors.primary + '20' }]}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setNewYear(item.toString());
                                        setShowYearPicker(false);
                                    }}
                                >
                                    <Text style={[styles.yearText, { color: colors.text }, newYear === item.toString() && styles.yearTextSelected]}>
                                        {item}
                                    </Text>
                                    {newYear === item.toString() && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
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
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
    addIconBtn: { width: 40, height: 40, alignItems: 'flex-end', justifyContent: 'center' },
    countBar: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
    countText: { fontSize: FontSizes.sm },
    listContent: { padding: Spacing.md, flexGrow: 1 },
    loadingContainer: { padding: Spacing.md, gap: Spacing.sm },
    skeletonCard: { height: 80, borderRadius: BorderRadius.lg },
    cardWrapper: { marginBottom: Spacing.sm },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    iconBg: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#E3F2FD',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
    },
    iconBgPrimary: {
        backgroundColor: Colors.secondary + '30',
        borderWidth: 2,
        borderColor: Colors.secondary,
    },
    carEmoji: { fontSize: 22 },
    cardInfo: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    vehicleName: { fontSize: FontSizes.md, fontWeight: '600' },
    primaryBadge: {
        backgroundColor: Colors.secondary,
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryText: { fontSize: 10, color: '#fff', fontWeight: '700' },
    vehicleYear: { fontSize: FontSizes.sm, marginTop: 2 },
    statsText: { fontSize: 10, marginTop: 2, fontWeight: '600' },
    cardActions: { flexDirection: 'row', gap: 8 },
    editBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: Colors.primary + '15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: Colors.error + '15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    emptyIconBg: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },
    emptyIcon: { fontSize: 36 },
    emptyTitle: { fontSize: FontSizes.lg, fontWeight: '700', marginBottom: Spacing.xs },
    emptyText: { fontSize: FontSizes.sm, textAlign: 'center', marginBottom: Spacing.lg },
    addButton: { width: '100%', maxWidth: 200 },
    addGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        gap: Spacing.xs,
    },
    addButtonText: { color: '#fff', fontWeight: '700', fontSize: FontSizes.md },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        padding: Spacing.lg,
        paddingBottom: Spacing.xxl,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    modalTitle: { fontSize: FontSizes.xl, fontWeight: '700' },
    inputLabel: { fontSize: FontSizes.sm, marginBottom: 4, marginTop: Spacing.sm },
    input: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: FontSizes.md,
    },
    vinInput: {
        fontFamily: 'monospace',
        letterSpacing: 2,
        textAlign: 'center',
        borderWidth: 2,
    },
    vinHelp: {
        fontSize: FontSizes.xs,
        textAlign: 'center',
        marginTop: 4,
    },
    saveButton: { marginTop: Spacing.lg },
    saveGradient: {
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
    },
    saveButtonText: { color: '#fff', fontWeight: '700', fontSize: FontSizes.lg },
    // Selector button styles
    selectorBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1.5,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    selectorText: {
        fontSize: FontSizes.md,
        flex: 1,
    },
    disabledInput: {
        justifyContent: 'center',
    },
    inputText: {
        fontSize: FontSizes.md,
    },
    // Picker modal styles
    pickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    pickerContent: {
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.xxl,
        maxHeight: '70%',
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    pickerTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
    },
    searchInput: {
        marginHorizontal: Spacing.lg,
        marginVertical: Spacing.md,
        borderWidth: 1,
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: FontSizes.md,
    },
    pickerList: {
        paddingHorizontal: Spacing.md,
    },
    pickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: 2,
    },
    pickerItemText: {
        fontSize: FontSizes.md,
    },
    emptyPickerText: {
        textAlign: 'center',
        paddingVertical: Spacing.xl,
        fontSize: FontSizes.sm,
    },
    yearItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        borderRadius: BorderRadius.md,
        marginBottom: 2,
        height: 50,
    },
    yearText: {
        fontSize: FontSizes.xl,
        fontWeight: '500',
    },
    yearTextSelected: {
        fontWeight: '700',
        color: Colors.primary,
    },
});
