import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { promisify } from 'util';
import logger from '../utils/logger';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const nodeRequire = createRequire(__filename);

const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) {
        return err.message;
    }
    return 'Unknown error';
};

type S3CommandConstructor = new (input: Record<string, unknown>) => unknown;

interface S3ClientLike {
    send(command: unknown): Promise<unknown>;
}

interface S3ClientConstructor {
    new (options: {
        region: string;
        credentials: {
            accessKeyId: string;
            secretAccessKey: string;
        };
    }): S3ClientLike;
}

interface S3Module {
    S3Client: S3ClientConstructor;
    PutObjectCommand: S3CommandConstructor;
    DeleteObjectCommand: S3CommandConstructor;
}

interface AzureBlockBlobClientLike {
    uploadData(
        data: Buffer,
        options: { blobHTTPHeaders: { blobContentType: string } }
    ): Promise<unknown>;
    deleteIfExists(): Promise<unknown>;
}

interface AzureContainerClientLike {
    createIfNotExists(options: { access: 'blob' }): Promise<unknown>;
    getBlockBlobClient(blobName: string): AzureBlockBlobClientLike;
}

interface AzureBlobServiceClientLike {
    getContainerClient(containerName: string): AzureContainerClientLike;
}

interface AzureBlobServiceClientNamespace {
    fromConnectionString(connectionString: string): AzureBlobServiceClientLike;
}

interface AzureStorageBlobModule {
    BlobServiceClient: AzureBlobServiceClientNamespace;
}

// ============================================
// FILE STORAGE ABSTRACTION (Phase 2)
// ============================================

export interface IFileStorage {
    upload(file: Buffer, filename: string, folder?: string): Promise<string>;
    delete(url: string): Promise<void>;
    getUrl(filename: string, folder?: string): string;
}

/**
 * Local File Storage (Default)
 * Stores files on local disk in ./uploads
 */
export class LocalFileStorage implements IFileStorage {
    private uploadDir: string;
    private baseUrl: string;

    constructor() {
        this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
        this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';

        // Ensure upload directory exists
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    async upload(file: Buffer, filename: string, folder?: string): Promise<string> {
        const targetFolder = folder ? path.join(this.uploadDir, folder) : this.uploadDir;

        // Create subfolder if needed
        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }

        const filePath = path.join(targetFolder, filename);
        await writeFile(filePath, file);

        return this.getUrl(filename, folder);
    }

    async delete(url: string): Promise<void> {
        // Extract filename from URL
        const filename = url.split('/').pop();
        if (!filename) {return;}

        const filePath = path.join(this.uploadDir, filename);
        if (fs.existsSync(filePath)) {
            await unlink(filePath);
        }
    }

    getUrl(filename: string, folder?: string): string {
        const urlPath = folder ? `${folder}/${filename}` : filename;
        return `${this.baseUrl}/uploads/${urlPath}`;
    }
}

/**
 * S3-Compatible Storage (AWS S3, MinIO, etc.)
 * Enabled when S3_BUCKET is configured
 */
export class S3FileStorage implements IFileStorage {
    private s3Client!: S3ClientLike;
    private putObjectCommand!: S3CommandConstructor;
    private deleteObjectCommand!: S3CommandConstructor;
    private bucket: string;
    private region: string;
    private baseUrl: string;

    constructor() {
        this.bucket = process.env.S3_BUCKET!;
        this.region = process.env.S3_REGION || 'us-east-1';
        this.baseUrl = process.env.S3_BASE_URL ||
            `https://${this.bucket}.s3.${this.region}.amazonaws.com`;

        // Load AWS SDK only when S3 storage is selected.
        try {
            const s3Module = nodeRequire('@aws-sdk/client-s3') as unknown as S3Module;
            const { S3Client, PutObjectCommand, DeleteObjectCommand } = s3Module;
            this.s3Client = new S3Client({
                region: this.region,
                credentials: {
                    accessKeyId: process.env.S3_ACCESS_KEY!,
                    secretAccessKey: process.env.S3_SECRET_KEY!
                }
            });
            this.putObjectCommand = PutObjectCommand;
            this.deleteObjectCommand = DeleteObjectCommand;
        } catch (err) {
            logger.error('AWS SDK not installed. Run: npm install @aws-sdk/client-s3', {
                error: getErrorMessage(err)
            });
            throw new Error('S3 storage requires @aws-sdk/client-s3 package');
        }
    }

    async upload(file: Buffer, filename: string, folder?: string): Promise<string> {
        const key = folder ? `${folder}/${filename}` : filename;

        const command = new this.putObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: file,
            ContentType: this.getContentType(filename),
            ACL: 'public-read' // Make files publicly accessible
        });

        await this.s3Client.send(command);
        return this.getUrl(filename, folder);
    }

    async delete(url: string): Promise<void> {
        // Extract key from URL
        const urlObj = new URL(url);
        const key = urlObj.pathname.substring(1); // Remove leading /

        const command = new this.deleteObjectCommand({
            Bucket: this.bucket,
            Key: key
        });

        await this.s3Client.send(command);
    }

    getUrl(filename: string, folder?: string): string {
        const key = folder ? `${folder}/${filename}` : filename;
        return `${this.baseUrl}/${key}`;
    }

    private getContentType(filename: string): string {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes: Record<string, string> = {
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

/**
 * Azure Blob Storage
 * Enabled when AZURE_STORAGE_ACCOUNT is configured
 */
export class AzureBlobStorage implements IFileStorage {
    private containerClient!: AzureContainerClientLike;
    private baseUrl: string;

    constructor() {
        const accountName = process.env.AZURE_STORAGE_ACCOUNT!;
        const containerName = process.env.AZURE_STORAGE_CONTAINER || 'qscrap-uploads';
        this.baseUrl = `https://${accountName}.blob.core.windows.net/${containerName}`;

        try {
            const azureModule = nodeRequire('@azure/storage-blob') as unknown as AzureStorageBlobModule;
            const { BlobServiceClient } = azureModule;
            const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
            const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
            this.containerClient = blobServiceClient.getContainerClient(containerName);

            // Ensure container exists
            void this.containerClient.createIfNotExists({ access: 'blob' });
        } catch (err) {
            logger.error('Azure SDK not installed. Run: npm install @azure/storage-blob', {
                error: getErrorMessage(err)
            });
            throw new Error('Azure storage requires @azure/storage-blob package');
        }
    }

    async upload(file: Buffer, filename: string, folder?: string): Promise<string> {
        const blobName = folder ? `${folder}/${filename}` : filename;
        const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

        await blockBlobClient.uploadData(file, {
            blobHTTPHeaders: {
                blobContentType: this.getContentType(filename)
            }
        });

        return this.getUrl(filename, folder);
    }

    async delete(url: string): Promise<void> {
        const urlObj = new URL(url);
        const blobName = urlObj.pathname.split('/').slice(2).join('/'); // Remove /container/ from path

        const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.deleteIfExists();
    }

    getUrl(filename: string, folder?: string): string {
        const blobName = folder ? `${folder}/${filename}` : filename;
        return `${this.baseUrl}/${blobName}`;
    }

    private getContentType(filename: string): string {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes: Record<string, string> = {
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

// ============================================
// FACTORY: Auto-select storage based on environment
// ============================================

export const createFileStorage = (): IFileStorage => {
    // Priority: S3 > Azure > Local
    if (process.env.S3_BUCKET) {
        logger.startup('Using S3-compatible storage');
        return new S3FileStorage();
    }

    if (process.env.AZURE_STORAGE_ACCOUNT) {
        logger.startup('Using Azure Blob storage');
        return new AzureBlobStorage();
    }

    logger.startup('Using local file storage');
    return new LocalFileStorage();
};

// Singleton instance
export const fileStorage = createFileStorage();
