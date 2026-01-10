// QScrap Driver App - Storage Utility
// MMKV must be initialized lazily to avoid crash before native modules are ready

let _storage: any = null;

const getStorage = () => {
    if (!_storage) {
        try {
            const { MMKV } = require('react-native-mmkv');
            _storage = new MMKV({
                id: 'qscrap-driver-storage',
                encryptionKey: 'qscrap-encryption-key-secure'
            });
        } catch (e) {
            console.warn('[Storage] MMKV init failed, using fallback', e);
            // Fallback to in-memory storage if MMKV fails
            const memStore: Record<string, string> = {};
            _storage = {
                getString: (key: string) => memStore[key],
                set: (key: string, value: string) => { memStore[key] = value; },
                delete: (key: string) => { delete memStore[key]; },
            };
        }
    }
    return _storage;
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
