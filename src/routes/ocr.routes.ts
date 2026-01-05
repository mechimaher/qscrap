import { Router } from 'express';
import { recognizeVIN, recognizeVINBase64 } from '../controllers/ocr.controller';
import { upload, saveTempFile } from '../middleware/file.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// POST /api/ocr/vin - Recognize VIN from uploaded image (file upload)
router.post('/vin', authenticate, upload.single('image'), saveTempFile, recognizeVIN);

// POST /api/ocr/vin/base64 - Recognize VIN from base64 image (mobile app)
router.post('/vin/base64', authenticate, recognizeVINBase64);

export default router;
