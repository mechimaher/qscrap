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
    vehicle_plate: string;
    status: 'available' | 'busy' | 'offline';
    total_deliveries: number;
    rating_average: number;
    total_earnings?: number;
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
    car_make?: string;
    car_model?: string;
    garage_name: string;
    garage_phone?: string;
    customer_name: string;
    customer_phone?: string;

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

// API Service
class DriverApiService {
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

    async saveDriver(driver: Driver): Promise<void> {
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(driver));
    }

    async getDriver(): Promise<Driver | null> {
        try {
            const driverData = await SecureStore.getItemAsync(USER_KEY);
            return driverData ? JSON.parse(driverData) : null;
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

        const url = `${API_BASE_URL}${endpoint}`;
        console.log('[API] Request:', options.method || 'GET', url);

        let response: Response;
        try {
            response = await fetch(url, {
                ...options,
                headers,
            });
        } catch (networkError) {
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
        const data = await this.request<AuthResponse>(API_ENDPOINTS.LOGIN, {
            method: 'POST',
            body: JSON.stringify({ phone_number: phone, password }),
        });

        // Verify this is a driver account
        if (data.userType !== 'driver') {
            throw new Error('This app is for drivers only. Please use the customer app.');
        }

        if (data.token) {
            await this.setToken(data.token);
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
                photo: photoBase64,
                signature: signatureBase64,
                notes,
            }),
        });
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
}

export const api = new DriverApiService();
