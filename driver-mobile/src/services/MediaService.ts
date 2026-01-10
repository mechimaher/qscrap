import * as FileSystem from 'expo-file-system';

export const MediaService = {
    async saveToPermanent(uri: string): Promise<string> {
        try {
            const filename = uri.split('/').pop() || `photo_${Date.now()}.jpg`;
            const dest = `${FileSystem.documentDirectory}photos/${filename}`;

            // Ensure directory exists
            await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}photos/`, { intermediates: true });

            // Copy file
            await FileSystem.copyAsync({
                from: uri,
                to: dest
            });

            return dest;
        } catch (error) {
            console.error('[MediaService] Failed to save photo:', error);
            throw error;
        }
    },

    async clearPhotos() {
        try {
            await FileSystem.deleteAsync(`${FileSystem.documentDirectory}photos/`, { idempotent: true });
        } catch (error) {
            console.error('[MediaService] Failed to clear photos:', error);
        }
    }
};
