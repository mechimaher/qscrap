/**
 * Formatting Utilities for QScrap Mobile App
 * Handles dates, currencies, phone numbers, and relative time.
 */
import { t, getCurrentLanguage } from './i18nHelper';

const getLocale = () => getCurrentLanguage() === 'ar' ? 'ar-QA' : 'en-US';
/**
 * Format a date to a human-readable string
 */
export const formatDate = (
    date: Date | string | number,
    options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }
): string => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return t('common.invalidDate');
    return d.toLocaleDateString(getLocale(), options);
};

/**
 * Format a date with time
 */
export const formatDateTime = (
    date: Date | string | number,
    options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }
): string => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return t('common.invalidDate');
    return d.toLocaleString(getLocale(), options);
};

/**
 * Format time only
 */
export const formatTime = (
    date: Date | string | number,
    options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
    }
): string => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return t('common.invalidTime');
    return d.toLocaleTimeString(getLocale(), options);
};

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 */
export const formatRelativeTime = (date: Date | string | number): string => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return t('common.invalidDate');

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);

    const isFuture = diffMs < 0;
    const abs = (val: number) => Math.abs(val);

    if (abs(diffSec) < 60) {
        return t('time.justNow');
    } else if (abs(diffMin) < 60) {
        const mins = abs(diffMin);
        return isFuture
            ? t('time.inMinutes', { count: mins })
            : t('time.minutesAgo', { count: mins });
    } else if (abs(diffHour) < 24) {
        const hours = abs(diffHour);
        return isFuture
            ? t('time.inHours', { count: hours })
            : t('time.hoursAgo', { count: hours });
    } else if (abs(diffDay) < 7) {
        const days = abs(diffDay);
        if (days === 1) return isFuture ? t('time.tomorrow') : t('time.yesterday');
        return isFuture
            ? t('time.inDays', { count: days })
            : t('time.daysAgo', { count: days });
    } else if (abs(diffWeek) < 4) {
        const weeks = abs(diffWeek);
        return isFuture
            ? t('time.inWeeks', { count: weeks })
            : t('time.weeksAgo', { count: weeks });
    } else if (abs(diffMonth) < 12) {
        const months = abs(diffMonth);
        return isFuture
            ? t('time.inMonths', { count: months })
            : t('time.monthsAgo', { count: months });
    } else {
        const years = abs(diffYear);
        return isFuture
            ? t('time.inYears', { count: years })
            : t('time.yearsAgo', { count: years });
    }
};

/**
 * Format currency (QAR)
 */
export const formatCurrency = (
    amount: number | string,
    currency: string = 'QAR',
    showSymbol: boolean = true
): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return `0.00 ${currency}`;

    const formatted = num.toLocaleString(getLocale(), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return showSymbol ? `${formatted} ${currency}` : formatted;
};

/**
 * Format phone number for display
 */
export const formatPhoneNumber = (phone: string): string => {
    if (!phone) return '';

    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');

    // Format as +974 XXXX XXXX
    if (cleaned.length === 8) {
        return `+974 ${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('974')) {
        return `+974 ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
    } else if (cleaned.length === 12 && cleaned.startsWith('974')) {
        return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
    }

    // Return as-is if we can't format it
    return phone;
};

/**
 * Format a number with thousands separators
 */
export const formatNumber = (num: number | string, decimals: number = 0): string => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(n)) return '0';

    return n.toLocaleString(getLocale(), {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

/**
 * Format file size
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
};

/**
 * Format distance
 */
export const formatDistance = (meters: number): string => {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
};

/**
 * Format duration in minutes to human-readable string
 */
export const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
        return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (mins === 0) {
        return `${hours} hr${hours > 1 ? 's' : ''}`;
    }

    return `${hours} hr${hours > 1 ? 's' : ''} ${mins} min`;
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
};

/**
 * Capitalize first letter
 */
export const capitalize = (text: string): string => {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Format order number for display
 */
export const formatOrderNumber = (orderNumber: string | number): string => {
    const num = String(orderNumber).padStart(6, '0');
    return `#${num}`;
};

/**
 * Format status for display (snake_case to Title Case)
 */
export const formatStatus = (status: string): string => {
    if (!status) return '';
    return status
        .split('_')
        .map(word => capitalize(word))
        .join(' ');
};
