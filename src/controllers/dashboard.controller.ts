import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { getErrorMessage } from '../types';
import pool from '../config/db';
import { DashboardService } from '../services/dashboard';

const dashboardService = new DashboardService(pool);

// ============= GARAGE DASHBOARD =============
export const getGarageStats = async (req: AuthRequest, res: Response) => {
    try {
        const result = await dashboardService.getGarageStats(req.user!.userId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getGarageProfile = async (req: AuthRequest, res: Response) => {
    try {
        const profile = await dashboardService.getGarageProfile(req.user!.userId);
        if (!profile) return res.status(404).json({ error: 'Garage not found' });
        res.json(profile);
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const updateGarageBusinessDetails = async (req: AuthRequest, res: Response) => {
    try {
        const result = await dashboardService.updateGarageBusinessDetails(req.user!.userId, req.body);
        if (!result) return res.status(404).json({ error: 'Garage not found' });
        res.json({ message: 'Business details updated successfully', garage: result });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const updateGarageSpecialization = async (req: AuthRequest, res: Response) => {
    const { supplier_type, specialized_brands, all_brands } = req.body;

    if (supplier_type && !['used', 'new', 'both'].includes(supplier_type)) {
        return res.status(400).json({ error: 'supplier_type must be one of: used, new, both' });
    }
    if (specialized_brands && !Array.isArray(specialized_brands)) {
        return res.status(400).json({ error: 'specialized_brands must be an array' });
    }
    if (all_brands !== undefined && typeof all_brands !== 'boolean') {
        return res.status(400).json({ error: 'all_brands must be a boolean' });
    }

    try {
        const result = await dashboardService.updateGarageSpecialization(req.user!.userId, req.body);
        if (!result) return res.status(404).json({ error: 'Garage not found' });
        res.json({ message: 'Garage specialization updated successfully', garage: result });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const updateGarageLocation = async (req: AuthRequest, res: Response) => {
    const { location_lat, location_lng, address } = req.body;

    if (location_lat === undefined || location_lng === undefined) {
        return res.status(400).json({ error: 'Both location_lat and location_lng are required' });
    }

    const lat = parseFloat(location_lat);
    const lng = parseFloat(location_lng);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ error: 'Invalid GPS coordinates' });
    }

    const isInQatar = lat >= 24.4 && lat <= 26.2 && lng >= 50.7 && lng <= 51.7;

    try {
        const result = await dashboardService.updateGarageLocation(req.user!.userId, lat, lng, address);
        if (!result) return res.status(404).json({ error: 'Garage not found' });
        res.json({
            message: 'Garage location updated successfully',
            garage: result,
            warning: !isInQatar ? 'Location appears to be outside Qatar. Please verify.' : undefined
        });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============= CUSTOMER DASHBOARD =============
export const getCustomerStats = async (req: AuthRequest, res: Response) => {
    try {
        const stats = await dashboardService.getCustomerStats(req.user!.userId);
        res.json({ stats });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getCustomerProfile = async (req: AuthRequest, res: Response) => {
    try {
        const result = await dashboardService.getCustomerProfile(req.user!.userId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const updateCustomerProfile = async (req: AuthRequest, res: Response) => {
    try {
        const user = await dashboardService.updateCustomerProfile(req.user!.userId, req.body);
        res.json({ user, message: 'Profile updated successfully' });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============= ADDRESSES =============
export const addAddress = async (req: AuthRequest, res: Response) => {
    try {
        const address = await dashboardService.addAddress(req.user!.userId, req.body);
        res.json({ address, message: 'Address added successfully' });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const deleteAddress = async (req: AuthRequest, res: Response) => {
    try {
        const deleted = await dashboardService.deleteAddress(req.user!.userId, req.params.addressId);
        if (!deleted) return res.status(404).json({ error: 'Address not found' });
        res.json({ message: 'Address deleted' });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const setDefaultAddress = async (req: AuthRequest, res: Response) => {
    try {
        const address = await dashboardService.setDefaultAddress(req.user!.userId, req.params.addressId);
        if (!address) return res.status(404).json({ error: 'Address not found' });
        res.json({ address, message: 'Default address updated' });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============= NOTIFICATIONS =============
export const getNotifications = async (req: AuthRequest, res: Response) => {
    try {
        const notifications = await dashboardService.getNotifications(req.user!.userId);
        res.json({ notifications });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const markNotificationRead = async (req: AuthRequest, res: Response) => {
    try {
        await dashboardService.markNotificationRead(req.user!.userId, req.params.notificationId);
        res.json({ message: 'Notification marked as read' });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response) => {
    try {
        await dashboardService.markAllNotificationsRead(req.user!.userId);
        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const deleteNotification = async (req: AuthRequest, res: Response) => {
    try {
        const deleted = await dashboardService.deleteNotification(req.user!.userId, req.params.notificationId);
        if (!deleted) return res.status(404).json({ error: 'Notification not found' });
        res.json({ message: 'Notification deleted' });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const clearAllNotifications = async (req: AuthRequest, res: Response) => {
    try {
        const count = await dashboardService.clearAllNotifications(req.user!.userId);
        res.json({ message: 'All notifications cleared', deleted_count: count });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
