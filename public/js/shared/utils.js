/**
 * QScrap Shared Utilities
 * 
 * Common utility functions used across all modules
 */

// ===== SECURITY UTILITIES =====

/**
 * Escape HTML to prevent XSS attacks
 * Use this for ALL user-generated content
 * @param {string} text - User-provided text
 * @returns {string} - Escaped text safe for HTML
 */
function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Create element with safe text content
 * @param {string} tag - HTML tag name
 * @param {string} text - Text content
 * @param {string} className - Optional CSS class
 * @returns {HTMLElement}
 */
function createTextElement(tag, text, className = '') {
    const el = document.createElement(tag);
    el.textContent = text || '';
    if (className) el.className = className;
    return el;
}

// ===== DATE/TIME UTILITIES =====

/**
 * Format date to local string
 * @param {string|Date} date - Date to format
 * @param {boolean} includeTime - Include time in output
 * @returns {string}
 */
function formatDate(date, includeTime = false) {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';

    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    };

    if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }

    return d.toLocaleDateString('en-US', options);
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param {string|Date} date 
 * @returns {string}
 */
function timeAgo(date) {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';

    const seconds = Math.floor((new Date() - d) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return formatDate(d);
}

// ===== NUMBER UTILITIES =====

/**
 * Format currency (QAR)
 * @param {number} amount 
 * @param {boolean} showSymbol 
 * @returns {string}
 */
function formatCurrency(amount, showSymbol = true) {
    const num = parseFloat(amount) || 0;
    const formatted = num.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
    return showSymbol ? `${formatted} QAR` : formatted;
}

// ===== API UTILITIES =====

/**
 * Make authenticated API request
 * @param {string} endpoint - API endpoint (without /api prefix)
 * @param {Object} options - Fetch options
 * @param {string} tokenKey - localStorage key for auth token
 * @returns {Promise<{data: any, error: string|null, status: number}>}
 */
async function apiRequest(endpoint, options = {}, tokenKey = 'token') {
    const token = localStorage.getItem(tokenKey);

    const defaultHeaders = {
        'Content-Type': 'application/json'
    };

    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };

    try {
        const res = await fetch(`/api${endpoint}`, config);
        const data = await res.json();

        if (!res.ok) {
            return {
                data: null,
                error: data.error || data.message || `Request failed with status ${res.status}`,
                status: res.status
            };
        }

        return { data, error: null, status: res.status };
    } catch (err) {
        console.error('API Request Error:', err);
        return {
            data: null,
            error: 'Connection error. Please check your network.',
            status: 0
        };
    }
}

// ===== DOM UTILITIES =====

/**
 * Debounce function calls
 * @param {Function} func 
 * @param {number} wait 
 * @returns {Function}
 */
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function calls
 * @param {Function} func 
 * @param {number} limit 
 * @returns {Function}
 */
function throttle(func, limit = 100) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Add loading state to button
 * @param {HTMLButtonElement} btn 
 * @param {boolean} loading 
 * @param {string} loadingText 
 */
function setButtonLoading(btn, loading, loadingText = 'Loading...') {
    if (!btn) return;

    if (loading) {
        btn._originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="bi bi-hourglass-split"></i> ${loadingText}`;
    } else {
        btn.disabled = false;
        if (btn._originalText) {
            btn.innerHTML = btn._originalText;
        }
    }
}

// ===== STATUS UTILITIES =====

/**
 * Get order status display info
 * @param {string} status 
 * @returns {{label: string, class: string, icon: string}}
 */
function getOrderStatusInfo(status) {
    const statusMap = {
        confirmed: { label: 'Confirmed', class: 'confirmed', icon: 'bi-check-circle' },
        preparing: { label: 'Preparing', class: 'preparing', icon: 'bi-box-seam' },
        ready_for_pickup: { label: 'Ready for Pickup', class: 'ready', icon: 'bi-box-arrow-up' },
        collected: { label: 'Collected', class: 'collected', icon: 'bi-truck' },
        qc_in_progress: { label: 'QC In Progress', class: 'pending', icon: 'bi-clipboard-check' },
        qc_passed: { label: 'QC Passed', class: 'completed', icon: 'bi-patch-check' },
        qc_failed: { label: 'QC Failed', class: 'cancelled', icon: 'bi-x-octagon' },
        in_transit: { label: 'In Transit', class: 'in-transit', icon: 'bi-truck' },
        delivered: { label: 'Delivered', class: 'delivered', icon: 'bi-check-all' },
        completed: { label: 'Completed', class: 'completed', icon: 'bi-check-circle-fill' },
        disputed: { label: 'Disputed', class: 'pending', icon: 'bi-exclamation-circle' },
        refunded: { label: 'Refunded', class: 'refunded', icon: 'bi-arrow-counterclockwise' },
        cancelled_by_customer: { label: 'Cancelled', class: 'cancelled', icon: 'bi-x-circle' },
        cancelled_by_garage: { label: 'Cancelled', class: 'cancelled', icon: 'bi-x-circle' },
        cancelled_by_operations: { label: 'Cancelled', class: 'cancelled', icon: 'bi-x-circle' }
    };

    return statusMap[status] || { label: status, class: '', icon: 'bi-circle' };
}

// ===== VALIDATION UTILITIES =====

/**
 * Validate phone number (Qatar format)
 * @param {string} phone 
 * @returns {boolean}
 */
function isValidPhone(phone) {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, '');
    // Qatar numbers: starts with 3,4,5,6,7 and 8 digits, or with 974 prefix
    return /^(974)?[3-7]\d{7}$/.test(cleaned);
}

/**
 * Validate VIN number
 * @param {string} vin 
 * @returns {boolean}
 */
function isValidVIN(vin) {
    if (!vin) return true; // Optional field
    return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
}

// Export for use in other scripts
window.QScrapUtils = {
    escapeHTML,
    createTextElement,
    formatDate,
    timeAgo,
    formatCurrency,
    apiRequest,
    debounce,
    throttle,
    setButtonLoading,
    getOrderStatusInfo,
    isValidPhone,
    isValidVIN
};

// Also export individual functions for direct use
window.escapeHTML = escapeHTML;
window.formatDate = formatDate;
window.timeAgo = timeAgo;
window.formatCurrency = formatCurrency;
window.apiRequest = apiRequest;
window.debounce = debounce;
window.throttle = throttle;
window.setButtonLoading = setButtonLoading;

// ===== UI UTILITIES =====

/**
 * Toggle Mobile Sidebar
 * Global function for mobile menu interaction
 */
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar') || document.querySelector('.app-sidebar');
    const overlay = document.getElementById('appOverlay') || document.querySelector('.app-overlay');

    if (sidebar) {
        sidebar.classList.toggle('active');
    }

    if (overlay) {
        overlay.classList.toggle('is-visible');
    }
}
window.toggleSidebar = toggleSidebar;
