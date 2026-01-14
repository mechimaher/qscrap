import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { offlineQueue } from '../services/OfflineQueue';

interface QueueConfig {
    endpoint: string;
    method: string;
    body: any;
}

interface SyncOptions {
    onSuccess?: (data: any) => void;
    onQueued?: () => void;
    onError?: (error: any) => void;
    successMessage?: string;
}

/**
 * Check if error is a network error that warrants offline fallback
 */
const isNetworkError = (error: any): boolean => {
    if (!error) return false;

    const message = error.message?.toLowerCase() || '';
    const name = error.name?.toLowerCase() || '';

    // Common network error patterns
    const networkPatterns = [
        'network request failed',
        'network error',
        'failed to fetch',
        'networkerror',
        'timeout',
        'connection refused',
        'econnrefused',
        'enotfound',
        'socket hang up',
        'abort',
        'no internet',
        'offline'
    ];

    // Check if it's a TypeError (common for fetch failures)
    if (name === 'typeerror' && message.includes('fetch')) {
        return true;
    }

    return networkPatterns.some(pattern => message.includes(pattern));
};

/**
 * Executes an API call with an offline fallback option.
 * 1. Tries the direct API call.
 * 2. If successful, calls onSuccess.
 * 3. If it fails with a NETWORK error, asks the user to queue it.
 * 4. If it fails with a SERVER error, shows the actual error message.
 */
export const executeWithOfflineFallback = async (
    apiCall: () => Promise<any>,
    queueConfig: QueueConfig,
    options: SyncOptions = {}
) => {
    try {
        // 1. Try Direct Call
        const result = await apiCall();

        // 2. Success
        if (options.successMessage) {
            console.log(`[Sync] Success: ${options.successMessage}`);
        }
        options.onSuccess?.(result);
        return { status: 'success', data: result };

    } catch (error: any) {
        console.log('[Sync] Direct call failed:', error.message);

        // 3. Check if this is actually a network error
        if (!isNetworkError(error)) {
            // It's a server error (400, 500, etc.) - show actual error, don't offer offline queue
            console.log('[Sync] Server error, not offering offline fallback');
            options.onError?.(error);
            throw error; // Re-throw so caller can handle it properly
        }

        // 4. Network error - offer offline fallback
        return new Promise((resolve) => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

            Alert.alert(
                'Connection Issue',
                'Failed to connect to server. Would you like to save this action and upload it automatically when back online?',
                [
                    {
                        text: 'Retry',
                        style: 'cancel',
                        onPress: () => {
                            options.onError?.(error);
                            resolve({ status: 'error', error });
                        }
                    },
                    {
                        text: 'Save for Later',
                        style: 'default',
                        onPress: async () => {
                            try {
                                await offlineQueue.enqueue(
                                    queueConfig.endpoint,
                                    queueConfig.method,
                                    queueConfig.body
                                );
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                options.onQueued?.();
                                resolve({ status: 'queued' });
                            } catch (queueError) {
                                console.error('[Sync] Failed to enqueue:', queueError);
                                Alert.alert('Error', 'Could not save to offline queue.');
                                options.onError?.(queueError);
                                resolve({ status: 'error', error: queueError });
                            }
                        }
                    }
                ]
            );
        });
    }
};
