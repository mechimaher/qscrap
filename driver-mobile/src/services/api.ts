// QScrap Driver App - API Service
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
export { API_ENDPOINTS };
import * as SecureStore from 'expo-secure-store';


// Token Storage Keys
const TOKEN_KEY = 'qscrap_driver_token';
const REFRESH_TOKEN_KEY = 'qscrap_driver_refresh_token';
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
    week_deliveries: number;
    total_deliveries: number;
    rating_average: number;
    rating_count: number;
    active_assignments: number;
}

export interface AuthResponse {
    token: string;
    refreshToken?: string;
    userId: string;
    userType: string;
    driver?: Driver;
}


// API Service
class DriverApiService {
    private token: string | null = null;
    private refreshTokenValue: string | null = null;
    private isRefreshing = false;
    private refreshQueue: Array<{ resolve: (token: string) => void; reject: (error: Error) => void }> = [];

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
            return this.token;
        }
        try {
            this.token = await this.withTimeout(
                SecureStore.getItemAsync(TOKEN_KEY),
                5000,
                null
            );
            return this.token;
        } catch (error) {
            console.error('[API] getToken error:', error);
            return null;
        }
    }

    async setToken(token: string): Promise<void> {
        this.token = token;

        try {
            await this.withTimeout(
                SecureStore.setItemAsync(TOKEN_KEY, token),
                5000,
                undefined
            );
        } catch (error) {
            console.warn('[API] Failed to persist token, continuing with in-memory only:', error);
        }
    }

    async getRefreshToken(): Promise<string | null> {
        if (this.refreshTokenValue) return this.refreshTokenValue;
        try {
            this.refreshTokenValue = await this.withTimeout(
                SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
                5000,
                null
            );
            return this.refreshTokenValue;
        } catch {
            return null;
        }
    }

    async setRefreshToken(token: string): Promise<void> {
        this.refreshTokenValue = token;
        try {
            await this.withTimeout(
                SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token),
                5000,
                undefined
            );
        } catch (error) {
            console.warn('[API] Failed to persist refresh token:', error);
        }
    }

    async clearToken(): Promise<void> {
        this.token = null;
        this.refreshTokenValue = null;
        try {
            await this.withTimeout(SecureStore.deleteItemAsync(TOKEN_KEY), 5000, undefined);
            await this.withTimeout(SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY), 5000, undefined);
            await this.withTimeout(SecureStore.deleteItemAsync(USER_KEY), 5000, undefined);
        } catch (error) {
            console.warn('[API] Error clearing tokens:', error);
        }
    }

    async serverLogout(): Promise<void> {
        try {
            const rt = await this.getRefreshToken();
            if (rt) {
                await fetch(`${API_BASE_URL}${API_ENDPOINTS.LOGOUT}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken: rt }),
                });
            }
        } catch {
            // Best-effort
        }
    }

    private async attemptTokenRefresh(): Promise<string> {
        const rt = await this.getRefreshToken();
        if (!rt) throw new Error('No refresh token available');

        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.REFRESH}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: rt }),
        });

        if (!response.ok) {
            await this.clearToken();
            throw new Error('Session expired. Please log in again.');
        }

        const data = await response.json();
        await this.setToken(data.token);
        if (data.refreshToken) {
            await this.setRefreshToken(data.refreshToken);
        }
        return data.token;
    }

    private async handleTokenRefresh(): Promise<string> {
        if (this.isRefreshing) {
            return new Promise<string>((resolve, reject) => {
                this.refreshQueue.push({ resolve, reject });
            });
        }

        this.isRefreshing = true;
        try {
            const newToken = await this.attemptTokenRefresh();
            this.refreshQueue.forEach(({ resolve }) => resolve(newToken));
            return newToken;
        } catch (error: any) {
            this.refreshQueue.forEach(({ reject }) => reject(error));
            throw error;
        } finally {
            this.refreshQueue = [];
            this.isRefreshing = false;
        }
    }

    async saveDriver(driver: Driver): Promise<void> {
        try {
            await this.withTimeout(
                SecureStore.setItemAsync(USER_KEY, JSON.stringify(driver)),
                5000,
                undefined
            );
        } catch (error) {
            console.warn('[API] Failed to save driver data:', error);
        }
    }

    async getDriver(): Promise<Driver | null> {
        try {
            const driverData = await this.withTimeout(
                SecureStore.getItemAsync(USER_KEY),
                5000,
                null
            );
            const driver = driverData ? JSON.parse(driverData) : null;
            return driver;
        } catch (error) {
            console.error('[API] getDriver error:', error);
            return null;
        }
    }

    private async rawRequest<T>(
        endpoint: string,
        options: RequestInit = {},
        tokenOverride?: string | null
    ): Promise<{ data: T; status: number }> {
        const token = tokenOverride !== undefined ? tokenOverride : await this.getToken();

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        };

        const url = `${API_BASE_URL}${endpoint}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

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

        return { data, status: response.status };
    }

    public async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const { data, status } = await this.rawRequest<T>(endpoint, options);

        // If 401, attempt token refresh and retry (skip for auth endpoints)
        if (status === 401 && !endpoint.startsWith('/auth/')) {
            try {
                const newToken = await this.handleTokenRefresh();
                const retry = await this.rawRequest<T>(endpoint, options, newToken);
                if (retry.status >= 400) {
                    throw new Error(retry.data && typeof (retry.data as any).error === 'string' ? (retry.data as any).error : 'Request failed');
                }
                return retry.data;
            } catch (refreshError: any) {
                throw refreshError;
            }
        }

        if (status >= 400) {
            throw new Error((data as any)?.error || (data as any)?.message || 'Request failed');
        }

        return data;
    }

    // ========== AUTH ==========
    async login(phone: string, password: string): Promise<AuthResponse> {

        const data = await this.request<AuthResponse>(API_ENDPOINTS.LOGIN, {
            method: 'POST',
            body: JSON.stringify({ phone_number: phone, password }),
        });

        // Verify this is a driver account
        if (data.userType !== 'driver') {
            console.error('[API] userType mismatch! Expected "driver", got:', data.userType);
            throw new Error('This app is for drivers only. Please use the customer app.');
        }

        if (data.token) {
            await this.setToken(data.token);
            if (data.refreshToken) {
                await this.setRefreshToken(data.refreshToken);
            }
        } else {
            console.warn('[API] No token in response!');
        }

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
