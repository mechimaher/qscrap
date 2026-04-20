import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { Colors, Spacing, BorderRadius, FontSizes } from '../../constants/theme';
import SearchableDropdown from '../SearchableDropdown';
import PartSpecsCard from './PartSpecsCard';
import { PART_CATEGORIES } from '../../constants/categoryData';

export default function PartDetailsStep({
    colors,
    t,
    isRTL,
    rtlFlexDirection,
    rtlTextAlign,
    partCategory,
    setPartCategory,
    availableSubCategories,
    partSubCategory,
    setPartSubCategory,
    partDescription,
    setPartDescription,
    quantity,
    setQuantity,
    side,
    setSide,
    partNumber,
    setPartNumber,
    condition,
    setCondition,
    CONDITION_OPTIONS
}: any) {
    return (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={[styles.sectionHeader, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <View style={[styles.stepBadge, { backgroundColor: '#F59E0B15' }, isRTL && { marginRight: 0, marginLeft: Spacing.md }]}>
                    <Text style={[styles.stepNumber, { color: '#F59E0B' }]}>2</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{t('newRequest.partDetails')}</Text>
                    <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                        {t('newRequest.whatDoYouNeed')}
                    </Text>
                </View>
            </View>

            <SearchableDropdown
                label={t('newRequest.categoryOptional')}
                placeholder={t('newRequest.categoryPlaceholder')}
                items={PART_CATEGORIES}
                value={partCategory}
                onSelect={setPartCategory}
            />

            {partCategory && availableSubCategories.length > 0 && (
                <SearchableDropdown
                    label={t('newRequest.subcategoryOptional')}
                    placeholder={t('newRequest.selectSubcategory')}
                    items={availableSubCategories}
                    value={partSubCategory}
                    onSelect={setPartSubCategory}
                />
            )}

            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                    {t('newRequest.description')} *
                </Text>
                <TextInput
                    style={[
                        styles.textArea,
                        {
                            backgroundColor: colors.background,
                            color: colors.text,
                            borderColor: colors.border,
                            textAlign: rtlTextAlign(isRTL)
                        },
                    ]}
                    placeholder={t('newRequest.descriptionPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={partDescription}
                    onChangeText={setPartDescription}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                />
                <Text style={[styles.charCount, { color: colors.textMuted }]}>
                    {partDescription.length}/500
                </Text>
            </View>

            <PartSpecsCard
                quantity={quantity}
                onQuantityChange={setQuantity}
                side={side}
                onSideChange={setSide}
                partNumber={partNumber}
                onPartNumberChange={setPartNumber}
                condition={condition}
                onConditionChange={setCondition}
                conditionOptions={CONDITION_OPTIONS}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.lg,
        gap: Spacing.md,
    },
    stepBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNumber: { fontSize: FontSizes.md, fontWeight: '800' },
    sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
    sectionSubtitle: { fontSize: FontSizes.sm, marginTop: 2 },
    inputGroup: { marginBottom: Spacing.md },
    label: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        marginBottom: Spacing.xs,
    },
    textArea: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: FontSizes.md,
        minHeight: 120,
    },
    charCount: {
        fontSize: FontSizes.xs,
        marginTop: Spacing.xs,
        textAlign: 'right',
    },
});
