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
 * Executes an API call with an offline fallback option.
 * 1. Tries the direct API call.
 * 2. If successful, calls onSuccess.
 * 3. If it fails, checks if it's a network error (or generic failure) and asks the user to queue it.
 * 4. If user accepts, enqueues the request and calls onQueued.
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
            // Optional: Toast or simple log
            console.log(`[Sync] Success: ${options.successMessage}`);
        }
        options.onSuccess?.(result);
        return { status: 'success', data: result };

    } catch (error: any) {
        console.log('[Sync] Direct call failed:', error.message);

        // 3. Fallback Logic
        // We assume most errors during an action like this might be network related 
        // or server timeout if the logic was otherwise correct.
        // We give the user the choice.

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
