import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface UploadResult {
    url: string;
    key: string;
}

class StorageService {
    private uploadDir: string;
    private baseUrl: string;

    constructor() {
        this.uploadDir = path.join(process.cwd(), 'uploads');
        // In production, this should be the full domain or CDN URL
        this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';

        // Ensure upload directory exists
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    /**
     * Upload a base64 encoded image
     * @param base64String The base64 string (with or without data URI prefix)
     * @param folder Optional folder prefix (e.g., 'proofs', 'profiles')
     */
    async uploadBase64(base64String: string, folder: string = 'misc'): Promise<UploadResult> {
        // Remove data URI prefix if present
        const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let buffer: Buffer;
        let extension = 'jpg'; // Default

        if (matches && matches.length === 3) {
            const mimeType = matches[1];
            buffer = Buffer.from(matches[2], 'base64');

            // Simple extension mapping
            if (mimeType === 'image/png') extension = 'png';
            else if (mimeType === 'image/jpeg') extension = 'jpg';
            else if (mimeType === 'image/webp') extension = 'webp';
        } else {
            // Assume raw base64 string is jpeg if no prefix
            buffer = Buffer.from(base64String, 'base64');
        }

        const filename = `${uuidv4()}.${extension}`;
        const key = path.join(folder, filename);
        const fullPath = path.join(this.uploadDir, key);

        // Ensure subfolder exists
        const subfolderPath = path.dirname(fullPath);
        if (!fs.existsSync(subfolderPath)) {
            fs.mkdirSync(subfolderPath, { recursive: true });
        }

        // Write file
        await fs.promises.writeFile(fullPath, buffer);

        // Return URL (relative for now, or absolute if BASE_URL is set)
        // Using relative path '/uploads/...' is safer for now if domain changes
        const url = `/uploads/${key}`;

        return { url, key };
    }

    /**
     * Delete a file (placeholder for now)
     */
    async deleteFile(key: string): Promise<void> {
        const fullPath = path.join(this.uploadDir, key);
        if (fs.existsSync(fullPath)) {
            await fs.promises.unlink(fullPath);
        }
    }
}

export const storageService = new StorageService();
