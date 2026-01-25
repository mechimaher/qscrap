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
    // Loyalty Program Transparency
    loyalty_discounts_today: number;       // Total QAR given as discounts today
    loyalty_discounts_count_today: number; // Number of orders with discounts today
    loyalty_discounts_week: number;        // Total QAR discounts this week
    loyalty_discounts_month: number;       // Total QAR discounts this month
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
    // Financial Transparency
    part_price: number;
    delivery_fee: number;
    loyalty_discount: number;  // Amount discounted (0 if none)
    total_amount: number;      // Final amount paid by customer
    has_loyalty_discount: boolean; // Quick flag for UI badges
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
