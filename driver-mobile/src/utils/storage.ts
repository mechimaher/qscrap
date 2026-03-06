// QScrap Driver App - Storage Utility
// MMKV must be initialized lazily to avoid crash before native modules are ready
// SECURITY: Encryption key is generated once and stored in platform keychain via SecureStore

import * as SecureStore from 'expo-secure-store';
import { warn as logWarn } from './logger';

const ENCRYPTION_KEY_ALIAS = 'qscrap_driver_mmkv_key';
const MMKV_STORAGE_ID = 'qscrap-driver-storage';

let _storage: any = null;
let _keyPromise: Promise<string | null> | null = null;

/**
 * Retrieves or generates a random encryption key for MMKV.
 * The key is stored in the platform keychain (SecureStore), NOT in source code.
 */
const getOrCreateEncryptionKey = async (): Promise<string | null> => {
    try {
        // Check if key already exists in keychain
        const existing = await SecureStore.getItemAsync(ENCRYPTION_KEY_ALIAS);
        if (existing) return existing;

        // Generate a random 32-char hex key
        const array = new Uint8Array(16);
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        const newKey = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');

        // Persist in keychain
        await SecureStore.setItemAsync(ENCRYPTION_KEY_ALIAS, newKey);
        return newKey;
    } catch (e) {
        logWarn('[Storage] SecureStore key generation failed, MMKV will be unencrypted', e);
        return null;
    }
};

/**
 * Initialize MMKV with a keychain-protected encryption key.
 * Called once lazily on first storage access.
 */
const initStorage = async (): Promise<any> => {
    try {
        const encryptionKey = await getOrCreateEncryptionKey();
        const { MMKV } = require('react-native-mmkv');

        const options: any = { id: MMKV_STORAGE_ID };
        if (encryptionKey) {
            options.encryptionKey = encryptionKey;
        }

        return new MMKV(options);
    } catch (e) {
        logWarn('[Storage] MMKV init failed, using fallback', e);
        // Fallback to in-memory storage if MMKV fails
        const memStore: Record<string, string> = {};
        return {
            getString: (key: string) => memStore[key],
            set: (key: string, value: string) => { memStore[key] = value; },
            delete: (key: string) => { delete memStore[key]; },
        };
    }
};

const _pendingOperations: Array<(s: any) => void> = [];

/**
 * Get the storage instance. On first call, initializes asynchronously.
 * Subsequent calls return the cached instance synchronously.
 */
const getStorage = (): any => {
    if (_storage) return _storage;

    // Kick off async init if not started
    if (!_keyPromise) {
        _keyPromise = initStorage().then((s) => {
            _storage = s;
            // Execute any operations that were queued during initialization
            _pendingOperations.forEach(op => op(s));
            _pendingOperations.length = 0;
            return null;
        });
    }

    // Return a proxy that queues writes and safely ignores early reads
    return {
        getString: (key: string) => {
            if (_storage) return _storage.getString(key);
            logWarn(`[Storage] Read attempted for ${key} before secure MMKV init completed`);
            return undefined;
        },
        set: (key: string, value: string) => {
            if (_storage) {
                _storage.set(key, value);
            } else {
                _pendingOperations.push((s) => s.set(key, value));
            }
        },
        delete: (key: string) => {
            if (_storage) {
                _storage.delete(key);
            } else {
                _pendingOperations.push((s) => s.delete(key));
            }
        },
    };
};

export const storage = {
    getString: (key: string) => getStorage().getString(key),
    set: (key: string, value: string) => getStorage().set(key, value),
    delete: (key: string) => getStorage().delete(key),
};

export const mmkvStorage = {
    setItem: (name: string, value: string) => {
        storage.set(name, value);
    },
    getItem: (name: string) => {
        const value = storage.getString(name);
        return value ?? null;
    },
    removeItem: (name: string) => {
        storage.delete(name);
    },
};
