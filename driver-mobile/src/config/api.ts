// QScrap Driver App - API Configuration
// Production: Using direct IP for stability (Bypass Cloudflare/SSL issues)

export const API_BASE_URL = 'https://qscrap.qa/api';
export const SOCKET_URL = 'https://qscrap.qa';

// For local development, update these temporarily:
// export const API_BASE_URL = 'http://192.168.1.x:3000/api';
// export const SOCKET_URL = 'http://192.168.1.x:3000';

export const API_ENDPOINTS = {
    // Auth
    LOGIN: '/auth/login',

    // Driver Profile
    PROFILE: '/driver/me',
    UPDATE_PROFILE: '/driver/me',
    STATS: '/driver/stats',

    // Assignments
    ASSIGNMENTS: '/driver/assignments',
    ASSIGNMENT_DETAIL: (id: string) => `/driver/assignments/${id}`,
    UPDATE_ASSIGNMENT_STATUS: (id: string) => `/driver/assignments/${id}/status`,
    UPLOAD_PROOF: (id: string) => `/driver/assignments/${id}/proof`,

    // Location
    UPDATE_LOCATION: '/driver/location',

    // Availability
    TOGGLE_AVAILABILITY: '/driver/availability',

    // Earnings
    EARNINGS: '/driver/earnings',
    PAYOUT_HISTORY: '/driver/payouts',

    // Notifications
    NOTIFICATIONS: '/notifications',
    NOTIFICATIONS_REGISTER: '/notifications/register',
    MARK_NOTIFICATION_READ: (id: string) => `/notifications/${id}/read`,

    // Chat
    MESSAGES: '/chat/messages',
    CHAT_HISTORY: (orderId: string) => `/chat/order/${orderId}`,
};
