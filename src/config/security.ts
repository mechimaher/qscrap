/**
 * Security Configuration Module
 * 
 * Centralized security settings for QScrap platform.
 * This module provides:
 * - JWT secret management with production safety
 * - Environment validation at startup
 * - Security-related constants
 * - Token configuration
 * 
 * @module config/security
 */

import * as crypto from 'crypto';
import logger from '../utils/logger';

// ============================================
// CONFIGURATION CONSTANTS
// ============================================

/**
 * Access token expiry.
 * Configurable via ACCESS_TOKEN_EXPIRY env var.
 * Transition period: defaults to '30d' for backward compatibility.
 * Target: '15m' after mobile apps support refresh flow.
 */
export const TOKEN_EXPIRY_STRING = process.env.ACCESS_TOKEN_EXPIRY || '15m';

/** Parse token expiry string to seconds */
function parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)(s|m|h|d)$/);
    if (!match) { return 30 * 24 * 60 * 60; } // fallback 30 days
    const value = parseInt(match[1], 10);
    switch (match[2]) {
        case 's': return value;
        case 'm': return value * 60;
        case 'h': return value * 3600;
        case 'd': return value * 86400;
        default: return 30 * 86400;
    }
}

export const TOKEN_EXPIRY_SECONDS = parseExpiryToSeconds(TOKEN_EXPIRY_STRING);

/** Refresh token validity in days */
export const REFRESH_TOKEN_EXPIRY_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '7', 10);

/** Refresh token validity in milliseconds */
export const REFRESH_TOKEN_EXPIRY_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

/** Minimum JWT secret length for production */
const MIN_SECRET_LENGTH = 32;

/** Password hash rounds (bcrypt cost factor) */
export const BCRYPT_ROUNDS = 12;

/** Trial days for new garage accounts */
export const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '30', 10);

// ============================================
// JWT SECRET MANAGEMENT
// ============================================

let cachedJwtSecret: string | null = null;
let isProduction = false;

/**
 * Validates and retrieves the JWT secret.
 * 
 * Production requirements:
 * - JWT_SECRET must be set via environment variable
 * - Secret must be at least 32 characters
 * - Will throw fatal error if requirements not met
 * 
 * Development behavior:
 * - Falls back to a development-only secret
 * - Logs warning to console
 * 
 * @returns The JWT secret string
 * @throws Error if production requirements not met
 */
export const getJwtSecret = (): string => {
    // Return cached value if already validated
    if (cachedJwtSecret) {
        return cachedJwtSecret;
    }

    const secret = process.env.JWT_SECRET;
    isProduction = process.env.NODE_ENV === 'production';

    // Production validation
    if (isProduction) {
        if (!secret) {
            throw new Error(
                'FATAL: JWT_SECRET environment variable is required in production. ' +
                'Generate a secure secret: openssl rand -base64 48'
            );
        }

        if (secret.length < MIN_SECRET_LENGTH) {
            throw new Error(
                `FATAL: JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters. ` +
                `Current length: ${secret.length}. ` +
                'Generate a secure secret: openssl rand -base64 48'
            );
        }

        cachedJwtSecret = secret;
        return cachedJwtSecret;
    }

    // Development mode
    if (!secret) {
        logger.warn('Using development JWT secret - set JWT_SECRET for production');

        // Generate a consistent dev secret based on machine info
        // This prevents token invalidation during dev restarts
        cachedJwtSecret = `dev-secret-qscrap-not-for-production-${crypto.createHash('sha256').update(process.cwd()).digest('hex').slice(0, 16)}`;
        return cachedJwtSecret;
    }

    cachedJwtSecret = secret;
    return cachedJwtSecret;
};

// ============================================
// ENVIRONMENT VALIDATION
// ============================================

interface EnvValidationResult {
    isValid: boolean;
    warnings: string[];
    errors: string[];
}

/**
 * Validates all required environment variables at startup.
 * Call this during server initialization.
 * 
 * @returns Validation result with warnings and errors
 */
export const validateSecurityEnvironment = (): EnvValidationResult => {
    const result: EnvValidationResult = {
        isValid: true,
        warnings: [],
        errors: []
    };

    const isProd = process.env.NODE_ENV === 'production';

    // JWT_SECRET validation
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        if (isProd) {
            result.errors.push('JWT_SECRET is required in production');
            result.isValid = false;
        } else {
            result.warnings.push('JWT_SECRET not set - using development fallback');
        }
    } else if (jwtSecret.length < MIN_SECRET_LENGTH) {
        if (isProd) {
            result.errors.push(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
            result.isValid = false;
        } else {
            result.warnings.push(`JWT_SECRET is shorter than recommended (${MIN_SECRET_LENGTH} chars)`);
        }
    }

    // Database validation
    if (!process.env.DB_HOST && !process.env.DATABASE_URL) {
        result.warnings.push('DB_HOST not set - using localhost default');
    }

    if (!process.env.DB_PASSWORD && isProd) {
        result.errors.push('DB_PASSWORD is required in production');
        result.isValid = false;
    }

    // CORS validation for production
    if (isProd && !process.env.CORS_ORIGINS) {
        result.warnings.push('CORS_ORIGINS not set - consider restricting in production');
    }

    // Port validation
    const port = process.env.PORT;
    if (port && (isNaN(parseInt(port)) || parseInt(port) < 1 || parseInt(port) > 65535)) {
        result.errors.push(`Invalid PORT value: ${port}`);
        result.isValid = false;
    }

    return result;
};

/**
 * Performs startup security checks and logs results.
 * Will throw in production if critical checks fail.
 * 
 * @throws Error if critical security requirements not met in production
 */
export const performStartupSecurityChecks = (): void => {
    const isProd = process.env.NODE_ENV === 'production';

    // Validate environment
    const validation = validateSecurityEnvironment();

    // Log warnings
    for (const warning of validation.warnings) {
        logger.warn(warning);
    }

    // Log errors
    for (const error of validation.errors) {
        logger.error(error);
    }

    // Throw if invalid in production
    if (!validation.isValid && isProd) {
        logger.error('Security validation failed in production - fix errors before starting');
        throw new Error('Security validation failed - see errors above');
    }

    // Pre-validate JWT secret (will throw if invalid in production)
    getJwtSecret();

    // Log security summary
    logger.startup(`Security: ${isProd ? 'PRODUCTION' : 'development'}, Token: ${TOKEN_EXPIRY_SECONDS / 86400}d, Bcrypt: ${BCRYPT_ROUNDS} rounds`);
};

// ============================================
// TOKEN UTILITIES
// ============================================

/**
 * Configuration object for JWT signing.
 * Use with jwt.sign() for consistent token creation.
 */
export const getJwtSignOptions = () => ({
    expiresIn: TOKEN_EXPIRY_SECONDS
});

/**
 * Generates a secure random string for various purposes.
 * 
 * @param length - Desired string length
 * @returns Cryptographically secure random string
 */
export const generateSecureToken = (length: number = 32): string => {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
};

/**
 * Generates a cryptographically secure refresh token.
 * Returns both the raw token (sent to client) and its SHA-256 hash (stored in DB).
 */
export const generateRefreshToken = (): { token: string; hash: string } => {
    const token = crypto.randomBytes(48).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return { token, hash };
};

/**
 * Hashes a refresh token for DB lookup.
 */
export const hashRefreshToken = (token: string): string => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

// ============================================
// EXPORTS
// ============================================

export default {
    getJwtSecret,
    validateSecurityEnvironment,
    performStartupSecurityChecks,
    getJwtSignOptions,
    generateSecureToken,
    generateRefreshToken,
    hashRefreshToken,
    TOKEN_EXPIRY_SECONDS,
    TOKEN_EXPIRY_STRING,
    REFRESH_TOKEN_EXPIRY_DAYS,
    REFRESH_TOKEN_EXPIRY_MS,
    BCRYPT_ROUNDS,
    TRIAL_DAYS
};
