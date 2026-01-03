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
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

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
        if (item === 'Other') {
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
            {label && <Text style={styles.label}>{label}</Text>}

            <TouchableOpacity
                style={[styles.selector, disabled && styles.disabled]}
                onPress={() => !disabled && setVisible(true)}
                activeOpacity={0.7}
                disabled={disabled}
            >
                <Text style={[styles.valueText, !value && styles.placeholderText]}>
                    {value || placeholder}
                </Text>
                <Text style={styles.arrowIcon}>▼</Text>
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
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{placeholder}</Text>
                            <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeButton}>
                                <Text style={styles.closeIcon}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {!isCustom ? (
                            <>
                                <View style={styles.searchContainer}>
                                    <Text style={styles.searchIcon}>🔍</Text>
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Search..."
                                        placeholderTextColor="#999"
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
                                            style={styles.item}
                                            onPress={() => handleSelect(item)}
                                        >
                                            <Text style={[
                                                styles.itemText,
                                                item === value && styles.selectedItemText,
                                                item === 'Other' && styles.otherItemText
                                            ]}>
                                                {item}
                                            </Text>
                                            {item === value && <Text style={styles.checkIcon}>✓</Text>}
                                        </TouchableOpacity>
                                    )}
                                    ListEmptyComponent={
                                        <Text style={styles.emptyText}>No matches found</Text>
                                    }
                                />
                            </>
                        ) : (
                            <View style={styles.customContainer}>
                                <Text style={styles.customLabel}>Enter manually:</Text>
                                <TextInput
                                    style={styles.customInput}
                                    placeholder={`Type ${label || 'value'}...`}
                                    placeholderTextColor="#999"
                                    value={customValue}
                                    onChangeText={setCustomValue}
                                    autoFocus={true}
                                />
                                <TouchableOpacity onPress={handleCustomSubmit}>
                                    <LinearGradient
                                        colors={Colors.gradients.primary}
                                        style={styles.submitButton}
                                    >
                                        <Text style={styles.submitButtonText}>Confirm</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.backButton}
                                    onPress={() => setIsCustom(false)}
                                >
                                    <Text style={styles.backButtonText}>Back to List</Text>
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
    closeIcon: { fontSize: 20, color: '#525252' },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        borderRadius: BorderRadius.lg,
        marginHorizontal: Spacing.lg,
        paddingHorizontal: Spacing.md,
        height: 48,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    searchIcon: { fontSize: 16, marginRight: Spacing.sm },
    searchInput: {
        flex: 1,
        color: '#1a1a2e',
        fontSize: FontSizes.md,
    },
    list: { paddingHorizontal: Spacing.lg },
    item: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    itemText: {
        fontSize: FontSizes.md,
        color: '#1a1a2e',
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
