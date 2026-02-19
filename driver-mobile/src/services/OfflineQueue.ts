import { storage } from '../utils/storage';
import { api } from './api';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';

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
            return;
        }

        this.isProcessing = true;

        // Process sequentially to maintain order consistency
        // We use a while loop to handle items added during processing
        while (this.queue.length > 0) {
            const req = this.queue[0];

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
                            photo_base64: base64,
                            photoPath: undefined // Remove path from payload
                        };
                    } else {
                        console.warn(`[OfflineQueue] File not found: ${req.body.photoPath}, skipping upload part`);
                    }
                }

                // Age out stale requests (older than 1 hour)
                const ageMs = Date.now() - req.timestamp;
                if (ageMs > 60 * 60 * 1000) {
                    console.warn(`[OfflineQueue] Dropping stale request (${Math.round(ageMs / 60000)}min old): ${req.endpoint}`);
                    this.queue.shift();
                    this.saveQueue();
                    continue;
                }

                await api.request(req.endpoint, {
                    method: req.method,
                    body: JSON.stringify(bodyToSend)
                });

                // Success: remove from queue
                this.queue.shift();
                this.saveQueue();
            } catch (err: any) {
                console.error(`[OfflineQueue] Failed ${req.endpoint}:`, err.message || err);

                // THROTTLING: Handle 429 Too Many Requests
                if (err.message && err.message.includes('429')) {
                    console.warn('[OfflineQueue] Rate limit hit (429), pausing queue for 60s');
                    // Wait 60 seconds before retrying THIS same request
                    await new Promise(resolve => setTimeout(resolve, 60000));
                    continue; // Loop again to retry the same request
                }

                // If it's a 4xx error (client error), we should probably drop it 
                // as retrying won't fix a bad request (e.g. invalid status transition)
                // VVIP: Also handle "Already" message
                const isClientError = err.message && (
                    err.message.includes('Cannot transition') ||
                    err.message.includes('not found') ||
                    err.message.includes('invalid') ||
                    err.message.includes('already')
                );

                if (isClientError) {
                    console.warn('[OfflineQueue] Client error detected, dropping request to prevent loop');
                    this.queue.shift();
                    this.saveQueue();
                    continue; // Move to next item
                }

                // Update retry count
                req.retryCount++;

                if (req.retryCount >= 5) {
                    console.error('[OfflineQueue] Dropping request after max retries:', req);
                    this.queue.shift();
                    this.saveQueue();
                } else {
                    // Exponential backoff: 2s, 4s, 8s, 16s, 32s
                    const backoffMs = Math.pow(2, req.retryCount) * 1000;
                    // Update the queue with the incremented retry count
                    this.saveQueue();
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
            }
        }

        this.isProcessing = false;

        if (this.queue.length === 0) {
        }
    }

    getQueueLength() {
        this.ensureInitialized();
        return this.queue.length;
    }

    /**
     * VVIP: Get IDs of assignments that have pending status updates.
     * Used to prevent overwriting optimistic local state with stale backend data.
     */
    getPendingAssignmentIds(): string[] {
        this.ensureInitialized();
        const ids = new Set<string>();

        for (const req of this.queue) {
            // Check for assignment status update endpoint format: /driver/assignments/{id}/status
            // We look for endpoints containing /driver/assignments/ and try to extract the ID
            if (req.endpoint.includes('/driver/assignments/')) {
                // Remove prefix
                const afterPrefix = req.endpoint.split('/driver/assignments/')[1];
                if (afterPrefix) {
                    // Extract ID (part before the next slash)
                    const id = afterPrefix.split('/')[0];
                    if (id) {
                        ids.add(id);
                    }
                }
            }
        }

        return Array.from(ids);
    }
}

export const offlineQueue = new OfflineQueueService();
