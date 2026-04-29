import { apiClient } from "./apiClient";
import { API_ENDPOINTS, API_BASE_URL } from "../config/api";
import { log, warn, error } from "../utils/logger";
import * as SecureStore from "expo-secure-store";
import { User, AuthResponse, Request, Bid, Order, Stats, Address, Product, Notification, SupportTicket, Vehicle, LoyaltyTransaction, PaymentMethod, UrgentAction } from "./types";

// SecureStore keys for biometric credentials — must match apiClient.ts
const BIOMETRIC_PHONE = 'qscrap_biometric_phone';
const BIOMETRIC_PASSWORD = 'qscrap_biometric_password';
const BIOMETRIC_REFRESH_TOKEN = 'qscrap_biometric_refresh_token';
const BIOMETRIC_ENABLED = 'qscrap_biometric_enabled';

const BIOMETRIC_METADATA_OPTIONS: SecureStore.SecureStoreOptions = {
    keychainService: 'qscrap_biometric_metadata',
};

const BIOMETRIC_SECRET_OPTIONS: SecureStore.SecureStoreOptions = {
    keychainService: 'qscrap_biometric_session',
    requireAuthentication: true,
    authenticationPrompt: 'Authenticate to unlock QScrap',
};

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

    async checkDeletionEligibility(): Promise<{
        canDelete: boolean;
        blockers: Array<{
            type: string;
            count: number;
            message: string;
            action: string;
        }>;
    }> {
        return apiClient.request(API_ENDPOINTS.DELETION_ELIGIBILITY);
    }

    async deleteAccount(): Promise<{ message: string }> {
        return apiClient.request(API_ENDPOINTS.DELETE_ACCOUNT, {
            method: 'DELETE',
        });
    }

    async loginWithBiometric(): Promise<{ token: string; refreshToken?: string }> {
        const session = await this.getBiometricSession();
        if (!session?.refreshToken) {
            throw new Error('No biometric session found');
        }

        try {
            const response = await apiClient.request<{ token: string; refreshToken?: string }>(API_ENDPOINTS.REFRESH, {
                method: 'POST',
                body: JSON.stringify({ refreshToken: session.refreshToken }),
            });

            await apiClient.setToken(response.token);
            const nextRefreshToken = response.refreshToken || session.refreshToken;
            await apiClient.setRefreshToken(nextRefreshToken);
            await SecureStore.setItemAsync(BIOMETRIC_REFRESH_TOKEN, nextRefreshToken, BIOMETRIC_SECRET_OPTIONS);
            return response;
        } catch (error) {
            await this.clearBiometricCredentials();
            throw error;
        }
    }

    async saveBiometricCredentials(phone: string, _password: string): Promise<void> {
        try {
            const refreshToken = await apiClient.getRefreshToken();
            if (!refreshToken) {
                warn('[API] Cannot enable biometric login without a refresh token');
                return;
            }

            await SecureStore.setItemAsync(BIOMETRIC_PHONE, phone, BIOMETRIC_METADATA_OPTIONS);
            await SecureStore.setItemAsync(BIOMETRIC_REFRESH_TOKEN, refreshToken, BIOMETRIC_SECRET_OPTIONS);
            await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD);
            await SecureStore.setItemAsync(BIOMETRIC_ENABLED, 'true', BIOMETRIC_METADATA_OPTIONS);
            log('[API] Biometric session saved');
        } catch (error) {
            warn('[API] Failed to save biometric session:', error);
        }
    }

    async getBiometricSession(): Promise<{ phone: string; refreshToken: string } | null> {
        try {
            await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD);
            const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED, BIOMETRIC_METADATA_OPTIONS);
            if (enabled !== 'true') {
                return null;
            }

            const phone = await SecureStore.getItemAsync(BIOMETRIC_PHONE, BIOMETRIC_METADATA_OPTIONS);
            const refreshToken = await SecureStore.getItemAsync(BIOMETRIC_REFRESH_TOKEN, BIOMETRIC_SECRET_OPTIONS);

            if (phone && refreshToken) {
                return { phone, refreshToken };
            }
            return null;
        } catch (error) {
            warn('[API] Failed to get biometric session:', error);
            return null;
        }
    }

    async getBiometricCredentials(): Promise<{ phone: string; password: string } | null> {
        return null;
    }

    async clearBiometricCredentials(): Promise<void> {
        try {
            await SecureStore.deleteItemAsync(BIOMETRIC_PHONE, BIOMETRIC_METADATA_OPTIONS);
            await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD);
            await SecureStore.deleteItemAsync(BIOMETRIC_REFRESH_TOKEN, BIOMETRIC_SECRET_OPTIONS);
            await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED, BIOMETRIC_METADATA_OPTIONS);
            log('[API] Biometric session cleared');
        } catch (error) {
            warn('[API] Failed to clear biometric session:', error);
        }
    }

    async isBiometricEnabled(): Promise<boolean> {
        try {
            await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD);
            const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED, BIOMETRIC_METADATA_OPTIONS);
            return enabled === 'true';
        } catch {
            return false;
        }
    }

    async setBiometricEnabled(enabled: boolean): Promise<void> {
        try {
            if (!enabled) {
                await this.clearBiometricCredentials();
                return;
            }
            await SecureStore.setItemAsync(BIOMETRIC_ENABLED, 'true', BIOMETRIC_METADATA_OPTIONS);
        } catch (error) {
            warn('[API] Failed to set biometric enabled:', error);
        }
    }
}

export const authService = new AuthService();
