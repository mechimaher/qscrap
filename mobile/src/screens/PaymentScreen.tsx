// QScrap Premium Payment Screen
// Digital payment with card validation and escrow integration

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';

export default function PaymentScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { colors } = useTheme();

    const { order, amount } = route.params || { amount: 0 };

    const [cardNumber, setCardNumber] = useState('');
    const [expiryMonth, setExpiryMonth] = useState('');
    const [expiryYear, setExpiryYear] = useState('');
    const [cvv, setCvv] = useState('');
    const [cardholderName, setCardholderName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<'input' | 'processing' | 'success' | 'error'>('input');
    const [error, setError] = useState<string | null>(null);
    const [transactionId, setTransactionId] = useState<string | null>(null);

    // Format card number with spaces
    const formatCardNumber = (text: string) => {
        const cleaned = text.replace(/\D/g, '').slice(0, 16);
        const groups = cleaned.match(/.{1,4}/g);
        return groups ? groups.join(' ') : cleaned;
    };

    // Luhn validation
    const isValidCard = () => {
        const cleaned = cardNumber.replace(/\s/g, '');
        if (cleaned.length !== 16) return false;
        let sum = 0;
        for (let i = 0; i < cleaned.length; i++) {
            let digit = parseInt(cleaned[i]);
            if ((cleaned.length - i) % 2 === 0) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
        }
        return sum % 10 === 0;
    };

    const handlePayment = async () => {
        if (!isValidCard()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setError('Invalid card number');
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setStep('processing');
        setIsLoading(true);

        try {
            const result = await api.processPayment({
                order_id: order?.order_id || 'test',
                amount: parseFloat(amount),
                card_number: cardNumber.replace(/\s/g, ''),
                expiry_month: expiryMonth,
                expiry_year: expiryYear,
                cvv,
                cardholder_name: cardholderName,
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTransactionId(result.transaction_id);
            setStep('success');
        } catch (err: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setError(err.message || 'Payment failed');
            setStep('error');
        } finally {
            setIsLoading(false);
        }
    };

    // Success State
    if (step === 'success') {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.successContainer}>
                    <View style={styles.successIcon}>
                        <LinearGradient
                            colors={[Colors.success, '#2d8a4e']}
                            style={styles.successGradient}
                        >
                            <Ionicons name="checkmark" size={60} color="#fff" />
                        </LinearGradient>
                    </View>
                    <Text style={[styles.successTitle, { color: colors.text }]}>
                        Payment Successful!
                    </Text>
                    <Text style={[styles.successAmount, { color: Colors.primary }]}>
                        {amount} QAR
                    </Text>
                    <Text style={[styles.transactionId, { color: colors.textSecondary }]}>
                        Transaction: {transactionId}
                    </Text>
                    <Text style={[styles.escrowNote, { color: colors.textSecondary }]}>
                        🔒 Funds held in escrow until you confirm delivery
                    </Text>
                    <TouchableOpacity
                        style={styles.doneButton}
                        onPress={() => navigation.navigate('HomeTab')}
                    >
                        <LinearGradient
                            colors={[Colors.primary, '#6b1029']}
                            style={styles.doneGradient}
                        >
                            <Text style={styles.doneButtonText}>Back to Home</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // Processing State
    if (step === 'processing') {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.processingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={[styles.processingText, { color: colors.text }]}>
                        Processing payment...
                    </Text>
                    <Text style={[styles.processingSubtext, { color: colors.textSecondary }]}>
                        Please wait, do not close the app
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Payment</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Amount Card */}
                    <View style={[styles.amountCard, { backgroundColor: Colors.primary }]}>
                        <Text style={styles.amountLabel}>Total Amount</Text>
                        <Text style={styles.amountValue}>{amount} QAR</Text>
                        <View style={styles.escrowBadge}>
                            <Ionicons name="shield-checkmark" size={16} color="#fff" />
                            <Text style={styles.escrowBadgeText}>Protected by Escrow</Text>
                        </View>
                    </View>

                    {/* Error Message */}
                    {error && (
                        <View style={styles.errorCard}>
                            <Ionicons name="warning" size={20} color={Colors.error} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {/* Card Form */}
                    <View style={styles.form}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>
                            💳 Card Details
                        </Text>

                        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Ionicons name="card" size={20} color={colors.textSecondary} />
                            <TextInput
                                style={[styles.input, { color: colors.text }]}
                                placeholder="Card Number"
                                placeholderTextColor={colors.textSecondary}
                                value={formatCardNumber(cardNumber)}
                                onChangeText={(text) => setCardNumber(text.replace(/\s/g, ''))}
                                keyboardType="number-pad"
                                maxLength={19}
                            />
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.inputContainer, styles.halfInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="MM"
                                    placeholderTextColor={colors.textSecondary}
                                    value={expiryMonth}
                                    onChangeText={setExpiryMonth}
                                    keyboardType="number-pad"
                                    maxLength={2}
                                />
                                <Text style={{ color: colors.textSecondary }}>/</Text>
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="YY"
                                    placeholderTextColor={colors.textSecondary}
                                    value={expiryYear}
                                    onChangeText={setExpiryYear}
                                    keyboardType="number-pad"
                                    maxLength={2}
                                />
                            </View>
                            <View style={[styles.inputContainer, styles.halfInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <Ionicons name="lock-closed" size={20} color={colors.textSecondary} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="CVV"
                                    placeholderTextColor={colors.textSecondary}
                                    value={cvv}
                                    onChangeText={setCvv}
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    secureTextEntry
                                />
                            </View>
                        </View>

                        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Ionicons name="person" size={20} color={colors.textSecondary} />
                            <TextInput
                                style={[styles.input, { color: colors.text }]}
                                placeholder="Cardholder Name"
                                placeholderTextColor={colors.textSecondary}
                                value={cardholderName}
                                onChangeText={setCardholderName}
                                autoCapitalize="characters"
                            />
                        </View>

                        {/* Test Card Hint */}
                        <View style={[styles.hintCard, { backgroundColor: colors.surface }]}>
                            <Ionicons name="information-circle" size={20} color={Colors.info} />
                            <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                                Test Card: 4111 1111 1111 1111 | Any future date | Any CVV
                            </Text>
                        </View>
                    </View>
                </ScrollView>

                {/* Pay Button */}
                <View style={[styles.footer, { borderTopColor: colors.border }]}>
                    <TouchableOpacity
                        onPress={handlePayment}
                        disabled={isLoading || cardNumber.length < 16}
                        style={[styles.payButton, (isLoading || cardNumber.length < 16) && styles.buttonDisabled]}
                    >
                        <LinearGradient
                            colors={cardNumber.length >= 16 ? [Colors.primary, '#6b1029'] : ['#ccc', '#aaa']}
                            style={styles.payGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="lock-closed" size={20} color="#fff" />
                                    <Text style={styles.payButtonText}>Pay {amount} QAR</Text>
                                </>
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
    content: { flex: 1, padding: Spacing.lg },
    amountCard: {
        padding: Spacing.xl,
        borderRadius: BorderRadius.xl,
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    amountLabel: { color: 'rgba(255,255,255,0.8)', fontSize: FontSizes.sm },
    amountValue: { color: '#fff', fontSize: 36, fontWeight: '700', marginVertical: Spacing.sm },
    escrowBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
        gap: 6,
    },
    escrowBadgeText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: '600' },
    errorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.error + '20',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    errorText: { color: Colors.error, flex: 1 },
    form: { marginBottom: Spacing.xl },
    sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', marginBottom: Spacing.md },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md,
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    input: { flex: 1, paddingVertical: Spacing.md, fontSize: FontSizes.md },
    row: { flexDirection: 'row', gap: Spacing.md },
    halfInput: { flex: 1 },
    hintCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        gap: Spacing.sm,
    },
    hintText: { flex: 1, fontSize: FontSizes.sm },
    footer: { padding: Spacing.lg, borderTopWidth: 1 },
    payButton: { width: '100%' },
    buttonDisabled: { opacity: 0.6 },
    payGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.lg,
        borderRadius: BorderRadius.lg,
    },
    payButtonText: { color: '#fff', fontWeight: '700', fontSize: FontSizes.lg },
    successContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xl,
    },
    successIcon: { marginBottom: Spacing.lg },
    successGradient: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    successTitle: { fontSize: FontSizes.xxl, fontWeight: '700', marginBottom: Spacing.sm },
    successAmount: { fontSize: 32, fontWeight: '700', marginBottom: Spacing.sm },
    transactionId: { fontSize: FontSizes.sm, marginBottom: Spacing.lg },
    escrowNote: { fontSize: FontSizes.sm, textAlign: 'center', marginBottom: Spacing.xl },
    doneButton: { width: '100%' },
    doneGradient: {
        paddingVertical: Spacing.lg,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
    },
    doneButtonText: { color: '#fff', fontWeight: '700', fontSize: FontSizes.md },
    processingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    processingText: { fontSize: FontSizes.lg, fontWeight: '600', marginTop: Spacing.lg },
    processingSubtext: { fontSize: FontSizes.sm, marginTop: Spacing.sm },
});
