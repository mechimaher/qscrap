import { apiClient } from "./apiClient";
import { authService } from "./auth.service";
import { dashboardService } from "./dashboard.service";
import { requestService } from "./request.service";
import { orderService } from "./order.service";
import { deliveryService } from "./delivery.service";
import { chatService } from "./chat.service";
import { addressService } from "./address.service";
import { notificationService } from "./notification.service";
import { supportService } from "./support.service";
import { escrowService } from "./escrow.service";
import { loyaltyService } from "./loyalty.service";
import { paymentService } from "./payment.service";
import { vehicleService } from "./vehicle.service";

export * from "./types";
export * from "./apiClient";

<<<<<<< HEAD:mobile/src/services/api.ts
// Backward compatible API facade
export const api = new Proxy({}, {
    get(target, prop) {
        const services = [apiClient, authService, dashboardService, requestService, orderService, deliveryService, chatService, addressService, notificationService, supportService, escrowService, loyaltyService, paymentService, vehicleService];
        for (const service of services) {
            if (prop in service && typeof (service as any)[prop] === 'function') {
                return (service as any)[prop].bind(service);
            }
=======
// Types
export interface User {
    user_id: string;
    full_name: string;
    phone_number: string;
    email?: string;
    user_type: 'customer';
}

export interface AuthResponse {
    token: string;
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
    lowest_bid_price?: number;  // Best offer price for display
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
    // Flag workflow fields
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
    // Tracking fields
    delivery_lat?: number;
    delivery_lng?: number;
    driver_lat?: number;
    driver_lng?: number;
    vehicle_info?: string;
    part_description?: string;
    part_category?: string;
    part_subcategory?: string;
    // Additional fields for payment/delivery
    pod_photo_url?: string;  // Proof of delivery photo
    bid_id?: string;         // Original bid reference for payment resume
    loyalty_discount?: number; // Discount from loyalty points
    // Tracking / vehicle fields
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
    awaiting_confirmation?: number; // Delivered orders pending customer confirmation
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

// API Helper
class ApiService {
    private token: string | null = null;

    async getToken(): Promise<string | null> {
        if (this.token) return this.token;
        try {
            this.token = await SecureStore.getItemAsync(TOKEN_KEY);
            return this.token;
        } catch {
            return null;
        }
    }

    async setToken(token: string): Promise<void> {
        this.token = token;
        await SecureStore.setItemAsync(TOKEN_KEY, token);
    }

    async clearToken(): Promise<void> {
        this.token = null;
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(USER_KEY);
    }

    async saveUser(user: User): Promise<void> {
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    }

    async getUser(): Promise<User | null> {
        try {
            const userData = await SecureStore.getItemAsync(USER_KEY);
            return userData ? JSON.parse(userData) : null;
        } catch {
            return null;
        }
    }

    public async request<T>(
        endpoint: string,
        options: RequestInit = {},
        retryCount = 0
    ): Promise<T> {
        const token = await this.getToken();

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Handle 401 Unauthorized - Centralized Sentinel
            if (response.status === 401) {
                warn('[API] Unauthorized (401) detected. Clearing session.');
                await this.clearToken();
                // We throw a specific error that the UI/Navigation can catch to redirect to Login
                throw new Error('UNAUTHORIZED_EXPIRED');
            }

            let data: any;
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                logError('[API] Non-JSON response:', text.substring(0, 200));
                throw new Error('Server returned invalid response. Please try again later.');
            }

            if (!response.ok) {
                let errorMessage = 'Request failed';
                if (typeof data.error === 'string') {
                    errorMessage = data.error;
                } else if (typeof data.error?.message === 'string') {
                    errorMessage = data.error.message;
                } else if (typeof data.message === 'string') {
                    errorMessage = data.message;
                }
                throw new Error(errorMessage);
            }

            return data;
        } catch (error: any) {
            clearTimeout(timeoutId);

            // Transience Shield: Retry GET requests on network failure (max 2 retries)
            const isGetRequest = !options.method || options.method.toUpperCase() === 'GET';
            const isNetworkError = error.name === 'TypeError' || error.message?.includes('network');
            
            if (isGetRequest && isNetworkError && retryCount < 2) {
                const delay = 1000 * (retryCount + 1);
                warn(`[API] Network error. Retrying ${endpoint} (${retryCount + 1}/2) in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.request<T>(endpoint, options, retryCount + 1);
            }

            if (error.name === 'AbortError') {
                throw new Error('Request timed out. Please check your connection and try again.');
            }
            if (error.message?.includes('JSON')) {
                throw new Error('Invalid server response. Please check your connection and try again.');
            }
            throw error;
>>>>>>> 06c3dc41 (feat(enterprise): surgical audit & hardening v3.0 - GOLD CERTIFIED):customer-mobile/src/services/api.ts
        }
        return undefined;
    }
}) as any;
