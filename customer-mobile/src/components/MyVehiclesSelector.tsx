import { log, warn, error as logError } from '../utils/logger';
// QScrap - My Vehicles Selector (Family Fleet)
// Allows customers to quickly select from previously used vehicles
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { api, Vehicle as SavedVehicle } from '../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import * as Haptics from 'expo-haptics';
import { useTranslation } from '../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

// SavedVehicle is imported from api.ts as Vehicle
export type { SavedVehicle };

interface Props {
    onSelect: (vehicle: SavedVehicle) => void;
    selectedVehicleId?: string | null;
    onVehiclesLoaded?: (vehicles: SavedVehicle[]) => void; // Optional callback for auto-selection
}

export default function MyVehiclesSelector({ onSelect, selectedVehicleId, onVehiclesLoaded }: Props) {
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const navigation = useNavigation<any>();
    const [vehicles, setVehicles] = useState<SavedVehicle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);

    // Reload vehicles when screen comes into focus (detect new vehicles)
    useFocusEffect(
        useCallback(() => {
            loadVehicles();
        }, [])
    );

    const loadVehicles = async () => {
        try {
            const result = await api.getMyVehicles();
            // API returns { vehicles: [...] }
            const loadedVehicles = result.vehicles || [];
            setVehicles(loadedVehicles);

            // Auto-expand if user has saved vehicles
            if (loadedVehicles.length > 0) {
                setIsExpanded(true);
            }

            // Notify parent component that vehicles are loaded (for auto-selection)
            if (onVehiclesLoaded) {
                onVehiclesLoaded(loadedVehicles);
            }
        } catch (error) {
            log('[MyVehicles] Error loading:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelect = (vehicle: SavedVehicle) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSelect(vehicle);
    };

    // Don't show if no saved vehicles
    if (!isLoading && vehicles.length === 0) {
        return null;
    }

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.surface }]}>
                <ActivityIndicator size="small" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
                style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                onPress={() => {
                    Haptics.selectionAsync();
                    setIsExpanded(!isExpanded);
                }}
            >
                <View style={[styles.headerLeft, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Ionicons name="car-sport" size={20} color={Colors.primary} style={isRTL ? { marginRight: 0, marginLeft: Spacing.sm } : { marginRight: Spacing.sm }} />
                    <Text style={[styles.headerTitle, { color: colors.text }]}>
                        {t('home.myVehicles')}
                    </Text>
                    <View style={[styles.countBadge, { backgroundColor: Colors.primary, marginLeft: isRTL ? 0 : Spacing.sm, marginRight: isRTL ? Spacing.sm : 0 }]}>
                        <Text style={styles.countText}>{vehicles.length}</Text>
                    </View>
                </View>
                <Text style={[styles.chevron, { color: colors.textMuted }]}>
                    {isExpanded ? '▲' : '▼'}
                </Text>
            </TouchableOpacity>

            {isExpanded && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.vehicleList}
                    contentContainerStyle={styles.vehicleListContent}
                >
                    {vehicles.map((vehicle) => {
                        const isSelected = selectedVehicleId === vehicle.vehicle_id;
                        const displayName = vehicle.nickname || `${vehicle.car_make} ${vehicle.car_model}`;

                        return (
                            <TouchableOpacity
                                key={vehicle.vehicle_id}
                                style={[
                                    styles.vehicleCard,
                                    {
                                        backgroundColor: isSelected ? Colors.primary + '15' : colors.background,
                                        borderColor: isSelected ? Colors.primary : colors.border,
                                        marginRight: isRTL ? 0 : Spacing.sm,
                                        marginLeft: isRTL ? Spacing.sm : 0
                                    }
                                ]}
                                onPress={() => handleSelect(vehicle)}
                            >
                                <Ionicons name={vehicle.is_primary ? 'star' : 'car-sport-outline'} size={28} color={vehicle.is_primary ? '#F59E0B' : Colors.primary} style={{ marginBottom: Spacing.xs }} />
                                <Text
                                    style={[
                                        styles.vehicleName,
                                        { color: isSelected ? Colors.primary : colors.text }
                                    ]}
                                    numberOfLines={1}
                                >
                                    {displayName}
                                </Text>
                                <Text style={[styles.vehicleYear, { color: colors.textMuted }]}>
                                    {vehicle.car_year}
                                </Text>
                                {vehicle.vin_number ? (
                                    <View style={styles.vinBadge}>
                                        <Text style={styles.vinBadgeText}>{t('common.vinVerifiedShort')}</Text>
                                    </View>
                                ) : (vehicle.request_count ?? 0) > 0 && (
                                    <Text style={[styles.vehicleRequests, { color: colors.textSecondary }]}>
                                        {t('common.requestsCount', { count: vehicle.request_count ?? 0 })}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        );
                    })}

                    <TouchableOpacity
                        style={[styles.addHint, { borderColor: Colors.primary }]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            navigation.navigate('MyVehicles');
                        }}
                    >
                        <Ionicons name="add-circle-outline" size={20} color={Colors.primary} style={{ marginBottom: 4 }} />
                        <Text style={[styles.addHintText, { color: Colors.primary }]}>
                            {t('common.addVehicle')}
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.lg,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.sm,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIcon: {
        fontSize: 20,
        marginRight: Spacing.sm,
    },
    headerTitle: {
        fontSize: FontSizes.md,
        fontWeight: '700',
    },
    countBadge: {
        marginLeft: Spacing.sm,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    countText: {
        color: '#fff',
        fontSize: FontSizes.xs,
        fontWeight: '700',
    },
    chevron: {
        fontSize: 12,
    },
    vehicleList: {
        paddingBottom: Spacing.md,
    },
    vehicleListContent: {
        paddingHorizontal: Spacing.md,
        gap: Spacing.sm,
    },
    vehicleCard: {
        width: 120,
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 2,
        alignItems: 'center',
        marginRight: Spacing.sm,
    },
    vehicleEmoji: {
        fontSize: 28,
        marginBottom: Spacing.xs,
    },
    vehicleName: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        textAlign: 'center',
    },
    vehicleYear: {
        fontSize: FontSizes.xs,
        marginTop: 2,
    },
    vehicleRequests: {
        fontSize: 10,
        marginTop: 4,
    },
    vinBadge: {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        marginTop: 4,
    },
    vinBadgeText: {
        fontSize: 9,
        color: '#22C55E',
        fontWeight: '600',
    },
    addHint: {
        width: 100,
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 2,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addHintIcon: {
        fontSize: 20,
        marginBottom: 4,
    },
    addHintText: {
        fontSize: FontSizes.xs,
        fontWeight: '700',
        textAlign: 'center',
    },
});
