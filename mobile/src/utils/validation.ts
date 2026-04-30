/**
 * Validation Utilities for QScrap Mobile App
 * Provides form validation with i18n-aware error messages.
 */

import { t } from './i18nHelper';

// Qatar phone number regex (starts with +974 or 974 or just the number)
const QATAR_PHONE_REGEX = /^(\+974|974)?[3-7]\d{7}$/;

// Email regex (RFC 5322 compliant)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// VIN regex (17 alphanumeric characters, excluding I, O, Q)
const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

/**
 * Validate a required field
 */
export const validateRequired = (value: string | undefined | null, fieldName: string = 'This field'): ValidationResult => {
    if (!value || value.trim() === '') {
        return { isValid: false, error: t('errors.fieldRequired', { field: fieldName }) };
    }
    return { isValid: true };
};

/**
 * Validate minimum length
 */
export const validateMinLength = (value: string, minLength: number, fieldName: string = 'This field'): ValidationResult => {
    if (value.length < minLength) {
        return { isValid: false, error: t('errors.minLength', { field: fieldName, min: minLength }) };
    }
    return { isValid: true };
};

/**
 * Validate maximum length
 */
export const validateMaxLength = (value: string, maxLength: number, fieldName: string = 'This field'): ValidationResult => {
    if (value.length > maxLength) {
        return { isValid: false, error: t('errors.maxLength', { field: fieldName, max: maxLength }) };
    }
    return { isValid: true };
};

/**
 * Validate Qatar phone number
 * Accepts formats: +97412345678, 97412345678, 12345678
 */
export const validatePhoneNumber = (phone: string): ValidationResult => {
    const cleaned = phone.replace(/\s|-/g, '');

    if (!cleaned) {
        return { isValid: false, error: t('errors.phoneRequired') };
    }

    if (!QATAR_PHONE_REGEX.test(cleaned)) {
        return { isValid: false, error: t('errors.invalidPhoneQatar') };
    }

    return { isValid: true };
};

/**
 * Validate email address
 */
export const validateEmail = (email: string): ValidationResult => {
    if (!email) {
        return { isValid: false, error: t('errors.emailRequired') };
    }

    if (!EMAIL_REGEX.test(email)) {
        return { isValid: false, error: t('errors.invalidEmail') };
    }

    return { isValid: true };
};

/**
 * Validate password strength
 */
export const validatePassword = (password: string): ValidationResult & { strength: 'weak' | 'medium' | 'strong' } => {
    if (!password) {
        return { isValid: false, error: t('errors.passwordRequired'), strength: 'weak' };
    }

    if (password.length < 6) {
        return { isValid: false, error: t('errors.passwordShort'), strength: 'weak' };
    }

    // Check password strength
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    let score = 0;

    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score >= 4) strength = 'strong';
    else if (score >= 2) strength = 'medium';

    return { isValid: true, strength };
};

/**
 * Validate password confirmation
 */
export const validatePasswordConfirm = (password: string, confirmPassword: string): ValidationResult => {
    if (!confirmPassword) {
        return { isValid: false, error: t('errors.confirmRequired') };
    }

    if (password !== confirmPassword) {
        return { isValid: false, error: t('errors.passwordMismatch') };
    }

    return { isValid: true };
};

/**
 * Validate VIN (Vehicle Identification Number)
 * Standard 17-character format
 */
export const validateVIN = (vin: string): ValidationResult => {
    if (!vin) {
        return { isValid: true }; // VIN is often optional
    }

    const cleaned = vin.toUpperCase().trim();

    if (cleaned.length !== 17) {
        return { isValid: false, error: t('errors.vinLength') };
    }

    if (!VIN_REGEX.test(cleaned)) {
        return { isValid: false, error: t('errors.vinInvalid') };
    }

    return { isValid: true };
};

/**
 * Validate year (for car year)
 */
export const validateYear = (year: string | number): ValidationResult => {
    const yearNum = typeof year === 'string' ? parseInt(year, 10) : year;
    const currentYear = new Date().getFullYear();

    if (isNaN(yearNum)) {
        return { isValid: false, error: t('errors.yearInvalid') };
    }

    if (yearNum < 1900 || yearNum > currentYear + 1) {
        return { isValid: false, error: t('errors.yearRange', { min: 1900, max: currentYear + 1 }) };
    }

    return { isValid: true };
};

/**
 * Validate price/amount
 */
export const validateAmount = (amount: string | number, min: number = 0, max?: number): ValidationResult => {
    const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;

    if (isNaN(amountNum)) {
        return { isValid: false, error: t('errors.amountInvalid') };
    }

    if (amountNum < min) {
        return { isValid: false, error: t('errors.amountMin', { min }) };
    }

    if (max !== undefined && amountNum > max) {
        return { isValid: false, error: t('errors.amountMax', { max }) };
    }

    return { isValid: true };
};

/**
 * Validate multiple fields at once
 */
export const validateForm = (validations: Array<() => ValidationResult>): ValidationResult => {
    for (const validate of validations) {
        const result = validate();
        if (!result.isValid) {
            return result;
        }
    }
    return { isValid: true };
};

/**
 * Sanitize input to prevent XSS
 */
export const sanitizeInput = (input: string): string => {
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
};

/**
 * Clean phone number for API submission
 */
export const cleanPhoneNumber = (phone: string): string => {
    let cleaned = phone.replace(/\s|-/g, '');

    // Add +974 if not present
    if (!cleaned.startsWith('+')) {
        if (cleaned.startsWith('974')) {
            cleaned = '+' + cleaned;
        } else {
            cleaned = '+974' + cleaned;
        }
    }

    return cleaned;
};
