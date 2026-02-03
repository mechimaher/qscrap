import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { AddressService } from '../services/address';
import logger from '../utils/logger';

const addressService = new AddressService(pool);

export const getAddresses = async (req: AuthRequest, res: Response) => {
    try {
        const addresses = await addressService.getAddresses(req.user!.userId);
        res.json({ addresses });
    } catch (err) {
        logger.error('Get addresses error', { error: (err as Error).message });
        res.status(500).json({ error: 'Failed to fetch addresses' });
    }
};

export const addAddress = async (req: AuthRequest, res: Response) => {
    const { label, address_text, latitude, longitude, is_default } = req.body;
    if (!label || !address_text) return res.status(400).json({ error: 'Label and address text are required' });
    try {
        const address = await addressService.addAddress(req.user!.userId, { label, address_text, latitude, longitude, is_default });
        res.status(201).json({ address });
    } catch (err) {
        logger.error('Add address error', { error: (err as Error).message });
        res.status(500).json({ error: 'Failed to add address' });
    }
};

export const updateAddress = async (req: AuthRequest, res: Response) => {
    const { label, address_text, latitude, longitude, is_default } = req.body;
    if (!label || !address_text) return res.status(400).json({ error: 'Label and address text are required' });
    try {
        const address = await addressService.updateAddress(req.user!.userId, req.params.address_id, { label, address_text, latitude, longitude, is_default });
        if (!address) return res.status(404).json({ error: 'Address not found' });
        res.json({ address });
    } catch (err) {
        logger.error('Update address error', { error: (err as Error).message });
        res.status(500).json({ error: 'Failed to update address' });
    }
};

export const deleteAddress = async (req: AuthRequest, res: Response) => {
    try {
        const deleted = await addressService.deleteAddress(req.user!.userId, req.params.address_id);
        if (!deleted) return res.status(404).json({ error: 'Address not found' });
        res.json({ message: 'Address deleted' });
    } catch (err) {
        logger.error('Delete address error', { error: (err as Error).message });
        res.status(500).json({ error: 'Failed to delete address' });
    }
};

export const setDefaultAddress = async (req: AuthRequest, res: Response) => {
    try {
        const success = await addressService.setDefaultAddress(req.user!.userId, req.params.address_id);
        if (!success) return res.status(404).json({ error: 'Address not found' });
        res.json({ success: true });
    } catch (err) {
        logger.error('Set default error', { error: (err as Error).message });
        res.status(500).json({ error: 'Failed to update default address' });
    }
};
