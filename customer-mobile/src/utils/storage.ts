import { log, warn, error as logError } from './logger';
/**
 * Secure Storage Utilities for QScrap Mobile App
 * Wrapper around AsyncStorage with TypeScript support and error handling.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys enum for type safety
export enum StorageKey {
    TOKEN = 'token',
    USER = 'user',
    THEME = 'theme',
    LANGUAGE = 'language',
    ONBOARDING_COMPLETE = 'onboarding_complete',
    NOTIFICATIONS_ENABLED = 'notifications_enabled',
    BIOMETRICS_ENABLED = 'biometrics_enabled',
    PUSH_TOKEN = 'push_token',
    SAVED_ADDRESSES = 'saved_addresses',
    RECENT_SEARCHES = 'recent_searches',
    DRAFT_REQUEST = 'draft_request',
    APP_VERSION = 'app_version',
    LAST_SYNC = 'last_sync',
    SWIPE_HINT_SHOWN = 'swipe_hint_shown',
}

/**
 * Set a value in storage
 */
export const setItem = async <T>(key: StorageKey | string, value: T): Promise<boolean> => {
    try {
        const jsonValue = JSON.stringify(value);
        await AsyncStorage.setItem(key, jsonValue);
        return true;
    } catch (error) {
        logError(`Storage setItem error for key "${key}":`, error);
        return false;
    }
};

/**
 * Get a value from storage
 */
export const getItem = async <T>(key: StorageKey | string, defaultValue?: T): Promise<T | null> => {
    try {
        const jsonValue = await AsyncStorage.getItem(key);
        if (jsonValue === null) {
            return defaultValue ?? null;
        }
        return JSON.parse(jsonValue) as T;
    } catch (error) {
        logError(`Storage getItem error for key "${key}":`, error);
        return defaultValue ?? null;
    }
};

/**
 * Remove a value from storage
 */
export const removeItem = async (key: StorageKey | string): Promise<boolean> => {
    try {
        await AsyncStorage.removeItem(key);
        return true;
    } catch (error) {
        logError(`Storage removeItem error for key "${key}":`, error);
        return false;
    }
};

/**
 * Remove multiple values from storage
 */
export const removeItems = async (keys: (StorageKey | string)[]): Promise<boolean> => {
    try {
        await AsyncStorage.multiRemove(keys);
        return true;
    } catch (error) {
        logError('Storage removeItems error:', error);
        return false;
    }
};

/**
 * Get multiple values from storage
 */
export const getItems = async <T extends Record<string, any>>(
    keys: (StorageKey | string)[]
): Promise<Partial<T>> => {
    try {
        const pairs = await AsyncStorage.multiGet(keys);
        const result: Partial<T> = {};

        for (const [key, value] of pairs) {
            if (value !== null) {
                try {
                    (result as any)[key] = JSON.parse(value);
                } catch {
                    (result as any)[key] = value;
                }
            }
        }

        return result;
    } catch (error) {
        logError('Storage getItems error:', error);
        return {};
    }
};

/**
 * Set multiple values in storage
 */
export const setItems = async (items: Record<string, any>): Promise<boolean> => {
    try {
        const pairs: [string, string][] = Object.entries(items).map(([key, value]) => [
            key,
            JSON.stringify(value),
        ]);
        await AsyncStorage.multiSet(pairs);
        return true;
    } catch (error) {
        logError('Storage setItems error:', error);
        return false;
    }
};

/**
 * Get all storage keys
 */
export const getAllKeys = async (): Promise<string[]> => {
    try {
        const keys = await AsyncStorage.getAllKeys();
        return keys as string[];
    } catch (error) {
        logError('Storage getAllKeys error:', error);
        return [];
    }
};

/**
 * Clear all storage (use with caution!)
 */
export const clearAll = async (): Promise<boolean> => {
    try {
        await AsyncStorage.clear();
        return true;
    } catch (error) {
        logError('Storage clearAll error:', error);
        return false;
    }
};

/**
 * Check if a key exists in storage
 */
export const hasItem = async (key: StorageKey | string): Promise<boolean> => {
    try {
        const value = await AsyncStorage.getItem(key);
        return value !== null;
    } catch (error) {
        logError(`Storage hasItem error for key "${key}":`, error);
        return false;
    }
};

// ============== Specific Storage Helpers ==============

/**
 * Save draft request (auto-save functionality)
 */
export const saveDraftRequest = async (draft: any): Promise<boolean> => {
    return setItem(StorageKey.DRAFT_REQUEST, {
        ...draft,
        savedAt: new Date().toISOString(),
    });
};

/**
 * Get and clear draft request
 */
export const getDraftRequest = async (): Promise<any | null> => {
    const draft = await getItem(StorageKey.DRAFT_REQUEST);
    if (draft) {
        // Check if draft is less than 24 hours old
        const savedAt = new Date((draft as any).savedAt);
        const now = new Date();
        const hoursDiff = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60);

        if (hoursDiff > 24) {
            await removeItem(StorageKey.DRAFT_REQUEST);
            return null;
        }
    }
    return draft;
};

/**
 * Clear draft request
 */
export const clearDraftRequest = async (): Promise<boolean> => {
    return removeItem(StorageKey.DRAFT_REQUEST);
};

/**
 * Add to recent searches (keeps last 10)
 */
export const addRecentSearch = async (search: string): Promise<boolean> => {
    const searches = (await getItem<string[]>(StorageKey.RECENT_SEARCHES)) || [];

    // Remove if already exists
    const filtered = searches.filter(s => s !== search);

    // Add to front
    filtered.unshift(search);

    // Keep only last 10
    const updated = filtered.slice(0, 10);

    return setItem(StorageKey.RECENT_SEARCHES, updated);
};

/**
 * Get recent searches
 */
export const getRecentSearches = async (): Promise<string[]> => {
    return (await getItem<string[]>(StorageKey.RECENT_SEARCHES)) || [];
};

/**
 * Clear recent searches
 */
export const clearRecentSearches = async (): Promise<boolean> => {
    return removeItem(StorageKey.RECENT_SEARCHES);
};

// ============== Clear Auth Data ==============

/**
 * Clear all auth-related data (for logout)
 */
export const clearAuthData = async (): Promise<boolean> => {
    return removeItems([
        StorageKey.TOKEN,
        StorageKey.USER,
        StorageKey.PUSH_TOKEN,
    ]);
};
