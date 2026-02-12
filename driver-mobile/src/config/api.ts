// Production: Using api.qscrap.qa subdomain for reliable Cloudflare routing

export const API_BASE_URL = 'https://api.qscrap.qa/api';
export const SOCKET_URL = 'https://api.qscrap.qa';
// Use main domain for uploads (images) - fixes Cloudflare mobile issues
export const UPLOAD_BASE_URL = 'https://qscrap.qa';

// For local development:
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
    COMPLETE_WITH_POD: '/delivery/complete-with-pod',  // Complete order with POD

    // Location
    UPDATE_LOCATION: '/driver/location',

    // Availability
    TOGGLE_AVAILABILITY: '/driver/availability',

    // Notifications
    NOTIFICATIONS: '/notifications',
    NOTIFICATIONS_REGISTER: '/notifications/register',
    MARK_NOTIFICATION_READ: (id: string) => `/notifications/${id}/read`,

    // Chat
    MESSAGES: '/chat/messages',
    CHAT_HISTORY: (orderId: string) => `/chat/order/${orderId}`,
};
