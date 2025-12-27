import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { ApiError } from './errorHandler.middleware';

/**
 * Validation Middleware Factory
 * Creates middleware that validates request body against a Zod schema
 */
export const validate = <T extends ZodSchema>(schema: T) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const details = result.error.issues.map((issue: any) => ({
                field: issue.path.join('.'),
                message: issue.message
            }));
            next(ApiError.validation('Validation failed', details));
        } else {
            next();
        }
    };
};

/**
 * Validate Query Parameters
 */
export const validateQuery = <T extends ZodSchema>(schema: T) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            const details = result.error.issues.map((issue: any) => ({
                field: issue.path.join('.'),
                message: issue.message
            }));
            next(ApiError.validation('Invalid query parameters', details));
        } else {
            next();
        }
    };
};

/**
 * Validate URL Parameters
 */
export const validateParams = <T extends ZodSchema>(schema: T) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.params);
        if (!result.success) {
            const details = result.error.issues.map((issue: any) => ({
                field: issue.path.join('.'),
                message: issue.message
            }));
            next(ApiError.validation('Invalid URL parameters', details));
        } else {
            next();
        }
    };
};

// ==========================================
// VALIDATION SCHEMAS FOR CRITICAL ENDPOINTS
// ==========================================

// Order status values
const ORDER_STATUSES = [
    'confirmed', 'preparing', 'ready_for_pickup', 'collected',
    'qc_in_progress', 'qc_passed', 'qc_failed', 'in_transit',
    'delivered', 'completed', 'cancelled_by_customer', 'cancelled_by_garage',
    'cancelled_by_ops', 'disputed', 'refunded'
] as const;

// Part condition values  
const PART_CONDITIONS = ['new', 'used_excellent', 'used_good', 'used_fair', 'refurbished'] as const;

// Urgency values
const URGENCY_LEVELS = ['normal', 'urgent', 'critical'] as const;

// --- AUTH SCHEMAS ---

// Login accepts phone_number field which can be phone OR email-style identifier
export const loginSchema = z.object({
    phone_number: z.string()
        .min(3, 'Identifier must be at least 3 characters')
        .max(100, 'Identifier too long'),
    password: z.string()
        .min(4, 'Password must be at least 4 characters')
        .max(100, 'Password too long')
});

export const registerCustomerSchema = z.object({
    full_name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name too long')
        .regex(/^[a-zA-Z\s\u0600-\u06FF]+$/, 'Name can only contain letters'),
    phone_number: z.string()
        .min(8, 'Phone number must be at least 8 characters')
        .max(20, 'Phone number too long'),
    password: z.string()
        .min(6, 'Password must be at least 6 characters')
        .max(100, 'Password too long')
});

export const registerGarageSchema = z.object({
    garage_name: z.string()
        .min(2, 'Garage name must be at least 2 characters')
        .max(100, 'Garage name too long'),
    owner_name: z.string()
        .min(2, 'Owner name must be at least 2 characters')
        .max(100, 'Owner name too long'),
    phone_number: z.string()
        .min(8, 'Phone number must be at least 8 characters')
        .max(20, 'Phone number too long'),
    password: z.string()
        .min(6, 'Password must be at least 6 characters')
        .max(100, 'Password too long'),
    address: z.string()
        .min(5, 'Address must be at least 5 characters')
        .max(200, 'Address too long')
        .optional()
});

// --- ORDER SCHEMAS ---

export const createOrderSchema = z.object({
    bid_id: z.string().uuid('Invalid bid ID format'),
    delivery_address: z.string()
        .min(5, 'Address must be at least 5 characters')
        .max(200, 'Address too long')
        .optional(),
    address_id: z.string().uuid('Invalid address ID').optional()
});

export const updateOrderStatusSchema = z.object({
    status: z.enum(ORDER_STATUSES).optional(),
    order_status: z.enum(ORDER_STATUSES).optional()
}).refine(data => data.status || data.order_status, {
    message: 'Either status or order_status is required'
});

// --- BID SCHEMAS ---

export const createBidSchema = z.object({
    request_id: z.string().uuid('Invalid request ID'),
    part_price: z.number()
        .positive('Price must be positive')
        .max(100000, 'Price too high'),
    part_condition: z.enum(PART_CONDITIONS),
    warranty_days: z.number()
        .int('Warranty must be a whole number')
        .min(0, 'Warranty cannot be negative')
        .max(365, 'Warranty cannot exceed 1 year')
        .optional(),
    notes: z.string().max(500, 'Notes too long').optional(),
    photo_urls: z.array(z.string().url('Invalid photo URL')).max(5).optional()
});

// --- PAYMENT/FINANCE SCHEMAS ---

export const processPayoutSchema = z.object({
    garage_id: z.string().uuid('Invalid garage ID'),
    amount: z.number()
        .positive('Amount must be positive')
        .max(1000000, 'Amount too high'),
    notes: z.string().max(500, 'Notes too long').optional()
});

// --- REQUEST SCHEMAS ---

export const createRequestSchema = z.object({
    car_make: z.string()
        .min(2, 'Car make must be at least 2 characters')
        .max(50, 'Car make too long'),
    car_model: z.string()
        .min(1, 'Car model is required')
        .max(50, 'Car model too long'),
    car_year: z.number()
        .int('Year must be a whole number')
        .min(1970, 'Year too old')
        .max(new Date().getFullYear() + 1, 'Invalid year'),
    part_category: z.string()
        .min(1, 'Category is required')
        .max(50, 'Category too long'),
    part_description: z.string()
        .min(10, 'Description must be at least 10 characters')
        .max(1000, 'Description too long'),
    vin_number: z.string()
        .length(17, 'VIN must be 17 characters')
        .regex(/^[A-HJ-NPR-Z0-9]+$/i, 'Invalid VIN format')
        .optional()
        .or(z.literal('')),
    urgency: z.enum(URGENCY_LEVELS).optional(),
    photo_urls: z.array(z.string()).max(5).optional()
});

// --- UUID PARAM SCHEMAS ---

export const uuidParamSchema = z.object({
    id: z.string().uuid('Invalid ID format')
});

// Specific param schemas for common routes
export const orderIdParamSchema = z.object({
    order_id: z.string().uuid('Invalid order ID format')
});

export const bidIdParamSchema = z.object({
    bid_id: z.string().uuid('Invalid bid ID format')
});

export const requestIdParamSchema = z.object({
    request_id: z.string().uuid('Invalid request ID format')
});

export const userIdParamSchema = z.object({
    user_id: z.string().uuid('Invalid user ID format')
});

export const disputeIdParamSchema = z.object({
    dispute_id: z.string().uuid('Invalid dispute ID format')
});

export const payoutIdParamSchema = z.object({
    payout_id: z.string().uuid('Invalid payout ID format')
});

export const assignmentIdParamSchema = z.object({
    assignment_id: z.string().uuid('Invalid assignment ID format')
});

export const ticketIdParamSchema = z.object({
    ticket_id: z.string().uuid('Invalid ticket ID format')
});

export const counterOfferIdParamSchema = z.object({
    counter_offer_id: z.string().uuid('Invalid counter offer ID format')
});
