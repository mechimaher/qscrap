// API Configuration
// Use your local IP when testing on physical device
// In production, this would be your actual server URL

export const API_BASE_URL = 'http://192.168.1.59:3000/api';
export const SOCKET_URL = 'http://192.168.1.59:3000';

// API endpoints - Match exactly with backend routes
export const API_ENDPOINTS = {
    // Auth
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',

    // Requests
    REQUESTS: '/requests',
    MY_REQUESTS: '/requests/my',
    CANCEL_REQUEST: (requestId: string) => `/requests/${requestId}/cancel`,

    // Bids
    REJECT_BID: (bidId: string) => `/bids/${bidId}/reject`,

    // Orders - FIXED: matches backend /orders/accept-bid/:bid_id
    MY_ORDERS: '/orders/my',
    ACCEPT_BID: (bidId: string) => `/orders/accept-bid/${bidId}`,
    CONFIRM_DELIVERY: (orderId: string) => `/orders/${orderId}/confirm-delivery`,

    // Counter-Offers (Negotiation)
    COUNTER_OFFER: (bidId: string) => `/negotiation/bids/${bidId}/counter-offer`,
    RESPOND_TO_COUNTER: (counterOfferId: string) => `/negotiation/counter-offers/${counterOfferId}/customer-respond`,
    ACCEPT_LAST_OFFER: (bidId: string) => `/negotiation/bids/${bidId}/accept-last-offer`,
    NEGOTIATION_HISTORY: (bidId: string) => `/negotiation/bids/${bidId}/negotiations`,

    // Dashboard
    STATS: '/dashboard/customer/stats',
    PROFILE: '/dashboard/profile',

    // Addresses
    ADDRESSES: '/addresses',

    // Delivery
    ZONES: '/delivery/zones',
    CALCULATE_FEE: '/delivery/calculate-fee',

    // Support
    TICKETS: '/support/tickets',

    // Chat
    CHAT_MESSAGES: (orderId: string) => `/chat/messages/${orderId}`,
    MESSAGES: '/chat/messages',
};

// App Info
export const APP_NAME = 'QScrap';
export const APP_VERSION = '1.0.0';

// Privacy URLs
export const PRIVACY_URL = `${API_BASE_URL.replace('/api', '')}/privacy.html`;
export const TERMS_URL = `${API_BASE_URL.replace('/api', '')}/terms.html`;
