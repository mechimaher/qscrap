/**
 * Status Labels — VVIP G-04
 * Human-readable status labels for request and order states.
 * Eliminates technical jargon that causes user confusion.
 */

// Request status labels
export const REQUEST_STATUS_LABELS = {
    pending: {
        en: 'Waiting for Garages',
        ar: 'بانتظار المحلات',
        color: '#F59E0B', // Amber
        icon: 'clock-outline'
    },
    active: {
        en: 'You Have Bids!',
        ar: 'لديك عروض أسعار!',
        color: '#3B82F6', // Blue
        icon: 'tag-multiple'
    },
    accepted: {
        en: 'Order Created ✓',
        ar: 'تم إنشاء الطلب ✓',
        color: '#22C55E', // Green
        icon: 'check-circle'
    },
    expired: {
        en: 'Expired',
        ar: 'منتهي الصلاحية',
        color: '#6B7280', // Gray
        icon: 'clock-alert-outline'
    },
    cancelled_by_customer: {
        en: 'Cancelled',
        ar: 'ملغي',
        color: '#EF4444', // Red
        icon: 'close-circle'
    }
} as const;

// Order status labels
export const ORDER_STATUS_LABELS = {
    pending_payment: {
        en: 'Awaiting Payment',
        ar: 'بانتظار الدفع',
        color: '#F59E0B', // Amber
        icon: 'credit-card-clock'
    },
    confirmed: {
        en: 'Confirmed',
        ar: 'مؤكد',
        color: '#22C55E', // Green
        icon: 'check-decagram'
    },
    preparing: {
        en: 'Being Prepared',
        ar: 'جاري التحضير',
        color: '#F59E0B', // Amber
        icon: 'cog'
    },
    ready_for_pickup: {
        en: 'Ready for Pickup',
        ar: 'جاهز للاستلام',
        color: '#8B5CF6', // Purple
        icon: 'package-variant'
    },
    ready_for_collection: {
        en: 'Ready for Collection',
        ar: 'جاهز للتجميع',
        color: '#8B5CF6', // Purple
        icon: 'package-variant'
    },
    collected: {
        en: 'Picked Up',
        ar: 'تم الاستلام',
        color: '#3B82F6', // Blue
        icon: 'truck-check'
    },
    in_transit: {
        en: 'On the Way',
        ar: 'في الطريق',
        color: '#3B82F6', // Blue
        icon: 'truck-fast'
    },
    delivered: {
        en: 'Delivered ✓',
        ar: 'تم التوصيل ✓',
        color: '#22C55E', // Green
        icon: 'home-check'
    },
    completed: {
        en: 'Complete',
        ar: 'مكتمل',
        color: '#22C55E', // Green
        icon: 'check-all'
    },
    cancelled_by_customer: {
        en: 'Cancelled',
        ar: 'ملغي',
        color: '#EF4444', // Red
        icon: 'close-circle'
    },
    cancelled_by_garage: {
        en: 'Cancelled by Garage',
        ar: 'ملغي من المحل',
        color: '#EF4444', // Red
        icon: 'close-circle'
    },
    cancelled_by_ops: {
        en: 'Cancelled',
        ar: 'ملغي',
        color: '#EF4444', // Red
        icon: 'close-circle'
    },
    cancelled_by_undo: {
        en: 'Undone',
        ar: 'تم التراجع',
        color: '#6B7280', // Gray
        icon: 'undo'
    },
    disputed: {
        en: 'Under Review',
        ar: 'قيد المراجعة',
        color: '#F59E0B', // Amber
        icon: 'alert-circle'
    },
    refunded: {
        en: 'Refunded',
        ar: 'تم الاسترداد',
        color: '#6B7280', // Gray
        icon: 'cash-refund'
    }
} as const;

export type RequestStatus = keyof typeof REQUEST_STATUS_LABELS;
export type OrderStatus = keyof typeof ORDER_STATUS_LABELS;

/**
 * Get human-readable label for a status
 */
export function getStatusLabel(
    type: 'request' | 'order',
    status: string,
    lang: 'en' | 'ar' = 'en'
): string {
    const labels = type === 'request' ? REQUEST_STATUS_LABELS : ORDER_STATUS_LABELS;
    const entry = (labels as Record<string, { en: string; ar: string }>)[status];
    return entry?.[lang] || status;
}

/**
 * Get status color
 */
export function getStatusColor(type: 'request' | 'order', status: string): string {
    const labels = type === 'request' ? REQUEST_STATUS_LABELS : ORDER_STATUS_LABELS;
    const entry = (labels as Record<string, { color: string }>)[status];
    return entry?.color || '#6B7280';
}

/**
 * Get status icon name (MaterialCommunityIcons)
 */
export function getStatusIcon(type: 'request' | 'order', status: string): string {
    const labels = type === 'request' ? REQUEST_STATUS_LABELS : ORDER_STATUS_LABELS;
    const entry = (labels as Record<string, { icon: string }>)[status];
    return entry?.icon || 'help-circle';
}
