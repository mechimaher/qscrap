import { apiClient } from "./apiClient";
import { API_ENDPOINTS, API_BASE_URL } from "../config/api";
import { log, warn, error } from "../utils/logger";
import { User, AuthResponse, Request, Bid, Order, Stats, Address, Product, Notification, SupportTicket, Vehicle, LoyaltyTransaction, PaymentMethod, UrgentAction } from "./types";

export class DashboardService {
    async getStats(): Promise<{ stats: Stats }> {
        return apiClient.request(API_ENDPOINTS.STATS);
    }

    async getProfile(): Promise<{ user: User; profile?: User; stats?: any; addresses?: Address[] }> {
        return apiClient.request(API_ENDPOINTS.PROFILE);
    }

    async updateProfile(data: { full_name?: string; email?: string; phone_number?: string }): Promise<{ success: boolean; user: User }> {
        return apiClient.request(API_ENDPOINTS.UPDATE_PROFILE, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
        return apiClient.request(API_ENDPOINTS.CHANGE_PASSWORD, {
            method: 'POST',
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
        });
    }

    async getUrgentActions(): Promise<{ urgent_actions: UrgentAction[]; count: number }> {
        return apiClient.request('/v1/dashboard/customer/urgent-actions');
    }

    async getContextualData(): Promise<{
            unread_bids: number;
            active_services: number;
            money_saved_this_month: number;
            loyalty_points: number;
            orders_this_month: number;
        }> {
        return apiClient.request('/v1/dashboard/customer/contextual-data');
    }
}

export const dashboardService = new DashboardService();
