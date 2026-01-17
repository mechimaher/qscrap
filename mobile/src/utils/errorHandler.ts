import * as Haptics from 'expo-haptics';

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
    return 'An unexpected error occurred';
};

/**
 * Standard error handler with toast notification and haptics
 * Use this for consistent error handling across the app
 */
export const handleApiError = (
    error: any,
    toast: ErrorContext,
    customMessage?: string
) => {
    const message = customMessage || extractErrorMessage(error);
    console.error('API Error:', error);
    toast.error('Error', message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
};
