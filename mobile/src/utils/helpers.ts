/**
 * Helper Utilities for QScrap Mobile App
 * General-purpose utility functions.
 */

import { Dimensions, Platform, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Platform checks
 */
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isWeb = Platform.OS === 'web';

/**
 * Screen dimensions
 */
export const screenWidth = SCREEN_WIDTH;
export const screenHeight = SCREEN_HEIGHT;

/**
 * Responsive sizing based on screen width
 * Base design: 375px (iPhone X)
 */
export const wp = (percentage: number): number => {
    return (SCREEN_WIDTH * percentage) / 100;
};

export const hp = (percentage: number): number => {
    return (SCREEN_HEIGHT * percentage) / 100;
};

/**
 * Normalize size based on screen density
 */
export const normalize = (size: number): number => {
    const scale = SCREEN_WIDTH / 375;
    const newSize = size * scale;

    if (isIOS) {
        return Math.round(PixelRatio.roundToNearestPixel(newSize));
    }
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2;
};

/**
 * Generate a unique ID
 */
export const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Deep clone an object
 */
export const deepClone = <T>(obj: T): T => {
    return JSON.parse(JSON.stringify(obj));
};

/**
 * Check if an object is empty
 */
export const isEmpty = (obj: any): boolean => {
    if (obj === null || obj === undefined) return true;
    if (typeof obj === 'string') return obj.trim() === '';
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
};

/**
 * Delay execution
 */
export const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry a function with exponential backoff
 */
export const retry = async <T>(
    fn: () => Promise<T>,
    options: {
        retries?: number;
        delay?: number;
        backoff?: number;
        onRetry?: (error: any, attempt: number) => void;
    } = {}
): Promise<T> => {
    const { retries = 3, delay: initialDelay = 1000, backoff = 2, onRetry } = options;

    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt < retries) {
                onRetry?.(error, attempt + 1);
                const waitTime = initialDelay * Math.pow(backoff, attempt);
                await delay(waitTime);
            }
        }
    }

    throw lastError;
};

/**
 * Debounce a function
 */
export const debounce = <T extends (...args: any[]) => any>(
    fn: T,
    wait: number
): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    };
};

/**
 * Throttle a function
 */
export const throttle = <T extends (...args: any[]) => any>(
    fn: T,
    limit: number
): ((...args: Parameters<T>) => void) => {
    let lastCall = 0;

    return (...args: Parameters<T>) => {
        const now = Date.now();
        if (now - lastCall >= limit) {
            lastCall = now;
            fn(...args);
        }
    };
};

/**
 * Group array items by key
 */
export const groupBy = <T>(array: T[], key: keyof T): Record<string, T[]> => {
    return array.reduce((result, item) => {
        const groupKey = String(item[key]);
        if (!result[groupKey]) {
            result[groupKey] = [];
        }
        result[groupKey].push(item);
        return result;
    }, {} as Record<string, T[]>);
};

/**
 * Sort array by key
 */
export const sortBy = <T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] => {
    return [...array].sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];

        if (aVal < bVal) return order === 'asc' ? -1 : 1;
        if (aVal > bVal) return order === 'asc' ? 1 : -1;
        return 0;
    });
};

/**
 * Remove duplicates from array
 */
export const unique = <T>(array: T[], key?: keyof T): T[] => {
    if (key) {
        const seen = new Set();
        return array.filter(item => {
            const val = item[key];
            if (seen.has(val)) return false;
            seen.add(val);
            return true;
        });
    }
    return [...new Set(array)];
};

/**
 * Create a range of numbers
 */
export const range = (start: number, end: number, step: number = 1): number[] => {
    const result: number[] = [];
    for (let i = start; i <= end; i += step) {
        result.push(i);
    }
    return result;
};

/**
 * Clamp a number between min and max
 */
export const clamp = (num: number, min: number, max: number): number => {
    return Math.min(Math.max(num, min), max);
};

/**
 * Get initials from a name
 */
export const getInitials = (name: string, maxChars: number = 2): string => {
    if (!name) return '';

    const parts = name.trim().split(/\s+/);
    const initials = parts
        .map(part => part.charAt(0).toUpperCase())
        .join('');

    return initials.slice(0, maxChars);
};

/**
 * Generate a random color from a string (for avatars)
 */
export const stringToColor = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const colors = [
        '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
        '#f59e0b', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4',
        '#3b82f6', '#6366f1',
    ];

    return colors[Math.abs(hash) % colors.length];
};

/**
 * Check if running in development mode
 */
export const isDev = __DEV__;

/**
 * Log only in development
 */
export const devLog = (...args: any[]): void => {
    if (__DEV__) {
        console.log('[DEV]', ...args);
    }
};

/**
 * Measure execution time
 */
export const measureTime = async <T>(
    label: string,
    fn: () => Promise<T>
): Promise<T> => {
    const start = Date.now();
    try {
        const result = await fn();
        const duration = Date.now() - start;
        devLog(`${label}: ${duration}ms`);
        return result;
    } catch (error) {
        const duration = Date.now() - start;
        devLog(`${label} (failed): ${duration}ms`);
        throw error;
    }
};
