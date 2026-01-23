/**
 * Admin Services - Type Definitions
 * DTOs and interfaces for all admin services
 */

// ============================================
// GARAGE APPROVAL TYPES
// ============================================

export interface GarageFilters {
    approval_status?: 'pending' | 'approved' | 'rejected' | 'demo' | 'all';
    search?: string;
    page?: number;
    limit?: number;
}

export interface Garage {
    garage_id: string;
    garage_name: string;
    approval_status: string;
    approval_date?: Date;
    approved_by?: string;
    demo_expires_at?: Date;
    demo_days_left?: number;
    rejection_reason?: string;
    admin_notes?: string;
    phone_number?: string;
    email?: string;
}

export interface PaginatedGarages {
    garages: Garage[];
    pagination: {
        current_page: number;
        total_pages: number;
        total: number;
        limit: number;
    };
}

export interface DemoResult {
    garage: Garage;
    expires_at: Date;
    message: string;
}

// ============================================
// SUBSCRIPTION TYPES
// ============================================

export interface SubscriptionRequest {
    request_id: string;
    garage_id: string;
    from_plan_id: number | null;
    to_plan_id: number;
    status: 'pending' | 'approved' | 'rejected';
    created_at: Date;
    garage_name?: string;
    from_plan_name?: string;
    to_plan_name?: string;
    new_fee?: number;
}

export interface Plan {
    plan_id: number;
    plan_name: string;
    monthly_fee: number;
    commission_discount: number;
    max_active_listings: number;
    features: string[];
    is_active: boolean;
    display_order: number;
}

export interface Subscription {
    subscription_id: string;
    garage_id: string;
    plan_id: number;
    status: 'active' | 'trial' | 'cancelled' | 'expired';
    billing_cycle_start: Date;
    billing_cycle_end: Date;
    is_admin_granted: boolean;
    admin_notes?: string;
}

export interface AssignPlanParams {
    months?: number;
    notes?: string;
}

export interface SpecializationData {
    supplier_type: 'dealer' | 'aftermarket' | 'general';
    specialized_brands?: string[];
    all_brands?: boolean;
}

// ============================================
// USER MANAGEMENT TYPES
// ============================================

export interface UserFilters {
    user_type?: 'customer' | 'garage' | 'driver' | 'staff' | 'admin' | 'all' | string;
    is_active?: boolean;
    is_suspended?: boolean;
    search?: string;
    role?: string;  // Staff role filter
    page?: number;
    limit?: number;
}

export interface User {
    user_id: string;
    user_type: string;
    full_name: string;
    email: string;
    phone_number: string;
    is_active: boolean;
    is_suspended: boolean;
    created_at: Date;
}

export interface UserDetail extends User {
    last_login?: Date;
    total_orders?: number;
    total_bids?: number;
    account_balance?: number;
    suspension_reason?: string;
    recent_activity?: any[];
    type_data?: any;
    activity?: any;
}

export interface PaginatedUsers {
    users: User[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface UserUpdates {
    full_name?: string;
    email?: string;
    phone_number?: string;
    is_active?: boolean;
}

export interface CreateUserDto {
    user_type: 'customer' | 'garage' | 'driver' | 'staff';
    full_name: string;
    email: string;
    phone_number: string;
    password: string;
    garage_data?: {
        garage_name: string;
        address: string;
        location_lat: number;
        location_lng: number;
        commercial_registration?: string;
    };
    driver_data?: {
        vehicle_type: string;
        vehicle_plate: string;
        vehicle_model?: string;
    };
    staff_data?: {
        role: 'operations' | 'accounting' | 'customer_service' | 'quality_control' | 'logistics' | 'hr' | 'management';
        department?: string;
        employee_id?: string;
    };
    permissions?: string[]; // deprecated - use staff_data instead
}

// ============================================
// ANALYTICS TYPES
// ============================================

export interface DashboardStats {
    // Critical metrics
    pending_approvals: number;
    pending_plan_requests: number;
    active_orders: number;
    open_disputes: number;
    monthly_revenue: number;

    // Garage metrics
    approved_garages: number;
    active_demos: number;
    expiring_soon: number;

    // User metrics
    total_staff: number;
    total_users: number;
    active_drivers: number;
    today_signups: number;
}

export interface AuditFilters {
    action_type?: string;
    target_type?: string;
    page?: number;
    limit?: number;
}

export interface AuditLog {
    log_id: string;
    admin_id: string;
    admin_name?: string;
    admin_email?: string;
    action_type: string;
    target_type: string;
    target_id: string;
    old_value?: any;
    new_value?: any;
    created_at: Date;
}

export interface PaginatedAuditLog {
    logs: AuditLog[];
    pagination: {
        current_page: number;
        total_pages: number;
        total: number;
        limit: number;
    };
}
