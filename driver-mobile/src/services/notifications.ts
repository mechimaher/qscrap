/**
 * Push Notification Service for QScrap Driver App
 * 
 * Enterprise-grade notifications with high-priority channels
 * for drivers who may be driving and need loud alerts.
 * Uses Expo Notifications API.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { api } from './api';

// Configure notification behavior - critical for drivers!
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
    }),
});

/**
 * Request notification permissions and get token
 */
export const registerForPushNotifications = async (): Promise<string | null> => {
    // Check if running on a physical device
    if (!Device.isDevice) {
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

        // Get Expo push token - using the same projectId as customer app
        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: '47b26c9d-3bd0-4470-8543-dd303a49b287'
        });

        const token = tokenData.data;
        // C4 FIX: Don't log full push token in production
        console.log('[Notifications] Push token registered successfully');

        // Setup Android notification channels
        if (Platform.OS === 'android') {
            // CRITICAL: Assignments channel - maximum priority for drivers
            await Notifications.setNotificationChannelAsync('assignments', {
                name: 'Delivery Assignments',
                description: 'New pickup and delivery assignments - URGENT',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 500, 250, 500, 250, 500], // Strong triple vibration
                enableLights: true,
                lightColor: '#C9A227',
                lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
                bypassDnd: true, // CRITICAL: Bypass Do Not Disturb for drivers!
                enableVibrate: true,
            });

            // Status updates channel - high priority
            await Notifications.setNotificationChannelAsync('status', {
                name: 'Status Updates',
                description: 'Order status changes',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                enableVibrate: true,
            });

            // Default channel
            await Notifications.setNotificationChannelAsync('default', {
                name: 'General',
                description: 'General notifications',
                importance: Notifications.AndroidImportance.DEFAULT,
            });

            console.log('[Notifications] Android channels configured');
        }

        // Register with backend
        console.log('[Notifications] Registering token with backend...', token.substring(0, 30));
        try {
            const result = await api.registerPushToken(token, Platform.OS as 'ios' | 'android');
            console.log('[Notifications] ✅ Token registered with backend successfully', result);
        } catch (e: any) {
            console.error('[Notifications] ❌ CRITICAL: Failed to register token with backend');
            console.error('[Notifications] Error details:', e?.message || e);
            console.error('[Notifications] Full error:', JSON.stringify(e));
            // Don't throw - allow app to continue but log critical error
        }

        return token;
    } catch (error: any) {
        console.error('[Notifications] ❌ CRITICAL: Registration error');
        console.error('[Notifications] Error:', error?.message || error);
        console.error('[Notifications] Full:', JSON.stringify(error));
        return null;
    }
};

/**
 * Schedule a local notification with high priority
 */
export const scheduleLocalNotification = async (
    title: string,
    body: string,
    data?: Record<string, any>,
    channelId: string = 'assignments'
): Promise<string> => {
    try {
        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                sound: true,
                data: data || {},
                priority: Notifications.AndroidNotificationPriority.MAX,
                vibrate: [0, 500, 250, 500],
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

/**
 * Check if notifications are enabled
 */
export const areNotificationsEnabled = async (): Promise<boolean> => {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
};

export default {
    registerForPushNotifications,
    scheduleLocalNotification,
    addNotificationReceivedListener,
    addNotificationResponseListener,
    setBadgeCount,
    clearBadge,
    areNotificationsEnabled,
};

