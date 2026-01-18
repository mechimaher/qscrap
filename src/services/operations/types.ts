/**
 * Operations Service Types
 */

export interface DashboardStats {
    active_orders: number;
    orders_today: number;
    pending_disputes: number;
    contested_disputes: number;
    in_transit: number;
    awaiting_confirmation: number;
    ready_for_pickup: number;
    revenue_today: number;
    pending_requests: number;
    total_customers: number;
    total_garages: number;
}

export interface OrderFilters {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export interface OrderWithDetails {
    order_id: string;
    order_number: string;
    order_status: string;
    car_make: string;
    car_model: string;
    car_year: string;
    part_description: string;
    customer_name: string;
    customer_phone: string;
    garage_name: string;
    garage_phone: string;
    created_at: Date;
    [key: string]: any;
}

export interface DisputeFilters {
    status?: string;
    page?: number;
    limit?: number;
}

export interface DisputeResolution {
    resolution: 'refund_approved' | 'dispute_rejected';
    refund_amount?: number;
    notes?: string;
}

export interface UserFilters {
    type?: 'customer' | 'garage';
    search?: string;
    page?: number;
    limit?: number;
}

export interface PaginationMetadata {
    page: number;
    limit: number;
    total: number;
    pages: number;
}
