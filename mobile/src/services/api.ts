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

    public async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const token = await this.getToken();

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        };

        // Add timeout to prevent infinite hangs on stalled connections
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Try to parse JSON response
            let data: any;
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                // Non-JSON response (likely HTML error page or plain text)
                const text = await response.text();
                console.error('[API] Non-JSON response:', text.substring(0, 200));
                throw new Error('Server returned invalid response. Please try again later.');
            }

            if (!response.ok) {
                // Properly extract error message from various response formats
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
            // Handle timeout (AbortError)
            if (error.name === 'AbortError') {
                throw new Error('Request timed out. Please check your connection and try again.');
            }
            // Handle JSON parse errors explicitly
            if (error.message?.includes('JSON')) {
                throw new Error('Invalid server response. Please check your connection and try again.');
            }
            throw error;
        }
    }

    // Auth
    async login(phone_number: string, password: string): Promise<AuthResponse> {
        const data = await this.request<AuthResponse>(API_ENDPOINTS.LOGIN, {
            method: 'POST',
            body: JSON.stringify({ phone_number, password }),
        });

        if (data.token) {
            await this.setToken(data.token);

            // If user data is provided in login response, save it directly
            // including the critical userId and userType from the response root
            const userToSave = data.user ? {
                ...data.user,
                user_id: data.userId, // Ensure root userId takes precedence or matches
                user_type: data.userType
            } : {
                user_id: data.userId,
                user_type: data.userType,
            };

            await this.saveUser(userToSave);
        }

        return data;
    }

    async register(full_name: string, phone_number: string, password: string): Promise<any> {
        return this.request(API_ENDPOINTS.REGISTER, {
            method: 'POST',
            body: JSON.stringify({ full_name, phone_number, password, user_type: 'customer' }),
        });
    }

    // Email OTP Registration (NEW)
    async registerWithEmail(data: {
        full_name: string;
        email: string;
        phone_number: string;
        password: string;
    }): Promise<{ success: boolean; message: string; email: string; expiresIn: number }> {
        return this.request('/auth/register-with-email', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async verifyEmailOTP(data: {
        email: string;
        otp: string;
        full_name: string;
        phone_number: string;
        password: string;
    }): Promise<AuthResponse & { success: boolean; emailVerified: boolean }> {
        const response = await this.request<AuthResponse & { success: boolean; emailVerified: boolean }>(
            '/auth/verify-email-otp',
            {
                method: 'POST',
                body: JSON.stringify(data),
            }
        );

        // Auto-login after successful verification
        if (response.token) {
            await this.setToken(response.token);
            await this.saveUser({
                user_id: response.userId,
                user_type: response.userType,
                full_name: data.full_name,
                email: data.email,
                phone_number: data.phone_number,
            });
        }

        return response;
    }

    async resendOTP(email: string, full_name?: string): Promise<{ success: boolean; message: string; expiresIn: number }> {
        return this.request('/auth/resend-otp', {
            method: 'POST',
            body: JSON.stringify({ email, full_name }),
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

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.REQUESTS}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    // Don't set Content-Type for FormData - browser sets it with boundary
                },
                body: formData,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create request');
            }

            return data;
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timed out. Please check your connection and try again.');
            }
            throw error;
        }
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

    async deleteRequest(requestId: string): Promise<any> {
        return this.request(API_ENDPOINTS.DELETE_REQUEST(requestId), {
            method: 'DELETE',
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

    async clearAllNotifications(): Promise<any> {
        return this.request('/dashboard/notifications', {
            method: 'DELETE'
        });
    }

    async deleteNotification(notificationId: string): Promise<any> {
        return this.request(`/dashboard/notifications/${notificationId}`, {
            method: 'DELETE'
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
    async submitReview(orderId: string, reviewData: {
        overall_rating: number;
        part_quality_rating?: number;
        communication_rating?: number;
        delivery_rating?: number;
        review_text?: string;
    }): Promise<any> {
        return this.request(API_ENDPOINTS.SUBMIT_REVIEW(orderId), {
            method: 'POST',
            body: JSON.stringify(reviewData)
        });
    }

    // Account Deletion Eligibility Check
    async checkDeletionEligibility(): Promise<{
        canDelete: boolean;
        blockers: Array<{
            type: string;
            count: number;
            message: string;
            action: string;
        }>;
    }> {
        return this.request(API_ENDPOINTS.DELETION_ELIGIBILITY);
    }

    // Account Deletion
    async deleteAccount(): Promise<any> {
        return this.request(API_ENDPOINTS.DELETE_ACCOUNT, {
            method: 'DELETE'
        });
    }

    // Catalog - Featured Products
    async getFeaturedProducts(limit: number = 6): Promise<{ products: Product[] }> {
        return this.request(`${API_ENDPOINTS.CATALOG_SEARCH}?limit=${limit}`);
    }

    // Notifications
    async registerPushToken(token: string, platform: 'ios' | 'android'): Promise<any> {
        return this.request(API_ENDPOINTS.NOTIFICATIONS_REGISTER, {
            method: 'POST',
            body: JSON.stringify({ token, platform, device_id: 'unknown' })
        });
    }


    // VIN OCR - Server-side text recognition
    async ocrVIN(imageBase64: string): Promise<{ vin: string | null; confidence: number; raw_text?: string }> {
        try {
            const response = await this.request<{ vin: string | null; confidence: number; raw_text?: string }>(
                '/ocr/vin/base64',
                {
                    method: 'POST',
                    body: JSON.stringify({ image: imageBase64 })
                }
            );
            return response;
        } catch (error) {
            console.log('[API] OCR VIN error:', error);
            // Return empty result on error - scanner will handle gracefully
            return { vin: null, confidence: 0 };
        }
    }

    async getOrders() {
        const response = await this.request<any>('/orders');
        return response.data;
    }

    async getOrderCount(): Promise<{ total: number }> {
        const response = await this.request<any>('/orders/count');
        return response.data;
    }

    // Cancellation
    async getCancellationPreview(orderId: string): Promise<any> {
        return this.request(`/orders/${orderId}/cancel-preview`);
    }

    async cancelOrder(orderId: string, reason: string): Promise<any> {
        return this.request(API_ENDPOINTS.CANCEL_ORDER(orderId), {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
    }

    // Order Details (single order)
    async getOrderDetails(orderId: string): Promise<any> {
        return this.request(`/orders/${orderId}`);
    }

    // Disputes
    async createDispute(formData: FormData): Promise<any> {
        const token = await this.getToken();
        const response = await fetch(`${API_BASE_URL}/disputes`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: formData,
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to create dispute');
        }
        return data;
    }

    // ============================================
    // ESCROW - Buyer Protection
    // ============================================
    async getEscrowStatus(orderId: string): Promise<{
        escrow_id: string;
        status: 'held' | 'released' | 'refunded' | 'disputed';
        amount: number;
        inspection_expires_at: string;
        buyer_confirmed_at?: string;
    }> {
        return this.request(`/escrow/order/${orderId}`);
    }

    async confirmEscrowReceipt(escrowId: string, photos: string[]): Promise<any> {
        return this.request(`/escrow/${escrowId}/confirm`, {
            method: 'POST',
            body: JSON.stringify({
                photos,
                notes: 'Buyer confirmed receipt'
            })
        });
    }

    async raiseEscrowDispute(escrowId: string, reason: string, photos?: string[]): Promise<any> {
        return this.request(`/escrow/${escrowId}/dispute`, {
            method: 'POST',
            body: JSON.stringify({ reason, photos })
        });
    }

    async uploadProofOfCondition(escrowId: string, orderId: string, photos: string[], captureType: string): Promise<any> {
        return this.request(`/escrow/${escrowId}/proof`, {
            method: 'POST',
            body: JSON.stringify({
                order_id: orderId,
                capture_type: captureType,
                image_urls: photos
            })
        });
    }

    // ============================================
    // LOYALTY - Points & Rewards
    // ============================================
    async getLoyaltyBalance(): Promise<{
        points: number;
        tier: 'bronze' | 'silver' | 'gold' | 'platinum';
        lifetime_points: number;
        points_to_next_tier: number;
    }> {
        return this.request('/loyalty/balance');
    }

    async getLoyaltyHistory(): Promise<{ transactions: any[] }> {
        return this.request('/loyalty/history');
    }

    async redeemPoints(points: number, orderId?: string): Promise<{
        success: boolean;
        discount_amount: number;
        remaining_points: number;
    }> {
        return this.request('/loyalty/redeem', {
            method: 'POST',
            body: JSON.stringify({ points, order_id: orderId })
        });
    }

    // ============================================
    // PAYMENTS - Digital Processing
    // ============================================
    async processPayment(paymentData: {
        order_id: string;
        amount: number;
        card_number: string;
        expiry_month: string;
        expiry_year: string;
        cvv: string;
        cardholder_name: string;
    }): Promise<{
        success: boolean;
        transaction_id: string;
        receipt_url?: string;
    }> {
        return this.request('/payments/process', {
            method: 'POST',
            body: JSON.stringify(paymentData)
        });
    }

    async getTestCards(): Promise<{ cards: any[] }> {
        return this.request('/payments/test-cards');
    }

    async getPaymentMethods(): Promise<{ methods: any[] }> {
        return this.request('/payments/methods');
    }

    // Stripe Delivery Fee Payment
    async createDeliveryFeeIntent(orderId: string): Promise<{
        success: boolean;
        intent: {
            id: string;
            clientSecret: string;
            amount: number;
            currency: string;
        };
    }> {
        return this.request(`/payments/deposit/${orderId}`, {
            method: 'POST',
        });
    }

    // Confirm delivery fee payment - updates order from pending_payment to confirmed
    async confirmDeliveryFeePayment(intentId: string): Promise<{ success: boolean; message: string }> {
        return this.request(`/payments/deposit/confirm/${intentId}`, {
            method: 'POST',
        });
    }

    // Stripe Full Payment (Part + Delivery Fee) - Scenario B
    async createFullPaymentIntent(orderId: string, loyaltyDiscount?: number): Promise<{
        success: boolean;
        intent: {
            id: string;
            clientSecret: string;
            amount: number;
            currency: string;
        };
        breakdown: {
            partPrice: number;
            deliveryFee: number;
            loyaltyDiscount?: number;
            originalTotal?: number;
            total: number;
        };
    }> {
        return this.request(`/payments/full/${orderId}`, {
            method: 'POST',
            body: JSON.stringify({ loyaltyDiscount: loyaltyDiscount || 0 }),
        });
    }

    // Confirm FREE order (when loyalty discount covers entire amount)
    async confirmFreeOrder(orderId: string, loyaltyDiscount: number): Promise<{
        success: boolean;
        message: string;
        order_id: string;
    }> {
        return this.request(`/payments/free/${orderId}`, {
            method: 'POST',
            body: JSON.stringify({ loyaltyDiscount }),
        });
    }

    // ============================================
    // DASHBOARD - Smart HomeScreen
    // ============================================
    async getUrgentActions(): Promise<{ urgent_actions: any[]; count: number }> {
        return this.request('/v1/dashboard/customer/urgent-actions');
    }

    async getContextualData(): Promise<{
        unread_bids: number;
        active_services: number;
        money_saved_this_month: number;
        loyalty_points: number;
        orders_this_month: number;
    }> {
        return this.request('/v1/dashboard/customer/contextual-data');
    }

    // ============================================
    // VEHICLES - Family Fleet
    // ============================================
    async getMyVehicles(): Promise<{ vehicles: any[] }> {
        return this.request('/vehicles');
    }

    async addVehicle(vehicleData: {
        car_make: string;
        car_model: string;
        car_year: number;
        vin_number?: string;
        nickname?: string;
    }): Promise<any> {
        return this.request('/vehicles', {
            method: 'POST',
            body: JSON.stringify(vehicleData)
        });
    }

    async deleteVehicle(vehicleId: string): Promise<any> {
        return this.request(`/vehicles/${vehicleId}`, {
            method: 'DELETE'
        });
    }

    async updateVehicle(vehicleId: string, data: { nickname?: string; is_primary?: boolean; vin_number?: string }): Promise<any> {
        return this.request(`/vehicles/${vehicleId}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    // ============================================
    // RETURN REQUESTS (7-Day Window) - BRAIN v3.0
    // ============================================
    async getReturnPreview(orderId: string): Promise<{
        order_id: string;
        can_return: boolean;
        return_fee: number;
        delivery_fee_retained: number;
        refund_amount: number;
        days_remaining: number;
        reason?: string;
    }> {
        return this.request(`/cancellations/orders/${orderId}/return-preview`);
    }

    async createReturnRequest(orderId: string, data: {
        reason: 'unused' | 'defective' | 'wrong_part';
        photo_urls: string[];
        condition_description?: string;
    }): Promise<{
        success: boolean;
        return_id?: string;
        refund_amount?: number;
        message: string;
    }> {
        return this.request(`/cancellations/orders/${orderId}/return`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getCustomerAbuseStatus(): Promise<{
        returns_this_month: number;
        returns_remaining: number;
        defective_claims_this_month: number;
        defective_claims_remaining: number;
        flag_level: 'none' | 'yellow' | 'orange' | 'red' | 'black';
        can_make_return: boolean;
        can_make_defective_claim: boolean;
    }> {
        return this.request('/cancellations/abuse-status');
    }

}

export const api = new ApiService();
