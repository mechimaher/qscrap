import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSizes } from '../../constants/theme';
import MyVehiclesSelector, { SavedVehicle } from '../MyVehiclesSelector';

interface VehicleSelectionStepProps {
    colors: any;
    t: any;
    isRTL: boolean;
    rtlFlexDirection: (isRTL: boolean) => any;
    rtlTextAlign: (isRTL: boolean) => any;
    selectedVehicle: SavedVehicle | null;
    handleVehicleSelect: (vehicle: SavedVehicle) => void;
    handleVehiclesLoaded: (vehicles: SavedVehicle[]) => void;
    navigation: any;
}

export default function VehicleSelectionStep({
    colors,
    t,
    isRTL,
    rtlFlexDirection,
    rtlTextAlign,
    selectedVehicle,
    handleVehicleSelect,
    handleVehiclesLoaded,
    navigation
}: VehicleSelectionStepProps) {
    return (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={[styles.sectionHeader, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <View
                    style={[
                        styles.stepBadge,
                        { backgroundColor: Colors.primary + '15' },
                        isRTL && { marginRight: 0, marginLeft: Spacing.md }
                    ]}
                >
                    <Text style={[styles.stepNumber, { color: Colors.primary }]}>1</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('newRequest.selectVehicle')}
                    </Text>
                    <Text
                        style={[
                            styles.sectionSubtitle,
                            { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }
                        ]}
                    >
                        {t('newRequest.chooseFromCars')}
                    </Text>
                </View>
            </View>

            <MyVehiclesSelector
                onSelect={handleVehicleSelect}
                selectedVehicleId={selectedVehicle?.vehicle_id}
                onVehiclesLoaded={handleVehiclesLoaded}
            />

            {selectedVehicle && (
                <View style={[styles.selectedVehicleBadge, { backgroundColor: Colors.primary + '10' }]}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.selectedText, { color: Colors.primary }]}>
                            {selectedVehicle.car_make} {selectedVehicle.car_model} ({selectedVehicle.car_year})
                        </Text>
                        {selectedVehicle.vin_number ? (
                            <Text style={styles.vinStatusGreen}>
                                {t('newRequest.vinVerified', { vin: selectedVehicle.vin_number })}
                            </Text>
                        ) : (
                            <TouchableOpacity
                                onPress={() => navigation.navigate('MyVehicles')}
                                style={styles.vinWarningBtn}
                            >
                                <Text style={styles.vinStatusRed}>{t('newRequest.tapToAddVin')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}

            {!selectedVehicle && (
                <TouchableOpacity onPress={() => navigation.navigate('MyVehicles')} style={styles.addVehicleButton}>
                    <Text style={[styles.addVehicleText, { color: Colors.primary }]}>
                        {t('newRequest.addNewVehicle')}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.lg,
        gap: Spacing.md
    },
    stepBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center'
    },
    stepNumber: { fontSize: FontSizes.md, fontWeight: '800' },
    sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
    sectionSubtitle: { fontSize: FontSizes.sm, marginTop: 2 },
    selectedVehicleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.md,
        gap: Spacing.sm
    },
    selectedText: { fontSize: FontSizes.md, fontWeight: '600' },
    vinStatusGreen: { fontSize: FontSizes.xs, color: '#22C55E', marginTop: 2 },
    vinStatusRed: { fontSize: FontSizes.xs, color: '#EF4444', fontWeight: '600' },
    vinWarningBtn: {
        marginTop: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: '#FEE2E2',
        borderRadius: BorderRadius.sm
    },
    addVehicleButton: {
        padding: Spacing.md,
        alignItems: 'center',
        marginTop: Spacing.sm
    },
    addVehicleText: { fontSize: FontSizes.md, fontWeight: '600' }
});
