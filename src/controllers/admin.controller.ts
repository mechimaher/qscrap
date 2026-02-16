/**
 * Admin Controller - Refactored to use Service Layer
 * Delegates to GarageApprovalService, SubscriptionManagementService, UserManagementService, and AnalyticsService
 */

import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth.middleware';
import {
    AnalyticsService,
    GarageApprovalService,
    SubscriptionManagementService,
    UserManagementService,
    getHttpStatusForError,
    isAdminError,
    CreateUserDto,
    GarageFilters,
    SpecializationData,
    UserFilters
} from '../services/admin';
import { getErrorMessage } from '../types';
import logger from '../utils/logger';

const analyticsService = new AnalyticsService(pool);
const garageApprovalService = new GarageApprovalService(pool);
const subscriptionService = new SubscriptionManagementService(pool);
const userManagementService = new UserManagementService(pool);

const GARAGE_APPROVAL_STATUSES: Array<NonNullable<GarageFilters['approval_status']>> = [
    'pending',
    'approved',
    'rejected',
    'demo',
    'all'
];

const CREATABLE_USER_TYPES: CreateUserDto['user_type'][] = [
    'customer',
    'garage',
    'driver',
    'staff'
];

const SUPPLIER_TYPES: SpecializationData['supplier_type'][] = [
    'dealer',
    'aftermarket',
    'general'
];

interface GarageParams {
    garage_id: string;
}

interface RequestParams {
    request_id: string;
}

interface UserParams {
    user_id: string;
}

interface ApproveGarageBody {
    notes?: string;
}

interface RejectGarageBody {
    reason?: string;
}

interface GrantDemoAccessBody {
    days?: number | string;
    notes?: string;
}

interface RevokeGarageAccessBody {
    reason?: string;
}

interface RejectSubscriptionRequestBody {
    reason?: string;
}

interface VerifyBankPaymentBody {
    bank_reference?: string;
}

interface AssignPlanBody {
    plan_id?: number | string;
    months?: number | string;
    notes?: string;
}

interface RevokeSubscriptionBody {
    reason?: string;
}

interface ExtendSubscriptionBody {
    months?: number | string;
    notes?: string;
}

interface OverrideCommissionBody {
    commission_rate?: number | string;
    reason?: string;
}

interface UpdateGarageSpecializationBody {
    supplier_type?: string;
    specialized_brands?: unknown;
    all_brands?: boolean | string;
}

interface UpdateUserBody {
    full_name?: string;
    email?: string;
    phone_number?: string;
    is_active?: boolean | string;
}

interface SuspendUserBody {
    reason?: string;
}

interface ActivateUserBody {
    notes?: string;
}

interface ResetPasswordBody {
    new_password?: string;
}

interface CreateUserBody {
    user_type?: string;
    full_name?: string;
    email?: string;
    phone_number?: string;
    password?: string;
    garage_data?: CreateUserDto['garage_data'];
    driver_data?: CreateUserDto['driver_data'];
    staff_data?: CreateUserDto['staff_data'];
    permissions?: unknown;
}

const getAdminId = (req: AuthRequest): string | null => req.user?.userId ?? null;

const toQueryString = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
        return value[0];
    }
    return undefined;
};

const toOptionalInt = (value: unknown): number | undefined => {
    const raw = toQueryString(value);
    if (!raw) {
        return undefined;
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    const raw = toQueryString(value);
    if (!raw) {
        return undefined;
    }

    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const toOptionalBoolean = (value: unknown): boolean | undefined => {
    if (typeof value === 'boolean') {
        return value;
    }

    const raw = toQueryString(value);
    if (!raw) {
        return undefined;
    }

    const normalized = raw.trim().toLowerCase();
    if (normalized === 'true') {
        return true;
    }
    if (normalized === 'false') {
        return false;
    }

    return undefined;
};

const toStringArray = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) {
        return undefined;
    }
    return value.filter((item): item is string => typeof item === 'string');
};

const toApprovalStatus = (value: unknown): GarageFilters['approval_status'] | undefined => {
    const status = toQueryString(value);
    if (!status) {
        return undefined;
    }

    return GARAGE_APPROVAL_STATUSES.includes(status as NonNullable<GarageFilters['approval_status']>)
        ? (status as GarageFilters['approval_status'])
        : undefined;
};

const toCreatableUserType = (value: unknown): CreateUserDto['user_type'] | undefined => {
    const userType = toQueryString(value);
    if (!userType) {
        return undefined;
    }

    return CREATABLE_USER_TYPES.includes(userType as CreateUserDto['user_type'])
        ? (userType as CreateUserDto['user_type'])
        : undefined;
};

const toSupplierType = (value: unknown): SpecializationData['supplier_type'] | undefined => {
    const supplierType = toQueryString(value);
    if (!supplierType) {
        return undefined;
    }

    return SUPPLIER_TYPES.includes(supplierType as SpecializationData['supplier_type'])
        ? (supplierType as SpecializationData['supplier_type'])
        : undefined;
};

const logAdminError = (context: string, error: unknown): void => {
    logger.error(context, { error: getErrorMessage(error) });
};

const sendAdminError = (res: Response, error: unknown, fallbackMessage: string): Response => {
    if (isAdminError(error)) {
        return res.status(getHttpStatusForError(error)).json({ error: getErrorMessage(error) });
    }
    return res.status(500).json({ error: fallbackMessage });
};

const getGarageParams = (req: AuthRequest): GarageParams => req.params as unknown as GarageParams;
const getRequestParams = (req: AuthRequest): RequestParams => req.params as unknown as RequestParams;
const getUserParams = (req: AuthRequest): UserParams => req.params as unknown as UserParams;

// ============================================
// GARAGE APPROVAL WORKFLOW
// ============================================

export const getPendingGarages = async (req: AuthRequest, res: Response) => {
    try {
        const result = await garageApprovalService.getPendingGarages({
            approval_status: toApprovalStatus(req.query.status),
            search: toQueryString(req.query.search),
            page: toOptionalInt(req.query.page),
            limit: toOptionalInt(req.query.limit)
        });
        res.json(result);
    } catch (error) {
        logAdminError('getPendingGarages error:', error);
        res.status(500).json({ error: 'Failed to fetch garages' });
    }
};

export const getAllGaragesAdmin = async (req: AuthRequest, res: Response) => {
    try {
        const result = await garageApprovalService.getAllGarages({
            approval_status: toApprovalStatus(req.query.status),
            search: toQueryString(req.query.search),
            page: toOptionalInt(req.query.page),
            limit: toOptionalInt(req.query.limit)
        });
        res.json(result);
    } catch (error) {
        logAdminError('getAllGaragesAdmin error:', error);
        res.status(500).json({ error: 'Failed to fetch garages' });
    }
};

export const approveGarage = async (req: AuthRequest, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { garage_id } = getGarageParams(req);
        const body = req.body as unknown as ApproveGarageBody;
        const notes = toQueryString(body.notes);

        const garage = await garageApprovalService.approveGarage(garage_id, adminId, notes);
        res.json({ message: 'Garage approved successfully', garage });
    } catch (error) {
        logAdminError('approveGarage error:', error);
        return sendAdminError(res, error, 'Failed to approve garage');
    }
};

export const rejectGarage = async (req: AuthRequest, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { garage_id } = getGarageParams(req);
        const body = req.body as unknown as RejectGarageBody;
        const reason = toQueryString(body.reason);

        if (!reason) {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }

        const garage = await garageApprovalService.rejectGarage(garage_id, adminId, reason);
        res.json({ message: 'Garage rejected', garage });
    } catch (error) {
        logAdminError('rejectGarage error:', error);
        return sendAdminError(res, error, 'Failed to reject garage');
    }
};

export const grantDemoAccess = async (req: AuthRequest, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { garage_id } = getGarageParams(req);
        const body = req.body as unknown as GrantDemoAccessBody;
        const days = toOptionalInt(body.days);
        const notes = toQueryString(body.notes);

        const result = await garageApprovalService.grantDemoAccess(
            garage_id,
            adminId,
            days,
            notes
        );
        res.json(result);
    } catch (error) {
        logAdminError('grantDemoAccess error:', error);
        return sendAdminError(res, error, 'Failed to grant demo access');
    }
};

export const revokeGarageAccess = async (req: AuthRequest, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { garage_id } = getGarageParams(req);
        const body = req.body as unknown as RevokeGarageAccessBody;
        const reason = toQueryString(body.reason);

        const garage = await garageApprovalService.revokeGarageAccess(
            garage_id,
            adminId,
            reason ?? ''
        );
        res.json({ message: 'Garage access revoked', garage });
    } catch (error) {
        logAdminError('revokeGarageAccess error:', error);
        return sendAdminError(res, error, 'Failed to revoke garage access');
    }
};

// ============================================
// ADMIN DASHBOARD STATS
// ============================================

export const getAdminDashboardStats = async (_req: AuthRequest, res: Response) => {
    try {
        const stats = await analyticsService.getDashboardStats();
        res.json({ stats });
    } catch (error) {
        logAdminError('getAdminDashboardStats error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
};

export const getAuditLog = async (req: AuthRequest, res: Response) => {
    try {
        const result = await analyticsService.getAuditLog({
            action_type: toQueryString(req.query.action_type),
            target_type: toQueryString(req.query.target_type),
            page: toOptionalInt(req.query.page),
            limit: toOptionalInt(req.query.limit)
        });
        res.json(result);
    } catch (error) {
        logAdminError('getAuditLog error:', error);
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
};

// ============================================
// SUBSCRIPTION & PLAN MANAGEMENT
// ============================================

export const getSubscriptionRequests = async (req: AuthRequest, res: Response) => {
    try {
        const status = toQueryString(req.query.status) ?? 'pending';
        const requests = await subscriptionService.getSubscriptionRequests(status);
        res.json({ requests });
    } catch (error) {
        logAdminError('getSubscriptionRequests error:', error);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
};

export const approveSubscriptionRequest = async (req: AuthRequest, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { request_id } = getRequestParams(req);
        await subscriptionService.approveSubscriptionRequest(request_id, adminId);
        res.json({ message: 'Plan change approved and applied.' });
    } catch (error) {
        logAdminError('approveSubscriptionRequest error:', error);
        return sendAdminError(res, error, 'Failed to approve subscription request');
    }
};

export const rejectSubscriptionRequest = async (req: AuthRequest, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { request_id } = getRequestParams(req);
        const body = req.body as unknown as RejectSubscriptionRequestBody;
        const reason = toQueryString(body.reason);
        await subscriptionService.rejectSubscriptionRequest(request_id, adminId, reason);
        res.json({ message: 'Request rejected' });
    } catch (error) {
        logAdminError('rejectSubscriptionRequest error:', error);
        return sendAdminError(res, error, 'Failed to reject subscription request');
    }
};

/**
 * Verify bank payment for subscription upgrade
 * Admin calls this after confirming bank transfer was received
 */
export const verifyBankPayment = async (req: AuthRequest, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { request_id } = getRequestParams(req);
        const body = req.body as unknown as VerifyBankPaymentBody;
        const bankReference = toQueryString(body.bank_reference);

        if (!bankReference) {
            return res.status(400).json({ error: 'Bank reference number is required' });
        }

        await subscriptionService.verifyBankPayment(request_id, adminId, bankReference);
        res.json({
            message: 'Bank payment verified. You can now approve the subscription upgrade.',
            payment_status: 'paid'
        });
    } catch (error) {
        logAdminError('verifyBankPayment error:', error);
        return sendAdminError(res, error, 'Failed to verify bank payment');
    }
};

export const getSubscriptionPlans = async (_req: AuthRequest, res: Response) => {
    try {
        const plans = await subscriptionService.getSubscriptionPlans();
        res.json({ plans });
    } catch (error) {
        logAdminError('getSubscriptionPlans error:', error);
        res.status(500).json({ error: 'Failed to fetch plans' });
    }
};

export const assignPlanToGarage = async (req: AuthRequest, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { garage_id } = getGarageParams(req);
        const body = req.body as unknown as AssignPlanBody;

        const planIdRaw = body.plan_id;
        const planId = typeof planIdRaw === 'number' ? String(planIdRaw) : toQueryString(planIdRaw);
        if (!planId) {
            return res.status(400).json({ error: 'Plan ID is required' });
        }

        const months = toOptionalInt(body.months);
        const notes = toQueryString(body.notes);

        const subscription = await subscriptionService.assignPlanToGarage(
            garage_id,
            planId,
            adminId,
            { months, notes }
        );

        res.json({
            message: `Plan assigned for ${months ?? 1} month(s)`,
            subscription
        });
    } catch (error) {
        logAdminError('assignPlanToGarage error:', error);
        return sendAdminError(res, error, 'Failed to assign plan');
    }
};

export const revokeSubscription = async (req: AuthRequest, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { garage_id } = getGarageParams(req);
        const body = req.body as unknown as RevokeSubscriptionBody;
        const reason = toQueryString(body.reason);
        await subscriptionService.revokeSubscription(garage_id, adminId, reason);
        res.json({ message: 'Subscription revoked successfully' });
    } catch (error) {
        logAdminError('revokeSubscription error:', error);
        return sendAdminError(res, error, 'Failed to revoke subscription');
    }
};

export const extendSubscription = async (req: AuthRequest, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { garage_id } = getGarageParams(req);
        const body = req.body as unknown as ExtendSubscriptionBody;
        const months = toOptionalInt(body.months);
        const notes = toQueryString(body.notes);

        if (!months || months < 1) {
            return res.status(400).json({ error: 'Valid months value is required' });
        }

        const subscription = await subscriptionService.extendSubscription(
            garage_id,
            months,
            adminId,
            notes
        );

        res.json({
            message: `Subscription extended by ${months} month(s)`,
            subscription
        });
    } catch (error) {
        logAdminError('extendSubscription error:', error);
        return sendAdminError(res, error, 'Failed to extend subscription');
    }
};

export const overrideCommission = async (req: AuthRequest, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { garage_id } = getGarageParams(req);
        const body = req.body as unknown as OverrideCommissionBody;
        const commissionRate = toOptionalNumber(body.commission_rate);
        const reason = toQueryString(body.reason);

        if (commissionRate === undefined || !reason) {
            return res.status(400).json({ error: 'Commission rate and reason are required' });
        }

        await subscriptionService.overrideCommission(garage_id, commissionRate, adminId, reason);
        res.json({ message: 'Commission rate updated successfully' });
    } catch (error) {
        logAdminError('overrideCommission error:', error);
        return sendAdminError(res, error, 'Failed to override commission');
    }
};

export const updateGarageSpecializationAdmin = async (req: AuthRequest, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { garage_id } = getGarageParams(req);
        const body = req.body as unknown as UpdateGarageSpecializationBody;
        const supplierType = toSupplierType(body.supplier_type);
        const specializedBrands = toStringArray(body.specialized_brands);
        const allBrands = toOptionalBoolean(body.all_brands);

        if (!supplierType) {
            return res.status(400).json({ error: 'Valid supplier_type is required' });
        }

        const garageResult: unknown = await subscriptionService.updateGarageSpecialization(
            garage_id,
            adminId,
            {
                supplier_type: supplierType,
                specialized_brands: specializedBrands,
                all_brands: allBrands
            }
        );
        const garage = garageResult as Record<string, unknown>;

        res.json({ message: 'Specialization updated successfully', garage });
    } catch (error) {
        logAdminError('updateGarageSpecializationAdmin error:', error);
        return sendAdminError(res, error, 'Failed to update specialization');
    }
};

// ============================================
// USER MANAGEMENT
// ============================================

export const getAllUsers = async (req: AuthRequest, res: Response) => {
    try {
        const status = toQueryString(req.query.status);
        let suspendedFilter: boolean | undefined;
        if (status === 'suspended') {
            suspendedFilter = true;
        } else if (status === 'active') {
            suspendedFilter = false;
        } else {
            suspendedFilter = toOptionalBoolean(req.query.is_suspended);
        }

        const filters: UserFilters = {
            user_type: toQueryString(req.query.user_type),
            is_active: toOptionalBoolean(req.query.is_active),
            is_suspended: suspendedFilter,
            search: toQueryString(req.query.search),
            role: toQueryString(req.query.role),
            page: toOptionalInt(req.query.page),
            limit: toOptionalInt(req.query.limit)
        };

        const result = await userManagementService.getAllUsers(filters);
        res.json(result);
    } catch (error) {
        logAdminError('getAllUsers error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

export const getAdminUserDetails = async (req: AuthRequest, res: Response) => {
    try {
        const { user_id } = getUserParams(req);
        const userDetail = await userManagementService.getUserDetails(user_id);
        const typeData: unknown = userDetail.type_data;
        const activity: unknown = userDetail.activity;
        const user = {
            user_id: userDetail.user_id,
            user_type: userDetail.user_type,
            full_name: userDetail.full_name,
            email: userDetail.email,
            phone_number: userDetail.phone_number,
            is_active: userDetail.is_active,
            is_suspended: userDetail.is_suspended,
            created_at: userDetail.created_at,
            last_login: userDetail.last_login,
            total_orders: userDetail.total_orders,
            total_bids: userDetail.total_bids,
            account_balance: userDetail.account_balance,
            suspension_reason: userDetail.suspension_reason,
            recent_activity: userDetail.recent_activity as unknown
        };

        res.json({
            user,
            type_data: typeData ?? null,
            activity: activity ?? null
        });
    } catch (error) {
        logAdminError('getAdminUserDetails error:', error);
        return sendAdminError(res, error, 'Failed to fetch user details');
    }
};

export const updateUserAdmin = async (req: AuthRequest, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { user_id } = getUserParams(req);
        const body = req.body as unknown as UpdateUserBody;
        const user = await userManagementService.updateUser(user_id, adminId, {
            full_name: toQueryString(body.full_name),
            email: toQueryString(body.email),
            phone_number: toQueryString(body.phone_number),
            is_active: toOptionalBoolean(body.is_active)
        });

        res.json({ message: 'User updated successfully', user });
    } catch (error) {
        logAdminError('updateUserAdmin error:', error);
        return sendAdminError(res, error, 'Failed to update user');
    }
};

export const adminSuspendUser = async (req: AuthRequest, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { user_id } = getUserParams(req);
        const body = req.body as unknown as SuspendUserBody;
        const reason = toQueryString(body.reason);

        if (!reason) {
            return res.status(400).json({ error: 'Suspension reason is required' });
        }

        await userManagementService.suspendUser(user_id, adminId, reason);
        res.json({ message: 'User suspended successfully' });
    } catch (error) {
        logAdminError('adminSuspendUser error:', error);
        return sendAdminError(res, error, 'Failed to suspend user');
    }
};

export const adminActivateUser = async (req: AuthRequest, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { user_id } = getUserParams(req);
        const body = req.body as unknown as ActivateUserBody;
        const notes = toQueryString(body.notes);
        await userManagementService.activateUser(user_id, adminId, notes);
        res.json({ message: 'User activated successfully' });
    } catch (error) {
        logAdminError('adminActivateUser error:', error);
        return sendAdminError(res, error, 'Failed to activate user');
    }
};

export const adminResetPassword = async (req: AuthRequest, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { user_id } = getUserParams(req);
        const body = req.body as unknown as ResetPasswordBody;
        const newPassword = toQueryString(body.new_password);

        if (!newPassword) {
            return res.status(400).json({ error: 'New password is required' });
        }

        await userManagementService.resetPassword(user_id, adminId, newPassword);
        res.json({ message: 'Password reset successfully. User must change on next login.' });
    } catch (error) {
        logAdminError('adminResetPassword error:', error);
        return sendAdminError(res, error, 'Failed to reset password');
    }
};

export const adminCreateUser = async (req: AuthRequest, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const body = req.body as unknown as CreateUserBody;

        const userType = toCreatableUserType(body.user_type);
        const fullName = toQueryString(body.full_name);
        const email = toQueryString(body.email);
        const phoneNumber = toQueryString(body.phone_number);
        const password = toQueryString(body.password);

        if (!userType || !fullName || !email || !phoneNumber || !password) {
            return res.status(400).json({
                error: 'user_type, full_name, email, phone_number, and password are required'
            });
        }

        const userData: CreateUserDto = {
            user_type: userType,
            full_name: fullName,
            email,
            phone_number: phoneNumber,
            password,
            garage_data: body.garage_data,
            driver_data: body.driver_data,
            staff_data: body.staff_data,
            permissions: toStringArray(body.permissions)
        };

        const user = await userManagementService.createUser(adminId, userData);
        res.status(201).json({ message: 'User created successfully', user });
    } catch (error) {
        logAdminError('adminCreateUser error:', error);
        return sendAdminError(res, error, 'Failed to create user');
    }
};
