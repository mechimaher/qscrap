// QScrap Customer App - API Configuration
// Production: Using direct IP for stability (Bypass Cloudflare/SSL issues)

export const API_BASE_URL = 'https://qscrap.qa/api';
export const SOCKET_URL = 'https://qscrap.qa';

// For local development, update these temporarily:
// export const API_BASE_URL = 'http://192.168.1.x:3000/api';
// export const SOCKET_URL = 'http://192.168.1.x:3000';

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
    // FIXED: Backend uses /requests/:id/cancel (customer)
    CANCEL_REQUEST: (requestId: string) => `/requests/${requestId}/cancel`,
    DELETE_REQUEST: (requestId: string) => `/requests/${requestId}`,

    // Bids
    REJECT_BID: (bidId: string) => `/bids/${bidId}/reject`,

    // Orders
    MY_ORDERS: '/orders/my',
    ACCEPT_BID: (bidId: string) => `/orders/accept-bid/${bidId}`,
    CONFIRM_DELIVERY: (orderId: string) => `/orders/${orderId}/confirm-delivery`,
    SUBMIT_REVIEW: (orderId: string) => `/orders/${orderId}/review`,
    // FIXED: Order cancellation uses /cancellations/orders/...
    CANCEL_ORDER: (orderId: string) => `/cancellations/orders/${orderId}/cancel/customer`,

    // Counter-Offers (Negotiation)
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
    // FIXED: Backend uses /notifications/register-token
    NOTIFICATIONS_REGISTER: '/notifications/register-token',
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

    // Catalog (Featured Products)
    CATALOG_SEARCH: '/showcase/parts',

    // OCR
    OCR_VIN: '/ocr/vin/base64',
};

// App Info
export const APP_NAME = 'QScrap';
export const APP_VERSION = '1.0.0';

// Privacy URLs (These should still point to the main site likely, but let's check)
// Assuming privacy.html is on the main landing page qscrap.qa, not api.qscrap.qa
export const PRIVACY_URL = 'https://qscrap.qa/privacy.html';
export const TERMS_URL = 'https://qscrap.qa/terms.html';
