import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { VehicleService } from '../services/vehicle';

const vehicleService = new VehicleService(pool);

export const getMyVehicles = async (req: AuthRequest, res: Response) => {
    try {
        const vehicles = await vehicleService.getMyVehicles(req.user!.userId);
        res.json({ success: true, vehicles });
    } catch (error) {
        console.error('[Vehicles] Error fetching vehicles:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const saveVehicle = async (req: AuthRequest, res: Response) => {
    try {
        const { car_make, car_model, car_year } = req.body;
        if (!car_make || !car_model || !car_year) return res.status(400).json({ success: false, error: 'car_make, car_model, and car_year are required' });
        const result = await vehicleService.saveVehicle(req.user!.userId, req.body);
        res.status(result.updated ? 200 : 201).json({ success: true, message: result.updated ? 'Vehicle updated' : 'Vehicle saved', vehicle: result.vehicle });
    } catch (error) {
        console.error('[Vehicles] Error saving vehicle:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const updateVehicle = async (req: AuthRequest, res: Response) => {
    try {
        const vehicle = await vehicleService.updateVehicle(req.user!.userId, req.params.vehicleId, req.body);
        if (!vehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });
        res.json({ success: true, vehicle });
    } catch (error) {
        console.error('[Vehicles] Error updating vehicle:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const deleteVehicle = async (req: AuthRequest, res: Response) => {
    try {
        const deleted = await vehicleService.deleteVehicle(req.user!.userId, req.params.vehicleId);
        if (!deleted) return res.status(404).json({ success: false, error: 'Vehicle not found' });
        res.json({ success: true, message: 'Vehicle deleted' });
    } catch (error) {
        console.error('[Vehicles] Error deleting vehicle:', error);
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const autoSaveVehicle = async (customerId: string, carMake: string, carModel: string, carYear: number, vinNumber?: string, frontImageUrl?: string, rearImageUrl?: string): Promise<string | null> => {
    try {
        return await vehicleService.autoSaveVehicle(customerId, carMake, carModel, carYear, vinNumber, frontImageUrl, rearImageUrl);
    } catch (error) {
        console.error('[Vehicles] Auto-save failed:', error);
        return null;
    }
};
