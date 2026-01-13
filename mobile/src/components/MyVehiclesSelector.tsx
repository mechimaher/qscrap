// QScrap - My Vehicles Selector (Family Fleet)
// Allows customers to quickly select from previously used vehicles
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { api, SavedVehicle } from '../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import * as Haptics from 'expo-haptics';

interface Props {
    onSelect: (vehicle: SavedVehicle) => void;
    selectedVehicleId?: string | null;
}

export default function MyVehiclesSelector({ onSelect, selectedVehicleId }: Props) {
    const { colors } = useTheme();
    const [vehicles, setVehicles] = useState<SavedVehicle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        loadVehicles();
    }, []);

    const loadVehicles = async () => {
        try {
            const result = await api.getMyVehicles();
            if (result.success) {
                setVehicles(result.vehicles);
                // Auto-expand if user has saved vehicles
                if (result.vehicles.length > 0) {
                    setIsExpanded(true);
                }
            }
        } catch (error) {
            console.log('[MyVehicles] Error loading:', error);
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
                style={styles.header}
                onPress={() => {
                    Haptics.selectionAsync();
                    setIsExpanded(!isExpanded);
                }}
            >
                <View style={styles.headerLeft}>
                    <Text style={styles.headerIcon}>🚗</Text>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>
                        My Vehicles
                    </Text>
                    <View style={[styles.countBadge, { backgroundColor: Colors.primary }]}>
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
                                        borderColor: isSelected ? Colors.primary : colors.border
                                    }
                                ]}
                                onPress={() => handleSelect(vehicle)}
                            >
                                <Text style={styles.vehicleEmoji}>
                                    {vehicle.is_primary ? '⭐' : '🚗'}
                                </Text>
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
                                {vehicle.request_count > 0 && (
                                    <Text style={[styles.vehicleRequests, { color: colors.textSecondary }]}>
                                        {vehicle.request_count} request{vehicle.request_count > 1 ? 's' : ''}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        );
                    })}

                    {/* Add New Vehicle hint */}
                    <View style={[styles.addHint, { borderColor: colors.border }]}>
                        <Text style={[styles.addHintText, { color: colors.textMuted }]}>
                            ↓ Enter new vehicle below
                        </Text>
                    </View>
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
    addHint: {
        width: 100,
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addHintText: {
        fontSize: FontSizes.xs,
        textAlign: 'center',
    },
});
