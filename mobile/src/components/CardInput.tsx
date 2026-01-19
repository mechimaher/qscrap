// QScrap Mobile - Premium Card Input Component
// VVIP design with real-time validation and haptic feedback

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSizes } from '../constants/theme';
import {
    detectCardBrand,
    formatCardNumber,
    formatExpiry,
    validateCardNumber,
    validateExpiry,
    validateCVV,
    validateCardholderName,
    getCardBrandColor,
    getCVVLength,
    CardBrand
} from '../utils/cardValidation';

interface CardInputProps {
    onCardChange: (cardData: CardData) => void;
    disabled?: boolean;
}

export interface CardData {
    cardNumber: string;
    expiry: string;
    cvv: string;
    cardholderName: string;
    brand: CardBrand;
    isValid: boolean;
}

export function CardInput({ onCardChange, disabled = false }: CardInputProps) {
    const { colors } = useTheme();

    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');
    const [cardholderName, setCardholderName] = useState('');

    const [cardNumberError, setCardNumberError] = useState('');
    const [expiryError, setExpiryError] = useState('');
    const [cvvError, setCvvError] = useState('');
    const [nameError, setNameError] = useState('');

    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [brand, setBrand] = useState<CardBrand>('unknown');

    // Update brand as user types
    useEffect(() => {
        const detectedBrand = detectCardBrand(cardNumber);
        setBrand(detectedBrand);
    }, [cardNumber]);

    // Notify parent of changes
    useEffect(() => {
        const isCardNumberValid = cardNumber.length > 0 && validateCardNumber(cardNumber);
        const isExpiryValid = expiry.length > 0 && validateExpiry(expiry);
        const isCvvValid = cvv.length > 0 && validateCVV(cvv, brand);
        const isNameValid = cardholderName.length > 0 && validateCardholderName(cardholderName);

        onCardChange({
            cardNumber: cardNumber.replace(/\s/g, ''),
            expiry,
            cvv,
            cardholderName,
            brand,
            isValid: isCardNumberValid && isExpiryValid && isCvvValid && isNameValid
        });
    }, [cardNumber, expiry, cvv, cardholderName, brand]);

    const handleCardNumberChange = (text: string) => {
        const formatted = formatCardNumber(text, brand);
        setCardNumber(formatted);
        setCardNumberError('');

        if (formatted.replace(/\s/g, '').length >= 13) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const handleCardNumberBlur = () => {
        setFocusedField(null);
        if (cardNumber && !validateCardNumber(cardNumber)) {
            setCardNumberError('Invalid card number');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const handleExpiryChange = (text: string) => {
        const formatted = formatExpiry(text);
        setExpiry(formatted);
        setExpiryError('');

        if (formatted.length === 5) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const handleExpiryBlur = () => {
        setFocusedField(null);
        if (expiry && !validateExpiry(expiry)) {
            setExpiryError('Invalid or expired date');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const handleCvvChange = (text: string) => {
        const cleaned = text.replace(/\D/g, '');
        const maxLength = getCVVLength(brand);
        setCvv(cleaned.substring(0, maxLength));
        setCvvError('');

        if (cleaned.length === maxLength) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const handleCvvBlur = () => {
        setFocusedField(null);
        if (cvv && !validateCVV(cvv, brand)) {
            setCvvError(`CVV must be ${getCVVLength(brand)} digits`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const handleNameChange = (text: string) => {
        // Only allow letters, spaces, hyphens, apostrophes
        const filtered = text.replace(/[^a-zA-Z\s\-']/g, '');
        setCardholderName(filtered);
        setNameError('');
    };

    const handleNameBlur = () => {
        setFocusedField(null);
        if (cardholderName && !validateCardholderName(cardholderName)) {
            setNameError('Please enter first and last name');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    return (
        <View style={styles.container}>
            {/* Card Number */}
            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Card Number</Text>
                <View style={[
                    styles.inputContainer,
                    {
                        backgroundColor: colors.surface,
                        borderColor: focusedField === 'cardNumber' ? Colors.primary :
                            cardNumberError ? Colors.error : colors.border
                    }
                ]}>
                    <TextInput
                        style={[styles.input, { color: colors.text }]}
                        value={cardNumber}
                        onChangeText={handleCardNumberChange}
                        onFocus={() => setFocusedField('cardNumber')}
                        onBlur={handleCardNumberBlur}
                        placeholder="1234 5678 9012 3456"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        maxLength={19}
                        editable={!disabled}
                        autoComplete="cc-number"
                    />
                    {brand !== 'unknown' && (
                        <View style={[styles.brandBadge, { backgroundColor: getCardBrandColor(brand) }]}>
                            <Text style={styles.brandText}>{brand.toUpperCase()}</Text>
                        </View>
                    )}
                </View>
                {cardNumberError ? (
                    <Text style={[styles.errorText, { color: Colors.error }]}>{cardNumberError}</Text>
                ) : null}
            </View>

            {/* Expiry and CVV Row */}
            <View style={styles.row}>
                {/* Expiry */}
                <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={[styles.label, { color: colors.text }]}>Expiry</Text>
                    <View style={[
                        styles.inputContainer,
                        {
                            backgroundColor: colors.surface,
                            borderColor: focusedField === 'expiry' ? Colors.primary :
                                expiryError ? Colors.error : colors.border
                        }
                    ]}>
                        <TextInput
                            style={[styles.input, { color: colors.text }]}
                            value={expiry}
                            onChangeText={handleExpiryChange}
                            onFocus={() => setFocusedField('expiry')}
                            onBlur={handleExpiryBlur}
                            placeholder="MM/YY"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                            maxLength={5}
                            editable={!disabled}
                            autoComplete="cc-exp"
                        />
                    </View>
                    {expiryError ? (
                        <Text style={[styles.errorText, { color: Colors.error }]}>{expiryError}</Text>
                    ) : null}
                </View>

                {/* CVV */}
                <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={[styles.label, { color: colors.text }]}>CVV</Text>
                    <View style={[
                        styles.inputContainer,
                        {
                            backgroundColor: colors.surface,
                            borderColor: focusedField === 'cvv' ? Colors.primary :
                                cvvError ? Colors.error : colors.border
                        }
                    ]}>
                        <TextInput
                            style={[styles.input, { color: colors.text }]}
                            value={cvv}
                            onChangeText={handleCvvChange}
                            onFocus={() => setFocusedField('cvv')}
                            onBlur={handleCvvBlur}
                            placeholder={brand === 'amex' ? '1234' : '123'}
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                            maxLength={brand === 'amex' ? 4 : 3}
                            secureTextEntry
                            editable={!disabled}
                            autoComplete="cc-csc"
                        />
                    </View>
                    {cvvError ? (
                        <Text style={[styles.errorText, { color: Colors.error }]}>{cvvError}</Text>
                    ) : null}
                </View>
            </View>

            {/* Cardholder Name */}
            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Cardholder Name</Text>
                <View style={[
                    styles.inputContainer,
                    {
                        backgroundColor: colors.surface,
                        borderColor: focusedField === 'name' ? Colors.primary :
                            nameError ? Colors.error : colors.border
                    }
                ]}>
                    <TextInput
                        style={[styles.input, { color: colors.text }]}
                        value={cardholderName}
                        onChangeText={handleNameChange}
                        onFocus={() => setFocusedField('name')}
                        onBlur={handleNameBlur}
                        placeholder="JOHN DOE"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="characters"
                        editable={!disabled}
                        autoComplete="name"
                    />
                </View>
                {nameError ? (
                    <Text style={[styles.errorText, { color: Colors.error }]}>{nameError}</Text>
                ) : null}
            </View>

            {/* Security Notice */}
            <View style={[styles.securityNotice, { backgroundColor: colors.surface }]}>
                <Text style={styles.securityIcon}>🔒</Text>
                <Text style={[styles.securityText, { color: colors.textMuted }]}>
                    Your card information is encrypted and secure
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: Spacing.md,
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
        height: 50,
        fontSize: FontSizes.md,
        fontWeight: '500',
    },
    brandBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: BorderRadius.sm,
    },
    brandText: {
        color: '#fff',
        fontSize: FontSizes.xs,
        fontWeight: '700',
    },
    row: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    halfWidth: {
        flex: 1,
    },
    errorText: {
        fontSize: FontSizes.xs,
        marginTop: 4,
        marginLeft: 4,
    },
    securityNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginTop: Spacing.sm,
    },
    securityIcon: {
        fontSize: 16,
        marginRight: Spacing.sm,
    },
    securityText: {
        flex: 1,
        fontSize: FontSizes.xs,
        fontStyle: 'italic',
    },
});
