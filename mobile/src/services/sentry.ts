/**
 * Sentry Configuration — E4/E5 Enterprise Crash Reporting
 * Production-ready error tracking and performance monitoring.
 * 
 * Setup Complete:
 * 1. @sentry/react-native installed ✅
 * 2. Plugin added to app.json ✅
 * 3. DSN placeholder added to extra ✅
 * 
 * To activate:
 * - Get DSN from https://sentry.io -> Project Settings -> Client Keys
 * - Add DSN to app.json extra.sentryDsn field
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// Configuration from app.json
const SENTRY_DSN = Constants.expoConfig?.extra?.sentryDsn || '';
const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
const APP_ENV = __DEV__ ? 'development' : 'production';

/**
 * Initialize Sentry for the application.
 * Should be called at app startup before any other code.
 */
export function initSentry(): void {
    // Skip initialization if no DSN configured
    if (!SENTRY_DSN) {
        console.log('[Sentry] No DSN configured, skipping initialization');
        console.log('[Sentry] Add DSN to app.json extra.sentryDsn to enable');
        return;
    }

    Sentry.init({
        dsn: SENTRY_DSN,

        // Environment configuration
        environment: APP_ENV,
        release: `qscrap-mobile@${APP_VERSION}`,

        // Performance monitoring (sample 20% of transactions in production)
        tracesSampleRate: __DEV__ ? 1.0 : 0.2,

        // Attach user data if available
        attachStacktrace: true,

        // Debug mode for development
        debug: __DEV__,

        // Filter out known non-critical errors
        beforeSend(event, hint) {
            // Don't report network errors in development
            if (__DEV__ && event.exception?.values?.[0]?.type === 'NetworkError') {
                return null;
            }

            // Filter out user cancellation errors
            const errorValue = event.exception?.values?.[0]?.value || '';
            if (errorValue.includes('User cancelled')) {
                return null;
            }

            return event;
        },

        // Breadcrumb configuration
        maxBreadcrumbs: 50,
    });

    console.log('[Sentry] Initialized successfully');
}

/**
 * Identify the current user for error tracking.
 * Call this after successful login.
 */
export function identifyUser(
    userId: string,
    email?: string,
    name?: string
): void {
    if (!SENTRY_DSN) return;

    Sentry.setUser({
        id: userId,
        email,
        username: name,
    });
}

/**
 * Clear user identity on logout.
 */
export function clearUserIdentity(): void {
    if (!SENTRY_DSN) return;
    Sentry.setUser(null);
}

/**
 * Add custom context to error reports.
 */
export function setContext(
    key: string,
    context: Record<string, unknown>
): void {
    if (!SENTRY_DSN) return;
    Sentry.setContext(key, context);
}

/**
 * Add a breadcrumb for debugging.
 */
export function addBreadcrumb(
    category: string,
    message: string,
    data?: Record<string, unknown>,
    level: Sentry.SeverityLevel = 'info'
): void {
    if (!SENTRY_DSN) {
        if (__DEV__) {
            console.log(`[Sentry Stub] breadcrumb (${level}):`, category, message);
        }
        return;
    }

    Sentry.addBreadcrumb({
        category,
        message,
        data,
        level,
    });
}

/**
 * Capture an exception with optional context.
 */
export function captureException(
    error: Error,
    context?: Record<string, unknown>
): string {
    if (!SENTRY_DSN) {
        console.error('[Sentry] Exception (DSN not configured):', error);
        return '';
    }

    return Sentry.captureException(error, {
        extra: context,
    });
}

/**
 * Capture a message (for non-error events).
 */
export function captureMessage(
    message: string,
    level: Sentry.SeverityLevel = 'info'
): string {
    if (!SENTRY_DSN) {
        console.log(`[Sentry] Message (DSN not configured):`, message);
        return '';
    }

    return Sentry.captureMessage(message, level);
}

/**
 * React Navigation integration for automatic route tracking.
 * Use this in your NavigationContainer onReady callback.
 */
export const reactNavigationIntegration = Sentry.reactNavigationIntegration;

/**
 * HOC to wrap the root component for error boundary.
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * Expo-specific wrap function
 */
export const wrap = Sentry.wrap;

export default {
    init: initSentry,
    identifyUser,
    clearUserIdentity,
    setContext,
    addBreadcrumb,
    captureException,
    captureMessage,
    reactNavigationIntegration,
    SentryErrorBoundary,
    wrap,
};
