export interface User {
    user_id: string;
    full_name: string;
    phone_number: string;
    email?: string;
    user_type: 'customer';
}

export interface AuthResponse {
    token: string;
    refreshToken?: string;
    userId: string;
    userType: string;
    user?: User;
}

export interface Request {
    request_id: string;
    car_make: string;
    car_model: string;
    car_year: number;
    vin_number?: string;
    part_description: string;
    part_category?: string;
    part_number?: string;
    condition_required: string;
    status: string;
    bid_count: number;
    image_urls?: string[];
    delivery_address_text?: string;
    delivery_lat?: string;
    delivery_lng?: string;
    created_at: string;
    expires_at: string;
    lowest_bid_price?: number;
    bids?: Bid[];
}

export interface Bid {
    bid_id: string;
    garage_id: string;
    garage_name: string;
    garage_photo_url?: string;
    bid_amount: number | string;
    part_condition: string;
    warranty_days: number;
    delivery_days: number;
    notes?: string;
    bid_status: string;
    created_at: string;
    rating_average?: number;
    rating_count?: number;
    image_urls?: string[];
    condition_photos?: string[];
    customer_counter_amount?: number;
    customer_counter_status?: string;
    garage_counter_amount?: number;
    garage_counter_status?: string;
    negotiation_id?: string;
    customer_counter_id?: string;
    garage_counter_id?: string;
    plan_code?: string;
    version_number?: number;
    superseded_by?: string;
    supersedes_bid_id?: string;
}

export interface Order {
    order_id: string;
    order_number: string;
    garage_name: string;
    part_name: string;
    car_make: string;
    car_model: string;
    car_year: number;
    part_price: number;
    delivery_fee: number;
    total_amount: number;
    order_status: string;
    payment_status: string;
    delivery_address?: string;
    created_at: string;
    driver_name?: string;
    driver_phone?: string;
    driver_id?: string;
    delivery_lat?: number;
    delivery_lng?: number;
    driver_lat?: number;
    driver_lng?: number;
    vehicle_info?: string;
    part_description?: string;
    part_category?: string;
    part_subcategory?: string;
    pod_photo_url?: string;
    bid_id?: string;
    loyalty_discount?: number;
    vehicle_plate?: string;
    vehicle_type?: string;
    part_condition?: string;
    warranty_days?: number;
}

export interface Stats {
    active_requests: number;
    total_orders: number;
    pending_deliveries: number;
    completed_orders: number;
    awaiting_confirmation?: number;
}

export interface Address {
    address_id: string;
    label: string;
    address_text: string;
    latitude?: number;
    longitude?: number;
    is_default: boolean;
}

export interface Product {
    product_id: string;
    garage_id: string;
    garage_name: string;
    title: string;
    description: string;
    price: number;
    condition: string;
    image_urls: string[];
    is_featured: boolean;
    plan_code: string;
    view_count: number;
}

export interface Notification {
    notification_id: string;
    user_id: string;
    title: string;
    body: string;
    message?: string;
    type: string;
    data?: Record<string, string>;
    is_read: boolean;
    created_at: string;
    related_id?: string;
}

export interface SupportTicket {
    ticket_id: string;
    subject: string;
    message: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    priority: 'low' | 'medium' | 'high';
    created_at: string;
    updated_at: string;
    replies?: Array<{
            reply_id: string;
            message: string;
            sender_type: 'customer' | 'support';
            created_at: string;
        }>;
}

export interface Vehicle {
    vehicle_id: string;
    make?: string;
    model?: string;
    car_make: string;
    car_model: string;
    car_year: number;
    year?: number;
    vin_number?: string;
    plate_number?: string;
    nickname?: string;
    color?: string;
    is_default?: boolean;
    is_primary?: boolean;
    front_image_url?: string;
    rear_image_url?: string;
    request_count?: number;
    last_used_at?: string;
    created_at?: string;
}

export interface LoyaltyTransaction {
    transaction_id: string;
    type: 'earned' | 'redeemed' | 'expired' | 'adjustment';
    points: number;
    description: string;
    order_id?: string;
    created_at: string;
}

export interface PaymentMethod {
    method_id: string;
    type: 'card' | 'apple_pay' | 'google_pay';
    last4?: string;
    brand?: string;
    exp_month?: number;
    exp_year?: number;
    is_default: boolean;
}

export interface UrgentAction {
    action_id: string;
    type: string;
    title: string;
    description: string;
    order_id?: string;
    request_id?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    created_at: string;
}
