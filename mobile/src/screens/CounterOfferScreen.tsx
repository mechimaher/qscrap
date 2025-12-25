// QScrap Counter-Offer Screen - Bid Negotiation (up to 3 rounds)
import React, { useState, useEffect } from 'react';
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
}

const MAX_ROUNDS = 3;

export default function CounterOfferScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { bidId, garageName, currentAmount, partDescription } = route.params as NegotiationParams;

    const [history, setHistory] = useState<CounterOffer[]>([]);
    const [proposedAmount, setProposedAmount] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [currentRound, setCurrentRound] = useState(0);
    const [pendingOffer, setPendingOffer] = useState<CounterOffer | null>(null);

    useEffect(() => {
        loadNegotiationHistory();
    }, []);

    const loadNegotiationHistory = async () => {
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
                setPendingOffer(pending || null);
            }
        } catch (error) {
            console.log('Failed to load negotiation history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendCounterOffer = async () => {
        const amount = parseFloat(proposedAmount);

        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }

        if (amount >= currentAmount) {
            Alert.alert('Error', 'Counter-offer must be less than the current bid');
            return;
        }

        setIsSending(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            const token = await api.getToken();
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.COUNTER_OFFER(bidId)}`, {
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

            if (response.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(
                    'Counter-Offer Sent!',
                    `Your offer of ${amount} QAR has been sent to ${garageName}. They will respond within 24 hours.`,
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                const data = await response.json();
                const errorMsg = data.error || data.message || JSON.stringify(data);
                throw new Error(errorMsg);
            }
        } catch (error: any) {
            const errorMessage = error.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
            Alert.alert('Error', errorMessage);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsSending(false);
        }
    };

    const handleRespondToOffer = async (action: 'accept' | 'reject' | 'counter') => {
        if (!pendingOffer) return;

        if (action === 'counter') {
            // Clear pending to show counter form
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
                    Alert.alert(
                        'Offer Accepted!',
                        `You accepted the garage's offer of ${pendingOffer.proposed_amount} QAR. An order will be created.`,
                        [{ text: 'OK', onPress: () => navigation.goBack() }]
                    );
                } else {
                    Alert.alert('Offer Rejected', 'The counter-offer has been rejected.');
                    loadNegotiationHistory();
                }
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to respond');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to respond');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsSending(false);
        }
    };

    const renderHistoryItem = (item: CounterOffer) => {
        const isCustomer = item.offered_by_type === 'customer';

        return (
            <View
                key={item.counter_offer_id}
                style={[styles.historyItem, isCustomer ? styles.customerOffer : styles.garageOffer]}
            >
                <View style={styles.historyHeader}>
                    <Text style={styles.historyRound}>Round {item.round_number}</Text>
                    <Text style={[
                        styles.historyStatus,
                        item.status === 'accepted' && styles.statusAccepted,
                        item.status === 'rejected' && styles.statusRejected,
                        item.status === 'pending' && styles.statusPending,
                    ]}>
                        {item.status.toUpperCase()}
                    </Text>
                </View>
                <Text style={styles.historyBy}>
                    {isCustomer ? '👤 You' : '🔧 ' + garageName}
                </Text>
                <Text style={styles.historyAmount}>{item.proposed_amount} QAR</Text>
                {item.message && (
                    <Text style={styles.historyMessage}>"{item.message}"</Text>
                )}
                <Text style={styles.historyDate}>
                    {new Date(item.created_at).toLocaleString()}
                </Text>
            </View>
        );
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 100 }} />
            </SafeAreaView>
        );
    }

    const canNegotiate = currentRound < MAX_ROUNDS && !pendingOffer;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Negotiate Price</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Current Bid Info */}
                <View style={styles.bidCard}>
                    <Text style={styles.garageName}>{garageName}</Text>
                    <Text style={styles.partName}>{partDescription}</Text>
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Current Bid</Text>
                        <Text style={styles.priceAmount}>{currentAmount} QAR</Text>
                    </View>
                    <View style={styles.roundsInfo}>
                        <Text style={styles.roundsText}>
                            Negotiation Round: {currentRound} / {MAX_ROUNDS}
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
                        <Text style={styles.pendingTitle}>🔔 Garage Counter-Offer</Text>
                        <Text style={styles.pendingAmount}>{pendingOffer.proposed_amount} QAR</Text>
                        {pendingOffer.message && (
                            <Text style={styles.pendingMessage}>"{pendingOffer.message}"</Text>
                        )}

                        <View style={styles.responseButtons}>
                            <TouchableOpacity
                                style={styles.acceptOfferButton}
                                onPress={() => handleRespondToOffer('accept')}
                            >
                                <LinearGradient
                                    colors={['#22c55e', '#16a34a'] as const}
                                    style={styles.responseGradient}
                                >
                                    <Text style={styles.responseText}>✓ Accept</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            {currentRound < MAX_ROUNDS && (
                                <TouchableOpacity
                                    style={styles.counterOfferButton}
                                    onPress={() => handleRespondToOffer('counter')}
                                >
                                    <Text style={styles.counterButtonText}>↩ Counter</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={styles.rejectOfferButton}
                                onPress={() => handleRespondToOffer('reject')}
                            >
                                <Text style={styles.rejectButtonText}>✕ Reject</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Counter-Offer Form */}
                {canNegotiate && !pendingOffer && (
                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>Make a Counter-Offer</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Your Offer (QAR)</Text>
                            <TextInput
                                style={styles.amountInput}
                                value={proposedAmount}
                                onChangeText={setProposedAmount}
                                placeholder="Enter your proposed amount"
                                placeholderTextColor={Colors.dark.textMuted}
                                keyboardType="numeric"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Message (Optional)</Text>
                            <TextInput
                                style={[styles.input, styles.messageInput]}
                                value={message}
                                onChangeText={setMessage}
                                placeholder="Explain your offer..."
                                placeholderTextColor={Colors.dark.textMuted}
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
                                    <Text style={styles.sendText}>Send Counter-Offer</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Maximum Rounds Reached */}
                {currentRound >= MAX_ROUNDS && !pendingOffer && (
                    <View style={styles.maxRoundsCard}>
                        <Text style={styles.maxRoundsIcon}>🏁</Text>
                        <Text style={styles.maxRoundsTitle}>Negotiation Complete</Text>
                        <Text style={styles.maxRoundsText}>
                            Maximum negotiation rounds reached. You can accept, reject, or wait for the garage's final offer.
                        </Text>
                    </View>
                )}

                {/* Negotiation History */}
                {history.length > 0 && (
                    <View style={styles.historySection}>
                        <Text style={styles.historyTitle}>Negotiation History</Text>
                        {history.map(renderHistoryItem)}
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.dark.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
    },
    backButton: { padding: Spacing.sm },
    backText: { color: Colors.primary, fontSize: FontSizes.lg, fontWeight: '600' },
    headerTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.dark.text },
    scrollView: { flex: 1, padding: Spacing.lg },
    bidCard: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    garageName: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.dark.text },
    partName: { fontSize: FontSizes.md, color: Colors.dark.textSecondary, marginTop: Spacing.xs },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
    priceLabel: { fontSize: FontSizes.md, color: Colors.dark.textSecondary },
    priceAmount: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.primary },
    roundsInfo: {
        marginTop: Spacing.md,
        alignItems: 'center',
    },
    roundsText: { fontSize: FontSizes.sm, color: Colors.dark.textSecondary },
    roundsDots: { flexDirection: 'row', marginTop: Spacing.sm, gap: Spacing.sm },
    roundDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.dark.border,
    },
    roundDotActive: { backgroundColor: Colors.primary },
    pendingCard: {
        backgroundColor: Colors.warning + '20',
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.warning,
    },
    pendingTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.warning },
    pendingAmount: {
        fontSize: FontSizes.xxxl,
        fontWeight: '800',
        color: Colors.dark.text,
        marginTop: Spacing.sm,
    },
    pendingMessage: {
        fontSize: FontSizes.md,
        color: Colors.dark.textSecondary,
        fontStyle: 'italic',
        marginTop: Spacing.sm,
    },
    responseButtons: {
        flexDirection: 'row',
        marginTop: Spacing.lg,
        gap: Spacing.sm,
    },
    acceptOfferButton: { flex: 1, borderRadius: BorderRadius.md, overflow: 'hidden' },
    responseGradient: { paddingVertical: Spacing.md, alignItems: 'center' },
    responseText: { fontSize: FontSizes.md, fontWeight: '700', color: '#fff' },
    counterOfferButton: {
        flex: 1,
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    counterButtonText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.primary },
    rejectOfferButton: {
        flex: 0.6,
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.md,
        alignItems: 'center',
    },
    rejectButtonText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.error },
    formCard: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    formTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.dark.text, marginBottom: Spacing.lg },
    inputGroup: { marginBottom: Spacing.md },
    inputLabel: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.xs,
    },
    amountInput: {
        backgroundColor: Colors.dark.background,
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        fontSize: FontSizes.xl,
        fontWeight: '700',
        color: Colors.primary,
        borderWidth: 2,
        borderColor: Colors.primary,
        textAlign: 'center',
    },
    input: {
        backgroundColor: Colors.dark.background,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: FontSizes.md,
        color: Colors.dark.text,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    messageInput: { minHeight: 80, textAlignVertical: 'top' },
    sendButton: { borderRadius: BorderRadius.md, overflow: 'hidden', marginTop: Spacing.md },
    sendButtonDisabled: { opacity: 0.7 },
    sendGradient: { paddingVertical: Spacing.md, alignItems: 'center' },
    sendText: { fontSize: FontSizes.md, fontWeight: '700', color: '#fff' },
    maxRoundsCard: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.xl,
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    maxRoundsIcon: { fontSize: 48, marginBottom: Spacing.md },
    maxRoundsTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.dark.text },
    maxRoundsText: {
        fontSize: FontSizes.md,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.sm,
    },
    historySection: { marginTop: Spacing.md },
    historyTitle: {
        fontSize: FontSizes.lg,
        fontWeight: '700',
        color: Colors.dark.text,
        marginBottom: Spacing.md,
    },
    historyItem: {
        borderRadius: BorderRadius.md,
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
        backgroundColor: Colors.dark.surface,
        marginRight: Spacing.xl,
        borderLeftWidth: 3,
        borderLeftColor: Colors.dark.border,
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.xs,
    },
    historyRound: { fontSize: FontSizes.xs, color: Colors.dark.textMuted, fontWeight: '600' },
    historyStatus: { fontSize: FontSizes.xs, fontWeight: '700' },
    statusAccepted: { color: Colors.success },
    statusRejected: { color: Colors.error },
    statusPending: { color: Colors.warning },
    historyBy: { fontSize: FontSizes.sm, color: Colors.dark.textSecondary },
    historyAmount: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.dark.text },
    historyMessage: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textMuted,
        fontStyle: 'italic',
        marginTop: Spacing.xs,
    },
    historyDate: { fontSize: FontSizes.xs, color: Colors.dark.textMuted, marginTop: Spacing.xs },
});
