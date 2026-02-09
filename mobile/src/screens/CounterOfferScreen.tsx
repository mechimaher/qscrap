import { log, warn, error as logError } from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';
// QScrap Counter-Offer Screen - Bid Negotiation (up to 3 rounds)
import React, { useState, useEffect, useCallback } from 'react';
import { LoadingList } from '../components/SkeletonLoading';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '../services/api';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';
import { useSocketContext } from '../hooks/useSocket';
import { useToast } from '../components/Toast';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { rtlFlexDirection, rtlTextAlign } from '../utils/rtl';

interface CounterOffer {
    counter_offer_id: string;
    bid_id: string;
    proposed_amount: number;
    round_number: number;
    offered_by_type: 'customer' | 'garage';
    offered_by_name: string;
    message: string;
    status: 'pending' | 'accepted' | 'rejected' | 'countered';
    created_at: string;
}

interface NegotiationParams {
    bidId: string;
    garageName: string;
    currentAmount: number;
    partDescription: string;
    garageCounterId?: string | null;
    requestId: string; // Added to navigate back to RequestDetail
}

const MAX_ROUNDS = 3;

export default function CounterOfferScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { bidId, garageName, currentAmount, partDescription, garageCounterId, requestId } = route.params as NegotiationParams;
    const { socket } = useSocketContext();
    const { colors } = useTheme();
    const { t, isRTL } = useTranslation();
    const toast = useToast();

    const [history, setHistory] = useState<CounterOffer[]>([]);
    const [proposedAmount, setProposedAmount] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [currentRound, setCurrentRound] = useState(0);
    const [pendingOffer, setPendingOffer] = useState<CounterOffer | null>(null);
    // Track if we're responding to a garage counter-offer (vs creating a new one)
    // Initialize from route params if we're navigating directly to respond
    const [respondingToOfferId, setRespondingToOfferId] = useState<string | null>(garageCounterId || null);

    useEffect(() => {
        loadNegotiationHistory();
    }, []);

    // Listen for counter-offer events on the authenticated socket
    useEffect(() => {
        if (!socket) return;

        const handleGarageCounterOffer = (data: any) => {
            log('[CounterOffer] Garage counter-offer received:', data);
            if (data.bid_id === bidId) {
                loadNegotiationHistory();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        };

        const handleCounterOfferAccepted = (data: any) => {
            log('[CounterOffer] Counter-offer accepted:', data);
            if (data.bid_id === bidId) {
                loadNegotiationHistory();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                toast.success(t('offers.acceptedTitle'), t('offers.garageAccepted'));
            }
        };

        const handleCounterOfferRejected = (data: any) => {
            log('[CounterOffer] Counter-offer rejected:', data);
            if (data.bid_id === bidId) {
                loadNegotiationHistory();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
        };

        socket.on('garage_counter_offer', handleGarageCounterOffer);
        socket.on('counter_offer_accepted', handleCounterOfferAccepted);
        socket.on('counter_offer_rejected', handleCounterOfferRejected);

        return () => {
            socket.off('garage_counter_offer', handleGarageCounterOffer);
            socket.off('counter_offer_accepted', handleCounterOfferAccepted);
            socket.off('counter_offer_rejected', handleCounterOfferRejected);
        };
    }, [socket, bidId]);

    const loadNegotiationHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = await api.getToken();
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.NEGOTIATION_HISTORY(bidId)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                setHistory(data.history || []);
                setCurrentRound(data.current_round || 0);

                // Find pending offer (waiting for customer response)
                const pending = data.history?.find(
                    (h: CounterOffer) => h.status === 'pending' && h.offered_by_type === 'garage'
                );

                // If we came with a garageCounterId from route params, don't show pending card
                // Just keep the form visible for responding
                if (garageCounterId) {
                    setPendingOffer(null);
                    // Keep respondingToOfferId from initialization
                } else {
                    setPendingOffer(pending || null);
                    // Only reset if this is a fresh reload (not from clicking Counter)
                    if (pending) {
                        setRespondingToOfferId(null);
                    }
                }
            }
        } catch (error) {
            log('Failed to load negotiation history:', error);
        } finally {
            setIsLoading(false);
        }
    }, [bidId, garageCounterId]);

    const handleSendCounterOffer = useCallback(async () => {
        const amount = parseFloat(proposedAmount);

        if (isNaN(amount) || amount <= 0) {
            toast.error(t('common.error'), t('offers.enterValidAmount'));
            return;
        }

        if (amount >= currentAmount) {
            toast.error(t('common.error'), t('offers.mustBeLower'));
            return;
        }

        setIsSending(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            const token = await api.getToken();
            let response;

            if (respondingToOfferId) {
                // We're responding to a garage counter-offer
                response = await fetch(
                    `${API_BASE_URL}${API_ENDPOINTS.RESPOND_TO_COUNTER(respondingToOfferId)}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                            action: 'counter',
                            counter_amount: amount,
                            message: message.trim() || undefined,
                        }),
                    }
                );
            } else {
                // Initial counter-offer (no pending garage offer)
                response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.COUNTER_OFFER(bidId)}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        proposed_amount: amount,
                        message: message.trim() || undefined,
                    }),
                });
            }

            if (response.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                toast.show({
                    type: 'success',
                    title: t('offers.sentTitle'),
                    message: t('offers.sentMessage', { amount: amount, garage: garageName }),
                    action: {
                        label: t('requests.viewRequest'),
                        onPress: () => (navigation as any).navigate('RequestDetail', { requestId })
                    },
                    duration: 3000
                });
                // Auto-navigate to RequestDetail after short delay
                setTimeout(() => {
                    (navigation as any).navigate('RequestDetail', { requestId });
                }, 1500);
            } else {
                let errorMsg = t('offers.sendFailed');
                try {
                    const data = await response.json();
                    errorMsg = data.error || data.message || `Server error ${response.status}`;
                } catch {
                    errorMsg = `Server error ${response.status}`;
                }
                toast.error(t('common.error'), errorMsg);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        } catch (error) {
            handleApiError(error, toast);
        } finally {
            setIsSending(false);
        }
    }, [proposedAmount, currentAmount, respondingToOfferId, bidId, message, garageName, requestId, toast, t, navigation]);

    const handleRespondToOffer = useCallback(async (action: 'accept' | 'reject' | 'counter') => {
        if (!pendingOffer) return;

        if (action === 'counter') {
            // Remember which offer we're responding to, then show counter form
            setRespondingToOfferId(pendingOffer.counter_offer_id);
            setPendingOffer(null);
            setProposedAmount('');
            setMessage('');
            return;
        }

        setIsSending(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            const token = await api.getToken();
            const response = await fetch(
                `${API_BASE_URL}${API_ENDPOINTS.RESPOND_TO_COUNTER(pendingOffer.counter_offer_id)}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ action }),
                }
            );

            if (response.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                if (action === 'accept') {
                    toast.show({
                        type: 'success',
                        title: t('offers.acceptedTitle'),
                        message: t('offers.youAccepted', { amount: pendingOffer.proposed_amount }),
                        action: {
                            label: t('common.ok'),
                            onPress: () => navigation.goBack()
                        }
                    });
                } else {
                    toast.info(t('offers.rejectedTitle'), t('offers.rejectedMessage'));
                    loadNegotiationHistory();
                }
            } else {
                const data = await response.json();
                throw new Error(data.error || t('offers.responseFailed'));
            }
        } catch (error: any) {
            handleApiError(error, toast);
        } finally {
            setIsSending(false);
        }
    }, [pendingOffer, toast, t, navigation]);

    const renderHistoryItem = useCallback((item: CounterOffer) => {
        const isCustomer = item.offered_by_type === 'customer';

        return (
            <View
                key={item.counter_offer_id}
                style={[styles.historyItem, isCustomer ? styles.customerOffer : styles.garageOffer, isRTL ? (isCustomer ? { borderLeftWidth: 0, borderRightWidth: 3, marginLeft: 0, marginRight: Spacing.xl, borderRightColor: Colors.primary } : { borderLeftWidth: 0, borderRightWidth: 3, marginRight: 0, marginLeft: Spacing.xl, borderRightColor: '#D1D5DB' }) : {}]}
            >
                <View style={[styles.historyHeader, { flexDirection: rtlFlexDirection(isRTL) }]}>
                    <Text style={styles.historyRound}>{t('offers.round')} {item.round_number}</Text>
                    <Text style={[
                        styles.historyStatus,
                        item.status === 'accepted' && styles.statusAccepted,
                        item.status === 'rejected' && styles.statusRejected,
                        item.status === 'pending' && styles.statusPending,
                    ]}>
                        {item.status.toUpperCase()}
                    </Text>
                </View>
                <Text style={[styles.historyBy, { textAlign: rtlTextAlign(isRTL) }]}>
                    {isCustomer ? `👤 ${t('offers.you')}` : `🔧 ${garageName}`}
                </Text>
                <Text style={[styles.historyAmount, { textAlign: rtlTextAlign(isRTL) }]}>{item.proposed_amount} {t('common.currency')}</Text>
                {item.message && (
                    <Text style={[styles.historyMessage, { textAlign: rtlTextAlign(isRTL) }]}>"{item.message}"</Text>
                )}
                <Text style={[styles.historyDate, { textAlign: rtlTextAlign(isRTL) }]}>
                    {new Date(item.created_at).toLocaleString()}
                </Text>
            </View>
        );

    }, [isRTL, t, garageName, colors]);

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <LoadingList count={3} />
            </SafeAreaView>
        );
    }

    const canNegotiate = currentRound < MAX_ROUNDS && !pendingOffer;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, flexDirection: rtlFlexDirection(isRTL) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>{isRTL ? '→' : '←'} {t('common.back')}</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('offers.negotiatePrice')}</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Current Bid Info */}
                <View style={[styles.bidCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.garageName, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{garageName}</Text>
                    <Text style={[styles.partName, { textAlign: rtlTextAlign(isRTL) }]}>{partDescription}</Text>
                    <View style={[styles.priceRow, { flexDirection: rtlFlexDirection(isRTL) }]}>
                        <Text style={styles.priceLabel}>{t('offers.currentBid')}</Text>
                        <Text style={styles.priceAmount}>{currentAmount} {t('common.currency')}</Text>
                    </View>
                    <View style={styles.roundsInfo}>
                        <Text style={styles.roundsText}>
                            {t('offers.roundCount', { current: currentRound, max: MAX_ROUNDS })}
                        </Text>
                        <View style={styles.roundsDots}>
                            {[1, 2, 3].map(r => (
                                <View
                                    key={r}
                                    style={[
                                        styles.roundDot,
                                        r <= currentRound && styles.roundDotActive
                                    ]}
                                />
                            ))}
                        </View>
                    </View>
                </View>

                {/* Pending Offer Response */}
                {pendingOffer && (
                    <View style={styles.pendingCard}>
                        <Text style={[styles.pendingTitle, { textAlign: rtlTextAlign(isRTL) }]}>🔔 {t('offers.garageCounterOffer')}</Text>
                        <Text style={[styles.pendingAmount, { textAlign: rtlTextAlign(isRTL) }]}>{pendingOffer.proposed_amount} {t('common.currency')}</Text>
                        {pendingOffer.message && (
                            <Text style={[styles.pendingMessage, { textAlign: rtlTextAlign(isRTL) }]}>"{pendingOffer.message}"</Text>
                        )}

                        <View style={[styles.responseButtons, { flexDirection: rtlFlexDirection(isRTL) }]}>
                            <TouchableOpacity
                                style={styles.acceptOfferButton}
                                onPress={() => handleRespondToOffer('accept')}
                            >
                                <LinearGradient
                                    colors={['#22c55e', '#16a34a'] as const}
                                    style={styles.responseGradient}
                                >
                                    <Text style={styles.responseText}>✓ {t('common.accept')}</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            {currentRound < MAX_ROUNDS && (
                                <TouchableOpacity
                                    style={styles.counterOfferButton}
                                    onPress={() => handleRespondToOffer('counter')}
                                >
                                    <Text style={styles.counterButtonText}>↩ {t('offers.counter')}</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={styles.rejectOfferButton}
                                onPress={() => handleRespondToOffer('reject')}
                            >
                                <Text style={styles.rejectButtonText}>✕ {t('common.reject')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Counter-Offer Form */}
                {canNegotiate && !pendingOffer && (
                    <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.formTitle, { color: colors.text, textAlign: rtlTextAlign(isRTL) }]}>{t('offers.makeCounter')}</Text>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, { textAlign: rtlTextAlign(isRTL) }]}>{t('offers.yourOffer')} ({t('common.currency')})</Text>
                            <TextInput
                                style={[styles.amountInput, { backgroundColor: colors.primary + '10', color: colors.primary, borderColor: colors.primary, textAlign: 'center' }]}
                                value={proposedAmount}
                                onChangeText={setProposedAmount}
                                placeholder={t('offers.enterAmount')}
                                placeholderTextColor="#999"
                                keyboardType="numeric"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, { textAlign: rtlTextAlign(isRTL) }]}>{t('offers.messageOptional')}</Text>
                            <TextInput
                                style={[styles.input, styles.messageInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border, textAlign: rtlTextAlign(isRTL) }]}
                                value={message}
                                onChangeText={setMessage}
                                placeholder={t('offers.explainOffer')}
                                placeholderTextColor="#999"
                                multiline
                                maxLength={200}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
                            onPress={handleSendCounterOffer}
                            disabled={isSending}
                        >
                            <LinearGradient
                                colors={['#22c55e', '#16a34a'] as const}
                                style={styles.sendGradient}
                            >
                                {isSending ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.sendText}>{t('offers.sendCounter')}</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Maximum Rounds Reached */}
                {currentRound >= MAX_ROUNDS && !pendingOffer && (
                    <View style={styles.maxRoundsCard}>
                        <Text style={styles.maxRoundsIcon}>🏁</Text>
                        <Text style={styles.maxRoundsTitle}>{t('offers.negotiationComplete')}</Text>
                        <Text style={[styles.maxRoundsText, { textAlign: 'center' }]}>
                            {t('offers.maxRoundsReached')}
                        </Text>
                    </View>
                )}

                {/* Negotiation History */}
                {history.length > 0 && (
                    <View style={styles.historySection}>
                        <Text style={[styles.historyTitle, { textAlign: rtlTextAlign(isRTL) }]}>{t('offers.historyTitle')}</Text>
                        {history.map(renderHistoryItem)}
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAFAFA' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backButton: {
        padding: Spacing.sm,
        backgroundColor: '#F5F5F5',
        borderRadius: BorderRadius.md,
    },
    backText: { color: Colors.primary, fontSize: FontSizes.md, fontWeight: '600' },
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
    scrollView: { flex: 1, padding: Spacing.lg },
    bidCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
        ...Shadows.sm,
    },
    garageName: { fontSize: FontSizes.lg, fontWeight: '700', color: '#1a1a1a' },
    partName: { fontSize: FontSizes.md, color: '#525252', marginTop: Spacing.xs },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    priceLabel: { fontSize: FontSizes.md, color: '#525252' },
    priceAmount: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.primary },
    roundsInfo: {
        marginTop: Spacing.md,
        alignItems: 'center',
    },
    roundsText: { fontSize: FontSizes.sm, color: '#525252' },
    roundsDots: { flexDirection: 'row', marginTop: Spacing.sm, gap: Spacing.sm },
    roundDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#E8E8E8',
    },
    roundDotActive: { backgroundColor: Colors.primary },
    pendingCard: {
        backgroundColor: '#FEF3C7',
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
        borderWidth: 1.5,
        borderColor: '#F59E0B',
    },
    pendingTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: '#D97706' },
    pendingAmount: {
        fontSize: FontSizes.xxxl,
        fontWeight: '800',
        color: '#1a1a1a',
        marginTop: Spacing.sm,
    },
    pendingMessage: {
        fontSize: FontSizes.md,
        color: '#525252',
        fontStyle: 'italic',
        marginTop: Spacing.sm,
    },
    responseButtons: {
        flexDirection: 'row',
        marginTop: Spacing.lg,
        gap: Spacing.sm,
    },
    acceptOfferButton: { flex: 1, borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.sm },
    responseGradient: { paddingVertical: Spacing.md, alignItems: 'center' },
    responseText: { fontSize: FontSizes.md, fontWeight: '700', color: '#fff' },
    counterOfferButton: {
        flex: 1,
        backgroundColor: Colors.primary + '15',
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: Colors.primary,
    },
    counterButtonText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.primary },
    rejectOfferButton: {
        flex: 0.6,
        backgroundColor: '#FEE2E2',
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.md,
        alignItems: 'center',
    },
    rejectButtonText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.error },
    formCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
        ...Shadows.sm,
    },
    formTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: '#1a1a1a', marginBottom: Spacing.lg },
    inputGroup: { marginBottom: Spacing.md },
    inputLabel: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: '#525252',
        marginBottom: Spacing.xs,
    },
    amountInput: {
        backgroundColor: Colors.primary + '10',
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        fontSize: FontSizes.xl,
        fontWeight: '700',
        color: Colors.primary,
        borderWidth: 2,
        borderColor: Colors.primary,
        textAlign: 'center',
    },
    input: {
        backgroundColor: '#F8F9FA',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        fontSize: FontSizes.md,
        color: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    messageInput: { minHeight: 80, textAlignVertical: 'top' },
    sendButton: { borderRadius: BorderRadius.lg, overflow: 'hidden', marginTop: Spacing.md, ...Shadows.sm },
    sendButtonDisabled: { opacity: 0.7 },
    sendGradient: { paddingVertical: Spacing.md, alignItems: 'center' },
    sendText: { fontSize: FontSizes.md, fontWeight: '700', color: '#fff' },
    maxRoundsCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        alignItems: 'center',
        marginBottom: Spacing.lg,
        ...Shadows.sm,
    },
    maxRoundsIcon: { fontSize: 48, marginBottom: Spacing.md },
    maxRoundsTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: '#1a1a1a' },
    maxRoundsText: {
        fontSize: FontSizes.md,
        color: '#525252',
        textAlign: 'center',
        marginTop: Spacing.sm,
    },
    historySection: { marginTop: Spacing.md },
    historyTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: Spacing.md,
    },
    historyItem: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
    },
    customerOffer: {
        backgroundColor: Colors.primary + '10',
        marginLeft: Spacing.xl,
        borderLeftWidth: 3,
        borderLeftColor: Colors.primary,
    },
    garageOffer: {
        backgroundColor: '#F8F9FA',
        marginRight: Spacing.xl,
        borderLeftWidth: 3,
        borderLeftColor: '#D1D5DB',
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.xs,
    },
    historyRound: { fontSize: FontSizes.xs, color: '#737373', fontWeight: '600' },
    historyStatus: { fontSize: FontSizes.xs, fontWeight: '700' },
    statusAccepted: { color: Colors.success },
    statusRejected: { color: Colors.error },
    statusPending: { color: '#D97706' },
    historyBy: { fontSize: FontSizes.sm, color: '#525252' },
    historyAmount: { fontSize: FontSizes.lg, fontWeight: '700', color: '#1a1a1a' },
    historyMessage: {
        fontSize: FontSizes.sm,
        color: '#737373',
        fontStyle: 'italic',
        marginTop: Spacing.xs,
    },
    historyDate: { fontSize: FontSizes.xs, color: '#737373', marginTop: Spacing.xs },
});
