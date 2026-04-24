/**
 * OfflineQueue Service Unit Tests
 * Tests the offline request queue with exponential backoff, rate limiting, and media handling
 */

import { offlineQueue } from '../services/OfflineQueue';
import { storage } from '../utils/storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from '../services/api';

// Mock dependencies
jest.mock('../utils/storage');
jest.mock('@react-native-community/netinfo');
jest.mock('expo-file-system/legacy');
jest.mock('../services/api');

const mockStorage = storage as jest.Mocked<typeof storage>;
const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;
const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;
const mockApi = api as jest.Mocked<typeof api>;

const advanceTimers = async (ms: number) => {
    const jestWithAsync = jest as unknown as { advanceTimersByTimeAsync?: (time: number) => Promise<void> };
    if (jestWithAsync.advanceTimersByTimeAsync) {
        await jestWithAsync.advanceTimersByTimeAsync(ms);
        return;
    }
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
};

describe('OfflineQueue Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        offlineQueue.resetForTests();
        
        // Default: online state
        (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
        
        // Default: empty queue
        (mockStorage.getString as jest.Mock).mockReturnValue(null);
        
        // Default: API success
        (mockApi.request as jest.Mock).mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('enqueue', () => {
        it('should add request to queue when offline', async () => {
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
            
            await offlineQueue.enqueue('/driver/location', 'POST', { lat: 25.276987, lng: 51.520008 });
            
            expect(mockStorage.set).toHaveBeenCalled();
            expect(offlineQueue.getQueueLength()).toBe(1);
        });

        it('should add request to queue and process immediately when online', async () => {
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
            
            await offlineQueue.enqueue('/driver/location', 'POST', { lat: 25.276987, lng: 51.520008 });
            
            expect(mockStorage.set).toHaveBeenCalled();
            expect(mockApi.request).toHaveBeenCalledWith('/driver/location', expect.any(Object));
        });

        it('should generate unique IDs for each request', async () => {
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
            
            await offlineQueue.enqueue('/driver/location', 'POST', { lat: 25.276987, lng: 51.520008 });
            await offlineQueue.enqueue('/driver/location', 'POST', { lat: 25.276988, lng: 51.520009 });
            
            const calls = (mockStorage.set as jest.Mock).mock.calls;
            const queue1 = JSON.parse(calls[0][1]);
            const queue2 = JSON.parse(calls[1][1]);
            
            expect(queue1[0].id).not.toBe(queue2[1].id);
        });

        it('should include timestamp and retry count', async () => {
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
            const before = Date.now();
            
            await offlineQueue.enqueue('/driver/location', 'POST', { lat: 25.276987, lng: 51.520008 });
            
            const calls = (mockStorage.set as jest.Mock).mock.calls;
            const queue = JSON.parse(calls[0][1]);
            const request = queue[0];
            
            expect(request.timestamp).toBeGreaterThanOrEqual(before);
            expect(request.timestamp).toBeLessThanOrEqual(Date.now());
            expect(request.retryCount).toBe(0);
        });
    });

    describe('processQueue - Success Cases', () => {
        it('should process all queued requests successfully', async () => {
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
            
            // Queue multiple requests while offline
            await offlineQueue.enqueue('/driver/location', 'POST', { lat: 25.276987, lng: 51.520008 });
            await offlineQueue.enqueue('/driver/location', 'POST', { lat: 25.276988, lng: 51.520009 });
            await offlineQueue.enqueue('/driver/location', 'POST', { lat: 25.276989, lng: 51.520010 });
            
            expect(offlineQueue.getQueueLength()).toBe(3);
            
            // Simulate coming online
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
            
            await offlineQueue.processQueue();
            
            expect(mockApi.request).toHaveBeenCalledTimes(3);
            expect(offlineQueue.getQueueLength()).toBe(0);
        });

        it('should handle media files by reading from disk', async () => {
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
            
            const photoPath = 'file:///path/to/photo.jpg';
            await offlineQueue.enqueue('/driver/assignments/123/proof', 'POST', { photoPath });
            
            (mockFileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
            (mockFileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('base64data');
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
            
            await offlineQueue.processQueue();
            
            expect(mockFileSystem.readAsStringAsync).toHaveBeenCalledWith(photoPath, {
                encoding: 'base64'
            });
            expect(mockApi.request).toHaveBeenCalledWith('/driver/assignments/123/proof', {
                method: 'POST',
                body: JSON.stringify({
                    photo_base64: 'base64data'
                })
            });
        });

        it('should skip media upload if file not found', async () => {
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
            
            await offlineQueue.enqueue('/driver/assignments/123/proof', 'POST', { photoPath: 'invalid.jpg' });
            
            (mockFileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
            
            await offlineQueue.processQueue();
            
            expect(offlineQueue.getQueueLength()).toBe(0);
            expect(mockApi.request).toHaveBeenCalled();
        });
    });

    describe('processQueue - Error Handling', () => {
        it('should retry failed requests with exponential backoff', async () => {
            jest.useFakeTimers();
            
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
            await offlineQueue.enqueue('/driver/location', 'POST', { lat: 25.276987, lng: 51.520008 });
            
            // First attempt fails
            (mockApi.request as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
            
            const processPromise = offlineQueue.processQueue();
            
            await Promise.resolve();
            await advanceTimers(2000);
            await processPromise;

            expect(mockApi.request).toHaveBeenCalledTimes(2);
        });

        it('should drop requests after 5 failed retries', async () => {
            jest.useFakeTimers();

            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
            await offlineQueue.enqueue('/driver/location', 'POST', { lat: 25.276987, lng: 51.520008 });
            
            // All 5 attempts fail
            (mockApi.request as jest.Mock).mockRejectedValue(new Error('Network error'));
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
            
            const processPromise = offlineQueue.processQueue();
            await Promise.resolve();
            await advanceTimers(30000);
            await processPromise;
            
            // Should have tried 5 times
            expect(mockApi.request).toHaveBeenCalledTimes(5);
            expect(offlineQueue.getQueueLength()).toBe(0);
        });

        it('should handle 429 rate limit by waiting 60 seconds', async () => {
            jest.useFakeTimers();
            
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
            await offlineQueue.enqueue('/driver/location', 'POST', { lat: 25.276987, lng: 51.520008 });
            
            (mockApi.request as jest.Mock).mockRejectedValueOnce(new Error('429 Too Many Requests'));
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
            
            const processPromise = offlineQueue.processQueue();
            
            await Promise.resolve();
            await advanceTimers(60000);
            await processPromise;

            expect(mockApi.request).toHaveBeenCalledTimes(2);
        });

        it('should drop client errors (4xx) immediately without retry', async () => {
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
            await offlineQueue.enqueue('/driver/assignments/123/status', 'POST', { status: 'invalid' });
            
            (mockApi.request as jest.Mock).mockRejectedValue(new Error('Cannot transition to invalid status'));
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
            
            await offlineQueue.processQueue();
            
            // Should only try once (client error = drop immediately)
            expect(mockApi.request).toHaveBeenCalledTimes(1);
            expect(offlineQueue.getQueueLength()).toBe(0);
        });

        it('should drop requests with "already" in error message', async () => {
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
            await offlineQueue.enqueue('/driver/assignments/123/status', 'POST', { status: 'picked_up' });
            
            (mockApi.request as jest.Mock).mockRejectedValue(new Error('Already picked up'));
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
            
            await offlineQueue.processQueue();
            
            expect(mockApi.request).toHaveBeenCalledTimes(1);
            expect(offlineQueue.getQueueLength()).toBe(0);
        });
    });

    describe('Stale Request Cleanup', () => {
        it('should drop requests older than 1 hour', async () => {
            const oldTimestamp = Date.now() - (61 * 60 * 1000); // 61 minutes ago
            
            const oldRequest = {
                id: 'old-request',
                endpoint: '/driver/location',
                method: 'POST',
                body: { lat: 25.276987, lng: 51.520008 },
                timestamp: oldTimestamp,
                retryCount: 0
            };
            
            (mockStorage.getString as jest.Mock).mockReturnValue(JSON.stringify([oldRequest]));
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
            
            await offlineQueue.processQueue();
            
            expect(mockApi.request).not.toHaveBeenCalled();
            expect(offlineQueue.getQueueLength()).toBe(0);
        });
    });

    describe('getPendingAssignmentIds', () => {
        it('should return assignment IDs with pending status updates', async () => {
            const requests = [
                {
                    id: '1',
                    endpoint: '/driver/assignments/abc-123/status',
                    method: 'POST',
                    body: { status: 'picked_up' },
                    timestamp: Date.now(),
                    retryCount: 0
                },
                {
                    id: '2',
                    endpoint: '/driver/assignments/xyz-789/status',
                    method: 'POST',
                    body: { status: 'delivered' },
                    timestamp: Date.now(),
                    retryCount: 0
                },
                {
                    id: '3',
                    endpoint: '/driver/location',
                    method: 'POST',
                    body: { lat: 25.276987, lng: 51.520008 },
                    timestamp: Date.now(),
                    retryCount: 0
                }
            ];
            
            (mockStorage.getString as jest.Mock).mockReturnValue(JSON.stringify(requests));
            
            const ids = offlineQueue.getPendingAssignmentIds();
            
            expect(ids).toHaveLength(2);
            expect(ids).toContain('abc-123');
            expect(ids).toContain('xyz-789');
        });

        it('should return empty array when no assignment updates pending', async () => {
            const requests = [
                {
                    id: '1',
                    endpoint: '/driver/location',
                    method: 'POST',
                    body: { lat: 25.276987, lng: 51.520008 },
                    timestamp: Date.now(),
                    retryCount: 0
                }
            ];
            
            (mockStorage.getString as jest.Mock).mockReturnValue(JSON.stringify(requests));
            
            const ids = offlineQueue.getPendingAssignmentIds();
            
            expect(ids).toHaveLength(0);
        });
    });

    describe('Persistence', () => {
        it('should load queue from storage on initialization', async () => {
            const savedQueue = [
                {
                    id: 'saved-1',
                    endpoint: '/driver/location',
                    method: 'POST',
                    body: { lat: 25.276987, lng: 51.520008 },
                    timestamp: Date.now(),
                    retryCount: 0
                }
            ];
            
            (mockStorage.getString as jest.Mock).mockReturnValue(JSON.stringify(savedQueue));
            
            // Access queue to trigger initialization
            offlineQueue.getQueueLength();
            
            expect(offlineQueue.getQueueLength()).toBe(1);
        });

        it('should handle corrupted storage gracefully', async () => {
            (mockStorage.getString as jest.Mock).mockReturnValue('invalid-json');
            
            // Should not throw, should initialize with empty queue
            expect(() => offlineQueue.getQueueLength()).not.toThrow();
            expect(offlineQueue.getQueueLength()).toBe(0);
        });

        it('should save queue after each operation', async () => {
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
            
            await offlineQueue.enqueue('/driver/location', 'POST', { lat: 25.276987, lng: 51.520008 });
            
            expect(mockStorage.set).toHaveBeenCalled();
        });
    });

    describe('Concurrency', () => {
        it('should not process queue if already processing', async () => {
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
            
            // Start processing
            const processPromise = offlineQueue.processQueue();
            
            // Try to process again immediately
            await offlineQueue.processQueue();
            
            // Should only have one processing cycle
            expect(mockApi.request).toHaveBeenCalledTimes(0);
            
            await processPromise;
        });

        it('should not process queue when offline', async () => {
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
            
            await offlineQueue.enqueue('/driver/location', 'POST', { lat: 25.276987, lng: 51.520008 });
            await offlineQueue.processQueue();
            
            expect(mockApi.request).not.toHaveBeenCalled();
        });
    });
});
