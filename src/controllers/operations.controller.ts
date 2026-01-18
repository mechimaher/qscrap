import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { getReadPool, getWritePool } from '../config/db';
import { getErrorMessage } from '../types';
import { createNotification } from '../services/notification.service';
import { emitToUser, emitToGarage, emitToOperations } from '../utils/socketIO';
import logger from '../utils/logger';
import {
    OperationsDashboardService,
    OrderManagementService,
    DisputeService,
    UserManagementService
} from '../services/operations';

// Initialize services
const dashboardService = new OperationsDashboardService(getReadPool());
const orderService = new OrderManagementService(getWritePool());
const disputeService = new DisputeService(getWritePool());
const userService = new UserManagementService(getReadPool());

// ============================================
// DASHBOARD STATS
// ============================================

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
    try {
        const stats = await dashboardService.getDashboardStats();
        res.json({ stats });
    } catch (err) {
        logger.error('[OPERATIONS] getDashboardStats error:', { error: getErrorMessage(err) } as any);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// ORDER MANAGEMENT
// ============================================

export const getOrders = async (req: AuthRequest, res: Response) => {
    const { status, search, page, limit } = req.query;

    try {
        const result = await orderService.getOrders({
            status: status as string,
            search: search as string,
            page: page ? parseInt(page as string, 10) : undefined,
            limit: limit ? parseInt(limit as string, 10) : undefined
        });

        res.json(result);
    } catch (err) {
        logger.error('[OPERATIONS] getOrders error:', { error: getErrorMessage(err) } as any);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getOrderDetails = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;

    try {
        const result = await orderService.getOrderDetails(order_id);
        res.json(result);
    } catch (err) {
        logger.error('[OPERATIONS] getOrderDetails error:', { error: getErrorMessage(err) } as any);
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const { new_status, notes } = req.body;
    const staffId = req.user!.userId;

    try {
        const result = await orderService.updateOrderStatus(order_id, new_status, staffId, notes);

        // Invalidate dashboard stats cache
        await dashboardService.invalidateCache();

        // Notify customer and garage
        const io = (global as any).io;

        // Get order details for notifications
        const orderDetails = await orderService.getOrderDetails(order_id);
        const order = orderDetails.order;

        const customerNotification = new_status === 'completed'
            ? `✅ Order #${order.order_number} has been marked as completed by Operations.`
            : `Order #${order.order_number} status updated to ${new_status}`;

        const garageNotification = new_status === 'completed'
            ? `✅ Order #${order.order_number} completed. Payment will be processed soon.`
            : `Order #${order.order_number} status updated to ${new_status}`;

        io.to(`user_${order.customer_id}`).emit('order_status_updated', {
            order_id,
            order_number: order.order_number,
            old_status: result.old_status,
            new_status,
            garage_name: order.garage_name,
            notification: customerNotification
        });

        io.to(`garage_${order.garage_id}`).emit('order_status_updated', {
            order_id,
            order_number: order.order_number,
            old_status: result.old_status,
            new_status,
            notification: garageNotification
        });

        if (new_status === 'completed') {
            io.to('operations').emit('order_completed', {
                order_id,
                order_number: order.order_number,
                notification: `Order #${order.order_number} manually completed by Operations`
            });

            io.to('operations').emit('payout_pending', {
                order_id,
                order_number: order.order_number,
                garage_id: order.garage_id,
                payout_amount: order.garage_payout_amount,
                notification: `💰 Order #${order.order_number} complete - payout pending`
            });
        }

        res.json({
            message: 'Status updated',
            old_status: result.old_status,
            new_status: result.new_status,
            payout_created: result.payout_created
        });
    } catch (err) {
        logger.error('[OPERATIONS] updateOrderStatus error', { error: getErrorMessage(err) });
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

export const collectOrder = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const { notes } = req.body;
    const staffId = req.user!.userId;

    try {
        const result = await orderService.collectOrder(order_id, staffId, notes);

        // Invalidate dashboard stats cache
        await dashboardService.invalidateCache();

        // Get order details for notifications
        const orderDetails = await orderService.getOrderDetails(order_id);
        const order = orderDetails.order;

        // Notify customer and garage
        const io = (global as any).io;
        io.to(`user_${order.customer_id}`).emit('order_status_updated', {
            order_id,
            order_number: result.order_number,
            old_status: 'ready_for_pickup',
            new_status: 'collected',
            notification: `📦 Order #${result.order_number} has been collected and is now being inspected.`
        });

        io.to(`garage_${order.garage_id}`).emit('order_status_updated', {
            order_id,
            order_number: result.order_number,
            old_status: 'ready_for_pickup',
            new_status: 'collected',
            notification: `Order #${result.order_number} has been collected by QScrap team.`
        });

        io.to('operations').emit('order_status_updated', {
            order_id,
            order_number: result.order_number,
            old_status: 'ready_for_pickup',
            new_status: 'collected',
            notification: `Order #${result.order_number} marked as collected by Operations`
        });

        res.json({
            message: 'Order collected successfully',
            ...result
        });
    } catch (err) {
        logger.error('[OPERATIONS] collectOrder error', { error: getErrorMessage(err) });
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: 'Order not found' });
        }
        if (err instanceof Error && err.message.includes('Invalid status transition')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// DISPUTE MANAGEMENT
// ============================================

export const getDisputes = async (req: AuthRequest, res: Response) => {
    const { status, page, limit } = req.query;

    try {
        const result = await disputeService.getDisputes({
            status: status as string,
            page: page ? parseInt(page as string, 10) : undefined,
            limit: limit ? parseInt(limit as string, 10) : undefined
        });

        res.json(result);
    } catch (err) {
        logger.error('[OPERATIONS] getDisputes error:', { error: getErrorMessage(err) } as any);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getDisputeDetails = async (req: AuthRequest, res: Response) => {
    const { dispute_id } = req.params;

    try {
        const result = await disputeService.getDisputeDetails(dispute_id);
        res.json(result);
    } catch (err) {
        logger.error('[OPERATIONS] getDisputeDetails error:', { error: getErrorMessage(err) } as any);
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: 'Dispute not found' });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const resolveDispute = async (req: AuthRequest, res: Response) => {
    const { dispute_id } = req.params;
    const { resolution, refund_amount, notes } = req.body;
    const staffId = req.user!.userId;

    try {
        const result = await disputeService.resolveDispute(
            dispute_id,
            { resolution, refund_amount, notes },
            staffId
        );

        // Invalidate dashboard stats cache
        await dashboardService.invalidateCache();

        // Get dispute details for notifications
        const disputeDetails = await disputeService.getDisputeDetails(dispute_id);
        const dispute = disputeDetails.dispute;

        // Socket.IO Notifications + Persistent
        const io = (global as any).io;

        const refundMsg = resolution === 'refund_approved'
            ? `Refund of ${result.refund_amount} QAR approved. Your refund will be processed shortly.`
            : 'Dispute resolved in favor of garage';

        await createNotification({
            userId: dispute.customer_id,
            type: 'dispute_resolved',
            title: resolution === 'refund_approved' ? 'Refund Approved ✅' : 'Dispute Resolved',
            message: `Your dispute for Order #${dispute.order_number} has been resolved. ${refundMsg}`,
            data: { dispute_id, order_id: dispute.order_id, order_number: dispute.order_number, resolution, refund_amount: result.refund_amount },
            target_role: 'customer'
        });

        io.to(`user_${dispute.customer_id}`).emit('dispute_resolved', {
            dispute_id,
            order_id: dispute.order_id,
            order_number: dispute.order_number,
            resolution,
            refund_amount: result.refund_amount,
            notification: `Your dispute for Order #${dispute.order_number} has been resolved. ${refundMsg}`
        });

        const garageResolutionMsg = resolution === 'refund_approved'
            ? `Dispute for Order #${dispute.order_number} resolved. Part will be returned to your garage.`
            : `Dispute for Order #${dispute.order_number} has been resolved in your favor.`;

        await createNotification({
            userId: dispute.garage_id,
            type: 'dispute_resolved',
            title: 'Dispute Resolved ⚖️',
            message: garageResolutionMsg,
            data: { dispute_id, order_id: dispute.order_id, order_number: dispute.order_number, resolution },
            target_role: 'garage'
        });

        io.to(`garage_${dispute.garage_id}`).emit('dispute_resolved', {
            dispute_id,
            order_id: dispute.order_id,
            order_number: dispute.order_number,
            resolution,
            notification: garageResolutionMsg
        });

        io.to('operations').emit('dispute_resolved', {
            dispute_id,
            order_id: dispute.order_id,
            order_number: dispute.order_number,
            resolution,
            notification: `Dispute #${dispute.order_number} resolved by Operations`
        });

        if (resolution === 'refund_approved' && result.return_assignment) {
            io.to('operations').emit('return_assignment_created', {
                assignment_id: result.return_assignment.assignment_id,
                order_id: dispute.order_id,
                order_number: dispute.order_number,
                notification: `📦 Return pending: Order #${dispute.order_number} needs driver assignment for return to garage`
            });
        }

        res.json(result);
    } catch (err) {
        logger.error('[OPERATIONS] resolveDispute error:', { error: getErrorMessage(err) } as any);
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: 'Dispute not found' });
        }
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// USER MANAGEMENT
// ============================================

export const getUsers = async (req: AuthRequest, res: Response) => {
    const { type, search, page, limit } = req.query;

    try {
        const result = await userService.getUsers({
            type: type as 'customer' | 'garage',
            search: search as string,
            page: page ? parseInt(page as string, 10) : undefined,
            limit: limit ? parseInt(limit as string, 10) : undefined
        });

        res.json(result);
    } catch (err) {
        logger.error('[OPERATIONS] getUsers error:', { error: getErrorMessage(err) } as any);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};
