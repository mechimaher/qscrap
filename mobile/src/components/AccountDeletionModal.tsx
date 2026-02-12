/**
 * AccountDeletionModal - Enterprise Account Deletion Flow
 * Premium modal with business logic validation and user guidance
 * Google Play 2026 Compliant
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { toast } from '../utils/toast';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';
import { Ionicons } from '@expo/vector-icons';

interface DeletionBlocker {
    type: string;
    count: number;
    message: string;
    action: string;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    onNavigate: (screen: string) => void;
}

type ModalState = 'loading' | 'blockers' | 'confirm' | 'deleting';

export default function AccountDeletionModal({ visible, onClose, onNavigate }: Props) {
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const { logout } = useAuth();

    const [modalState, setModalState] = useState<ModalState>('loading');
    const [blockers, setBlockers] = useState<DeletionBlocker[]>([]);

    useEffect(() => {
        if (visible) {
            checkEligibility();
        }
    }, [visible]);

    const checkEligibility = async () => {
        setModalState('loading');
        try {
            const result = await api.checkDeletionEligibility();
            if (result.canDelete) {
                setModalState('confirm');
            } else {
                setBlockers(result.blockers);
                setModalState('blockers');
            }
        } catch (error: any) {
            toast.error(t('common.error'), error.message || t('common.unknown'));
            onClose();
        }
    };

    const handleDelete = async () => {
        setModalState('deleting');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        try {
            await api.deleteAccount();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await logout();
            toast.success(t('profile.accountDeleted'), t('profile.accountDeletedMsg'));
            onClose();
        } catch (error: any) {
            toast.error(t('common.error'), error.message || t('common.unknown'));
            setModalState('confirm');
        }
    };

    const handleBlockerAction = (action: string) => {
        onClose();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        switch (action) {
            case 'view_orders':
                onNavigate('Orders');
                break;
            case 'view_support':
                onNavigate('SupportTickets');
                break;
            case 'view_requests':
                onNavigate('Requests');
                break;
            case 'contact_support':
                onNavigate('SupportTickets');
                break;
        }
    };

    const getBlockerIcon = (type: string): string => {
        switch (type) {
            case 'active_orders': return 'cube-outline';
            case 'open_tickets': return 'ticket-outline';
            case 'active_disputes': return 'warning-outline';
            case 'pending_refunds': return 'cash-outline';
            case 'active_requests': return 'document-text-outline';
            default: return 'alert-circle-outline';
        }
    };

    const getActionButtonLabel = (action: string): string => {
        switch (action) {
            case 'view_orders': return t('deletion.viewOrders');
            case 'view_support': return t('deletion.viewTickets');
            case 'view_requests': return t('deletion.viewRequests');
            case 'contact_support': return t('deletion.contactSupport');
            default: return t('common.view');
        }
    };

    const renderLoading = () => (
        <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {t('deletion.checking')}
            </Text>
        </View>
    );

    const renderBlockers = () => (
        <View style={styles.content}>
            {/* Header */}
            <View style={styles.iconContainer}>
                <Ionicons name="shield-checkmark" size={36} color={Colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                {t('deletion.cannotDelete')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                {t('deletion.resolveBlockers')}
            </Text>

            {/* Blockers List */}
            <ScrollView style={styles.blockersList} showsVerticalScrollIndicator={false}>
                {blockers.map((blocker, index) => (
                    <View
                        key={index}
                        style={[styles.blockerCard, {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            flexDirection: rtlFlexDirection(isRTL)
                        }]}
                    >
                        <View style={[styles.blockerInfo, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <Ionicons name={getBlockerIcon(blocker.type) as any} size={24} color={Colors.primary} style={{ marginRight: Spacing.sm }} />
                            <View style={styles.blockerTextContainer}>
                                <Text style={[styles.blockerMessage, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                                    {t(`deletion.${blocker.type}`, { count: blocker.count }) || blocker.message}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleBlockerAction(blocker.action)}
                        >
                            <Text style={styles.actionButtonText}>
                                {getActionButtonLabel(blocker.action)}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={onClose}
            >
                <Text style={[styles.closeButtonText, { color: colors.text }]}>{t('common.ok')}</Text>
            </TouchableOpacity>
        </View>
    );

    const renderConfirm = () => (
        <View style={styles.content}>
            {/* Warning Icon */}
            <View style={[styles.iconContainer, { backgroundColor: Colors.error + '15' }]}>
                <Ionicons name="warning" size={36} color={Colors.error} />
            </View>
            <Text style={[styles.title, { color: Colors.error, textAlign: rtlTextAlign(isRTL) }]}>
                {t('deletion.confirmTitle')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, textAlign: rtlTextAlign(isRTL) }]}>
                {t('deletion.confirmMessage')}
            </Text>

            {/* Warning Points */}
            <View style={[styles.warningBox, { backgroundColor: Colors.error + '08', borderColor: Colors.error + '20' }]}>
                <Text style={[styles.warningText, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                    {t('deletion.warning1')}
                </Text>
                <Text style={[styles.warningText, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                    {t('deletion.warning2')}
                </Text>
                <Text style={[styles.warningText, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>
                    {t('deletion.warning3')}
                </Text>
            </View>

            {/* Buttons */}
            <View style={[styles.buttonRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity
                    style={[styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={onClose}
                >
                    <Text style={[styles.cancelButtonText, { color: colors.text }]}>{t('common.keep')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={handleDelete}
                >
                    <LinearGradient
                        colors={[Colors.error, '#b91c1c'] as const}
                        style={styles.deleteGradient}
                    >
                        <Text style={styles.deleteButtonText}>{t('common.delete')}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderDeleting = () => (
        <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={Colors.error} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {t('deletion.deleting')}
            </Text>
        </View>
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.modal, { backgroundColor: colors.background }]}>
                    {modalState === 'loading' && renderLoading()}
                    {modalState === 'blockers' && renderBlockers()}
                    {modalState === 'confirm' && renderConfirm()}
                    {modalState === 'deleting' && renderDeleting()}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    modal: {
        width: '100%',
        maxWidth: 400,
        borderRadius: BorderRadius.xl,
        ...Shadows.lg,
        maxHeight: '80%',
    },
    centerContent: {
        padding: Spacing.xl * 2,
        alignItems: 'center',
    },
    content: {
        padding: Spacing.xl,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginBottom: Spacing.lg,
    },
    icon: {
        fontSize: 36,
    },
    title: {
        fontSize: FontSizes.xl,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: FontSizes.md,
        textAlign: 'center',
        marginBottom: Spacing.xl,
        lineHeight: 22,
    },
    loadingText: {
        marginTop: Spacing.md,
        fontSize: FontSizes.md,
    },
    blockersList: {
        maxHeight: 250,
        marginBottom: Spacing.lg,
    },
    blockerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        marginBottom: Spacing.sm,
    },
    blockerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    blockerIcon: {
        fontSize: 24,
        marginRight: Spacing.sm,
    },
    blockerTextContainer: {
        flex: 1,
    },
    blockerMessage: {
        fontSize: FontSizes.sm,
        fontWeight: '500',
    },
    actionButton: {
        backgroundColor: Colors.primary + '15',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.md,
        marginLeft: Spacing.sm,
    },
    actionButtonText: {
        color: Colors.primary,
        fontSize: FontSizes.xs,
        fontWeight: '600',
    },
    closeButton: {
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
    warningBox: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        marginBottom: Spacing.xl,
    },
    warningText: {
        fontSize: FontSizes.sm,
        marginBottom: Spacing.sm,
        lineHeight: 20,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    cancelButton: {
        flex: 1,
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: FontSizes.md,
        fontWeight: '600',
    },
    deleteButton: {
        flex: 1,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    deleteGradient: {
        padding: Spacing.md,
        alignItems: 'center',
    },
    deleteButtonText: {
        color: '#fff',
        fontSize: FontSizes.md,
        fontWeight: '700',
    },
});
