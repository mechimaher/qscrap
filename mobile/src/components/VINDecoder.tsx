import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

interface VINDecoderProps {
    value: string;
    onChangeText: (text: string) => void;
    onDecoded?: (data: DecodedVIN) => void;
}

export interface DecodedVIN {
    make: string;
    model: string;
    year: string;
    bodyType?: string;
    engineSize?: string;
    fuelType?: string;
    driveType?: string;
    transmission?: string;
    country?: string;
}

// VIN Position meanings
// Pos 1: Country
// Pos 2: Manufacturer  
// Pos 3: Vehicle Type
// Pos 4-8: Vehicle attributes
// Pos 9: Check digit
// Pos 10: Model year
// Pos 11: Plant
// Pos 12-17: Serial number

// Year codes (VIN position 10)
const YEAR_CODES: Record<string, string> = {
    'A': '2010', 'B': '2011', 'C': '2012', 'D': '2013', 'E': '2014',
    'F': '2015', 'G': '2016', 'H': '2017', 'J': '2018', 'K': '2019',
    'L': '2020', 'M': '2021', 'N': '2022', 'P': '2023', 'R': '2024',
    'S': '2025', 'T': '2026', 'V': '2027', 'W': '2028', 'X': '2029',
    'Y': '2030', '1': '2031', '2': '2032', '3': '2033', '4': '2034',
    '5': '2035', '6': '2036', '7': '2037', '8': '2038', '9': '2039',
};

// Common manufacturer codes (WMI - first 3 chars)
const MANUFACTURER_CODES: Record<string, { make: string; country: string }> = {
    // Japanese
    'JTD': { make: 'Toyota', country: 'Japan' },
    'JTE': { make: 'Toyota', country: 'Japan' },
    'JTH': { make: 'Lexus', country: 'Japan' },
    'JHM': { make: 'Honda', country: 'Japan' },
    'JN1': { make: 'Nissan', country: 'Japan' },
    'JN8': { make: 'Nissan', country: 'Japan' },
    '5N1': { make: 'Nissan', country: 'USA' },
    'JM1': { make: 'Mazda', country: 'Japan' },
    'JM3': { make: 'Mazda', country: 'Japan' },
    'JF1': { make: 'Subaru', country: 'Japan' },
    'JS1': { make: 'Suzuki', country: 'Japan' },
    // American
    '1FA': { make: 'Ford', country: 'USA' },
    '1FM': { make: 'Ford', country: 'USA' },
    '1FT': { make: 'Ford', country: 'USA' },
    '1G1': { make: 'Chevrolet', country: 'USA' },
    '1GC': { make: 'Chevrolet', country: 'USA' },
    '1GT': { make: 'GMC', country: 'USA' },
    '2G1': { make: 'Chevrolet', country: 'Canada' },
    '1C3': { make: 'Chrysler', country: 'USA' },
    '1C4': { make: 'Chrysler', country: 'USA' },
    '2C3': { make: 'Chrysler', country: 'Canada' },
    '3FA': { make: 'Ford', country: 'Mexico' },
    // German
    'WAU': { make: 'Audi', country: 'Germany' },
    'WBA': { make: 'BMW', country: 'Germany' },
    'WBS': { make: 'BMW M', country: 'Germany' },
    'WDB': { make: 'Mercedes-Benz', country: 'Germany' },
    'WDC': { make: 'Mercedes-Benz', country: 'Germany' },
    'WDD': { make: 'Mercedes-Benz', country: 'Germany' },
    'WVW': { make: 'Volkswagen', country: 'Germany' },
    'WP0': { make: 'Porsche', country: 'Germany' },
    'WP1': { make: 'Porsche', country: 'Germany' },
    // Korean
    'KMH': { make: 'Hyundai', country: 'Korea' },
    'KNA': { make: 'Kia', country: 'Korea' },
    'KNC': { make: 'Kia', country: 'Korea' },
    'KND': { make: 'Kia', country: 'Korea' },
    '5XY': { make: 'Hyundai', country: 'USA' },
    // European
    'SAJ': { make: 'Jaguar', country: 'UK' },
    'SAL': { make: 'Land Rover', country: 'UK' },
    'ZFA': { make: 'Fiat', country: 'Italy' },
    'ZFF': { make: 'Ferrari', country: 'Italy' },
    // UAE/Middle East production
    '6T1': { make: 'Toyota', country: 'Australia' },
    'MNT': { make: 'Nissan', country: 'UAE' },
};

// Common model patterns (simplified - real decoder would use more data)
const MODEL_PATTERNS: Record<string, Record<string, string>> = {
    'Toyota': {
        'A': 'Camry', 'B': 'RAV4', 'C': 'Corolla', 'D': 'Land Cruiser',
        'E': 'Hilux', 'F': 'Prado', 'G': 'Fortuner', 'H': 'Yaris',
    },
    'Nissan': {
        'A': 'Altima', 'B': 'Patrol', 'C': 'Sentra', 'D': 'Pathfinder',
        'E': 'X-Trail', 'F': 'Sunny', 'G': 'Maxima', 'H': 'Murano',
    },
    'Honda': {
        'A': 'Accord', 'B': 'Civic', 'C': 'CR-V', 'D': 'Pilot',
        'E': 'HR-V', 'F': 'Odyssey', 'G': 'City', 'H': 'Jazz',
    },
    'Mercedes-Benz': {
        'A': 'A-Class', 'B': 'C-Class', 'C': 'E-Class', 'D': 'S-Class',
        'E': 'GLC', 'F': 'GLE', 'G': 'GLS', 'H': 'G-Class',
    },
    'BMW': {
        '3': '3 Series', '5': '5 Series', '7': '7 Series', 'X': 'X5',
        'A': 'X3', 'B': 'X1', 'C': 'X7', 'D': 'M4',
    },
};

/**
 * Decode VIN locally using standard VIN format
 * For production, integrate with NHTSA API or similar
 */
const decodeVINLocally = (vin: string): DecodedVIN | null => {
    if (vin.length !== 17) return null;

    const upperVIN = vin.toUpperCase();
    const wmi = upperVIN.substring(0, 3);
    const yearChar = upperVIN.charAt(9);
    const plantChar = upperVIN.charAt(10);

    // Get manufacturer
    const manufacturer = MANUFACTURER_CODES[wmi];
    if (!manufacturer) {
        // Try partial match (first 2 chars)
        const partialWMI = upperVIN.substring(0, 2);
        for (const [code, data] of Object.entries(MANUFACTURER_CODES)) {
            if (code.startsWith(partialWMI)) {
                const year = YEAR_CODES[yearChar] || 'Unknown';
                const models = MODEL_PATTERNS[data.make] || {};
                const modelChar = upperVIN.charAt(4);
                const model = models[modelChar] || 'Unknown Model';

                return {
                    make: data.make,
                    model: model,
                    year: year,
                    country: data.country,
                };
            }
        }
        return null;
    }

    const year = YEAR_CODES[yearChar] || 'Unknown';
    const models = MODEL_PATTERNS[manufacturer.make] || {};
    const modelChar = upperVIN.charAt(4);
    const model = models[modelChar] || 'Unknown Model';

    return {
        make: manufacturer.make,
        model: model,
        year: year,
        country: manufacturer.country,
    };
};

/**
 * Validate VIN format
 */
const validateVIN = (vin: string): { valid: boolean; error?: string } => {
    if (vin.length !== 17) {
        return { valid: false, error: `VIN must be 17 characters (currently ${vin.length})` };
    }

    // Check for invalid characters (I, O, Q not allowed)
    if (/[IOQ]/i.test(vin)) {
        return { valid: false, error: 'VIN cannot contain I, O, or Q' };
    }

    // Check alphanumeric
    if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
        return { valid: false, error: 'VIN contains invalid characters' };
    }

    return { valid: true };
};

/**
 * Premium VIN Decoder Component
 * Auto-decodes VIN to populate vehicle info
 */
export const VINDecoder: React.FC<VINDecoderProps> = ({
    value,
    onChangeText,
    onDecoded,
}) => {
    const [isDecoding, setIsDecoding] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [decodedInfo, setDecodedInfo] = useState<DecodedVIN | null>(null);

    const handleDecode = async () => {
        if (!value) {
            Alert.alert('Enter VIN', 'Please enter a VIN number to decode');
            return;
        }

        const validation = validateVIN(value);
        if (!validation.valid) {
            setValidationError(validation.error || 'Invalid VIN');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return;
        }

        setIsDecoding(true);
        setValidationError(null);

        try {
            // Simulate API call delay for UX
            await new Promise(resolve => setTimeout(resolve, 800));

            const decoded = decodeVINLocally(value);

            if (decoded) {
                setDecodedInfo(decoded);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                if (onDecoded) {
                    onDecoded(decoded);
                }

                Alert.alert(
                    '✅ VIN Decoded!',
                    `Vehicle: ${decoded.year} ${decoded.make} ${decoded.model}${decoded.country ? `\nOrigin: ${decoded.country}` : ''}`,
                    [
                        { text: 'Auto-Fill', onPress: () => onDecoded?.(decoded), style: 'default' },
                        { text: 'Cancel', style: 'cancel' },
                    ]
                );
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                Alert.alert(
                    'Unknown VIN',
                    'Could not decode this VIN. Please enter vehicle details manually.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.log('VIN decode error:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', 'Failed to decode VIN');
        } finally {
            setIsDecoding(false);
        }
    };

    const handleTextChange = (text: string) => {
        // Auto uppercase and remove invalid chars
        const cleaned = text.toUpperCase().replace(/[IOQ]/g, '');
        onChangeText(cleaned);

        // Clear validation when typing
        if (validationError) {
            setValidationError(null);
        }

        // Clear decoded info when VIN changes
        if (decodedInfo) {
            setDecodedInfo(null);
        }
    };

    const isValid = value.length === 17 && !validationError;

    return (
        <View style={styles.container}>
            <View style={styles.cardWrapper}>
                <LinearGradient
                    colors={['#22c55e', '#16a34a']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.accentBar}
                />
                <View style={styles.cardContent}>
                    <View style={styles.labelRow}>
                        <Text style={styles.labelIcon}>🔐</Text>
                        <Text style={styles.label}>VIN / Chassis Number</Text>
                        <View style={styles.optionalBadge}>
                            <Text style={styles.optionalText}>SMART FILL</Text>
                        </View>
                    </View>
                    <Text style={styles.hint}>
                        💡 Enter 17-character VIN to auto-fill vehicle info
                    </Text>

                    <View style={styles.inputRow}>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={[
                                    styles.input,
                                    validationError && styles.inputError,
                                    isValid && styles.inputValid,
                                ]}
                                placeholder="1HGCG5655WA042039"
                                placeholderTextColor={Colors.dark.textMuted}
                                value={value}
                                onChangeText={handleTextChange}
                                autoCapitalize="characters"
                                maxLength={17}
                            />
                            <Text style={[
                                styles.charCount,
                                value.length === 17 && styles.charCountValid,
                            ]}>
                                {value.length}/17
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.decodeButton, !value && styles.decodeButtonDisabled]}
                            onPress={handleDecode}
                            disabled={!value || isDecoding}
                        >
                            <LinearGradient
                                colors={value ? ['#22c55e', '#16a34a'] : ['#d1d5db', '#9ca3af']}
                                style={styles.decodeGradient}
                            >
                                {isDecoding ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <>
                                        <Text style={styles.decodeIcon}>🔍</Text>
                                        <Text style={styles.decodeText}>Decode</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    {validationError && (
                        <Text style={styles.errorText}>⚠️ {validationError}</Text>
                    )}

                    {decodedInfo && (
                        <View style={styles.resultCard}>
                            <Text style={styles.resultTitle}>✅ Decoded Vehicle</Text>
                            <View style={styles.resultRow}>
                                <Text style={styles.resultLabel}>Make:</Text>
                                <Text style={styles.resultValue}>{decodedInfo.make}</Text>
                            </View>
                            <View style={styles.resultRow}>
                                <Text style={styles.resultLabel}>Model:</Text>
                                <Text style={styles.resultValue}>{decodedInfo.model}</Text>
                            </View>
                            <View style={styles.resultRow}>
                                <Text style={styles.resultLabel}>Year:</Text>
                                <Text style={styles.resultValue}>{decodedInfo.year}</Text>
                            </View>
                            {decodedInfo.country && (
                                <View style={styles.resultRow}>
                                    <Text style={styles.resultLabel}>Origin:</Text>
                                    <Text style={styles.resultValue}>{decodedInfo.country}</Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: Spacing.lg,
    },
    cardWrapper: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.md,
    },
    accentBar: {
        height: 4,
    },
    cardContent: {
        padding: Spacing.md,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    labelIcon: {
        fontSize: 16,
        marginRight: Spacing.xs,
    },
    label: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: Colors.dark.text,
    },
    optionalBadge: {
        marginLeft: 'auto',
        backgroundColor: '#22c55e15',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.full,
    },
    optionalText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#16a34a',
        letterSpacing: 0.5,
    },
    hint: {
        fontSize: FontSizes.xs,
        color: Colors.dark.textMuted,
        marginBottom: Spacing.md,
    },
    inputRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    inputWrapper: {
        flex: 1,
        position: 'relative',
    },
    input: {
        backgroundColor: '#F8F9FA',
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        paddingRight: 60,
        fontSize: FontSizes.md,
        color: Colors.dark.text,
        borderWidth: 2,
        borderColor: '#E8E8E8',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        letterSpacing: 1,
    },
    inputError: {
        borderColor: Colors.error,
        backgroundColor: Colors.error + '10',
    },
    inputValid: {
        borderColor: '#22c55e',
        backgroundColor: '#22c55e10',
    },
    charCount: {
        position: 'absolute',
        right: Spacing.md,
        top: '50%',
        transform: [{ translateY: -8 }],
        fontSize: FontSizes.xs,
        color: Colors.dark.textMuted,
    },
    charCountValid: {
        color: '#22c55e',
        fontWeight: '600',
    },
    decodeButton: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        ...Shadows.sm,
    },
    decodeButtonDisabled: {
        opacity: 0.6,
    },
    decodeGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        height: '100%',
        minHeight: 52,
    },
    decodeIcon: {
        fontSize: 18,
        marginRight: Spacing.xs,
    },
    decodeText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: FontSizes.sm,
    },
    errorText: {
        fontSize: FontSizes.sm,
        color: Colors.error,
        marginTop: Spacing.xs,
    },
    resultCard: {
        marginTop: Spacing.md,
        backgroundColor: '#22c55e15',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: '#22c55e40',
    },
    resultTitle: {
        fontSize: FontSizes.sm,
        fontWeight: '700',
        color: '#16a34a',
        marginBottom: Spacing.sm,
    },
    resultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    resultLabel: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
    },
    resultValue: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: Colors.dark.text,
    },
});

// Need to import Platform
import { Platform } from 'react-native';

export default VINDecoder;
