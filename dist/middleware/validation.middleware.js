"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.counterOfferIdParamSchema = exports.ticketIdParamSchema = exports.assignmentIdParamSchema = exports.payoutIdParamSchema = exports.disputeIdParamSchema = exports.userIdParamSchema = exports.requestIdParamSchema = exports.bidIdParamSchema = exports.orderIdParamSchema = exports.uuidParamSchema = exports.createRequestSchema = exports.processPayoutSchema = exports.createBidSchema = exports.updateOrderStatusSchema = exports.createOrderSchema = exports.registerGarageSchema = exports.registerCustomerSchema = exports.loginSchema = exports.validateParams = exports.validateQuery = exports.validate = void 0;
const zod_1 = require("zod");
const errorHandler_middleware_1 = require("./errorHandler.middleware");
/**
 * Validation Middleware Factory
 * Creates middleware that validates request body against a Zod schema
 */
const validate = (schema) => {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const details = result.error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message
            }));
            next(errorHandler_middleware_1.ApiError.validation('Validation failed', details));
        }
        else {
            next();
        }
    };
};
exports.validate = validate;
/**
 * Validate Query Parameters
 */
const validateQuery = (schema) => {
    return (req, res, next) => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            const details = result.error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message
            }));
            next(errorHandler_middleware_1.ApiError.validation('Invalid query parameters', details));
        }
        else {
            next();
        }
    };
};
exports.validateQuery = validateQuery;
/**
 * Validate URL Parameters
 */
const validateParams = (schema) => {
    return (req, res, next) => {
        const result = schema.safeParse(req.params);
        if (!result.success) {
            const details = result.error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message
            }));
            next(errorHandler_middleware_1.ApiError.validation('Invalid URL parameters', details));
        }
        else {
            next();
        }
    };
};
exports.validateParams = validateParams;
// ==========================================
// VALIDATION SCHEMAS FOR CRITICAL ENDPOINTS
// ==========================================
// Order status values
const ORDER_STATUSES = [
    'confirmed', 'preparing', 'ready_for_pickup', 'collected',
    'qc_in_progress', 'qc_passed', 'qc_failed', 'in_transit',
    'delivered', 'completed', 'cancelled_by_customer', 'cancelled_by_garage',
    'cancelled_by_ops', 'disputed', 'refunded'
];
// Part condition values  
const PART_CONDITIONS = ['new', 'used_excellent', 'used_good', 'used_fair', 'refurbished'];
// Urgency values
const URGENCY_LEVELS = ['normal', 'urgent', 'critical'];
// --- AUTH SCHEMAS ---
// Login accepts phone_number field which can be phone OR email-style identifier
exports.loginSchema = zod_1.z.object({
    phone_number: zod_1.z.string()
        .min(3, 'Identifier must be at least 3 characters')
        .max(100, 'Identifier too long'),
    password: zod_1.z.string()
        .min(4, 'Password must be at least 4 characters')
        .max(100, 'Password too long')
});
exports.registerCustomerSchema = zod_1.z.object({
    full_name: zod_1.z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name too long')
        .regex(/^[a-zA-Z\s\u0600-\u06FF]+$/, 'Name can only contain letters'),
    phone_number: zod_1.z.string()
        .min(8, 'Phone number must be at least 8 characters')
        .max(20, 'Phone number too long'),
    password: zod_1.z.string()
        .min(6, 'Password must be at least 6 characters')
        .max(100, 'Password too long')
});
exports.registerGarageSchema = zod_1.z.object({
    garage_name: zod_1.z.string()
        .min(2, 'Garage name must be at least 2 characters')
        .max(100, 'Garage name too long'),
    owner_name: zod_1.z.string()
        .min(2, 'Owner name must be at least 2 characters')
        .max(100, 'Owner name too long'),
    phone_number: zod_1.z.string()
        .min(8, 'Phone number must be at least 8 characters')
        .max(20, 'Phone number too long'),
    password: zod_1.z.string()
        .min(6, 'Password must be at least 6 characters')
        .max(100, 'Password too long'),
    address: zod_1.z.string()
        .min(5, 'Address must be at least 5 characters')
        .max(200, 'Address too long')
        .optional()
});
// --- ORDER SCHEMAS ---
exports.createOrderSchema = zod_1.z.object({
    bid_id: zod_1.z.string().uuid('Invalid bid ID format'),
    delivery_address: zod_1.z.string()
        .min(5, 'Address must be at least 5 characters')
        .max(200, 'Address too long')
        .optional(),
    address_id: zod_1.z.string().uuid('Invalid address ID').optional()
});
exports.updateOrderStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(ORDER_STATUSES).optional(),
    order_status: zod_1.z.enum(ORDER_STATUSES).optional()
}).refine(data => data.status || data.order_status, {
    message: 'Either status or order_status is required'
});
// --- BID SCHEMAS ---
exports.createBidSchema = zod_1.z.object({
    request_id: zod_1.z.string().uuid('Invalid request ID'),
    part_price: zod_1.z.number()
        .positive('Price must be positive')
        .max(100000, 'Price too high'),
    part_condition: zod_1.z.enum(PART_CONDITIONS),
    warranty_days: zod_1.z.number()
        .int('Warranty must be a whole number')
        .min(0, 'Warranty cannot be negative')
        .max(365, 'Warranty cannot exceed 1 year')
        .optional(),
    notes: zod_1.z.string().max(500, 'Notes too long').optional(),
    photo_urls: zod_1.z.array(zod_1.z.string().url('Invalid photo URL')).max(5).optional()
});
// --- PAYMENT/FINANCE SCHEMAS ---
exports.processPayoutSchema = zod_1.z.object({
    garage_id: zod_1.z.string().uuid('Invalid garage ID'),
    amount: zod_1.z.number()
        .positive('Amount must be positive')
        .max(1000000, 'Amount too high'),
    notes: zod_1.z.string().max(500, 'Notes too long').optional()
});
// --- REQUEST SCHEMAS ---
exports.createRequestSchema = zod_1.z.object({
    car_make: zod_1.z.string()
        .min(2, 'Car make must be at least 2 characters')
        .max(50, 'Car make too long'),
    car_model: zod_1.z.string()
        .min(1, 'Car model is required')
        .max(50, 'Car model too long'),
    car_year: zod_1.z.number()
        .int('Year must be a whole number')
        .min(1970, 'Year too old')
        .max(new Date().getFullYear() + 1, 'Invalid year'),
    part_category: zod_1.z.string()
        .min(1, 'Category is required')
        .max(50, 'Category too long'),
    part_description: zod_1.z.string()
        .min(10, 'Description must be at least 10 characters')
        .max(1000, 'Description too long'),
    vin_number: zod_1.z.string()
        .length(17, 'VIN must be 17 characters')
        .regex(/^[A-HJ-NPR-Z0-9]+$/i, 'Invalid VIN format')
        .optional()
        .or(zod_1.z.literal('')),
    urgency: zod_1.z.enum(URGENCY_LEVELS).optional(),
    photo_urls: zod_1.z.array(zod_1.z.string()).max(5).optional()
});
// --- UUID PARAM SCHEMAS ---
exports.uuidParamSchema = zod_1.z.object({
    id: zod_1.z.string().uuid('Invalid ID format')
});
// Specific param schemas for common routes
exports.orderIdParamSchema = zod_1.z.object({
    order_id: zod_1.z.string().uuid('Invalid order ID format')
});
exports.bidIdParamSchema = zod_1.z.object({
    bid_id: zod_1.z.string().uuid('Invalid bid ID format')
});
exports.requestIdParamSchema = zod_1.z.object({
    request_id: zod_1.z.string().uuid('Invalid request ID format')
});
exports.userIdParamSchema = zod_1.z.object({
    user_id: zod_1.z.string().uuid('Invalid user ID format')
});
exports.disputeIdParamSchema = zod_1.z.object({
    dispute_id: zod_1.z.string().uuid('Invalid dispute ID format')
});
exports.payoutIdParamSchema = zod_1.z.object({
    payout_id: zod_1.z.string().uuid('Invalid payout ID format')
});
exports.assignmentIdParamSchema = zod_1.z.object({
    assignment_id: zod_1.z.string().uuid('Invalid assignment ID format')
});
exports.ticketIdParamSchema = zod_1.z.object({
    ticket_id: zod_1.z.string().uuid('Invalid ticket ID format')
});
exports.counterOfferIdParamSchema = zod_1.z.object({
    counter_offer_id: zod_1.z.string().uuid('Invalid counter offer ID format')
});
