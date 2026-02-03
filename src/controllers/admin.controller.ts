/**
 * Admin Controller - Refactored to use Service Layer
 * Delegates to GarageApprovalService, SubscriptionManagementService, UserManagementService, and AnalyticsService
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import logger from '../utils/logger';
import {
    AnalyticsService,
    GarageApprovalService,
    SubscriptionManagementService,
    UserManagementService,
    isAdminError,
    getHttpStatusForError
} from '../services/admin';

// Initialize services
const analyticsService = new AnalyticsService(pool);
const garageApprovalService = new GarageApprovalService(pool);
const subscriptionService = new SubscriptionManagementService(pool);
const userManagementService = new UserManagementService(pool);

// ============================================
// GARAGE APPROVAL WORKFLOW
// ============================================

export const getPendingGarages = async (req: AuthRequest, res: Response) => {
    try {
        const { status, search, page, limit } = req.query;
        const result = await garageApprovalService.getPendingGarages({
            approval_status: status as any,
            search: search as string,
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined
        });
        res.json(result);
    } catch (err) {
        logger.error('getPendingGarages error:', { error: (err as any).message });
        res.status(500).json({ error: 'Failed to fetch garages' });
    }
};

export const getAllGaragesAdmin = async (req: AuthRequest, res: Response) => {
    try {
        const { status, search, page, limit } = req.query;
        const result = await garageApprovalService.getAllGarages({
            approval_status: status as any,
            search: search as string,
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined
        });
        res.json(result);
    } catch (err) {
        logger.error('getAllGaragesAdmin error:', { error: (err as any).message });
        res.status(500).json({ error: 'Failed to fetch garages' });
    }
};

export const approveGarage = async (req: AuthRequest, res: Response) => {
    try {
        const { garage_id } = req.params;
        const { notes } = req.body;
        const garage = await garageApprovalService.approveGarage(
            garage_id,
            req.user!.userId,
            notes
        );
        res.json({ message: 'Garage approved successfully', garage });
    } catch (err) {
        logger.error('approveGarage error:', { error: (err as any).message });
        const status = isAdminError(err) ? getHttpStatusForError(err) : 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

export const rejectGarage = async (req: AuthRequest, res: Response) => {
    try {
        const { garage_id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }

        const garage = await garageApprovalService.rejectGarage(
            garage_id,
            req.user!.userId,
            reason
        );
        res.json({ message: 'Garage rejected', garage });
    } catch (err) {
        logger.error('rejectGarage error:', { error: (err as any).message });
        const status = isAdminError(err) ? getHttpStatusForError(err) : 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

export const grantDemoAccess = async (req: AuthRequest, res: Response) => {
    try {
        const { garage_id } = req.params;
        const { days, notes } = req.body;
        const result = await garageApprovalService.grantDemoAccess(
            garage_id,
            req.user!.userId,
            days,
            notes
        );
        res.json(result);
    } catch (err) {
        logger.error('grantDemoAccess error:', { error: (err as any).message });
        const status = isAdminError(err) ? getHttpStatusForError(err) : 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

export const revokeGarageAccess = async (req: AuthRequest, res: Response) => {
    try {
        const { garage_id } = req.params;
        const { reason } = req.body;
        const garage = await garageApprovalService.revokeGarageAccess(
            garage_id,
            req.user!.userId,
            reason
        );
        res.json({ message: 'Garage access revoked', garage });
    } catch (err) {
        logger.error('revokeGarageAccess error:', { error: (err as any).message });
        const status = isAdminError(err) ? getHttpStatusForError(err) : 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// ADMIN DASHBOARD STATS
// ============================================

export const getAdminDashboardStats = async (req: AuthRequest, res: Response) => {
    try {
        const stats = await analyticsService.getDashboardStats();
        res.json({ stats });
    } catch (err) {
        logger.error('getAdminDashboardStats error:', { error: (err as any).message });
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
};

export const getAuditLog = async (req: AuthRequest, res: Response) => {
    try {
        const { page, limit, action_type, target_type } = req.query;
        const result = await analyticsService.getAuditLog({
            action_type: action_type as string,
            target_type: target_type as string,
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined
        });
        res.json(result);
    } catch (err) {
        logger.error('getAuditLog error:', { error: (err as any).message });
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
};

// ============================================
// SUBSCRIPTION & PLAN MANAGEMENT
// ============================================

export const getSubscriptionRequests = async (req: AuthRequest, res: Response) => {
    try {
        const { status = 'pending' } = req.query;
        const requests = await subscriptionService.getSubscriptionRequests(status as string);
        res.json({ requests });
    } catch (err) {
        logger.error('getSubscriptionRequests error:', { error: (err as any).message });
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
};

export const approveSubscriptionRequest = async (req: AuthRequest, res: Response) => {
    try {
        const { request_id } = req.params;
        await subscriptionService.approveSubscriptionRequest(request_id, req.user!.userId);
        res.json({ message: 'Plan change approved and applied.' });
    } catch (err) {
        logger.error('approveSubscriptionRequest error:', { error: (err as any).message });
        const status = isAdminError(err) ? getHttpStatusForError(err) : 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

export const rejectSubscriptionRequest = async (req: AuthRequest, res: Response) => {
    try {
        const { request_id } = req.params;
        const { reason } = req.body;
        await subscriptionService.rejectSubscriptionRequest(request_id, req.user!.userId, reason);
        res.json({ message: 'Request rejected' });
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
};

/**
 * Verify bank payment for subscription upgrade
 * Admin calls this after confirming bank transfer was received
 */
export const verifyBankPayment = async (req: AuthRequest, res: Response) => {
    try {
        const { request_id } = req.params;
        const { bank_reference } = req.body;

        if (!bank_reference) {
            return res.status(400).json({ error: 'Bank reference number is required' });
        }

        await subscriptionService.verifyBankPayment(request_id, req.user!.userId, bank_reference);
        res.json({
            message: 'Bank payment verified. You can now approve the subscription upgrade.',
            payment_status: 'paid'
        });
    } catch (err) {
        logger.error('verifyBankPayment error:', { error: (err as any).message });
        const status = isAdminError(err) ? getHttpStatusForError(err) : 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

export const getSubscriptionPlans = async (req: AuthRequest, res: Response) => {
    try {
        const plans = await subscriptionService.getSubscriptionPlans();
        res.json({ plans });
    } catch (err) {
        logger.error('getSubscriptionPlans error:', { error: (err as any).message });
        res.status(500).json({ error: 'Failed to fetch plans' });
    }
};

export const assignPlanToGarage = async (req: AuthRequest, res: Response) => {
    try {
        const { garage_id } = req.params;
        const { plan_id, months, notes } = req.body;

        if (!plan_id) {
            return res.status(400).json({ error: 'Plan ID is required' });
        }

        const subscription = await subscriptionService.assignPlanToGarage(
            garage_id,
            plan_id,
            req.user!.userId,
            { months, notes }
        );

        res.json({
            message: `Plan assigned for ${months || 1} month(s)`,
            subscription
        });
    } catch (err) {
        logger.error('assignPlanToGarage error:', { error: (err as any).message });
        const status = isAdminError(err) ? getHttpStatusForError(err) : 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

export const revokeSubscription = async (req: AuthRequest, res: Response) => {
    try {
        const { garage_id } = req.params;
        const { reason } = req.body;
        await subscriptionService.revokeSubscription(garage_id, req.user!.userId, reason);
        res.json({ message: 'Subscription revoked successfully' });
    } catch (err) {
        logger.error('revokeSubscription error:', { error: (err as any).message });
        const status = isAdminError(err) ? getHttpStatusForError(err) : 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

export const extendSubscription = async (req: AuthRequest, res: Response) => {
    try {
        const { garage_id } = req.params;
        const { months, notes } = req.body;

        if (!months || months < 1) {
            return res.status(400).json({ error: 'Valid months value is required' });
        }

        const subscription = await subscriptionService.extendSubscription(
            garage_id,
            parseInt(months),
            req.user!.userId,
            notes
        );

        res.json({
            message: `Subscription extended by ${months} month(s)`,
            subscription
        });
    } catch (err) {
        logger.error('extendSubscription error:', { error: (err as any).message });
        const status = isAdminError(err) ? getHttpStatusForError(err) : 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

export const overrideCommission = async (req: AuthRequest, res: Response) => {
    try {
        const { garage_id } = req.params;
        const { commission_rate, reason } = req.body;

        if (commission_rate === undefined || !reason) {
            return res.status(400).json({ error: 'Commission rate and reason are required' });
        }

        await subscriptionService.overrideCommission(
            garage_id,
            parseFloat(commission_rate),
            req.user!.userId,
            reason
        );

        res.json({ message: 'Commission rate updated successfully' });
    } catch (err) {
        logger.error('overrideCommission error:', { error: (err as any).message });
        const status = isAdminError(err) ? getHttpStatusForError(err) : 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

export const updateGarageSpecializationAdmin = async (req: AuthRequest, res: Response) => {
    try {
        const { garage_id } = req.params;
        const { supplier_type, specialized_brands, all_brands } = req.body;

        const garage = await subscriptionService.updateGarageSpecialization(
            garage_id,
            req.user!.userId,
            { supplier_type, specialized_brands, all_brands }
        );

        res.json({ message: 'Specialization updated successfully', garage });
    } catch (err) {
        logger.error('updateGarageSpecializationAdmin error:', { error: (err as any).message });
        const status = isAdminError(err) ? getHttpStatusForError(err) : 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// USER MANAGEMENT
// ============================================

export const getAllUsers = async (req: AuthRequest, res: Response) => {
    try {
        const { user_type, status, is_active, is_suspended, search, role, page, limit } = req.query;

        // Handle status param from frontend: 'active', 'suspended', or 'all'
        let suspendedFilter: boolean | undefined;
        if (status === 'suspended') {
            suspendedFilter = true;
        } else if (status === 'active') {
            suspendedFilter = false;
        } else if (is_suspended !== undefined) {
            suspendedFilter = is_suspended === 'true';
        }

        const result = await userManagementService.getAllUsers({
            user_type: user_type as any,
            is_active: is_active === 'true' ? true : is_active === 'false' ? false : undefined,
            is_suspended: suspendedFilter,
            search: search as string,
            role: role as string,  // Staff role filter
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined
        });
        res.json(result);
    } catch (err) {
        logger.error('getAllUsers error:', { error: (err as any).message });
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

export const getAdminUserDetails = async (req: AuthRequest, res: Response) => {
    try {
        const { user_id } = req.params;
        const userDetail = await userManagementService.getUserDetails(user_id);

        // Extract type_data and activity from the response
        const { type_data, activity, ...user } = userDetail;

        res.json({
            user,
            type_data: type_data || null,
            activity: activity || null
        });
    } catch (err) {
        logger.error('getAdminUserDetails error:', { error: (err as any).message });
        const status = isAdminError(err) ? getHttpStatusForError(err) : 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

export const updateUserAdmin = async (req: AuthRequest, res: Response) => {
    try {
        const { user_id } = req.params;
        const { full_name, email, phone_number, is_active } = req.body;

        const user = await userManagementService.updateUser(
            user_id,
            req.user!.userId,
            { full_name, email, phone_number, is_active }
        );

        res.json({ message: 'User updated successfully', user });
    } catch (err) {
        logger.error('updateUserAdmin error:', { error: (err as any).message });
        const status = isAdminError(err) ? getHttpStatusForError(err) : 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

export const adminSuspendUser = async (req: AuthRequest, res: Response) => {
    try {
        const { user_id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Suspension reason is required' });
        }

        await userManagementService.suspendUser(user_id, req.user!.userId, reason);
        res.json({ message: 'User suspended successfully' });
    } catch (err) {
        logger.error('adminSuspendUser error:', { error: (err as any).message });
        const status = isAdminError(err) ? getHttpStatusForError(err) : 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

export const adminActivateUser = async (req: AuthRequest, res: Response) => {
    try {
        const { user_id } = req.params;
        const { notes } = req.body;
        await userManagementService.activateUser(user_id, req.user!.userId, notes);
        res.json({ message: 'User activated successfully' });
    } catch (err) {
        logger.error('adminActivateUser error:', { error: (err as any).message });
        const status = isAdminError(err) ? getHttpStatusForError(err) : 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

export const adminResetPassword = async (req: AuthRequest, res: Response) => {
    try {
        const { user_id } = req.params;
        const { new_password } = req.body;

        if (!new_password) {
            return res.status(400).json({ error: 'New password is required' });
        }

        await userManagementService.resetPassword(user_id, req.user!.userId, new_password);
        res.json({ message: 'Password reset successfully. User must change on next login.' });
    } catch (err) {
        logger.error('adminResetPassword error:', { error: (err as any).message });
        const status = isAdminError(err) ? getHttpStatusForError(err) : 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};

export const adminCreateUser = async (req: AuthRequest, res: Response) => {
    try {
        const userData = req.body;
        const user = await userManagementService.createUser(req.user!.userId, userData);
        res.status(201).json({ message: 'User created successfully', user });
    } catch (err) {
        logger.error('adminCreateUser error:', { error: (err as any).message });
        const status = isAdminError(err) ? getHttpStatusForError(err) : 500;
        res.status(status).json({ error: getErrorMessage(err) });
    }
};
