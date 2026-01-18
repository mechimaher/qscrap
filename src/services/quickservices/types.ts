/**
 * QuickService Types
 * Type definitions for the Quick Services vertical
 */

export type QuickServiceType =
    | 'battery'
    | 'oil'
    | 'wash'
    | 'tire'
    | 'ac'
    | 'breakdown'
    | 'diagnostic'
    | 'electrician';

export type QuickServiceStatus =
    | 'pending'
    | 'assigned'
    | 'quoted'
    | 'accepted'
    | 'en_route'
    | 'in_progress'
    | 'completed'
    | 'cancelled';

export interface QuickServiceRequest {
    request_id: string;
    customer_id: string;
    service_type: QuickServiceType;
    location_lat: number;
    location_lng: number;
    location_address: string;
    vehicle_make: string;
    vehicle_model: string;
    vehicle_year: string;
    notes?: string;
    payment_method: string;
    status: QuickServiceStatus;
    assigned_garage_id?: string;
    quoted_price?: number;
    final_price?: number;
    created_at: Date;
    assigned_at?: Date;
    completed_at?: Date;
}

export interface CreateRequestDto {
    service_type: QuickServiceType;
    location_lat: number;
    location_lng: number;
    location_address: string;
    vehicle_make: string;
    vehicle_model: string;
    vehicle_year: string;
    notes?: string;
    payment_method?: string;
}

export interface AssignmentResult {
    success: boolean;
    garage?: {
        garage_id: string;
        name: string;
        distance_km: number;
    };
    error?: string;
}

export interface GarageWithDistance {
    garage_id: string;
    garage_name: string;
    phone_number: string;
    location_lat: string;
    location_lng: string;
    mobile_service_radius_km: number;
    distance_km: number;
}

export interface QuickServicePricing {
    min: number;
    max: number;
    currency: string;
    duration: string;
    note?: string;
}

export const VALID_SERVICE_TYPES: QuickServiceType[] = [
    'battery', 'oil', 'wash', 'tire', 'ac', 'breakdown', 'diagnostic', 'electrician'
];

export const SERVICE_PRICING: Record<QuickServiceType, QuickServicePricing> = {
    battery: { min: 150, max: 250, currency: 'QAR', duration: '30 mins' },
    diagnostic: { min: 100, max: 150, currency: 'QAR', duration: '20 mins' },
    electrician: { min: 80, max: 200, currency: 'QAR', duration: '45 mins' },
    oil: { min: 120, max: 200, currency: 'QAR', duration: '30 mins' },
    wash: { min: 80, max: 120, currency: 'QAR', duration: '45 mins' },
    tire: { min: 50, max: 150, currency: 'QAR', duration: '20 mins' },
    ac: { min: 200, max: 300, currency: 'QAR', duration: '45 mins' },
    breakdown: { min: 70, max: 100, currency: 'QAR', duration: '30 mins', note: 'Towing & emergency' }
};
