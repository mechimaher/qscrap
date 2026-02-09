// QScrap Driver App - API Service
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
export { API_ENDPOINTS };
import * as SecureStore from 'expo-secure-store';


// Token Storage Keys
const TOKEN_KEY = 'qscrap_driver_token';
const USER_KEY = 'qscrap_driver_user';

// Types
export interface Driver {
    driver_id: string;
    user_id: string;
    full_name: string;
    phone: string;
    email?: string;
    vehicle_type: string;
    vehicle_model?: string;
    vehicle_plate: string;
    status: 'available' | 'busy' | 'offline';
    total_deliveries: number;
    rating_average: number;
    total_earnings?: number;
    bank_name?: string;
    bank_account_iban?: string;
    bank_account_name?: string;
}

export interface Assignment {
    assignment_id: string;
    order_id: string;
    order_number: string;
    assignment_type: 'collection' | 'delivery' | 'return_to_garage';
    status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';

    // Locations
    pickup_address: string;
    pickup_lat?: number;
    pickup_lng?: number;
    delivery_address: string;
    delivery_lat?: number;
    delivery_lng?: number;

    // Order details
    part_description: string;
    part_category?: string;
    part_subcategory?: string;
    car_make?: string;
    car_model?: string;
    car_year?: string;
    garage_name: string;
    garage_phone?: string;
    customer_name: string;
    customer_phone?: string;

    // Payment Info
    total_amount?: number;
    part_price?: number;
    delivery_fee?: number;
    loyalty_discount?: number;
    payment_method?: 'cod' | 'card' | 'wallet' | 'cash' | 'card_full';

    // Timing
    created_at: string;
    estimated_pickup?: string;
    estimated_delivery?: string;
    pickup_at?: string;
    delivered_at?: string;

    // Proof
    delivery_photo_url?: string;
    signature_url?: string;
    driver_notes?: string;
}

export interface DriverStats {
    today_deliveries: number;
    today_earnings: number;
    week_deliveries: number;
    week_earnings: number;
    total_deliveries: number;
    total_earnings: number;
    rating_average: number;
    rating_count: number;
    active_assignments: number;
}

export interface AuthResponse {
    token: string;
    userId: string;
    userType: string;
    driver?: Driver;
}

export interface Wallet {
    wallet_id: string;
    balance: number;
    total_earned: number;
    cash_collected: number;
    last_updated: string;
}

export interface WalletTransaction {
    transaction_id: string;
    amount: number;
    type: 'earning' | 'cash_collection' | 'payout' | 'adjustment' | 'bonus';
    reference_id?: string;
    description?: string;
    created_at: string;
}

// API Service
class DriverApiService {
    private token: string | null = null;

    // Timeout wrapper to prevent SecureStore from hanging indefinitely
    private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                console.warn(`[API] SecureStore operation timed out after ${timeoutMs}ms, using fallback`);
                resolve(fallback);
            }, timeoutMs);

            promise
                .then((result) => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch((error) => {
                    clearTimeout(timer);
                    console.warn('[API] SecureStore error:', error);
                    resolve(fallback);
                });
        });
    }

    async getToken(): Promise<string | null> {
        if (this.token) {
            console.log('[API] Using cached token');
            return this.token;
        }
        try {
            console.log('[API] Fetching token from SecureStore...');
            this.token = await this.withTimeout(
                SecureStore.getItemAsync(TOKEN_KEY),
                5000, // 5 second timeout
                null
            );
            console.log('[API] Token retrieved:', this.token ? 'exists' : 'null');
            return this.token;
        } catch (error) {
            console.error('[API] getToken error:', error);
            return null;
        }
    }

    async setToken(token: string): Promise<void> {
        console.log('[API] Setting token (in-memory)...');
        this.token = token; // Set in-memory immediately

        console.log('[API] Persisting token to SecureStore...');
        try {
            await this.withTimeout(
                SecureStore.setItemAsync(TOKEN_KEY, token),
                5000, // 5 second timeout
                undefined
            );
            console.log('[API] Token persisted successfully');
        } catch (error) {
            console.warn('[API] Failed to persist token, continuing with in-memory only:', error);
        }
    }

    async clearToken(): Promise<void> {
        console.log('[API] Clearing tokens...');
        this.token = null;
        try {
            await this.withTimeout(SecureStore.deleteItemAsync(TOKEN_KEY), 5000, undefined);
            await this.withTimeout(SecureStore.deleteItemAsync(USER_KEY), 5000, undefined);
            console.log('[API] Tokens cleared');
        } catch (error) {
            console.warn('[API] Error clearing tokens:', error);
        }
    }

    async saveDriver(driver: Driver): Promise<void> {
        console.log('[API] Saving driver data...');
        try {
            await this.withTimeout(
                SecureStore.setItemAsync(USER_KEY, JSON.stringify(driver)),
                5000,
                undefined
            );
            console.log('[API] Driver data saved');
        } catch (error) {
            console.warn('[API] Failed to save driver data:', error);
        }
    }

    async getDriver(): Promise<Driver | null> {
        try {
            console.log('[API] Fetching driver from SecureStore...');
            const driverData = await this.withTimeout(
                SecureStore.getItemAsync(USER_KEY),
                5000,
                null
            );
            const driver = driverData ? JSON.parse(driverData) : null;
            console.log('[API] Driver retrieved:', driver?.full_name || 'null');
            return driver;
        } catch (error) {
            console.error('[API] getDriver error:', error);
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

        const url = `${API_BASE_URL}${endpoint}`;
        console.log('[API] Request:', options.method || 'GET', url);

        // Add timeout to prevent infinite hangs on stalled connections
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        let response: Response;
        try {
            response = await fetch(url, {
                ...options,
                headers,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
        } catch (networkError: any) {
            clearTimeout(timeoutId);
            if (networkError.name === 'AbortError') {
                console.error('[API] Request timed out');
                throw new Error('Request timed out - please check your connection');
            }
            console.error('[API] Network error:', networkError);
            throw new Error('Network error - please check your connection');
        }

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('[API] Non-JSON response:', text.substring(0, 200));
            throw new Error('Server error - please try again later');
        }

        let data: any;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error('[API] JSON parse error:', parseError);
            throw new Error('Invalid response from server');
        }

        if (!response.ok) {
            throw new Error(data.error || data.message || 'Request failed');
        }

        return data;
    }

    // ========== AUTH ==========
    async login(phone: string, password: string): Promise<AuthResponse> {
        console.log('[API] ========== LOGIN START ==========');
        console.log('[API] Phone:', phone);

        console.log('[API] Calling login endpoint...');
        const data = await this.request<AuthResponse>(API_ENDPOINTS.LOGIN, {
            method: 'POST',
            body: JSON.stringify({ phone_number: phone, password }),
        });
        console.log('[API] Login response received:', JSON.stringify({ userType: data.userType, userId: data.userId, hasToken: !!data.token }));

        // Verify this is a driver account
        console.log('[API] Checking userType:', data.userType);
        if (data.userType !== 'driver') {
            console.error('[API] userType mismatch! Expected "driver", got:', data.userType);
            throw new Error('This app is for drivers only. Please use the customer app.');
        }
        console.log('[API] userType verified as driver ✓');

        if (data.token) {
            console.log('[API] Setting token...');
            await this.setToken(data.token);
            console.log('[API] Token set successfully ✓');
        } else {
            console.warn('[API] No token in response!');
        }

        console.log('[API] ========== LOGIN SUCCESS ==========');
        return data;
    }

    // ========== PROFILE ==========
    async getProfile(): Promise<{ driver: Driver; stats: DriverStats }> {
        return this.request(API_ENDPOINTS.PROFILE);
    }

    async getStats(): Promise<{ stats: DriverStats }> {
        return this.request(API_ENDPOINTS.STATS);
    }

    // ========== ASSIGNMENTS ==========
    async getAssignments(status?: 'active' | 'completed' | 'all'): Promise<{ assignments: Assignment[] }> {
        const query = status ? `?status=${status}` : '';
        return this.request(`${API_ENDPOINTS.ASSIGNMENTS}${query}`);
    }

    async getAssignmentDetails(assignmentId: string): Promise<{ assignment: Assignment }> {
        return this.request(API_ENDPOINTS.ASSIGNMENT_DETAIL(assignmentId));
    }

    async updateAssignmentStatus(
        assignmentId: string,
        status: 'picked_up' | 'in_transit' | 'delivered' | 'failed',
        options?: { notes?: string; failure_reason?: string }
    ): Promise<{ success: boolean; message: string }> {
        return this.request(API_ENDPOINTS.UPDATE_ASSIGNMENT_STATUS(assignmentId), {
            method: 'PATCH',
            body: JSON.stringify({ status, ...options }),
        });
    }

    async uploadProof(
        assignmentId: string,
        photoBase64: string,
        signatureBase64?: string,
        notes?: string
    ): Promise<{ success: boolean }> {
        return this.request(API_ENDPOINTS.UPLOAD_PROOF(assignmentId), {
            method: 'POST',
            body: JSON.stringify({
                photo_base64: photoBase64,
                signature_base64: signatureBase64,
                notes,
            }),
        });
    }

    async acceptAssignment(assignmentId: string): Promise<{ success: boolean; message: string }> {
        return this.request(`/driver/assignments/${assignmentId}/accept`, {
            method: 'POST',
        });
    }

    async rejectAssignment(assignmentId: string, rejectionReason?: string): Promise<{ success: boolean; message: string }> {
        return this.request(`/driver/assignments/${assignmentId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ rejection_reason: rejectionReason }),
        });
    }

    // ========== ORDERS ==========
    async getOrderDetails(orderId: string): Promise<{
        order: {
            total_amount: number;
            part_price: number;
            delivery_fee: number;
            payment_method: string;
        }
    }> {
        return this.request(`/orders/${orderId}`)
    }

    // ========== LOCATION ==========
    async updateLocation(
        lat: number,
        lng: number,
        options?: { accuracy?: number; heading?: number; speed?: number }
    ): Promise<{ success: boolean; notifiedCustomers: number }> {
        return this.request(API_ENDPOINTS.UPDATE_LOCATION, {
            method: 'POST',
            body: JSON.stringify({ lat, lng, ...options }),
        });
    }

    // ========== AVAILABILITY ==========
    async toggleAvailability(status: 'available' | 'offline'): Promise<{ success: boolean; status: string }> {
        return this.request(API_ENDPOINTS.TOGGLE_AVAILABILITY, {
            method: 'POST',
            body: JSON.stringify({ status }),
        });
    }

    // ========== NOTIFICATIONS ==========
    async registerPushToken(token: string, platform: 'ios' | 'android'): Promise<{ success: boolean }> {
        return this.request(API_ENDPOINTS.NOTIFICATIONS_REGISTER, {
            method: 'POST',
            body: JSON.stringify({ token, platform, device_id: 'unknown' }),
        });
    }

    // ========== CHAT ==========
    async sendChatMessage(orderId: string, message: string): Promise<{ message: any }> {
        return this.request('/chat/messages', {
            method: 'POST',
            body: JSON.stringify({ order_id: orderId, message }),
        });
    }

    // ========== NEW ENTERPRISE FEATURES ==========
    async getEarningsTrend(): Promise<{ trend: any[] }> {
        return this.request('/driver/stats/trend');
    }

    async getPayoutHistory(): Promise<{ payouts: any[] }> {
        return this.request('/driver/payouts');
    }

    async getWallet(): Promise<{ wallet: Wallet }> {
        return this.request('/driver/wallet');
    }

    async getWalletHistory(): Promise<{ history: WalletTransaction[] }> {
        return this.request('/driver/wallet/history');
    }

    async updateProfile(data: Partial<Driver>): Promise<{ success: boolean; driver: Driver }> {
        return this.request('/driver/profile', {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async deleteAccount(): Promise<{ message: string }> {
        return this.request('/auth/delete-account', {
            method: 'DELETE',
        });
    }
}

export const api = new DriverApiService();
