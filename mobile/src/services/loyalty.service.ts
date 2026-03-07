import { apiClient } from "./apiClient";
import { API_ENDPOINTS, API_BASE_URL } from "../config/api";
import { log, warn, error } from "../utils/logger";
import * as SecureStore from "expo-secure-store";
import { User, AuthResponse, Request, Bid, Order, Stats, Address, Product, Notification, SupportTicket, Vehicle, LoyaltyTransaction, PaymentMethod, UrgentAction } from "./types";

export class LoyaltyService {
    async getLoyaltyBalance(): Promise<{
            points: number;
            tier: 'bronze' | 'silver' | 'gold' | 'platinum';
            lifetime_points: number;
            points_to_next_tier: number;
        }> {
        return apiClient.request('/loyalty/balance');
    }

    async getLoyaltyHistory(): Promise<{ transactions: LoyaltyTransaction[] }> {
        return apiClient.request('/loyalty/history');
    }

    async redeemPoints(points: number, orderId?: string): Promise<{
            success: boolean;
            discount_amount: number;
            remaining_points: number;
        }> {
        return apiClient.request('/loyalty/redeem', {
            method: 'POST',
            body: JSON.stringify({ points, order_id: orderId })
        });
    }
}

export const loyaltyService = new LoyaltyService();
