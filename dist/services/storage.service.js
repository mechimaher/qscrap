"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
class StorageService {
    uploadDir;
    baseUrl;
    constructor() {
        this.uploadDir = path_1.default.join(process.cwd(), 'uploads');
        // In production, this should be the full domain or CDN URL
        this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        // Ensure upload directory exists
        if (!fs_1.default.existsSync(this.uploadDir)) {
            fs_1.default.mkdirSync(this.uploadDir, { recursive: true });
        }
    }
    /**
     * Upload a base64 encoded image
     * @param base64String The base64 string (with or without data URI prefix)
     * @param folder Optional folder prefix (e.g., 'proofs', 'profiles')
     */
    async uploadBase64(base64String, folder = 'misc') {
        // Remove data URI prefix if present
        const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let buffer;
        let extension = 'jpg'; // Default
        if (matches && matches.length === 3) {
            const mimeType = matches[1];
            buffer = Buffer.from(matches[2], 'base64');
            // Simple extension mapping
            if (mimeType === 'image/png')
                extension = 'png';
            else if (mimeType === 'image/jpeg')
                extension = 'jpg';
            else if (mimeType === 'image/webp')
                extension = 'webp';
        }
        else {
            // Assume raw base64 string is jpeg if no prefix
            buffer = Buffer.from(base64String, 'base64');
        }
        const filename = `${(0, uuid_1.v4)()}.${extension}`;
        const key = path_1.default.join(folder, filename);
        const fullPath = path_1.default.join(this.uploadDir, key);
        // Ensure subfolder exists
        const subfolderPath = path_1.default.dirname(fullPath);
        if (!fs_1.default.existsSync(subfolderPath)) {
            fs_1.default.mkdirSync(subfolderPath, { recursive: true });
        }
        // Write file
        await fs_1.default.promises.writeFile(fullPath, buffer);
        // Return URL (relative for now, or absolute if BASE_URL is set)
        // Using relative path '/uploads/...' is safer for now if domain changes
        const url = `/uploads/${key}`;
        return { url, key };
    }
    /**
     * Delete a file (placeholder for now)
     */
    async deleteFile(key) {
        const fullPath = path_1.default.join(this.uploadDir, key);
        if (fs_1.default.existsSync(fullPath)) {
            await fs_1.default.promises.unlink(fullPath);
        }
    }
}
exports.storageService = new StorageService();
