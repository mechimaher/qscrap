/**
 * Order Services - Type Definitions
 */

export interface OrderFilters {
    status?: string;
    page?: number;
    limit?: number;
}

export interface StatusChange {
    old_status: string;
    new_status: string;
}

export interface PaginatedOrders {
    orders: any[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface OrderDetail {
    order: any;
    status_history: any[];
    review: any | null;
}

export interface ReviewData {
    overall_rating: number;
    part_quality_rating?: number;
    communication_rating?: number;
    delivery_rating?: number;
    review_text?: string;
}

export interface ReviewsWithStats {
    reviews: any[];
    stats: {
        total_reviews: number;
        avg_rating: number;
        avg_part_quality: number;
        avg_communication: number;
        avg_delivery: number;
    };
}
