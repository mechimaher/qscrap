// QScrap Mobile - Card Validation Utilities
// Client-side validation matching backend standards

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';

export interface CardValidationResult {
    isValid: boolean;
    errors: string[];
    brand?: CardBrand;
}

// ============================================================================
// CARD NUMBER VALIDATION
// ============================================================================

/**
 * Validate card number using Luhn algorithm
 */
export function validateCardNumber(cardNumber: string): boolean {
    const cleaned = cardNumber.replace(/\D/g, '');

    // Length check
    if (cleaned.length < 13 || cleaned.length > 19) {
        return false;
    }

    // Luhn algorithm
    return luhnCheck(cleaned);
}

/**
 * Luhn algorithm implementation (industry standard)
 */
function luhnCheck(cardNumber: string): boolean {
    const digits = cardNumber.split('').map(Number);
    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
        let digit = digits[i];

        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }

        sum += digit;
        isEven = !isEven;
    }

    return sum % 10 === 0;
}

// ============================================================================
// CARD BRAND DETECTION
// ============================================================================

/**
 * Detect card brand from number
 */
export function detectCardBrand(cardNumber: string): CardBrand {
    const cleaned = cardNumber.replace(/\D/g, '');

    // Visa: starts with 4
    if (/^4/.test(cleaned)) return 'visa';

    // Mastercard: starts with 51-55 or 2221-2720
    if (/^5[1-5]/.test(cleaned) || /^2(22[1-9]|2[3-9][0-9]|[3-6][0-9]{2}|7[01][0-9]|720)/.test(cleaned)) {
        return 'mastercard';
    }

    // Amex: starts with 34 or 37
    if (/^3[47]/.test(cleaned)) return 'amex';

    // Discover: starts with 6011, 622126-622925, 644-649, or 65
    if (/^6(?:011|5|4[4-9]|22(1(2[6-9]|[3-9][0-9])|[2-8][0-9]{2}|9([01][0-9]|2[0-5])))/.test(cleaned)) {
        return 'discover';
    }

    return 'unknown';
}

/**
 * Get card brand emoji
 */
export function getCardBrandEmoji(brand: CardBrand): string {
    switch (brand) {
        case 'visa': return '💳';
        case 'mastercard': return '💳';
        case 'amex': return '💳';
        case 'discover': return '💳';
        default: return '💳';
    }
}

/**
 * Get card brand color
 */
export function getCardBrandColor(brand: CardBrand): string {
    switch (brand) {
        case 'visa': return '#1A1F71';
        case 'mastercard': return '#EB001B';
        case 'amex': return '#006FCF';
        case 'discover': return '#FF6000';
        default: return '#666666';
    }
}

// ============================================================================
// EXPIRY DATE VALIDATION
// ============================================================================

/**
 * Validate expiry date (MM/YY format)
 */
export function validateExpiry(expiry: string): boolean {
    const expiryRegex = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;

    if (!expiryRegex.test(expiry)) {
        return false;
    }

    const [month, year] = expiry.split('/').map(Number);
    const expiryDate = new Date(2000 + year, month - 1); // Last day of month
    const today = new Date();

    // Set to first day of current month for comparison
    today.setDate(1);
    today.setHours(0, 0, 0, 0);

    return expiryDate >= today;
}

/**
 * Format expiry as user types (auto-adds /)
 */
export function formatExpiry(input: string): string {
    const cleaned = input.replace(/\D/g, '');

    if (cleaned.length === 0) return '';
    if (cleaned.length <= 2) return cleaned;

    return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
}

// ============================================================================
// CVV VALIDATION
// ============================================================================

/**
 * Validate CVV (3 or 4 digits based on card brand)
 */
export function validateCVV(cvv: string, brand: CardBrand): boolean {
    const cleaned = cvv.replace(/\D/g, '');

    if (brand === 'amex') {
        return cleaned.length === 4;
    }

    return cleaned.length === 3;
}

/**
 * Get CVV length for card brand
 */
export function getCVVLength(brand: CardBrand): number {
    return brand === 'amex' ? 4 : 3;
}

// ============================================================================
// CARDHOLDER NAME VALIDATION
// ============================================================================

/**
 * Validate cardholder name
 */
export function validateCardholderName(name: string): boolean {
    const trimmed = name.trim();

    // Must be 2-50 characters
    if (trimmed.length < 2 || trimmed.length > 50) {
        return false;
    }

    // Must contain at least one space (first and last name)
    if (!trimmed.includes(' ')) {
        return false;
    }

    // Only letters, spaces, hyphens, apostrophes
    return /^[a-zA-Z\s\-']+$/.test(trimmed);
}

// ============================================================================
// CARD NUMBER FORMATTING
// ============================================================================

/**
 * Format card number with spaces (4444 4444 4444 4444)
 */
export function formatCardNumber(input: string, brand: CardBrand): string {
    const cleaned = input.replace(/\D/g, '');

    // Amex: 4-6-5 format (3782 822463 10005)
    if (brand === 'amex') {
        if (cleaned.length <= 4) return cleaned;
        if (cleaned.length <= 10) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
        return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 10)} ${cleaned.slice(10, 15)}`;
    }

    // Others: 4-4-4-4 format
    const groups = cleaned.match(/.{1,4}/g) || [];
    return groups.join(' ').substring(0, 19); // Max 16 digits + 3 spaces
}

// ============================================================================
// COMPREHENSIVE VALIDATION
// ============================================================================

/**
 * Validate all card details
 */
export function validateCardDetails(
    cardNumber: string,
    expiry: string,
    cvv: string,
    cardholderName: string
): CardValidationResult {
    const errors: string[] = [];
    const brand = detectCardBrand(cardNumber);

    // Card number
    if (!cardNumber.trim()) {
        errors.push('Card number is required');
    } else if (!validateCardNumber(cardNumber)) {
        errors.push('Invalid card number');
    }

    // Expiry
    if (!expiry.trim()) {
        errors.push('Expiry date is required');
    } else if (!validateExpiry(expiry)) {
        errors.push('Invalid or expired card');
    }

    // CVV
    if (!cvv.trim()) {
        errors.push('CVV is required');
    } else if (!validateCVV(cvv, brand)) {
        const expectedLength = getCVVLength(brand);
        errors.push(`CVV must be ${expectedLength} digits`);
    }

    // Cardholder name
    if (!cardholderName.trim()) {
        errors.push('Cardholder name is required');
    } else if (!validateCardholderName(cardholderName)) {
        errors.push('Please enter first and last name');
    }

    return {
        isValid: errors.length === 0,
        errors,
        brand
    };
}

// ============================================================================
// MASKING
// ============================================================================

/**
 * Mask card number for display (•••• •••• •••• 4242)
 */
export function maskCardNumber(cardNumber: string): string {
    const cleaned = cardNumber.replace(/\D/g, '');
    if (cleaned.length < 4) return cleaned;

    const last4 = cleaned.slice(-4);
    const masked = '•'.repeat(cleaned.length - 4);

    // Format with spaces
    const combined = masked + last4;
    const groups = combined.match(/.{1,4}/g) || [];
    return groups.join(' ');
}
