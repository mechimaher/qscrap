// QScrap Mobile - Manual VIN Entry Screen
// Fallback for when camera scan fails or is unavailable

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../components/Toast';
import { api } from '../services/api';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';

export default function ManualVINEntryScreen({ route }: any) {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const toast = useToast();

    const { onVINScanned } = route.params || {};

    const [vin, setVin] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const validateVIN = (value: string): boolean => {
        // VIN must be exactly 17 characters, alphanumeric (no I, O, Q)
        const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/;
        return vinRegex.test(value.toUpperCase());
    };

    const handleSubmit = async () => {
        const trimmedVIN = vin.trim().toUpperCase();

        if (!validateVIN(trimmedVIN)) {
            toast.error(t('vin.invalidFormat'), t('vin.invalidVin'));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setIsLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            // Decode VIN via existing API
            const result = await api.request<any>('/ocr/vin/decode', {
                method: 'POST',
                body: JSON.stringify({ vin: trimmedVIN })
            });

            if (result.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                toast.success(t('vin.decoded'), `${result.make} ${result.model} ${result.year}`);

                const vehicleData = {
                    vin: trimmedVIN,
                    make: result.make || '',
                    model: result.model || '',
                    year: result.year || new Date().getFullYear(),
                    confidence: 100
                };

                if (onVINScanned) {
                    onVINScanned(vehicleData);
                    navigation.goBack();
                } else {
                    navigation.navigate('NewRequest', { vehicleData });
                }
            } else {
                throw new Error('Could not decode VIN');
            }
        } catch (error: any) {
            console.error('[Manual VIN] Error:', error);
            toast.error(t('vin.decodeFailed'), error.message || t('common.tryAgain'));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsLoading(false);
        }
    };

    const isValidFormat = vin.trim().length === 0 || validateVIN(vin.trim());

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>
                        {t('vin.enterVinTitle')}
                    </Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.content}>
                    {/* Info Card */}
                    <View style={[styles.infoCard, { backgroundColor: colors.surface, flexDirection: rtlFlexDirection(isRTL) }]}>
                        <Ionicons name="information-circle" size={24} color={Colors.primary} />
                        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                            {t('vin.infoText')}
                        </Text>
                    </View>

                    {/* VIN Input */}
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{t('vin.vinNumber')}</Text>
                        <View style={[
                            styles.inputContainer,
                            {
                                backgroundColor: colors.surface,
                                borderColor: !isValidFormat ? Colors.error : vin.length === 17 ? Colors.success : colors.border,
                                flexDirection: rtlFlexDirection(isRTL)
                            }
                        ]}>
                            <TextInput
                                style={[styles.input, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}
                                value={vin}
                                onChangeText={(text) => setVin(text.toUpperCase())}
                                placeholder={t('vin.enter17Char')}
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                maxLength={17}
                            />
                            <Text style={[styles.counter, { color: vin.length === 17 ? Colors.success : colors.textMuted }]}>
                                {vin.length}/17
                            </Text>
                        </View>
                        {!isValidFormat && (
                            <Text style={[styles.errorText, { color: Colors.error, textAlign: rtlTextAlign(isRTL) }]}>
                                {t('vin.invalidVin')}
                            </Text>
                        )}
                    </View>

                    {/* VIN Location Tips */}
                    <View style={[styles.tipsCard, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.tipsTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                            {t('vin.whereToFind')}:
                        </Text>
                        <View style={[styles.tipRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Ionicons name="car-outline" size={20} color={colors.textSecondary} />
                            <Text style={[styles.tipText, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                                {t('vin.locationDashboard')}
                            </Text>
                        </View>
                        <View style={[styles.tipRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
                            <Text style={[styles.tipText, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                                {t('vin.locationRegCard')}
                            </Text>
                        </View>
                        <View style={[styles.tipRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Ionicons name="reader-outline" size={20} color={colors.textSecondary} />
                            <Text style={[styles.tipText, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                                {t('vin.locationDoorJamb')}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Submit Button */}
                <View style={[styles.footer, { borderTopColor: colors.border }]}>
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={!validateVIN(vin.trim()) || isLoading}
                        style={styles.submitButton}
                    >
                        <LinearGradient
                            colors={validateVIN(vin.trim()) && !isLoading
                                ? [Colors.primary, Colors.primaryDark]
                                : [colors.border, Colors.theme.borderLight]
                            }
                            style={styles.buttonGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <View style={[styles.buttonContent, { flexDirection: rtlFlexDirection(isRTL) }]}>
                                    <Text style={styles.buttonText}>{t('vin.decodeVin')}</Text>
                                    <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={20} color="#fff" />
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        borderBottomWidth: 1,
    },
    backButton: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '700' },
    content: {
        flex: 1,
        padding: Spacing.lg,
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.lg,
        gap: Spacing.sm,
    },
    infoText: {
        flex: 1,
        fontSize: FontSizes.sm,
        lineHeight: 20,
    },
    inputGroup: {
        marginBottom: Spacing.lg,
    },
    label: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        marginBottom: Spacing.xs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md,
    },
    input: {
        flex: 1,
        height: 56,
        fontSize: FontSizes.lg,
        fontWeight: '600',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    counter: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
    },
    errorText: {
        fontSize: FontSizes.xs,
        marginTop: 4,
        marginLeft: 4,
    },
    tipsCard: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
    },
    tipsTitle: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        marginBottom: Spacing.sm,
    },
    tipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.xs,
        gap: Spacing.sm,
    },
    tipText: {
        flex: 1,
        fontSize: FontSizes.sm,
    },
    footer: {
        padding: Spacing.lg,
        borderTopWidth: 1,
    },
    submitButton: {
        width: '100%',
    },
    buttonGradient: {
        paddingVertical: Spacing.lg,
        borderRadius: BorderRadius.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    buttonText: {
        color: '#fff',
        fontSize: FontSizes.lg,
        fontWeight: '700',
    },
});
