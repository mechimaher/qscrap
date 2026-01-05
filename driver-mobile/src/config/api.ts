// QScrap Driver App - API Configuration
// LOCAL DEV: Uses local server
// PRODUCTION BUILD: Set IS_PRODUCTION = true or use EAS env vars

// Current Environment
const IS_PRODUCTION = false; // Set to true for production builds

export const API_BASE_URL = IS_PRODUCTION
    ? 'https://qscrap.qa/api'
    : 'http://192.168.1.59:3000/api';

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
