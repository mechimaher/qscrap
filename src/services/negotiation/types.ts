/**
 * Negotiation Services - Type Definitions
 */

export interface CounterOfferData {
    bid_id: string;
    counter_price: number;
    notes?: string;
}

export interface CounterOfferResponse {
    action: 'accept' | 'counter' | 'decline' | 'reject';
    counter_price?: number;
    notes?: string;
}

export interface NegotiationHistory {
    negotiation_id: string;
    round: number;
    offered_by: 'customer' | 'garage';
    price: number;
    action: string;
    notes?: string;
    created_at: Date;
}
