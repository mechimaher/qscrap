import { apiClient } from "./apiClient";
import { API_ENDPOINTS, API_BASE_URL } from "../config/api";
import { log, warn, error } from "../utils/logger";
import * as SecureStore from "expo-secure-store";
import { User, AuthResponse, Request, Bid, Order, Stats, Address, Product, Notification, SupportTicket, Vehicle, LoyaltyTransaction, PaymentMethod, UrgentAction } from "./types";

export class ChatService {
    async sendMessage(orderId: string, message: string, recipientId: string): Promise<{ success: boolean; message_id?: string }> {
        return apiClient.request(API_ENDPOINTS.MESSAGES, {
            method: 'POST',
            body: JSON.stringify({
                order_id: orderId,
                message: message,
                recipient_id: recipientId
            }),
        });
    }
}

export const chatService = new ChatService();
