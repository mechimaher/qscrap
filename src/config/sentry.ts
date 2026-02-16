import * as Sentry from '@sentry/node';
import logger from '../utils/logger';

/**
 * Initialize Sentry for error tracking and performance monitoring
 */
export function initializeSentry() {
    const dsn = process.env.SENTRY_DSN;

    if (!dsn) {
        logger.info('Sentry DSN not found. Error tracking disabled.');
        return;
    }

    Sentry.init({
        dsn,
        // Performance Monitoring
        tracesSampleRate: 1.0, //  Capture 100% of the transactions
        environment: process.env.NODE_ENV || 'development',
    });

    logger.startup('Sentry initialized');
}

/**
 * Custom error capturer for non-exception cases
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
    Sentry.captureMessage(message, level);
}

/**
 * Custom exception capturer
 */
export function captureException(error: unknown) {
    Sentry.captureException(error);
}
