// QScrap Driver App - Auth Context
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, Driver } from '../services/api';

interface AuthContextType {
    driver: Driver | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    refreshDriver: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [driver, setDriver] = useState<Driver | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const token = await api.getToken();
            if (token) {
                // Verify token and get driver profile
                try {
                    const response = await api.getProfile();
                    if (response.driver) {
                        setDriver(response.driver);
                        await api.saveDriver(response.driver);
                    }
                } catch (error) {
                    // Token invalid, clear it
                    console.log('[Auth] Token invalid, clearing');
                    await api.clearToken();
                }
            }
        } catch (error) {
            console.log('[Auth] Check failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (phone: string, password: string) => {
        try {
            const response = await api.login(phone, password);

            // Fetch full profile
            const profileResponse = await api.getProfile();
            if (profileResponse.driver) {
                setDriver(profileResponse.driver);
                await api.saveDriver(profileResponse.driver);
            }

            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || 'Login failed' };
        }
    };

    const logout = async () => {
        try {
            // Set status to offline before logout
            try {
                await api.toggleAvailability('offline');
            } catch (e) {
                // Ignore if fails
            }

            await api.clearToken();
            setDriver(null);
            console.log('[Auth] Logout complete');
        } catch (error) {
            console.error('[Auth] Logout error:', error);
            setDriver(null);
        }
    };

    const refreshDriver = async () => {
        try {
            const response = await api.getProfile();
            if (response.driver) {
                setDriver(response.driver);
                await api.saveDriver(response.driver);
            }
        } catch (error) {
            console.log('[Auth] Refresh failed:', error);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                driver,
                isLoading,
                isAuthenticated: !!driver,
                login,
                logout,
                refreshDriver,
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
