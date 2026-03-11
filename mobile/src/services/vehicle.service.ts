import { apiClient } from "./apiClient";
import { API_ENDPOINTS, API_BASE_URL } from "../config/api";
import { log, warn, error } from "../utils/logger";
import { User, AuthResponse, Request, Bid, Order, Stats, Address, Product, Notification, SupportTicket, Vehicle, LoyaltyTransaction, PaymentMethod, UrgentAction } from "./types";

export class VehicleService {
    async getMyVehicles(): Promise<{ vehicles: Vehicle[] }> {
        return apiClient.request('/vehicles');
    }

    async addVehicle(vehicleData: {
            car_make: string;
            car_model: string;
            car_year: number;
            vin_number?: string;
            nickname?: string;
        }): Promise<{ success: boolean; vehicle: Vehicle }> {
        return apiClient.request('/vehicles', {
            method: 'POST',
            body: JSON.stringify(vehicleData)
        });
    }

    async deleteVehicle(vehicleId: string): Promise<{ success: boolean }> {
        return apiClient.request(`/vehicles/${vehicleId}`, {
            method: 'DELETE'
        });
    }

    async updateVehicle(vehicleId: string, data: { nickname?: string; is_primary?: boolean; vin_number?: string }): Promise<{ success: boolean; vehicle: Vehicle }> {
        return apiClient.request(`/vehicles/${vehicleId}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }
}

export const vehicleService = new VehicleService();
