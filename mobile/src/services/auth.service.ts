import { apiClient } from "./apiClient";
import { API_ENDPOINTS, API_BASE_URL } from "../config/api";
import { log, warn, error } from "../utils/logger";
import * as SecureStore from "expo-secure-store";
import { User, AuthResponse, Request, Bid, Order, Stats, Address, Product, Notification, SupportTicket, Vehicle, LoyaltyTransaction, PaymentMethod, UrgentAction } from "./types";

export class AuthService {
    async login(phone_number: string, password: string): Promise<AuthResponse> {
        const data = await apiClient.request<AuthResponse>(API_ENDPOINTS.LOGIN, {
            method: 'POST',
            body: JSON.stringify({ phone_number, password }),
        });
        if (data.token) {
            await apiClient.setToken(data.token);
            if (data.refreshToken) {
                await apiClient.setRefreshToken(data.refreshToken);
            }

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

            await apiClient.saveUser(userToSave as User);
        }
        return data;
    }

    async register(full_name: string, phone_number: string, password: string): Promise<{ success: boolean; message: string }> {
        return apiClient.request(API_ENDPOINTS.REGISTER, {
            method: 'POST',
            body: JSON.stringify({ full_name, phone_number, password, user_type: 'customer' }),
        });
    }

    async registerWithEmail(data: {
        full_name: string;
        email: string;
        phone_number: string;
        password: string;
    }): Promise<{ success: boolean; message: string; email: string; expiresIn: number }> {
        return apiClient.request('/auth/register-with-email', {
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
        const response = await apiClient.request<AuthResponse & { success: boolean; emailVerified: boolean }>(
            '/auth/verify-email-otp',
            {
                method: 'POST',
                body: JSON.stringify(data),
            }
        );

        if (response.token) {
            await apiClient.setToken(response.token);
            if ((response as any).refreshToken) {
                await apiClient.setRefreshToken((response as any).refreshToken);
            }
            await apiClient.saveUser({
                user_id: response.userId,
                user_type: response.userType as 'customer',
                full_name: data.full_name,
                email: data.email,
                phone_number: data.phone_number,
            });
        }
        return response;
    }

    async resendOTP(email: string, full_name?: string): Promise<{ success: boolean; message: string; expiresIn: number }> {
        return apiClient.request('/auth/resend-otp', {
            method: 'POST',
            body: JSON.stringify({ email, full_name }),
        });
    }

    async serverLogout(): Promise<void> {
        try {
            const rt = await apiClient.getRefreshToken();
            if (rt) {
                await fetch(`${API_BASE_URL}${API_ENDPOINTS.LOGOUT}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken: rt }),
                });
            }
        } catch {
            // Best-effort — don't block logout if server call fails
        }
    }

    async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
        return apiClient.request('/auth/request-password-reset', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    }

    async verifyPasswordResetOTP(data: {
        email: string;
        otp: string;
    }): Promise<{ success: boolean; token: string; message: string }> {
        return apiClient.request('/auth/verify-password-reset-otp', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async resendPasswordResetOTP(email: string): Promise<{ success: boolean; message: string }> {
        return apiClient.request('/auth/resend-password-reset-otp', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    }

    async resetPassword(data: {
        email: string;
        otp: string;
        newPassword: string;
    }): Promise<{ success: boolean; message: string }> {
        return apiClient.request('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async saveBiometricCredentials(phone: string, password: string): Promise<void> {
        try {
            await SecureStore.setItemAsync(BIOMETRIC_PHONE, phone);
            await SecureStore.setItemAsync(BIOMETRIC_PASSWORD, password);
            await SecureStore.setItemAsync(BIOMETRIC_ENABLED, 'true');
            log('[API] Biometric credentials saved');
        } catch (error) {
            warn('[API] Failed to save biometric credentials:', error);
        }
    }

    async getBiometricCredentials(): Promise<{ phone: string; password: string } | null> {
        try {
            const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED);
            if (enabled !== 'true') {
                return null;
            }

            const phone = await SecureStore.getItemAsync(BIOMETRIC_PHONE);
            const password = await SecureStore.getItemAsync(BIOMETRIC_PASSWORD);

            if (phone && password) {
                return { phone, password };
            }
            return null;
        } catch (error) {
            warn('[API] Failed to get biometric credentials:', error);
            return null;
        }
    }

    async clearBiometricCredentials(): Promise<void> {
        try {
            await SecureStore.deleteItemAsync(BIOMETRIC_PHONE);
            await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD);
            await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED);
            log('[API] Biometric credentials cleared');
        } catch (error) {
            warn('[API] Failed to clear biometric credentials:', error);
        }
    }

    async isBiometricEnabled(): Promise<boolean> {
        try {
            const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED);
            return enabled === 'true';
        } catch {
            return false;
        }
    }

    async setBiometricEnabled(enabled: boolean): Promise<void> {
        try {
            await SecureStore.setItemAsync(BIOMETRIC_ENABLED, enabled ? 'true' : 'false');
        } catch (error) {
            warn('[API] Failed to set biometric enabled:', error);
        }
    }
}

export const authService = new AuthService();
