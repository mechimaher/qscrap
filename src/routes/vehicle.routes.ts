import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    getMyVehicles,
    saveVehicle,
    updateVehicle,
    deleteVehicle
} from '../controllers/vehicle.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/vehicles - Get customer's saved vehicles
router.get('/', getMyVehicles);

// POST /api/vehicles - Save a new vehicle
router.post('/', saveVehicle);

// PATCH /api/vehicles/:vehicleId - Update vehicle (nickname, primary)
router.patch('/:vehicleId', updateVehicle);

// DELETE /api/vehicles/:vehicleId - Delete a vehicle
router.delete('/:vehicleId', deleteVehicle);

export default router;
