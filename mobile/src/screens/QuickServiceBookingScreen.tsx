// QScrap Quick Service Booking Confirmation Screen
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Alert,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { api } from '../services/api';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../components/Toast';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParamsProp = RouteProp<RootStackParamList, 'QuickServiceBooking'>;

interface ServiceDetails {
    type: 'battery' | 'oil' | 'wash' | 'tire' | 'ac' | 'breakdown';
    name: string;
    icon: string;
    priceRange: string;
    duration: string;
}

export default function QuickServiceBookingScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<RouteParamsProp>();
    const { colors } = useTheme();
    const toast = useToast();

    const serviceDetails = route.params?.service;

    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [address, setAddress] = useState('');
    const [vehicleMake, setVehicleMake] = useState('');
    const [vehicleModel, setVehicleModel] = useState('');
    const [vehicleYear, setVehicleYear] = useState('');
    const [notes, setNotes] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
    const [isLoading, setIsLoading] = useState(false);
    const [gettingLocation, setGettingLocation] = useState(false);

    useEffect(() => {
        getCurrentLocation();
    }, []);

    const getCurrentLocation = async () => {
        setGettingLocation(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                toast.error('Permission Denied', 'Location required for service');
                navigation.goBack();
                return;
            }

            const loc = await Location.getCurrentPositionAsync({});
            setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });

            // Reverse geocode
            const addresses = await Location.reverseGeocodeAsync(loc.coords);
            if (addresses.length > 0) {
                const a = addresses[0];
                setAddress(`${a.street || ''} ${a.city || ''}, Qatar`.trim());
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('Location error:', error);
            toast.error('Error', 'Failed to get location. Please try again.');
        } finally {
            setGettingLocation(false);
        }
    };

    const handleConfirmBooking = async () => {
        if (!location) {
            toast.error('Location Required', 'Please enable location services');
            return;
        }

        if (!vehicleMake || !vehicleModel || !vehicleYear) {
            toast.error('Vehicle Info Required', 'Please enter your vehicle details');
            return;
        }

        setIsLoading(true);

        try {
            const response = await api.createQuickServiceRequest({
                service_type: serviceDetails.type,
                location_lat: location.lat,
                location_lng: location.lng,
                location_address: address,
                vehicle_make: vehicleMake,
                vehicle_model: vehicleModel,
                vehicle_year: parseInt(vehicleYear),
                notes: notes,
                payment_method: paymentMethod,
            });

            if (response.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                toast.success(
                    'Booking Confirmed!',
                    'Finding nearby service provider...'
                );

                // Navigate to tracking screen
                setTimeout(() => {
                    navigation.replace('QuickServiceTracking', {
                        requestId: response.request.request_id,
                    });
                }, 1200);
            } else {
                // Handle error - could be string or object
                const errorInfo = response.error;
                const errorMessage = typeof errorInfo === 'string'
                    ? errorInfo
                    : (errorInfo?.message || errorInfo?.error || JSON.stringify(errorInfo) || 'Booking failed');
                throw new Error(errorMessage);
            }
        } catch (error: any) {
            console.error('Booking error:', error);
            // Extract string message safely
            let errorMsg = 'Failed to book service';
            if (typeof error === 'string') {
                errorMsg = error;
            } else if (error?.message) {
                errorMsg = error.message;
            } else if (error?.error) {
                errorMsg = typeof error.error === 'string' ? error.error : 'Booking failed';
            }
            toast.error('Error', errorMsg);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsLoading(false);
        }
    };

    if (gettingLocation) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.text }]}>
                        Getting your location...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={[styles.backText, { color: colors.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Confirm Booking</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Service Summary */}
                <View style={[styles.serviceCard, { backgroundColor: colors.surface }]}>
                    <Text style={styles.serviceIcon}>{serviceDetails.icon}</Text>
                    <Text style={[styles.serviceName, { color: colors.text }]}>{serviceDetails.name}</Text>
                    <Text style={[styles.servicePrice, { color: colors.primary }]}>{serviceDetails.priceRange}</Text>
                    <Text style={[styles.serviceDuration, { color: colors.textMuted }]}>
                        ⏱️ {serviceDetails.duration}
                    </Text>
                </View>

                {/* Location */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>📍 Service Location</Text>
                    <Text style={[styles.addressText, { color: colors.textSecondary }]}>{address || 'Getting location...'}</Text>
                    <TouchableOpacity
                        style={[styles.changeLocationBtn, { borderColor: colors.border }]}
                        onPress={getCurrentLocation}
                    >
                        <Text style={[styles.changeLocationText, { color: colors.primary }]}>
                            Update Location
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Vehicle Info */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>🚗 Vehicle Details</Text>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Make *</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            placeholder="Toyota, Nissan, etc."
                            placeholderTextColor={colors.textMuted}
                            value={vehicleMake}
                            onChangeText={setVehicleMake}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Model *</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            placeholder="Camry, Patrol, etc."
                            placeholderTextColor={colors.textMuted}
                            value={vehicleModel}
                            onChangeText={setVehicleModel}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Year *</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            placeholder="2020"
                            placeholderTextColor={colors.textMuted}
                            value={vehicleYear}
                            onChangeText={setVehicleYear}
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Notes (Optional)</Text>
                        <TextInput
                            style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            placeholder="Any specific instructions..."
                            placeholderTextColor={colors.textMuted}
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                            numberOfLines={3}
                        />
                    </View>
                </View>

                {/* Payment Method */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>💳 Payment Method</Text>

                    <TouchableOpacity
                        style={[
                            styles.paymentOption,
                            { backgroundColor: colors.background, borderColor: colors.border },
                            paymentMethod === 'cash' && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }
                        ]}
                        onPress={() => {
                            setPaymentMethod('cash');
                            Haptics.selectionAsync();
                        }}
                    >
                        <Text style={styles.paymentIcon}>💵</Text>
                        <View style={styles.paymentInfo}>
                            <Text style={[styles.paymentTitle, { color: colors.text }]}>Cash</Text>
                            <Text style={[styles.paymentDesc, { color: colors.textMuted }]}>
                                Pay technician directly
                            </Text>
                        </View>
                        {paymentMethod === 'cash' && (
                            <Text style={styles.selectedIcon}>✓</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.paymentOption,
                            { backgroundColor: colors.background, borderColor: colors.border },
                            paymentMethod === 'card' && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }
                        ]}
                        onPress={() => {
                            setPaymentMethod('card');
                            Haptics.selectionAsync();
                            toast.info('Coming Soon', 'Digital payments will be available soon');
                        }}
                    >
                        <Text style={styles.paymentIcon}>💳</Text>
                        <View style={styles.paymentInfo}>
                            <Text style={[styles.paymentTitle, { color: colors.text }]}>Card / Wallet</Text>
                            <Text style={[styles.paymentDesc, { color: colors.textMuted }]}>
                                Coming soon
                            </Text>
                        </View>
                        {paymentMethod === 'card' && (
                            <Text style={styles.selectedIcon}>✓</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Confirm Button */}
            <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                <TouchableOpacity
                    style={[styles.confirmButton, isLoading && styles.confirmButtonDisabled]}
                    onPress={handleConfirmBooking}
                    disabled={isLoading}
                >
                    <LinearGradient
                        colors={Colors.gradients.primary}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.confirmGradient}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.confirmText}>Confirm Booking</Text>
                                <Text style={styles.confirmSubtext}>
                                    Service provider will be assigned
                                </Text>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: Spacing.md, fontSize: FontSizes.md },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        borderBottomWidth: 1,
    },
    backButton: { width: 40, height: 40, justifyContent: 'center' },
    backText: { fontSize: 24 },
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '700' },
    content: { flex: 1, padding: Spacing.lg },
    serviceCard: {
        padding: Spacing.xl,
        borderRadius: BorderRadius.xl,
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    serviceIcon: { fontSize: 48, marginBottom: Spacing.sm },
    serviceName: { fontSize: FontSizes.xl, fontWeight: '700', marginBottom: Spacing.xs },
    servicePrice: { fontSize: FontSizes.lg, fontWeight: '600', marginBottom: Spacing.xs },
    serviceDuration: { fontSize: FontSizes.sm },
    section: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        marginBottom: Spacing.md,
    },
    sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', marginBottom: Spacing.md },
    addressText: { fontSize: FontSizes.md, marginBottom: Spacing.sm, lineHeight: 22 },
    changeLocationBtn: {
        borderWidth: 1,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    changeLocationText: { fontSize: FontSizes.md, fontWeight: '600' },
    inputGroup: { marginBottom: Spacing.md },
    inputLabel: { fontSize: FontSizes.sm, fontWeight: '600', marginBottom: Spacing.xs },
    input: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        fontSize: FontSizes.md,
        borderWidth: 1,
    },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 2,
        marginBottom: Spacing.sm,
    },
    paymentIcon: { fontSize: 28, marginRight: Spacing.md },
    paymentInfo: { flex: 1 },
    paymentTitle: { fontSize: FontSizes.md, fontWeight: '600' },
    paymentDesc: { fontSize: FontSizes.sm },
    selectedIcon: { fontSize: 24, color: Colors.primary },
    footer: {
        padding: Spacing.lg,
        borderTopWidth: 1,
    },
    confirmButton: { borderRadius: BorderRadius.xl, overflow: 'hidden' },
    confirmButtonDisabled: { opacity: 0.6 },
    confirmGradient: {
        padding: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 60,
    },
    confirmText: {
        color: '#fff',
        fontSize: FontSizes.lg,
        fontWeight: '700',
    },
    confirmSubtext: {
        color: '#fff',
        fontSize: FontSizes.sm,
        opacity: 0.9,
        marginTop: 2,
    },
});
