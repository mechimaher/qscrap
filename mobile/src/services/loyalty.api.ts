import { api } from './api';

const apiClient = {
    get: async (url: string, config?: any) => ({ data: await api.request<any>(url, { ...config, method: 'GET' }) }),
    post: async (url: string, data?: any, config?: any) => ({ data: await api.request<any>(url, { ...config, method: 'POST', body: JSON.stringify(data) }) }),
};

/**
 * Loyalty Program API Service
 * Production implementation - connects to real backend endpoints
 * NO MOCK DATA - All calls hit /api/loyalty/* endpoints
 */

export interface LoyaltySummary {
    points: number;
    lifetime_points: number;
    current_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    next_tier: string | null;
    points_to_next_tier: number;
    tier_benefits: {
        discount_percentage: number;
        priority_support: boolean;
        badge_color: string;
    };
    member_since: string;
    lifetime_orders: number;
}

export interface RewardTransaction {
    transaction_id: string;
    transaction_type: 'earned' | 'redeemed' | 'bonus' | 'expired';
    points_change: number;
    description: string;
    reference_type: string; // order, review, referral, etc
    reference_id: string;
    created_at: string;
}

export interface TierInfo {
    tier_name: string;
    min_points: number;
    discount_percentage: number;
    priority_support: boolean;
    badge_color: string;
}

export interface RedeemResponse {
    success: boolean;
    new_balance: number;
    discount_amount: number;
    order_id?: string;
    message: string;
}

/**
 * Loyalty API Service
 * All methods connect to real backend - no simulations
 */
export const loyaltyAPI = {
    /**
     * Get customer's loyalty summary
     * Endpoint: GET /api/loyalty/summary
     */
    async getSummary(): Promise<LoyaltySummary> {
        const response = await apiClient.get('/loyalty/summary');
        return response.data;
    },

    /**
     * Get transaction history
     * Endpoint: GET /api/loyalty/transactions
     */
    async getTransactions(limit: number = 50): Promise<RewardTransaction[]> {
        const response = await apiClient.get('/loyalty/transactions', {
            params: { limit }
        });
        return response.data.transactions || [];
    },

    /**
     * Redeem points for discount
     * Endpoint: POST /api/loyalty/redeem
     */
    async redeemPoints(points: number, orderId?: string): Promise<RedeemResponse> {
        const response = await apiClient.post('/loyalty/redeem', {
            points,
            order_id: orderId
        });
        return response.data;
    },

    /**
     * Get all tier information
     * Endpoint: GET /api/loyalty/tiers
     */
    async getTiers(): Promise<TierInfo[]> {
        const response = await apiClient.get('/loyalty/tiers');
        return response.data.tiers || [];
    },

    /**
     * Calculate points for order amount
     * Endpoint: GET /api/loyalty/calculate
     */
    async calculatePoints(amount: number): Promise<{ points: number; rate: string }> {
        const response = await apiClient.get('/loyalty/calculate', {
            params: { amount }
        });
        return response.data;
    }
};

export default loyaltyAPI;
