/**
 * QScrap Shared Type Definitions
 * 
 * Common interfaces and types used across the application.
 * Replaces unsafe `any` usage with proper type definitions.
 */

// ============================================
// ERROR HANDLING
// ============================================

/**
 * Standard application error with message
 */
export interface AppError extends Error {
    message: string;
    code?: string;
    statusCode?: number;
}

/**
 * Type guard to check if something is an Error
 */
export function isError(value: unknown): value is Error {
    return value instanceof Error;
}

/**
 * Safely extract error message from unknown catch parameter
 */
export function getErrorMessage(error: unknown): string {
    if (isError(error)) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'An unexpected error occurred';
}

// ============================================
// DATABASE QUERY RESULTS
// ============================================

/**
 * Generic database row result
 */
export interface DbRow {
    [key: string]: unknown;
}

/**
 * Common query result fields
 */
export interface QueryResult<T = DbRow> {
    rows: T[];
    rowCount: number | null;
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

/**
 * Common pagination parameters
 */
export interface PaginationParams {
    page?: string | number;
    limit?: string | number;
    offset?: string | number;
}

/**
 * Common filter parameters for list endpoints
 */
export interface ListFilterParams extends PaginationParams {
    status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    startDate?: string;
    endDate?: string;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// ============================================
// ENTITY TYPES
// ============================================

/**
 * User base type
 */
export interface UserBase {
    user_id: string;
    phone_number: string;
    user_type: 'customer' | 'garage' | 'driver' | 'operations' | 'admin' | 'staff';
    full_name?: string;
    email?: string;
    is_active: boolean;
    created_at: Date | string;
}

/**
 * Order status type
 */
export type OrderStatus =
    | 'confirmed'
    | 'preparing'
    | 'ready_for_pickup'
    | 'collected'
    | 'qc_in_progress'
    | 'qc_passed'
    | 'qc_failed'
    | 'in_transit'
    | 'out_for_delivery'
    | 'delivered'
    | 'completed'
    | 'disputed'
    | 'refunded'
    | 'cancelled_by_customer'
    | 'cancelled_by_garage';

/**
 * Request status type
 */
export type RequestStatus = 'active' | 'accepted' | 'expired' | 'cancelled_by_customer';

/**
 * Bid status type
 */
export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'withdrawn';

/**
 * Payout status type
 */
export type PayoutStatus =
    | 'pending'
    | 'awaiting_confirmation'
    | 'completed'
    | 'on_hold'
    | 'disputed'
    | 'failed';

/**
 * Part condition type
 */
export type PartCondition = 'new' | 'original' | 'aftermarket' | 'refurbished';

// ============================================
// SOCKET EVENT DATA
// ============================================

/**
 * Base socket event data
 */
export interface SocketEventData {
    notification?: string;
    [key: string]: unknown;
}

/**
 * Order event data for socket emissions
 */
export interface OrderEventData extends SocketEventData {
    order_id: string;
    order_number?: string;
}

/**
 * Payout event data for socket emissions
 */
export interface PayoutEventData extends SocketEventData {
    payout_id: string;
    order_id?: string;
    amount?: number;
}

// ============================================
// JWT & AUTH
// ============================================

/**
 * JWT payload structure
 */
export interface JwtPayload {
    userId: string;
    userType: string;
    iat?: number;
    exp?: number;
}

/**
 * Extended request with auth payload
 */
export interface AuthenticatedUser {
    userId: string;
    userType: string;
}

// ============================================
// DOCUMENT TYPES
// ============================================

/**
 * Bilingual label for invoice fields
 */
export interface BilingualLabel {
    en: string;
    ar: string;
}

/**
 * Party info (seller/buyer/garage/customer)
 */
export interface PartyInfo {
    name?: string;
    phone?: string;
    address?: string;
    cr_number?: string;
    trade_license?: string | null;
}

/**
 * Item details in document
 */
export interface DocumentItem {
    vehicle?: string;
    part_name?: string;
    part_number?: string;
    condition?: BilingualLabel | { en: string; ar: string };
    warranty_days?: number;
    warranty_expiry?: string;
}

/**
 * Pricing details in document
 */
export interface DocumentPricing {
    part_price?: number;
    subtotal?: number;
    delivery_fee?: number;
    platform_fee?: number;
    commission_rate?: number;
    commission_rate_percent?: string;
    net_payout?: number;
    vat_rate?: number;
    vat_amount?: number;
    total?: number;
}

/**
 * Document data for invoice/statement generation
 */
export interface DocumentData {
    invoice_type?: 'customer' | 'garage';
    invoice_number?: string;
    invoice_date?: string;
    order_number?: string;
    labels?: Record<string, BilingualLabel>;

    // Parties
    seller?: PartyInfo;
    buyer?: PartyInfo;
    garage?: PartyInfo;
    platform?: { name?: string; name_ar?: string };
    customer_ref?: { name?: string; order_number?: string };

    // Item and pricing
    item?: DocumentItem;
    pricing?: DocumentPricing;

    // Verification
    verification?: { code?: string; url?: string };

    // Payment
    payment?: { method?: string; status?: string };

    // Notes
    notes?: string;

    // Allow additional properties
    [key: string]: unknown;
}
