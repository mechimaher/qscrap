/**
 * Repair Controller - Refactored
 */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { getReadPool, getWritePool } from '../config/db';
import { RepairService } from '../services/repair';

const repairService = new RepairService(getWritePool());

export const createRepairRequest = async (req: AuthRequest, res: Response) => {
    try {
        const request = await repairService.createRepairRequest(req.user!.userId, req.body);
        res.status(201).json({ request });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getMyRepairRequests = async (req: AuthRequest, res: Response) => {
    try {
        const requests = await repairService.getMyRepairRequests(req.user!.userId, req.query.status as string);
        res.json({ requests });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getRepairRequestDetails = async (req: AuthRequest, res: Response) => {
    try {
        const request = await repairService.getRepairRequestDetails(req.params.request_id);
        res.json({ request });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const acceptRepairBid = async (req: AuthRequest, res: Response) => {
    try {
        const booking = await repairService.acceptRepairBid(req.user!.userId, req.params.bid_id, req.body.booking_date);
        res.json({ booking });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};

export const getMyRepairBookings = async (req: AuthRequest, res: Response) => {
    try {
        const bookings = await repairService.getMyRepairBookings(req.user!.userId);
        res.json({ bookings });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getActiveRepairRequests = async (req: AuthRequest, res: Response) => {
    try {
        const requests = await repairService.getActiveRepairRequests(req.user!.userId);
        res.json({ requests });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const submitRepairBid = async (req: AuthRequest, res: Response) => {
    try {
        const { price, notes } = req.body;
        const bid = await repairService.submitRepairBid(req.user!.userId, req.params.request_id, price, notes);
        res.status(201).json({ bid });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getMyRepairBids = async (req: AuthRequest, res: Response) => {
    try {
        const bids = await repairService.getMyRepairBids(req.user!.userId);
        res.json({ bids });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getWorkshopBookings = async (req: AuthRequest, res: Response) => {
    try {
        const bookings = await repairService.getWorkshopBookings(req.user!.userId);
        res.json({ bookings });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const updateBookingStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { status, notes } = req.body;
        const booking = await repairService.updateBookingStatus(req.user!.userId, req.params.booking_id, status, notes);
        res.json({ booking });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};
