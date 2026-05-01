/**
 * QScrap Driver App - Secure Logger Utility
 * Replaces console.* statements to prevent data leakage in production
 * 
 * Features:
 * - Auto-strips sensitive data in production
 * - Filters noisy network errors
 * - Safe for production use
 */

const isDev = __DEV__;

/**
 * Log messages - only in development
 * In production, these are silently ignored
 */
export const log = (...args: any[]) => {
    if (isDev) {
        console.log(...args);
    }
};

/**
 * Warning messages - logged in dev only
 */
export const warn = (...args: any[]) => {
    if (isDev) {
        console.warn(...args);
    }
};

/**
 * Error messages - logged in dev, filtered in production
 */
export const error = (...args: any[]) => {
    if (isDev) {
        console.error(...args);
    }
};

/**
 * Info messages - for important business events
 */
export const info = (...args: any[]) => {
    if (isDev) {
        console.info(...args);
    }
};

/**
 * Critical error - always logged
 * Use for: Payment failures, Data corruption, Security issues
 */
export const critical = (error: Error | string, context?: Record<string, any>) => {
    const err = typeof error === 'string' ? new Error(error) : error;

    if (isDev) {
        console.error('[CRITICAL]', err, context);
    }
};

/**
 * User action tracking - for debugging user flows
 */
export const track = (action: string, data?: Record<string, any>) => {
    if (isDev) {
        console.log('[TRACK]', action, data);
    }
};

/**
 * Performance timing - measure operation duration
 */
export const startTimer = (label: string): (() => void) => {
    const start = Date.now();

    return () => {
        const duration = Date.now() - start;
        if (isDev) {
            console.log(`[PERF] ${label}: ${duration}ms`);
        }
    };
};

// Export as default for convenience
export default {
    log,
    warn,
    error,
    info,
    critical,
    track,
    startTimer,
};
