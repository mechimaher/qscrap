// Premium Delivery Location Widget - KEETA/TALABAT Style
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { api, Address } from '../services/api';
import { MapLocationPicker } from './MapLocationPicker';

interface DeliveryLocationWidgetProps {
    onLocationChange?: (address: Address | null) => void;
}

export const DeliveryLocationWidget: React.FC<DeliveryLocationWidgetProps> = ({ onLocationChange }) => {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const [currentAddress, setCurrentAddress] = useState<Address | null>(null);
    const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDetecting, setIsDetecting] = useState(false);
    const [showPicker, setShowPicker] = useState(true); // Auto-show on mount
    const [showMap, setShowMap] = useState(false);

    useEffect(() => {
        loadAddresses();
    }, []);

    const loadAddresses = async () => {
        try {
            setIsLoading(true);
            const result = await api.request<{ addresses: Address[] }>('/addresses');
            const addresses = result.addresses || [];
            setSavedAddresses(addresses);

            // Set default address for display (but DON'T trigger onLocationChange)
            // Let user explicitly select - triggering callback here closes the modal!
            const defaultAddr = addresses.find(a => a.is_default) || addresses[0];
            if (defaultAddr) {
                setCurrentAddress(defaultAddr);
                // REMOVED: onLocationChange?.(defaultAddr); - this was closing modal prematurely
            }
        } catch (error) {
            console.log('[Location] Failed to load addresses:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const detectCurrentLocation = async () => {
        try {
            setIsDetecting(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            // Request permissions
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                alert(t('home.deliveryWidget.permissionDenied'));
                return;
            }

            // Get current position
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            // Reverse geocode
            const [geocoded] = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });

            if (geocoded) {
                // Create temporary address object
                const detectedAddress: Address = {
                    address_id: 'current',
                    label: t('home.deliveryWidget.currentLocation'),
                    address_text: `${geocoded.street || ''}, ${geocoded.district || geocoded.subregion || ''}, ${geocoded.city || 'Doha'}`.trim(),
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    is_default: false,
                };

                setCurrentAddress(detectedAddress);
                onLocationChange?.(detectedAddress);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (error) {
            console.error('[Location] Detection failed:', error);
            alert(t('home.deliveryWidget.detectionFailed'));
        } finally {
            setIsDetecting(false);
        }
    };

    const handleAddressSelect = (address: Address) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setCurrentAddress(address);
        onLocationChange?.(address);
        setShowPicker(false);
    };

    const getDisplayText = () => {
        if (!currentAddress) return t('home.deliveryWidget.selectAddress');

        // Extract area and city for concise display (KEETA/TALABAT style)
        const parts = currentAddress.address_text.split(',').map(p => p.trim());
        if (parts.length >= 2) {
            return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
        }
        return currentAddress.label || currentAddress.address_text;
    };

    // Loading state is now handled inline in the picker modal content

    return (
        <>
            <TouchableOpacity
                style={[styles.container, { backgroundColor: colors.surface }]}
                onPress={() => {
                    Haptics.selectionAsync();
                    setShowPicker(true);
                }}
                activeOpacity={0.8}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.locationIcon}>📍</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>
                                {t('home.deliveryWidget.deliveringTo')}
                            </Text>
                            <Text style={[styles.address, { color: colors.text }]} numberOfLines={1}>
                                {getDisplayText()}
                            </Text>
                        </View>
                        <Text style={[styles.chevron, { color: Colors.primary }]}>▼</Text>
                    </View>
                </View>
            </TouchableOpacity>

            {/* Address Picker Modal */}
            <Modal
                visible={showPicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                {t('home.deliveryWidget.selectLocation')}
                            </Text>
                            <TouchableOpacity onPress={() => setShowPicker(false)}>
                                <Text style={styles.closeIcon}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.addressList}>
                            {/* Current Location Option */}
                            <TouchableOpacity
                                style={[styles.addressItem, { backgroundColor: colors.surface }]}
                                onPress={detectCurrentLocation}
                                disabled={isDetecting}
                            >
                                <LinearGradient
                                    colors={['#22C55E', '#16A34A']}
                                    style={styles.addressIconBg}
                                >
                                    {isDetecting ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.addressIconText}>📍</Text>
                                    )}
                                </LinearGradient>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.addressLabel, { color: colors.text }]}>
                                        {t('home.deliveryWidget.useCurrentLocation')}
                                    </Text>
                                    <Text style={[styles.addressHint, { color: colors.textSecondary }]}>
                                        {t('home.deliveryWidget.autoDetect')}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Pin on Map Option - Premium */}
                            <TouchableOpacity
                                style={[styles.addressItem, { backgroundColor: colors.surface }]}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    setShowMap(true);
                                    setShowPicker(false);
                                }}
                            >
                                <LinearGradient
                                    colors={[Colors.primary, '#B31D4A']}
                                    style={styles.addressIconBg}
                                >
                                    <Text style={styles.addressIconText}>🗺️</Text>
                                </LinearGradient>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.addressLabel, { color: colors.text }]}>
                                        {t('home.deliveryWidget.pinOnMap')}
                                    </Text>
                                    <Text style={[styles.addressHint, { color: colors.textSecondary }]}>
                                        {t('home.deliveryWidget.chooseExact')}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Deliver to My Mechanic Option - PREMIUM */}
                            <TouchableOpacity
                                style={[styles.addressItem, { backgroundColor: colors.surface }]}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    // Open map to select mechanic/repair shop location
                                    setShowMap(true);
                                    setShowPicker(false);
                                }}
                            >
                                <LinearGradient
                                    colors={['#F59E0B', '#D97706']}
                                    style={styles.addressIconBg}
                                >
                                    <Text style={styles.addressIconText}>🔧</Text>
                                </LinearGradient>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.addressLabel, { color: colors.text }]}>
                                        {t('home.deliveryWidget.deliverToMechanic')}
                                    </Text>
                                    <Text style={[styles.addressHint, { color: colors.textSecondary }]}>
                                        {t('home.deliveryWidget.mechanicHint')}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Saved Addresses */}
                            {savedAddresses.map((addr) => (
                                <TouchableOpacity
                                    key={addr.address_id}
                                    style={[
                                        styles.addressItem,
                                        { backgroundColor: colors.surface },
                                        currentAddress?.address_id === addr.address_id && styles.selectedAddress
                                    ]}
                                    onPress={() => handleAddressSelect(addr)}
                                >
                                    <View style={[styles.addressIconBg, { backgroundColor: Colors.primary + '15' }]}>
                                        <Text style={styles.addressIconText}>
                                            {addr.is_default ? '🏠' : '📍'}
                                        </Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.addressLabel, { color: colors.text }]}>
                                            {addr.label}
                                            {addr.is_default && t('home.deliveryWidget.default')}
                                        </Text>
                                        <Text style={[styles.addressText, { color: colors.textSecondary }]} numberOfLines={2}>
                                            {addr.address_text}
                                        </Text>
                                    </View>
                                    {currentAddress?.address_id === addr.address_id && (
                                        <Text style={styles.checkIcon}>✓</Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Map Location Picker Modal */}
            <Modal
                visible={showMap}
                animationType="slide"
                onRequestClose={() => setShowMap(false)}
            >
                <MapLocationPicker
                    onLocationSelect={(location) => {
                        const mapAddress: Address = {
                            address_id: 'map_selected',
                            label: t('home.deliveryWidget.mapLocation'),
                            address_text: location.address,
                            latitude: location.latitude,
                            longitude: location.longitude,
                            is_default: false,
                        };
                        setCurrentAddress(mapAddress);
                        onLocationChange?.(mapAddress);
                        setShowMap(false);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }}
                    onCancel={() => {
                        setShowMap(false);
                        setShowPicker(true);
                    }}
                />
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: '#E5E7EB', // Light gray border for visibility
        backgroundColor: '#E5E7EB', // Darker gray - more visible
        ...Shadows.sm,
    },
    content: {},
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    locationIcon: {
        fontSize: 20,
    },
    label: {
        fontSize: FontSizes.xs,
        marginBottom: 2,
    },
    address: {
        fontSize: FontSizes.md,
        fontWeight: '700',
    },
    chevron: {
        fontSize: 10,
        fontWeight: '700',
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.xxl + 20,
        maxHeight: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    modalTitle: {
        fontSize: FontSizes.xl,
        fontWeight: '800',
    },
    closeIcon: {
        fontSize: 24,
        color: '#999',
    },
    addressList: {
        paddingHorizontal: Spacing.lg,
    },
    addressItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.sm,
        gap: Spacing.md,
    },
    selectedAddress: {
        borderWidth: 2,
        borderColor: Colors.primary,
    },
    addressIconBg: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addressIconText: {
        fontSize: 20,
    },
    addressLabel: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        marginBottom: 2,
    },
    addressText: {
        fontSize: FontSizes.sm,
        lineHeight: 18,
    },
    addressHint: {
        fontSize: FontSizes.sm,
    },
    checkIcon: {
        fontSize: 20,
        color: Colors.primary,
        fontWeight: '700',
    },
});

export default DeliveryLocationWidget;
