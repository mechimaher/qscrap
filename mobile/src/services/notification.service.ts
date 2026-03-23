import { apiClient } from './apiClient';
import { API_ENDPOINTS, API_BASE_URL } from '../config/api';
import { log, warn, error } from '../utils/logger';
import {
    User,
    AuthResponse,
    Request,
    Bid,
    Order,
    Stats,
    Address,
    Product,
    Notification,
    SupportTicket,
    Vehicle,
    LoyaltyTransaction,
    PaymentMethod,
    UrgentAction
} from './types';

export class NotificationService {
    async getNotifications(): Promise<{ notifications: Notification[] }> {
        return apiClient.request(API_ENDPOINTS.NOTIFICATIONS);
    }

    async markNotificationRead(notificationId: string): Promise<{ success: boolean }> {
        return apiClient.request(API_ENDPOINTS.MARK_NOTIFICATION_READ(notificationId), {
            method: 'POST'
        });
    }

    async markAllNotificationsRead(): Promise<{ success: boolean }> {
        return apiClient.request(API_ENDPOINTS.MARK_ALL_NOTIFICATIONS_READ, {
            method: 'POST'
        });
    }

    async clearAllNotifications(): Promise<{ success: boolean }> {
        return apiClient.request('/dashboard/notifications', {
            method: 'DELETE'
        });
    }

    async deleteNotification(notificationId: string): Promise<{ success: boolean }> {
        return apiClient.request(`/dashboard/notifications/${notificationId}`, {
            method: 'DELETE'
        });
    }

    async registerPushToken(
        token: string,
        platform: 'ios' | 'android',
        deviceId?: string
    ): Promise<{ success: boolean }> {
        return apiClient.request(API_ENDPOINTS.NOTIFICATIONS_REGISTER, {
            method: 'POST',
            body: JSON.stringify({ token, platform, device_id: deviceId || 'unknown' })
        });
    }
}

export const notificationService = new NotificationService();
