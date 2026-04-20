"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSecureToken = exports.getJwtSignOptions = exports.performStartupSecurityChecks = exports.validateSecurityEnvironment = exports.getJwtSecret = exports.TRIAL_DAYS = exports.BCRYPT_ROUNDS = exports.TOKEN_EXPIRY_STRING = exports.TOKEN_EXPIRY_SECONDS = void 0;
const crypto_1 = __importDefault(require("crypto"));
// ============================================
// CONFIGURATION CONSTANTS
// ============================================
/** Token expiry in seconds (30 days) */
exports.TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60;
/** Token expiry in human-readable format for JWT */
exports.TOKEN_EXPIRY_STRING = '30d';
/** Minimum JWT secret length for production */
const MIN_SECRET_LENGTH = 32;
/** Password hash rounds (bcrypt cost factor) */
exports.BCRYPT_ROUNDS = 12;
/** Trial days for new garage accounts */
exports.TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '30', 10);
// ============================================
// JWT SECRET MANAGEMENT
// ============================================
let cachedJwtSecret = null;
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
const getJwtSecret = () => {
    // Return cached value if already validated
    if (cachedJwtSecret) {
        return cachedJwtSecret;
    }
    const secret = process.env.JWT_SECRET;
    isProduction = process.env.NODE_ENV === 'production';
    // Production validation
    if (isProduction) {
        if (!secret) {
            throw new Error('FATAL: JWT_SECRET environment variable is required in production. ' +
                'Generate a secure secret: openssl rand -base64 48');
        }
        if (secret.length < MIN_SECRET_LENGTH) {
            throw new Error(`FATAL: JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters. ` +
                `Current length: ${secret.length}. ` +
                'Generate a secure secret: openssl rand -base64 48');
        }
        cachedJwtSecret = secret;
        return cachedJwtSecret;
    }
    // Development mode
    if (!secret) {
        console.warn('');
        console.warn('⚠️  [SECURITY] WARNING: Using development JWT secret');
        console.warn('⚠️  [SECURITY] Set JWT_SECRET environment variable for production!');
        console.warn('⚠️  [SECURITY] Generate: openssl rand -base64 48');
        console.warn('');
        // Generate a consistent dev secret based on machine info
        // This prevents token invalidation during dev restarts
        cachedJwtSecret = 'dev-secret-qscrap-not-for-production-' +
            crypto_1.default.createHash('sha256').update(process.cwd()).digest('hex').slice(0, 16);
        return cachedJwtSecret;
    }
    cachedJwtSecret = secret;
    return cachedJwtSecret;
};
exports.getJwtSecret = getJwtSecret;
/**
 * Validates all required environment variables at startup.
 * Call this during server initialization.
 *
 * @returns Validation result with warnings and errors
 */
const validateSecurityEnvironment = () => {
    const result = {
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
        }
        else {
            result.warnings.push('JWT_SECRET not set - using development fallback');
        }
    }
    else if (jwtSecret.length < MIN_SECRET_LENGTH) {
        if (isProd) {
            result.errors.push(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
            result.isValid = false;
        }
        else {
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
exports.validateSecurityEnvironment = validateSecurityEnvironment;
/**
 * Performs startup security checks and logs results.
 * Will throw in production if critical checks fail.
 *
 * @throws Error if critical security requirements not met in production
 */
const performStartupSecurityChecks = () => {
    const isProd = process.env.NODE_ENV === 'production';
    console.log('');
    console.log('🔐 Security Configuration');
    console.log('─────────────────────────');
    // Validate environment
    const validation = (0, exports.validateSecurityEnvironment)();
    // Log warnings
    for (const warning of validation.warnings) {
        console.warn(`   ⚠️  ${warning}`);
    }
    // Log errors
    for (const error of validation.errors) {
        console.error(`   ❌ ${error}`);
    }
    // Throw if invalid in production
    if (!validation.isValid && isProd) {
        console.error('');
        console.error('🚨 FATAL: Security validation failed in production');
        console.error('🚨 Fix the above errors before starting the server');
        console.error('');
        throw new Error('Security validation failed - see errors above');
    }
    // Pre-validate JWT secret (will throw if invalid in production)
    try {
        (0, exports.getJwtSecret)();
        console.log('   ✅ JWT secret configured');
    }
    catch (error) {
        throw error;
    }
    // Log security summary
    console.log(`   ✅ Environment: ${isProd ? 'PRODUCTION' : 'development'}`);
    console.log(`   ✅ Token expiry: ${exports.TOKEN_EXPIRY_SECONDS / 86400} days`);
    console.log(`   ✅ Bcrypt rounds: ${exports.BCRYPT_ROUNDS}`);
    console.log('');
};
exports.performStartupSecurityChecks = performStartupSecurityChecks;
// ============================================
// TOKEN UTILITIES
// ============================================
/**
 * Configuration object for JWT signing.
 * Use with jwt.sign() for consistent token creation.
 */
const getJwtSignOptions = () => ({
    expiresIn: exports.TOKEN_EXPIRY_SECONDS
});
exports.getJwtSignOptions = getJwtSignOptions;
/**
 * Generates a secure random string for various purposes.
 *
 * @param length - Desired string length
 * @returns Cryptographically secure random string
 */
const generateSecureToken = (length = 32) => {
    return crypto_1.default.randomBytes(length).toString('hex').slice(0, length);
};
exports.generateSecureToken = generateSecureToken;
// ============================================
// EXPORTS
// ============================================
exports.default = {
    getJwtSecret: exports.getJwtSecret,
    validateSecurityEnvironment: exports.validateSecurityEnvironment,
    performStartupSecurityChecks: exports.performStartupSecurityChecks,
    getJwtSignOptions: exports.getJwtSignOptions,
    generateSecureToken: exports.generateSecureToken,
    TOKEN_EXPIRY_SECONDS: exports.TOKEN_EXPIRY_SECONDS,
    TOKEN_EXPIRY_STRING: exports.TOKEN_EXPIRY_STRING,
    BCRYPT_ROUNDS: exports.BCRYPT_ROUNDS,
    TRIAL_DAYS: exports.TRIAL_DAYS
};
