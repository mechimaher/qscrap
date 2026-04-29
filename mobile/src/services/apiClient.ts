import { log, warn, error as logError } from "../utils/logger";
import { API_BASE_URL, API_ENDPOINTS } from "../config/api";
import * as SecureStore from "expo-secure-store";
import { User } from "./types";

const TOKEN_KEY = 'qscrap_token';
const REFRESH_TOKEN_KEY = 'qscrap_refresh_token';
const USER_KEY = 'qscrap_user';

export class ApiClient {
    private token: string | null = null;
    private refreshTokenValue: string | null = null;
    private isRefreshing = false;
    private refreshQueue: Array<{ resolve: (token: string) => void; reject: (error: Error) => void }> = [];

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

    async getRefreshToken(): Promise<string | null> {
        if (this.refreshTokenValue) return this.refreshTokenValue;
        try {
            this.refreshTokenValue = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
            return this.refreshTokenValue;
        } catch {
            return null;
        }
    }

    async setRefreshToken(token: string): Promise<void> {
        this.refreshTokenValue = token;
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    }

    async clearToken(): Promise<void> {
        this.token = null;
        this.refreshTokenValue = null;
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
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

    private async attemptTokenRefresh(): Promise<string> {
        const rt = await this.getRefreshToken();
        if (!rt) throw new Error('No refresh token available');
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.REFRESH}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: rt }),
        });
        if (!response.ok) {
            // Refresh token is invalid/expired — force re-login
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
            // Queue this request — another refresh is already in flight
            return new Promise<string>((resolve, reject) => {
                this.refreshQueue.push({ resolve, reject });
            });
        }

        this.isRefreshing = true;
        try {
            const newToken = await this.attemptTokenRefresh();
            // Resolve all queued requests with the new token
            this.refreshQueue.forEach(({ resolve }) => resolve(newToken));
            return newToken;
        } catch (error: any) {
            // Reject all queued requests
            this.refreshQueue.forEach(({ reject }) => reject(error));
            throw error;
        } finally {
            this.refreshQueue = [];
            this.isRefreshing = false;
        }
    }

    private async rawRequest<T>(endpoint: string, options: RequestInit = {}, tokenOverride?: string | null): Promise<{ data: T; status: number }> {
        const token = tokenOverride !== undefined ? tokenOverride : await this.getToken();
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

            let data: any;
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                logError('[API] Non-JSON response:', text.substring(0, 200));
                throw new Error('Server returned invalid response. Please try again later.');
            }

            return { data, status: response.status };
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timed out. Please check your connection and try again.');
            }
            if (error.message?.includes('JSON')) {
                throw new Error('Invalid server response. Please check your connection and try again.');
            }
            throw error;
        }
    }

    public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const { data, status } = await this.rawRequest<T>(endpoint, options);
        if (status === 401 && !endpoint.startsWith('/auth/')) {
            try {
                const newToken = await this.handleTokenRefresh();
                const retry = await this.rawRequest<T>(endpoint, options, newToken);
                if (retry.status >= 400) {
                    throw new Error(this.extractError(retry.data));
                }
                return retry.data;
            } catch (refreshError: any) {
                throw refreshError;
            }
        }

        if (status >= 400) {
            throw new Error(this.extractError(data));
        }

        return data;
    }

    private extractError(data: any): string {
        if (typeof data?.error === 'string') return data.error;
        if (typeof data?.error?.message === 'string') return data.error.message;
        if (typeof data?.message === 'string') return data.message;
        return 'Request failed';
    }
}

export const apiClient = new ApiClient();
