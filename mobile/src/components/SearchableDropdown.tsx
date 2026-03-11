import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    FlatList,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlTextAlign, rtlFlexDirection } from '../utils/rtl';

interface SearchableDropdownProps {
    items: string[];
    placeholder: string;
    value: string;
    onSelect: (item: string) => void;
    label?: string;
    disabled?: boolean;
}

export default function SearchableDropdown({
    items,
    placeholder,
    value,
    onSelect,
    label,
    disabled = false,
}: SearchableDropdownProps) {
    const { t, isRTL } = useTranslation();
    const { colors } = useTheme();
    const [visible, setVisible] = useState(false);
    const [search, setSearch] = useState('');
    const [filteredItems, setFilteredItems] = useState(items);
    const [customValue, setCustomValue] = useState('');
    const [isCustom, setIsCustom] = useState(false);

    useEffect(() => {
        setFilteredItems(
            items.filter(i => i.toLowerCase().includes(search.toLowerCase()))
        );
    }, [search, items]);

    const handleSelect = (item: string) => {
        if (item === 'Other' || item === t('common.other')) {
            setIsCustom(true);
            setCustomValue('');
        } else {
            onSelect(item);
            setVisible(false);
            setSearch('');
            setIsCustom(false);
            Haptics.selectionAsync();
        }
    };

    const handleCustomSubmit = () => {
        if (customValue.trim()) {
            onSelect(customValue.trim());
            setVisible(false);
            setSearch('');
            setIsCustom(false);
            Haptics.selectionAsync();
        }
    };

    return (
        <View style={styles.container}>
            {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}

            <TouchableOpacity
                style={[styles.selector, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, disabled && styles.disabled, { flexDirection: rtlFlexDirection(isRTL) }]}
                onPress={() => !disabled && setVisible(true)}
                activeOpacity={0.7}
                disabled={disabled}
            >
                <Text style={[styles.valueText, { color: colors.text }, !value && { color: colors.textMuted }, { textAlign: rtlTextAlign(isRTL) }]}>
                    {value || placeholder}
                </Text>
                <Text style={[styles.arrowIcon, { color: colors.textMuted }, isRTL ? { marginRight: Spacing.sm, marginLeft: 0 } : { marginLeft: Spacing.sm }]}>▼</Text>
            </TouchableOpacity>

            <Modal
                visible={visible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalOverlay}
                >
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <View style={[styles.modalHeader, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>{placeholder}</Text>
                            <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeButton}>
                                <Text style={[styles.closeIcon, { color: colors.text }]}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {!isCustom ? (
                            <>
                                <View style={[styles.searchContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                                    <Ionicons name="search" size={16} color={colors.textMuted} style={isRTL ? { marginLeft: Spacing.sm } : { marginRight: Spacing.sm }} />
                                    <TextInput
                                        style={[styles.searchInput, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}
                                        placeholder={t('common.searchPlaceholder')}
                                        placeholderTextColor={colors.textMuted}
                                        value={search}
                                        onChangeText={setSearch}
                                        autoFocus={true}
                                    />
                                </View>

                                <FlatList
                                    data={[...filteredItems, 'Other']}
                                    keyExtractor={(item) => item}
                                    style={styles.list}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={[styles.item, { borderBottomColor: colors.border }, { flexDirection: rtlFlexDirection(isRTL) }]}
                                            onPress={() => handleSelect(item)}
                                        >
                                            <Text style={[
                                                styles.itemText,
                                                { color: colors.text },
                                                item === value && styles.selectedItemText,
                                                item === t('common.other') && styles.otherItemText
                                            ]}>
                                                {item}
                                            </Text>
                                            {item === value && <Text style={styles.checkIcon}>✓</Text>}
                                        </TouchableOpacity>
                                    )}
                                    ListEmptyComponent={
                                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('common.noMatches')}</Text>
                                    }
                                />
                            </>
                        ) : (
                            <View style={styles.customContainer}>
                                <Text style={[styles.customLabel, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{t('common.enterManually')}</Text>
                                <TextInput
                                    style={[styles.customInput, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border, textAlign: rtlTextAlign(isRTL) }]}
                                    placeholder={t('common.typeValue', { label: label || 'value' })}
                                    placeholderTextColor={colors.textMuted}
                                    value={customValue}
                                    onChangeText={setCustomValue}
                                    autoFocus={true}
                                />
                                <TouchableOpacity onPress={handleCustomSubmit}>
                                    <LinearGradient
                                        colors={Colors.gradients.primary}
                                        style={styles.submitButton}
                                    >
                                        <Text style={styles.submitButtonText}>{t('common.confirm')}</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.backButton, { backgroundColor: colors.surfaceSecondary }]}
                                    onPress={() => setIsCustom(false)}
                                >
                                    <Text style={[styles.backButtonText, { color: colors.text }]}>{t('common.backToList')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginBottom: Spacing.md },
    label: {
        fontSize: FontSizes.sm,
        color: '#525252',
        marginBottom: Spacing.xs,
        fontWeight: '600',
    },
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8F9FA',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        height: 52,
        ...Shadows.sm,
    },
    disabled: { opacity: 0.5 },
    valueText: {
        fontSize: FontSizes.md,
        color: '#1a1a2e',
        flex: 1,
        fontWeight: '500',
    },
    placeholderText: { color: '#9CA3AF' },
    arrowIcon: {
        fontSize: 12,
        color: '#6B7280',
        marginLeft: Spacing.sm,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        paddingTop: Spacing.lg,
        maxHeight: '80%',
        minHeight: 400,
        ...Shadows.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
    },
    modalTitle: {
        fontSize: FontSizes.xl,
        fontWeight: '700',
        color: '#1a1a2e',
    },
    closeButton: {
        padding: Spacing.sm,
    },
    closeIcon: { fontSize: 20 },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BorderRadius.lg,
        marginHorizontal: Spacing.lg,
        paddingHorizontal: Spacing.md,
        height: 48,
        marginBottom: Spacing.md,
        borderWidth: 1,
    },
    searchIcon: { fontSize: 16, marginRight: Spacing.sm },
    searchInput: {
        flex: 1,
        fontSize: FontSizes.md,
    },
    list: { paddingHorizontal: Spacing.lg },
    item: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
    },
    itemText: {
        fontSize: FontSizes.md,
    },
    selectedItemText: {
        color: Colors.primary,
        fontWeight: '700',
    },
    otherItemText: {
        color: Colors.secondary,
        fontStyle: 'italic',
    },
    checkIcon: {
        color: Colors.primary,
        fontWeight: '700',
    },
    emptyText: {
        textAlign: 'center',
        color: '#525252',
        marginTop: Spacing.xl,
    },
    customContainer: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.xxl,
    },
    customLabel: {
        fontSize: FontSizes.md,
        color: '#1a1a1a',
        marginBottom: Spacing.md,
    },
    customInput: {
        backgroundColor: '#F8F9FA',  // Light background
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        color: '#1a1a1a',  // Dark text
        fontSize: FontSizes.md,
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    submitButton: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    submitButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: FontSizes.md,
    },
    backButton: {
        marginTop: Spacing.md,
        alignItems: 'center',
        padding: Spacing.sm,
    },
    backButtonText: {
        color: '#525252',
    },
});
