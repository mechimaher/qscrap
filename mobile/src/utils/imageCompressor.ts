/**
 * QScrap Image Compression Utility
 * Compresses images before upload to reduce file size and improve upload speed
 * Uses expo-image-manipulator for efficient compression
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { log, error as logError } from '../utils/logger';
import * as FileSystem from 'expo-file-system';

export interface CompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'jpeg' | 'png';
}

const DEFAULT_OPTIONS: CompressionOptions = {
    maxWidth: 1920,
    quality: 0.7,
    format: 'jpeg',
};

/**
 * Compress an image to reduce file size while maintaining quality
 * @param uri - Local image URI to compress
 * @param options - Compression options (optional)
 * @returns Compressed image URI
 * 
 * @example
 * const compressed = await compressImage('file://...');
 * formData.append('image', { uri: compressed });
 */
export const compressImage = async (
    uri: string,
    options: CompressionOptions = {}
): Promise<string> => {
    try {
        const config = { ...DEFAULT_OPTIONS, ...options };

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

        // Add compression action - NOTE: compress action may not be supported in all versions
        // Using resize with quality parameter instead
        const result = await ImageManipulator.manipulateAsync(
            uri,
            actions,
            {
                compress: config.quality ?? 0.7,
            }
        );

        log('[ImageCompressor] Compressed:', {
            original: uri,
            compressed: result.uri,
            width: result.width,
            height: result.height,
        });

        return result.uri;
    } catch (error) {
        logError('[ImageCompressor] Error:', error);
        // Return original image if compression fails
        return uri;
    }
};

/**
 * Compress multiple images in parallel
 * @param uris - Array of image URIs to compress
 * @param options - Compression options
 * @returns Array of compressed image URIs
 */
export const compressImages = async (
    uris: string[],
    options: CompressionOptions = {}
): Promise<string[]> => {
    try {
        return await Promise.all(
            uris.map(uri => compressImage(uri, options))
        );
    } catch (error) {
        logError('[ImageCompressor] Batch compression error:', error);
        return uris; // Return originals on error
    }
};

/**
 * Estimate file size from URI (for display purposes)
 * Note: This is approximate and works best with local file URIs
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
