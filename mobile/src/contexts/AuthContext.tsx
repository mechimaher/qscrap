import { log, warn, error as logError } from '../utils/logger';
// Auth Context - Manages authentication state across the app
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as Sentry from '@sentry/react-native';
import { api, User } from '../services/api';
import { initializePushNotifications } from '../services/notifications';
import { t } from '../utils/i18nHelper';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
    register: (name: string, phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const token = await api.getToken();
            if (token) {
                const savedUser = await api.getUser();
                if (savedUser) {
                    setUser(savedUser);
                    Sentry.setUser({ id: savedUser.user_id, username: savedUser.full_name });
                    // Initialize push notifications when checking auth
                    initializePushNotifications();
                }
            }
        } catch (error) {
            log('Auth check failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (phone: string, password: string) => {
        try {
            const response = await api.login(phone, password);

            if (response.userType !== 'customer') {
                await api.clearToken();
                return { success: false, error: t('auth.useCustomerApp') };
            }

            // Fetch full profile to ensure we have the name and details
            // The login response might not have the full user object
            try {
                const profileResponse = await api.getProfile();
                if (profileResponse.user) {
                    const fullUser = {
                        user_id: profileResponse.user.user_id,
                        full_name: profileResponse.user.full_name,
                        phone_number: profileResponse.user.phone_number,
                        email: profileResponse.user.email,
                        user_type: 'customer' as const,
                    };
                    setUser(fullUser);
                    await api.saveUser(fullUser);
                } else {
                    // Fallback to login response data if profile fetch fails (unlikely)
                    const partialUser = {
                        user_id: response.userId,
                        full_name: response.user?.full_name || '',
                        phone_number: phone,
                        user_type: 'customer' as const,
                    };
                    setUser(partialUser);
                    await api.saveUser(partialUser);
                }
            } catch (profileError) {
                log('Failed to fetch profile on login:', profileError);
                // Fallback
                const partialUser = {
                    user_id: response.userId,
                    full_name: response.user?.full_name || '',
                    phone_number: phone,
                    user_type: 'customer' as const,
                };
                setUser(partialUser);
                await api.saveUser(partialUser);
            }

            // Initialize push notifications after successful login
            initializePushNotifications();

            return { success: true };
        } catch (error: any) {
            Sentry.captureException(error, { tags: { action: 'login' } });
            return { success: false, error: error.message || t('auth.loginFailed') };
        }
    };

    const register = async (name: string, phone: string, password: string) => {
        try {
            await api.register(name, phone, password);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || t('auth.registrationFailed') };
        }
    };

    const logout = async () => {
        try {
            // Clear all authentication tokens and user data
            await api.clearToken();

            // Clear any cached data from AsyncStorage
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const keysToRemove = [
                'qscrap_cache',
                'qscrap_settings',
                'qscrap_notifications',
            ];
            await AsyncStorage.multiRemove(keysToRemove);

            // Reset user state
            Sentry.setUser(null);
            setUser(null);

            log('[Auth] Logout complete - all data cleared');
        } catch (error) {
            logError('[Auth] Logout error:', error);
            // Still reset user even if cleanup fails
            setUser(null);
        }
    };

    const refreshUser = async () => {
        try {
            const response = await api.getProfile();
            if (response.user) {
                const updatedUser = {
                    user_id: response.user.user_id,
                    full_name: response.user.full_name,
                    phone_number: response.user.phone_number,
                    email: response.user.email,
                    user_type: 'customer' as const,
                };
                setUser(updatedUser);
                // Also persist to storage for next launch
                await api.saveUser(updatedUser);
            }
        } catch (error) {
            log('Failed to refresh user:', error);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                login,
                register,
                logout,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
