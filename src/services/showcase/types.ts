/**
 * Showcase Services - Type Definitions
 */

export interface ShowcaseFilters {
    car_make?: string;
    car_model?: string;
    search?: string;
    limit?: number;
    offset?: number;
}

export interface PartDetail {
    part_id: string;
    garage_id: string;
    title: string;
    part_description: string;
    car_make: string;
    car_model: string;
    car_year?: string;
    price: number;
    quantity: number;
    status: 'active' | 'hidden';
    is_negotiable: boolean;
    image_urls?: string[];
    garage_name: string;
    rating_average?: number;
    rating_count?: number;
}

export interface CreatePartData {
    title: string;
    part_description: string;
    car_make: string;
    car_model: string;
    car_year?: string;
    price: number;
    quantity: number;
    is_negotiable: boolean;
    image_urls?: string[];
}

export interface UpdatePartData {
    title?: string;
    part_description?: string;
    car_make?: string;
    car_model?: string;
    car_year?: string;
    price?: number;
    quantity?: number;
    is_negotiable?: boolean;
    images_to_remove?: string[];
}

export interface QuickOrderData {
    part_id: string;
    quantity: number;
    delivery_address_text: string;
    delivery_lat?: number;
    delivery_lng?: number;
    payment_method: string;
    delivery_notes?: string;
}

export interface QuoteRequestData {
    part_id: string;
    quantity: number;
    delivery_address_text: string;
    delivery_lat?: number;
    delivery_lng?: number;
    customer_notes?: string;
}
