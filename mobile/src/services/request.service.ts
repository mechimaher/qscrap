import { apiClient } from "./apiClient";
import { API_ENDPOINTS, API_BASE_URL } from "../config/api";
import { log, warn, error } from "../utils/logger";
import * as SecureStore from "expo-secure-store";
import { User, AuthResponse, Request, Bid, Order, Stats, Address, Product, Notification, SupportTicket, Vehicle, LoyaltyTransaction, PaymentMethod, UrgentAction } from "./types";

export class RequestService {
    async getMyRequests(): Promise<{ requests: Request[] }> {
        return apiClient.request(API_ENDPOINTS.MY_REQUESTS);
    }

    async getRequestDetails(requestId: string): Promise<{ request: Request; bids: Bid[] }> {
        return apiClient.request(`${API_ENDPOINTS.REQUESTS}/${requestId}`);
    }

    async createRequest(formData: FormData): Promise<{ success: boolean; request_id: string; message?: string }> {
        const token = await apiClient.getToken();

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.REQUESTS}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    // Don't set Content-Type for FormData - browser sets it with boundary
                },
                body: formData,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create request');
            }

            return data;
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timed out. Please check your connection and try again.');
            }
            throw error;
        }
    }

    async cancelRequest(requestId: string): Promise<{ success: boolean; message: string }> {
        return apiClient.request(API_ENDPOINTS.CANCEL_REQUEST(requestId), {
            method: 'POST',
        });
    }

    async deleteRequest(requestId: string): Promise<{ success: boolean; message: string }> {
        return apiClient.request(API_ENDPOINTS.DELETE_REQUEST(requestId), {
            method: 'DELETE',
        });
    }

    async getFeaturedProducts(limit: number = 6): Promise<{ products: Product[] }> {
        return apiClient.request(`${API_ENDPOINTS.CATALOG_SEARCH}?limit=${limit}`);
    }
}

export const requestService = new RequestService();
