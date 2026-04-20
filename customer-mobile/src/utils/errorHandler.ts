import { log, warn, error as logError } from './logger';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { t } from './i18nHelper';

export interface ErrorContext {
    error: (title: string, message?: string) => void;
}

/**
 * Safely extracts a string error message from various error formats
 * Prevents [object] display bugs by handling all error types
 */
export const extractErrorMessage = (error: any): string => {
    // Handle string errors
    if (typeof error === 'string') {
        return error;
    }

    // Handle axios/fetch response errors
    if (error?.response?.data) {
        const data = error.response.data;
        if (typeof data.error === 'string') return data.error;
        if (data.error?.message) return data.error.message;
        if (typeof data.message === 'string') return data.message;
    }

    // Handle Error objects
    if (error?.message) {
        return error.message;
    }

    // Handle error property
    if (error?.error) {
        if (typeof error.error === 'string') return error.error;
        if (error.error?.message) return error.error.message;
    }

    // Fallback
    return t('common.unexpectedError');
};

export interface HandleApiErrorOptions {
    /** Custom message to override the extracted error message */
    customMessage?: string;
    /** Use Alert.alert instead of toast for critical flows (payment, delivery, cancellation) */
    useAlert?: boolean;
    /** Callback after the user dismisses the alert (only used with useAlert) */
    onDismiss?: () => void;
}

/**
 * Standard error handler with toast/alert notification and haptics
 * Use this for consistent error handling across the app
 *
 * @param error - The caught error object
 * @param toast - Toast context (from useToast())
 * @param options - Optional config: customMessage, useAlert, onDismiss
 */
export const handleApiError = (
    error: any,
    toast: ErrorContext,
    options?: string | HandleApiErrorOptions
) => {
    // Backward compatible: accept string as customMessage
    const opts: HandleApiErrorOptions = typeof options === 'string'
        ? { customMessage: options }
        : (options || {});

    const message = opts.customMessage || extractErrorMessage(error);
    logError('API Error:', error);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    if (opts.useAlert) {
        Alert.alert(
            t('common.error'),
            message,
            [{ text: t('common.ok'), onPress: opts.onDismiss }]
        );
    } else {
        toast.error(t('common.error'), message);
    }
};
