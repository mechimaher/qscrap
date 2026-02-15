// QScrap Driver App - Storage Utility
// MMKV must be initialized lazily to avoid crash before native modules are ready
// SECURITY: Encryption key is generated once and stored in platform keychain via SecureStore

import * as SecureStore from 'expo-secure-store';

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
        console.warn('[Storage] SecureStore key generation failed, MMKV will be unencrypted', e);
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
        console.warn('[Storage] MMKV init failed, using fallback', e);
        // Fallback to in-memory storage if MMKV fails
        const memStore: Record<string, string> = {};
        return {
            getString: (key: string) => memStore[key],
            set: (key: string, value: string) => { memStore[key] = value; },
            delete: (key: string) => { delete memStore[key]; },
        };
    }
};

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
            return null;
        });
    }

    // Synchronous fallback while async init is in-flight
    // This handles the brief window between first access and key resolution
    const memStore: Record<string, string> = {};
    const syncFallback = {
        getString: (key: string) => memStore[key],
        set: (key: string, value: string) => { memStore[key] = value; },
        delete: (key: string) => { delete memStore[key]; },
    };

    // Try sync MMKV init without encryption as immediate bridge
    try {
        const { MMKV } = require('react-native-mmkv');
        _storage = new MMKV({ id: MMKV_STORAGE_ID });
        // Replace with encrypted version once key is ready
        _keyPromise!.then(() => { /* _storage already updated by initStorage */ });
        return _storage;
    } catch {
        return syncFallback;
    }
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
