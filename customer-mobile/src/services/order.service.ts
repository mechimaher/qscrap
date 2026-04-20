import { apiClient } from "./apiClient";
import { API_ENDPOINTS, API_BASE_URL } from "../config/api";
import { log, warn, error } from "../utils/logger";
import { User, AuthResponse, Request, Bid, Order, Stats, Address, Product, Notification, SupportTicket, Vehicle, LoyaltyTransaction, PaymentMethod, UrgentAction } from "./types";

export class OrderService {
    async getMyOrders(): Promise<{ orders: Order[] }> {
        return apiClient.request(API_ENDPOINTS.MY_ORDERS);
    }

    async acceptBid(bidId: string, paymentMethod = 'cash'): Promise<{ success: boolean; order_id: string; message?: string }> {
        return apiClient.request(API_ENDPOINTS.ACCEPT_BID(bidId), {
            method: 'POST',
            body: JSON.stringify({ payment_method: paymentMethod }),
        });
    }

    async rejectBid(bidId: string, reason?: string): Promise<{ success: boolean; message: string }> {
        return apiClient.request(API_ENDPOINTS.REJECT_BID(bidId), {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
    }

    async confirmDelivery(orderId: string): Promise<{ success: boolean; message: string }> {
        return apiClient.request(API_ENDPOINTS.CONFIRM_DELIVERY(orderId), {
            method: 'POST',
        });
    }

    async undoOrder(orderId: string, reason = 'panic_button'): Promise<{ success: boolean; message?: string; expired?: boolean }> {
        return apiClient.request(API_ENDPOINTS.UNDO_ORDER(orderId), {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
    }

    async getDeliveryOtp(orderId: string): Promise<{ otp_code: string; expires_at?: string; attempts_remaining?: number }> {
        return apiClient.request(API_ENDPOINTS.DELIVERY_OTP(orderId));
    }

    async regenerateDeliveryOtp(orderId: string): Promise<{ otp_code: string; expires_at?: string }> {
        return apiClient.request(API_ENDPOINTS.REFRESH_DELIVERY_OTP(orderId), {
            method: 'POST',
        });
    }

    async getOrders(): Promise<{ orders: Order[] }> {
        return apiClient.request('/orders');
    }

    async getOrderCount(): Promise<{ total: number }> {
        return apiClient.request('/orders/count');
    }

    async getCancellationPreview(orderId: string): Promise<any> {
        return apiClient.request(`/orders/${orderId}/cancel-preview`);
    }

    async cancelOrder(orderId: string, reason: string): Promise<{ success: boolean; message: string; refund_amount?: number }> {
        return apiClient.request(API_ENDPOINTS.CANCEL_ORDER(orderId), {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
    }

    async getOrderDetails(orderId: string): Promise<{ order: Order }> {
        return apiClient.request(`/orders/${orderId}`);
    }

    async createDispute(formData: FormData): Promise<{ success: boolean; dispute_id: string; message?: string }> {
        const token = await apiClient.getToken();
        const response = await fetch(`${API_BASE_URL}/disputes`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: formData,
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to create dispute');
        }
        return data;
    }

    async getReturnPreview(orderId: string): Promise<{
        order_id: string;
        can_return: boolean;
        return_fee: number;
        delivery_fee_retained: number;
        refund_amount: number;
        days_remaining: number;
        reason?: string;
    }> {
        return apiClient.request(`/cancellations/orders/${orderId}/return-preview`);
    }

    async createReturnRequest(orderId: string, data: {
        reason: 'unused' | 'defective' | 'wrong_part';
        photo_urls: string[];
        condition_description?: string;
    }): Promise<{
        success: boolean;
        return_id?: string;
        refund_amount?: number;
        message: string;
    }> {
        return apiClient.request(`/cancellations/orders/${orderId}/return`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getCustomerAbuseStatus(): Promise<{
        returns_this_month: number;
        returns_remaining: number;
        defective_claims_this_month: number;
        defective_claims_remaining: number;
        flag_level: 'none' | 'yellow' | 'orange' | 'red' | 'black';
        can_make_return: boolean;
        can_make_defective_claim: boolean;
    }> {
        return apiClient.request('/cancellations/abuse-status');
    }
}

export const orderService = new OrderService();
