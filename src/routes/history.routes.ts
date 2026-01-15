import { Router } from 'express';
import { getVehicleHistory } from '../controllers/history.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public/Auth: Get History
// Currently open to authenticated users (e.g. buyers)
router.get('/:vin', authenticate, getVehicleHistory);

export default router;
