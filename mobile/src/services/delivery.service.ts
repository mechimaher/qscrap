import { apiClient } from './apiClient';
import { API_ENDPOINTS, API_BASE_URL } from '../config/api';
import { log, warn, error } from '../utils/logger';
import {
    User,
    AuthResponse,
    Request,
    Bid,
    Order,
    Stats,
    Address,
    Product,
    Notification,
    SupportTicket,
    Vehicle,
    LoyaltyTransaction,
    PaymentMethod,
    UrgentAction
} from './types';

export class DeliveryService {
    async getDeliveryZones(): Promise<{ zones: Array<{ zone_id: string; name: string; base_fee: number }> }> {
        return apiClient.request(API_ENDPOINTS.ZONES);
    }

    async calculateDeliveryFee(
        latitude: number,
        longitude: number
    ): Promise<{ fee: number; zone: string; distance_km?: number }> {
        return apiClient.request(API_ENDPOINTS.CALCULATE_FEE, {
            method: 'POST',
            body: JSON.stringify({ latitude, longitude })
        });
    }
}

export const deliveryService = new DeliveryService();
