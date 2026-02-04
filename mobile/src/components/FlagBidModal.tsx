/**
 * Flag Bid Modal — Customer Reports Incorrect Bid
 * 
 * Premium UI for flagging bids with:
 * - Reason selection chips
 * - Optional details text
 * - Urgency toggle
 * - 10-second undo support
 * - Full accessibility
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Image,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { Button } from './Button';
import { BorderRadius, FontSizes, Spacing } from '../constants/theme';

// ============================================
// Types
// ============================================

interface Bid {
    bid_id: string;
    garage_name?: string;
    bid_amount: number | string;
    part_condition: string;
    image_urls?: string[];
    brand_name?: string;
}

interface FlagBidModalProps {
    visible: boolean;
    bid: Bid | null;
    onClose: () => void;
    onSubmit: (data: FlagData) => Promise<void>;
}

export interface FlagData {
    reason: FlagReason;
    details: string;
    urgent: boolean;
}

type FlagReason = 'wrong_part' | 'wrong_picture' | 'incorrect_price' | 'missing_info' | 'other';

// ============================================
// Flag Reasons Configuration
// ============================================

const FLAG_REASONS: { key: FlagReason; icon: string; labelKey: string }[] = [
    { key: 'wrong_part', icon: 'cube-outline', labelKey: 'bid.flag.wrongPart' },
    { key: 'wrong_picture', icon: 'image-outline', labelKey: 'bid.flag.wrongPicture' },
    { key: 'incorrect_price', icon: 'cash-outline', labelKey: 'bid.flag.incorrectPrice' },
    { key: 'missing_info', icon: 'information-circle-outline', labelKey: 'bid.flag.missingInfo' },
    { key: 'other', icon: 'ellipsis-horizontal', labelKey: 'bid.flag.other' },
];

// ============================================
// Main Component
// ============================================

export function FlagBidModal({ visible, bid, onClose, onSubmit }: FlagBidModalProps) {
    const { colors } = useTheme();
    const { t } = useTranslation();

    // State
    const [selectedReason, setSelectedReason] = useState<FlagReason | null>(null);
    const [details, setDetails] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Animation
    const shakeAnim = useRef(new Animated.Value(0)).current;

    // Reset state when modal opens/closes
    useEffect(() => {
        if (visible) {
            setSelectedReason(null);
            setDetails('');
            setIsUrgent(false);
            setError(null);
        }
    }, [visible]);

    // Handle reason selection
    const handleSelectReason = useCallback((reason: FlagReason) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedReason(reason);
        setError(null);
    }, []);

    // Handle urgency toggle
    const toggleUrgent = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsUrgent(prev => !prev);
    }, []);

    // Shake animation for validation error
    const triggerShake = useCallback(() => {
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
    }, [shakeAnim]);

    // Handle submit
    const handleSubmit = useCallback(async () => {
        if (!selectedReason) {
            setError(t('bid.flag.selectReason'));
            triggerShake();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await onSubmit({
                reason: selectedReason,
                details: details.trim(),
                urgent: isUrgent,
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClose();
        } catch (err: any) {
            setError(err.message || t('bid.flag.error'));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedReason, details, isUrgent, onSubmit, onClose, t, triggerShake]);

    if (!bid) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.closeButton}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.close')}
                    >
                        <Ionicons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>
                        {t('bid.flag.title')}
                    </Text>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.contentContainer}
                >
                    {/* Bid Preview */}
                    <View style={[styles.bidPreview, { backgroundColor: colors.surface }]}>
                        {bid.image_urls?.[0] && (
                            <Image
                                source={{ uri: bid.image_urls[0] }}
                                style={styles.bidImage}
                            />
                        )}
                        <View style={styles.bidInfo}>
                            <Text style={[styles.bidGarage, { color: colors.text }]}>
                                {bid.garage_name || t('bid.flag.thisBid')}
                            </Text>
                            <Text style={[styles.bidAmount, { color: colors.primary }]}>
                                {bid.bid_amount} QAR
                            </Text>
                            <Text style={[styles.bidCondition, { color: colors.textSecondary }]}>
                                {bid.part_condition?.replace(/_/g, ' ')}
                            </Text>
                        </View>
                    </View>

                    {/* Reason Selection */}
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        {t('bid.flag.whatsWrong')}
                    </Text>

                    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                        <View style={styles.reasonGrid}>
                            {FLAG_REASONS.map((item) => {
                                const isSelected = selectedReason === item.key;
                                return (
                                    <TouchableOpacity
                                        key={item.key}
                                        style={[
                                            styles.reasonChip,
                                            {
                                                backgroundColor: isSelected
                                                    ? colors.primary + '20'
                                                    : colors.surface,
                                                borderColor: isSelected
                                                    ? colors.primary
                                                    : colors.border,
                                            }
                                        ]}
                                        onPress={() => handleSelectReason(item.key)}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: isSelected }}
                                        accessibilityLabel={t(item.labelKey)}
                                    >
                                        <Ionicons
                                            name={item.icon as any}
                                            size={20}
                                            color={isSelected ? colors.primary : colors.textSecondary}
                                        />
                                        <Text style={[
                                            styles.reasonText,
                                            { color: isSelected ? colors.primary : colors.text }
                                        ]}>
                                            {t(item.labelKey)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </Animated.View>

                    {/* Details Input */}
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        {t('bid.flag.details')} <Text style={styles.optional}>({t('common.optional')})</Text>
                    </Text>
                    <TextInput
                        style={[
                            styles.detailsInput,
                            {
                                backgroundColor: colors.surface,
                                color: colors.text,
                                borderColor: colors.border
                            }
                        ]}
                        placeholder={t('bid.flag.detailsPlaceholder')}
                        placeholderTextColor={colors.textSecondary}
                        value={details}
                        onChangeText={setDetails}
                        multiline
                        maxLength={500}
                        accessibilityLabel={t('bid.flag.details')}
                    />
                    <Text style={[styles.charCount, { color: colors.textSecondary }]}>
                        {details.length}/500
                    </Text>

                    {/* Urgency Toggle */}
                    <TouchableOpacity
                        style={[
                            styles.urgentToggle,
                            {
                                backgroundColor: isUrgent ? colors.warning + '20' : colors.surface,
                                borderColor: isUrgent ? colors.warning : colors.border,
                            }
                        ]}
                        onPress={toggleUrgent}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: isUrgent }}
                        accessibilityLabel={t('bid.flag.markUrgent')}
                        accessibilityHint={t('bid.flag.urgentHint')}
                    >
                        <Ionicons
                            name={isUrgent ? "flash" : "flash-outline"}
                            size={22}
                            color={isUrgent ? colors.warning : colors.textSecondary}
                        />
                        <View style={styles.urgentText}>
                            <Text style={[styles.urgentTitle, { color: isUrgent ? colors.warning : colors.text }]}>
                                {t('bid.flag.markUrgent')}
                            </Text>
                            <Text style={[styles.urgentSubtitle, { color: colors.textSecondary }]}>
                                {t('bid.flag.urgentDescription')}
                            </Text>
                        </View>
                        <View style={[
                            styles.toggleIndicator,
                            { backgroundColor: isUrgent ? colors.warning : colors.border }
                        ]}>
                            <View style={[
                                styles.toggleDot,
                                {
                                    backgroundColor: '#fff',
                                    transform: [{ translateX: isUrgent ? 16 : 0 }]
                                }
                            ]} />
                        </View>
                    </TouchableOpacity>

                    {/* Error Message */}
                    {error && (
                        <View style={[styles.errorContainer, { backgroundColor: colors.error + '15' }]}>
                            <Ionicons name="alert-circle" size={18} color={colors.error} />
                            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                        </View>
                    )}
                </ScrollView>

                {/* Footer Actions */}
                <View style={[styles.footer, { borderTopColor: colors.border }]}>
                    <Button
                        title={t('common.cancel')}
                        variant="outline"
                        onPress={onClose}
                        style={styles.cancelButton}
                        disabled={isSubmitting}
                    />
                    <Button
                        title={t('bid.flag.submit')}
                        variant="primary"
                        onPress={handleSubmit}
                        style={styles.submitButton}
                        disabled={!selectedReason}
                        loading={isSubmitting}
                    />
                </View>
            </View>
        </Modal>
    );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
    },
    closeButton: {
        padding: Spacing.xs,
    },
    headerTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
    },
    headerSpacer: {
        width: 32,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: Spacing.lg,
    },
    bidPreview: {
        flexDirection: 'row',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.xl,
    },
    bidImage: {
        width: 60,
        height: 60,
        borderRadius: BorderRadius.md,
        marginRight: Spacing.md,
    },
    bidInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    bidGarage: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        marginBottom: 4,
    },
    bidAmount: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
    },
    bidCondition: {
        fontSize: FontSizes.sm,
        textTransform: 'capitalize',
    },
    sectionTitle: {
        fontSize: FontSizes.md,
        fontWeight: '600',
        marginBottom: Spacing.md,
    },
    optional: {
        fontWeight: '400',
        opacity: 0.6,
    },
    reasonGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: Spacing.xl,
        gap: Spacing.sm,
    },
    reasonChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
        borderWidth: 1.5,
        gap: Spacing.xs,
    },
    reasonText: {
        fontSize: FontSizes.sm,
        fontWeight: '500',
    },
    detailsInput: {
        borderWidth: 1,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        fontSize: FontSizes.md,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    charCount: {
        fontSize: FontSizes.xs,
        textAlign: 'right',
        marginTop: Spacing.xs,
        marginBottom: Spacing.lg,
    },
    urgentToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1.5,
        marginBottom: Spacing.lg,
    },
    urgentText: {
        flex: 1,
        marginLeft: Spacing.md,
    },
    urgentTitle: {
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
    urgentSubtitle: {
        fontSize: FontSizes.sm,
        marginTop: 2,
    },
    toggleIndicator: {
        width: 40,
        height: 24,
        borderRadius: 12,
        padding: 4,
    },
    toggleDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    errorText: {
        fontSize: FontSizes.sm,
        fontWeight: '500',
    },
    footer: {
        flexDirection: 'row',
        padding: Spacing.lg,
        borderTopWidth: 1,
        gap: Spacing.md,
    },
    cancelButton: {
        flex: 1,
    },
    submitButton: {
        flex: 2,
    },
});

export default FlagBidModal;
