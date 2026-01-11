// App Version
export const APP_VERSION = '1.0.0';

// API Configuration
export const API_CONFIG = {
    // Forcing production URL to match Driver App success
    BASE_URL: 'https://qscrap.qa/api',
    SOCKET_URL: 'https://qscrap.qa',
    // BASE_URL: __DEV__ ? 'http://192.168.1.59:3000/api' : 'https://qscrap.qa/api',
    // SOCKET_URL: __DEV__ ? 'http://192.168.1.59:3000' : 'https://qscrap.qa',
    TIMEOUT: 15000,
};

export const DEFAULT_DELIVERY_FEE = 25;

// Part Categories
export const PART_CATEGORIES = [
    { id: 'engine', name: 'Engine', nameAr: 'محرك', icon: 'cog' },
    { id: 'transmission', name: 'Transmission', nameAr: 'ناقل الحركة', icon: 'cube-outline' },
    { id: 'body', name: 'Body Parts', nameAr: 'أجزاء الهيكل', icon: 'car-outline' },
    { id: 'electrical', name: 'Electrical', nameAr: 'كهربائي', icon: 'flash-outline' },
    { id: 'suspension', name: 'Suspension', nameAr: 'التعليق', icon: 'swap-vertical-outline' },
    { id: 'interior', name: 'Interior', nameAr: 'داخلي', icon: 'car-sport-outline' },
    { id: 'lights', name: 'Lights', nameAr: 'أضواء', icon: 'bulb-outline' },
    { id: 'other', name: 'Other', nameAr: 'أخرى', icon: 'ellipsis-horizontal' },
];

// Car Makes
export const CAR_MAKES = [
    'Toyota', 'Nissan', 'Honda', 'Lexus', 'Land Rover',
    'Mercedes-Benz', 'BMW', 'Audi', 'Porsche', 'Ford',
    'Chevrolet', 'GMC', 'Hyundai', 'Kia', 'Mitsubishi',
    'Mazda', 'Volkswagen', 'Other'
];

// Order Status Labels
export const ORDER_STATUS = {
    pending: { label: 'Pending', color: 'warning', icon: 'time-outline' },
    processing: { label: 'Processing', color: 'primary', icon: 'cog-outline' },
    ready_for_pickup: { label: 'Ready for Pickup', color: 'primary', icon: 'cube-outline' },
    assigned_for_pickup: { label: 'Driver Assigned', color: 'primary', icon: 'car-outline' },
    collected: { label: 'Collected', color: 'primary', icon: 'checkmark-circle-outline' },
    qc_pending: { label: 'Quality Check', color: 'warning', icon: 'search-outline' },
    qc_passed: { label: 'QC Passed', color: 'success', icon: 'shield-checkmark-outline' },
    qc_failed: { label: 'QC Failed', color: 'danger', icon: 'close-circle-outline' },
    out_for_delivery: { label: 'On the Way', color: 'success', icon: 'bicycle-outline' },
    delivered: { label: 'Delivered', color: 'success', icon: 'home-outline' },
    completed: { label: 'Completed', color: 'success', icon: 'checkmark-done-outline' },
    cancelled: { label: 'Cancelled', color: 'danger', icon: 'close-circle-outline' },
    disputed: { label: 'Disputed', color: 'warning', icon: 'warning-outline' },
    returned: { label: 'Returned', color: 'textMuted', icon: 'return-down-back-outline' },
};

// Request Status Labels
export const REQUEST_STATUS = {
    active: { label: 'Active', color: 'success', icon: 'radio-button-on-outline' },
    pending: { label: 'Pending', color: 'warning', icon: 'time-outline' },
    fulfilled: { label: 'Fulfilled', color: 'primary', icon: 'checkmark-circle-outline' },
    expired: { label: 'Expired', color: 'textMuted', icon: 'timer-outline' },
    cancelled: { label: 'Cancelled', color: 'danger', icon: 'close-circle-outline' },
};

// Bid Status Labels
export const BID_STATUS = {
    pending: { label: 'Pending', color: 'warning', icon: 'time-outline' },
    accepted: { label: 'Accepted', color: 'success', icon: 'checkmark-circle-outline' },
    rejected: { label: 'Rejected', color: 'danger', icon: 'close-circle-outline' },
    negotiating: { label: 'Negotiating', color: 'primary', icon: 'chatbubbles-outline' },
    withdrawn: { label: 'Withdrawn', color: 'textMuted', icon: 'exit-outline' },
};
