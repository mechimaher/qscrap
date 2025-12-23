import multer from 'multer';
import fs from 'fs';
import path from 'path';

const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Determine folder based on field name or path?
        // For MVP just one dump folder or subfolders?
        // Let's use subfolders based on role if possible, or just 'uploads'
        // The plan said /uploads/customers/ and /uploads/garages/
        // Let's try to infer or just put in root 'uploads' to be safe for MVP
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

export const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});
