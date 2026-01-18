import { Request, Response } from 'express';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { AuthRequest } from '../middleware/auth.middleware';
import logger from '../utils/logger';
import { catchAsync } from '../utils/catchAsync';
import { AuthService } from '../services/auth';

const authService = new AuthService(pool);

// Qatar phone number validation
const isValidPhoneNumber = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s-]/g, '');
    return /^(\+?974)?[3-7]\d{7}$/.test(cleaned);
};

export const register = catchAsync(async (req: Request, res: Response) => {
    const { phone_number, password, user_type, full_name, garage_name, address, supplier_type, specialized_brands, all_brands, location_lat, location_lng } = req.body;

    if (!phone_number || !password || !user_type) return res.status(400).json({ error: 'Missing required fields: phone_number, password, user_type' });
    if (!isValidPhoneNumber(phone_number)) return res.status(400).json({ error: 'Invalid phone number format', hint: 'Use Qatar format: +974XXXXXXXX or 8-digit local number' });
    if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    if (!['customer', 'garage'].includes(user_type)) return res.status(400).json({ error: 'Invalid user_type. Must be "customer" or "garage"' });

    const exists = await authService.checkUserExists(phone_number);
    if (exists) return res.status(400).json({ error: 'User with this phone number already exists' });

    if (user_type === 'garage' && !garage_name) return res.status(400).json({ error: 'Garage name is required for garage registration' });

    let validLat: number | undefined, validLng: number | undefined;
    if (location_lat !== undefined && location_lng !== undefined) {
        const lat = parseFloat(location_lat), lng = parseFloat(location_lng);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            validLat = lat; validLng = lng;
            if (lat < 24.4 || lat > 26.2 || lng < 50.7 || lng > 51.7) logger.warn('Garage location outside Qatar bounds', { lat, lng });
        }
    }

    const result = await authService.registerUser({ phone_number, password, user_type, full_name, garage_name, address, supplier_type, specialized_brands, all_brands, location_lat: validLat, location_lng: validLng });
    res.status(201).json({ token: result.token, userId: result.userId, userType: user_type });
});

export const login = catchAsync(async (req: Request, res: Response) => {
    const { phone_number, password } = req.body;
    if (!phone_number || !password) return res.status(400).json({ error: 'Phone number and password are required' });

    try {
        const result = await authService.login(phone_number, password);
        res.json(result);
    } catch (err) {
        const message = getErrorMessage(err);
        if (message === 'Invalid credentials') return res.status(401).json({ error: message });
        if (message === 'Account deactivated') return res.status(403).json({ error: message, message: 'Your account has been deactivated. Please contact support.' });
        if (message.startsWith('Account suspended') || message === 'Account suspended') return res.status(403).json({ error: 'Account suspended', message });
        if (message === 'pending_approval') return res.status(403).json({ error: 'pending_approval', message: 'Your account is pending approval.', status: 'pending' });
        if (message.startsWith('application_rejected:')) return res.status(403).json({ error: 'application_rejected', message: message.split(':')[1], status: 'rejected' });
        throw err;
    }
});

export const deleteAccount = catchAsync(async (req: AuthRequest, res: Response) => {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    logger.info('Deleting user account', { userId: req.user.userId });
    try {
        await authService.deleteAccount(req.user.userId);
        res.json({ message: 'Account deleted successfully' });
    } catch (err) {
        if (getErrorMessage(err) === 'User not found') return res.status(404).json({ error: 'User not found' });
        throw err;
    }
});
