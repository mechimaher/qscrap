import { apiClient } from "./apiClient";
import { API_ENDPOINTS, API_BASE_URL } from "../config/api";
import { log, warn, error } from "../utils/logger";
import { User, AuthResponse, Request, Bid, Order, Stats, Address, Product, Notification, SupportTicket, Vehicle, LoyaltyTransaction, PaymentMethod, UrgentAction } from "./types";

export class EscrowService {
    async getEscrowStatus(orderId: string): Promise<{
            escrow_id: string;
            status: 'held' | 'released' | 'refunded' | 'disputed';
            amount: number;
            inspection_expires_at: string;
            buyer_confirmed_at?: string;
        }> {
        return apiClient.request(`/escrow/order/${orderId}`);
    }

    async confirmEscrowReceipt(escrowId: string, photos: string[]): Promise<{ success: boolean; message: string }> {
        return apiClient.request(`/escrow/${escrowId}/confirm`, {
            method: 'POST',
            body: JSON.stringify({
                photos,
                notes: 'Buyer confirmed receipt'
            })
        });
    }

    async raiseEscrowDispute(escrowId: string, reason: string, photos?: string[], note?: string): Promise<{ success: boolean; dispute_id: string; message?: string }> {
        return apiClient.request(`/escrow/${escrowId}/dispute`, {
            method: 'POST',
            body: JSON.stringify({ reason, photos, note })
        });
    }

    async uploadProofOfCondition(escrowId: string, orderId: string, photos: string[], captureType: string): Promise<{ success: boolean; message: string }> {
        return apiClient.request(`/escrow/${escrowId}/proof`, {
            method: 'POST',
            body: JSON.stringify({
                order_id: orderId,
                capture_type: captureType,
                image_urls: photos
            })
        });
    }
}

export const escrowService = new EscrowService();
