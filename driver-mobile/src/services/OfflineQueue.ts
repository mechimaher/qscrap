import { storage } from '../utils/storage';
import { api } from './api';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';

interface QueuedRequest {
    id: string;
    endpoint: string;
    method: string;
    body: any;
    timestamp: number;
    retryCount: number;
}

const QUEUE_KEY = 'offline_request_queue';

class OfflineQueueService {
    private queue: QueuedRequest[] = [];
    private isProcessing = false;
    private initialized = false;

    private ensureInitialized() {
        if (this.initialized) return;
        this.initialized = true;
        try {
            const json = storage.getString(QUEUE_KEY);
            if (json) {
                this.queue = JSON.parse(json);
                console.log(`[OfflineQueue] Loaded ${this.queue.length} pending requests`);
            }
        } catch (e) {
            console.warn('[OfflineQueue] Failed to load queue', e);
            this.queue = [];
        }
    }

    private saveQueue() {
        storage.set(QUEUE_KEY, JSON.stringify(this.queue));
    }

    async enqueue(endpoint: string, method: string, body: any) {
        this.ensureInitialized();
        const request: QueuedRequest = {
            id: Date.now().toString() + Math.random().toString().slice(2, 6),
            endpoint,
            method,
            body,
            timestamp: Date.now(),
            retryCount: 0
        };

        this.queue.push(request);
        this.saveQueue();
        console.log(`[OfflineQueue] Enqueued request: ${method} ${endpoint}`);

        // Try to process immediately if online
        const state = await NetInfo.fetch();
        if (state.isConnected) {
            this.processQueue();
        }
    }

    async processQueue() {
        this.ensureInitialized();
        if (this.isProcessing || this.queue.length === 0) return;

        const state = await NetInfo.fetch();
        if (!state.isConnected) {
            console.log('[OfflineQueue] Offline, pausing queue processing');
            return;
        }

        console.log('[OfflineQueue] Processing queue...');
        this.isProcessing = true;

        // Process sequentially to maintain order consistency
        // Create a copy to iterate, but modify original queue safely
        const snapshot = [...this.queue];
        const remainingQueue: QueuedRequest[] = [];

        for (const req of snapshot) {
            try {
                let bodyToSend = req.body;

                // Media Handling: If request has a local file path, read it now
                if (req.body && req.body.photoPath) {
                    const fileInfo = await FileSystem.getInfoAsync(req.body.photoPath);
                    if (fileInfo.exists) {
                        const base64 = await FileSystem.readAsStringAsync(req.body.photoPath, {
                            encoding: 'base64'
                        });
                        // Replace photoPath with actual photo data expected by backend
                        bodyToSend = {
                            ...req.body,
                            photo: base64,
                            photoPath: undefined // Remove path from payload
                        };
                    } else {
                        console.warn(`[OfflineQueue] File not found: ${req.body.photoPath}, skipping upload part`);
                    }
                }

                await api.request(req.endpoint, {
                    method: req.method,
                    body: JSON.stringify(bodyToSend)
                });
                console.log(`[OfflineQueue] Successfully processed: ${req.endpoint}`);
            } catch (err) {
                console.error(`[OfflineQueue] Failed to process ${req.endpoint}`, err);
                req.retryCount++;
                if (req.retryCount < 50) { // Keep trying for a long time (essential for logistics)
                    remainingQueue.push(req);
                } else {
                    console.error('[OfflineQueue] Dropping request after max retries:', req);
                }
            }
        }

        this.queue = remainingQueue;
        this.saveQueue();
        this.isProcessing = false;

        if (this.queue.length === 0) {
            console.log('[OfflineQueue] Queue flushed successfully');
        }
    }

    getQueueLength() {
        return this.queue.length;
    }
}

export const offlineQueue = new OfflineQueueService();
