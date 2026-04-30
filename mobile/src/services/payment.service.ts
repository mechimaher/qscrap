import { apiClient } from "./apiClient";
import { API_ENDPOINTS } from "../config/api";
import { PaymentMethod } from "./types";

export class PaymentService {
    async getPaymentMethods(): Promise<{ methods: PaymentMethod[] }> {
        return apiClient.request('/payments/methods');
    }

    async createDeliveryFeeIntent(orderId: string, applyLoyalty = false): Promise<{
            success: boolean;
            intent: {
                id: string;
                clientSecret: string;
                amount: number;
                currency: string;
            };
            breakdown?: {
                partPrice: number;
                deliveryFee: number;
                loyaltyDiscount: number;
                loyaltyTier?: string;
                loyaltyDiscountPercentage?: number;
                originalTotal: number;
                codAmount: number;
                total: number;
            };
        }> {
        return apiClient.request(API_ENDPOINTS.CREATE_DEPOSIT_INTENT(orderId), {
            method: 'POST',
            body: JSON.stringify({ applyLoyalty }),
        });
    }

    async confirmDeliveryFeePayment(intentId: string): Promise<{ success: boolean; message: string }> {
        return apiClient.request(API_ENDPOINTS.CONFIRM_DEPOSIT(intentId), {
            method: 'POST',
        });
    }

    async createFullPaymentIntent(orderId: string, applyLoyalty = false): Promise<{
            success: boolean;
            intent: {
                id: string;
                clientSecret: string;
                amount: number;
                currency: string;
            };
            breakdown: {
                partPrice: number;
                deliveryFee: number;
                loyaltyDiscount?: number;
                loyaltyTier?: string;
                loyaltyDiscountPercentage?: number;
                originalTotal?: number;
                total: number;
            };
        }> {
        return apiClient.request(API_ENDPOINTS.CREATE_FULL_PAYMENT_INTENT(orderId), {
            method: 'POST',
            body: JSON.stringify({ applyLoyalty }),
        });
    }

    async confirmFreeOrder(orderId: string, applyLoyalty = true): Promise<{
            success: boolean;
            message: string;
            order_id: string;
        }> {
        return apiClient.request(API_ENDPOINTS.CONFIRM_FREE_ORDER(orderId), {
            method: 'POST',
            body: JSON.stringify({ applyLoyalty }),
        });
    }
}

export const paymentService = new PaymentService();
