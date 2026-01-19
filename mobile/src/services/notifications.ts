/**
 * Push Notification Service for QScrap Mobile App
 * 
 * Handles push notification registration, permissions, and handling.
 * Uses Expo Notifications API.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { api } from './api';
import * as storage from '../utils/storage';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export interface NotificationData {
    type: 'new_bid' | 'order_update' | 'message' | 'general';
    title: string;
    body: string;
    data?: {
        requestId?: string;
        orderId?: string;
        ticketId?: string;
    };
}

/**
 * Register for push notifications and return the token
 */
export const registerForPushNotifications = async (): Promise<string | null> => {
    if (!Device.isDevice) {
        console.log('[Notifications] Push notifications not available in simulator');
        return null;
    }

    try {
        // Check existing permission
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        // Request permission if not granted
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('[Notifications] Permission not granted');
            return null;
        }

        // Get Expo push token
        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: '47b26c9d-3bd0-4470-8543-dd303a49b287',
        });
        const token = tokenData.data;

        console.log('[Notifications] Token:', token);

        // Store token locally
        await storage.setItem(storage.StorageKey.PUSH_TOKEN, token);

        // Configure Android channels with Keeta/Talabat-style alerts
        if (Platform.OS === 'android') {
            // Default channel - maximum importance
            await Notifications.setNotificationChannelAsync('default', {
                name: 'QScrap Notifications',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 400, 200, 400],
                lightColor: '#6366f1',
                enableLights: true,
                enableVibrate: true,
            });

            // Orders channel - HIGH priority with strong vibration
            await Notifications.setNotificationChannelAsync('orders', {
                name: 'Order Updates',
                description: 'Updates about your orders',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 500, 250, 500],
                enableVibrate: true,
                lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            });

            // Delivery channel - CRITICAL for real-time tracking
            await Notifications.setNotificationChannelAsync('delivery', {
                name: 'Delivery Tracking',
                description: 'Real-time delivery updates',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 500, 250, 500, 250, 500],
                enableVibrate: true,
                enableLights: true,
                lightColor: '#22c55e',
                lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            });

            // Bids channel - high priority
            await Notifications.setNotificationChannelAsync('bids', {
                name: 'New Bids',
                description: 'Notifications when you receive new bids',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 300, 150, 300],
                enableVibrate: true,
            });

            // Messages channel
            await Notifications.setNotificationChannelAsync('messages', {
                name: 'Messages',
                description: 'Support chat messages',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 200, 100, 200],
            });

            console.log('[Notifications] Android channels configured');
        }

        // Configure iOS notification categories with action buttons
        if (Platform.OS === 'ios') {
            await Notifications.setNotificationCategoryAsync('bids', [
                {
                    identifier: 'view',
                    buttonTitle: 'View Bid',
                    options: { opensAppToForeground: true },
                },
                {
                    identifier: 'ignore',
                    buttonTitle: 'Ignore',
                    options: { isDestructive: true },
                },
            ]);

            await Notifications.setNotificationCategoryAsync('orders', [
                {
                    identifier: 'track',
                    buttonTitle: 'Track Order',
                    options: { opensAppToForeground: true },
                },
                {
                    identifier: 'details',
                    buttonTitle: 'View Details',
                    options: { opensAppToForeground: true },
                },
            ]);

            await Notifications.setNotificationCategoryAsync('counter_offer', [
                {
                    identifier: 'accept',
                    buttonTitle: 'Accept',
                    options: { opensAppToForeground: true },
                },
                {
                    identifier: 'view',
                    buttonTitle: 'View Details',
                    options: { opensAppToForeground: true },
                },
            ]);
        }

        return token;
    } catch (error) {
        console.error('[Notifications] Error registering:', error);
        return null;
    }
};

/**
 * Register push token with backend
 */
export const registerTokenWithBackend = async (token: string): Promise<boolean> => {
    try {
        const platform = Platform.OS as 'ios' | 'android';
        await api.registerPushToken(token, platform);
        console.log('[Notifications] Token registered with backend');
        return true;
    } catch (error) {
        console.error('[Notifications] Failed to register token with backend:', error);
        return false;
    }
};

/**
 * Initialize push notifications (call on app startup)
 */
export const initializePushNotifications = async (): Promise<void> => {
    const token = await registerForPushNotifications();

    if (token) {
        await registerTokenWithBackend(token);
    }
};

/**
 * Add notification received listener
 */
export const addNotificationReceivedListener = (
    callback: (notification: Notifications.Notification) => void
): Notifications.Subscription => {
    return Notifications.addNotificationReceivedListener(callback);
};

/**
 * Add notification response listener (when user taps notification)
 */
export const addNotificationResponseListener = (
    callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription => {
    return Notifications.addNotificationResponseReceivedListener(callback);
};

/**
 * Get last notification response (for handling deep links on app open)
 */
export const getLastNotificationResponse = (): Promise<Notifications.NotificationResponse | null> => {
    return Notifications.getLastNotificationResponseAsync();
};

/**
 * Schedule a local notification
 */
export const scheduleLocalNotification = async (
    title: string,
    body: string,
    data?: Record<string, any>,
    trigger?: Notifications.NotificationTriggerInput
): Promise<string> => {
    const id = await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data,
            sound: true,
        },
        trigger: trigger || null, // null = immediate
    });

    return id;
};

/**
 * Cancel a scheduled notification
 */
export const cancelNotification = async (notificationId: string): Promise<void> => {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
};

/**
 * Cancel all notifications
 */
export const cancelAllNotifications = async (): Promise<void> => {
    await Notifications.cancelAllScheduledNotificationsAsync();
};

/**
 * Set badge count
 */
export const setBadgeCount = async (count: number): Promise<void> => {
    await Notifications.setBadgeCountAsync(count);
};

/**
 * Clear badge
 */
export const clearBadge = async (): Promise<void> => {
    await Notifications.setBadgeCountAsync(0);
};

/**
 * Get notification permissions status
 */
export const getNotificationPermissions = async (): Promise<Notifications.PermissionStatus> => {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
};

/**
 * Check if notifications are enabled
 */
export const areNotificationsEnabled = async (): Promise<boolean> => {
    const status = await getNotificationPermissions();
    return status === 'granted';
};

export default {
    registerForPushNotifications,
    registerTokenWithBackend,
    initializePushNotifications,
    addNotificationReceivedListener,
    addNotificationResponseListener,
    getLastNotificationResponse,
    scheduleLocalNotification,
    cancelNotification,
    cancelAllNotifications,
    setBadgeCount,
    clearBadge,
    getNotificationPermissions,
    areNotificationsEnabled,
};
