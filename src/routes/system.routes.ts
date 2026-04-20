import { Router } from 'express';
import * as systemController from '../controllers/system.controller';

const router = Router();

/**
 * @swagger
 * /system/config:
 *   get:
 *     summary: Get public system configuration
 *     tags: [System]
 */
router.get('/config', systemController.getPublicConfig);

/**
 * @swagger
 * /system/status:
 *   get:
 *     summary: Get basic system status
 *     tags: [System]
 */
router.get('/status', systemController.getSystemStatus);

export default router;
