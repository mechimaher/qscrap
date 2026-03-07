import { apiClient } from "./apiClient";
import { API_ENDPOINTS, API_BASE_URL } from "../config/api";
import { log, warn, error } from "../utils/logger";
import * as SecureStore from "expo-secure-store";
import { User, AuthResponse, Request, Bid, Order, Stats, Address, Product, Notification, SupportTicket, Vehicle, LoyaltyTransaction, PaymentMethod, UrgentAction } from "./types";

export class PaymentService {
    async processPayment(paymentData: {
            order_id: string;
            amount: number;
            card_number: string;
            expiry_month: string;
            expiry_year: string;
            cvv: string;
            cardholder_name: string;
        }): Promise<{
            success: boolean;
            transaction_id: string;
            receipt_url?: string;
        }> {
        return apiClient.request('/payments/process', {
            method: 'POST',
            body: JSON.stringify(paymentData)
        });
    }

    async getTestCards(): Promise<{ cards: PaymentMethod[] }> {
        return apiClient.request('/payments/test-cards');
    }

    async getPaymentMethods(): Promise<{ methods: PaymentMethod[] }> {
        return apiClient.request('/payments/methods');
    }

    async createDeliveryFeeIntent(orderId: string, loyaltyDiscount?: number): Promise<{
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
                originalTotal: number;
                codAmount: number;
                total: number;
            };
        }> {
        return apiClient.request(API_ENDPOINTS.CREATE_DEPOSIT_INTENT(orderId), {
            method: 'POST',
            body: JSON.stringify({ loyaltyDiscount: loyaltyDiscount || 0 }),
        });
    }

    async confirmDeliveryFeePayment(intentId: string): Promise<{ success: boolean; message: string }> {
        return apiClient.request(API_ENDPOINTS.CONFIRM_DEPOSIT(intentId), {
            method: 'POST',
        });
    }

    async createFullPaymentIntent(orderId: string, loyaltyDiscount?: number): Promise<{
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
                originalTotal?: number;
                total: number;
            };
        }> {
        return apiClient.request(API_ENDPOINTS.CREATE_FULL_PAYMENT_INTENT(orderId), {
            method: 'POST',
            body: JSON.stringify({ loyaltyDiscount: loyaltyDiscount || 0 }),
        });
    }

    async confirmFreeOrder(orderId: string, loyaltyDiscount: number): Promise<{
            success: boolean;
            message: string;
            order_id: string;
        }> {
        return apiClient.request(API_ENDPOINTS.CONFIRM_FREE_ORDER(orderId), {
            method: 'POST',
            body: JSON.stringify({ loyaltyDiscount }),
        });
    }
}

export const paymentService = new PaymentService();
