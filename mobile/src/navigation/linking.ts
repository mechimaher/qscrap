import { log, warn, error as logError } from '../utils/logger';
/**
 * Deep Linking Configuration for QScrap Mobile App
 * Handles URL schemes and universal links
 */

import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { RootStackParamList } from '../../App';

// URL Scheme prefix for QScrap
const prefix = Linking.createURL('/');

/**
 * Deep linking configuration
 * Supports both custom URL scheme (qscrap://) and universal links
 */
export const linking: LinkingOptions<RootStackParamList> = {
    prefixes: [
        prefix,
        'qscrap://',
        'https://qscrap.qa',
        'https://www.qscrap.qa',
    ],
    config: {
        screens: {
            // Auth screens
            Auth: {
                screens: {
                    Login: 'login',
                    Register: 'register',
                },
            },
            // Main authenticated screens
            Main: {
                screens: {
                    MainTabs: {
                        screens: {
                            Home: 'home',
                            Requests: 'requests',
                            Orders: 'orders',
                            Profile: 'profile',
                            Support: 'support',
                        },
                    },
                    RequestDetails: {
                        path: 'request/:requestId',
                        parse: {
                            requestId: (requestId: string) => requestId,
                        },
                    },
                    OrderDetails: {
                        path: 'order/:orderId',
                        parse: {
                            orderId: (orderId: string) => orderId,
                        },
                    },
                    Tracking: {
                        path: 'track/:orderId',
                        parse: {
                            orderId: (orderId: string) => orderId,
                        },
                    },
                    CancellationPreview: 'cancel/:orderId',
                    ReturnRequest: 'return/:orderId',
                    Dispute: 'dispute/:orderId',
                },
            },
            // Legal screens (accessible without auth)
            PrivacyPolicy: 'privacy',
            Terms: 'terms',
        },
    },
};

/**
 * Handle incoming deep links
 */
export const handleDeepLink = async (url: string): Promise<{ screen: string; params?: any } | null> => {
    try {
        // Parse the URL
        const parsed = Linking.parse(url);
        log('[DeepLink] Parsed URL:', parsed);

        // Extract path and params
        const { path, queryParams } = parsed;

        if (!path) return null;

        // Handle specific routes
        if (path.startsWith('request/')) {
            const requestId = path.replace('request/', '');
            return { screen: 'RequestDetails', params: { requestId } };
        }

        if (path.startsWith('order/')) {
            const orderId = path.replace('order/', '');
            return { screen: 'OrderDetails', params: { orderId } };
        }

        if (path.startsWith('track/')) {
            const orderId = path.replace('track/', '');
            return { screen: 'Tracking', params: { orderId } };
        }

        // Handle simple paths
        switch (path) {
            case 'home':
                return { screen: 'Home' };
            case 'requests':
                return { screen: 'Requests' };
            case 'orders':
                return { screen: 'Orders' };
            case 'profile':
                return { screen: 'Profile' };
            case 'support':
                return { screen: 'Support' };
            case 'privacy':
                return { screen: 'PrivacyPolicy' };
            case 'terms':
                return { screen: 'Terms' };
            default:
                return null;
        }
    } catch (error) {
        logError('[DeepLink] Error parsing URL:', error);
        return null;
    }
};

/**
 * Subscribe to incoming links
 */
export const subscribeToLinks = (callback: (url: string) => void): (() => void) => {
    const subscription = Linking.addEventListener('url', (event: { url: string }) => {
        callback(event.url);
    });

    return () => {
        subscription.remove();
    };
};

/**
 * Get the initial URL that opened the app
 */
export const getInitialURL = async (): Promise<string | null> => {
    try {
        return await Linking.getInitialURL();
    } catch (error) {
        logError('[DeepLink] Error getting initial URL:', error);
        return null;
    }
};

/**
 * Generate a deep link URL
 */
export const createDeepLink = (path: string, params?: Record<string, string>): string => {
    let url = `qscrap://${path}`;

    if (params) {
        const query = Object.entries(params)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join('&');
        if (query) {
            url += `?${query}`;
        }
    }

    return url;
};

/**
 * Example URLs:
 * - qscrap://home
 * - qscrap://request/123
 * - qscrap://order/456
 * - qscrap://track/456
 * - https://qscrap.qa/order/456
 */

export default {
    linking,
    handleDeepLink,
    subscribeToLinks,
    getInitialURL,
    createDeepLink,
};
