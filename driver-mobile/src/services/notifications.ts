/**
 * Push Notification Service for QScrap Driver App
 * 
 * Handles local notifications for driver alerts.
 * Uses Expo Notifications API.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from './api';

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

/**
 * Request notification permissions and get token
 */
export const registerForPushNotifications = async (): Promise<string | null> => {
    // Check if running on a physical device (not simulator/emulator)
    const isDevice = Constants.isDevice ?? true;
    if (!isDevice) {
        console.log('[Notifications] Must use physical device for push notifications');
        return null;
    }

    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

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
            projectId: 'qscrap-driver' // Update with actual Expo project ID if needed
        });

        const token = tokenData.data;
        console.log('[Notifications] Push token:', token);

        // Register with backend
        try {
            await api.registerPushToken(token, Platform.OS as 'ios' | 'android');
        } catch (e) {
            console.log('[Notifications] Failed to register token with backend:', e);
        }

        return token;
    } catch (error) {
        console.error('[Notifications] Registration error:', error);
        return null;
    }
};

/**
 * Schedule a local notification
 */
export const scheduleLocalNotification = async (
    title: string,
    body: string,
    data?: Record<string, any>
): Promise<string> => {
    try {
        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                sound: 'default',
                data: data || {},
                priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: null, // Immediate
        });

        console.log('[Notifications] Scheduled:', id, title);
        return id;
    } catch (error) {
        console.error('[Notifications] Schedule error:', error);
        return '';
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

export default {
    registerForPushNotifications,
    scheduleLocalNotification,
    addNotificationReceivedListener,
    addNotificationResponseListener,
    setBadgeCount,
    clearBadge,
};
