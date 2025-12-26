// API Configuration
// PRODUCTION: Use your actual server URL
// DEVELOPMENT: Uncomment local IP for testing on physical device

// PRODUCTION URLs (update when domain is ready)
// export const API_BASE_URL = 'https://api.qscrap.qa/api';
// export const SOCKET_URL = 'https://api.qscrap.qa';

// DEVELOPMENT URLs (for local testing)
export const API_BASE_URL = 'http://192.168.1.59:3000/api';
export const SOCKET_URL = 'http://192.168.1.59:3000';

// API endpoints - Match exactly with backend routes
export const API_ENDPOINTS = {
    // Auth
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    CHANGE_PASSWORD: '/auth/change-password',
    DELETE_ACCOUNT: '/auth/delete-account',

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
    SUBMIT_REVIEW: (orderId: string) => `/orders/${orderId}/review`,

    // Counter-Offers (Negotiation) - FIXED: backend uses /negotiations (plural)
    COUNTER_OFFER: (bidId: string) => `/negotiations/bids/${bidId}/counter-offer`,
    RESPOND_TO_COUNTER: (counterOfferId: string) => `/negotiations/counter-offers/${counterOfferId}/customer-respond`,
    ACCEPT_LAST_OFFER: (bidId: string) => `/negotiations/bids/${bidId}/accept-last-offer`,
    NEGOTIATION_HISTORY: (bidId: string) => `/negotiations/bids/${bidId}/negotiations`,

    // Dashboard
    STATS: '/dashboard/customer/stats',
    PROFILE: '/dashboard/profile',
    UPDATE_PROFILE: '/dashboard/profile',

    // Notifications
    NOTIFICATIONS: '/dashboard/notifications',
    MARK_NOTIFICATION_READ: (notificationId: string) => `/dashboard/notifications/${notificationId}/read`,
    MARK_ALL_NOTIFICATIONS_READ: '/dashboard/notifications/read-all',

    // Addresses
    ADDRESSES: '/addresses',

    // Delivery
    ZONES: '/delivery/zones',
    CALCULATE_FEE: '/delivery/calculate-fee',

    // Support
    TICKETS: '/support/tickets',
    TICKET_DETAIL: (ticketId: string) => `/support/tickets/${ticketId}`,
    TICKET_MESSAGES: (ticketId: string) => `/support/tickets/${ticketId}/messages`,

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
