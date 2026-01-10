import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({
    id: 'qscrap-driver-storage',
    encryptionKey: 'qscrap-encryption-key-secure' // In prod this should be from env/keychain
});

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
