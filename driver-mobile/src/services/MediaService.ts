import * as FileSystem from 'expo-file-system';

export const MediaService = {
    async saveToPermanent(uri: string): Promise<string> {
        try {
            const filename = uri.split('/').pop() || `photo_${Date.now()}.jpg`;
            const docDir = (FileSystem as any).documentDirectory || ''; // Fallback for older API or check current
            const dest = `${docDir}photos/${filename}`;

            // Ensure directory exists
            await FileSystem.makeDirectoryAsync(`${docDir}photos/`, { intermediates: true });

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
            await FileSystem.deleteAsync(`${(FileSystem as any).documentDirectory}photos/`, { idempotent: true });
        } catch (error) {
            console.error('[MediaService] Failed to clear photos:', error);
        }
    }
};
