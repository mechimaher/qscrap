/**
 * QScrap Driver App - Image Compression Utility
 * Compresses POD (Proof of Delivery) photos before upload
 * Reduces file size by 60-80% for faster uploads
 * 
 * INSTALLATION REQUIRED:
 * npx expo install expo-image-manipulator
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { log, error as logError } from '../utils/logger';

export interface CompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'jpeg' | 'png';
}

const DEFAULT_POD_OPTIONS: CompressionOptions = {
    maxWidth: 1920,
    quality: 0.7,
    format: 'jpeg',
};

/**
 * Compress a POD photo to reduce file size while maintaining quality
 * Includes automatic size validation and progressive compression
 * 
 * @param uri - Local image URI to compress
 * @param options - Compression options (optional)
 * @returns Compressed image URI with metadata
 * 
 * @example
 * const result = await compressPODPhoto(cameraUri);
 * if (result.success && result.sizeKB < 500) {
 *     formData.append('photo', { uri: result.uri });
 * }
 */
export const compressPODPhoto = async (
    uri: string,
    options: CompressionOptions = DEFAULT_POD_OPTIONS
): Promise<{ uri: string; sizeKB: number; success: boolean; error?: string }> => {
    try {
        const config = { ...DEFAULT_POD_OPTIONS, ...options };

        const actions: ImageManipulator.Action[] = [];

        // Add resize action if dimensions specified
        if (config.maxWidth || config.maxHeight) {
            actions.push({
                resize: {
                    width: config.maxWidth,
                    height: config.maxHeight,
                },
            });
        }

        // Compress the image
        const result = await ImageManipulator.manipulateAsync(
            uri,
            actions,
            {
                compress: config.quality ?? 0.7,
            }
        );

        // Validate size
        const sizeKB = await estimateFileSize(result.uri);
        
        log('[POD Compressor] First pass:', { sizeKB, width: result.width, height: result.height });
        
        // If still too large (>500KB), compress more aggressively
        if (sizeKB > 500) {
            log('[POD Compressor] File too large, compressing more...');
            const result2 = await ImageManipulator.manipulateAsync(
                result.uri,
                [{ resize: { width: 1280 } }],
                { compress: 0.5 }
            );
            
            const finalSizeKB = await estimateFileSize(result2.uri);
            log('[POD Compressor] Second pass:', { sizeKB: finalSizeKB });
            
            return {
                uri: result2.uri,
                sizeKB: finalSizeKB,
                success: true,
            };
        }

        log('[POD Compressor] Compressed:', {
            original: uri,
            compressed: result.uri,
            sizeKB,
        });

        return {
            uri: result.uri,
            sizeKB,
            success: true,
        };
    } catch (error) {
        logError('[POD Compressor] Error:', error);
        // Return original image if compression fails
        const originalSize = await estimateFileSize(uri);
        return {
            uri,
            sizeKB: originalSize,
            success: false,
            error: error instanceof Error ? error.message : 'Compression failed',
        };
    }
};

/**
 * Estimate file size from URI (for display purposes)
 * @param uri - Image URI
 * @returns Estimated file size in KB
 */
export const estimateFileSize = async (uri: string): Promise<number> => {
    try {
        if (uri.startsWith('file://')) {
            const info = await FileSystem.getInfoAsync(uri);
            return Math.round(((info as any).size ?? 0) / 1024);
        }
        // For non-file URIs, estimate based on typical compression ratios
        return 500; // Default estimate
    } catch {
        return 0;
    }
};

/**
 * Calculate compression savings
 * @param originalUri - Original image URI
 * @param compressedUri - Compressed image URI
 * @returns Object with original size, compressed size, and savings percentage
 */
export const calculateCompressionSavings = async (
    originalUri: string,
    compressedUri: string
): Promise<{
    originalSize: number;
    compressedSize: number;
    savingsPercent: number;
}> => {
    const originalSize = await estimateFileSize(originalUri);
    const compressedSize = await estimateFileSize(compressedUri);
    const savingsPercent = originalSize > 0
        ? Math.round(((originalSize - compressedSize) / originalSize) * 100)
        : 0;

    return {
        originalSize,
        compressedSize,
        savingsPercent,
    };
};
