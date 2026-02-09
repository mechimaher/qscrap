/**
 * QScrap Mobile - Utility Functions Tests
 * Covers: validation, formatters, RTL, cardValidation, errorHandler
 */

// ============================================================================
// VALIDATION TESTS
// ============================================================================
import {
    validateRequired,
    validateMinLength,
    validateMaxLength,
    validatePhoneNumber,
    validateEmail,
    validatePassword,
    validatePasswordConfirm,
    validateVIN,
    validateYear,
    validateAmount,
    validateForm,
    sanitizeInput,
    cleanPhoneNumber,
} from '../utils/validation';

describe('Validation Utilities', () => {
    describe('validateRequired', () => {
        it('should fail for empty string', () => {
            expect(validateRequired('').isValid).toBe(false);
        });
        it('should fail for null', () => {
            expect(validateRequired(null).isValid).toBe(false);
        });
        it('should fail for undefined', () => {
            expect(validateRequired(undefined).isValid).toBe(false);
        });
        it('should fail for whitespace only', () => {
            expect(validateRequired('   ').isValid).toBe(false);
        });
        it('should pass for valid string', () => {
            expect(validateRequired('hello').isValid).toBe(true);
        });
        it('should include field name in error', () => {
            const result = validateRequired('', 'Name');
            expect(result.error).toContain('Name');
        });
    });

    describe('validateMinLength', () => {
        it('should fail for short string', () => {
            expect(validateMinLength('ab', 3).isValid).toBe(false);
        });
        it('should pass for string at minimum', () => {
            expect(validateMinLength('abc', 3).isValid).toBe(true);
        });
    });

    describe('validateMaxLength', () => {
        it('should fail for long string', () => {
            expect(validateMaxLength('abcdef', 5).isValid).toBe(false);
        });
        it('should pass for string at maximum', () => {
            expect(validateMaxLength('abcde', 5).isValid).toBe(true);
        });
    });

    describe('validatePhoneNumber', () => {
        it('should validate Qatar phone number with country code', () => {
            expect(validatePhoneNumber('+97433334444').isValid).toBe(true);
        });
        it('should validate Qatar phone without plus', () => {
            expect(validatePhoneNumber('97433334444').isValid).toBe(true);
        });
        it('should validate 8-digit Qatar number', () => {
            expect(validatePhoneNumber('33334444').isValid).toBe(true);
        });
        it('should reject invalid number', () => {
            expect(validatePhoneNumber('123').isValid).toBe(false);
        });
        it('should reject empty', () => {
            expect(validatePhoneNumber('').isValid).toBe(false);
        });
    });

    describe('validateEmail', () => {
        it('should validate correct email', () => {
            expect(validateEmail('test@example.com').isValid).toBe(true);
        });
        it('should reject invalid email', () => {
            expect(validateEmail('notanemail').isValid).toBe(false);
        });
        it('should reject empty email', () => {
            expect(validateEmail('').isValid).toBe(false);
        });
    });

    describe('validatePassword', () => {
        it('should reject empty password', () => {
            const result = validatePassword('');
            expect(result.isValid).toBe(false);
            expect(result.strength).toBe('weak');
        });
        it('should reject short password', () => {
            expect(validatePassword('12345').isValid).toBe(false);
        });
        it('should accept valid password and return strength', () => {
            const result = validatePassword('Test123!');
            expect(result.isValid).toBe(true);
            expect(result.strength).toBe('strong');
        });
        it('should classify medium-strength password', () => {
            const result = validatePassword('test123');
            expect(result.isValid).toBe(true);
            expect(result.strength).toBe('medium');
        });
    });

    describe('validatePasswordConfirm', () => {
        it('should pass when passwords match', () => {
            expect(validatePasswordConfirm('test123', 'test123').isValid).toBe(true);
        });
        it('should fail when passwords dont match', () => {
            expect(validatePasswordConfirm('test123', 'test456').isValid).toBe(false);
        });
        it('should fail when confirm is empty', () => {
            expect(validatePasswordConfirm('test123', '').isValid).toBe(false);
        });
    });

    describe('validateVIN', () => {
        it('should accept empty VIN (optional field)', () => {
            expect(validateVIN('').isValid).toBe(true);
        });
        it('should validate correct 17-char VIN', () => {
            expect(validateVIN('1HGBH41JXMN109186').isValid).toBe(true);
        });
        it('should reject wrong length VIN', () => {
            expect(validateVIN('12345').isValid).toBe(false);
        });
    });

    describe('validateYear', () => {
        it('should accept valid year', () => {
            expect(validateYear(2024).isValid).toBe(true);
        });
        it('should reject too old year', () => {
            expect(validateYear(1800).isValid).toBe(false);
        });
        it('should reject non-number', () => {
            expect(validateYear('abc').isValid).toBe(false);
        });
    });

    describe('validateAmount', () => {
        it('should accept valid amount', () => {
            expect(validateAmount(100).isValid).toBe(true);
        });
        it('should reject negative when min is 0', () => {
            expect(validateAmount(-1).isValid).toBe(false);
        });
        it('should reject above max', () => {
            expect(validateAmount(200, 0, 100).isValid).toBe(false);
        });
        it('should accept string amounts', () => {
            expect(validateAmount('50.5').isValid).toBe(true);
        });
    });

    describe('validateForm', () => {
        it('should pass when all validations pass', () => {
            const result = validateForm([
                () => validateRequired('test'),
                () => validateEmail('test@test.com'),
            ]);
            expect(result.isValid).toBe(true);
        });
        it('should fail on first invalid validation', () => {
            const result = validateForm([
                () => validateRequired(''),
                () => validateEmail('test@test.com'),
            ]);
            expect(result.isValid).toBe(false);
        });
    });

    describe('sanitizeInput', () => {
        it('should escape HTML characters', () => {
            expect(sanitizeInput('<script>')).not.toContain('<');
            expect(sanitizeInput('<script>')).not.toContain('>');
        });
        it('should escape quotes', () => {
            expect(sanitizeInput('"hello"')).not.toContain('"');
        });
    });

    describe('cleanPhoneNumber', () => {
        it('should add +974 prefix to bare number', () => {
            expect(cleanPhoneNumber('33334444')).toBe('+97433334444');
        });
        it('should add + to 974 prefixed number', () => {
            expect(cleanPhoneNumber('97433334444')).toBe('+97433334444');
        });
        it('should strip spaces and dashes', () => {
            expect(cleanPhoneNumber('3333-4444')).toBe('+97433334444');
        });
    });
});

// ============================================================================
// FORMATTER TESTS
// ============================================================================
import {
    formatCurrency,
    formatPhoneNumber,
    formatNumber,
    formatFileSize,
    formatDistance,
    formatDuration,
    truncateText,
    capitalize,
    formatOrderNumber,
    formatStatus,
    formatDate,
} from '../utils/formatters';

describe('Formatter Utilities', () => {
    describe('formatCurrency', () => {
        it('should format number to QAR', () => {
            const result = formatCurrency(100);
            expect(result).toContain('100');
            expect(result).toContain('QAR');
        });
        it('should handle string input', () => {
            expect(formatCurrency('50.5')).toContain('50.50');
        });
        it('should handle NaN', () => {
            expect(formatCurrency('abc')).toBe('0.00 QAR');
        });
        it('should hide symbol when requested', () => {
            expect(formatCurrency(100, 'QAR', false)).not.toContain('QAR');
        });
    });

    describe('formatPhoneNumber', () => {
        it('should format 8-digit number', () => {
            expect(formatPhoneNumber('33334444')).toBe('+974 3333 4444');
        });
        it('should handle empty', () => {
            expect(formatPhoneNumber('')).toBe('');
        });
    });

    describe('formatNumber', () => {
        it('should format with thousands separator', () => {
            expect(formatNumber(1000)).toContain('1,000');
        });
        it('should handle decimals', () => {
            expect(formatNumber(1000.5, 2)).toContain('1,000.50');
        });
    });

    describe('formatFileSize', () => {
        it('should format bytes', () => {
            expect(formatFileSize(0)).toBe('0 B');
        });
        it('should format KB', () => {
            expect(formatFileSize(1024)).toContain('KB');
        });
        it('should format MB', () => {
            expect(formatFileSize(1024 * 1024)).toContain('MB');
        });
    });

    describe('formatDistance', () => {
        it('should format meters', () => {
            expect(formatDistance(500)).toContain('500 m');
        });
        it('should format kilometers', () => {
            expect(formatDistance(1500)).toContain('km');
        });
    });

    describe('formatDuration', () => {
        it('should format minutes', () => {
            expect(formatDuration(30)).toBe('30 min');
        });
        it('should format hours', () => {
            expect(formatDuration(60)).toBe('1 hr');
        });
        it('should format hours and minutes', () => {
            expect(formatDuration(90)).toBe('1 hr 30 min');
        });
    });

    describe('truncateText', () => {
        it('should not truncate short text', () => {
            expect(truncateText('hello', 10)).toBe('hello');
        });
        it('should truncate long text with ellipsis', () => {
            const result = truncateText('this is a very long text', 10);
            expect(result).toContain('...');
            expect(result.length).toBe(10);
        });
    });

    describe('capitalize', () => {
        it('should capitalize first letter', () => {
            expect(capitalize('hello')).toBe('Hello');
        });
        it('should handle empty string', () => {
            expect(capitalize('')).toBe('');
        });
    });

    describe('formatOrderNumber', () => {
        it('should pad with zeros', () => {
            expect(formatOrderNumber('123')).toBe('#000123');
        });
        it('should handle numeric input', () => {
            expect(formatOrderNumber(42)).toBe('#000042');
        });
    });

    describe('formatStatus', () => {
        it('should convert snake_case to Title Case', () => {
            expect(formatStatus('pending_delivery')).toBe('Pending Delivery');
        });
        it('should handle empty', () => {
            expect(formatStatus('')).toBe('');
        });
    });

    describe('formatDate', () => {
        it('should format valid date', () => {
            const result = formatDate('2024-01-15');
            expect(result).not.toBe('Invalid date');
        });
        it('should return Invalid date for bad input', () => {
            expect(formatDate('not-a-date')).toBe('Invalid date');
        });
    });
});

// ============================================================================
// RTL TESTS
// ============================================================================
import {
    rtlFlexDirection,
    rtlTextAlign,
    rtlTextAlignEnd,
    rtlMarginHorizontal,
    rtlPaddingHorizontal,
    rtlChevron,
    rtlArrow,
    rtlScaleX,
    rtlStyle,
    rtlWritingDirection,
    RTL,
} from '../utils/rtl';

describe('RTL Utilities', () => {
    describe('rtlFlexDirection', () => {
        it('should return row for LTR', () => {
            expect(rtlFlexDirection(false)).toBe('row');
        });
        it('should return row-reverse for RTL', () => {
            expect(rtlFlexDirection(true)).toBe('row-reverse');
        });
    });

    describe('rtlTextAlign', () => {
        it('should return left for LTR', () => {
            expect(rtlTextAlign(false)).toBe('left');
        });
        it('should return right for RTL', () => {
            expect(rtlTextAlign(true)).toBe('right');
        });
    });

    describe('rtlTextAlignEnd', () => {
        it('should return right for LTR', () => {
            expect(rtlTextAlignEnd(false)).toBe('right');
        });
        it('should return left for RTL', () => {
            expect(rtlTextAlignEnd(true)).toBe('left');
        });
    });

    describe('rtlMarginHorizontal', () => {
        it('should set marginLeft for LTR', () => {
            const result = rtlMarginHorizontal(false, 10, 20);
            expect(result.marginLeft).toBe(10);
            expect(result.marginRight).toBe(20);
        });
        it('should swap margins for RTL', () => {
            const result = rtlMarginHorizontal(true, 10, 20);
            expect(result.marginLeft).toBe(20);
            expect(result.marginRight).toBe(10);
        });
    });

    describe('rtlPaddingHorizontal', () => {
        it('should set paddingLeft for LTR', () => {
            const result = rtlPaddingHorizontal(false, 10, 20);
            expect(result.paddingLeft).toBe(10);
            expect(result.paddingRight).toBe(20);
        });
        it('should swap padding for RTL', () => {
            const result = rtlPaddingHorizontal(true, 10, 20);
            expect(result.paddingLeft).toBe(20);
            expect(result.paddingRight).toBe(10);
        });
    });

    describe('rtlChevron', () => {
        it('should return › for LTR forward', () => {
            expect(rtlChevron(false)).toBe('›');
        });
        it('should return ‹ for RTL forward', () => {
            expect(rtlChevron(true)).toBe('‹');
        });
        it('should return ‹ for LTR back', () => {
            expect(rtlChevron(false, 'back')).toBe('‹');
        });
        it('should return › for RTL back', () => {
            expect(rtlChevron(true, 'back')).toBe('›');
        });
    });

    describe('rtlArrow', () => {
        it('should return → for LTR forward', () => {
            expect(rtlArrow(false)).toBe('→');
        });
        it('should return ← for RTL forward', () => {
            expect(rtlArrow(true)).toBe('←');
        });
    });

    describe('rtlScaleX', () => {
        it('should return scaleX 1 for LTR', () => {
            expect(rtlScaleX(false).transform[0].scaleX).toBe(1);
        });
        it('should return scaleX -1 for RTL', () => {
            expect(rtlScaleX(true).transform[0].scaleX).toBe(-1);
        });
    });

    describe('rtlWritingDirection', () => {
        it('should return ltr for LTR', () => {
            expect(rtlWritingDirection(false).writingDirection).toBe('ltr');
        });
        it('should return rtl for RTL', () => {
            expect(rtlWritingDirection(true).writingDirection).toBe('rtl');
        });
    });

    describe('rtlStyle', () => {
        it('should return LTR style unchanged', () => {
            const style = { flexDirection: 'row' as const, marginLeft: 10 };
            expect(rtlStyle(false, style)).toEqual(style);
        });
        it('should flip flexDirection for RTL', () => {
            const result = rtlStyle(true, { flexDirection: 'row' as const });
            expect(result.flexDirection).toBe('row-reverse');
        });
        it('should flip textAlign for RTL', () => {
            const result = rtlStyle(true, { textAlign: 'left' as const });
            expect(result.textAlign).toBe('right');
        });
    });

    describe('RTL constants', () => {
        it('RTL.row should return correct direction', () => {
            expect(RTL.row(false)).toBe('row');
            expect(RTL.row(true)).toBe('row-reverse');
        });
        it('RTL.start should return correct alignment', () => {
            expect(RTL.start(false)).toBe('left');
            expect(RTL.start(true)).toBe('right');
        });
    });
});

// ============================================================================
// CARD VALIDATION TESTS
// ============================================================================
import {
    validateCardNumber,
    detectCardBrand,
    validateExpiry,
    formatExpiry,
    validateCVV,
    getCVVLength,
    validateCardholderName,
    formatCardNumber,
    validateCardDetails,
    maskCardNumber,
    getCardBrandEmoji,
    getCardBrandColor,
} from '../utils/cardValidation';

describe('Card Validation Utilities', () => {
    describe('validateCardNumber', () => {
        it('should validate a valid Visa test card (Luhn)', () => {
            expect(validateCardNumber('4242424242424242')).toBe(true);
        });
        it('should reject invalid card number', () => {
            expect(validateCardNumber('1234567890123456')).toBe(false);
        });
        it('should reject too short number', () => {
            expect(validateCardNumber('123')).toBe(false);
        });
    });

    describe('detectCardBrand', () => {
        it('should detect Visa', () => {
            expect(detectCardBrand('4242424242424242')).toBe('visa');
        });
        it('should detect Mastercard', () => {
            expect(detectCardBrand('5555555555554444')).toBe('mastercard');
        });
        it('should detect Amex', () => {
            expect(detectCardBrand('378282246310005')).toBe('amex');
        });
        it('should return unknown for unrecognized', () => {
            expect(detectCardBrand('9999999999999999')).toBe('unknown');
        });
    });

    describe('validateExpiry', () => {
        it('should validate a future date', () => {
            expect(validateExpiry('12/30')).toBe(true);
        });
        it('should reject invalid format', () => {
            expect(validateExpiry('13/25')).toBe(false);
        });
        it('should reject past date', () => {
            expect(validateExpiry('01/20')).toBe(false);
        });
    });

    describe('formatExpiry', () => {
        it('should format digits to MM/YY', () => {
            expect(formatExpiry('1225')).toBe('12/25');
        });
        it('should handle partial input', () => {
            expect(formatExpiry('12')).toBe('12');
        });
        it('should return empty for empty input', () => {
            expect(formatExpiry('')).toBe('');
        });
    });

    describe('validateCVV', () => {
        it('should accept 3-digit CVV for Visa', () => {
            expect(validateCVV('123', 'visa')).toBe(true);
        });
        it('should accept 4-digit CVV for Amex', () => {
            expect(validateCVV('1234', 'amex')).toBe(true);
        });
        it('should reject 3-digit CVV for Amex', () => {
            expect(validateCVV('123', 'amex')).toBe(false);
        });
    });

    describe('getCVVLength', () => {
        it('should return 3 for Visa', () => {
            expect(getCVVLength('visa')).toBe(3);
        });
        it('should return 4 for Amex', () => {
            expect(getCVVLength('amex')).toBe(4);
        });
    });

    describe('validateCardholderName', () => {
        it('should accept valid name', () => {
            expect(validateCardholderName('John Doe')).toBe(true);
        });
        it('should reject single name', () => {
            expect(validateCardholderName('John')).toBe(false);
        });
        it('should reject too short', () => {
            expect(validateCardholderName('A')).toBe(false);
        });
    });

    describe('formatCardNumber', () => {
        it('should format Visa in 4-4-4-4', () => {
            const result = formatCardNumber('4242424242424242', 'visa');
            expect(result).toBe('4242 4242 4242 4242');
        });
        it('should format Amex in 4-6-5', () => {
            const result = formatCardNumber('378282246310005', 'amex');
            expect(result).toBe('3782 822463 10005');
        });
    });

    describe('maskCardNumber', () => {
        it('should mask all but last 4 digits', () => {
            const result = maskCardNumber('4242424242424242');
            expect(result).toContain('4242');
            expect(result).toContain('•');
        });
    });

    describe('validateCardDetails (comprehensive)', () => {
        it('should validate all fields together', () => {
            const result = validateCardDetails(
                '4242424242424242',
                '12/30',
                '123',
                'John Doe'
            );
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.brand).toBe('visa');
        });
        it('should return multiple errors for all invalid fields', () => {
            const result = validateCardDetails('', '', '', '');
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('getCardBrandEmoji', () => {
        it('should return emoji for all brands', () => {
            expect(getCardBrandEmoji('visa')).toBe('💳');
            expect(getCardBrandEmoji('mastercard')).toBe('💳');
        });
    });

    describe('getCardBrandColor', () => {
        it('should return specific colors per brand', () => {
            expect(getCardBrandColor('visa')).toBe('#1A1F71');
            expect(getCardBrandColor('mastercard')).toBe('#EB001B');
            expect(getCardBrandColor('amex')).toBe('#006FCF');
        });
    });
});

// ============================================================================
// ERROR HANDLER TESTS
// ============================================================================
import { extractErrorMessage } from '../utils/errorHandler';

describe('Error Handler Utilities', () => {
    describe('extractErrorMessage', () => {
        it('should extract string error', () => {
            expect(extractErrorMessage('Something failed')).toBe('Something failed');
        });

        it('should extract from Error object', () => {
            expect(extractErrorMessage(new Error('Test error'))).toBe('Test error');
        });

        it('should extract from response.data.error string', () => {
            expect(
                extractErrorMessage({ response: { data: { error: 'API error' } } })
            ).toBe('API error');
        });

        it('should extract from response.data.message', () => {
            expect(
                extractErrorMessage({ response: { data: { message: 'Not found' } } })
            ).toBe('Not found');
        });

        it('should extract from nested error.message', () => {
            expect(
                extractErrorMessage({
                    response: { data: { error: { message: 'Nested error' } } },
                })
            ).toBe('Nested error');
        });

        it('should return fallback for unknown format', () => {
            expect(extractErrorMessage({})).toBe('An unexpected error occurred');
        });

        it('should handle null', () => {
            expect(extractErrorMessage(null)).toBe('An unexpected error occurred');
        });
    });
});
