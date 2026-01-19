// QScrap - VIN Scanner Screen (Simplified)
// Manual VIN entry with premium UI - camera scanning coming soon

import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Animated,
    Keyboard,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';

interface VINScannerScreenProps {
    route?: {
        params?: {
            onVINScanned?: (vehicleData: any) => void;
        };
    };
}

export default function VINScannerScreen({ route }: VINScannerScreenProps) {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();
    const [vin, setVin] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    const onVINScanned = route?.params?.onVINScanned;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();
    }, []);

    const validateVIN = (vinNumber: string): boolean => {
        // VIN must be 17 characters
        if (vinNumber.length !== 17) return false;
        // VIN cannot contain I, O, Q
        if (/[IOQ]/i.test(vinNumber)) return false;
        return true;
    };

    const handleSubmit = async () => {
        Keyboard.dismiss();
        const cleanVin = vin.toUpperCase().trim();

        if (!cleanVin) {
            setError('Please enter a VIN number');
            return;
        }

        if (!validateVIN(cleanVin)) {
            setError('Invalid VIN. Must be 17 characters (no I, O, Q)');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setError('');
        setIsLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Simulate VIN decode (in production, call actual API)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mock vehicle data based on VIN pattern
        const vehicleData = {
            vin: cleanVin,
            make: cleanVin.startsWith('W') ? 'Volkswagen' : cleanVin.startsWith('1') ? 'Chevrolet' : 'Toyota',
            model: 'Auto-detected',
            year: 2020 + Math.floor(Math.random() * 5),
            confidence: 95
        };

        setIsLoading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (onVINScanned) {
            onVINScanned(vehicleData);
            navigation.goBack();
        } else {
            navigation.navigate('NewRequest', { vehicleData });
        }
    };

    const handleHelp = () => {
        Alert.alert(
            'Where to Find VIN',
            '• Dashboard near windshield (driver side)\n• Driver door jamb sticker\n• Vehicle registration/title\n• Insurance card',
            [{ text: 'Got it!' }]
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="close" size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Enter VIN</Text>
                <TouchableOpacity onPress={handleHelp} style={styles.helpBtn}>
                    <Ionicons name="help-circle-outline" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                {/* Icon */}
                <View style={styles.iconSection}>
                    <LinearGradient
                        colors={[Colors.primary + '20', Colors.primary + '10']}
                        style={styles.iconBg}
                    >
                        <Text style={styles.iconEmoji}>🔍</Text>
                    </LinearGradient>
                </View>

                {/* Title */}
                <Text style={[styles.title, { color: colors.text }]}>
                    Vehicle Identification Number
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Enter your 17-character VIN to get accurate part quotes
                </Text>

                {/* VIN Input */}
                <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: error ? Colors.error : colors.border }]}>
                    <TextInput
                        style={[styles.input, { color: colors.text }]}
                        value={vin}
                        onChangeText={(text) => {
                            setVin(text.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                            setError('');
                        }}
                        placeholder="e.g. WVWZZZ3CZWE123456"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={17}
                        returnKeyType="done"
                        onSubmitEditing={handleSubmit}
                    />
                    <Text style={[styles.charCount, { color: vin.length === 17 ? Colors.success : colors.textMuted }]}>
                        {vin.length}/17
                    </Text>
                </View>

                {error ? (
                    <Text style={styles.errorText}>{error}</Text>
                ) : null}

                {/* Submit Button */}
                <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={isLoading}
                    style={styles.submitBtn}
                >
                    <LinearGradient
                        colors={isLoading ? ['#999', '#777'] : [Colors.primary, '#6b1029']}
                        style={styles.submitGradient}
                    >
                        {isLoading ? (
                            <Text style={styles.submitText}>Decoding...</Text>
                        ) : (
                            <>
                                <Text style={styles.submitText}>Decode VIN</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                {/* Tips */}
                <View style={[styles.tipCard, { backgroundColor: colors.surfaceElevated }]}>
                    <Text style={styles.tipEmoji}>💡</Text>
                    <View style={styles.tipContent}>
                        <Text style={[styles.tipTitle, { color: colors.text }]}>Pro Tip</Text>
                        <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                            VIN is on the dashboard (driver side) or door jamb sticker
                        </Text>
                    </View>
                </View>
            </Animated.View>
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
    },
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
    helpBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    content: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
    iconSection: { alignItems: 'center', marginBottom: Spacing.lg },
    iconBg: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconEmoji: { fontSize: 36 },
    title: { fontSize: FontSizes.xl, fontWeight: '700', textAlign: 'center', marginBottom: Spacing.xs },
    subtitle: { fontSize: FontSizes.sm, textAlign: 'center', marginBottom: Spacing.xl },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BorderRadius.lg,
        borderWidth: 2,
        paddingHorizontal: Spacing.md,
        marginBottom: Spacing.sm,
    },
    input: {
        flex: 1,
        fontSize: FontSizes.lg,
        fontFamily: 'monospace',
        letterSpacing: 1,
        paddingVertical: Spacing.md,
    },
    charCount: { fontSize: FontSizes.sm, fontWeight: '600' },
    errorText: { color: Colors.error, fontSize: FontSizes.sm, marginBottom: Spacing.md },
    submitBtn: { marginTop: Spacing.md, marginBottom: Spacing.xl },
    submitGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        gap: Spacing.sm,
    },
    submitText: { color: '#fff', fontSize: FontSizes.lg, fontWeight: '700' },
    tipCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
    },
    tipEmoji: { fontSize: 20, marginRight: Spacing.sm },
    tipContent: { flex: 1 },
    tipTitle: { fontSize: FontSizes.sm, fontWeight: '600' },
    tipText: { fontSize: FontSizes.xs, marginTop: 2 },
});
