import multer from 'multer';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// 1. Use MemoryStorage to keep file in RAM for processing
const storage = multer.memoryStorage();

// 2. Configure Multer
export const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Allow 10MB upload (we will compress it down to KB)
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// 3. Image Optimization Middleware
// This runs AFTER upload.single() / upload.array() and compresses the image
export const optimizeImage = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {return next();}

    try {
        const uniqueSuffix = `${Date.now()  }-${  Math.round(Math.random() * 1E9)}`;
        const filename = `${uniqueSuffix  }.webp`; // Force WebP extension
        const filepath = path.join(uploadDir, filename);

        // Process with sharp
        await sharp(req.file.buffer)
            .resize({
                width: 1200,
                withoutEnlargement: true, // Don't scale up small images
                fit: 'inside'
            })
            .toFormat('webp', { quality: 80 }) // 80% quality is visually lossless but much smaller
            .toFile(filepath);

        // Update req.file details so controllers think it was a normal disk upload
        // @ts-ignore
        req.file.filename = filename;
        // @ts-ignore
        req.file.path = filepath;
        // @ts-ignore
        req.file.destination = uploadDir;

        // Clear buffer to free memory
        // @ts-ignore
        delete req.file.buffer;

        next();
    } catch (error: any) {
        logger.error('Image optimization failed', { error: error.message });
        next(new Error('Image processing failed'));
    }
};

// 4. Multiple Image Optimization (for arrays OR fields object)
export const optimizeFiles = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.files) {return next();}

    // Handle both upload.array() (returns File[]) and upload.fields() (returns { fieldName: File[] })
    let allFiles: Express.Multer.File[] = [];

    if (Array.isArray(req.files)) {
        // upload.array() format
        allFiles = req.files as Express.Multer.File[];
    } else {
        // upload.fields() format - collect all files from all fields
        const fieldsObj = req.files as { [fieldname: string]: Express.Multer.File[] };
        for (const fieldName of Object.keys(fieldsObj)) {
            allFiles.push(...(fieldsObj[fieldName] || []));
        }
    }

    if (allFiles.length === 0) {return next();}

    try {
        const promises = allFiles.map(async (file) => {
            const uniqueSuffix = `${Date.now()  }-${  Math.round(Math.random() * 1E9)}`;
            const filename = `${uniqueSuffix  }.webp`;
            const filepath = path.join(uploadDir, filename);

            await sharp(file.buffer)
                .resize({
                    width: 1200,
                    withoutEnlargement: true,
                    fit: 'inside'
                })
                .toFormat('webp', { quality: 80 })
                .toFile(filepath);

            // Update file object
            file.filename = filename;
            file.path = filepath;
            file.destination = uploadDir;
            // @ts-ignore
            delete file.buffer;

            return file;
        });

        await Promise.all(promises);
        next();
    } catch (error: any) {
        logger.error('Batch image optimization failed', { error: error.message });
        next(new Error('Image processing failed'));
    }
};

// 5. Save Temp File (for OCR where we need high res)
export const saveTempFile = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {return next();}

    try {
        const uniqueSuffix = `${Date.now()  }-${  Math.round(Math.random() * 1E9)}`;
        const filename = uniqueSuffix + path.extname(req.file.originalname);
        const filepath = path.join(uploadDir, filename);

        // Write buffer to disk directly
        fs.writeFileSync(filepath, req.file.buffer);

        // Update req.file details
        // @ts-ignore
        req.file.filename = filename;
        // @ts-ignore
        req.file.path = filepath;
        // @ts-ignore
        req.file.destination = uploadDir;

        // Clear buffer
        // @ts-ignore
        delete req.file.buffer;

        next();
    } catch (error: any) {
        logger.error('Temp file save failed', { error: error.message });
        next(new Error('File processing failed'));
    }
};
