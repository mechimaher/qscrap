/**
 * QScrap Driver App - Utilities Unit Tests
 * Tests for src/utils/
 */

import { compressPODPhoto, estimateFileSize, calculateCompressionSavings } from '../utils/imageCompressor';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

// Mock expo modules
jest.mock('expo-image-manipulator');
jest.mock('expo-file-system');

describe('Image Compressor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('compressPODPhoto', () => {
        it('should compress image with default options', async () => {
            (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
                uri: 'compressed-uri',
                width: 1920,
                height: 1080,
            });

            const result = await compressPODPhoto('original-uri');

            expect(result).toBe('compressed-uri');
            expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
                'original-uri',
                expect.arrayContaining([
                    expect.objectContaining({
                        resize: expect.objectContaining({
                            width: 1920,
                        }),
                    }),
                ]),
                expect.objectContaining({
                    compress: 0.7,
                })
            );
        });

        it('should compress with custom options', async () => {
            (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
                uri: 'custom-compressed-uri',
                width: 1600,
                height: 900,
            });

            const result = await compressPODPhoto('original-uri', {
                maxWidth: 1600,
                quality: 0.8,
                format: 'jpeg',
            });

            expect(result).toBe('custom-compressed-uri');
            expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
                'original-uri',
                expect.any(Array),
                expect.objectContaining({
                    compress: 0.8,
                })
            );
        });

        it('should return original URI on compression failure', async () => {
            (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValue(
                new Error('Compression failed')
            );

            const result = await compressPODPhoto('original-uri');

            expect(result).toBe('original-uri');
        });

        it('should handle PNG format', async () => {
            (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
                uri: 'png-compressed-uri',
                width: 1920,
                height: 1080,
            });

            await compressPODPhoto('original-uri', { format: 'png' });

            expect(ImageManipulator.manipulateAsync).toHaveBeenCalled();
        });
    });

    describe('estimateFileSize', () => {
        it('should estimate file size for file:// URI', async () => {
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
                size: 102400, // 100 KB
                exists: true,
            });

            const result = await estimateFileSize('file:///path/to/image.jpg');

            expect(result).toBe(100);
            expect(FileSystem.getInfoAsync).toHaveBeenCalledWith('file:///path/to/image.jpg');
        });

        it('should return default estimate for non-file URI', async () => {
            const result = await estimateFileSize('https://example.com/image.jpg');

            expect(result).toBe(500);
        });

        it('should return 0 on error', async () => {
            (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(
                new Error('File not found')
            );

            const result = await estimateFileSize('file:///invalid/path.jpg');

            expect(result).toBe(0);
        });
    });

    describe('calculateCompressionSavings', () => {
        it('should calculate savings percentage', async () => {
            (FileSystem.getInfoAsync as jest.Mock)
                .mockResolvedValueOnce({ size: 102400 }) // Original: 100 KB
                .mockResolvedValueOnce({ size: 30720 }); // Compressed: 30 KB

            const result = await calculateCompressionSavings('original', 'compressed');

            expect(result.originalSize).toBe(100);
            expect(result.compressedSize).toBe(30);
            expect(result.savingsPercent).toBe(70);
        });

        it('should handle zero original size', async () => {
            (FileSystem.getInfoAsync as jest.Mock)
                .mockResolvedValueOnce({ size: 0 })
                .mockResolvedValueOnce({ size: 30720 });

            const result = await calculateCompressionSavings('original', 'compressed');

            expect(result.savingsPercent).toBe(0);
        });
    });
});

/**
 * Tests for syncHelper utilities
 */
import { executeWithOfflineFallback } from '../utils/syncHelper';
import { offlineQueue } from '../services/OfflineQueue';

jest.mock('../services/OfflineQueue');

describe('SyncHelper', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('executeWithOfflineFallback', () => {
        it('should execute online action when successful', async () => {
            const mockOnlineAction = jest.fn().mockResolvedValue({ success: true });
            const offlineAction = {
                endpoint: '/test',
                method: 'POST',
                body: { data: 'test' },
            };

            const result = await executeWithOfflineFallback(mockOnlineAction, offlineAction);

            expect(mockOnlineAction).toHaveBeenCalled();
            expect(result).toEqual({ success: true });
        });

        it('should queue offline action when online fails', async () => {
            const mockOnlineAction = jest.fn().mockRejectedValue(new Error('Network error'));
            const offlineAction = {
                endpoint: '/test',
                method: 'POST',
                body: { data: 'test' },
            };

            await executeWithOfflineFallback(mockOnlineAction, offlineAction);

            expect(mockOnlineAction).toHaveBeenCalled();
            expect(offlineQueue.enqueue).toHaveBeenCalledWith(
                '/test',
                'POST',
                { data: 'test' }
            );
        });

        it('should show success message when provided', async () => {
            const mockOnlineAction = jest.fn().mockResolvedValue({ success: true });
            const offlineAction = {
                endpoint: '/test',
                method: 'POST',
                body: {},
            };
            const options = { successMessage: 'Success!' };

            await executeWithOfflineFallback(mockOnlineAction, offlineAction, options);

            expect(mockOnlineAction).toHaveBeenCalled();
        });
    });
});

/**
 * Tests for logger utilities
 */
import { log, warn, error as logError } from '../utils/logger';

describe('Logger', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should log messages', () => {
        log('Test message');
        expect(console.log).toHaveBeenCalledWith('Test message');
    });

    it('should log multiple arguments', () => {
        log('Message', 'arg1', 'arg2');
        expect(console.log).toHaveBeenCalledWith('Message', 'arg1', 'arg2');
    });

    it('should log warnings', () => {
        warn('Warning message');
        expect(console.warn).toHaveBeenCalledWith('Warning message');
    });

    it('should log errors', () => {
        logError('Error message');
        expect(console.error).toHaveBeenCalledWith('Error message');
    });

    it('should log error objects', () => {
        const error = new Error('Test error');
        logError('Error occurred', error);
        expect(console.error).toHaveBeenCalledWith('Error occurred', error);
    });
});
