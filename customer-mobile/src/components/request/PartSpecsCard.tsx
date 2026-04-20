import { log } from '../../utils/logger';
/**
 * PartSpecsCard - Extracted from NewRequestScreen
 * Handles: quantity stepper, side selection, part number, condition preference
 */
import React, { memo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes } from '../../constants/theme';
import { useTranslation } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts';
import { rtlFlexDirection, rtlTextAlign } from '../../utils/rtl';
import { Ionicons } from '@expo/vector-icons';

export type PartSide = 'left' | 'right' | 'both' | 'na';

interface ConditionOption {
    value: string;
    label: string;
    icon: string;
    color: string;
}

interface PartSpecsCardProps {
    quantity: number;
    onQuantityChange: (q: number) => void;
    side: PartSide;
    onSideChange: (s: PartSide) => void;
    partNumber: string;
    onPartNumberChange: (v: string) => void;
    condition: string;
    onConditionChange: (v: string) => void;
    conditionOptions: ConditionOption[];
}

function PartSpecsCard({
    quantity,
    onQuantityChange,
    side,
    onSideChange,
    partNumber,
    onPartNumberChange,
    condition,
    onConditionChange,
    conditionOptions,
}: PartSpecsCardProps) {
    const { t, isRTL } = useTranslation();
    const { colors } = useTheme();

    const sideOptions = [
        { value: 'left' as const, label: t('newRequest.leftSide'), icon: 'chevron-back' as const },
        { value: 'right' as const, label: t('newRequest.rightSide'), icon: 'chevron-forward' as const },
        { value: 'both' as const, label: t('newRequest.bothSides'), icon: 'swap-horizontal' as const },
        { value: 'na' as const, label: t('newRequest.notApplicable'), icon: 'settings-outline' as const },
    ];

    return (
        <>
            {/* Part Specifications Card */}
            <View style={[styles.specsCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={[styles.specsHeader, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    <Ionicons name="clipboard-outline" size={20} color={colors.text} />
                    <Text style={[styles.specsTitle, { color: colors.text }]}>{t('newRequest.partSpecs')}</Text>
                </View>

                {/* Quantity Stepper */}
                <View style={styles.specsRow}>
                    <Text style={[styles.specsLabel, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('newRequest.quantity')}
                    </Text>
                    <View style={[styles.quantityStepper, { flexDirection: rtlFlexDirection(isRTL) }]}>
                        <TouchableOpacity
                            onPress={() => {
                                if (quantity > 1) {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    onQuantityChange(Math.max(1, quantity - 1));
                                }
                            }}
                            style={[styles.stepperBtn, { backgroundColor: quantity > 1 ? Colors.primary + '15' : colors.border }]}
                        >
                            <Text style={[styles.stepperBtnText, { color: quantity > 1 ? Colors.primary : colors.textMuted }]}>−</Text>
                        </TouchableOpacity>
                        <View style={[styles.stepperValue, { backgroundColor: colors.surface }]}>
                            <Text style={[styles.stepperValueText, { color: colors.text }]}>{quantity}</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                if (quantity < 10) {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    onQuantityChange(Math.min(10, quantity + 1));
                                }
                            }}
                            style={[styles.stepperBtn, { backgroundColor: quantity < 10 ? Colors.primary + '15' : colors.border }]}
                        >
                            <Text style={[styles.stepperBtnText, { color: quantity < 10 ? Colors.primary : colors.textMuted }]}>+</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Side Selection */}
                <View style={styles.specsRow}>
                    <Text style={[styles.specsLabel, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('newRequest.side')}
                    </Text>
                </View>
                <View style={[styles.sideGrid, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    {sideOptions.map((opt) => (
                        <TouchableOpacity
                            key={opt.value}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                onSideChange(opt.value);
                            }}
                            style={[
                                styles.sideCard,
                                {
                                    backgroundColor: side === opt.value ? Colors.primary + '15' : colors.surface,
                                    borderColor: side === opt.value ? Colors.primary : colors.border,
                                    borderWidth: side === opt.value ? 2 : 1,
                                },
                            ]}
                        >
                            <Ionicons name={opt.icon} size={20} color={side === opt.value ? Colors.primary : colors.text} />
                            <Text style={[styles.sideLabel, { color: side === opt.value ? Colors.primary : colors.text }]}>
                                {opt.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Part Number (Optional) */}
            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                    {t('newRequest.partNumberOptional')}
                </Text>
                <TextInput
                    style={[
                        styles.input,
                        {
                            backgroundColor: colors.background,
                            color: colors.text,
                            borderColor: colors.border,
                            textAlign: rtlTextAlign(isRTL),
                        },
                    ]}
                    placeholder={t('newRequest.partNumberPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={partNumber}
                    onChangeText={onPartNumberChange}
                    autoCapitalize="characters"
                />
            </View>

            {/* Condition */}
            <Text style={[styles.label, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                {t('newRequest.conditionPreference')}
            </Text>
            <View style={[styles.conditionGrid, { flexDirection: rtlFlexDirection(isRTL) }]}>
                {conditionOptions.map((opt) => (
                    <TouchableOpacity
                        key={opt.value}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onConditionChange(opt.value);
                        }}
                        style={[
                            styles.conditionCard,
                            {
                                backgroundColor: condition === opt.value ? opt.color + '15' : colors.background,
                                borderColor: condition === opt.value ? opt.color : colors.border,
                                borderWidth: condition === opt.value ? 2 : 1,
                            },
                        ]}
                    >
                        <Ionicons name={opt.icon as any} size={24} color={condition === opt.value ? opt.color : colors.text} />
                        <Text
                            style={[
                                styles.conditionLabel,
                                { color: condition === opt.value ? opt.color : colors.text },
                            ]}
                        >
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </>
    );
}

export default memo(PartSpecsCard);

const styles = StyleSheet.create({
    specsCard: {
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        padding: Spacing.lg,
        marginTop: Spacing.md,
    },
    specsHeader: {
        alignItems: 'center',
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    specsIcon: {
        fontSize: 20,
    },
    specsTitle: {
        fontSize: FontSizes.md,
        fontWeight: '700',
    },
    specsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    specsLabel: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
    },
    quantityStepper: {
        alignItems: 'center',
        gap: Spacing.sm,
    },
    stepperBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperBtnText: {
        fontSize: 20,
        fontWeight: '700',
    },
    stepperValue: {
        width: 48,
        height: 36,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperValueText: {
        fontSize: FontSizes.lg,
        fontWeight: '800',
    },
    sideGrid: {
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    sideCard: {
        flex: 1,
        minWidth: '22%',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
    },
    sideIcon: {
        fontSize: 20,
        marginBottom: 4,
    },
    sideLabel: {
        fontSize: FontSizes.xs,
        fontWeight: '600',
    },
    inputGroup: {
        marginTop: Spacing.md,
    },
    label: {
        fontSize: FontSizes.sm,
        fontWeight: '700',
        marginBottom: Spacing.sm,
    },
    input: {
        borderWidth: 1,
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        fontSize: FontSizes.md,
    },
    conditionGrid: {
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    conditionCard: {
        flex: 1,
        minWidth: '30%',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
    },
    conditionIcon: {
        fontSize: 24,
        marginBottom: 4,
    },
    conditionLabel: {
        fontSize: FontSizes.xs,
        fontWeight: '600',
        textAlign: 'center',
    },
});
