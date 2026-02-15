import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as Sentry from '@sentry/react-native';
import { api, Driver } from '../services/api';
import { locationService } from '../services/LocationService';
import { clearActiveOrders } from '../services/socket';

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

        // Failsafe: Force app to load after 10 seconds even if auth check hangs
        const safetyTimer = setTimeout(() => {
            console.warn('[Auth] Safety timer triggered! Forcing app load.');
            setIsLoading(false);
        }, 10000);

        checkAuth();

        return () => clearTimeout(safetyTimer);
    }, []);

    const checkAuth = async () => {
        try {
            const token = await api.getToken();

            if (token) {
                // LOCAL-FIRST: Use cached driver data (like Customer App)
                // This prevents hanging on network issues during startup
                const savedDriver = await api.getDriver();

                if (savedDriver) {
                    setDriver(savedDriver);
                    Sentry.setUser({ id: savedDriver.driver_id, username: savedDriver.full_name });

                    // Start location tracking (non-blocking)
                    locationService.startTracking().catch(e =>
                        console.warn('[Auth] Location tracking error:', e)
                    );

                    // Refresh profile in BACKGROUND after UI loads
                    // This verifies token validity without blocking startup
                    setTimeout(() => {
                        api.getProfile()
                            .then(response => {
                                if (response.driver) {
                                    setDriver(response.driver);
                                    api.saveDriver(response.driver);
                                }
                            })
                            .catch(error => {
                                console.warn('[Auth] Background refresh failed:', error?.message);
                                // Token might be invalid - clear it and force re-login
                                if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
                                    api.clearToken();
                                    setDriver(null);
                                }
                            });
                    }, 1000); // 1 second delay to let UI render first
                } else {
                    // Have token but no cached driver - must verify with network
                    try {
                        const profilePromise = api.getProfile();
                        const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
                        );
                        const response = await Promise.race([profilePromise, timeoutPromise]) as any;

                        if (response.driver) {
                            setDriver(response.driver);
                            await api.saveDriver(response.driver);
                            locationService.startTracking().catch(e =>
                                console.warn('[Auth] Location tracking error:', e)
                            );
                        }
                    } catch (error: any) {
                        await api.clearToken();
                    }
                }
            } else {
            }
        } catch (error) {
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

                // Start tracking location
                locationService.startTracking().catch(console.error);
            }

            return { success: true };
        } catch (error: any) {
            Sentry.captureException(error, { tags: { action: 'login' } });
            return { success: false, error: error.message || 'Login failed' };
        }
    };

    const logout = async () => {
        try {
            // Stop tracking location
            await locationService.stopTracking().catch(console.error);

            // Set status to offline before logout
            try {
                await api.toggleAvailability('offline');
            } catch (e) {
                // Ignore if fails
            }

            // Clear active orders (chat rooms)
            await clearActiveOrders();

            await api.clearToken();
            Sentry.setUser(null);
            setDriver(null);
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
