import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { createNotification } from '../services/notification.service';
import { DisputeOrderService, DISPUTE_CONFIGS } from '../services/dispute';

const disputeService = new DisputeOrderService(pool);

export const createDispute = async (req: AuthRequest, res: Response) => {
    try {
        const files = req.files as Express.Multer.File[];
        const photoUrls = files ? files.map(f => `/uploads/${f.filename}`) : [];

        const result = await disputeService.createDispute(req.user!.userId, {
            order_id: req.body.order_id,
            reason: req.body.reason,
            description: req.body.description,
            photoUrls
        });

        // Notifications
        await createNotification({ userId: result.order.garage_id, type: 'dispute_created', title: 'New Dispute ⚠️', message: `A dispute was opened for Order #${result.order.order_number}`, data: { dispute_id: result.dispute.dispute_id, order_id: req.body.order_id }, target_role: 'garage' });
        await createNotification({ userId: 'operations', type: 'dispute_created', title: 'New Dispute Opened', message: `Dispute opened for Order #${result.order.order_number}`, data: { dispute_id: result.dispute.dispute_id }, target_role: 'operations' });

        const io = (global as any).io;
        io.to(`garage_${result.order.garage_id}`).emit('dispute_created', { dispute_id: result.dispute.dispute_id, order_id: req.body.order_id, reason: req.body.reason, refund_amount: result.refundAmount });

        res.status(201).json({ message: 'Dispute submitted successfully', dispute_id: result.dispute.dispute_id, expected_refund: result.refundAmount, restocking_fee: result.restockingFee, return_shipping_by: result.config.returnShippingBy, delivery_refunded: result.config.deliveryRefund });
    } catch (err) {
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

export const getMyDisputes = async (req: AuthRequest, res: Response) => {
    try {
        const result = await disputeService.getMyDisputes(req.user!.userId, req.user!.userType, {
            page: req.query.page ? parseInt(req.query.page as string) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
            status: req.query.status as string
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getDisputeDetails = async (req: AuthRequest, res: Response) => {
    try {
        const dispute = await disputeService.getDisputeDetails(req.params.dispute_id, req.user!.userId);
        if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
        res.json({ dispute });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const garageRespondToDispute = async (req: AuthRequest, res: Response) => {
    try {
        const result = await disputeService.garageRespond(req.params.dispute_id, req.user!.userId, req.body.response_message);
        const io = (global as any).io;
        io.to(`user_${result.dispute.customer_id}`).emit('dispute_updated', { dispute_id: req.params.dispute_id, notification: 'Garage has responded to your dispute.' });
        io.to('operations').emit('dispute_needs_review', { dispute_id: req.params.dispute_id });
        res.json({ message: 'Response submitted. Customer service will review.', status: 'under_review' });
    } catch (err) {
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

export const autoResolveDisputes = async () => {
    try {
        const resolved = await disputeService.autoResolveDisputes();
        const io = (global as any).io;
        for (const dispute of resolved) {
            io.to(`user_${dispute.customer_id}`).emit('dispute_resolved', { dispute_id: dispute.dispute_id, resolution: 'refund_approved', refund_amount: dispute.refund_amount });
            io.to(`garage_${dispute.garage_id}`).emit('dispute_resolved', { dispute_id: dispute.dispute_id, resolution: 'refund_approved' });
        }
        if (resolved.length > 0) console.log(`Auto-resolved ${resolved.length} disputes`);
    } catch (err) {
        console.error('Auto-resolve disputes failed:', err);
    }
};

export const getPendingDisputesCount = async (req: AuthRequest, res: Response) => {
    try {
        const count = await disputeService.getPendingDisputesCount(req.user!.userId);
        res.json({ pending_count: count });
    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
