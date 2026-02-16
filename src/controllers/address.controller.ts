import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { AddressService } from '../services/address';
import logger from '../utils/logger';

const addressService = new AddressService(pool);

interface AddressPayload {
    label?: string;
    address_text?: string;
    latitude?: number | string;
    longitude?: number | string;
    is_default?: boolean | string;
}

type TypedAuthRequest<
    Body = Record<string, never>,
    Params extends Record<string, string> = Record<string, string>
> = Omit<AuthRequest, 'body' | 'params'> & {
    body: Body;
    params: Params;
};

type AddressBodyRequest = TypedAuthRequest<AddressPayload>;
type AddressParamRequest = TypedAuthRequest<Record<string, never>, { address_id: string }>;
type AddressUpdateRequest = TypedAuthRequest<AddressPayload, { address_id: string }>;
type AddressRecord = Record<string, unknown>;

const getUserId = (req: AuthRequest): string | null => req.user?.userId ?? null;

const toOptionalNumber = (value: number | string | undefined): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
};

const toOptionalBoolean = (value: boolean | string | undefined): boolean | undefined => {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') {return true;}
        if (normalized === 'false') {return false;}
    }
    return undefined;
};

export const getAddresses = async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {return res.status(401).json({ error: 'Unauthorized' });}

    try {
        const addresses = await addressService.getAddresses(userId);
        res.json({ addresses });
    } catch (err) {
        logger.error('Get addresses error', { error: (err as Error).message });
        res.status(500).json({ error: 'Failed to fetch addresses' });
    }
};

export const addAddress = async (req: AddressBodyRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {return res.status(401).json({ error: 'Unauthorized' });}

    const { label, address_text, latitude, longitude, is_default } = req.body;
    if (!label || !address_text) {return res.status(400).json({ error: 'Label and address text are required' });}

    try {
        const address = await addressService.addAddress(userId, {
            label,
            address_text,
            latitude: toOptionalNumber(latitude),
            longitude: toOptionalNumber(longitude),
            is_default: toOptionalBoolean(is_default)
        }) as unknown as AddressRecord;
        res.status(201).json({ address });
    } catch (err) {
        logger.error('Add address error', { error: (err as Error).message });
        res.status(500).json({ error: 'Failed to add address' });
    }
};

export const updateAddress = async (req: AddressUpdateRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {return res.status(401).json({ error: 'Unauthorized' });}

    const { label, address_text, latitude, longitude, is_default } = req.body;
    if (!label || !address_text) {return res.status(400).json({ error: 'Label and address text are required' });}

    try {
        const address = await addressService.updateAddress(userId, req.params.address_id, {
            label,
            address_text,
            latitude: toOptionalNumber(latitude),
            longitude: toOptionalNumber(longitude),
            is_default: toOptionalBoolean(is_default)
        }) as unknown as AddressRecord | null;
        if (!address) {return res.status(404).json({ error: 'Address not found' });}
        res.json({ address });
    } catch (err) {
        logger.error('Update address error', { error: (err as Error).message });
        res.status(500).json({ error: 'Failed to update address' });
    }
};

export const deleteAddress = async (req: AddressParamRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {return res.status(401).json({ error: 'Unauthorized' });}

    try {
        const deleted = await addressService.deleteAddress(userId, req.params.address_id);
        if (!deleted) {return res.status(404).json({ error: 'Address not found' });}
        res.json({ message: 'Address deleted' });
    } catch (err) {
        logger.error('Delete address error', { error: (err as Error).message });
        res.status(500).json({ error: 'Failed to delete address' });
    }
};

export const setDefaultAddress = async (req: AddressParamRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {return res.status(401).json({ error: 'Unauthorized' });}

    try {
        const success = await addressService.setDefaultAddress(userId, req.params.address_id);
        if (!success) {return res.status(404).json({ error: 'Address not found' });}
        res.json({ success: true });
    } catch (err) {
        logger.error('Set default error', { error: (err as Error).message });
        res.status(500).json({ error: 'Failed to update default address' });
    }
};
