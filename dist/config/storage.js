"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileStorage = exports.createFileStorage = exports.AzureBlobStorage = exports.S3FileStorage = exports.LocalFileStorage = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const writeFile = (0, util_1.promisify)(fs_1.default.writeFile);
const unlink = (0, util_1.promisify)(fs_1.default.unlink);
const readFile = (0, util_1.promisify)(fs_1.default.readFile);
/**
 * Local File Storage (Default)
 * Stores files on local disk in ./uploads
 */
class LocalFileStorage {
    uploadDir;
    baseUrl;
    constructor() {
        this.uploadDir = process.env.UPLOAD_DIR || path_1.default.join(process.cwd(), 'uploads');
        this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        // Ensure upload directory exists
        if (!fs_1.default.existsSync(this.uploadDir)) {
            fs_1.default.mkdirSync(this.uploadDir, { recursive: true });
        }
    }
    async upload(file, filename, folder) {
        const targetFolder = folder ? path_1.default.join(this.uploadDir, folder) : this.uploadDir;
        // Create subfolder if needed
        if (!fs_1.default.existsSync(targetFolder)) {
            fs_1.default.mkdirSync(targetFolder, { recursive: true });
        }
        const filePath = path_1.default.join(targetFolder, filename);
        await writeFile(filePath, file);
        return this.getUrl(filename, folder);
    }
    async delete(url) {
        // Extract filename from URL
        const filename = url.split('/').pop();
        if (!filename)
            return;
        const filePath = path_1.default.join(this.uploadDir, filename);
        if (fs_1.default.existsSync(filePath)) {
            await unlink(filePath);
        }
    }
    getUrl(filename, folder) {
        const urlPath = folder ? `${folder}/${filename}` : filename;
        return `${this.baseUrl}/uploads/${urlPath}`;
    }
}
exports.LocalFileStorage = LocalFileStorage;
/**
 * S3-Compatible Storage (AWS S3, MinIO, etc.)
 * Enabled when S3_BUCKET is configured
 */
class S3FileStorage {
    s3Client;
    bucket;
    region;
    baseUrl;
    constructor() {
        this.bucket = process.env.S3_BUCKET;
        this.region = process.env.S3_REGION || 'us-east-1';
        this.baseUrl = process.env.S3_BASE_URL ||
            `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
        // Lazy load AWS SDK to avoid dependency if not needed
        try {
            const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
            this.s3Client = new S3Client({
                region: this.region,
                credentials: {
                    accessKeyId: process.env.S3_ACCESS_KEY,
                    secretAccessKey: process.env.S3_SECRET_KEY
                }
            });
        }
        catch (err) {
            console.error('[Storage] AWS SDK not installed. Run: npm install @aws-sdk/client-s3');
            throw new Error('S3 storage requires @aws-sdk/client-s3 package');
        }
    }
    async upload(file, filename, folder) {
        const { PutObjectCommand } = require('@aws-sdk/client-s3');
        const key = folder ? `${folder}/${filename}` : filename;
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: file,
            ContentType: this.getContentType(filename),
            ACL: 'public-read' // Make files publicly accessible
        });
        await this.s3Client.send(command);
        return this.getUrl(filename, folder);
    }
    async delete(url) {
        const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
        // Extract key from URL
        const urlObj = new URL(url);
        const key = urlObj.pathname.substring(1); // Remove leading /
        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key
        });
        await this.s3Client.send(command);
    }
    getUrl(filename, folder) {
        const key = folder ? `${folder}/${filename}` : filename;
        return `${this.baseUrl}/${key}`;
    }
    getContentType(filename) {
        const ext = path_1.default.extname(filename).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.pdf': 'application/pdf',
            '.txt': 'text/plain'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
}
exports.S3FileStorage = S3FileStorage;
/**
 * Azure Blob Storage
 * Enabled when AZURE_STORAGE_ACCOUNT is configured
 */
class AzureBlobStorage {
    containerClient;
    baseUrl;
    constructor() {
        const accountName = process.env.AZURE_STORAGE_ACCOUNT;
        const containerName = process.env.AZURE_STORAGE_CONTAINER || 'qscrap-uploads';
        this.baseUrl = `https://${accountName}.blob.core.windows.net/${containerName}`;
        try {
            const { BlobServiceClient } = require('@azure/storage-blob');
            const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
            const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
            this.containerClient = blobServiceClient.getContainerClient(containerName);
            // Ensure container exists
            this.containerClient.createIfNotExists({ access: 'blob' });
        }
        catch (err) {
            console.error('[Storage] Azure SDK not installed. Run: npm install @azure/storage-blob');
            throw new Error('Azure storage requires @azure/storage-blob package');
        }
    }
    async upload(file, filename, folder) {
        const blobName = folder ? `${folder}/${filename}` : filename;
        const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(file, {
            blobHTTPHeaders: {
                blobContentType: this.getContentType(filename)
            }
        });
        return this.getUrl(filename, folder);
    }
    async delete(url) {
        const urlObj = new URL(url);
        const blobName = urlObj.pathname.split('/').slice(2).join('/'); // Remove /container/ from path
        const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.deleteIfExists();
    }
    getUrl(filename, folder) {
        const blobName = folder ? `${folder}/${filename}` : filename;
        return `${this.baseUrl}/${blobName}`;
    }
    getContentType(filename) {
        const ext = path_1.default.extname(filename).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.pdf': 'application/pdf',
            '.txt': 'text/plain'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
}
exports.AzureBlobStorage = AzureBlobStorage;
// ============================================
// FACTORY: Auto-select storage based on environment
// ============================================
const createFileStorage = () => {
    // Priority: S3 > Azure > Local
    if (process.env.S3_BUCKET) {
        console.log('✅ [Storage] Using S3-compatible storage');
        return new S3FileStorage();
    }
    if (process.env.AZURE_STORAGE_ACCOUNT) {
        console.log('✅ [Storage] Using Azure Blob storage');
        return new AzureBlobStorage();
    }
    console.log('✅ [Storage] Using local file storage');
    return new LocalFileStorage();
};
exports.createFileStorage = createFileStorage;
// Singleton instance
exports.fileStorage = (0, exports.createFileStorage)();
