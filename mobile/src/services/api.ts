// QScrap API Service - Full Backend Integration
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import * as SecureStore from 'expo-secure-store';

// Token Storage Keys
const TOKEN_KEY = 'qscrap_token';
const USER_KEY = 'qscrap_user';

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
    part_number?: string;
    condition_required: string;
    status: string;
    bid_count: number;
    image_urls?: string[];
    delivery_address_text?: string;
    created_at: string;
    expires_at: string;
    bids?: Bid[];
}

export interface Bid {
    bid_id: string;
    garage_id: string;
    garage_name: string;
    bid_amount: number;
    warranty_days: number;
    part_condition: string;
    notes?: string;
    status: string;
    created_at: string;
    rating_average?: number;
    rating_count?: number;
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
    // Tracking fields
    delivery_lat?: number;
    delivery_lng?: number;
    vehicle_info?: string;
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

    async saveUser(user: any): Promise<void> {
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

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const token = await this.getToken();

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        };

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data;
    }

    // Auth
    async login(phone_number: string, password: string): Promise<AuthResponse> {
        const data = await this.request<AuthResponse>(API_ENDPOINTS.LOGIN, {
            method: 'POST',
            body: JSON.stringify({ phone_number, password }),
        });

        if (data.token) {
            await this.setToken(data.token);
            await this.saveUser({
                user_id: data.userId,
                user_type: data.userType,
            });
        }

        return data;
    }

    async register(full_name: string, phone_number: string, password: string): Promise<any> {
        return this.request(API_ENDPOINTS.REGISTER, {
            method: 'POST',
            body: JSON.stringify({ full_name, phone_number, password, user_type: 'customer' }),
        });
    }

    // Dashboard
    async getStats(): Promise<{ stats: Stats }> {
        return this.request(API_ENDPOINTS.STATS);
    }

    async getProfile(): Promise<any> {
        return this.request(API_ENDPOINTS.PROFILE);
    }

    // Requests
    async getMyRequests(): Promise<{ requests: Request[] }> {
        return this.request(API_ENDPOINTS.MY_REQUESTS);
    }

    async getRequestDetails(requestId: string): Promise<{ request: Request; bids: Bid[] }> {
        return this.request(`${API_ENDPOINTS.REQUESTS}/${requestId}`);
    }

    async createRequest(formData: FormData): Promise<any> {
        const token = await this.getToken();

        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.REQUESTS}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                // Don't set Content-Type for FormData
            },
            body: formData,
        });

        return response.json();
    }

    // Orders
    async getMyOrders(): Promise<{ orders: Order[] }> {
        return this.request(API_ENDPOINTS.MY_ORDERS);
    }

    async acceptBid(bidId: string, paymentMethod = 'cash'): Promise<any> {
        return this.request(API_ENDPOINTS.ACCEPT_BID(bidId), {
            method: 'POST',
            body: JSON.stringify({ payment_method: paymentMethod }),
        });
    }

    async rejectBid(bidId: string, reason?: string): Promise<any> {
        return this.request(API_ENDPOINTS.REJECT_BID(bidId), {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
    }

    async cancelRequest(requestId: string): Promise<any> {
        return this.request(API_ENDPOINTS.CANCEL_REQUEST(requestId), {
            method: 'POST',
        });
    }

    async confirmDelivery(orderId: string): Promise<any> {
        return this.request(API_ENDPOINTS.CONFIRM_DELIVERY(orderId), {
            method: 'POST',
        });
    }

    // Delivery
    async getDeliveryZones(): Promise<any> {
        return this.request(API_ENDPOINTS.ZONES);
    }

    async calculateDeliveryFee(latitude: number, longitude: number): Promise<any> {
        return this.request(API_ENDPOINTS.CALCULATE_FEE, {
            method: 'POST',
            body: JSON.stringify({ latitude, longitude }),
        });
    }

    // Chat
    async sendMessage(orderId: string, message: string, recipientId: string): Promise<any> {
        return this.request(API_ENDPOINTS.MESSAGES, {
            method: 'POST',
            body: JSON.stringify({
                order_id: orderId,
                message: message,
                recipient_id: recipientId
            }),
        });
    }

    // Addresses
    async getAddresses(): Promise<{ addresses: Address[] }> {
        return this.request(API_ENDPOINTS.ADDRESSES);
    }

    async addAddress(data: Partial<Address>): Promise<{ address: Address }> {
        return this.request(API_ENDPOINTS.ADDRESSES, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async deleteAddress(addressId: string): Promise<any> {
        return this.request(`${API_ENDPOINTS.ADDRESSES}/${addressId}`, {
            method: 'DELETE'
        });
    }

    async setDefaultAddress(addressId: string): Promise<any> {
        return this.request(`${API_ENDPOINTS.ADDRESSES}/${addressId}/default`, {
            method: 'PUT'
        });
    }

    async updateAddress(addressId: string, data: { label: string; address_text: string; latitude?: number; longitude?: number; is_default?: boolean }): Promise<any> {
        return this.request(`${API_ENDPOINTS.ADDRESSES}/${addressId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // Notifications
    async getNotifications(): Promise<{ notifications: any[] }> {
        return this.request(API_ENDPOINTS.NOTIFICATIONS);
    }

    async markNotificationRead(notificationId: string): Promise<any> {
        return this.request(API_ENDPOINTS.MARK_NOTIFICATION_READ(notificationId), {
            method: 'POST'
        });
    }

    async markAllNotificationsRead(): Promise<any> {
        return this.request(API_ENDPOINTS.MARK_ALL_NOTIFICATIONS_READ, {
            method: 'POST'
        });
    }

    // Profile Updates
    async updateProfile(data: { full_name?: string; email?: string; phone_number?: string }): Promise<any> {
        return this.request(API_ENDPOINTS.UPDATE_PROFILE, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async changePassword(currentPassword: string, newPassword: string): Promise<any> {
        return this.request(API_ENDPOINTS.CHANGE_PASSWORD, {
            method: 'POST',
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
        });
    }

    // Support Tickets
    async getTickets(): Promise<{ tickets: any[] }> {
        return this.request(API_ENDPOINTS.TICKETS);
    }

    async createTicket(subject: string, message: string, category = 'general'): Promise<any> {
        return this.request(API_ENDPOINTS.TICKETS, {
            method: 'POST',
            body: JSON.stringify({ subject, message, category })
        });
    }

    async getTicketDetail(ticketId: string): Promise<any> {
        return this.request(API_ENDPOINTS.TICKET_DETAIL(ticketId));
    }

    async sendTicketMessage(ticketId: string, message: string): Promise<any> {
        return this.request(API_ENDPOINTS.TICKET_MESSAGES(ticketId), {
            method: 'POST',
            body: JSON.stringify({ message })
        });
    }

    // Reviews
    async submitReview(orderId: string, rating: number, review: string): Promise<any> {
        return this.request(API_ENDPOINTS.SUBMIT_REVIEW(orderId), {
            method: 'POST',
            body: JSON.stringify({ rating, review })
        });
    }

    // Account Deletion
    async deleteAccount(): Promise<any> {
        return this.request(API_ENDPOINTS.DELETE_ACCOUNT, {
            method: 'DELETE'
        });
    }
}

export const api = new ApiService();
