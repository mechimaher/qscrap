// Auth Context - Manages authentication state across the app
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, User } from '../services/api';

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
                }
            }
        } catch (error) {
            console.log('Auth check failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (phone: string, password: string) => {
        try {
            const response = await api.login(phone, password);

            if (response.userType !== 'customer') {
                await api.clearToken();
                return { success: false, error: 'Please use the customer app' };
            }

            setUser({
                user_id: response.userId,
                full_name: response.user?.full_name || '',
                phone_number: phone,
                user_type: 'customer',
            });

            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || 'Login failed' };
        }
    };

    const register = async (name: string, phone: string, password: string) => {
        try {
            await api.register(name, phone, password);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || 'Registration failed' };
        }
    };

    const logout = async () => {
        await api.clearToken();
        setUser(null);
    };

    const refreshUser = async () => {
        try {
            const profile = await api.getProfile();
            if (profile.user) {
                setUser({
                    ...user!,
                    full_name: profile.user.full_name,
                    email: profile.user.email,
                });
            }
        } catch (error) {
            console.log('Failed to refresh user:', error);
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
