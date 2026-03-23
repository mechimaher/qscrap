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

export class AddressService {
    async getAddresses(): Promise<{ addresses: Address[] }> {
        return apiClient.request(API_ENDPOINTS.ADDRESSES);
    }

    async addAddress(data: Partial<Address>): Promise<{ address: Address }> {
        return apiClient.request(API_ENDPOINTS.ADDRESSES, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async deleteAddress(addressId: string): Promise<{ success: boolean }> {
        return apiClient.request(`${API_ENDPOINTS.ADDRESSES}/${addressId}`, {
            method: 'DELETE'
        });
    }

    async setDefaultAddress(addressId: string): Promise<{ success: boolean }> {
        return apiClient.request(`${API_ENDPOINTS.ADDRESSES}/${addressId}/default`, {
            method: 'PUT'
        });
    }

    async updateAddress(
        addressId: string,
        data: { label: string; address_text: string; latitude?: number; longitude?: number; is_default?: boolean }
    ): Promise<{ success: boolean; address?: Address }> {
        return apiClient.request(`${API_ENDPOINTS.ADDRESSES}/${addressId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
}

export const addressService = new AddressService();
