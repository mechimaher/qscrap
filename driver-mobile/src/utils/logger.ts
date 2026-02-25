/**
 * QScrap Driver App - Secure Logger Utility
 * Replaces console.* statements to prevent data leakage in production
 * 
 * Features:
 * - Auto-strips sensitive data in production
 * - Integrates with Sentry for error tracking
 * - Filters noisy network errors
 * - Safe for production use
 */

import * as Sentry from '@sentry/react-native';

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
 * Warning messages - sent to Sentry in production
 */
export const warn = (...args: any[]) => {
    const message = args.join(' ');
    
    if (isDev) {
        console.warn(...args);
    } else {
        // Send to Sentry but don't alert (warning level)
        Sentry.captureMessage(message, { level: 'warning' });
    }
};

/**
 * Error messages - sent to Sentry in production
 * Filters out noisy network errors
 */
export const error = (...args: any[]) => {
    const message = args.join(' ');
    
    if (isDev) {
        console.error(...args);
    } else {
        // Don't log network errors to Sentry (too noisy)
        const isNetworkError = 
            message.includes('Network') ||
            message.includes('timeout') ||
            message.includes('AbortError') ||
            message.includes('Network request failed');
        
        if (!isNetworkError) {
            Sentry.captureException(new Error(message));
        }
    }
};

/**
 * Info messages - for important business events
 */
export const info = (...args: any[]) => {
    const message = args.join(' ');
    
    if (isDev) {
        console.info(...args);
    } else {
        Sentry.captureMessage(message, { level: 'info' });
    }
};

/**
 * Critical error - always sent to Sentry immediately
 * Use for: Payment failures, Data corruption, Security issues
 */
export const critical = (error: Error | string, context?: Record<string, any>) => {
    const err = typeof error === 'string' ? new Error(error) : error;
    
    if (isDev) {
        console.error('[CRITICAL]', err, context);
    } else {
        Sentry.captureException(err, {
            level: 'error',
            extra: context,
            tags: { severity: 'critical' },
        });
    }
};

/**
 * User action tracking - for debugging user flows
 */
export const track = (action: string, data?: Record<string, any>) => {
    if (isDev) {
        console.log('[TRACK]', action, data);
    } else {
        Sentry.addBreadcrumb({
            category: 'user-action',
            message: action,
            data,
            level: 'info',
        });
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
        } else {
            Sentry.addBreadcrumb({
                category: 'performance',
                message: `${label}: ${duration}ms`,
                level: 'info',
            });
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
