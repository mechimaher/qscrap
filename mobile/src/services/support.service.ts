import { apiClient } from "./apiClient";
import { API_ENDPOINTS, API_BASE_URL } from "../config/api";
import { log, warn, error } from "../utils/logger";
import * as SecureStore from "expo-secure-store";
import { User, AuthResponse, Request, Bid, Order, Stats, Address, Product, Notification, SupportTicket, Vehicle, LoyaltyTransaction, PaymentMethod, UrgentAction } from "./types";

export class SupportService {
    async getTickets(): Promise<{ tickets: SupportTicket[] }> {
        return apiClient.request(API_ENDPOINTS.TICKETS);
    }

    async createTicket(subject: string, message: string, category = 'general'): Promise<{ success: boolean; ticket: SupportTicket }> {
        return apiClient.request(API_ENDPOINTS.TICKETS, {
            method: 'POST',
            body: JSON.stringify({ subject, message, category })
        });
    }

    async getTicketDetail(ticketId: string): Promise<{ ticket: SupportTicket }> {
        return apiClient.request(API_ENDPOINTS.TICKET_DETAIL(ticketId));
    }

    async sendTicketMessage(ticketId: string, message: string): Promise<{ success: boolean; reply?: { reply_id: string; message: string; created_at: string } }> {
        return apiClient.request(API_ENDPOINTS.TICKET_MESSAGES(ticketId), {
            method: 'POST',
            body: JSON.stringify({ message })
        });
    }

    async submitReview(orderId: string, reviewData: {
            overall_rating: number;
            part_quality_rating?: number;
            communication_rating?: number;
            delivery_rating?: number;
            review_text?: string;
        }): Promise<{ success: boolean; message: string }> {
        return apiClient.request(API_ENDPOINTS.SUBMIT_REVIEW(orderId), {
            method: 'POST',
            body: JSON.stringify(reviewData)
        });
    }
}

export const supportService = new SupportService();
