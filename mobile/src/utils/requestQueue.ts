import { log, warn, error as logError } from './logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@request_queue';

export interface QueuedRequest {
    id: string;
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    data?: any;
    timestamp: number;
    retryCount: number;
}

/**
 * Add a failed request to the queue for retry when online
 */
export const queueRequest = async (request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount'>): Promise<void> => {
    try {
        const queue = await getQueue();
        const newRequest: QueuedRequest = {
            ...request,
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            retryCount: 0,
        };
        queue.push(newRequest);
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        log('[RequestQueue] Request queued:', newRequest.id);
    } catch (error) {
        logError('[RequestQueue] Failed to queue request:', error);
    }
};

/**
 * Get all queued requests
 */
export const getQueue = async (): Promise<QueuedRequest[]> => {
    try {
        const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
        return queueJson ? JSON.parse(queueJson) : [];
    } catch (error) {
        logError('[RequestQueue] Failed to get queue:', error);
        return [];
    }
};

/**
 * Get count of pending requests
 */
export const getQueueCount = async (): Promise<number> => {
    const queue = await getQueue();
    return queue.length;
};

/**
 * Remove a request from the queue
 */
export const removeFromQueue = async (requestId: string): Promise<void> => {
    try {
        const queue = await getQueue();
        const filtered = queue.filter(r => r.id !== requestId);
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
        log('[RequestQueue] Request removed:', requestId);
    } catch (error) {
        logError('[RequestQueue] Failed to remove request:', error);
    }
};

/**
 * Clear all queued requests
 */
export const clearQueue = async (): Promise<void> => {
    try {
        await AsyncStorage.removeItem(QUEUE_KEY);
        log('[RequestQueue] Queue cleared');
    } catch (error) {
        logError('[RequestQueue] Failed to clear queue:', error);
    }
};

/**
 * Process queued requests (call when back online)
 */
export const processQueue = async (apiClient: any): Promise<{ success: number; failed: number }> => {
    const queue = await getQueue();
    let success = 0;
    let failed = 0;

    log(`[RequestQueue] Processing ${queue.length} queued requests`);

    for (const request of queue) {
        try {
            // Attempt to retry the request
            const response = await apiClient.request({
                url: request.endpoint,
                method: request.method,
                data: request.data,
            });

            if (response.success) {
                await removeFromQueue(request.id);
                success++;
                log('[RequestQueue] Request succeeded:', request.id);
            } else {
                // Increment retry count
                request.retryCount++;
                if (request.retryCount >= 3) {
                    // Max retries reached, remove from queue
                    await removeFromQueue(request.id);
                    failed++;
                    log('[RequestQueue] Max retries reached:', request.id);
                } else {
                    // Update retry count
                    const updatedQueue = queue.map(r =>
                        r.id === request.id ? request : r
                    );
                    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updatedQueue));
                }
            }
        } catch (error) {
            logError('[RequestQueue] Request failed:', request.id, error);
            request.retryCount++;
            if (request.retryCount >= 3) {
                await removeFromQueue(request.id);
                failed++;
            }
        }
    }

    log(`[RequestQueue] Processing complete: ${success} succeeded, ${failed} failed`);
    return { success, failed };
};
