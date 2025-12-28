import { Router } from 'express';
import { recognizeVIN } from '../controllers/ocr.controller';
import { upload } from '../middleware/file.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// POST /api/ocr/vin - Recognize VIN from uploaded image
router.post('/vin', authenticate, upload.single('image'), recognizeVIN);

export default router;
